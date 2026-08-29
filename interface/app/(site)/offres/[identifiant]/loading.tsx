import { CadrePage } from "../_composants/en-tete-page";

/**
 * Le repli de chargement de la fiche.
 *
 * ⚠️ **Son seul rôle est d'occuper la place**, pour que l'arrivée du contenu ne
 * fasse pas sauter la page. Il reprend donc les hauteurs réelles de la fiche :
 * lien de retour, entête, résumé, notes, renseignements, description, et le
 * bloc de candidature.
 *
 * ⚠️ **Les hauteurs sont mesurées, pas estimées — et l'exactitude est
 * impossible ici, contrairement à la liste.** Première version : 641 px contre
 * 938 px pour la fiche réelle, soit un saut de 297 px à l'arrivée, dû pour
 * l'essentiel au bloc de candidature dessiné trop court. Corrigé et remesuré.
 * Mais une fiche n'a pas de hauteur fixe : elle dépend de la longueur des deux
 * justifications, de la présence du résumé, du nombre de rubriques. On vise
 * donc la fiche **médiane**, pas une égalité parfaite — et à la différence de
 * la liste, où 200 lignes sautaient d'un coup, l'écart résiduel se produit en
 * bas de page, hors du champ de lecture.
 *
 * ⚠️ **`animate-pulse` s'arrête sous `prefers-reduced-motion`** grâce à la règle
 * globale de `globals.css`. Une pulsation est une boucle : c'est exactement le
 * type de mouvement que le plancher d'accessibilité du projet impose de couper.
 *
 * ⚠️ **`aria-hidden` et `sr-only`** : un lecteur d'écran n'a rien à faire de
 * six rectangles gris. On lui dit « Chargement de l'offre » une fois, en texte.
 */
export default function ChargementFiche() {
  return (
    <CadrePage>
      <p className="sr-only" role="status">
        Chargement de l’offre…
      </p>

      <div aria-hidden="true" className="animate-pulse">
        <div className="mb-6 h-5 w-40 bg-muted" />

        <div className="mb-6 border-b border-border pb-6">
          <div className="mb-2 h-4 w-48 bg-muted" />
          <div className="mb-2 h-8 w-full max-w-xl bg-muted" />
          {/* ⚠️ **`h-6` et non `h-5`** : un cartouche réel mesure 24 px, pas
              20 — écart relevé au DOM le 29 août 2026 en calant le reste de ce
              squelette. Il préexistait à la phase 4 et coûtait 4 px de saut à
              chaque ouverture de fiche, trop peu pour se voir à l'œil et assez
              pour être vrai. */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            <div className="h-6 w-28 bg-muted" />
            <div className="h-6 w-16 bg-muted" />
            <div className="h-6 w-36 bg-muted" />
            <div className="h-6 w-24 bg-muted" />
          </div>

          {/* ⚠️ **Les deux boutons de statut, arrivés en phase 4.** Sans cette
              rangée le squelette faisait 117 px là où l'entête réel en fait
              169 : **52 px de saut** au moment où l'offre arrive, mesuré au DOM
              le 29 août 2026. La hauteur (1,6875 rem = 27 px) est celle d'un
              bouton réel, la même valeur que `RYTHME_LIGNE.rangeeEntete` — mais
              **recopiée ici et non importée**, parce que ce module dessine la
              fiche et l'autre la liste : les deux se ressemblent aujourd'hui et
              n'ont aucune raison de rester liées. */}
          <div className="mt-5 flex gap-1.5">
            <div className="h-[1.6875rem] w-[6.75rem] bg-muted" />
            <div className="h-[1.6875rem] w-[5.5rem] bg-muted" />
          </div>
        </div>

        <div className="flex flex-col gap-8">
          {/* ⚠️ **Le résumé a un TITRE et un CADRE depuis le 29 août 2026**, et
              ce squelette montrait encore une barre grise nue de 20 px là où la
              section réelle en fait 113 : **93 px de saut**. Les 5,375 rem du
              cadre correspondent à un résumé de deux lignes — la médiane
              mesurée est de 122 caractères, soit deux lignes à cette largeur.
              ⚠️ **L'égalité exacte est impossible ici**, comme pour les
              justifications de la liste : un résumé d'une ligne fera 59 px, un
              de trois en fera 113. On se cale sur la médiane pour que l'écart
              soit centré autour de zéro plutôt que systématiquement négatif. */}
          <div>
            <div className="mb-3 h-4 w-32 bg-muted" />
            <div className="h-[5.375rem] border border-border bg-card" />
          </div>

          <div>
            <div className="mb-3 h-4 w-24 bg-muted" />
            <div className="h-28 border border-border bg-card" />
          </div>

          <div>
            <div className="mb-3 h-4 w-40 bg-muted" />
            <div className="h-24 border border-border bg-card" />
          </div>

          <div>
            <div className="mb-3 h-4 w-20 bg-muted" />
            <div className="h-14 border border-border bg-card" />
          </div>

          {/* Le bloc de candidature : bouton, ligne de contact, avertissement
              sur la dépublication. C'est lui qui manquait le plus. */}
          <div>
            <div className="mb-3 h-4 w-24 bg-muted" />
            <div className="h-36 border border-border bg-card" />
          </div>
        </div>
      </div>
    </CadrePage>
  );
}
