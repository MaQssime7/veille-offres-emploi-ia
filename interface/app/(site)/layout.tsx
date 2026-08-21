/**
 * La coquille des pages protégées.
 *
 * Le groupe `(site)` n'ajoute rien à l'adresse : `app/(site)/offres/page.tsx`
 * répond toujours sur `/offres`. Il sert à une seule chose, et elle est
 * structurante : **séparer physiquement ce qui est derrière la porte de la
 * porte elle-même**. `/connexion` vit hors du groupe, donc elle n'hérite pas de
 * cet en-tête — voir le commentaire de `_coquille/en-tete.tsx` pour ce que ce
 * cloisonnement empêche exactement.
 *
 * ⚠️ Ce layout **ne referme pas la porte** : un layout Next.js n'est pas une
 * barrière, il ne s'exécute pas avant les pages qu'il enveloppe et ne peut pas
 * les empêcher de rendre. C'est chaque page qui appelle `exigerSession()` en
 * première ligne.
 */

import type { Metadata } from "next";

import { EnTete } from "./_coquille/en-tete";

/**
 * ⚠️ **`noindex` est déclaré ici, une fois, pour tout le groupe.** Posé page par
 * page, il deviendrait une option qu'on oublie : la prochaine page ajoutée
 * derrière la porte partirait indexable sans le moindre avertissement. C'est
 * l'argument exact que `proxy.ts` oppose à un `matcher` — protéger par défaut,
 * jamais par énumération. Les pages restent libres de définir leur `title`,
 * que Next fusionne avec ce qui est déclaré ici.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CoquilleSite({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col">
      <EnTete />
      {children}
    </div>
  );
}
