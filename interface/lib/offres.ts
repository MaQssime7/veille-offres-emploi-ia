import "server-only";

import { type MotifEchec, interrogerBase } from "@/lib/supabase";

/**
 * La lecture des offres pour l'écran `/offres`.
 *
 * Entre : rien, pour l'instant — la phase 4 ajoutera le filtre de statut.
 * Sort : les offres classées par intérêt décroissant, le total collecté, le
 * nombre d'offres notées, et l'identifiant de la dernière exécution réussie
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
const CLASSEMENT = "note_interet.desc.nullslast,publiee_a.desc,identifiant.asc";

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
      /**
       * Combien d'offres portent réellement des notes.
       *
       * ⚠️ **Ce n'est pas une statistique décorative.** La liste est classée
       * par intérêt : tant que la notation n'a pas rattrapé toute la base, le
       * bas de liste n'est **pas classé du tout**. Sans ce chiffre à l'écran,
       * une offre non notée posée sous une offre à 5/100 se lirait comme
       * « jugée moins intéressante », alors qu'elle n'a jamais été jugée.
       */
      notees: number | null;
      /** Pour le marqueur « Nouveau ». `null` si on n'a pas pu le savoir. */
      derniereExecution: number | null;
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
 * Un échec ici n'est pas bloquant — on perd le marqueur, pas la liste.
 */
async function lireDerniereExecution(): Promise<number | null> {
  const resultat = await interrogerBase<{ id: number }>(
    "executions_veille?select=id&issue=eq.reussite&etape=eq.collecte" +
      "&order=demarree_a.desc&limit=1",
  );

  return resultat.ok ? (resultat.lignes[0]?.id ?? null) : null;
}

/**
 * Combien d'offres sont notées.
 *
 * On ne compte pas les lignes déjà reçues : la liste est plafonnée à 200, elle
 * ne dit donc rien des 335 offres qu'elle ne montre pas. Une requête de
 * comptage pur — `limit=1`, seul l'en-tête `Content-Range` nous intéresse.
 *
 * Un échec n'est pas bloquant : `null` remonte l'ignorance jusqu'à l'écran,
 * qui se tait alors sur ce point plutôt que d'annoncer un chiffre faux.
 */
async function compterNotees(): Promise<number | null> {
  const resultat = await interrogerBase<{ identifiant: string }>(
    "offres?select=identifiant&note_interet=not.is.null&limit=1",
    { compter: true },
  );

  return resultat.ok ? resultat.total : null;
}

export async function listerOffres(): Promise<ResultatListe> {
  const requeteOffres = interrogerBase<OffreEnListe>(
    `offres?select=${COLONNES_LISTE}` +
      `&order=${CLASSEMENT}&limit=${PLAFOND_AFFICHAGE}`,
    { compter: true },
  );

  // Les trois requêtes partent ensemble : enchaînées, elles tripleraient
  // l'attente avant le premier pixel pour aucune raison — aucune ne dépend du
  // résultat des autres.
  const [offres, derniereExecution, notees] = await Promise.all([
    requeteOffres,
    lireDerniereExecution(),
    compterNotees(),
  ]);

  if (!offres.ok) {
    return offres;
  }

  return {
    ok: true,
    offres: offres.lignes,
    // ⚠️ Pas de repli sur `lignes.length` ici : une liste tronquée à 200 dont
    // l'en-tête de comptage manque annoncerait « 200 offres collectées »
    // comme si c'était toute la base. `null` remonte l'ignorance jusqu'à
    // l'écran, qui sait alors ne parler que de ce qu'il affiche.
    total: offres.total,
    notees,
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
  if (!FORMAT_IDENTIFIANT.test(identifiant)) {
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
