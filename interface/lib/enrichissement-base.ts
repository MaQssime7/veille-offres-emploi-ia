import "server-only";

/**
 * L'enrichissement, côté base : lire l'état, compter l'enveloppe, ouvrir une
 * demande.
 *
 * ⚠️ **`import "server-only"` en première ligne** : ce module passe par
 * `lib/supabase.ts`, qui lit la clé secrète. Le calcul, lui, vit dans
 * `lib/enrichissement.ts`, sans cette barrière — parce que le bloc
 * d'enrichissement est un composant client et doit décider ce qu'il affiche à
 * chaque réponse du sondage. **La séparation n'est pas du rangement : c'est ce
 * qui empêche la clé Supabase de partir dans le navigateur.**
 */

import {
  detaillerConsommation,
  ENVELOPPE_QUOTIDIENNE_TOKENS,
  MOTIF_INTERROMPU,
  estAppariement,
  estIssue,
  estMarqueur,
  estPerime,
  type Enrichissement,
  type Etape,
  type FicheEntreprise,
  type Marqueur,
} from "@/lib/enrichissement";
import type { LigneConsommation } from "@/lib/enrichissement";
import { debutDuJourParisien } from "@/lib/francais";
import { FORMAT_IDENTIFIANT } from "@/lib/offres";
import { ecrireDansBase, insererDansBase, interrogerBase } from "@/lib/supabase";

/**
 * ⚠️ **Une liste de colonnes, jamais `select=*`.** La table porte des motifs
 * d'échec rédigés par un agent et, demain, l'ancrage complet de l'entreprise :
 * ce qui n'est pas demandé ne peut pas fuir vers un écran par distraction.
 */
const COLONNES_ENRICHISSEMENT =
  "id,issue,demande_a,termine_a,motif_echec," +
  "appariement,appariement_motif,entreprise_siren,entreprise_nom_officiel," +
  "entreprise_creee_le,entreprise_tranche_effectif," +
  "entreprise_tranche_effectif_annee,chiffre_affaires,chiffre_affaires_annee," +
  "entreprise_site,entreprise_site_marqueur";
const COLONNES_ETAPE = "rang,libelle,ecrite_a,url";
const COLONNES_RUBRIQUE = "rubrique,valeur,marqueur,rang";
const COLONNES_TOKENS =
  "tokens_entree,tokens_sortie,tokens_cache_lu,tokens_cache_ecrit";

type LigneEnrichissement = {
  id: number;
  issue: string;
  demande_a: string;
  termine_a: string | null;
  motif_echec: string | null;
  appariement: string | null;
  appariement_motif: string | null;
  entreprise_siren: string | null;
  entreprise_nom_officiel: string | null;
  entreprise_creee_le: string | null;
  entreprise_tranche_effectif: string | null;
  entreprise_tranche_effectif_annee: number | null;
  chiffre_affaires: number | null;
  chiffre_affaires_annee: number | null;
  entreprise_site: string | null;
  entreprise_site_marqueur: string | null;
};

type LigneEtape = {
  rang: number;
  libelle: string;
  ecrite_a: string;
  /** `null` = cette étape n'a lu aucune page. Voir le type `Etape`. */
  url: string | null;
};

type LigneRubrique = {
  rubrique: string;
  valeur: string;
  marqueur: string;
  rang: number;
};



/**
 * Traduire une ligne de base en objet d'écran.
 *
 * ⚠️ **`estIssue` filtre ce que la base renvoie**, alors qu'une contrainte
 * garantit déjà les quatre valeurs. Ce n'est pas de la défiance envers Postgres :
 * c'est qu'une migration future pourrait en ajouter une cinquième, et ce code
 * doit alors se comporter de façon définie plutôt que de propager une chaîne
 * inconnue jusqu'à un `switch` qui ne la prévoit pas.
 */
function enObjet(
  ligne: LigneEnrichissement,
  rubriques: LigneRubrique[] = [],
): Enrichissement | null {
  if (!estIssue(ligne.issue)) {
    console.error(`[enrichissement] issue inconnue en base sur la ligne ${ligne.id}`);
    return null;
  }
  return {
    id: ligne.id,
    issue: ligne.issue,
    demandeA: ligne.demande_a,
    termineA: ligne.termine_a,
    motifEchec: ligne.motif_echec,
    fiche: enFiche(ligne, rubriques),
  };
}

