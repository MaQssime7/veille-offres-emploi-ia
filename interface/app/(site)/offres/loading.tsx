import { SqueletteEtatVeille } from "../_composants/etat-veille";
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
      <EnTetePage
        /* ⚠️ **La manchette d'état arrivée le 29 août 2026 — et c'est
           exactement le saut que ce fichier existe pour éviter.** Elle ajoute
           une ligne de 15,4 px plus son filet et son `pb-2` en tête de
           bandeau ; l'oublier ici aurait décalé toute la page vers le haut au
           moment où les offres arrivent. Le squelette vient du même fichier
           que la ligne réelle, pour que les deux se modifient ensemble. */
        manchette={<SqueletteEtatVeille />}
        compte={
          /* Annonce vocale : un lecteur d'écran ne voit pas une pulsation. */
          <p className="font-mono text-xs text-muted-foreground">
            Chargement des offres…
          </p>
        }
        /* ⚠️ **Les quatre onglets de filtre, arrivés en phase 4 — et c'est le
           saut que `en-tete-page.tsx` annonçait par écrit** : « la première
           modification de l'en-tête (le filtre de statut de la phase 4, par
           exemple) réintroduit en silence le saut que ce repli servait à
           éviter ». Le commentaire avait raison et il a suffi à ne pas
           l'oublier — c'est exactement ce qu'on attend d'un commentaire.

           ⚠️ **Les largeurs imitent les libellés réels** (« À traiter »,
           « Candidaté », « Écarté », « Toutes ») plutôt que d'être égales :
           quatre rectangles identiques annonceraient une barre qui n'arrive
           jamais. */
        filtres={
          <div aria-hidden="true" className="flex flex-wrap gap-1.5">
            <div className="h-[1.8125rem] w-28 animate-pulse rounded-full bg-muted" />
            <div className="h-[1.8125rem] w-28 animate-pulse rounded-full bg-muted" />
            <div className="h-[1.8125rem] w-24 animate-pulse rounded-full bg-muted" />
            <div className="h-[1.8125rem] w-24 animate-pulse rounded-full bg-muted" />
          </div>
        }
      />

      {/* ⚠️ **Le même `flex flex-col gap-2` que la page, et l'écart de 8 px en
          fait partie.** Depuis la refonte du 29 août 2026 la liste est une pile
          de cartes espacées : un squelette resté en bloc unique cloisonné de
          filets aurait montré quatre lignes collées, puis la page se serait
          détendue de 8 px par ligne à l'arrivée des offres. Le fond `bg-card`
          et les rayons viennent de `RYTHME_LIGNE.article`, partagé avec la
          ligne réelle — ils n'ont pas à être répétés ici. */}
      <div className="flex flex-col gap-2" aria-hidden="true">
        {Array.from({ length: 4 }, (_, rang) => (
          <div
            key={rang}
            className={`animate-pulse ${RYTHME_LIGNE.article}`}
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
        ))}
      </div>
    </CadrePage>
  );
}
