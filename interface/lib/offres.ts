import "server-only";

import {
  type MotifEchec,
  type ResultatEcriture,
  ecrireDansBase,
  interrogerBase,
} from "@/lib/supabase";
import { normaliserNote } from "./notes";
import { FILTRE_PAR_DEFAUT, type FiltreListe } from "./filtres";
import { STATUTS, type Statut } from "./statuts";
import { TRI_PAR_DEFAUT, type Tri } from "./tri";

/**
 * La lecture des offres pour l'écran `/offres`.
 *
 * Entre : le filtre de statut demandé par l'adresse.
 * Sort : les offres classées par intérêt décroissant, le total du filtre, les
 * compteurs par statut, et l'identifiant de la dernière exécution réussie
 * (pour le marqueur « Nouveau »).
 * Casse : renvoie `{ ok: false }` avec le motif ; l'écran affiche alors son
 * état « base injoignable » au lieu d'une page blanche.
 */

/** Une offre telle qu'elle apparaît en liste. Rien de plus n'est lu. */
export type OffreEnListe = {
  identifiant: string;
  intitule: string;
  entreprise_nom: string | null;
  lieu_libelle: string | null;
  type_contrat_libelle: string | null;
  salaire_libelle: string | null;
  salaire_annuel_min: number | null;
  salaire_annuel_max: number | null;
  publiee_a: string;
  execution_id: number;
  note_interet: number | null;
  justification_interet: string | null;
  note_accessibilite: number | null;
  justification_accessibilite: string | null;
  notation_motif_echec: string | null;
  notation_tentatives: number;
  statut: Statut;
};

/**
 * ⚠️ **Les colonnes sont énumérées une par une, et ce n'est pas du zèle.**
 * Un `select=*` ferait remonter deux choses qui n'ont rien à faire ici :
 *
 * 1. `charge_brute`, l'archive complète de la réponse France Travail —
 *    plusieurs kilo-octets par offre, soit plus d'un méga-octet transféré à
 *    chaque affichage de la liste, pour rien.
 * 2. `contact_nom` et `contact_url_postulation`, les deux seules données
 *    personnelles du projet. Le PRD dit qu'elles ne sortent pas de la base :
 *    lues ici, elles partiraient dans le HTML envoyé au navigateur sans que
 *    rien ne le signale.
 *
 * Une colonne ajoutée à cette liste est une décision, jamais un effet de bord.
 *
 * ⚠️ **`resume` n'y est PAS, et c'est délibéré.** Le résumé court appartient à
 * la fiche (phase 3) ; en liste il ferait doublon avec les deux justifications
 * et allongerait la ligne d'un tiers pour la même information.
 *
 * ⚠️ **`notation_motif_echec` est lu comme un DRAPEAU, jamais affiché.** Il
 * porte un message d'erreur technique (`APIStatusError : …`) : utile sur la
 * fiche d'une offre, illisible répété sur deux cents lignes. Seule sa présence
 * sert ici, pour distinguer « pas encore notée » de « la notation a échoué ».
 *
 * ⚠️ **`notation_tentatives` est là pour empêcher l'écran de MENTIR.** Le
 * pipeline abandonne une offre au bout de trois tentatives
 * (`MAX_TENTATIVES` dans `pipeline/notation.py`) : sans ce compteur, la ligne
 * promettrait « elle sera reprise à la prochaine notation » indéfiniment, y
 * compris à une offre que plus rien ne reprendra jamais. On affiche le nombre
 * **brut**, et surtout **on ne recopie pas le seuil ici** — deux endroits qui
 * détiennent la même limite finissent toujours par diverger, et c'est celui du
 * pipeline qui a raison puisque c'est lui qui décide.
 *
 * ⚠️ **Ces deux colonnes ne quittent PAS le serveur aujourd'hui**, et c'est
 * vérifié (0 occurrence de `notation_motif_echec` dans le document reçu par le
 * navigateur, contre 194 pour un texte réellement affiché). La raison est que
 * toute la chaîne de `/offres` est en composants serveur : leurs props ne
 * traversent jamais la frontière, seul le rendu la traverse.
 * **Cela cessera d'être vrai en phase 4**, qui posera des boutons de statut,
 * donc des composants clients. Passer l'objet `offre` entier à l'un d'eux
 * enverrait **toutes** les colonnes lues ici dans le navigateur — le message
 * d'erreur technique, et surtout la note personnelle le jour où elle existera.
 * **Ne jamais passer `offre` à un composant client : lui passer les champs dont
 * il a besoin, un par un.**
 */
const COLONNES_LISTE = [
  "identifiant",
  "intitule",
  "entreprise_nom",
  "lieu_libelle",
  "type_contrat_libelle",
  "salaire_libelle",
  "salaire_annuel_min",
  "salaire_annuel_max",
  "publiee_a",
  "execution_id",
  "note_interet",
  "justification_interet",
  "note_accessibilite",
  "justification_accessibilite",
  "notation_motif_echec",
  "notation_tentatives",
  // ⚠️ **`statut` entre ici, `note_personnelle` JAMAIS.** La liste affiche le
  // statut — c'est ce que les boutons de tri montrent et modifient. La note
  // personnelle, elle, ne s'affiche que sur la fiche : la lire ici la ferait
  // voyager dans le document de 200 lignes pour n'être jamais rendue.
  // Critère d'acceptation du plan : « les notes personnelles ne sortent de la
  // base que là où elles s'affichent ».
  "statut",
].join(",");

