import "server-only";

import { SEUIL_INTERET } from "./filtres";
import {
  CLASSEMENTS,
  COLONNES_LISTE,
  CONDITION_NON_SUPPRIMEE,
  CONDITION_SEUIL_INTERET,
  type OffreEnListe,
} from "./offres";
import {
  type GroupeOffres,
  annoncesRepresentees,
  regrouperParPoste,
} from "./regroupement";
import { type Statut } from "./statuts";
import { type MotifEchec, interrogerBase } from "./supabase";

/**
 * Ce que la nuit a rapporté — la lecture de l'écran du matin, `/`.
 *
 * Entre : rien. L'écran ne se règle pas, il rend compte.
 * Sort : la collecte affichée (son identifiant et sa date), les offres à lire
 * ce matin, un résumé de tout ce que cette collecte contient, et le nombre
 * d'offres plus anciennes qui attendent ailleurs.
 * Casse : ne lève jamais. Une base injoignable rend `{ ok: false }` avec son
 * motif ; un comptage raté laisse `null` et l'écran se tait sur ce point plutôt
 * que d'annoncer un chiffre faux.
 *
 * ⚠️ **Ce module est séparé de `offres.ts` parce qu'il pose une autre
 * question.** `offres.ts` répond à « que contient la base, filtrée comme je
 * demande » — un plan de travail qui couvre tous les temps. Celui-ci répond à
 * « qu'est-ce que la nuit a apporté qui vaut d'être lu maintenant », une
 * question bornée à **une seule exécution**. Les fondre ferait une fonction à
 * six paramètres dont la moitié ne servirait jamais à l'appelant d'en face.
 *
 * ⚠️ **La date affichée en tête de `/` vient d'ICI, jamais de
 * `lireEtatVeille()`.** Les deux lisent bien la dernière collecte réussie, mais
 * ce sont deux requêtes distinctes : si une collecte se termine entre les deux,
 * l'écran daterait une liste d'offres avec l'heure d'une **autre** exécution.
 * La date et les offres doivent sortir de la même lecture pour que l'entête ne
 * puisse pas mentir. Le doublon de requête est le prix de cette garantie, et il
 * porte sur une table de 55 lignes servie par un index partiel.
 */

/*
 * ⚠️ **Le seuil d'intérêt N'EST PLUS DÉFINI ICI depuis le 31 août 2026, et ce
 * n'est pas un rangement.** Cet écran portait `SEUIL_INTERET_MATIN = 35` et
 * était le seul du produit à cacher une offre ; `/offres` montrait tout, y
 * compris les 434 jamais notées. Deux seuils, c'était deux populations : une
 * offre à 37 s'affichait le matin puis restait introuvable dans le plan de
 * travail où on serait allé la rechercher l'après-midi.
 *
 * `SEUIL_INTERET` (`lib/filtres.ts`) vaut désormais pour les deux écrans, et
 * c'est là que vit la mesure qui l'a fixé à 40. **Ne pas redéclarer de valeur
 * ici** : une seconde définition rouvrirait exactement le défaut qu'on ferme.
 */

/**
 * Le plafond de lignes rendues par l'écran du matin.
 *
 * Il n'a rien à voir avec les 200 de `/offres`, qui bornent **toute la base**.
 * Ici on ne montre qu'une nuit : la collecte quotidienne ramène une trentaine
 * d'offres, et une nuit de rattrapage après plusieurs jours sautés en ramène
 * plus sans jamais approcher ce chiffre. Il existe pour empêcher qu'un
 * rattrapage exceptionnel construise mille lignes dans le navigateur.
 */
const PLAFOND_MATIN = 200;

/**
 * Le plafond du résumé, celui qui sert à compter.
 *
 * ⚠️ **Il est plus haut que celui de l'affichage, et c'est le point.** Le
 * résumé ne rend que trois colonnes minuscules par offre : il peut donc couvrir
 * toute la collecte là où la liste s'arrête à ce qu'on lit. C'est ce qui permet
 * de dire « 34 offres collectées, aucune n'atteint le seuil » plutôt que de
 * deviner.
 */
