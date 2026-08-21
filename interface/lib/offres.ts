import "server-only";

import { type MotifEchec, interrogerBase } from "@/lib/supabase";

/**
 * La lecture des offres pour l'écran `/offres`.
 *
 * Entre : rien, pour l'instant — la phase 4 ajoutera le filtre de statut.
 * Sort : les offres les plus récemment publiées, le total collecté, et
 * l'identifiant de la dernière exécution réussie (pour le marqueur « Nouveau »).
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
  publiee_a: string;
  execution_id: number;
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
 */
const COLONNES_LISTE = [
  "identifiant",
  "intitule",
  "entreprise_nom",
  "lieu_libelle",
  "type_contrat_libelle",
  "salaire_libelle",
  "publiee_a",
  "execution_id",
].join(",");

/**
 * Le plafond d'affichage.
 *
 * La base grossit d'environ 25 offres par jour une fois le cron allumé : sans
 * borne, la page finirait par construire des milliers de nœuds dans le
 * navigateur. C'est **le coût de rendu** qui motive cette limite, pas le poids
 * transféré : mesuré le 21 août sur les 189 offres réelles, le document fait
 * 258 Ko bruts mais **11 Ko une fois compressé** — une liste répétitive se
 * comprime 23 fois, et l'hébergeur compresse toujours.
 *
 * Le total réel reste affiché à côté, pour que la troncature se voie au lieu de
 * se deviner. Les filtres de la phase 4 rendront cette limite bien moins
 * gênante qu'elle n'en a l'air.
 */
export const PLAFOND_AFFICHAGE = 200;

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
    }
  | { ok: false; motif: MotifEchec; explication: string };

/**
 * L'identifiant de la dernière exécution réussie.
 *
 * ⚠️ `issue=eq.reussite` et pas « la dernière ligne » : une exécution restée
 * `en_cours` est une collecte tuée en plein vol, et une `echec` n'a rien
 * ramené de fiable. Marquer « Nouveau » d'après elles mentirait à l'écran.
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
    "executions_veille?select=id&issue=eq.reussite&order=demarree_a.desc&limit=1",
  );

  return resultat.ok ? (resultat.lignes[0]?.id ?? null) : null;
}

export async function listerOffres(): Promise<ResultatListe> {
  // ⚠️ Second critère de tri sur l'identifiant : `publiee_a` porte souvent la
  // même valeur pour des dizaines d'offres publiées le même jour, et Postgres
  // ne garantit alors aucun ordre. Sans ce départage, deux chargements de la
  // même page peuvent classer les ex æquo différemment.
  const requeteOffres = interrogerBase<OffreEnListe>(
    `offres?select=${COLONNES_LISTE}` +
      `&order=publiee_a.desc,identifiant.asc&limit=${PLAFOND_AFFICHAGE}`,
    { compter: true },
  );

  // Les deux requêtes partent ensemble : enchaînées, elles doubleraient
  // l'attente avant le premier pixel pour aucune raison — la seconde ne dépend
  // pas de la première.
  const [offres, derniereExecution] = await Promise.all([
    requeteOffres,
    lireDerniereExecution(),
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
    derniereExecution,
  };
}
