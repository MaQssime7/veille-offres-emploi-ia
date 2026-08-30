"use server";

/**
 * Les actions d'écriture sur une offre.
 *
 * ⚠️ **`"use server"` marque ces fonctions comme atteignables depuis le
 * navigateur.** Ce n'est pas une annotation d'organisation : Next publie pour
 * chacune un point d'entrée HTTP, invoqué par un `POST` portant un en-tête
 * `Next-Action`. Rien n'oblige ce `POST` à venir de notre page, ni ses
 * arguments à ressembler à ce que nos boutons envoient. **Tout ce qui arrive
 * ici est une donnée étrangère**, y compris l'identifiant d'offre — qui, dans
 * l'écran, vient pourtant de notre propre base.
 *
 * D'où l'ordre, qui ne se réarrange pas :
 *
 * 1. `exigerSession()` — la serrure, en première ligne, sans exception.
 * 2. Valider la valeur reçue : liste blanche pour le statut (`estStatut()`),
 *    type exact pour le coup de cœur et la note. Jamais une conversion
 *    permissive, qui accepterait n'importe quoi en le rendant plausible.
 * 3. Valider l'identifiant (fait par les fonctions de `lib/offres.ts`, qui
 *    appliquent la même expression régulière que la lecture).
 * 4. Écrire, et laisser la contrainte de la base trancher en dernier ressort.
 */

import { revalidatePath } from "next/cache";

import { exigerSession } from "@/lib/acces";
import {
  calculerEtatEnrichissement,
  estEnVol,
  type EtatEnrichissement,
} from "@/lib/enrichissement";
import {
  estPerime,
  lireDernierEnrichissement,
  lireEnveloppeDuJour,
  MOTIF_PEREMPTION,
  ouvrirDemande,
  refermerTentative,
} from "@/lib/enrichissement-base";
import { lancerEnrichissement } from "@/lib/github";
import { changerCoupDeCoeur, changerStatut, enregistrerNote } from "@/lib/offres";
import { LONGUEUR_MAX_NOTE, normaliserNote } from "@/lib/notes";
import { estStatut } from "@/lib/statuts";

/**
 * Ce que l'action rend au navigateur.
 *
 * ⚠️ **Un message écrit pour un humain, jamais le détail technique.** La cause
 * exacte (contrainte violée, code HTTP, message de Postgres) part au journal du
 * serveur par `lib/supabase.ts`. La renvoyer au navigateur la rendrait visible
 * dans l'onglet réseau et, tôt ou tard, dans une capture d'écran.
 */
export type ResultatAction = { ok: true } | { ok: false; message: string };

/**
 * Combien d'annonces un seul clic peut écrire.
 *
 * ⚠️ **Cette borne existe parce que le tableau vient du NAVIGATEUR.** Depuis le
 * 30 août 2026 le bouton de statut traite un poste entier — l'annonce affichée
 * et ses jumelles — donc l'action reçoit une liste. Rien n'oblige un `POST`
 * portant l'en-tête `Next-Action` à envoyer la liste que nos boutons
 * construisent : sans borne, un appel forgé réécrirait toute la table en une
 * requête, et chaque écriture est un aller-retour vers Supabase.
 *
 * **8 est très au-dessus du réel** : le poste le plus republié de la base au
 * 30 août 2026 l'est **quatre** fois. La borne n'est pas là pour cadrer l'usage,
 * elle est là pour que l'abus soit impossible.
 */
const MAX_ANNONCES_PAR_CLIC = 8;