/**
 * L'ancrage de l'entreprise, ou `null` si l'agent n'a rien conclu.
 *
 * ⚠️ **`appariement` commande TOUTE la fiche.** Sans lui, il n'y a pas de fiche
 * du tout — pas même partielle — parce que des données exactes sur la mauvaise
 * entreprise restent fausses. La base dit la même chose autrement avec
 * `reussite_conclut_l_appariement` : une réussite doit avoir conclu quelque
 * chose sur l'identité, même si cette conclusion est « je n'ai pas trouvé ».
 *
 * ⚠️ **Les deux couples se cassent ENSEMBLE.** Un chiffre d'affaires dont
 * l'année manquerait — ce que la contrainte interdit, mais qu'une migration
 * maladroite pourrait rouvrir — est jeté plutôt qu'affiché seul. Le registre ne
 * rend que le dernier exercice DÉPOSÉ, parfois vieux de huit ans : sans son
 * millésime, le montant se lit comme s'il datait d'aujourd'hui.
 */
function enFiche(
  ligne: LigneEnrichissement,
  rubriques: LigneRubrique[],
): FicheEntreprise | null {
  if (!estAppariement(ligne.appariement)) return null;

  const caDate =
    ligne.chiffre_affaires !== null && ligne.chiffre_affaires_annee !== null;
  const effectifDate =
    ligne.entreprise_tranche_effectif !== null &&
    ligne.entreprise_tranche_effectif_annee !== null;
  const siteMarque =
    ligne.entreprise_site !== null && estMarqueur(ligne.entreprise_site_marqueur);

  return {
    appariement: ligne.appariement,
    appariementMotif: ligne.appariement_motif,
    siren: ligne.entreprise_siren,
    nomOfficiel: ligne.entreprise_nom_officiel,
    creeeLe: ligne.entreprise_creee_le,
    trancheEffectif: effectifDate ? ligne.entreprise_tranche_effectif : null,
    trancheEffectifAnnee: effectifDate
      ? ligne.entreprise_tranche_effectif_annee
      : null,
    chiffreAffaires: caDate ? ligne.chiffre_affaires : null,
    chiffreAffairesAnnee: caDate ? ligne.chiffre_affaires_annee : null,
    site: siteMarque ? ligne.entreprise_site : null,
    siteMarqueur: siteMarque ? (ligne.entreprise_site_marqueur as Marqueur) : null,
    // ⚠️ Une rubrique dont le marqueur est inconnu est ÉCARTÉE, pas affichée
    // sans marqueur : c'est la même règle que pour le site. Un texte sans
    // marqueur laisserait le lecteur croire qu'il est vérifié.
    rubriques: rubriques
      .filter((r) => estMarqueur(r.marqueur) && r.valeur.trim() !== "")
      .map((r) => ({
        rubrique: r.rubrique,
        valeur: r.valeur,
        marqueur: r.marqueur as Marqueur,
        rang: r.rang,
      }))
      .sort((a, b) => a.rang - b.rang),
  };
}

export type LectureEnrichissement =
  | { ok: true; dernier: Enrichissement | null; etapes: Etape[] }
  | { ok: false; explication: string };

/**
 * Le dernier enrichissement d'une offre, avec ses étapes.
 *
 * Entre : un identifiant d'offre, venu de l'adresse ou d'un `POST`.
 * Sort : la dernière tentative (ou `null` si l'offre n'a jamais été enrichie)
 * et ses étapes dans l'ordre.
 * Casse : ne lève jamais — une base injoignable rend `{ ok: false }`, que
 * l'appelant est obligé de regarder.
 *
 * ⚠️ **« Le dernier » se décide sur `demande_a`, pas sur `id`.** Les deux
 * coïncident aujourd'hui, l'identité étant croissante — mais s'appuyer sur
 * l'ordre des clés primaires est une hypothèse qu'aucune contrainte ne défend.
 */
