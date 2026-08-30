/**
 * Ce que la liste `/offres` peut montrer : les six filtres, leurs libellés,
 * leur validation.
 *
 * Entre : rien, ou une chaîne venue de l'adresse pour `estFiltre`.
 * Sort : des constantes, et un verdict de validité.
 * Casse : rien à l'exécution.
 *
 * ⚠️ **Pas de `server-only` ici, comme `statuts.ts`, `notes.ts`, `francais.ts`,
 * `tri.ts`, `theme.ts`, `employeur.ts` et `coup-de-coeur.ts`** (règle 3 du
 * `CLAUDE.md`).
 *
 * ⚠️ **Ce fichier est né d'une revue, le 29 août 2026, et le défaut qu'il
 * répare était dormant.** `FiltreListe` et `FILTRE_PAR_DEFAUT` vivaient dans
 * `lib/offres.ts`, qui porte `server-only`. `adresse.ts` — une fonction pure,
 * posée à côté de composants clients — allait donc chercher une simple
 * constante dans un module qui tire `lib/supabase.ts`, donc la clé secrète.
 * Rien ne cassait tant qu'aucun composant client ne l'importait ; le premier à
 * le faire, geste évident pour construire un lien côté navigateur, serait tombé
 * sur une erreur `server-only` incompréhensible dans un fichier qui ne lit aucun
 * secret. `TRI_PAR_DEFAUT` avait eu le bon traitement, pas celui-ci.
 */

// ⚠️ `STATUTS` n'est PAS importé : le garde-fou ci-dessous travaille sur le
// TYPE `Statut`, pas sur la constante. L'importer « pour faire bonne mesure »
// laissait un import mort dans le fichier dont l'hygiène d'import est justement
// la raison d'être — relevé en revue le 29 août 2026.
import { LIBELLE_COUP_DE_COEUR } from "./coup-de-coeur";
import { LIBELLES_STATUT, type Statut } from "./statuts";

/**
 * Ce que la liste peut montrer : un statut, tout, la dernière collecte, ou les
 * coups de cœur.
 *
 * ⚠️ **Ni `"toutes"`, ni `"nouvelles"`, ni `"coup_de_coeur"` ne sont des
 * statuts**, et c'est pour ça qu'ils vivent ici et non dans `STATUTS`. Les y
 * mettre les rendrait écrivables dans la colonne `statut` — or aucune offre
 * n'est « toutes ». Ce sont des modes d'affichage, ils n'appartiennent qu'à cet
 * écran.
 *
 * ⚠️ **`"nouvelles"` et `"coup_de_coeur"` sont TRANSVERSES aux trois statuts,
 * et c'est ce qui les rend différents des autres onglets.** Le premier montre
 * les offres de la dernière collecte réussie *quel que soit* leur statut : une
 * offre arrivée cette nuit et déjà écartée y figure encore. Le second montre
 * les offres likées, y compris celles auxquelles Maxime a déjà candidaté — c'est
 * même tout l'intérêt de la décision du 30 août 2026, expliquée dans
 * `coup-de-coeur.ts`. Deux conséquences à connaître :
 *
 * 1. Leurs comptes **ne s'additionnent pas** avec ceux des statuts (voir les
 *    champs `nouvelles` et `coupsDeCoeur` de `ResultatListe`).
 * 2. `"nouvelles"` est un filtre qui **change de contenu tout seul**, chaque
 *    nuit. Mis en favori, il ne ramène pas les mêmes offres demain — au
 *    contraire de `?statut=candidate` ou de `?statut=coup_de_coeur`, qui
 *    désignent des ensembles que seul un geste de Maxime fait bouger.
 *
 * ⚠️ **Le paramètre d'adresse reste `?statut=`**, alors qu'il porte désormais
 * trois valeurs qui n'en sont pas. Le renommer casserait les favoris existants
 * pour un gain de vocabulaire ; l'écran, lui, ne parle jamais de « statut ».
 */
export type FiltreListe = Statut | "toutes" | "nouvelles" | "coup_de_coeur";