const PLAFOND_RESUME = 2000;

/** Le statut des offres qui restent à lire. Typé pour qu'une faute de frappe casse la compilation. */
const A_TRAITER: Statut = "a_traiter";

/** La collecte dont l'écran rend compte. */
export type CollecteAffichee = {
  id: number;
  /** Horodatage ISO avec fuseau — c'est lui qui date le titre de la page. */
  demarreeA: string;
};

/**
 * Ce que contient la collecte affichée, tous statuts et toutes notes
 * confondus — la matière qui permet de choisir **lequel** des écrans vides
 * montrer.
 *
 * ⚠️ **Sans ces quatre nombres, un seul écran vide serait possible**, et il
 * dirait la même chose une nuit calme, une nuit où la notation est tombée, et
 * un matin où tout a été trié. Trois situations qui appellent trois réactions
 * différentes.
 */
export type ResumeCollecte = {
  /** Combien d'offres cette collecte a ramenées. */
  total: number;
  /** Combien atteignent le seuil, **tous statuts confondus**. */
  auSeuil: number;
  /** Combien n'ont pas encore de note d'intérêt. */
  nonNotees: number;
  /**
   * Combien n'ont pas encore de note d'intérêt **et ont déjà été tentées au
   * moins une fois** par la notation.
   *
   * ⚠️ **Sans ce compte, l'écran promettait une reprise qui n'arrivera peut-être
   * jamais** — relevé en revue le 30 août 2026. `pipeline/notation.py` abandonne
   * une offre au bout de `MAX_TENTATIVES` : une nuit où la notation échoue
   * définitivement ferait afficher « elles seront reprises à la prochaine
   * notation » tous les matins suivants. C'est exactement le mensonge que
   * `notation_tentatives` empêche déjà sur `/offres`.
   *
   * ⚠️ **Le seuil du pipeline n'est PAS recopié ici**, délibérément : deux
   * endroits qui détiennent la même limite finissent par diverger, et c'est
   * celui du pipeline qui a raison puisque c'est lui qui décide. On distingue
   * seulement « jamais tentée » de « déjà tentée », ce qui suffit à ne rien
   * promettre de faux.
   */
  dejaTentees: number;
  /**
   * Le résumé couvre-t-il toute la collecte ?
   *
   * ⚠️ **`false` veut dire que les quatre nombres ci-dessus sont des
   * minorants**, pas des totaux — la collecte dépassait `PLAFOND_RESUME`. Le
   * cas n'a jamais été atteint (la plus grosse collecte observée fait quelques
   * dizaines d'offres), mais s'il l'était, affirmer « aucune n'atteint le
   * seuil » sur un échantillon serait un mensonge silencieux.
   */
  complet: boolean;
};

export type ResultatMatin =
  | {
      ok: true;
      /** `null` quand aucune collecte n'a jamais réussi : il n'y a pas de nuit de référence. */
      collecte: CollecteAffichee | null;
      /**
       * Les postes à lire ce matin, déjà filtrés, classés et **regroupés**.
       *
       * ⚠️ **Un groupe, pas une offre** — depuis le 30 août 2026. France Travail
       * publie le même poste plusieurs fois sous des identifiants différents, et
       * l'écran du matin en montrait quatre lignes pour deux annonces réelles.
       * Le détail du mécanisme est dans `lib/regroupement.ts` ; ici il suffit de
       * savoir que `groupes.length` compte des **postes**, jamais des lignes de
       * base.
       */
      groupes: GroupeOffres<OffreEnListe>[];
      /** `null` si le comptage a échoué : l'écran se tait alors sur les détails. */
      resume: ResumeCollecte | null;
      /** Les offres à traiter qui ne viennent pas de cette collecte. `null` si inconnu. */
      enAttenteAilleurs: number | null;
    }
  | { ok: false; motif: MotifEchec; explication: string };

