"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Une fenêtre modale, posée sur Radix et habillée par 1st-Pouf.
 *
 * ⚠️ **Écrit à la main plutôt qu'installé, et le motif n'est pas le même que
 * pour le bouton.** Le registre 1st-Pouf n'expose **aucun** `dialog.json` — le
 * vérifier a pris une requête, et c'est le genre de chose qu'on suppose à tort.
 * Mais `components/pouf/pouf.css` porte déjà `.pouf-overlay`, `.pouf-dialog`,
 * `.pouf-dialog__head` et `.pouf-dialog__body`, **écrits pour Radix** : ils
 * s'animent sur `[data-state='open'|'closed']`, qui est exactement ce que Radix
 * pose sur ses nœuds. Le style attendait donc son composant. On ne réinvente
 * rien, on branche.
 *
 * ⚠️ **Ce que Radix apporte et qu'une `<div>` ne donnerait pas**, et c'est la
 * raison de la dépendance plutôt que d'un bricolage maison :
 *   · le **focus est piégé** dans la fenêtre tant qu'elle est ouverte, et rendu
 *     au bouton qui l'a ouverte à la fermeture ;
 *   · `Échap` et le clic sur le fond ferment ;
 *   · le reste de la page passe en `aria-hidden`, donc un lecteur d'écran ne
 *     lit plus le contenu situé derrière ;
 *   · la sortie est **animée** parce que Radix garde le nœud monté jusqu'à la
 *     fin de l'animation `[data-state='closed']` — sans lui, la fenêtre
 *     disparaîtrait d'un coup.
 *
 * ⚠️ **`.pouf-dialog` devient une feuille plein écran sous 640 px**, par une
 * règle déjà présente dans `pouf.css` : sur téléphone une boîte centrée gaspille
 * les bords. Rien à faire ici, mais il faut le savoir avant de mesurer.
 */

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

function DialogContenu({
  className,
  children,
  large = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  /** 720 px au lieu de 440 — pour une fiche, pas pour une confirmation. */
  large?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="pouf-overlay" />
      <DialogPrimitive.Content
        className={cn("pouf-dialog", large && "pouf-dialog--lg", className)}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/**
 * L'en-tête : le titre, et le bouton de fermeture qui l'accompagne toujours.
 *
 * ⚠️ **`DialogPrimitive.Title` est OBLIGATOIRE, pas décoratif.** Radix avertit
 * en console quand il manque, et pour une bonne raison : c'est lui qui nomme la
 * fenêtre pour les lecteurs d'écran. Sans titre, l'utilisateur entend « boîte de
 * dialogue » et rien d'autre. Si un jour un appelant ne veut pas de titre
 * visible, il faudra un `VisuallyHidden`, jamais l'omission.
 */
function DialogEntete({
  titre,
  description,
}: {
  titre: string;
  description?: string;
}) {
  return (
    <div className="pouf-dialog__head mb-4">
      <div className="flex flex-col gap-1">
        <DialogPrimitive.Title className="font-display text-xl leading-tight text-foreground">
          {titre}
        </DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="text-sm leading-relaxed text-foreground">
            {description}
          </DialogPrimitive.Description>
        ) : (
          // ⚠️ Radix veut une description OU la déclaration explicite qu'il n'y
          // en a pas. L'omettre sans le dire produit un avertissement en
          // console — et une console qui crie finit par ne plus être lue.
          <DialogPrimitive.Description className="sr-only">
            {titre}
          </DialogPrimitive.Description>
        )}
      </div>
      <DialogPrimitive.Close
        aria-label="Fermer"
        className="focus-produit -mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
      >
        <X className="size-4" aria-hidden="true" />
      </DialogPrimitive.Close>
    </div>
  );
}

/** Le corps, qui défile seul quand la fiche dépasse la hauteur de l'écran. */
function DialogCorps({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("pouf-dialog__body", className)}>{children}</div>
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContenu,
  DialogEntete,
  DialogCorps,
};