/**
 * Le plafond d'affichage.
 *
 * La base grossit d'environ 25 offres par jour une fois le cron allumé : sans
 * borne, la page finirait par construire des milliers de nœuds dans le
 * navigateur.
 *
 * ⚠️ **Remesuré le 26 août 2026, et l'ancien chiffre ne vaut plus.** Cette note
 * disait « 258 Ko bruts, 11 Ko compressés — une liste répétitive se comprime 23
 * fois ». C'était vrai quand la ligne ne portait que des métadonnées, toutes
 * très semblables d'une offre à l'autre. Les justifications ont changé la
 * nature du contenu : deux phrases **différentes** par offre, environ 60 000
 * caractères uniques sur 200 lignes, qui ne se compriment plus pareil. Mesuré
 * sur 200 offres toutes notées : **1 552 Ko bruts, 153 Ko transférés** — un
 * facteur 10, plus 23, et quatorze fois le poids d'avant.
 *
 * Ça reste supportable (moins d'une seconde en 4G) et **le coût de rendu reste
 * la vraie raison de cette borne** : 5 699 nœuds dans le document et 70 ms pour
 * un recalcul complet de la mise en page. Mais la marge n'est plus la même, et
 * doubler le plafond ne serait plus gratuit.
 *
 * Le total réel reste affiché à côté, pour que la troncature se voie au lieu de
 * se deviner. Les filtres de la phase 4 rendront cette limite bien moins
 * gênante qu'elle n'en a l'air.
 */
export const PLAFOND_AFFICHAGE = 200;

/**
 * Le classement de la liste, et le piège qu'il désamorce.
 *
 * ⚠️ **`nullslast` n'est pas une précaution, c'est le correctif d'un bug
 * silencieux.** En PostgreSQL, `order by note_interet desc` place les `NULL`
 * **en PREMIER** — c'est la règle du moteur, pas un accident. Sans ce suffixe,
 * les 438 offres pas encore notées occuperaient les 200 lignes affichées et
 * **aucune offre notée n'apparaîtrait à l'écran**. Rien ne le signalerait : ni
 * erreur, ni ligne vide, juste une liste qui a l'air normale et qui ne classe
 * rien.
 *
 * ⚠️ **Second et troisième critères de tri.** `publiee_a` porte souvent la même
 * valeur pour des dizaines d'offres publiées le même jour, et deux offres
 * peuvent partager la même note d'intérêt : sans départage complet jusqu'à une
 * colonne unique, Postgres ne garantit aucun ordre et deux chargements de la
 * même page classent les ex æquo différemment.
 *
 * ⚠️ **L'accessibilité ne départage PAS les ex æquo, volontairement.** Le
 * produit repose sur le refus de fusionner les deux notes (`docs/DESIGN.md`) ;
 * s'en servir comme second critère fabriquerait un score composite discret,
 * qu'aucun libellé à l'écran n'expliquerait. Les ex æquo se départagent par la
 * date, qui ne prétend rien mesurer.
 */
/**
 * ⚠️ **Trois chaînes CONSTANTES, choisies par une clé déjà validée — et c'est
 * la règle n° 5 du projet appliquée à la lettre.** Le `?tri=` de l'adresse est
 * passé par `estTri()` puis sert d'index dans cette table : aucune de ses
 * lettres n'atteint jamais la requête. Concaténer la valeur reçue dans
 * `&order=` rouvrirait exactement l'injection que `options.egal` existe pour
 * fermer — un `order` est un endroit du chemin, pas une valeur encodable.
 *
 * ⚠️ **`nullslast` sur les DEUX tris par note, pour la même raison.** Les 434
 * offres pas encore notées prendraient sinon les 200 lignes affichées et
 * aucune offre notée n'apparaîtrait. Le tri par accessibilité est arrivé après
 * ; l'oublier là aurait reproduit un bug déjà corrigé une fois.
 *
 * ⚠️ **Trier par accessibilité NE FUSIONNE PAS les deux notes**, et c'est ce
 * qui rend ce tri acceptable au regard du `DESIGN.md`, qui refuse tout score
 * composite. On regarde une note *ou* l'autre, jamais leur moyenne : le lecteur
 * sait toujours laquelle il lit, puisque le menu le lui dit.
 *
 * ⚠️ **Le départage va jusqu'à une colonne UNIQUE dans les trois cas.**
 * `publiee_a` porte souvent la même valeur pour des dizaines d'offres publiées
 * le même jour : sans `identifiant` en dernier recours, Postgres ne garantit
 * aucun ordre et deux chargements de la même page classent les ex æquo
 * différemment.
 */
const CLASSEMENTS: Record<Tri, string> = {
  interet: "note_interet.desc.nullslast,publiee_a.desc,identifiant.asc",
  accessibilite:
    "note_accessibilite.desc.nullslast,publiee_a.desc,identifiant.asc",
  recentes: "publiee_a.desc,identifiant.asc",
};