export async function definirStatut(
  identifiants: string[],
  statut: string,
): Promise<ResultatAction> {
  // ⚠️ Première ligne, sans exception. Hors de tout try/catch : `redirect()`
  // lève une exception que Next intercepte, l'attraper annulerait le renvoi.
  await exigerSession();

  if (!estStatut(statut)) {
    // ⚠️ **Le journal ne recopie pas la valeur reçue.** Elle vient de
    // l'extérieur : la journaliser telle quelle laisserait un inconnu écrire ce
    // qu'il veut dans les journaux du serveur — de quoi les rendre illisibles,
    // ou y glisser de fausses lignes d'erreur.
    console.error("[statut] valeur refusée — hors de la liste des statuts connus");
    return { ok: false, message: "Ce statut n’existe pas." };
  }

  // ⚠️ **Le tableau est revérifié à l'exécution, type compris.** TypeScript
  // disparaît à la compilation et l'appelant réel est un `POST` : il peut
  // envoyer une chaîne, un objet, `undefined`, ou dix mille identifiants.
  if (
    !Array.isArray(identifiants) ||
    identifiants.length === 0 ||
    identifiants.length > MAX_ANNONCES_PAR_CLIC ||
    identifiants.some((i) => typeof i !== "string")
  ) {
    console.error(
      `[statut] liste refusée — ${Array.isArray(identifiants) ? `${identifiants.length} éléments` : "ce n'est pas une liste"}`,
    );
    return { ok: false, message: "Demande invalide." };
  }

  // ⚠️ **Les doublons sont écartés AVANT d'écrire.** Le même identifiant répété
  // huit fois passerait les contrôles ci-dessus et produirait huit écritures
  // identiques : l'opération resterait juste — elle est idempotente — mais on
  // paierait huit allers-retours pour un seul changement.
  const uniques = [...new Set(identifiants)];

  // ⚠️ **Les écritures partent ENSEMBLE, et ce n'est pas qu'une question de
  // vitesse.** Enchaînées, un poste publié quatre fois multiplierait par quatre
  // le temps avant que la liste ne se réorganise — et c'est exactement pendant
  // ce délai que le verrou de tri retient les clics suivants.
  const resultats = await Promise.all(
    uniques.map((identifiant) => changerStatut(identifiant, statut)),
  );

  const echec = resultats.find((r) => !r.ok);

  if (echec && !echec.ok) {
    // ⚠️ **Un échec partiel se DIT, il ne se tait pas.** Sur un poste publié
    // deux fois, la première écriture peut réussir et la seconde échouer : la
    // ligne quitterait alors l'écran du matin en laissant sa jumelle « à
    // traiter », qui remonterait au chargement suivant sans que rien ne
    // l'explique. On revalide quand même — ce qui a été écrit doit s'afficher —
    // et on rend le message d'erreur.
    const reussies = resultats.filter((r) => r.ok).length;
    if (reussies > 0) {
      revalidatePath("/offres", "layout");
      revalidatePath("/", "page");
      console.error(
        `[statut] écriture partielle — ${reussies}/${uniques.length} annonces`,
      );
      return {
        ok: false,
        message:
          uniques.length > 1
            ? "Une des annonces de ce poste n’a pas pu être enregistrée."
            : "Enregistrement impossible.",
      };
    }

    // Les quatre motifs se distinguent à l'écran, parce qu'ils n'appellent pas
    // la même réaction : réessayer, prévenir Maxime, ou recharger la page.
    const message =
      echec.motif === "introuvable"
        ? "Cette offre n’existe plus."
        : echec.motif === "refusee"
          ? "La base a refusé ce changement."
          : echec.motif === "configuration"
            ? "Le site n’est pas correctement configuré."
            : "Enregistrement impossible : la base n’a pas répondu.";
    return { ok: false, message };
  }

  // ⚠️ **`revalidatePath` n'invalide PAS un cache de données — il n'y en a
  // pas.** Toutes nos requêtes partent en `cache: "no-store"`. Ce qu'il vide,
  // c'est le cache de navigation du routeur, côté navigateur : sans lui, le
  // bouton « retour » ramènerait la liste telle qu'elle était **avant** le
  // clic, avec l'offre encore « à traiter ». L'écran mentirait, et il faudrait
  // recharger à la main pour voir la vérité.
  //
  // `"layout"` et non `"page"` : il faut couvrir `/offres` **et**
  // `/offres/[identifiant]`, puisqu'on peut trier depuis les deux écrans.
  revalidatePath("/offres", "layout");

  // ⚠️ **L'écran du matin en a besoin AUSSI, depuis la phase 5 — et l'oublier
  // aurait été invisible en développement.** `/` n'affiche que les offres « à
  // traiter » de la dernière collecte : une offre passée en « candidaté » doit
  // quitter cette liste. Sans cette ligne, le bouton « retour » du navigateur
  // ramènerait l'écran d'avant le clic, avec l'offre encore présente — le même
  // défaut que celui mesuré le 29 août sur la note personnelle, où revenir par
  // un lien montrait la vérité et revenir par le bouton retour montrait un
  // champ vide.
  //
  // `"page"` suffit : `/` est une feuille, aucune route enfant n'affiche ces
  // offres. `"layout"` sur `/` invaliderait tout le site à chaque clic.
  revalidatePath("/", "page");

  return { ok: true };
}