/**
 * Le filtre par défaut, quand l'adresse ne dit rien.
 *
 * ⚠️ **« À traiter » et non « toutes », et ce n'est pas un détail de
 * commodité.** L'écran devient un plan de travail : ce qui reste à faire. Une
 * offre triée disparaît, ce qui est exactement le geste que la phase 4 existe
 * pour offrir. ⚠️ **Effet de bord à connaître** : ça desserre le plafond de 200
 * sans le résoudre — tant qu'aucune offre n'est triée, les 567 restent « à
 * traiter » et la troncature mord pareil.
 */
export const FILTRE_PAR_DEFAUT: FiltreListe = "a_traiter";

/**
 * L'ordre d'affichage des onglets, et la seule liste qui en fasse foi.
 *
 * ⚠️ **« Nouveau » se glisse en DEUXIÈME, juste après le défaut**, et ce n'est
 * pas alphabétique : les deux premiers onglets sont ceux d'un matin — ce qui
 * reste à faire, ce qui vient d'arriver. Candidaté et Écarté sont des
 * consultations, elles viennent après.
 *
 * ⚠️ **« Coup de cœur » se pose en TROISIÈME, entre les deux groupes**, et sa
 * place dit ce qu'il est : ni tout à fait le matin (il ne change pas tout seul
 * dans la nuit), ni tout à fait une consultation d'archive (c'est la liste qu'on
 * rouvre en cours de journée pour décider où postuler). Le mettre en dernier,
 * après « Toutes », l'aurait rendu invisible — or c'est le seul onglet dont le
 * contenu est entièrement choisi à la main.
 */
export const FILTRES = [
  "a_traiter",
  "nouvelles",
  "coup_de_coeur",
  "candidate",
  "ecarte",
  "toutes",
] as const;

/**
 * ⚠️ **Garde-fou de COMPILATION : tout statut doit avoir son onglet.**
 * Un statut ajouté à `STATUTS` sans être ajouté ci-dessus n'aurait aucun filtre,
 * et son compte serait invisible à l'écran — sans la moindre erreur. Les
 * crochets rendent la comparaison non distributive : sans eux, l'union se
 * testerait membre par membre et un `never` isolé disparaîtrait dans le
 * résultat, ce qui laisserait passer le cas qu'on veut attraper.
 *
 * Il remplace un `throw` posé au rendu : une vérification qui échoue à la
 * compilation vaut mieux qu'une qui attend qu'on ouvre la page.
 */
type ChaqueStatutEstUnFiltre = [Statut] extends [(typeof FILTRES)[number]]
  ? true
  : never;
const _controleDesFiltres: ChaqueStatutEstUnFiltre = true;
void _controleDesFiltres;

/** Ce qui s'affiche sur chaque onglet. Accentué, jamais stocké. */
export const LIBELLES_FILTRE: Record<FiltreListe, string> = {
  ...LIBELLES_STATUT,
  /**
   * ⚠️ **« Nouveau » au SINGULIER**, comme la bulle de chaque ligne, alors que
   * l'onglet en compte plusieurs. Deux mots différents pour la même chose
   * donneraient à croire à deux notions.
   */
  nouvelles: "Nouveau",
  /**
   * ⚠️ **Le libellé vient de `coup-de-coeur.ts`, il n'est pas recopié ici.**
   * Le même texte s'affiche sur la pilule de filtre et sur le bouton de la
   * ligne, qui est un composant client : deux copies auraient fini par
   * diverger, et l'écran aurait nommé « Coup de cœur » ce que le bouton
   * appelait autrement.
   */
  coup_de_coeur: LIBELLE_COUP_DE_COEUR,
  toutes: "Toutes",
};

/**
 * Est-ce que cette chaîne est un filtre connu ?
 *
 * Entre : n'importe quoi — typiquement `?statut=` dans l'adresse.
 * Sort : `true` **et** la garantie pour TypeScript qu'il s'agit d'un
 * `FiltreListe`.
 * Casse : rien. `undefined`, `null` et les tableaux rendent `false`.
 *
 * ⚠️ **Il accepte `"toutes"`, `"nouvelles"` et `"coup_de_coeur"`, que
 * `estStatut()` refuse à raison** — aucune offre ne peut porter ces valeurs
 * dans sa colonne `statut`. Les deux validations existent donc pour deux
 * frontières différentes : celle de l'écran et celle de la table.
 */
export function estFiltre(valeur: unknown): valeur is FiltreListe {
  return (
    typeof valeur === "string" && (FILTRES as readonly string[]).includes(valeur)
  );
}