/** Une offre telle qu'elle sert à compter — trois colonnes, rien de plus. */
type LigneResume = {
  note_interet: number | null;
  statut: Statut;
  notation_tentatives: number;
};

/**
 * La dernière collecte réussie : son identifiant **et** sa date.
 *
 * ⚠️ **Les deux valeurs sortent de la même ligne, et c'est toute la raison
 * d'être de cette fonction.** `lireDerniereExecution()` dans `offres.ts` ne
 * rend que l'identifiant, parce que la liste n'a besoin que de lui pour marquer
 * « Nouveau ». Ici l'entête de page affiche une date : la lire ailleurs
 * ouvrirait la possibilité qu'elle désigne une autre exécution que les offres
 * affichées.
 *
 * ⚠️ Mêmes filtres que partout ailleurs : `etape=eq.collecte` (sinon une
 * notation réussie ferait office de collecte) et `issue=eq.reussite` (une
 * exécution tuée ou ratée n'a rien ramené de fiable). Tri sur `demarree_a`,
 * la colonne que couvre l'index partiel `executions_veille_derniere_reussite`.
 */
type LectureCollecte =
  | { ok: true; collecte: CollecteAffichee | null }
  | { ok: false; motif: MotifEchec; explication: string };

async function lireDerniereCollecte(): Promise<LectureCollecte> {
  const resultat = await interrogerBase<{ id: number; demarree_a: string }>(
    "executions_veille?select=id,demarree_a&etape=eq.collecte" +
      "&issue=eq.reussite&order=demarree_a.desc&limit=1",
  );

  if (!resultat.ok) {
    return {
      ok: false,
      motif: resultat.motif,
      explication: resultat.explication,
    };
  }

  const ligne = resultat.lignes[0];
  return {
    ok: true,
    collecte: ligne ? { id: ligne.id, demarreeA: ligne.demarree_a } : null,
  };
}

/**
 * Les offres à lire ce matin.
 *
 * ⚠️ **Le seuil part dans le CHEMIN, pas dans `options.egal`, et c'est autorisé
 * ici pour une raison précise.** La règle du projet est que le chemin ne porte
 * que des constantes du code — `SEUIL_INTERET` en est une, importée de
 * `filtres.ts`, qu'aucune adresse ni aucun formulaire ne peut atteindre. `egal`
 * n'aurait de toute façon pas pu servir : elle ne sait produire que `eq.`, et
 * il faut ici un `gte.`. Le jour où ce seuil deviendrait réglable depuis
 * l'interface, cette ligne devrait changer de mécanisme — pas seulement de
 * valeur.
 *
 * ⚠️ **L'identifiant d'exécution et le statut passent, eux, par `egal`.**
 * L'identifiant vient de la base et le statut d'une constante : ni l'un ni
 * l'autre n'est « extérieur ». On les encode quand même, parce que l'exception
 * bien argumentée est exactement ce par quoi les injections reviennent.
 *
 * ⚠️ **Le classement est celui de `/offres`, réutilisé et non recopié.** Les
 * deux écrans doivent classer pareil : deux chaînes jumelles finiraient par
 * diverger sur le départage des ex æquo, et la même offre passerait devant une
 * autre sur un écran et derrière sur l'autre.
 */
function lireOffresDuMatin(idCollecte: number) {
  return interrogerBase<OffreEnListe>(
    `offres?select=${COLONNES_LISTE}` +
      CONDITION_SEUIL_INTERET +
      // ⚠️ **La corbeille vaut ici aussi**, sinon une offre retirée depuis
      // `/offres` réapparaîtrait le lendemain matin — le geste ne tiendrait
      // qu'un écran sur deux, ce qui est pire que pas de geste du tout.
      CONDITION_NON_SUPPRIMEE +
      `&order=${CLASSEMENTS.interet}&limit=${PLAFOND_MATIN}`,
    { egal: { execution_id: String(idCollecte), statut: A_TRAITER } },
  );
}

