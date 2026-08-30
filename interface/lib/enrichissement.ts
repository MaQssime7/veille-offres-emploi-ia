/**
 * L'enrichissement : constantes et calculs, purs.
 *
 * ⚠️ **Pas d'`import "server-only"` ici, et c'est délibéré** — c'est le neuvième
 * module de `lib/` dans ce cas. Le bloc d'enrichissement est un composant
 * client : il sonde une route toutes les 1,5 s et redécide à chaque réponse ce
 * qu'il affiche. Il lui faut donc les mêmes constantes et le même calcul d'état
 * que le serveur. S'il allait les chercher dans le module qui lit la base, il
 * tirerait la clé secrète de Supabase dans le graphe du navigateur.
 *
 * **Ce qui a le droit d'être ici** : des constantes et des fonctions pures.
 * Jamais un appel réseau, jamais une lecture de secret.
 */

/**
 * Ce que les enrichissements d'une journée ont le droit de consommer.
 *
 * ⚠️ **C'est la seule borne de dépense du système**, depuis que
 * l'enrichissement automatique a été refusé : « au plus deux par nuit » bornait
 * la facture autant qu'il choisissait les offres. L'enveloppe le remplace et
 * borne mieux — des tokens plutôt que des clics, dont le coût varie du simple
 * au quintuple.
 *
 * ⚠️ **Elle est vérifiée CÔTÉ SERVEUR, dans l'action.** L'afficher grisé sur un
 * bouton ne protège de rien : l'action s'invoque par un `POST` que rien
 * n'oblige à partir de notre page.
 *
 * ⚠️ **Valeur de DÉPART, non mesurée.** Le PRD l'a posée sur une estimation de
 * 100 000 à 150 000 tokens par enrichissement, alors qu'aucun n'avait tourné.
 * Le plan prévoit de la re-régler en phase 7, au moment où le coût réel sera
 * connu — c'est le seul moment où l'on disposera du chiffre.
 *
 * ⚠️ **La notation nocturne n'y entre PAS.** Elle est écrite dans
 * `executions_veille`, pas ici, et la somme ne regarde que les enrichissements.
 * L'y inclure ferait rater des offres un matin de forte collecte.
 */
export const ENVELOPPE_QUOTIDIENNE_TOKENS = 300_000;

/**
 * Au-delà, un enrichissement qui n'a pas conclu est mort, pas lent.
 *
 * ⚠️ **Sans ce seuil, une offre se bloquerait POUR TOUJOURS.** L'index
 * `enrichissements_un_seul_en_vol` interdit une seconde demande tant que la
 * première n'est pas conclue : si le workflow GitHub ne démarre jamais — jeton
 * expiré, panne chez GitHub —, la ligne reste `demande`, et plus aucun
 * enrichissement n'est possible sur cette offre. Rien à l'écran ne l'expliquerait.
 *
 * **10 minutes, soit le double des cinq que le plan alloue à un
 * enrichissement.** Même raisonnement que `DUREE_MAX_COLLECTE_MINUTES` dans
 * `veille.ts`, qui prend le double du `timeout-minutes` du workflow : le seuil
 * doit laisser passer le pire cas normal et rien de plus.
 */
export const PEREMPTION_MINUTES = 10;

/** Les quatre issues, telles que la contrainte `issue_connue` les grave. */
export const ISSUES = ["demande", "en_cours", "reussite", "echec"] as const;
export type Issue = (typeof ISSUES)[number];

export function estIssue(valeur: unknown): valeur is Issue {
  return typeof valeur === "string" && (ISSUES as readonly string[]).includes(valeur);
}

/** Une tentative, réduite à ce que l'écran a besoin de savoir. */
export type Enrichissement = {
  id: number;
  issue: Issue;
  demandeA: string;
  termineA: string | null;
  motifEchec: string | null;
  /** L'ancrage vérifiable. `null` partout tant que l'agent n'a pas conclu. */
  fiche: FicheEntreprise | null;
};

/** Les quatre degrés de certitude du rapprochement. Ordre du plus sûr au moins. */
export const APPARIEMENTS = [
  "verifie",
  "probable",
  "non_identifie",
  "intermediaire",
] as const;
export type Appariement = (typeof APPARIEMENTS)[number];

export function estAppariement(valeur: unknown): valeur is Appariement {
  return (
    typeof valeur === "string" &&
    (APPARIEMENTS as readonly string[]).includes(valeur)
  );
}

