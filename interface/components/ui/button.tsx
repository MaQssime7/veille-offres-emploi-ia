import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// ⚠️ **Composant shadcn ADAPTÉ au système 1st-Pouf le 29 août 2026.**
// Trois changements, tous nécessaires et tous invisibles si on les oublie :
//
//   1. `rounded-full` au lieu de `rounded-lg` — le contrôle du système est une
//      pilule. Les tailles `xs`/`sm`/`icon-*` déclaraient leur propre rayon,
//      qui écrasait celui de la base : elles ont été alignées une par une.
//   2. `cushion-control` sur la variante pleine — c'est le relief bombé qui
//      donne au bouton sa présence dans ce système.
//   3. ⚠️ **Le focus passe de `ring` à `outline`.** Les `cushion-*` posent un
//      `box-shadow` brut et les `ring-*` de Tailwind passent par cette même
//      propriété : l'anneau de focus était purement écrasé. Mesuré au DOM sur
//      les boutons de statut, où le style calculé rendait `outline-style: none`
//      — un bouton inutilisable au clavier, sans rien pour le signaler.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-bold whitespace-nowrap transition-all select-none focus-produit active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "cushion-control bg-primary text-primary-foreground hover:brightness-95",
        outline:
          "border-input bg-card hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        // Les `focus-visible:ring-*` de cette variante ont été retirés : ils ne
        // servaient à rien depuis que la base porte son focus en `outline`, et
        // laisser des classes inopérantes fait croire au lecteur suivant que le
        // focus est traité ici alors qu'il l'est plus haut.
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30",
        // ⚠️ ADAPTÉ (projet) — `text-primary-texte` et non `text-primary`.
        // Le lavande `--primary` pèse 1,99:1 sur une carte blanche : c'est un
        // fond, pas une couleur de texte. Ce variant n'est utilisé nulle part
        // aujourd'hui, donc le défaut y était DORMANT — il se serait réveillé
        // au premier `variant="link"` posé, sans que rien ne le signale.
        link: "text-primary-texte underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-full px-2 text-xs in-data-[slot=button-group]:rounded-full has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-full px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-full has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-full in-data-[slot=button-group]:rounded-full [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-full in-data-[slot=button-group]:rounded-full",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * Le tourniquet d'attente, repris du registre 1st-Pouf.
 *
 * ⚠️ **Repris à la main, et non par `shadcn add button.json` — c'est la
 * quatrième adaptation de ce fichier, et la commande aurait effacé les trois
 * autres.** Le bouton du registre est un composant DIFFÉRENT : il a sa propre
 * API (`tone`, `variant: solid | quiet`, `forwardRef`), il ne connaît ni les
 * variantes shadcn dont l'application se sert partout, ni le focus en
 * `outline` qui a été mis en place le 29 août parce que les `ring-*` de
 * Tailwind sont écrasés par les `cushion-*`. L'installer aurait rendu tous les
 * boutons du site inutilisables au clavier, **sans erreur ni avertissement**.
 * On prend donc la seule chose qui manquait : ce tourniquet.
 *
 * ⚠️ **`pouf-spin` existe DÉJÀ dans `components/pouf/pouf.css`** (ligne 374) :
 * rien à installer, rien à ajouter au CSS. Vérifié avant de coller la classe.
 *
 * ⚠️ **La bordure est en `currentColor` à 24 %, jamais en jeton de couleur** :
 * le tourniquet vit sur des fonds différents selon la variante du bouton, et
 * une couleur fixe disparaîtrait sur l'un d'eux. `currentColor` suit l'encre du
 * bouton, quelle que soit la variante.
 */
function Tourniquet() {
  return (
    <span
      aria-hidden="true"
      className="size-[15px] shrink-0 rounded-full border-[3px] border-solid border-[color-mix(in_srgb,currentColor_24%,transparent)] border-t-current [animation:pouf-spin_620ms_linear_infinite] motion-reduce:animate-none"
    />
  )
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /**
     * ⚠️ **`loading` DÉSACTIVE le bouton, et ce n'est pas cosmétique.** Un
     * bouton qui a l'air actif pendant qu'une écriture est en vol se clique
     * deux fois — et ici le second clic partirait vers une action serveur
     * facturée. Le registre 1st-Pouf le formule bien : « un envoi qui part deux
     * fois parce qu'il avait l'air inactif est une vraie double écriture ; l'état
     * d'attente n'est pas une décoration, c'est une propriété de sûreté ».
     */
    loading?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      // ⚠️ `aria-busy` prévient les lecteurs d'écran que le bouton travaille.
      // Sans lui, un utilisateur non voyant n'a AUCUN signal : le tourniquet
      // est `aria-hidden`, et le seul autre indice est le libellé, qui n'est
      // pas systématiquement changé par l'appelant.
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {/* ⚠️ Le tourniquet REMPLACE l'icône plutôt que de s'y ajouter quand
          l'appelant lui donne `data-icon` — sinon la largeur du bouton saute au
          démarrage. Ici on le place simplement en tête : les appelants du
          projet passent leur icône dans `children`, et c'est à eux de la
          retirer pendant l'attente s'ils veulent une largeur stable. */}
      {loading && <Tourniquet />}
      {children}
    </Comp>
  )
}

export { Button, buttonVariants }
