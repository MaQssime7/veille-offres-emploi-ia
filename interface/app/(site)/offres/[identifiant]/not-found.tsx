import { FileQuestion } from "lucide-react";
import Link from "next/link";

import { CadrePage } from "../_composants/en-tete-page";

/**
 * Il n'y a rien à cette adresse.
 *
 * ⚠️ **Un seul écran pour DEUX causes, volontairement confondues** : un
 * identifiant mal formé, et un identifiant bien formé qui ne correspond à
 * aucune offre. Les distinguer apprendrait à un visiteur quels identifiants
 * sont valides, sans rien apporter à Maxime — qui, dans les deux cas, n'a qu'à
 * revenir à la liste.
 *
 * ⚠️ **Ce n'est pas un écran d'erreur.** Ni ton alarmant, ni couleur destructive
 * réservée aux vraies pannes : une adresse périmée dans un favori est un
 * événement banal, pas un incident. La panne de base, elle, a son propre écran
 * (`BaseInjoignable`), et c'est la page qui arbitre entre les deux.
 */
export default function OffreIntrouvable() {
  return (
    <CadrePage>
      <div className="flex flex-col items-start gap-3 border border-border bg-card px-5 py-8 sm:px-8 sm:py-10">
        <span className="text-muted-foreground">
          <FileQuestion className="size-6" aria-hidden="true" />
        </span>
        <h1 className="font-display text-xl font-bold leading-tight text-foreground">
          Cette offre est introuvable
        </h1>
        <div className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          <p>
            Aucune offre ne correspond à cette adresse. Elle n’a peut-être
            jamais été collectée, ou l’adresse est incomplète.
          </p>
        </div>
        <Link
          href="/offres"
          className="mt-2 inline-flex items-center border border-border px-3 py-2 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-accent"
        >
          Revenir à toutes les offres
        </Link>
      </div>
    </CadrePage>
  );
}