export async function lireDernierEnrichissement(
  identifiant: string,
): Promise<LectureEnrichissement> {
  if (typeof identifiant !== "string" || !FORMAT_IDENTIFIANT.test(identifiant)) {
    return { ok: false, explication: "Cet identifiant ne ressemble à aucune offre." };
  }

  const tentatives = await interrogerBase<LigneEnrichissement>(
    `enrichissements?select=${COLONNES_ENRICHISSEMENT}&order=demande_a.desc&limit=1`,
    { egal: { offre_identifiant: identifiant.toUpperCase() } },
  );
  if (!tentatives.ok) return { ok: false, explication: tentatives.explication };

  const ligne = tentatives.lignes[0];
  if (!ligne) return { ok: true, dernier: null, etapes: [] };

  const etapes = await interrogerBase<LigneEtape>(
    `etapes_enrichissement?select=${COLONNES_ETAPE}&order=rang.asc`,
    { egal: { enrichissement_id: String(ligne.id) } },
  );
  if (!etapes.ok) return { ok: false, explication: etapes.explication };

  // ⚠️ **Les rubriques ne sont lues QUE sur une réussite**, et c'est une
  // requête économisée sur le chemin le plus fréquent — le sondage, qui repasse
  // ici toutes les 1,5 seconde pendant qu'un enrichissement tourne. Une
  // tentative en vol n'a par construction aucune rubrique : elles ne s'écrivent
  // qu'à la conclusion.
  let rubriques: LigneRubrique[] = [];
  if (ligne.issue === "reussite") {
    const lues = await interrogerBase<LigneRubrique>(
      `rubriques_enrichissement?select=${COLONNES_RUBRIQUE}&order=rang.asc`,
      { egal: { enrichissement_id: String(ligne.id) } },
    );
    // ⚠️ Une lecture de rubriques ratée ne fait PAS échouer la lecture entière.
    // L'ancrage typé, lui, est déjà là : mieux vaut une fiche sans ses
    // paragraphes qu'un écran qui annonce « état illisible » alors que
    // l'essentiel — qui est cette entreprise, et avec quelle certitude — a bien
    // été lu.
    if (lues.ok) rubriques = lues.lignes;
  }

  const dernier = enObjet(ligne, rubriques);
  if (dernier === null) {
    return { ok: false, explication: "État d'enrichissement illisible." };
  }

  return {
    ok: true,
    dernier,
    etapes: etapes.lignes.map((e) => ({
      rang: e.rang,
      libelle: e.libelle,
      ecriteA: e.ecrite_a,
      // ⚠️ `?? null` et non `e.url` tout court — mais **pas pour la raison que
      // ce commentaire donnait avant la revue du 31 août 2026.** Il invoquait
      // les étapes antérieures à la migration 11, en affirmant que PostgREST
      // rendrait `undefined` pour elles : c'est faux, et le raisonnement était
      // même impossible. Soit la colonne existe, et les anciennes lignes valent
      // `null` comme n'importe quelle colonne ajoutée sans défaut ; soit elle
      // n'existe pas, et c'est la requête ENTIÈRE qui échoue en 400 — il n'y a
      // pas d'état intermédiaire où une ligne arriverait sans son champ.
      //
      // La vraie raison est plus modeste et suffit : `LigneEtape` décrit ce
      // qu'on ESPÈRE recevoir, pas ce qui arrive. Le type promet
      // `string | null` au reste de l'application, et cette normalisation est
      // le seul endroit qui le garantisse.
      url: e.url ?? null,
    })),
  };
}

