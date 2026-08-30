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
