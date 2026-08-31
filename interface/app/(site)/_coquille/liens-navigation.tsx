"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Les onglets de la barre du haut, et le seul endroit du site qui sait quelle
 * page est ouverte.
 *
 * Entre : rien — il lit l'adresse courante lui-même.
 * Sort : deux liens, dont un marqué comme page active.
 * Casse : rien. Sur une adresse inconnue, aucun des deux n'est actif, ce qui
 * est exact plutôt que faux.
 *
 * ⚠️ **C'est un composant CLIENT, et c'est la seule raison pour laquelle il
 * existe séparément.** `usePathname()` n'a pas d'équivalent serveur : un layout
 * ne reçoit pas l'adresse de la page qu'il enveloppe. Tout le reste de l'en-tête
 * — dont la déconnexion, qui est un vrai `<form>` fonctionnant sans JavaScript —
 * reste serveur. Isoler ce composant garde cette propriété : sans lui, marquer
 * l'onglet actif aurait fait basculer toute la barre côté navigateur.
 *
 * ⚠️ **Il ne reçoit AUCUNE donnée** — pas de props du tout. C'est la règle 4 du
 * `CLAUDE.md` appliquée par construction : rien à passer, donc rien à faire
 * fuiter dans le graphe du navigateur.
 *
 * ⚠️ **`/offres/quelque-chose` allume « Offres », et c'est voulu.** La fiche
 * d'une offre est une page d'`/offres` ; n'y allumer aucun onglet donnerait
 * l'impression d'avoir quitté la section. D'où le test sur le préfixe pour
 * « Offres » et l'égalité stricte pour « Accueil » — sans quoi `/` serait
 * préfixe de tout et resterait allumé partout.
 */
const ONGLETS = [
  { href: "/", libelle: "Accueil" },
  { href: "/offres", libelle: "Offres" },
] as const;

export function LiensNavigation() {
  const chemin = usePathname();

  return (
    // ⚠️ **Le repère de navigation est ICI, pas sur la barre entière** : lui
    // seul contient des destinations. Posé plus haut, il ferait passer le bouton
    // de thème et la déconnexion pour des liens auprès d'un lecteur d'écran.
    <nav aria-label="Navigation principale" className="flex items-center gap-0.5">
      {ONGLETS.map(({ href, libelle }) => {
        const actif =
          href === "/" ? chemin === "/" : chemin.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            // ⚠️ **`aria-current="page"` et pas seulement une couleur.** Le
            // plancher d'accessibilité du projet interdit qu'une information
            // tienne sur la seule couleur ; ici c'est aussi la seule façon pour
            // un lecteur d'écran de savoir où l'on est.
            aria-current={actif ? "page" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full px-3.5 font-sans text-sm font-bold transition-colors sm:px-4",
              // ⚠️ **`focus-produit` et jamais `ring-*`** : la barre porte un
              // `cushion-card`, dont le `box-shadow` brut écrase l'anneau de
              // Tailwind. Règle mesurée le 29 août 2026.
              "focus-produit",
              actif
                ? // ⚠️ **La teinte `-engage`, SANS contour** — décision de
                  // Maxime, 31 août 2026, après l'avoir vu à l'écran : les
                  // pilules de filtre de `/offres` en portent un, mais elles
                  // sont six côte à côte en six teintes, là où l'en-tête n'en
                  // compare que deux. Le contour y était une redite.
                  // ⚠️ **Ce que ça coûte, mesuré et assumé** : la pastille pèse
                  // **2,62:1** contre la barre blanche, sous les 3:1 attendus
                  // d'un élément d'interface. L'écart reste très visible à
                  // l'œil, et `aria-current="page"` porte l'information pour
                  // qui ne voit pas la couleur — mais le plancher n'est pas
                  // atteint, et ça se saura si quelqu'un le remesure.
                  // ⚠️ **`text-primary-foreground` et jamais `text-primary`** :
                  // le lavande est un FOND, il tombe à 1,99:1 en texte.
                  "bg-primary-engage text-primary-foreground"
                : "text-foreground hover:bg-muted",
            )}
          >
            {libelle}
          </Link>
        );
      })}
    </nav>
  );
}
