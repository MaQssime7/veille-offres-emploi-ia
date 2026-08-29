/**
 * Le rythme vertical de la ligne d'offre, en un seul endroit.
 *
 * Entre : rien. Sort : des chaînes de classes Tailwind.
 * Casse : rien à l'exécution — c'est justement le problème que ce fichier
 * existe pour supprimer.
 *
 * ⚠️ **Pourquoi ce fichier existe.** `ligne-offre.tsx` dessine la ligne réelle,
 * `loading.tsx` en dessine le squelette pendant que la base répond. Les deux
 * doivent avoir **exactement** la même hauteur, sinon la page saute au moment
 * où les offres arrivent. Tant que les valeurs étaient recopiées dans les deux
 * fichiers, rien ne garantissait cette égalité : le 26 août 2026, resserrer la
 * ligne sans toucher au squelette a produit **56 px de saut sur six lignes**.
 * Ni le compilateur ni le linter n'ont bronché — les deux fichiers étaient
 * cohérents séparément.
 *
 * Un commentaire demandant « pense à reporter la valeur » ne vaut rien : il
 * suppose qu'on l'ait lu. Ici, modifier une valeur la modifie des deux côtés,
 * parce qu'il n'y en a qu'une.
 *
 * ⚠️ **Les hauteurs sont en `rem`, jamais en `px`.** Une barre grise en pixels
 * durs reste figée quand l'utilisateur agrandit la police par défaut de son
 * navigateur, pendant que le texte qu'elle imite grandit : mesuré le 26 août,
 * **54 px de saut à une racine de 20 px, 105 px à 24 px**. Invisible au réglage
 * par défaut, donc jamais découvert par hasard.
 *
 * ⚠️ **Les chaînes doivent rester écrites en entier.** Tailwind lit le code
 * source pour savoir quelles classes produire : une classe assemblée par
 * concaténation ne serait jamais générée, et le style disparaîtrait sans
 * message d'erreur.
 */
export const RYTHME_LIGNE = {
  /** Marges intérieures de l'article. */
  article: "px-4 py-2.5 sm:px-5",
  /**
   * La rangée du haut : nom d'entreprise, marqueur « Nouveau », et depuis la
   * phase 4 les deux boutons de statut poussés à droite.
   *
   * ⚠️ **La hauteur minimale est celle des BOUTONS, pas celle du texte.**
   * Mesuré au DOM le 29 août 2026 : le nom d'entreprise fait 15 px, un bouton
   * de statut 27 px — c'est donc lui qui commande, et la rangée a gagné 12 px
   * le jour où les boutons sont arrivés. Sans cette valeur ici, le squelette de
   * `loading.tsx` serait resté calé sur 15 px et la page aurait sauté de 12 px
   * par ligne à l'arrivée des offres. C'est exactement le défaut de 56 px du
   * 26 août, que ce fichier existe pour empêcher.
   *
   * ⚠️ **`min-h` et non `h`** : une entreprise au nom très long passe à la ligne
   * et la rangée doit pouvoir grandir. Une hauteur figée la couperait.
   *
   * ⚠️ **DEUX hauteurs, et l'oublier ferait sauter la page en mobile
   * seulement.** Sous 640 px, les boutons perdent leur libellé et deviennent
   * carrés pour offrir une cible tactile décente : **32 px** au lieu de 27.
   * Une valeur unique aurait calé le squelette sur le bureau, et le saut de
   * 5 px par ligne ne se serait vu que sur un téléphone — c'est-à-dire jamais
   * pendant le développement. Mesuré au DOM le 29 août 2026 dans les deux
   * largeurs.
   */
  rangeeEntete:
    "flex flex-wrap items-center gap-x-3 gap-y-1 min-h-[2rem] sm:min-h-[1.6875rem]",
  /** Sous le nom de l'entreprise. */
  margeEntreprise: "mb-1",
  /** Sous l'intitulé. */
  margeIntitule: "mb-1.5",
  /**
   * Le bloc des deux notes, sous les cartouches.
   *
   * ⚠️ **Le filet est le séparateur, pas une ombre ni un fond.** Le produit
   * n'a aucune ombre — la hiérarchie repose entièrement sur la typographie et
   * les filets (`docs/DESIGN.md`). Poser un fond gris pour isoler les notes
   * introduirait une troisième surface dans une ligne qui n'en a que deux.
   */
  blocNotes: "mt-2.5 border-t border-border pt-2.5",
} as const;

/**
 * Hauteurs des barres du squelette, égales à celles du texte qu'elles
 * remplacent — mesurées au DOM le 26 août 2026 sous une police racine de
 * 16 px : 15 px, 21 px et 24 px.
 */
export const HAUTEURS_SQUELETTE = {
  entreprise: "h-[0.9375rem]",
  intitule: "h-[1.3125rem]",
  cartouche: "h-6",
  /**
   * La rangée libellé + barre + chiffre. Sa hauteur est celle du chiffre
   * (`text-xs`, interligne 1rem), qui est l'élément le plus haut de la
   * rangée — pas celle de la barre, qui ne fait que 8 px.
   */
  rangeeNote: "h-4",
  /** Une ligne de justification : 13 px × interligne 1,625. */
  justification: "h-[1.3125rem]",
} as const;
