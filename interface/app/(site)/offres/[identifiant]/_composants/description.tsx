import { ChevronRight } from "lucide-react";

import { preparerDescription } from "../../_composants/formats";

/**
 * La description intégrale de l'annonce, repliée par défaut.
 *
 * Entre : le texte brut de France Travail.
 * Sort : un bloc dépliable. Replié, il n'occupe qu'une ligne ; déplié, il rend
 * le texte entier en préservant ses sauts de ligne.
 * Casse : rien. Un texte vide ne peut pas exister — `description` est `not
 * null` en base — mais le composant tiendrait quand même.
 *
 * ⚠️ **C'est le `<details>` natif du navigateur, PAS un composant React à
 * état, et ce n'est pas de la paresse.** Un dépliage en `useState` ferait de ce
 * bloc un composant client ; toute la chaîne de `/offres` est aujourd'hui en
 * composants serveur, propriété **mesurée** en phase 2 : aucune colonne
 * sensible ne traverse vers le navigateur, parce que les props ne traversent
 * pas — seul le rendu traverse. Sur cette fiche, la même page lit
 * `contact_nom`. Y poser un composant client pour un simple ouvert/fermé
 * ouvrirait la porte à lui passer l'offre entière un jour.
 *
 * Bénéfices annexes, tous réels : le dépliage marche sans JavaScript, la touche
 * Entrée et le focus clavier sont gérés par le navigateur, et la recherche dans
 * la page (Ctrl+F) ouvre le bloc toute seule dans les navigateurs récents.
 *
 * ⚠️ **`whitespace-pre-wrap` n'est pas cosmétique.** Les descriptions portent
 * 31 sauts de ligne en médiane : rendues sans lui, listes et paragraphes
 * fondraient en un seul pavé illisible de 2 500 caractères.
 */
export function DescriptionOffre({ texte }: { texte: string }) {
  const prepare = preparerDescription(texte);

  return (
    <details className="group carte-produit">
      {/* `list-none` retire le triangle par défaut du navigateur ; le chevron
          qui le remplace pivote à l'ouverture. `[&::-webkit-details-marker]`
          fait la même chose sur Safari, qui ignore `list-none`. */}
      <summary className="flex cursor-pointer list-none items-center gap-2 px-6 py-4 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden="true"
          // Le mouvement est coupé sous `prefers-reduced-motion` par la règle
          // globale de `globals.css` — rien à ajouter ici.
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
        />
        Description intégrale de l’annonce
        <span className="ml-auto font-mono text-xs font-normal tabular-nums text-muted-foreground">
          {prepare.length.toLocaleString("fr-FR")} caractères
        </span>
      </summary>

      <div className="border-t border-border px-6 py-5">
        {/* `max-w-prose` borne la longueur de ligne : sur 1000 px de large, un
            paragraphe pleine largeur fait 150 caractères par ligne, au-delà de
            tout ce qui se lit confortablement.
            `break-words` empêche une URL de 90 caractères — il y en a — de
            pousser la page en débordement horizontal. */}
        {/* ⚠️ **`text-base` comme le résumé et les justifications.** La fiche
            portait quatre tailles de texte suivi — 16, 15, 14 et 13 px — pour
            des paragraphes qui se lisent tous de la même façon. Ce n'était pas
            un système, c'était de l'accumulation. Il en reste deux : 16 px pour
            ce qui se lit, 15 px pour les valeurs courtes du classement, qui sont
            des données étiquetées et non des phrases. */}
        <p className="max-w-prose whitespace-pre-wrap break-words text-base leading-relaxed text-foreground">
          {prepare}
        </p>
      </div>
    </details>
  );
}
