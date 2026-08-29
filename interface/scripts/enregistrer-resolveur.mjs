/**
 * Installe `resolveur-ts.mjs` dans le chargeur de modules de Node.
 *
 * Un hook de résolution tourne dans un fil séparé du code testé : il ne suffit
 * pas de l'importer, il faut l'enregistrer. C'est ce que fait `register()`, et
 * c'est pourquoi ce fichier existe à côté du résolveur plutôt que dedans.
 *
 * Passé à Node par `--import ./scripts/enregistrer-resolveur.mjs` dans le script
 * `verifie` de `package.json`.
 */

import { register } from "node:module";

register("./resolveur-ts.mjs", import.meta.url);
