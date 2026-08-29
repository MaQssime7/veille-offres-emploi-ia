import { CadrePage, EnTetePage } from "./_composants/en-tete-page";
import { HAUTEURS_SQUELETTE, RYTHME_LIGNE } from "./_composants/rythme";

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
                className={`w-[6.5rem] shrink-0 bg-muted ${HAUTEURS_SQUELETTE.rangeeNote}`}
              />
              <div
                className={`w-[5.5rem] shrink-0 bg-muted ${HAUTEURS_SQUELETTE.rangeeNote}`}
              />
            </div>
            <div className="mt-1 space-y-1">
              <div
                className={`w-full bg-muted ${HAUTEURS_SQUELETTE.justification}`}
              />
              <div
                className={`w-full bg-muted ${HAUTEURS_SQUELETTE.justification}`}
              />
              <div
                className={`w-2/3 bg-muted ${HAUTEURS_SQUELETTE.justification}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * L'état de chargement de `/offres`.
 *
 * Next.js enveloppe la page dans une frontière Suspense dont ceci est le
 * repli : il s'affiche pendant que le serveur interroge la base, et cède la
 * place dès que la liste arrive.
 *
 * ⚠️ Il **partage** son en-tête et son cadre avec la page (`EnTetePage`,
 * `CadrePage`) au lieu de les recopier. C'est ce partage qui garantit la seule
 * chose que ce fichier doit garantir : que le contenu réel ne fasse pas sauter
 * la mise en page en arrivant. Deux copies du même balisage divergeraient à la
 * première modification, sans erreur pour le signaler.
 *
 * ⚠️ **Le rythme vertical n'est plus recopié ici** : il vient de `rythme.ts`,
 * partagé avec `ligne-offre.tsx`. C'est ce fichier-là qu'il faut modifier, et la
 * ligne comme son squelette suivront ensemble. Avant ce partage, resserrer la
 * ligne sans toucher au squelette faisait sauter la page de 56 px.
 */
export default function ChargementOffres() {
  return (
    <CadrePage aria-busy="true">
      <EnTetePage>
        {/* Annonce vocale : un lecteur d'écran ne voit pas une pulsation. */}
        <p className="font-mono text-xs text-muted-foreground">
          Chargement des offres…
        </p>
      </EnTetePage>

      <div className="border border-border bg-card" aria-hidden="true">
        {Array.from({ length: 4 }, (_, rang) => (
          <div
            key={rang}
            className={`animate-pulse border-b border-border last:border-b-0 ${RYTHME_LIGNE.article}`}
          >
            {/* ⚠️ **La barre grise garde la hauteur du TEXTE (15 px), c'est la
                RANGÉE qui prend celle des boutons (27 px).** Grossir la barre
                jusqu'à 27 px aurait donné la bonne hauteur totale et un
                squelette qui ne ressemble plus à ce qu'il annonce — le
                chargement montrerait un pavé là où arrivera un nom
                d'entreprise. La rangée partagée porte la hauteur, la barre
                imite le contenu. */}
            <div className={`${RYTHME_LIGNE.rangeeEntete} ${RYTHME_LIGNE.margeEntreprise}`}>
              <div
                className={`w-40 max-w-[60%] bg-muted ${HAUTEURS_SQUELETTE.entreprise}`}
              />
            </div>
            <div
              className={`w-80 max-w-[85%] bg-muted ${RYTHME_LIGNE.margeIntitule} ${HAUTEURS_SQUELETTE.intitule}`}
            />
            <div className="flex flex-wrap gap-1.5">
              <div className={`w-24 bg-muted ${HAUTEURS_SQUELETTE.cartouche}`} />
              <div className={`w-16 bg-muted ${HAUTEURS_SQUELETTE.cartouche}`} />
              <div className={`w-40 max-w-[55%] bg-muted ${HAUTEURS_SQUELETTE.cartouche}`} />
            </div>

            <SqueletteNotes />
          </div>
        ))}
      </div>
    </CadrePage>
  );
}
