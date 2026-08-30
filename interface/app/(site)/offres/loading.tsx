import { SqueletteEtatVeille } from "../_composants/etat-veille";
import { CadrePage } from "../_composants/cadre-page";
import { EnTetePage } from "../_composants/en-tete-page";
import { SqueletteLigneOffre } from "../_composants/squelette-ligne";

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
        sousTitre={
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
           « Nouveau », « Candidaté », « Écarté », « Toutes ») plutôt que d'être
           égales : cinq rectangles identiques annonceraient une barre qui
           n'arrive jamais.

           ⚠️ **30,5 px et non 29 — corrigé le 29 août 2026 en MESURANT.** Cette
           hauteur était écrite à 29 px depuis la phase 4 ; la pilule réelle en
           fait 30,5 (1 px de bordure × 2 + 6 px de `py-1.5` × 2 + 16,5 px de
           hauteur de ligne). L'écart était de 1,5 px sur une rangée, donc 4,5 px
           à 375 px où la barre se plie en deux lignes et où le menu prend la
           sienne. Trop petit pour se voir, assez grand pour être faux — et c'est
           le genre d'écart qui grandit à chaque élément ajouté.

           ⚠️ **CINQ pilules depuis le 29 août 2026, et pas quatre.** L'onglet
           « Nouveau » est arrivé le même jour dans `filtres-statut.tsx` : sans
           cette ligne-ci, la barre serait passée de quatre à cinq éléments à
           l'arrivée des offres. À 375 px la cinquième fait passer la rangée sur
           deux lignes, donc le saut n'aurait pas été de quelques pixels mais de
           toute une hauteur de pilule. C'est le piège n° 5 du projet, qui n'a
           aucun garde-fou mécanique — rien ne relie ce fichier à celui qu'il
           double. */
        filtres={
          <div aria-hidden="true" className="flex flex-wrap gap-1.5">
            <div className="h-[1.90625rem] w-28 animate-pulse rounded-full bg-muted" />
            <div className="h-[1.90625rem] w-26 animate-pulse rounded-full bg-muted" />
            <div className="h-[1.90625rem] w-28 animate-pulse rounded-full bg-muted" />
            <div className="h-[1.90625rem] w-24 animate-pulse rounded-full bg-muted" />
            <div className="h-[1.90625rem] w-24 animate-pulse rounded-full bg-muted" />
          </div>
        }
        /* ⚠️ **Le menu de classement occupe la place, il ne s'anime pas seul.**
           Il partage la rangée des filtres : posé dans `EnTetePage`, il porte la
           même hauteur qu'eux (30,5 px) et laisse la rangée identique avant et
           après.

           ⚠️ **Sa LARGEUR, elle, n'a aucun effet vertical** — et c'est pour ça
           qu'on la cale sur le cas par défaut (155 px mesurés pour « TRIER ·
           Intérêt ») plutôt que sur le plus large. Le squelette ne peut pas
           savoir quel classement l'adresse demande : il s'affiche avant que le
           serveur n'ait répondu. Choisir le plus large aurait donné une barre
           trop longue trois fois sur quatre, pour aucun gain de calage. */
        tri={
          <div
            aria-hidden="true"
            className="h-[1.90625rem] w-40 shrink-0 animate-pulse rounded-full bg-muted"
          />
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
          <SqueletteLigneOffre key={rang} />
        ))}
      </div>
    </CadrePage>
  );
}
