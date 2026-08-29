/**
 * Le thème de l'interface : ses trois choix, leurs libellés, sa clé de
 * stockage.
 *
 * Entre : rien.
 * Sort : des constantes partagées par le script du `<head>` et le bouton de
 * bascule.
 * Casse : rien à l'exécution.
 *
 * ⚠️ **Pas de `server-only` ici, comme `statuts.ts`, `notes.ts`, `francais.ts`
 * et `tri.ts`** (règle 3 du `CLAUDE.md`) : le bouton de bascule est un
 * composant client. Ce fichier ne contient que des constantes et une fonction
 * pure — jamais de code qui lit un secret.
 *
 * ⚠️ **Le choix est stocké dans le NAVIGATEUR, pas en base ni dans un cookie.**
 * C'est une préférence d'affichage, elle n'a aucune raison de voyager vers le
 * serveur à chaque requête ni d'occuper une colonne. Conséquence assumée : le
 * choix ne suit pas d'un appareil à l'autre, et un navigateur qui refuse le
 * stockage retombe sur « Système ».
 */

/** La clé dans `localStorage`. Préfixée : le domaine peut en porter d'autres. */
export const CLE_THEME = "veille-theme";

/**
 * ⚠️ **L'ordre EST celui du cycle du bouton** — un clic passe au suivant, et le
 * dernier revient au premier. « Système » est en tête parce que c'est l'état de
 * départ, celui qu'on avait avant ce bouton : on peut donc toujours y revenir
 * en cliquant deux fois de plus, ce qu'une bascule à deux états interdirait.
 */
export const CHOIX_THEME = ["systeme", "clair", "sombre"] as const;

export type ChoixTheme = (typeof CHOIX_THEME)[number];

export const CHOIX_THEME_PAR_DEFAUT: ChoixTheme = "systeme";

/** Ce que l'infobulle et le lecteur d'écran annoncent. */
export const LIBELLES_THEME: Record<ChoixTheme, string> = {
  systeme: "Thème du système",
  clair: "Thème clair",
  sombre: "Thème sombre",
};

export function estChoixTheme(valeur: unknown): valeur is ChoixTheme {
  return (
    typeof valeur === "string" &&
    (CHOIX_THEME as readonly string[]).includes(valeur)
  );
}