export type EtatEnveloppe = {
  consommes: number;
  /**
   * La part de `consommes` qui a été RÉELLEMENT facturée.
   *
   * ⚠️ **`consommes` n'est pas une dépense, c'est une dépense plus une
   * réservation.** Un enrichissement en vol immobilise `COUT_PRESUME_TOKENS`
   * avant d'avoir dépensé quoi que ce soit — sans quoi dix lancés dans la même
   * minute liraient tous « 0 consommé ». La garde doit regarder `consommes` ;
   * la jauge, elle, montre les deux parts, sinon elle bondit de 50 % au clic
   * pour redescendre à la conclusion.
   */
  reels: number;
  /** Ce que les enrichissements en vol immobilisent, non encore dépensé. */
  reserves: number;
  plafond: number;
  reste: number;
  depassee: boolean;
  /**
   * A-t-on pu lire ce qui a été consommé ?
   *
   * ⚠️ **Distinct de `depassee`, et l'amalgame produisait un message FAUX.**
   * Relevé en revue le 30 août 2026 : sur un aléa réseau de 20 ms — mesuré à
   * 0,2 % des requêtes sur ce projet — l'écran annonçait « L'enveloppe
   * quotidienne de tokens est consommée. Elle repart de zéro à minuit »,
   * explication catégorique et entièrement inventée. Même distinction que
   * `veille.ts` fait entre « aucune veille » et « état indisponible » : ne pas
   * savoir n'est pas savoir que non.
   */
  connue: boolean;
};



/**
 * Combien de tokens les enrichissements ont consommé depuis minuit à Paris.
 *
 * Entre : l'heure de référence.
 * Sort : le compte, le plafond, et si la journée est fermée.
 * Casse : ne lève pas. ⚠️ **Une base injoignable rend l'enveloppe DÉPASSÉE**,
 * pas vide : ne pas savoir ce qu'on a dépensé n'autorise pas à dépenser. Le
 * défaut penche du côté qui ne coûte rien.
 *
 * ⚠️ **On SOMME les traces, on ne lit pas un compteur.** Le critère du plan est
 * explicite, et la raison est qu'un compteur séparé divergerait à la première
 * écriture ratée sans que rien ne le rattrape. Une somme ne peut mentir que sur
 * ce qui n'a pas été écrit.
 *
 * ⚠️ **`gte.` figure dans le CHEMIN, et c'est admis ici alors que la règle du
 * projet l'interdit** — parce que la valeur concaténée n'est pas étrangère :
 * elle est calculée par `debutDuJourParisien()` à partir de l'heure du serveur.
 * `options.egal` ne sait produire que `=eq.`, et un « depuis minuit » ne
 * s'exprime pas en égalité. Elle est encodée quand même : le jour où quelqu'un
 * y fera passer un paramètre reçu, l'encodage sera déjà là.
 */
export async function lireEnveloppeDuJour(maintenant: Date): Promise<EtatEnveloppe> {
  const depuis = encodeURIComponent(debutDuJourParisien(maintenant).toISOString());

  const resultat = await interrogerBase<LigneConsommation>(
    `enrichissements?select=${COLONNES_TOKENS},issue,demande_a&demande_a=gte.${depuis}`,
  );

  if (!resultat.ok) {
    console.error(`[enveloppe] lecture impossible — ${resultat.explication}`);
    // On refuse quand même de lancer : ne pas savoir ce qu'on a dépensé
    // n'autorise pas à dépenser. Mais `connue: false` empêche l'écran
    // d'affirmer que le plafond est atteint.
    return {
      consommes: 0,
      reels: 0,
      reserves: 0,
      plafond: ENVELOPPE_QUOTIDIENNE_TOKENS,
      reste: 0,
      depassee: true,
      connue: false,
    };
  }

  // ⚠️ **`?? 0` sur chaque colonne** : les compteurs sont `NULL` tant qu'un
  // enrichissement n'a pas conclu. `null + 3` vaut 3 en JavaScript, mais
  // `undefined + 3` vaut `NaN` — et un `NaN` comparé à un plafond est toujours
  // faux, ce qui ouvrirait l'enveloppe en grand sans le moindre message.
  // ⚠️ **Le calcul vit dans `lib/enrichissement.ts`, pas ici.** Il est pur,
  // donc éprouvé par `enrichissement.test.ts` — y compris le cas qu'aucune
  // manipulation à la main ne reproduit facilement : dix enrichissements
  // lancés en vol dans la même minute.
  // ⚠️ **`detaillerConsommation` et non `calculerConsommation`** : la garde a
  // besoin du total, la jauge des deux parts, et les deux doivent venir du
  // MÊME parcours des lignes. Sommer deux fois séparément, c'est accepter que
  // ce que l'écran montre et ce que la garde refuse divergent un jour.
  const { reels, reserves, total } = detaillerConsommation(
    resultat.lignes,
    maintenant,
  );

  return {
    consommes: total,
    reels,
    reserves,
    plafond: ENVELOPPE_QUOTIDIENNE_TOKENS,
    reste: Math.max(0, ENVELOPPE_QUOTIDIENNE_TOKENS - total),
    depassee: total >= ENVELOPPE_QUOTIDIENNE_TOKENS,
    connue: true,
  };
}