/**
 * Le résumé de la collecte, compté **en JavaScript** sur une lecture légère.
 *
 * ⚠️ **Une requête au lieu de quatre, et ce n'est pas de l'optimisation
 * prématurée.** Les quatre nombres du résumé demanderaient quatre comptages
 * PostgREST distincts (`count=exact` ne compte qu'une chose à la fois), donc
 * quatre allers-retours de plus **sur le chemin critique**, puisqu'ils
 * dépendent tous de l'identifiant lu juste avant. Ici on ramène deux colonnes
 * pour quelques dizaines de lignes — quelques kilo-octets — et on compte sur
 * place.
 *
 * ⚠️ **Le compte doit porter sur les offres qui portent CET `execution_id`, pas
 * sur `executions_veille.offres_nouvelles`.** La colonne existe et serait
 * gratuite à lire, mais elle porte ce que la collecte a **écrit** :
 * `recoller_offres_orphelines` peut rattacher des offres après coup, et le
 * résumé annoncerait alors un nombre que la liste en dessous ne montre pas.
 */
async function lireResume(idCollecte: number): Promise<ResumeCollecte | null> {
  const resultat = await interrogerBase<LigneResume>(
    // ⚠️ **La corbeille n'est PAS exclue du résumé, et c'est un correctif de
    // revue du 31 août 2026.** Une première version l'excluait, au motif que le
    // résumé alimente des phrases affichées. Le raisonnement était inversé : ce
    // résumé est un **verdict sur la NUIT**, c'est-à-dire sur un fait passé, et
    // un filtre d'affichage postérieur le fait mentir. Cas concret : la nuit
    // ramène 7 offres dont 2 au-dessus du seuil, Maxime les retire, et l'écran
    // affirme « la collecte a rapporté 5 offres, aucune n'atteint 40/100 » —
    // deux affirmations fausses sur ce qui s'est réellement passé.
    `offres?select=note_interet,statut,notation_tentatives&limit=${PLAFOND_RESUME}`,
    { compter: true, egal: { execution_id: String(idCollecte) } },
  );

  if (!resultat.ok) return null;

  const lignes = resultat.lignes;

  return {
    total: lignes.length,
    auSeuil: lignes.filter(
      (l) => l.note_interet !== null && l.note_interet >= SEUIL_INTERET,
    ).length,
    nonNotees: lignes.filter((l) => l.note_interet === null).length,
    dejaTentees: lignes.filter(
      (l) => l.note_interet === null && l.notation_tentatives >= 1,
    ).length,
    // ⚠️ `total === null` veut dire que PostgREST n'a pas renvoyé son en-tête de
    // comptage : on ne peut alors pas prouver qu'on a tout lu, et le résumé se
    // déclare incomplet plutôt que de l'affirmer.
    complet: resultat.total !== null && resultat.total === lignes.length,
  };
}

/**
 * Combien d'offres attendent en tout, tous temps confondus.
 *
 * ⚠️ **Le seuil s'applique ici, et l'oublier a produit un défaut vu à l'écran
 * le 31 août 2026.** Ce compte alimente la carte de passage — « N autres offres
 * attendent dans le plan de travail » — donc il doit compter ce que ce plan de
 * travail **montre vraiment**. Sans le seuil, la carte annonçait **574** offres
 * et menait à un écran qui en affichait **12** : un lien qui ment sur sa
 * destination, sans la moindre erreur pour le signaler.
 *
 * ⚠️ **La condition est IMPORTÉE de `offres.ts`, plus recopiée** — correctif du
 * 31 août 2026, en deux temps. Une première rédaction la réécrivait ici en
 * annonçant « la seule duplication de cette chaîne dans le projet » : c'était
 * faux dès l'intérieur de ce fichier, qui l'écrivait déjà deux fois. Le motif
 * invoqué — « aucun des deux modules ne doit dépendre de l'autre » — était faux
 * lui aussi : ce fichier importe `CLASSEMENTS` et `COLONNES_LISTE` d'`offres.ts`
 * depuis toujours. Il n'y avait rien à protéger, seulement trois endroits où
 * changer l'opérateur.
 */
