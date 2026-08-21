/**
 * L'état du formulaire de connexion : ce que l'action renvoie à l'écran.
 *
 * ⚠️ Ce type et cette constante sont dans un fichier à part, et pas dans
 * `actions.ts`, pour une raison qui ne se voit pas à la lecture : la directive
 * `"use server"` transforme **tout** ce qu'un fichier exporte en référence
 * appelable à distance. Une constante exportée depuis un tel fichier n'arrive
 * pas au navigateur avec sa valeur ; `ETAT_CONNEXION_INITIAL.erreur` valait
 * `undefined` au lieu de `null`, ce qui affichait le champ encadré de rouge
 * dès le chargement. Ni le compilateur ni `next build` ne l'ont signalé.
 */

export type EtatConnexion = { erreur: string | null };

export const ETAT_CONNEXION_INITIAL: EtatConnexion = { erreur: null };