export type ResultatListe =
  | {
      ok: true;
      offres: OffreEnListe[];
      /**
       * Le nombre d'offres en base, qui peut dépasser celles affichées.
       * `null` si PostgREST n'a pas renvoyé son en-tête de comptage : l'écran
       * dit alors ce qu'il montre, plutôt que d'annoncer un total inventé.
       */
      total: number | null;
      /** Pour le marqueur « Nouveau ». `null` si on n'a pas pu le savoir. */
      derniereExecution: number | null;
      /**
       * Combien d'offres dans chaque statut, **toute la base et pas seulement
       * les 200 affichées**.
       *
       * ⚠️ **Ces compteurs ne sont pas décoratifs : sans eux, les filtres non
       * choisis sont des portes aveugles.** Cliquer « Candidaté » pour découvrir
       * une liste vide est un aller-retour perdu, et sur un écran consulté dix
       * minutes le matin ça compte. Le chiffre répond à la US-10 (« savoir où
       * j'en suis ») avant même qu'on ait cliqué.
       *
       * `null` sur un statut dont le comptage a échoué : l'onglet se tait alors
       * au lieu d'afficher zéro, qui voudrait dire « il n'y en a aucune ».
       */
      comptes: Record<Statut, number | null>;
      /**
       * Combien d'offres la dernière collecte réussie a ramenées — le compte de
       * l'onglet « Nouveau ».
       *
       * ⚠️ **Il vit à côté de `comptes` et surtout PAS dedans**, et ce n'est pas
       * du rangement. `totalBase()` (dans `page.tsx`) reconstitue le total de la
       * base en additionnant les valeurs de `comptes` : l'addition n'est exacte
       * que parce que chaque offre y est comptée une fois et une seule. Une
       * offre nouvelle porte *aussi* un statut ; glissée dans le même objet,
       * elle serait comptée deux fois et le total afficherait plus d'offres que
       * la base n'en contient.
       *
       * `null` si le comptage a échoué **ou** si on ne sait pas quelle est la
       * dernière collecte : l'onglet se tait alors, au lieu d'annoncer zéro
       * nouveauté un matin où il y en a peut-être vingt.
       */
      nouvelles: number | null;
    }
  | { ok: false; motif: MotifEchec; explication: string };


/**
 * L'identifiant de la dernière exécution réussie.
 *
 * ⚠️ `issue=eq.reussite` et pas « la dernière ligne » : une exécution restée
 * `en_cours` est une collecte tuée en plein vol, et une `echec` n'a rien
 * ramené de fiable. Marquer « Nouveau » d'après elles mentirait à l'écran.
 *
 * ⚠️ **`etape=eq.collecte` est indispensable depuis la phase 2.** Les notations
 * écrivent leurs propres lignes dans `executions_veille` ; sans ce filtre, la
 * dernière notation réussie deviendrait « la dernière exécution » et **aucune
 * offre ne porterait plus le marqueur « Nouveau »**, puisqu'une notation ne
 * collecte rien. Même piège que celui qui a imposé la colonne `etape` côté
 * pipeline, à l'autre bout de la chaîne.
 *
 * ⚠️ **Le tri est sur `demarree_a`, pas sur `terminee_a`**, et ce n'est pas
 * indifférent. La migration initiale crée exprès pour cette requête l'index
 * partiel `executions_veille_derniere_reussite (demarree_a desc) where issue =
 * \'reussite\'` : trier sur une autre colonne le rend inutilisable et force un
 * parcours complet à chaque affichage. Et `terminee_a` est *nullable* — une
 * ligne à moitié écrite se classerait en dernier et changerait silencieusement
 * quelle exécution est « la dernière ».
 *
 * ⚠️ **Elle distingue « la lecture a échoué » de « aucune collecte n'a jamais
 * réussi », et ce n'est PAS du détail — c'est un défaut vu à l'écran le 29 août
 * 2026.** Elle rendait `null` dans les deux cas. Conséquence : avec la base
 * entièrement injoignable, l'onglet « Nouveau » affichait « la liste des offres
 * répond, mais pas le journal des collectes » — une phrase qui affirme que la
 * liste répond alors qu'on ne l'avait même pas interrogée. Le lecteur serait
 * parti chercher une panne dans `executions_veille` un jour où c'est tout
 * Supabase qui est tombé.
 *
 * Un échec reste non bloquant pour les AUTRES filtres : on y perd le marqueur
 * « Nouveau », pas la liste. C'est l'appelant qui décide, et il ne peut décider
 * que si les deux cas lui arrivent distincts.
 */
type LectureExecution =
  | { ok: true; identifiant: number | null }
  | { ok: false; motif: MotifEchec; explication: string };

async function lireDerniereExecution(): Promise<LectureExecution> {
  const resultat = await interrogerBase<{ id: number }>(
    "executions_veille?select=id&issue=eq.reussite&etape=eq.collecte" +
      "&order=demarree_a.desc&limit=1",
  );

  if (!resultat.ok) {
    return { ok: false, motif: resultat.motif, explication: resultat.explication };
  }

  return { ok: true, identifiant: resultat.lignes[0]?.id ?? null };
}

/*
 * ⚠️ **`compterNotees()` a été SUPPRIMÉE le 29 août 2026** — l'écran
 * n'affiche plus « M notées », sur décision de Maxime (le motif est écrit dans
 * `app/(site)/offres/page.tsx`, au-dessus de `CompteAffiche`).
 *
 * La fonction est retirée avec son affichage, et pas seulement débranchée :
 * c'était une **requête réseau supplémentaire vers Supabase à chaque
 * chargement** de la liste. Laissée en place « au cas où », elle aurait
 * continué de coûter un aller-retour pour un résultat que personne ne lit —
 * le genre de dépense qui ne se voit dans aucun écran et que rien ne signale.
 *
 * Elle portait un correctif qu'il faudrait re-trouver si on la ressuscitait :
 * le comptage doit appliquer **le même filtre de statut** que la liste, sans
 * quoi `/offres?statut=candidate` affichait « 2 offres · 140 notées ».
 */