/** *vérifié* = lu sur une source qui fait foi · *déduit* = inféré par l'agent. */
export const MARQUEURS = ["verifie", "deduit"] as const;
export type Marqueur = (typeof MARQUEURS)[number];

export function estMarqueur(valeur: unknown): valeur is Marqueur {
  return (
    typeof valeur === "string" && (MARQUEURS as readonly string[]).includes(valeur)
  );
}

/**
 * Une rubrique RÉDIGÉE, avec son marqueur.
 *
 * ⚠️ **L'absence de rubrique veut dire « non disponible », et cette chaîne ne
 * vient JAMAIS de la base** — c'est une règle du schéma, et c'est ici qu'elle se
 * paie : c'est l'affichage qui doit rendre l'absence en toutes lettres.
 */
export type Rubrique = {
  rubrique: string;
  valeur: string;
  marqueur: Marqueur;
  rang: number;
};

/**
 * L'ancrage en colonnes typées, plus les rubriques rédigées.
 *
 * ⚠️ **`chiffreAffaires` et `chiffreAffairesAnnee` sont INDISSOCIABLES**, comme
 * `trancheEffectif` et son millésime — la base l'impose par contrainte, et
 * l'écran ne doit jamais afficher l'un sans l'autre. Le registre public ne rend
 * que le dernier exercice DÉPOSÉ : mesuré à huit ans d'âge sur OCTO Technology.
 * Un chiffre d'affaires sans son année laisse croire qu'il est récent, ce qui
 * n'est pas une imprécision mais un mensonge.
 */
/*
 * ⚠️ **`categorie` (le code INSEE) a été retiré de ce type le 30 août 2026**,
 * avec son affichage. La colonne existe toujours en base et les trois fiches
 * déjà produites la portent — c'est seulement la requête de l'écran qui ne la
 * demande plus. La remettre est une chaîne à rajouter, sans migration.
 */
export type FicheEntreprise = {
  appariement: Appariement;
  appariementMotif: string | null;
  siren: string | null;
  nomOfficiel: string | null;
  creeeLe: string | null;
  trancheEffectif: string | null;
  trancheEffectifAnnee: number | null;
  chiffreAffaires: number | null;
  chiffreAffairesAnnee: number | null;
  site: string | null;
  siteMarqueur: Marqueur | null;
  rubriques: Rubrique[];
};

/**
 * Le CODE INSEE de tranche d'effectif traduit en toutes lettres.
 *
 * ⚠️ **La base stocke le CODE, jamais le libellé** — décision de la migration
 * 10, et c'est cette table qui la rend lisible. Une copie de la même table vit
 * dans `pipeline/registre.py`, et ce **n'est pas un doublon fonctionnel** : là-bas
 * elle sert à donner au modèle de quoi comparer la tranche officielle à
 * l'effectif revendiqué sur un site, ici elle sert à écrire une phrase. Les deux
 * peuvent diverger sans conséquence — mais si celle-ci perd un code, l'écran
 * n'affichera rien, sans erreur.
 */
export const TRANCHES_EFFECTIF: Record<string, string> = {
  NN: "effectif non renseigné",
  "00": "aucun salarié",
  "01": "1 ou 2 salariés",
  "02": "3 à 5 salariés",
  "03": "6 à 9 salariés",
  "11": "10 à 19 salariés",
  "12": "20 à 49 salariés",
  "21": "50 à 99 salariés",
  "22": "100 à 199 salariés",
  "31": "200 à 249 salariés",
  "32": "250 à 499 salariés",
  "41": "500 à 999 salariés",
  "42": "1 000 à 1 999 salariés",
  "51": "2 000 à 4 999 salariés",
  "52": "5 000 à 9 999 salariés",
  "53": "10 000 salariés et plus",
};

/**
 * Le titre affiché de chaque rubrique rédigée, et **l'ordre d'affichage**.
 *
 * ⚠️ **`groupe` et `effectif_annonce` ont été RETIRÉS le 30 août 2026** —
 * décision de Maxime, en regardant la fiche : l'appartenance à un groupe est
 * « dure à trouver » et sans usage pour lui, et l'effectif du registre lui
 * suffit « même s'il date de plusieurs années ».
 *
 * ⚠️ **Le retrait ne s'arrête PAS à cet écran, et c'est là qu'il vaut quelque
 * chose** : l'agent ne les cherche plus du tout (`pipeline/enrichissement.py`).
 * Masquer sans arrêter de chercher aurait laissé payer des tours d'exploration
 * pour du texte que personne ne lit. **La contrainte `rubrique_connue` de la
 * migration 10 les autorise toujours** : rien ne casse si une fiche ancienne en
 * porte, elles ne s'afficheront simplement plus.
 */