async function compterATraiter(): Promise<number | null> {
  const resultat = await interrogerBase<{ identifiant: string }>(
    `offres?select=identifiant&limit=1${CONDITION_SEUIL_INTERET}${CONDITION_NON_SUPPRIMEE}`,
    { compter: true, egal: { statut: A_TRAITER } },
  );

  return resultat.ok ? resultat.total : null;
}

/**
 * Le compte rendu du matin, lu en base.
 *
 * ⚠️ **Deux profondeurs, pas quatre.** La collecte se lit d'abord parce que les
 * trois autres requêtes ont besoin de son identifiant ; ces trois-là partent
 * ensuite **ensemble**. Enchaînées, elles ajouteraient trois allers-retours à
 * l'attente avant le premier pixel.
 *
 * ⚠️ **Une lecture de collecte ratée est une PANNE, une collecte absente ne
 * l'est pas.** Les deux rendaient le même `null` dans une première version, et
 * c'est le défaut que `offres.ts` a déjà payé une fois : l'écran annonçait
 * « aucune collecte n'a abouti » — une affirmation sur le pipeline — un jour où
 * c'était simplement la base qui ne répondait pas.
 */
export async function lireCompteRenduDuMatin(): Promise<ResultatMatin> {
  const lecture = await lireDerniereCollecte();

  if (!lecture.ok) {
    return { ok: false, motif: lecture.motif, explication: lecture.explication };
  }

  // ⚠️ **On compte quand même ce qui attend, et ce n'est pas du zèle.** « Aucune
  // collecte réussie » n'implique pas « aucune offre en base » : l'écriture des
  // offres se fait par lots de 50 et **n'est pas atomique** (l'API REST n'expose
  // pas de transaction), donc une collecte qui échoue à mi-parcours laisse
  // derrière elle des offres rattachées à une exécution `echec`. Sans ce
  // comptage, l'écran annoncerait « aucune collecte n'a abouti » sans jamais
  // mentionner des offres qui existent pourtant.
  //
  // ⚠️ **Depuis le seuil du 31 août 2026, ce compte peut tomber à zéro alors
  // que des offres existent** — elles sont toutes sous le seuil. La carte
  // disparaît alors, et c'est voulu : elle mène au plan de travail, qui ne
  // montrerait rien non plus. Une carte annonçant « 574 autres offres »
  // au-dessus d'un écran qui en affiche douze serait pire que son absence, et
  // c'est très exactement le défaut qu'a produit la première version.
  // ⚠️ **La page n'est pas pour autant sans issue** : le lien « Offres » du
  // bandeau ne dépend d'aucun compteur. La formulation précédente disait
  // « n'offrirait AUCUNE sortie » — c'était déjà inexact, et ça le serait
  // devenu dangereusement, en faisant passer la disparition de la carte pour
  // une régression à corriger.
  if (lecture.collecte === null) {
    const totalATraiter = await compterATraiter();
    return {
      ok: true,
      collecte: null,
      groupes: [],
      resume: null,
      // Aucune collecte de référence : rien n'est « de ce matin », donc tout ce
      // qui attend est « ailleurs ». La soustraction de `compterAilleurs` n'a
      // rien à retrancher.
      enAttenteAilleurs: totalATraiter,
    };
  }

  const { id } = lecture.collecte;

  const [offres, resume, totalATraiter] = await Promise.all([
    lireOffresDuMatin(id),
    lireResume(id),
    compterATraiter(),
  ]);

  if (!offres.ok) {
    return { ok: false, motif: offres.motif, explication: offres.explication };
  }

  // ⚠️ **Le regroupement se fait ICI, après la requête et jamais dedans.**
  // PostgREST ne sait pas fondre deux lignes sur un intitulé normalisé, et le
  // tenter en SQL demanderait une vue ou une fonction — donc une migration —
  // pour une règle d'AFFICHAGE qui ne concerne qu'un écran sur deux. La liste
  // arrive déjà classée : le regroupement préserve cet ordre au lieu de le
  // refaire.
  const groupes = regrouperParPoste(offres.lignes);

  return {
    ok: true,
    collecte: lecture.collecte,
    groupes,
    // ⚠️ On retranche **toutes les annonces représentées**, jumelles comprises,
    // et non le nombre de lignes affichées. Une jumelle n'est pas à l'écran mais
    // le clic sur le groupe la traite : la compter comme « en attente ailleurs »
    // promettrait du travail qui n'existera plus.
    enAttenteAilleurs: compterAilleurs(
      totalATraiter,
      annoncesRepresentees(groupes),
    ),
    resume,
  };
}