/**
 * Refermer une tentative morte en vol.
 *
 * Entre : l'identifiant de la tentative et son motif.
 * Sort : `true` si la base a bien enregistré la clôture.
 * Casse : ne lève pas ; un échec est journalisé et rendu en `false`.
 *
 * ⚠️ **C'est ce qui empêche une offre de se bloquer pour toujours.** Voir
 * `PEREMPTION_MINUTES`. L'affichage, lui, n'attend pas cette écriture : il
 * décide seul qu'une ligne trop vieille est morte. Les deux sont nécessaires —
 * l'affichage pour que l'écran dise la vérité tout de suite, l'écriture pour
 * que l'index libère l'offre et autorise une relance.
 */
export async function refermerTentative(
  id: number,
  motif: string,
  /**
   * Quand la tentative a été ouverte, si on le sait.
   *
   * ⚠️ **Ceinture en plus de la bretelle**, et elle protège le pire cas : une
   * clôture refusée laisse l'offre bloquée jusqu'à la péremption. `demande_a`
   * et `termine_a` viennent désormais de la même horloge, donc la dérive ne
   * devrait plus mordre — mais elle mordrait de nouveau le jour où une écriture
   * repasserait par le `default now()` de la base, et rien ne le signalerait
   * avant qu'une offre ne se retrouve coincée.
   */
  pasAvant?: string,
): Promise<boolean> {
  const maintenant = new Date();
  const ouverture = pasAvant ? new Date(pasAvant) : null;
  const fin =
    ouverture && !Number.isNaN(ouverture.getTime()) && ouverture > maintenant
      ? ouverture
      : maintenant;

  const resultat = await ecrireDansBase("enrichissements", {
    valeurs: {
      issue: "echec",
      motif_echec: motif,
      termine_a: fin.toISOString(),
    },
    egal: { id: String(id) },
    // ⚠️ **La clôture ne s'applique QUE si la tentative est encore en vol** —
    // symétrique du `&issue=in.(…)` que le pipeline Python applique à toutes
    // ses écritures. Relevé en revue le 30 août 2026 : entre le moment où
    // l'interface juge une tentative périmée et celui où elle la referme,
    // l'agent peut conclure en réussite. Sans ce filtre, la clôture écrasait
    // une fiche aboutie — avec ses compteurs de tokens — par un « interrompu »,
    // et l'enrichissement disparaissait de l'écran après avoir réussi.
    filtreConstant: "issue=in.(demande,en_cours)",
  });

  if (!resultat.ok) {
    // `introuvable` signifie ici « aucune ligne EN VOL portant cet identifiant »
    // — donc quelqu'un d'autre l'a déjà conclue. Ce n'est pas une panne.
    if (resultat.motif === "introuvable") {
      console.warn(`[enrichissement] ${id} déjà conclu ailleurs, clôture sans objet`);
      return false;
    }
    console.error(`[enrichissement] clôture impossible sur ${id} — ${resultat.motif}`);
    return false;
  }
  return true;
}

export type OuvertureDemande =
  | { ok: true; id: number; demandeA: string }
  | {
      ok: false;
      motif: "conflit" | "introuvable" | "refusee" | "injoignable";
      explication: string;
    };