/**
 * Combien d'offres portent ce statut, dans toute la base.
 *
 * ⚠️ **Le statut passe par `options.egal`, jamais par le chemin.** Il vient de
 * la barre d'adresse : `estStatut()` l'a déjà validé chez l'appelant, mais la
 * règle du projet ne fait pas d'exception pour une valeur « déjà vérifiée » —
 * c'est précisément ce genre d'exception qui rouvre les injections. Ici la
 * valeur vient en fait de `STATUTS`, une constante du code, et on l'encode
 * quand même : la discipline vaut plus que le cas particulier.
 *
 * ⚠️ **Aucun index sur `statut`, et c'est délibéré au 29 août 2026.** Ces trois
 * comptages sont des parcours complets, mais sur **567 lignes** Postgres les
 * fait en microsecondes. À y penser vers 50 000 lignes — soit, au rythme de
 * 208 offres par mois, dans une vingtaine d'années. Poser l'index maintenant
 * coûterait une migration pour un gain non mesurable.
 */
async function compterParStatut(statut: Statut): Promise<number | null> {
  const resultat = await interrogerBase<{ identifiant: string }>(
    "offres?select=identifiant&limit=1",
    { compter: true, egal: { statut } },
  );

  return resultat.ok ? resultat.total : null;
}

/**
 * Combien d'offres la dernière collecte réussie a ramenées.
 *
 * Entre : l'identifiant de cette exécution, lu juste avant en base.
 * Sort : le compte, ou `null` si PostgREST n'a pas renvoyé son en-tête.
 *
 * ⚠️ **C'est le MÊME critère que la bulle « Nouveau » de chaque ligne**
 * (`offre.execution_id === derniereExecution`), et ça ne doit pas cesser : un
 * onglet qui annoncerait 12 nouveautés en face d'une liste où 8 lignes portent
 * la bulle ferait douter des deux. Les deux se lisent ensemble.
 *
 * ⚠️ **Le prix de ce compteur, dit exactement** — la première rédaction le
 * minimisait, et une revue l'a relevé. Il ne peut pas partir avec les autres :
 * il lui faut l'identifiant que la requête précédente ramène. Ce n'est donc pas
 * « un aller-retour de plus » dans un lot parallèle, c'est **le doublement de la
 * profondeur** du chemin critique — la page attendait un aller-retour, elle en
 * attend deux, à chaque chargement et y compris sur les quatre onglets qui ne
 * lisent jamais ce chiffre. Mesuré en développement depuis un Mac vers Supabase
 * Paris : ~60 ms. Sur Vercel en région Paris, la base est à quelques
 * millisecondes ; **non mesuré en production**.
 *
 * ⚠️ **Une seule requête serait possible et elle est REFUSÉE** :
 * `executions_veille.offres_nouvelles` porte déjà un compte, et `lireEtatVeille`
 * le lit pour la manchette. Mais c'est le compte que la **collecte** a écrit,
 * pas celui des lignes qui portent aujourd'hui cet `execution_id` — et
 * `recoller_offres_orphelines` peut rattacher des offres après coup. L'onglet
 * annoncerait alors un nombre que la liste d'en dessous ne montre pas. Le
 * compteur et la bulle « Nouveau » de chaque ligne doivent répondre au **même
 * critère**, sinon on doute des deux.
 */
async function compterNouvelles(idExecution: number): Promise<number | null> {
  const resultat = await interrogerBase<{ identifiant: string }>(
    "offres?select=identifiant&limit=1",
    // ⚠️ Converti en chaîne parce que `egal` n'accepte que des chaînes — elle
    // les encode avant de les concaténer. Un nombre passerait par `String()`
    // implicitement, l'écrire rend la conversion visible.
    { compter: true, egal: { execution_id: String(idExecution) } },
  );

  return resultat.ok ? resultat.total : null;
}

/**
 * La requête de liste elle-même, chemin et classement compris.
 *
 * ⚠️ **Le classement est choisi ICI par une clé, jamais reçu comme chaîne.**
 * `CLASSEMENTS[tri]` ne peut rendre que l'une des trois valeurs écrites dans ce
 * fichier ; c'est ce qui empêche `?tri=` de l'adresse d'atteindre le `&order=`.
 */
function lireListe(tri: Tri, filtre?: Record<string, string>) {
  return interrogerBase<OffreEnListe>(
    `offres?select=${COLONNES_LISTE}` +
      `&order=${CLASSEMENTS[tri]}&limit=${PLAFOND_AFFICHAGE}`,
    { compter: true, ...(filtre ? { egal: filtre } : {}) },
  );
}

/**
 * La liste des offres, filtrée et classée.
 *
 * Entre : un filtre et un classement déjà validés par l'appelant — la page les
 * lit dans l'adresse et les passe par `estStatut()` / `estTri()` avant
 * d'arriver ici.
 * Sort : jusqu'à 200 offres, les compteurs de chaque statut, celui des
 * nouveautés, et de quoi marquer « Nouveau ».
 * Casse : ne lève jamais. Un échec de comptage laisse `null` et l'écran se tait
 * sur ce point plutôt que d'afficher un chiffre faux.
 *
 * ⚠️ **Le total renvoyé est celui du FILTRE, pas de la base.** C'est ce qu'il
 * faut : « 42 offres · 42 affichées » décrit la liste qu'on regarde. Le total
 * général se reconstitue en additionnant les trois compteurs, et l'onglet
 * « Toutes » l'affiche directement.
 *
 * ⚠️ **Le classement change ce que l'écran MONTRE, pas seulement son ordre — et
 * c'est le point le moins évident de cette fonction.** La liste est plafonnée à
 * 200 lignes : trier par date fait remonter les offres récentes, y compris **non
 * notées**, et fait donc sortir de l'écran des offres mieux notées mais plus
 * anciennes. Ce n'est pas un défaut du tri, c'est le plafond qui devient
 * visible ; la ligne de compte le signale en affichant « 200 affichées » sur un
 * total plus grand.
 */
