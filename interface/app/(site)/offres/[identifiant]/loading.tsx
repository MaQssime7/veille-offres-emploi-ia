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
          <div className="mt-4 flex flex-wrap gap-1.5">
            <div className="h-5 w-28 bg-muted" />
            <div className="h-5 w-16 bg-muted" />
            <div className="h-5 w-36 bg-muted" />
            <div className="h-5 w-24 bg-muted" />
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <div className="h-5 w-full max-w-prose bg-muted" />

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