/**
 * Poser ou retirer le coup de cœur sur UNE annonce.
 *
 * Entre : un identifiant et un booléen, tous deux venus du navigateur.
 * Sort : `{ ok: true }`, ou un message affichable.
 * Casse : ne lève jamais pour une panne de base — `exigerSession()` peut lever
 * pour rediriger, et c'est voulu.
 *
 * ⚠️ **UN identifiant, pas une liste — et c'est la différence de fond avec
 * `definirStatut`.** La première version propageait le cœur aux jumelles du
 * poste, par symétrie avec le clic de statut. **Le raisonnement ne se transpose
 * pas, et une revue l'a relevé le 30 août 2026 :**
 *
 * - Le statut propage parce qu'écarter l'annonce affichée laisserait sa jumelle
 *   « à traiter », et **le poste reviendrait** dans l'écran du matin le
 *   lendemain. Il y a un travail à ne pas refaire.
 * - Le coup de cœur n'a pas cette propriété. Propager ne protégeait de rien et
 *   **fabriquait du bruit** : l'onglet « Coup de cœur » ne regroupe pas, donc un
 *   poste republié quatre fois — le cas MBDA, mesuré sur cette base — y
 *   occupait quatre lignes après un seul clic, et la pilule annonçait « 4 »
 *   pour un seul poste. Exactement ce que cette liste doit éviter, sur l'écran
 *   qu'on rouvre pour décider où postuler.
 *
 * ⚠️ **Le commentaire qui justifiait la propagation était FAUX**, et c'est le
 * genre d'erreur qu'on ne voit qu'en la relisant à froid : il affirmait qu'une
 * jumelle non likée « apparaîtrait dans l'onglet Coup de cœur, une fois avec
 * cœur, une fois sans ». C'est impossible — le filtre est
 * `coup_de_coeur_a=not.is.null`, une annonce sans cœur n'y figure pas.
 *
 * **Conséquence assumée** : sur `/offres`, qui ne regroupe pas, deux annonces du
 * même poste peuvent porter des cœurs différents. Ce sont deux lignes distinctes
 * de la base, et Maxime a liké celle qu'il avait sous les yeux.
 */