export const TITRES_RUBRIQUES: Record<string, string> = {
  modele_economique: "Modèle économique",
};

/**
 * Ce que l'appariement dit au lecteur, en français.
 *
 * ⚠️ **Ces phrases sont l'endroit où le doute devient visible**, et c'est le
 * critère de succès n° 12 du projet : une fiche qui se trompe d'entreprise est
 * pire qu'une fiche absente, parce qu'elle a l'air rigoureuse. « Probable » ne
 * doit donc jamais se lire comme « vérifié » d'un coup d'œil.
 */
export const DITS_APPARIEMENT: Record<Appariement, string> = {
  verifie: "Identité vérifiée",
  probable: "Identité probable",
  non_identifie: "Entreprise non identifiée",
  intermediaire: "Annonce d’un intermédiaire",
};

/** Une étape franchie. */
export type Etape = {
  rang: number;
  libelle: string;
  ecriteA: string;
};

/**
 * Ce que le bloc affiche. Les quatre états du `DESIGN.md`, plus le plafond.
 *
 * ⚠️ **`perime` n'est pas un cinquième état d'affichage** : il se rend comme un
 * échec, avec son motif propre. C'est la même distinction que `veille.ts` fait
 * entre « en échec » (un motif existe, on peut le lire) et « interrompue »
 * (aucun motif à chercher, l'exécution a été tuée avant d'en écrire un).
 */
export type EtatEnrichissement =
  | { etat: "absent" }
  | { etat: "en_cours"; enrichissement: Enrichissement; etapes: Etape[] }
  | { etat: "reussi"; enrichissement: Enrichissement; etapes: Etape[] }
  | {
      etat: "echoue";
      enrichissement: Enrichissement;
      etapes: Etape[];
      motif: string;
    };

/** Le motif affiché quand la ligne est morte sans avoir pu écrire le sien. */
export const MOTIF_INTERROMPU =
  "L’enrichissement a été interrompu avant d’avoir pu dire pourquoi.";

/** Une demande partie, pas encore conclue — c'est ce que l'index verrouille. */
export function estEnVol(issue: Issue): boolean {
  return issue === "demande" || issue === "en_cours";
}

/**
 * Cette tentative est-elle morte en vol ?
 *
 * ⚠️ **Le temps se compte depuis `demandeA`, jamais depuis `demarreA`.** Le cas
 * qu'on veut attraper est précisément celui où l'agent n'a JAMAIS démarré :
 * `demarreA` y est `null`, et un calcul fondé dessus ne déclencherait jamais.
 */
export function estPerime(
  enrichissement: Pick<Enrichissement, "issue" | "demandeA">,
  maintenant: Date,
): boolean {
  if (!estEnVol(enrichissement.issue)) return false;

  const depuis = new Date(enrichissement.demandeA).getTime();
  if (Number.isNaN(depuis)) return true; // une date illisible n'est pas un travail en cours

  return maintenant.getTime() - depuis > PEREMPTION_MINUTES * 60_000;
}

/**
 * Ce que l'écran doit montrer, à partir de la dernière tentative connue.
 *
 * Entre : la dernière tentative (ou `null`), ses étapes, l'heure de référence.
 * Sort : l'un des quatre états d'affichage.
 * Casse : ne lève pas — une issue inconnue ou une date illisible se rend en
 * échec, jamais en page blanche.
 *
 * ⚠️ **L'ORDRE des tests est la logique**, comme dans `choisirAffichage()` de
 * `matin.ts` : la péremption se teste AVANT « en cours », sinon une ligne morte
 * depuis deux heures ferait pulser l'écran indéfiniment.
 *
 * ⚠️ **Fonction pure, et `maintenant` est un PARAMÈTRE.** Si elle appelait
 * `new Date()` elle-même, aucun de ses cas ne serait éprouvable — et c'est
 * exactement la classe de bug que `npm run verifie` traque en rejouant la suite
 * en UTC.
 */
