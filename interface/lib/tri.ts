/**
 * Le classement de la liste `/offres` : ses trois valeurs, leurs libellés, sa
 * validation.
 *
 * Entre : rien, ou une chaîne venue de l'adresse pour `estTri`.
 * Sort : des constantes, et un verdict de validité.
 * Casse : rien à l'exécution.
 *
 * ⚠️ **Ce fichier n'a PAS `import "server-only"`, et c'est toute sa raison
 * d'être** — le même moule que `statuts.ts` et `notes.ts` (règle 3 du
 * `CLAUDE.md`). Le menu déroulant qui change le classement est un composant
 * client : il lui faut la liste des tris et leurs libellés. S'il allait les
 * chercher dans `lib/offres.ts`, il tirerait `lib/supabase.ts` — donc la clé
 * secrète — dans le graphe du navigateur.
 *
 * ⚠️ **Ce qui reste dans `lib/offres.ts` et ne doit JAMAIS descendre ici : la
 * chaîne de classement SQL.** Ce fichier ne porte que des identifiants et du
 * français ; la traduction vers `note_interet.desc.nullslast,…` est une affaire
 * de serveur. C'est aussi ce qui garantit qu'une valeur venue de l'adresse ne
 * peut pas atteindre la requête : elle est comparée à cette liste, puis sert de
 * CLÉ dans une table de chaînes constantes — jamais concaténée.
 */

/**
 * ⚠️ **Sans accent, parce que ces chaînes voyagent dans l'adresse.**
 * `/offres?tri=accessibilite` se met en favori et se lit ; `?tri=accessibilité`
 * s'écrirait `%C3%A9`. Le libellé français s'affiche à l'écran, il ne circule
 * pas.
 *
 * ⚠️ **« recentes » nomme la DATE DE PUBLICATION, pas la date de collecte.**
 * Les deux diffèrent : une nuit de cron sautée fait collecter 48 h d'offres
 * d'un coup, qui n'ont pas été publiées le même jour. C'est la publication qui
 * intéresse le candidat — une annonce parue il y a trois jours a déjà reçu des
 * candidatures, quelle que soit l'heure à laquelle on l'a récupérée.
 */
export const TRIS = ["interet", "accessibilite", "recentes"] as const;

export type Tri = (typeof TRIS)[number];

/**
 * Le classement quand l'adresse ne dit rien.
 *
 * ⚠️ **C'est celui de la phase 2 et il ne change pas** : l'intérêt décroissant
 * est ce qui fait de l'écran un instrument de décision. Les deux autres tris
 * sont des angles de lecture ponctuels, pas des candidats au défaut.
 */
export const TRI_PAR_DEFAUT: Tri = "interet";

/** Ce qui s'affiche dans le menu. Accentué, en français, jamais stocké. */
export const LIBELLES_TRI: Record<Tri, string> = {
  interet: "Intérêt",
  accessibilite: "Accessibilité",
  recentes: "Plus récentes",
};

/**
 * Une phrase entière, pour le lecteur d'écran et l'infobulle du déclencheur.
 *
 * ⚠️ **Le libellé court ne suffit pas hors du menu.** « Intérêt » posé seul sur
 * un bouton ne dit pas ce que le bouton fait ; annoncé par un lecteur d'écran,
 * il ne dit même pas qu'il s'agit d'un ordre de tri.
 */
export const DESCRIPTIONS_TRI: Record<Tri, string> = {
  interet: "Note d'intérêt, de la plus haute à la plus basse",
  accessibilite: "Note d'accessibilité, de la plus haute à la plus basse",
  recentes: "Date de publication, de la plus récente à la plus ancienne",
};

/**
 * Est-ce que cette chaîne est un classement connu ?
 *
 * Entre : n'importe quoi — typiquement `?tri=` dans l'adresse, que
 * l'utilisateur peut écrire à la main.
 * Sort : `true` **et** la garantie pour TypeScript qu'il s'agit d'un `Tri`.
 * Casse : rien. `undefined`, `null` et les tableaux rendent `false`.
 */
export function estTri(valeur: unknown): valeur is Tri {
  return typeof valeur === "string" && (TRIS as readonly string[]).includes(valeur);
}