export async function definirCoupDeCoeur(
  identifiant: string,
  actif: boolean,
): Promise<ResultatAction> {
  // ⚠️ Première ligne, sans exception. Hors de tout try/catch : `redirect()`
  // lève une exception que Next intercepte, l'attraper annulerait le renvoi.
  await exigerSession();

  // ⚠️ **`typeof` et non une conversion en booléen.** `Boolean(valeur)` aurait
  // accepté `"non"`, `{}` ou `[]` en les rendant tous `true` : un appel forgé
  // aurait liké une offre en envoyant n'importe quoi. On refuse ce qui n'est
  // pas un booléen, plutôt que de deviner ce que l'appelant voulait dire.
  if (typeof actif !== "boolean") {
    console.error("[coup de cœur] valeur refusée — ce n'est pas un booléen");
    return { ok: false, message: "Demande invalide." };
  }

  // ⚠️ **Le type est revérifié à l'exécution.** TypeScript disparaît à la
  // compilation et l'appelant réel est un `POST` : il peut envoyer un tableau,
  // un objet, `undefined`. Le format de l'identifiant, lui, est validé par
  // `changerCoupDeCoeur` avec la même expression régulière que la lecture.
  if (typeof identifiant !== "string") {
    console.error("[coup de cœur] identifiant refusé — ce n'est pas une chaîne");
    return { ok: false, message: "Demande invalide." };
  }

  // ⚠️ **Aucune borne à poser ici, contrairement à `definirStatut`** : une
  // requête ne peut plus toucher qu'une ligne. La borne existait parce que le
  // tableau venait du navigateur ; sans tableau, l'abus n'a plus de prise.
  const resultat = await changerCoupDeCoeur(identifiant, actif);

  if (!resultat.ok) {
    const message =
      resultat.motif === "introuvable"
        ? "Cette offre n’existe plus."
        : resultat.motif === "refusee"
          ? "La base a refusé ce changement."
          : resultat.motif === "configuration"
            ? "Le site n’est pas correctement configuré."
            : "Enregistrement impossible : la base n’a pas répondu.";
    return { ok: false, message };
  }

  // `"layout"` couvre `/offres` **et** `/offres/[identifiant]` : le cœur se
  // clique depuis les deux écrans, et le compteur de l'onglet change.
  revalidatePath("/offres", "layout");
  // ⚠️ **`/` en a besoin AUSSI, et l'oublier serait invisible en
  // développement.** Le cœur s'affiche sur l'écran du matin : sans cette ligne,
  // le bouton « retour » du navigateur ramènerait l'écran d'avant le clic, cœur
  // vide sur une offre likée. Même défaut que celui mesuré le 29 août sur la
  // note personnelle.
  //
  // `"page"` suffit : `/` est une feuille, aucune route enfant n'affiche ces
  // offres. `"layout"` y invaliderait tout le site à chaque clic.
  revalidatePath("/", "page");

  return { ok: true };
}


/**
 * Ce que rend l'enregistrement d'une note : comme `ResultatAction`, plus
 * l'heure réellement écrite en base.
 *
 * ⚠️ **L'heure vient du SERVEUR, pas du navigateur.** Le champ pourrait
 * afficher `new Date()` à la réception, et ce serait presque toujours juste —
 * mais « presque » ne convient pas ici : c'est cette heure qui prouve à Maxime
 * que la base a reçu quelque chose (US-13). Une horloge de navigateur en
 * avance de dix minutes afficherait une heure d'enregistrement qui n'a jamais
 * existé.
 *
 * `enregistreA` vaut `null` quand la note vient d'être effacée : il n'y a plus
 * rien à dater, et la colonne `note_modifiee_a` est remise à `NULL` avec elle.
 */
export type ResultatNote =
  | { ok: true; enregistreA: string | null }
  | { ok: false; message: string };

