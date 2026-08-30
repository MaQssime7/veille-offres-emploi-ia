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
           « Nouveau », « Coup de cœur », « Candidaté », « Écarté », « Toutes »)
           plutôt que d'être égales : six rectangles identiques annonceraient une
           barre qui n'arrive jamais.

           ⚠️ **32,5 px depuis le 30 août 2026 — remesuré après le passage de la
           bordure à 2 px.** L'historique de cette valeur dit tout du piège :
           29 px écrits en phase 4 (faux), 30,5 mesurés le 29 août, **32,5**
           mesurés le 30. Chaque fois l'écart était trop petit pour se voir et
           assez grand pour être faux, et chaque fois il a fallu le DOM pour le
           trouver. Décomposition actuelle : 2 px de bordure × 2 + 6 px de
           `py-1.5` × 2 + 16,5 px de hauteur de ligne.

           ⚠️ **SIX pilules depuis le 30 août 2026** — cinq depuis le 29 août,
           quatre avant. Chaque ajout à `filtres-statut.tsx` doit être répété
           ici **dans le même geste** : sans cette ligne-ci, la barre passerait
           d'un nombre de pilules à l'autre à l'arrivée des offres. À 375 px une
           pilule de plus fait replier la rangée, donc le saut n'est pas de
           quelques pixels mais de toute une hauteur de pilule. C'est le piège
           n° 5 du projet, qui n'a **aucun garde-fou mécanique** — rien ne relie
           ce fichier à celui qu'il double, et le défaut est invisible en
           développement où le serveur répond en 80 ms. */
        filtres={
          <div aria-hidden="true" className="flex flex-wrap gap-1.5">
            {/* Largeurs REMESURÉES au DOM le 30 août 2026, après le passage de
                la bordure à 2 px : 125,80 · 97,21 · 132,96 · 111,51 · 90,06 ·
                104,36 px. Le total du squelette tombe à 693 px contre 691,91
                réels — 1,1 px d'écart, sans effet sur le repli. */}
            {/* « À traiter » — 125,80 px */}
            <div className="h-[2.03125rem] w-32 animate-pulse rounded-full bg-muted" />
            {/* « Nouveau » — 97,21 px */}
            <div className="h-[2.03125rem] w-24 animate-pulse rounded-full bg-muted" />
            {/* « Coup de cœur » — 132,96 px, le libellé le plus long des six */}
            <div className="h-[2.03125rem] w-[8.3125rem] animate-pulse rounded-full bg-muted" />
            {/* « Candidaté » — 111,51 px */}
            <div className="h-[2.03125rem] w-28 animate-pulse rounded-full bg-muted" />
            {/* « Écarté » — 90,06 px */}
            <div className="h-[2.03125rem] w-[5.625rem] animate-pulse rounded-full bg-muted" />
            {/* « Toutes » — 104,36 px */}
            <div className="h-[2.03125rem] w-26 animate-pulse rounded-full bg-muted" />
          </div>
        }
        /* ⚠️ **Le menu de classement occupe la place, il ne s'anime pas seul.**
           Il partage la rangée des filtres : posé dans `EnTetePage`, il porte la
           même hauteur qu'eux (**32,5 px**) et laisse la rangée identique avant
           et après. ⚠️ Cette égalité a failli être perdue le 30 août : les
           pilules sont passées à `border-2` et le déclencheur « Trier » est
           resté à 1 px, donc à 30,5 px de haut contre 32,5 pour ses voisins
           immédiats. Corrigé dans `menu-tri.tsx`, où le motif est expliqué.

           ⚠️ **Sa LARGEUR, elle, n'a aucun effet vertical** — et c'est pour ça
           qu'on la cale sur le cas par défaut (155 px mesurés pour « TRIER ·
           Intérêt ») plutôt que sur le plus large. Le squelette ne peut pas
           savoir quel classement l'adresse demande : il s'affiche avant que le
           serveur n'ait répondu. Choisir le plus large aurait donné une barre
           trop longue trois fois sur quatre, pour aucun gain de calage. */
        tri={
          <div
            aria-hidden="true"
            className="h-[2.03125rem] w-40 shrink-0 animate-pulse rounded-full bg-muted"
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