export async function listerOffres(
  filtre: FiltreListe = FILTRE_PAR_DEFAUT,
  tri: Tri = TRI_PAR_DEFAUT,
): Promise<ResultatListe> {
  // ⚠️ **Cette promesse n'est PAS attendue tout de suite, et c'est ce qui garde
  // le cas courant rapide.** Trois choses en dépendent — le marqueur des lignes,
  // le compteur de l'onglet « Nouveau », et la requête elle-même quand cet
  // onglet est ouvert. Un `await` posé ici ferait attendre à TOUS les
  // chargements une lecture dont la plupart n'ont pas besoin pour démarrer.
  const promesseDerniere = lireDerniereExecution();

  const promesseNouvelles = promesseDerniere.then((lecture) =>
    lecture.ok && lecture.identifiant !== null
      ? compterNouvelles(lecture.identifiant)
      : null,
  );

  // ⚠️ **`null` ici veut dire « je ne sais pas », pas « aucune offre ».** Si on
  // n'a pas pu lire quelle est la dernière collecte, on ne peut pas dire quelles
  // offres en viennent : filtrer sur une valeur inventée rendrait une liste vide
  // qui se lirait comme « la nuit n'a rien ramené ». L'écran distingue les deux.
  const requeteOffres =
    filtre === "nouvelles"
      ? promesseDerniere.then((lecture) =>
          lecture.ok && lecture.identifiant !== null
            ? lireListe(tri, { execution_id: String(lecture.identifiant) })
            : null,
        )
      : // ⚠️ **Le filtre n'est ajouté que s'il en est un.** « Toutes » n'est pas
        // un statut : lui chercher un `statut=eq.toutes` rendrait zéro ligne, et
        // la page afficherait « aucune offre » sur une base pleine.
        lireListe(tri, filtre === "toutes" ? undefined : { statut: filtre });

  // Tout ce qui peut partir ensemble part ensemble : enchaînées, ces requêtes
  // multiplieraient l'attente avant le premier pixel.
  const [offres, lectureExecution, nouvelles, ...parStatut] = await Promise.all(
    [requeteOffres, promesseDerniere, promesseNouvelles, ...STATUTS.map(compterParStatut)],
  );

  // Le marqueur des lignes : `null` si on n'a pas pu savoir, ce qui ne marque
  // aucune offre plutôt que d'en marquer au hasard.
  const derniereExecution = lectureExecution.ok ? lectureExecution.identifiant : null;

  // ⚠️ `STATUTS.map` ci-dessus et cette reconstruction se lisent ensemble :
  // l'ordre du tableau vient de la même constante, donc les deux ne peuvent
  // pas se désaligner — ce qu'un objet écrit à la main finirait par faire.
  const comptes = Object.fromEntries(
    STATUTS.map((statut, rang) => [statut, parStatut[rang]]),
  ) as Record<Statut, number | null>;

  if (offres === null) {
    // ⚠️ **Deux causes, deux écrans — et les confondre était le défaut.**
    // Le journal des collectes injoignable est une panne : on le dit comme
    // telle, avec son motif. Un journal qui répond « aucune collecte réussie »
    // est un état légitime du produit : la page l'explique sans crier à la
    // panne.
    if (!lectureExecution.ok) {
      return {
        ok: false,
        motif: lectureExecution.motif,
        explication: lectureExecution.explication,
      };
    }

    return { ok: true, offres: [], total: null, comptes, nouvelles, derniereExecution: null };
  }

  if (!offres.ok) {
    return offres;
  }

  return {
    ok: true,
    offres: offres.lignes,
    comptes,
    nouvelles,
    // ⚠️ Pas de repli sur `lignes.length` ici : une liste tronquée à 200 dont
    // l'en-tête de comptage manque annoncerait « 200 offres collectées »
    // comme si c'était toute la base. `null` remonte l'ignorance jusqu'à
    // l'écran, qui sait alors ne parler que de ce qu'il affiche.
    total: offres.total,
    derniereExecution,
  };
}

/* ------------------------------------------------------------------ *
 *  La fiche d'une offre — `/offres/[identifiant]`
 * ------------------------------------------------------------------ */

/**
 * Une offre telle qu'elle apparaît sur sa fiche.
 *
 * ⚠️ **C'est une seconde liste blanche, distincte de `COLONNES_LISTE`, et le
 * doublon est délibéré.** Une liste unique « pour ne pas se répéter » ferait
 * remonter dans les 200 lignes de la liste tout ce que la fiche a le droit de
 * lire — `description` (2 548 caractères en médiane, 5 000 au maximum) et
 * `contact_nom`, la seule donnée nominative du projet. Deux écrans, deux
 * besoins, deux listes.
 */