/**
 * Écrire la note personnelle d'une offre.
 *
 * Entre : un identifiant et un texte, tous deux venus du navigateur.
 * Sort : `{ ok: true }` avec l'heure d'écriture, ou un message affichable.
 * Casse : ne lève jamais pour une panne de base — `exigerSession()` peut lever
 * pour rediriger, et c'est voulu.
 *
 * ⚠️ **Le `maxLength` du champ ne protège de RIEN**, et c'est le seul point
 * vraiment contre-intuitif de cette fonction. Un attribut HTML se retire en
 * trois clics dans les outils du navigateur, et cette action s'invoque de toute
 * façon par un `POST` que rien n'oblige à partir de notre page. La borne est
 * vérifiée ici, côté serveur, et une troisième fois par la contrainte
 * `note_personnelle_bornee` en base. Le champ, lui, ne fait qu'éviter à Maxime
 * de taper 20 001 caractères pour rien.
 *
 * ⚠️ **Le paramètre est typé `string` et son type est revérifié à l'exécution.**
 * TypeScript disparaît à la compilation : l'appelant réel peut envoyer un
 * nombre, un objet ou `undefined`. Sans ce test, `texte.trim()` lèverait et
 * l'utilisateur récolterait une erreur de plateforme au lieu d'un message.
 *
 * ⚠️ **`revalidatePath` est indispensable, et l'argument inverse était FAUX.**
 * Première version : « rien d'autre à l'écran ne dépend de la note, revalider
 * ferait un re-rendu complet à chaque pause de frappe pour réafficher ce que le
 * champ montre déjà ». Le raisonnement tient sur l'affichage courant et rate
 * l'historique. **Mesuré le 29 août 2026** : écrire une note, partir vers
 * `/offres` par un lien, revenir par le **bouton retour** du navigateur — Next
 * restaure la fiche depuis son cache de navigation, `NotePersonnelle` remonte
 * avec la valeur d'AVANT l'écriture, et **le champ réapparaît vide**. La note
 * est bien en base, mais l'écran affirme le contraire : le pire des deux
 * mondes pour un critère de succès qui porte sur « ne pas croire à tort ».
 *
 * ⚠️ **Le chemin est le MOTIF de route, pas l'adresse concrète.** `/offres/[identifiant]`
 * couvre toutes les fiches, y compris celle ouverte avec un identifiant en
 * minuscules — que `lireOffre` accepte et normalise. Passer
 * `/offres/${identifiant}` laisserait cette variante en cache périmé.
 *
 * ⚠️ **`"page"` et non `"layout"`**, contrairement à `definirStatut` : le statut
 * change ce qu'affiche la LISTE (compteurs, filtre), la note non — elle ne sort
 * de la base que sur la fiche. Invalider le layout rechargerait `/offres` pour
 * rien à chaque pause de frappe.
 */
export async function definirNote(
  identifiant: string,
  texte: string,
): Promise<ResultatNote> {
  // ⚠️ Première ligne, sans exception. Hors de tout try/catch.
  await exigerSession();

  if (typeof texte !== "string") {
    console.error("[note] valeur refusée — le texte reçu n'est pas une chaîne");
    return { ok: false, message: "Cette note n’a pas pu être lue." };
  }

  if (texte.length > LONGUEUR_MAX_NOTE) {
    // ⚠️ **Le journal porte la longueur, jamais le texte.** La note est une
    // donnée personnelle : la recopier dans les journaux du serveur la ferait
    // sortir de la base par la porte de service.
    console.error(`[note] refusée — ${texte.length} caractères`);
    return {
      ok: false,
      message: `Note trop longue : ${LONGUEUR_MAX_NOTE.toLocaleString("fr-FR")} caractères au maximum.`,
    };
  }

  const resultat = await enregistrerNote(identifiant, texte);

  if (!resultat.ok) {
    const message =
      resultat.motif === "introuvable"
        ? "Cette offre n’existe plus."
        : resultat.motif === "refusee"
          ? "La base a refusé cette note."
          : resultat.motif === "configuration"
            ? "Le site n’est pas correctement configuré."
            : "Enregistrement impossible : la base n’a pas répondu.";
    return { ok: false, message };
  }

  // ⚠️ **La même heure que celle écrite en base ?** Non : `enregistrerNote`
  // pose `new Date()` au moment de l'écriture, et on en reconstruit une ici,
  // quelques millisecondes plus tard. L'écart est invisible à la minute
  // affichée, et le faire remonter depuis PostgREST coûterait un `return
  // =representation` — donc la ligne entière renvoyée, `charge_brute`
  // comprise. On préfère la milliseconde d'écart au méga-octet inutile.
  revalidatePath("/offres/[identifiant]", "page");

  //
  // ⚠️ **`normaliserNote` et pas un `trim()` recopié ici** : c'est elle qui
  // décide ce qu'est une note vide, et deux définitions du vide finiraient par
  // diverger — l'écran dirait « enregistré à 14:32 » sur une note que la base
  // a stockée en `NULL`.
  return {
    ok: true,
    enregistreA: normaliserNote(texte) === null ? null : new Date().toISOString(),
  };
}