export function calculerEtatEnrichissement(
  dernier: Enrichissement | null,
  etapes: Etape[],
  maintenant: Date,
): EtatEnrichissement {
  if (dernier === null) return { etat: "absent" };

  if (estPerime(dernier, maintenant)) {
    return {
      etat: "echoue",
      enrichissement: dernier,
      etapes,
      motif: MOTIF_INTERROMPU,
    };
  }

  if (estEnVol(dernier.issue)) {
    return { etat: "en_cours", enrichissement: dernier, etapes };
  }

  if (dernier.issue === "reussite") {
    return { etat: "reussi", enrichissement: dernier, etapes };
  }

  return {
    etat: "echoue",
    enrichissement: dernier,
    etapes,
    // La contrainte `echec_toujours_motive` garantit qu'un échec porte son
    // motif ; le repli couvre une issue inconnue, qui ne peut venir que d'une
    // migration future oubliée ici.
    motif: dernier.motifEchec ?? MOTIF_INTERROMPU,
  };
}

/**
 * Une ligne d'enrichissement, réduite à ce que l'enveloppe regarde.
 *
 * ⚠️ Les noms sont ceux des COLONNES, pas ceux de l'écran : cette forme est
 * celle que la base rend, et la traduire avant de sommer ferait un aller-retour
 * de plus pour rien.
 */
export type LigneConsommation = {
  issue: string;
  demande_a: string;
  tokens_entree: number | null;
  tokens_sortie: number | null;
  tokens_cache_lu: number | null;
  tokens_cache_ecrit: number | null;
};

/**
 * Ce qu'un enrichissement EN VOL réserve sur l'enveloppe du jour.
 *
 * ⚠️ **Sans cette réservation, la seule borne de dépense du système avait un
 * trou béant** — trouvé en revue le 30 août 2026. Les compteurs de tokens sont
 * `NULL` tant qu'un enrichissement n'a pas conclu : la somme du jour comptait
 * donc **zéro** pour tout ce qui tournait. Et l'index unique ne sérialise que
 * par offre — rien n'empêchait d'en lancer dix sur dix offres différentes dans
 * la même minute, tous lisant « 0 consommé » et passant la garde. À
 * l'estimation du PRD, 1 à 1,5 million de tokens contre une enveloppe de
 * 300 000.
 *
 * **150 000, la borne HAUTE de l'estimation du PRD** (100 000 à 150 000) : une
 * réservation doit se tromper du côté qui ne coûte rien. Conséquence assumée,
 * **au plus deux enrichissements simultanés** — très au-dessus de l'usage d'un
 * utilisateur unique qui lit ses offres le matin.
 *
 * ⚠️ **À re-régler en phase 7**, en même temps que l'enveloppe et sur la même
 * mesure : c'est alors seulement que le coût réel sera connu.
 */
export const COUT_PRESUME_TOKENS = 150_000;

/**
 * Ce que la journée a consommé — dépenses réelles plus réservations.
 *
 * Entre : les lignes du jour, l'heure de référence.
 * Sort : un total de tokens.
 * Casse : ne lève pas. Une issue inconnue est comptée sur ses compteurs
 * réels, jamais réservée — c'est le sens le plus prudent pour une valeur qu'on
 * ne sait pas interpréter.
 *
 * ⚠️ **Fonction pure et exportée EXPRÈS pour être éprouvée.** C'est le seul
 * code du projet qui empêche une facture de s'emballer ; le laisser enfermé
 * dans le module qui lit la base l'aurait rendu invérifiable autrement qu'en
 * fabriquant des lignes en base.
 */
export function calculerConsommation(
  lignes: LigneConsommation[],
  maintenant: Date,
): number {
  return lignes.reduce((total, ligne) => {
    if (estIssue(ligne.issue) && estEnVol(ligne.issue)) {
      // Un en-vol PÉRIMÉ ne réserve rien : il est mort, l'écran l'affiche déjà
      // comme un échec, et le compter empêcherait de relancer toute la journée.
      return (
        total +
        (estPerime({ issue: ligne.issue, demandeA: ligne.demande_a }, maintenant)
          ? 0
          : COUT_PRESUME_TOKENS)
      );
    }
    // ⚠️ `?? 0` sur chaque colonne : les compteurs sont `NULL` tant qu'un
    // enrichissement n'a pas conclu. `undefined + 3` vaut `NaN`, et un `NaN`
    // comparé à un plafond est toujours faux — l'enveloppe s'ouvrirait en grand
    // sans le moindre message.
    return (
      total +
      (ligne.tokens_entree ?? 0) +
      (ligne.tokens_sortie ?? 0) +
      (ligne.tokens_cache_lu ?? 0) +
      (ligne.tokens_cache_ecrit ?? 0)
    );
  }, 0);
}