export type OffreEnFiche = {
  identifiant: string;
  intitule: string;
  entreprise_nom: string | null;
  lieu_libelle: string | null;
  type_contrat_libelle: string | null;
  /**
   * ⚠️ **Ce n'est PAS `type_contrat_libelle`, et c'est le champ le plus utile
   * de la fiche.** Le premier dit « CDI », celui-ci dit « Contrat
   * apprentissage ». Mesuré le 28 août 2026 : **7 des 20 meilleures offres sont
   * des alternances**, dont le cas emblématique du projet — « Alternant
   * Ingénieur IA Agentique », 85 d'intérêt et 15 d'accessibilité. Sans ce
   * champ, un écart pareil ne s'explique qu'en lisant la justification.
   * Renseigné sur 560 offres sur 560.
   */
  nature_contrat: string | null;
  salaire_libelle: string | null;
  salaire_annuel_min: number | null;
  salaire_annuel_max: number | null;
  publiee_a: string;
  /**
   * Le texte intégral de l'annonce. Conservé en base précisément parce que
   * France Travail **dépublie** : la description reste lisible ici longtemps
   * après que le lien d'origine soit mort (US-33).
   * Médiane 2 548 caractères, maximum **5 000** — le plafond de l'API, atteint
   * par 5 offres. ⚠️ Ce plafond ne se code nulle part : c'est une limite de
   * l'API d'aujourd'hui, pas un contrat.
   */
  description: string;
  /** Écrit par la notation. `null` sur les 434 offres pas encore notées. */
  resume: string | null;
  note_interet: number | null;
  justification_interet: string | null;
  note_accessibilite: number | null;
  justification_accessibilite: string | null;
  notation_motif_echec: string | null;
  notation_tentatives: number;
  /**
   * Comment le référentiel ROME classe cette offre. Renseignés tous les deux
   * sur 560/560.
   *
   * ⚠️ **Ils disent *pourquoi cette offre est là*.** C'est l'appellation que le
   * moteur de recherche France Travail indexe — c'est par elle que le faux
   * positif `IPR-IA` entrait dans la collecte, et non par l'intitulé. Les
   * afficher prolonge sur la fiche ce que la liste fait déjà : rendre visible
   * ce que les critères de collecte ramènent vraiment.
   */
  appellation_libelle: string | null;
  rome_libelle: string | null;
  /** « Cadre », « Technicien »… Absent sur deux tiers de la base, présent sur 45 % des mieux notées. */
  qualification_libelle: string | null;
  /**
   * ⚠️ **Ce champ ment par son absence, et l'écran doit en tenir compte.**
   * Mesuré le 28 août 2026 : **127 offres sur 560 exigent l'anglais dans leur
   * texte, et ce champ n'en capte que 10**. Il rate « Anglais niveau C1 CECRL »,
   * « Bilingue anglais », « Anglais professionnel indispensable » — 92 %
   * d'angle mort. **Ne jamais afficher de cartouche d'absence pour les
   * langues** : « Langues : non précisé » se lirait « pas d'anglais exigé »
   * alors que ça veut dire « la case n'a pas été remplie ». Même piège que
   * `experience_libelle`, et même `NULL` ≠ `false` qu'en base.
   */
  langues: { libelle?: string | null; exigence?: string | null }[] | null;
  /** Renseignée sur 560/560 — mais l'annonce, elle, peut avoir été dépubliée. */
  url_origine: string | null;
  /**
   * Les deux champs de contact. ⚠️ **Ils s'affichent ici et NULLE PART
   * AILLEURS** — décision de Maxime du 28 août 2026, qui amende le garde-fou
   * n° 2 de `docs/PRD.md` : ces champs n'existent que pour candidater, les
   * conserver sans jamais les montrer revenait à porter le risque sans l'usage.
   * Le site est derrière un mot de passe et n'a qu'un utilisateur.
   *
   * ⚠️ **Ce qui n'est PAS amendé** : jamais dans un journal — ceux de GitHub
   * Actions sont **publics**, le dépôt l'étant — ni dans un export, ni dans la
   * liste `/offres`, dont `COLONNES_LISTE` ne les lit pas. Un champ ne se lit
   * que là où il s'affiche.
   *
   * `contact_nom` : 39 offres sur 560, dont **21 nomment une personne réelle**
   * (« TIM FRANCE - Mme Isabelle BARBERET ») ; les 18 autres sont des agences.
   * `contact_url_postulation` : 37 offres.
   */
  contact_nom: string | null;
  contact_url_postulation: string | null;
  statut: Statut;
  /**
   * La note libre de Maxime. `null` tant qu'il n'a rien écrit.
   *
   * ⚠️ **DONNÉE PERSONNELLE au sens du projet, et la seule qu'il produise
   * lui-même.** Elle ne se lit QUE ici, sur la fiche qui l'affiche — jamais
   * dans `COLONNES_LISTE`, jamais dans un journal (ceux de GitHub Actions
   * sont publics, le dépôt l'étant), jamais dans un export. Même règle que
   * `contact_nom`, énoncée dans `docs/PRD.md` § Données personnelles.
   *
   * ⚠️ **Vide et `null` sont la même chose, garanti par la contrainte
   * `note_personnelle_non_vide`.** Le code n'a donc jamais à tester les deux :
   * s'il reçoit une chaîne, elle contient au moins un caractère non blanc.
   */
  note_personnelle: string | null;
  /**
   * Le dernier enregistrement réussi de la note.
   *
   * ⚠️ **Sans cette date, l'indicateur d'état ne vaut rien** (US-13). Après un
   * rechargement, « Enregistré » tout court ne se distingue pas d'un
   * « Enregistré » affiché par erreur : c'est l'heure qui prouve que la base a
   * bien reçu quelque chose, et quand.
   *
   * `null` va toujours de pair avec une note `null` — la contrainte
   * `note_ecrite_est_datee` l'impose dans ce sens-là.
   */
  note_modifiee_a: string | null;
};