/**
 * Demander l'enrichissement d'une offre.
 *
 * Entre : un identifiant d'offre, venu du navigateur.
 * Sort : `{ ok: true }` quand la demande est ouverte ET le workflow lancé.
 * Casse : ne lève jamais pour une panne — `exigerSession()` peut lever pour
 * rediriger, et c'est voulu.
 *
 * ⚠️ **L'ORDRE des gardes EST la logique, comme dans `choisirAffichage()`.**
 * Chacune protège quelque chose de différent, et les intervertir ouvrirait un
 * trou :
 *
 * 1. `exigerSession()` — sans elle, un `POST` avec en-tête `Next-Action`
 *    dépenserait l'argent de Maxime sans mot de passe.
 * 2. **Refermer une tentative périmée** — sinon l'étape 4 la trouverait en vol
 *    et refuserait à jamais d'enrichir cette offre.
 * 3. **L'enveloppe du jour** — vérifiée AVANT d'écrire quoi que ce soit. La
 *    contrôler après aurait laissé une ligne ouverte pour rien.
 * 4. **L'insertion** — c'est l'index unique qui tranche en dernier ressort, pas
 *    la lecture faite plus haut. Entre lire et écrire il y a toujours une
 *    fenêtre ; seul le moteur ferme celle-là (US-35).
 * 5. **Le lancement du workflow** — et s'il échoue, on referme immédiatement.
 *
 * ⚠️ **Le dépassement maximal de l'enveloppe est d'un enrichissement, pas de
 * zéro — et c'est structurel.** On vérifie ce qui est déjà consommé, mais le
 * coût de celui qu'on lance n'est connu qu'à la fin. Deux clics à la même
 * seconde peuvent donc passer ensemble. La borne par enrichissement vit
 * ailleurs, dans les options de l'agent : les deux ne sont pas redondantes,
 * elles bornent deux choses différentes.
 */
export async function demanderEnrichissement(
  identifiant: string,
): Promise<ResultatAction> {
  // ⚠️ Première ligne, sans exception. Hors de tout try/catch.
  await exigerSession();

  // ⚠️ **Le type est revérifié à l'exécution.** L'appelant réel est un `POST` :
  // il peut envoyer un nombre, un objet, `undefined`. Le format, lui, est
  // validé par `lireDernierEnrichissement` avec l'expression régulière commune.
  if (typeof identifiant !== "string") {
    console.error("[enrichissement] identifiant refusé — ce n'est pas une chaîne");
    return { ok: false, message: "Demande invalide." };
  }

  const maintenant = new Date();

  const etat = await lireDernierEnrichissement(identifiant);
  if (!etat.ok) {
    return { ok: false, message: "Impossible de lire l’état de cette offre." };
  }

  if (etat.dernier && estPerime(etat.dernier, maintenant)) {
    // ⚠️ **On referme AVANT d'insérer, et on continue même si ça échoue** : si
    // la clôture n'a pas pu s'écrire, l'insertion suivante se heurtera à
    // l'index et rendra « déjà en cours » — message faux mais sans dégât. Le
    // contraire, renoncer, laisserait l'offre bloquée définitivement.
    await refermerTentative(etat.dernier.id, MOTIF_PEREMPTION);
  } else if (etat.dernier && estEnVol(etat.dernier.issue)) {
    return {
      ok: false,
      message: "Un enrichissement est déjà en cours sur cette offre.",
    };
  }

  const enveloppe = await lireEnveloppeDuJour(maintenant);
  if (enveloppe.depassee) {
    // ⚠️ On refuse dans les DEUX cas — plafond atteint ou enveloppe illisible —
    // mais le message ne dit pas la même chose. Affirmer « le plafond est
    // atteint » sur une lecture ratée serait inventer une explication.
    if (!enveloppe.connue) {
      return {
        ok: false,
        message:
          "Impossible de vérifier l’enveloppe du jour : rien n’a été lancé. Réessayez.",
      };
    }
    // ⚠️ **Vérifié ici, côté serveur, et pas seulement affiché sur le bouton.**
    // Un bouton grisé se contourne en envoyant le `POST` à la main.
    console.error(
      `[enrichissement] refusé — enveloppe atteinte (${enveloppe.consommes}/${enveloppe.plafond})`,
    );
    return {
      ok: false,
      message: "Plafond du jour atteint : aucun enrichissement ne peut partir.",
    };
  }

  const demande = await ouvrirDemande(identifiant);
  if (!demande.ok) {
    return {
      ok: false,
      // ⚠️ Les quatre motifs se distinguent parce qu'ils n'appellent pas la
      // même réaction. `introuvable` était auparavant confondu avec `conflit` :
      // PostgREST rend 409 pour une clé étrangère absente comme pour un
      // doublon, si bien qu'une offre inexistante répondait « un
      // enrichissement est déjà en cours » — l'inverse de la vérité.
      message:
        demande.motif === "conflit"
          ? "Un enrichissement est déjà en cours sur cette offre."
          : demande.motif === "introuvable"
            ? "Cette offre n’existe plus."
            : demande.motif === "refusee"
              ? "La base a refusé cette demande."
              : "Demande impossible : la base n’a pas répondu.",
    };
  }

  const lancement = await lancerEnrichissement(demande.id);
  if (!lancement.ok) {
    // ⚠️ **On referme tout de suite.** Sans ça, l'offre resterait bloquée dix
    // minutes derrière une demande dont on SAIT déjà que rien ne viendra la
    // servir — et l'écran pulserait pendant tout ce temps.
    await refermerTentative(demande.id, lancement.explication, demande.demandeA);
    revalidatePath("/offres/[identifiant]", "page");
    return { ok: false, message: lancement.explication };
  }

  // `"page"` suffit : le bloc d'enrichissement ne vit que sur la fiche, et son
  // évolution est suivie par le sondage, pas par un re-rendu.
  revalidatePath("/offres/[identifiant]", "page");
  return { ok: true };
}


