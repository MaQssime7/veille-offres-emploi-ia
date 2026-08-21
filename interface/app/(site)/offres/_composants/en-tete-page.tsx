import type { ReactNode } from "react";

/**
 * Le haut de l'écran `/offres` : sur-titre, titre, et la ligne de compte.
 *
 * ⚠️ **Ce composant existe pour être partagé avec `loading.tsx`, et c'est tout
 * son intérêt.** Le repli de chargement n'a de sens que s'il occupe exactement
 * la même hauteur que l'écran final : sinon la page saute au moment où les
 * offres arrivent. En recopiant le balisage dans les deux fichiers, rien ne
 * relie les deux copies — la première modification de l'en-tête (le filtre de
 * statut de la phase 4, par exemple) réintroduit en silence le saut que ce
 * repli servait à éviter, sans erreur de compilation pour le signaler.
 */
export function EnTetePage({ children }: { children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-2 border-b border-border pb-5">
      <p className="libelle-mono text-muted-foreground">
        Poste de travail
      </p>
      <h1 className="font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl">
        Offres
      </h1>
      {children}
    </header>
  );
}

/** L'enveloppe de l'écran, à la largeur du jeton `--largeur-page`. */
export function CadrePage({
  children,
  ...reste
}: React.ComponentProps<"main">) {
  return (
    <main
      className="mx-auto w-full max-w-(--largeur-page) flex-1 px-4 py-8 sm:px-6 sm:py-10"
      {...reste}
    >
      {children}
    </main>
  );
}