/**
 * Combien d'offres attendent **ailleurs qu'à l'écran**.
 *
 * ⚠️ **On soustrait ce qui est REPRÉSENTÉ à l'écran, pas ce qui vient de la
 * collecte — et la
 * première version se trompait, relevé en revue le 30 août 2026.** Elle retirait
 * toutes les offres à traiter de la nuit, seuil compris ou non : les offres de la
 * collecte restées **sous** le seuil étaient donc à la fois cachées par l'écran
 * *et* absentes du compteur censé garantir que rien ne se perd. Scénario concret :
 * une nuit ramène trente offres toutes sous 50 et l'arriéré est vide — le compteur
 * tombait à zéro, la carte disparaissait, et « Journée calme » ne laissait **aucun
 * chemin** vers les trente offres jamais lues.
 *
 * ⚠️ **Ce raisonnement A CHANGÉ DE SENS le 31 août 2026, et le garder tel quel
 * ferait mal raisonner.** Il valait quand `/offres` montrait tout : les offres
 * sous le seuil étaient cachées du matin mais **consultables ailleurs**, donc le
 * compteur devait les mentionner. Depuis que `SEUIL_INTERET` borne les deux
 * écrans, elles ne sont consultables nulle part et `compterATraiter()` les
 * exclut à son tour : le compteur retombe donc à zéro dans ce scénario, **et
 * c'est correct** — il n'y a plus de « chemin » à préserver vers des offres que
 * le produit a décidé de ne pas montrer. Ce qu'il garantit désormais est plus
 * simple : **la carte annonce exactement ce que le plan de travail affichera.**
 *
 * Les offres affichées sont toutes « à traiter » par construction du filtre : la
 * soustraction est donc exacte, et elle n'a plus besoin du résumé.
 *
 * ⚠️ **`Math.max(0, …)` n'est pas de la paranoïa.** Les deux nombres viennent de
 * deux requêtes distinctes : si une offre change de statut entre les deux — un
 * clic sur « Écarté » dans un autre onglet, la nuit qui écrit pendant la lecture —
 * la différence peut passer sous zéro. « −3 offres attendent » s'afficherait tel
 * quel.
 */
function compterAilleurs(
  totalATraiter: number | null,
  representees: number,
): number | null {
  if (totalATraiter === null) return null;

  return Math.max(0, totalATraiter - representees);
}

/**
 * Ce que l'écran montre : la liste, ou **lequel** des cinq écrans vides.
 *
 * Entre : ce que les requêtes ont rendu.
 * Sort : une sorte parmi six, exhaustives et mutuellement exclusives.
 * Casse : rien, c'est une fonction pure — c'est ce qui permet d'éprouver tous
 * ces cas sans base ni réseau, y compris ceux qu'on ne peut pas provoquer à la
 * main (une notation tombée, une collecte vide).
 *
 * ⚠️ **L'ORDRE des tests est la logique, pas un détail de rédaction.** Chaque
 * cas suppose que les précédents sont faux : « aucune n'atteint le seuil »
 * n'est vrai que si la collecte a ramené quelque chose *et* que ce quelque
 * chose a été noté. Réordonner les branches change ce que l'écran affirme.
 */