/** Ce que le sondage rend au bloc d'enrichissement. */
export type ResultatSuivi =
  | { ok: true; etat: EtatEnrichissement }
  | { ok: false; message: string };

/**
 * Où en est l'enrichissement de cette offre — appelée toutes les 1,5 s.
 *
 * Entre : un identifiant d'offre, venu du navigateur.
 * Sort : l'état d'affichage, étapes comprises.
 * Casse : ne lève jamais pour une panne de base.
 *
 * ⚠️ **Une ACTION serveur, pas une route `/api`, et c'est un choix de
 * sécurité.** Une route `GET` protégée par le proxy répondrait à un sondage
 * sans session par une **redirection vers `/connexion`** : le navigateur la
 * suivrait, recevrait du HTML, et `response.json()` échouerait sur une erreur de
 * syntaxe incompréhensible. Le proxy, lui, répond **401** aux `POST` d'action —
 * donc une session expirée pendant la nuit produit un refus lisible plutôt
 * qu'une page de connexion analysée comme du JSON.
 *
 * ⚠️ **Le navigateur ne parle jamais directement à Supabase**, y compris pour
 * un simple suivi. C'est la raison pour laquelle Realtime a été écarté au
 * cadrage : il aurait fallu ouvrir une politique de lecture publique sur la
 * table des étapes.
 *
 * ⚠️ **`maintenant` est calculé ICI, côté serveur.** Le composant client
 * pourrait le faire, mais la péremption dépendrait alors de l'horloge du poste
 * de Maxime : un Mac en avance de vingt minutes déclarerait morts des
 * enrichissements qui tournent.
 */
export async function suivreEnrichissement(
  identifiant: string,
): Promise<ResultatSuivi> {
  // ⚠️ Première ligne, sans exception. Hors de tout try/catch.
  await exigerSession();

  if (typeof identifiant !== "string") {
    console.error("[suivi] identifiant refusé — ce n'est pas une chaîne");
    return { ok: false, message: "Demande invalide." };
  }

  const lecture = await lireDernierEnrichissement(identifiant);
  if (!lecture.ok) {
    return { ok: false, message: "Impossible de lire l’état de cette offre." };
  }

  return {
    ok: true,
    etat: calculerEtatEnrichissement(lecture.dernier, lecture.etapes, new Date()),
  };
}
