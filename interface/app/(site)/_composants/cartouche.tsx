import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Les cartouches de métadonnées : lieu, contrat, salaire, date.
 *
 * ⚠️ **Une seule teinte neutre pour tous, et c'est une décision du DESIGN.md
 * que la refonte du 29 août 2026 n'a PAS remise en cause.** Cinq offres ×
 * quatre informations donneraient vingt taches colorées, et plus rien ne
 * signalerait rien — c'est précisément le risque d'un système aussi coloré que
 * 1st-Pouf, dont la palette compte six pastels tous également disponibles. Ils
 * ressortent par la forme — pilule, fond discret — jamais par la couleur.
 *
 * `accentue` sert au salaire, qu'on cherche en premier : il se distingue par la
 * graisse, pas par une teinte à lui.
 *
 * ⚠️ **`cn()` n'est pas une commodité d'écriture ici, c'est ce qui fait marcher
 * `accentue`.** En collant les classes bout à bout, on obtenait
 * `text-muted-foreground … text-foreground` : deux règles de même spécificité,
 * donc c'est l'ordre dans la feuille de style compilée qui tranche — et
 * `text-muted-foreground` y est écrit *après*. Le salaire sortait exactement de
 * la couleur qu'on voulait éviter, sans la moindre erreur visible. `cn()`
 * (tailwind-merge) sait que ces deux classes se disputent la même propriété et
 * ne garde que la dernière annoncée.
 */
export function Cartouche({
  children,
  accentue = false,
  aere = false,
}: {
  children: ReactNode;
  accentue?: boolean;
  /**
   * ⚠️ **`true` sur la fiche, `false` en liste — même partage que les notes.**
   * Un cartouche de 11 px se lisait bien sous un intitulé de liste ; sous un
   * texte de fiche passé à 16 px, il devenait un détail illisible. En liste il
   * ne bouge pas : quatre cartouches × 200 lignes, chaque pixel de hauteur s'y
   * paie en défilement.
   */
  aere?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full bg-muted font-mono leading-relaxed text-muted-foreground",
        aere ? "px-3 py-1 text-[0.8125rem]" : "px-2.5 py-0.5 text-[0.6875rem]",
        accentue && "font-semibold text-foreground",
      )}
    >
      {children}
    </span>
  );
}

/**
 * Le cas « l'information n'existe pas ».
 *
 * Il a son propre traitement — cartouche creux, filet pointillé, italique —
 * parce qu'il est **le cas normal et pas le cas limite** : 65 % des offres
 * réelles n'indiquent aucun salaire. Le laisser vide ferait croire à un défaut
 * d'affichage ; lui donner le même cartouche que les autres le ferait lire
 * comme une donnée.
 *
 * ⚠️ **La couleur reste `text-muted-foreground` pleine, sans modificateur
 * d'opacité.** Un `/80` avait été posé pour l'atténuer : mesuré dans le
 * navigateur, il tombait à 4,14:1 en mode clair, sous le plancher opposable de
 * 4,5:1 du projet — et sur 65 % des lignes, pas sur un cas rare. La mise en
 * retrait est portée par l'italique et le filet pointillé, qui ne coûtent
 * aucun contraste.
 */
export function CartoucheAbsent({
  children,
  aere = false,
}: {
  children: ReactNode;
  aere?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border border-dashed border-input font-mono italic leading-relaxed text-muted-foreground",
        // ⚠️ La bordure est comptée dans la boîte : sans padding identique à
        // `Cartouche`, le cartouche « absent » serait 2 px plus haut que ses
        // voisins et la rangée entière se décalerait.
        aere ? "px-3 py-1 text-[0.8125rem]" : "px-2.5 py-0.5 text-[0.6875rem]",
      )}
    >
      {children}
    </span>
  );
}
