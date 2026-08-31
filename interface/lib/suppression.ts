/**
 * La corbeille : retirer une offre de l'affichage, et l'y remettre.
 *
 * Entre : rien — ce module ne porte que des constantes et des libellés.
 * Sort : de quoi nommer le geste partout de la même façon.
 * Casse : rien à l'exécution.
 *
 * ⚠️ **Pas de `server-only` ici**, comme `statuts.ts`, `notes.ts`,
 * `francais.ts`, `filtres.ts`, `tri.ts`, `theme.ts`, `employeur.ts`,
 * `coup-de-coeur.ts`, `enrichissement.ts` et `regroupement.ts` (règle 3 du
 * `CLAUDE.md`). Ici ce n'est pas théorique : le bouton et la barre d'annulation
 * sont des composants **clients**, et ils lisent ces libellés. Les chercher
 * dans `lib/offres.ts` tirerait `lib/supabase.ts` — donc la clé secrète — dans
 * le graphe du navigateur.
 *
 * ---------------------------------------------------------------------------
 *
 * ⚠️ **« Supprimer » veut dire RETIRER DE L'AFFICHAGE, jamais effacer.** La
 * ligne reste en base avec ses notes et son enrichissement. Le préambule de la
 * migration `…_ajoute_la_suppression_d_affichage.sql` porte les trois raisons
 * qui rendent l'effacement réel indéfendable ici — dont celle-ci, qui suffit :
 * France Travail dépublie, une ligne effacée ne revient jamais.
 *
 * ⚠️ **Ce n'est PAS un doublon d'« Écarté »** — distinction tranchée par Maxime
 * le 31 août 2026. « Écarté » dit « regardé, pas pour moi » et l'offre reste
 * consultable dans son onglet ; la corbeille dit « ne me la remontre jamais »
 * et l'offre quitte **tous** les écrans. Les deux gestes coexistent sur la même
 * ligne et ne s'annulent pas.
 *
 * ⚠️ **Ce n'est PAS un quatrième statut**, exactement comme le coup de cœur : un
 * statut est exclusif, donc supprimer une offre candidatée effacerait la trace
 * de la candidature. C'est un marqueur **transverse** — vérifié contre la base
 * réelle le 31 août 2026 : après écriture de `supprime_a`, `statut` valait
 * toujours `a_traiter`.
 */

/** Ce qu'annonce le bouton. Au singulier : il agit sur une offre à la fois. */
export const LIBELLE_SUPPRIMER = "Retirer de l’affichage";

/** Ce qu'annonce le bouton quand l'offre est déjà à la corbeille. */
export const LIBELLE_RESTAURER = "Remettre à l’affichage";

/**
 * Le message de la barre d'annulation.
 *
 * ⚠️ **Il dit « retirée », jamais « supprimée ».** Le mot compte : « supprimé »
 * laisserait croire que la donnée est perdue, et c'est précisément ce qui
 * n'arrive pas. Le vocabulaire de l'écran doit dire ce que fait le code.
 */
export const MESSAGE_RETRAIT = "Offre retirée de l’affichage.";

/** Ce qu'annonce le bouton d'annulation de la barre. */
export const LIBELLE_ANNULER = "Annuler";

/**
 * Combien de temps la barre d'annulation reste à l'écran, en millisecondes.
 *
 * ⚠️ **8 secondes, et le choix n'est pas cosmétique.** C'est la seule fenêtre
 * pendant laquelle un clic malheureux se rattrape : le bouton corbeille est
 * posé à côté du cœur et de la croix, sur une ligne qui peut bouger sous le
 * curseur quand la liste se réorganise. Trop court, la barre disparaît avant
 * qu'on ait compris ce qui s'est passé ; trop long, elle traîne sur l'écran et
 * masque une ligne.
 *
 * ⚠️ **Sa fin ne détruit rien** : elle ferme seulement le raccourci. L'offre
 * reste restaurable depuis sa fiche, atteignable par son adresse — c'est ce qui
 * rend cette borne acceptable sans onglet « Corbeille ».
 */
export const DUREE_ANNULATION_MS = 8_000;
