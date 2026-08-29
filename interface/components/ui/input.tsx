import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      // ⚠️ **Composant shadcn ADAPTÉ au système 1st-Pouf le 29 août 2026.**
      // Le champ prend le rayon de contrôle et le creux du système
      // (`cushion-field`), qui se creuse davantage au focus
      // (`cushion-field-focus`) — dans ce système, un champ est un renfoncement
      // et non une boîte cernée d'un trait.
      // ⚠️ **Le focus reste DOUBLÉ d'un `outline`**, et ce n'est pas une
      // redondance décorative : `cushion-field-focus` est un `box-shadow`, donc
      // invisible pour qui pousse le contraste ou coupe les couleurs. L'outline
      // est le repère qui survit à ces réglages, et le plancher du projet exige
      // un focus clavier visible.
      // ⚠️ **`border border-input` est OBLIGATOIRE et a été rétabli en revue.**
      // Une première version l'avait remplacé par `border-0`, en comptant sur
      // `cushion-field` pour délimiter le champ. Mesuré sur le CSS compilé :
      // le creux du coussin ne pèse que **1,13:1** sur la carte blanche, très
      // loin des 3:1 que le projet déclare obligatoires pour `--input`. Et
      // comme le champ a le même fond blanc que la carte de `/connexion` sur
      // laquelle il est posé, il n'avait plus **aucun bord perceptible** : on
      // voyait une étiquette et du vide.
      // ⚠️ **Les styles `aria-invalid:` ont été rétablis pour la même raison** :
      // `app/connexion/formulaire.tsx` pose toujours `aria-invalid` sur un mot
      // de passe refusé. Sans eux, l'attribut restait posé et ne peignait plus
      // rien — un signal d'erreur devenu décoratif.
      className={cn(
        "cushion-field h-8 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-1 text-base transition-shadow file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:cushion-field-focus focus-produit disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:border-2 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
