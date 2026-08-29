/**
 * La note personnelle d'une offre : sa borne, et la seule représentation
 * admise de son vide.
 *
 * Entre : le texte tapé dans le champ, ou rien.
 * Sort : des constantes, et un texte normalisé prêt à écrire en base.
 * Casse : rien à l'exécution.
 *
 * ⚠️ **Ce fichier n'a PAS `import "server-only"`, comme `lib/statuts.ts` et
 * pour la même raison.** Le champ de saisie est un composant client : il a
 * besoin de la borne de longueur pour son `maxLength`, et le serveur en a
 * besoin pour refuser une écriture trop longue. S'il allait la chercher dans
 * `lib/offres.ts`, il tirerait `lib/supabase.ts` — donc la clé secrète — dans
 * le graphe du navigateur. **Ici vivent des constantes et une fonction pure,
 * jamais du code qui lit un secret.**
 */

/**
 * La borne, en caractères.
 *
 * ⚠️ **Elle doit rester identique à la contrainte `note_personnelle_bornee`**
 * de `supabase/migrations/20260829084815_…`. Les deux ne peuvent pas se
 * déduire l'une de l'autre — l'une est du SQL dans la base, l'autre du
 * TypeScript dans le paquet. La base fait autorité : si elles divergent, c'est
 * le code qui a tort et Postgres répondra 400.
 *
 * ⚠️ **JS compte en unités UTF-16, Postgres en points de code**, et l'écart
 * joue dans le bon sens. Un emoji hors du plan de base (« 👍 ») pèse 2 pour
 * `"…".length` et 1 pour `length()` en SQL : notre contrôle est donc toujours
 * *plus strict* que celui de la base. On peut refuser un texte que la base
 * aurait accepté, jamais l'inverse — et c'est ce sens-là qu'il faut, sinon une
 * note serait perdue sur un 400 que rien n'aurait annoncé.
 *
 * 20 000 caractères, c'est environ dix pages : bien au-delà d'un pense-bête de
 * relance, et assez bas pour qu'un copier-coller accidentel de toute une
 * annonce ne remplisse pas la base sans qu'on s'en aperçoive.
 */
export const LONGUEUR_MAX_NOTE = 20000;

/**
 * Le texte tel qu'il doit partir en base.
 *
 * Entre : ce que contient le champ, y compris « », « \n » ou « &nbsp;&nbsp; ».
 * Sort : `null` si la note est vide **pour un humain**, sinon le texte
 * exactement tel qu'il a été tapé.
 * Casse : rien.
 *
 * ⚠️ **C'est le piège que la migration 7 a attrapé, et il est propre à
 * l'enregistrement automatique.** Avec un bouton « Enregistrer », personne ne
 * soumet un champ vide. Sans bouton, effacer sa note produit exactement ça :
 * une chaîne vide, ou « \n » si un saut de ligne subsiste. La contrainte
 * `note_personnelle_non_vide` la refuserait en 400 — et l'indicateur dirait
 * « échec » sur le geste le plus normal du monde, effacer.
 *
 * ⚠️ **On ne rogne PAS les blancs d'un texte non vide.** `btrim` sert ici à
 * *décider* si la note est vide, pas à réécrire ce que Maxime a tapé : une
 * indentation ou une ligne blanche entre deux paragraphes lui appartient, et
 * un texte qui change tout seul au rechargement est un défaut.
 */
export function normaliserNote(texte: string): string | null {
  return texte.trim() === "" ? null : texte;
}