/**
 * Ouvrir une demande d'enrichissement, et écrire sa première étape.
 *
 * Entre : un identifiant d'offre déjà validé par l'appelant.
 * Sort : l'identifiant de la tentative créée.
 * Casse : ne lève jamais. Un `conflit` signifie qu'un enrichissement est déjà
 * en vol sur cette offre — c'est la garde d'US-35, appliquée par l'index.
 *
 * ⚠️ **La première étape est écrite ICI, par le serveur, pas par l'agent.** Le
 * critère de succès n° 4 exige qu'elle apparaisse en moins d'une seconde ;
 * l'agent, lui, met 30 à 60 secondes rien qu'à obtenir une machine chez GitHub.
 * Sans cette étape, l'écran resterait vide pendant une minute après le clic, et
 * personne ne saurait si quelque chose est parti.
 *
 * ⚠️ **Son échec ne fait PAS échouer la demande.** L'enrichissement est ouvert,
 * le workflow va partir : renoncer parce qu'une ligne d'affichage n'a pas pu
 * s'écrire serait perdre le travail utile pour un défaut cosmétique.
 *
 * ⚠️ **`demande_a` est posé ICI, alors que la colonne a un `default now()` —
 * et c'est un CORRECTIF, mesuré le 30 août 2026.** La valeur par défaut vient
 * de l'horloge de Supabase ; `termine_a` vient de celle du serveur Next. Or
 * quand le lancement du workflow échoue immédiatement — jeton absent, aucun
 * appel réseau —, la clôture s'écrit quelques millisecondes après l'ouverture.
 * **Mesure : Supabase est en avance de 184 ms sur la machine de
 * développement**, si bien que `termine_a` tombait AVANT `demande_a` et que la
 * contrainte `termine_apres_demande` refusait la clôture. L'offre restait alors
 * bloquée dix minutes derrière un enrichissement dont on savait déjà que rien
 * ne viendrait le servir.
 *
 * **La leçon dépasse le cas : deux horodatages comparés par une contrainte
 * doivent venir de la MÊME horloge.** Ici les deux viennent désormais du
 * serveur Next. `demarre_a` et le `termine_a` du pipeline viennent, eux, du
 * runner GitHub — mais il s'écoule 30 à 60 secondes avant qu'ils ne s'écrivent,
 * ce qui absorbe très largement la dérive entre deux serveurs synchronisés.
 */
export async function ouvrirDemande(identifiant: string): Promise<OuvertureDemande> {
  const demandeA = new Date().toISOString();
  const cree = await insererDansBase<{ id: number }>("enrichissements", {
    valeurs: { offre_identifiant: identifiant.toUpperCase(), demande_a: demandeA },
    renvoyer: "id",
  });

  if (!cree.ok) {
    if (cree.motif === "conflit") {
      return {
        ok: false,
        motif: "conflit",
        explication: "Un enrichissement est déjà en cours sur cette offre.",
      };
    }
    // ⚠️ `introuvable` vient d'une clé étrangère violée — l'offre n'existe pas.
    // PostgREST le rend en 409 comme le conflit d'unicité ; c'est le code
    // Postgres qui les sépare, dans `insererDansBase`.
    if (cree.motif === "introuvable") {
      return {
        ok: false,
        motif: "introuvable",
        explication: "Cette offre n'existe pas.",
      };
    }
    return {
      ok: false,
      motif: cree.motif === "refusee" ? "refusee" : "injoignable",
      explication: cree.explication,
    };
  }

  const etape = await insererDansBase<{ id: number }>("etapes_enrichissement", {
    valeurs: { enrichissement_id: cree.ligne.id, rang: 0, libelle: "Demande reçue" },
    renvoyer: "id",
  });
  if (!etape.ok) {
    console.error(
      `[enrichissement] première étape non écrite sur ${cree.ligne.id} — ${etape.motif}`,
    );
  }

  return { ok: true, id: cree.ligne.id, demandeA };
}

/**
 * Le motif écrit en base quand une tentative est refermée pour péremption.
 * Repris de `lib/enrichissement.ts` pour que l'écran affiche la même phrase,
 * qu'elle vienne du calcul ou de la colonne.
 */
export const MOTIF_PEREMPTION = MOTIF_INTERROMPU;

/** Réexporté pour que l'action serveur n'ait pas à connaître deux modules. */
export { estPerime };
