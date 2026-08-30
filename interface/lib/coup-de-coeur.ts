/**
 * Le coup de cœur : son libellé, et la lecture de son état.
 *
 * Entre : rien, ou la date lue en base pour `aCoupDeCoeur`.
 * Sort : des constantes, et un verdict.
 * Casse : rien à l'exécution.
 *
 * ⚠️ **Pas de `server-only` ici, comme `statuts.ts`, `notes.ts`,
 * `francais.ts`, `filtres.ts`, `tri.ts`, `theme.ts` et `employeur.ts`**
 * (règle 3 du `CLAUDE.md`) : le bouton en forme de cœur est un composant
 * client, et il a besoin du même libellé que le serveur. S'il allait le
 * chercher dans `lib/offres.ts`, il tirerait `lib/supabase.ts` — donc la clé
 * secrète — dans le graphe du navigateur. Ce fichier ne contient que des
 * constantes et une fonction pure, jamais de code qui lit un secret.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ Le coup de cœur N'EST PAS UN STATUT, et c'est la seule chose à retenir
 * ---------------------------------------------------------------------------
 *
 * Décision de Maxime, 30 août 2026. La forme évidente — une quatrième valeur
 * dans `STATUTS`, à côté de `a_traiter`, `candidate` et `ecarte` — a été
 * écartée parce qu'un statut est **exclusif** et que ça produit deux effets
 * qu'on ne veut ni l'un ni l'autre :
 *
 *   1. Une offre likée cesserait d'être « à traiter », donc **quitterait
 *      l'écran du matin** — qui ne montre que `a_traiter`.
 *   2. Candidater **effacerait le cœur**, et la liste des coups de cœur se
 *      viderait à mesure que Maxime avance.
 *
 * Il est donc **transverse aux statuts** : une offre peut être « à traiter +
 * coup de cœur », puis « candidaté + coup de cœur ». C'est exactement la forme
 * de l'onglet « Nouveau » — voir `filtres.ts` —, et comme lui, **son compte ne
 * s'additionne pas** avec ceux des trois statuts.
 *
 * ⚠️ **En base, une seule colonne : `coup_de_coeur_a`, un `timestamptz`.**
 * `NULL` = pas de coup de cœur, une date = coup de cœur posé à cette date. Le
 * couple booléen + date aurait ouvert un état incohérent (`true` sans date)
 * qu'aucune contrainte simple ne ferme ; ici la forme rend l'incohérence
 * inexprimable.
 */

/**
 * Ce qui s'affiche à l'écran — sur la pilule de filtre comme sur le bouton.
 *
 * ⚠️ **« Coup de cœur », jamais « like » ni « favori ».** Le projet a déjà payé
 * ce genre de flottement (« enrichissement », jamais « enquête ») : deux mots
 * pour la même chose finissent en deux colonnes et deux fonctions. C'est aussi
 * le mot que Maxime emploie.
 */
export const LIBELLE_COUP_DE_COEUR = "Coup de cœur";

/**
 * L'INFOBULLE du bouton quand le cœur est déjà posé — donc ce qu'un clic ferait.
 *
 * ⚠️ **C'est un `title`, jamais le nom accessible du bouton.** Le réflexe est
 * de le mettre en `aria-label` pour que le lecteur d'écran annonce l'action.
 * Ce serait un défaut : sur la fiche, le libellé « Coup de cœur » est **visible
 * à l'écran**, et WCAG 2.5.3 (« Label in Name ») exige que le nom accessible
 * contienne le texte visible — sans quoi une commande vocale « clique sur Coup
 * de cœur » ne trouve plus le bouton.
 *
 * La répartition est donc : le **nom** ne bouge pas (`LIBELLE_COUP_DE_COEUR`),
 * l'**état** est porté par `aria-pressed`, et l'**action** par cette infobulle.
 */
export const LIBELLE_RETIRER_COUP_DE_COEUR = "Retirer le coup de cœur";

/**
 * Cette offre porte-t-elle un coup de cœur ?
 *
 * Entre : le contenu de la colonne `coup_de_coeur_a`, tel qu'il sort de la base.
 * Sort : `true` dès qu'une date est présente.
 * Casse : rien. `null` et `undefined` rendent `false`.
 *
 * ⚠️ **Cette fonction existe pour qu'il n'y ait qu'UNE lecture de la colonne.**
 * `offre.coup_de_coeur_a !== null` recopié dans cinq composants finirait par
 * diverger le jour où la colonne changerait de forme — et surtout, un
 * `!offre.coup_de_coeur_a` écrit à la va-vite traiterait la chaîne vide comme
 * une absence, ce que la base n'a jamais promis.
 */
export function aCoupDeCoeur(date: string | null | undefined): boolean {
  return typeof date === "string" && date.length > 0;
}