export type AffichageMatin =
  /** Il y a des offres à lire. */
  | { sorte: "liste" }
  /** Aucune collecte n'a jamais réussi : il n'y a pas de nuit de référence. */
  | { sorte: "sans_collecte" }
  /** La collecte a réussi et n'a ramené aucune offre. */
  | { sorte: "collecte_vide"; collecteA: string }
  /**
   * La collecte a ramené des offres et **aucune n'a de note**.
   *
   * ⚠️ **C'est une PANNE de notation, et sans ce cas elle passerait pour une
   * journée calme.** La collecte et la notation sont deux étapes du même
   * workflow : la première peut réussir quand la seconde tombe. Les offres sont
   * alors en base avec `note_interet` à `NULL`, donc aucune n'atteint le seuil,
   * donc l'écran aurait annoncé « aucune offre n'atteint le seuil » — c'est-à-
   * dire « rien d'intéressant cette nuit » un matin où rien n'a été jugé. Le
   * bandeau d'état ne le rattrape pas : il ne regarde que l'étape `collecte`.
   */
  | {
      sorte: "pas_encore_notees";
      combien: number;
      /** Combien ont DÉJÀ été tentées : au-delà de zéro, la reprise n'est plus promise. */
      dejaTentees: number;
      collecteA: string;
    }
  /**
   * Tout a été noté, rien n'atteint le seuil — la vraie journée calme, US-27.
   *
   * `nonNotees` est joint parce qu'il peut être non nul : une notation
   * partiellement tombée laisse un mélange, et l'écran doit dire que le verdict
   * ne porte pas sur toutes les offres.
   */
  | { sorte: "sous_le_seuil"; total: number; nonNotees: number; collecteA: string }
  /** Des offres atteignaient le seuil, elles ont toutes été triées. */
  | { sorte: "tout_traite"; auSeuil: number; collecteA: string }
  /**
   * La liste est vide et le résumé n'a pas pu être lu (ou est tronqué) : on ne
   * sait pas *pourquoi* elle est vide, et on ne l'invente pas.
   */
  | { sorte: "vide_sans_detail"; collecteA: string };

/**
 * ⚠️ **La date de la collecte voyage DANS le résultat, elle n'est pas passée à
 * part.** Cinq des six sorties l'affichent, et la sixième (« aucune collecte »)
 * n'en a par définition aucune : la porter dans le type rend impossible
 * d'afficher un panneau daté sans date, sans repli sur une chaîne vide qui
 * s'écrirait « date inconnue » à l'écran.
 */
export function choisirAffichage(
  groupes: GroupeOffres<OffreEnListe>[],
  resume: ResumeCollecte | null,
  collecte: CollecteAffichee | null,
): AffichageMatin {
  if (collecte === null) return { sorte: "sans_collecte" };

  const collecteA = collecte.demarreeA;

  if (groupes.length > 0) return { sorte: "liste" };

  // Sans résumé fiable, aucune des explications ci-dessous n'est démontrable.
  if (resume === null || !resume.complet) {
    return { sorte: "vide_sans_detail", collecteA };
  }

  if (resume.total === 0) return { sorte: "collecte_vide", collecteA };

  // ⚠️ Avant le test du seuil : une collecte entièrement non notée passerait
  // sinon pour une collecte sans rien d'intéressant.
  if (resume.nonNotees === resume.total) {
    return {
      sorte: "pas_encore_notees",
      combien: resume.total,
      dejaTentees: resume.dejaTentees,
      collecteA,
    };
  }

  if (resume.auSeuil === 0) {
    return {
      sorte: "sous_le_seuil",
      total: resume.total,
      nonNotees: resume.nonNotees,
      collecteA,
    };
  }

  // Il reste le seul cas possible : des offres atteignaient le seuil, et aucune
  // n'est plus « à traiter ».
  return { sorte: "tout_traite", auSeuil: resume.auSeuil, collecteA };
}