const COLONNES_FICHE = [
  "identifiant",
  "intitule",
  "entreprise_nom",
  "lieu_libelle",
  "type_contrat_libelle",
  "nature_contrat",
  // ⚠️ **`alternance` a été retiré de cette liste**, et c'est l'application de
  // la règle énoncée juste au-dessus pour les champs de contact : un champ ne
  // se lit que là où il s'affiche. L'information « c'est une alternance » est
  // portée par `nature_contrat` (« Contrat apprentissage »), qui est affiché ;
  // le booléen faisait doublon et voyageait pour rien.
  "salaire_libelle",
  "salaire_annuel_min",
  "salaire_annuel_max",
  "publiee_a",
  "description",
  "resume",
  "note_interet",
  "justification_interet",
  "note_accessibilite",
  "justification_accessibilite",
  "notation_motif_echec",
  "notation_tentatives",
  "appellation_libelle",
  "rome_libelle",
  "qualification_libelle",
  "langues",
  "url_origine",
  "contact_nom",
  "contact_url_postulation",
  "statut",
  // ⚠️ **Ces deux colonnes entrent ICI et NULLE PART AILLEURS.** Critère
  // d'acceptation du plan : « les notes personnelles ne sortent de la base que
  // là où elles s'affichent ». Les ajouter à `COLONNES_LISTE` les ferait
  // voyager dans un document de 200 lignes pour n'être rendues nulle part.
  "note_personnelle",
  "note_modifiee_a",
].join(",");

/**
 * Le format d'un identifiant France Travail.
 *
 * **Sept caractères alphanumériques**, vérifié deux fois : documenté dans
 * `docs/API_FRANCE_TRAVAIL.md` sur 50 offres le 20 août 2026, puis recompté sur
 * **les 560 offres en base le 28 août** — 560 sur 560 conformes, aucune
 * minuscule, deux formes réelles (`6122825` et `212YDPC`).
 *
 * ⚠️ **L'alphabet observé exclut les voyelles, et on ne code PAS cette
 * exclusion.** Elle n'est garantie nulle part par France Travail ; la coder
 * ferait disparaître de l'écran, sans le moindre message, la première offre
 * dont l'identifiant contiendrait un `A`.
 *
 * ⚠️ **Les minuscules sont acceptées puis normalisées**, pas rejetées : une
 * adresse recopiée à la main ou passée par un outil qui met en minuscules doit
 * ouvrir la fiche, pas une page « introuvable ». Le site est privé — deux
 * adresses pour une même offre n'ont ici aucune conséquence.
 */
const FORMAT_IDENTIFIANT = /^[0-9A-Za-z]{7}$/;

export type ResultatFiche =
  | { ok: true; offre: OffreEnFiche }
  | {
      ok: false;
      /**
       * `introuvable` couvre **deux cas volontairement confondus** : le format
       * est invalide, ou l'offre n'existe pas. L'écran dit la même chose dans
       * les deux cas — il n'y a rien à cette adresse. Les distinguer
       * apprendrait à un visiteur quels identifiants sont bien formés, sans
       * rien apporter à Maxime.
       */
      motif: "introuvable" | MotifEchec;
      explication: string;
    };

/**
 * Lit une offre par son identifiant.
 *
 * Entre : l'identifiant tel qu'il arrive de la barre d'adresse — donc une
 * chaîne dont on ne présume **rien**.
 * Sort : l'offre, ou un échec qualifié : `introuvable` (format refusé ou offre
 * absente), `injoignable` (la base n'a pas répondu), `configuration`.
 * Casse : ne lève jamais. Une base morte donne l'écran « base injoignable », un
 * identifiant fantaisiste donne « offre introuvable » — jamais une erreur 500.
 *
 * ⚠️ **La validation a lieu AVANT tout appel à la base, et ce n'est pas une
 * optimisation.** Une adresse comme `/offres/X&select=*` est refusée ici, avant
 * qu'aucune requête ne parte. Le second verrou — l'encodage de la valeur — est
 * dans `interrogerBase` (`options.egal`), et il a été **vérifié en rejouant
 * l'injection contre la vraie base le 28 août 2026** : 0 ligne rendue.
 *
 * Les deux verrous sont indépendants, et il en faut deux. Détail du mécanisme
 * PostgREST — qui n'est pas celui qu'on suppose — dans `lib/supabase.ts` :
 * l'ordre des paramètres protège **par accident** aujourd'hui, et cet accident
 * ne se reproduira pas tout seul.
 */
export async function lireOffre(identifiant: string): Promise<ResultatFiche> {
  // ⚠️ **`typeof` AVANT l'expression régulière, et ce n'est pas du zèle.**
  // `FORMAT_IDENTIFIANT.test(1234567)` convertit son argument en chaîne et
  // renvoie `true` : un nombre passerait le contrôle, puis `.toUpperCase()`
  // lèverait un `TypeError`. Ces fonctions promettent de ne jamais lever ; un
  // `POST` d'action serveur forgé avec un identifiant numérique les ferait
  // mentir, et l'écran afficherait « session expirée ou réseau coupé », qui est
  // faux. Relevé en revue le 29 août 2026 — même contrôle que celui déjà fait
  // sur le texte de la note dans `definirNote`.
  if (typeof identifiant !== "string" || !FORMAT_IDENTIFIANT.test(identifiant)) {
    return {
      ok: false,
      motif: "introuvable",
      explication: "Cet identifiant ne ressemble à aucune offre.",
    };
  }

  const resultat = await interrogerBase<OffreEnFiche>(
    `offres?select=${COLONNES_FICHE}&limit=1`,
    { egal: { identifiant: identifiant.toUpperCase() } },
  );

  if (!resultat.ok) return resultat;

  const offre = resultat.lignes[0];
  if (!offre) {
    return {
      ok: false,
      motif: "introuvable",
      explication: "Aucune offre ne porte cet identifiant.",
    };
  }

  return { ok: true, offre };
}

