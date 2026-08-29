/**
 * Le résolveur d'imports pour les tests exécutés directement par Node.
 *
 * Entre : un spécificateur d'import, tel qu'écrit dans le code.
 * Sort : le fichier réel à charger.
 * Casse : rien — tout ce qu'il ne reconnaît pas repart au résolveur d'origine.
 *
 * ⚠️ **Il existe parce que Node et le compilateur de Next ne résolvent pas les
 * imports de la même façon**, et que les tests doivent charger **les vrais
 * modules du projet**, pas des copies. Deux écarts à combler :
 *
 * 1. `@/lib/veille` — l'alias du projet, déclaré dans `tsconfig.json`. Node ne
 *    lit pas ce fichier et ne connaît donc pas cet alias.
 * 2. `./supabase` — un import relatif **sans extension**. TypeScript l'accepte,
 *    Node exige `./supabase.ts`.
 *
 * ⚠️ **Recopier les modules dans le dossier de test pour contourner ça serait
 * pire que de ne pas tester** : la copie prend du retard sur l'original au
 * premier changement, et les tests continuent de passer sur du code qui n'est
 * plus en production. Le contournement doit porter sur la *résolution*, jamais
 * sur le contenu.
 *
 * ⚠️ **`server-only` n'est pas traité ici, il l'est par un drapeau.** Les tests
 * tournent avec `--conditions=react-server`, ce qui fait charger à ce paquet son
 * `empty.js` au lieu du garde-fou qui lève. C'est sémantiquement juste : on
 * éprouve du code serveur, on se déclare donc en contexte serveur.
 */

import { existsSync } from "node:fs";
import { dirname, resolve as resoudreChemin } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));

export function resolve(specificateur, contexte, suivant) {
  // 1. L'alias `@/` du projet, qui pointe sur la racine de `interface/`.
  if (specificateur.startsWith("@/")) {
    const chemin = resoudreChemin(RACINE, specificateur.slice(2));
    return suivant(urlAvecExtension(chemin), contexte);
  }

  // 2. Les imports relatifs sans extension, dans nos propres fichiers.
  if (specificateur.startsWith(".") && contexte.parentURL?.startsWith("file:")) {
    const chemin = resoudreChemin(
      dirname(fileURLToPath(contexte.parentURL)),
      specificateur,
    );
    const avecExtension = urlAvecExtension(chemin);
    if (avecExtension !== null) return suivant(avecExtension, contexte);
  }

  // Tout le reste — paquets npm, modules internes de Node — suit son cours.
  return suivant(specificateur, contexte);
}

/**
 * Ajoute `.ts` (ou `.tsx`) à un chemin qui en manque.
 *
 * Rend `null` si aucun fichier ne correspond, pour que l'appelant laisse le
 * résolveur d'origine produire sa propre erreur — plus parlante que la nôtre.
 */
function urlAvecExtension(chemin) {
  if (existsSync(chemin)) return pathToFileURL(chemin).href;

  for (const extension of [".ts", ".tsx", ".mjs", ".js"]) {
    if (existsSync(chemin + extension)) {
      return pathToFileURL(chemin + extension).href;
    }
  }
  return null;
}
