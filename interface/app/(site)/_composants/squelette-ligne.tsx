import { HAUTEURS_SQUELETTE, RYTHME_LIGNE } from "./rythme";

/**
 * Le squelette d'une ligne d'offre, pendant que la base répond.
 *
 * ⚠️ **Extrait de `offres/loading.tsx` le 30 août 2026, quand `/` est arrivé.**
 * Les deux écrans affichent la même ligne, donc leurs squelettes doivent avoir
 * la même hauteur — et rien ne relie mécaniquement un squelette à ce qu'il
 * double. Deux copies auraient divergé au premier ajustement, en silence : le
 * projet a déjà payé trois sauts de mise en page pour cette raison exacte
 * (297 px, 93 px, 222 px).
 *
 * ⚠️ **Le rythme vertical vient de `rythme.ts`, jamais de valeurs recopiées.**
 * C'est ce fichier-là qu'il faut modifier, et la ligne réelle comme son
 * squelette suivront ensemble.
 */

/**
 * Le squelette du bloc de notes, sous les cartouches.
 *
 * ⚠️ **Trois lignes de justification, et c'est un compromis assumé.** À la
 * différence de la phase 1, l'égalité parfaite entre squelette et contenu est
 * ici **impossible** : la hauteur d'une ligne dépend de la longueur des deux
 * justifications, que le squelette ne peut pas connaître. Mesuré le 26 août
 * 2026 sur les 97 offres notées, la ligne rendue va de **174 à 218 px, médiane
 * 195**. Le squelette est donc calé sur la médiane — l'écart reste centré
 * autour de zéro au lieu d'être systématiquement négatif, ce qui est le mieux
 * qu'on puisse faire sans mesurer le texte avant de l'avoir.
 *
 * ⚠️ **Le squelette imite une ligne NOTÉE, et c'est un pari, pas une
 * certitude.** Le tri est par intérêt décroissant : le haut de la liste — la
 * seule partie visible pendant le chargement — est constitué d'offres notées
 * **dès qu'il en existe au moins quatre**. C'est le cas aujourd'hui (97) et ce
 * le sera toujours davantage.
 *
 * **Le pari se perd dans un seul cas : une base sans AUCUNE note.** Les quatre
 * lignes réelles font alors 91 px au lieu de 203, soit **environ 450 px de
 * saut** — exactement le défaut que `rythme.ts` existe pour empêcher. Relevé en
 * revue le 26 août 2026, laissé tel quel en connaissance de cause : ce cas
 * n'existe qu'avant la toute première notation, il ne se reproduira plus, et
 * l'alternative (un squelette sans bloc de notes) déplacerait le saut sur le
 * cas courant au lieu de le supprimer.
 *
 * ⚠️ **La leçon générale** : à partir du moment où la hauteur d'une ligne
 * dépend de son contenu, l'égalité exacte entre squelette et rendu devient
 * impossible. Le travail n'est plus de l'obtenir mais de **choisir quel écart
 * on accepte, et sur quel cas** — et de l'écrire, pour que le prochain qui
 * touche à ce fichier ne croie pas à un oubli.
 */
function SqueletteNotes() {
  return (
    <div className={RYTHME_LIGNE.blocNotes}>
      <div className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, colonne) => (
          <div key={colonne}>
            <div className="flex items-center gap-2">
              <div
                className={`rounded-full w-[6.5rem] shrink-0 bg-muted ${HAUTEURS_SQUELETTE.rangeeNote}`}
              />
              <div
                className={`rounded-full w-[5.5rem] shrink-0 bg-muted ${HAUTEURS_SQUELETTE.rangeeNote}`}
              />
            </div>
            <div className="mt-1 space-y-1">
              <div
                className={`rounded-full w-full bg-muted ${HAUTEURS_SQUELETTE.justification}`}
              />
              <div
                className={`rounded-full w-full bg-muted ${HAUTEURS_SQUELETTE.justification}`}
              />
              <div
                className={`rounded-full w-2/3 bg-muted ${HAUTEURS_SQUELETTE.justification}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Une carte grise à la place d'une ligne d'offre.
 *
 * ⚠️ **Elle imite une ligne NOTÉE, et c'est un pari assumé** — voir la note de
 * `SqueletteNotes` ci-dessus. Sur `/`, le pari est encore plus sûr que sur
 * `/offres` : l'écran du matin ne montre que des offres dont la note dépasse le
 * seuil, donc toutes notées par construction.
 */
export function SqueletteLigneOffre() {
  return (
    <div className={`animate-pulse ${RYTHME_LIGNE.article}`}>
      {/* ⚠️ **La barre grise garde la hauteur du TEXTE (15 px), c'est la
          RANGÉE qui prend celle des boutons (27 px).** Grossir la barre
          jusqu'à 27 px aurait donné la bonne hauteur totale et un squelette
          qui ne ressemble plus à ce qu'il annonce — le chargement montrerait
          un pavé là où arrivera un nom d'entreprise. La rangée partagée porte
          la hauteur, la barre imite le contenu. */}
      <div className={`${RYTHME_LIGNE.rangeeEntete} ${RYTHME_LIGNE.margeEntreprise}`}>
        <div
          className={`rounded-full w-40 max-w-[60%] bg-muted ${HAUTEURS_SQUELETTE.entreprise}`}
        />
      </div>
      <div
        className={`rounded-full w-80 max-w-[85%] bg-muted ${RYTHME_LIGNE.margeIntitule} ${HAUTEURS_SQUELETTE.intitule}`}
      />
      <div className="flex flex-wrap gap-1.5">
        <div className={`rounded-full w-24 bg-muted ${HAUTEURS_SQUELETTE.cartouche}`} />
        <div className={`rounded-full w-16 bg-muted ${HAUTEURS_SQUELETTE.cartouche}`} />
        <div className={`rounded-full w-40 max-w-[55%] bg-muted ${HAUTEURS_SQUELETTE.cartouche}`} />
      </div>

      <SqueletteNotes />
    </div>
  );
}