/**
 * Changer le statut d'une offre.
 *
 * Entre : un identifiant venu de l'extérieur, et un statut déjà validé par
 * `estStatut()` chez l'appelant.
 * Sort : `{ ok: true }`, ou un motif que l'action serveur traduira à l'écran.
 * Casse : ne lève jamais — mêmes garanties que `lireOffre`.
 *
 * ⚠️ **L'identifiant est validé ICI, exactement comme en lecture.** Il vient
 * d'un composant client, c'est-à-dire du navigateur, c'est-à-dire de
 * n'importe où : une action serveur s'invoque par un `POST` que rien n'oblige à
 * partir de notre page. `FORMAT_IDENTIFIANT` est la même expression que celle
 * de `lireOffre` — réutilisée, jamais recopiée, sinon les deux dérivent.
 *
 * ⚠️ **`statut_modifie_a` est écrit dans la MÊME requête que `statut`.** La
 * contrainte `statut_touche_est_date` l'exige, et c'est le moteur qui la tient :
 * une écriture qui poserait `candidate` sans date serait refusée en 400, pas
 * acceptée silencieusement. On ne se repose donc pas sur la discipline de ce
 * fichier — c'est le principe déjà appliqué aux notes et à leurs justifications.
 *
 * ⚠️ **Repasser en `a_traiter` EFFACE la date, et c'est délibéré.** La colonne
 * dit « quand Maxime a trié cette offre » ; une offre remise à traiter n'est
 * plus triée, garder sa date d'hier la ferait mentir. La contrainte l'autorise
 * dans les deux sens — c'est ici que le choix se fait, et il se voit.
 *
 * ⚠️ **L'opération est IDEMPOTENTE, et c'est la vraie réponse au double clic.**
 * Deux clics rapides envoient deux fois `statut = 'candidate'` : la seconde
 * écriture pose la même valeur que la première, l'état final est identique.
 * Désactiver le bouton pendant l'envoi est un confort visuel, pas une
 * protection — un bouton se contourne, la nature de l'opération non. Le seul
 * effet observable d'un double envoi est un horodatage décalé de quelques
 * millisecondes.
 */
export async function changerStatut(
  identifiant: string,
  statut: Statut,
): Promise<ResultatEcriture> {
  // ⚠️ `typeof` avant l'expression régulière — voir `lireOffre`.
  if (typeof identifiant !== "string" || !FORMAT_IDENTIFIANT.test(identifiant)) {
    return {
      ok: false,
      motif: "introuvable",
      explication: "Cet identifiant ne ressemble à aucune offre.",
    };
  }

  return ecrireDansBase("offres", {
    valeurs: {
      statut,
      statut_modifie_a:
        statut === "a_traiter" ? null : new Date().toISOString(),
    },
    egal: { identifiant: identifiant.toUpperCase() },
  });
}


/**
 * Enregistrer la note personnelle d'une offre.
 *
 * Entre : un identifiant venu de l'extérieur, et le contenu brut du champ —
 * dont la longueur a déjà été refusée par l'action serveur si elle dépassait
 * `LONGUEUR_MAX_NOTE`.
 * Sort : `{ ok: true }`, ou un motif que l'action traduira à l'écran.
 * Casse : ne lève jamais — mêmes garanties que `changerStatut`.
 *
 * ⚠️ **Le vide est normalisé AVANT d'écrire, et c'est la raison d'être de
 * `normaliserNote`.** Un champ à enregistrement automatique envoie « » ou
 * « \n » dès qu'on efface sa note : la contrainte `note_personnelle_non_vide`
 * répondrait 400, et l'indicateur afficherait « échec » sur le geste le plus
 * banal qui soit. Le vide n'a qu'une représentation en base, `NULL`.
 *
 * ⚠️ **Effacer la note efface AUSSI sa date**, exactement comme repasser une
 * offre en « à traiter » efface `statut_modifie_a`. La colonne dit « quand
 * cette note a été enregistrée » : sans note, garder une heure d'hier
 * afficherait « Enregistré le 29 août à 14:32 » sous un champ vide. La
 * contrainte `note_ecrite_est_datee` n'interdit pas ce cas — c'est ici que le
 * choix se fait, et il se voit.
 *
 * ⚠️ **L'écriture est IDEMPOTENTE, et c'est ce qui rend la reprise réseau
 * sûre** : on pose le texte complet, jamais un ajout au texte existant. Deux
 * envois de la même frappe laissent la base dans le même état. Le jour où
 * quelqu'un voudrait « ajouter à la note » par ce chemin, cette propriété
 * tomberait et une reprise dupliquerait le texte sans que rien n'avertisse.
 *
 * ⚠️ **Aucune journalisation du texte, nulle part.** `ecrireDansBase` ne
 * journalise que le nom de la table, précisément pour ce cas : la note est la
 * seule donnée personnelle que Maxime produit, et les journaux d'un hébergeur
 * ne sont pas un endroit où elle a le droit d'être.
 */
export async function enregistrerNote(
  identifiant: string,
  texte: string,
): Promise<ResultatEcriture> {
  // ⚠️ `typeof` avant l'expression régulière — voir `lireOffre`.
  if (typeof identifiant !== "string" || !FORMAT_IDENTIFIANT.test(identifiant)) {
    return {
      ok: false,
      motif: "introuvable",
      explication: "Cet identifiant ne ressemble à aucune offre.",
    };
  }

  const note = normaliserNote(texte);

  return ecrireDansBase("offres", {
    valeurs: {
      note_personnelle: note,
      // Écrite dans la MÊME requête que le texte : la contrainte
      // `note_ecrite_est_datee` refuse en 400 une note sans date. C'est le
      // moteur qui tient la règle, pas la discipline de ce fichier.
      note_modifiee_a: note === null ? null : new Date().toISOString(),
    },
    egal: { identifiant: identifiant.toUpperCase() },
  });
}
