import type { ReactNode } from "react";

/**
 * Le haut de l'écran `/offres` : la manchette d'état, le titre, le compte et
 * les filtres.
 *
 * ⚠️ **Ce composant existe pour être partagé avec `loading.tsx`, et c'est tout
 * son intérêt.** Le repli de chargement n'a de sens que s'il occupe exactement
 * la même hauteur que l'écran final : sinon la page saute au moment où les
 * offres arrivent. En recopiant le balisage dans les deux fichiers, rien ne
 * relie les deux copies — la première modification de l'en-tête réintroduit en
 * silence le saut que ce repli servait à éviter, sans erreur de compilation
 * pour le signaler.
 *
 * ⚠️ **Les trois zones sont des propriétés NOMMÉES, plus un `children`
 * fourre-tout.** C'est ce changement qui rend l'égalité avec le squelette
 * vérifiable : les deux appelants remplissent les mêmes cases, et en oublier
 * une se voit dans le code au lieu de se voir à l'écran. Avec un `children`
 * unique, la page passait deux blocs et le squelette trois — l'écart était
 * invisible.
 *
 * ⚠️ **Refonte du 29 août 2026, décidée en regardant l'écran.** Ce qu'il y
 * avait avant : un sur-titre « Poste de travail » et un `h1` « Offres ». Trois
 * défauts, dont deux qui ne se voient qu'en cherchant :
 *
 * 1. Le sur-titre nommait **une catégorie sans sœur**. « Poste de travail »
 *    distinguerait cet écran d'un autre s'il y en avait plusieurs ; le produit
 *    a un seul utilisateur et trois écrans qui ne se confondent pas.
 * 2. « Offres » **redisait ce que la liste montre déjà**. Un titre qui nomme le
 *    contenu visible n'ajoute rien ; « Plan de travail » nomme ce que l'écran
 *    *est* — ce qui reste à faire — et c'est déjà le mot qu'emploie le code.
 * 3. Le bandeau **n'avait aucune place pour l'état de la veille**, que la
 *    phase 5 exige « visible en permanence ». Le redessiner après aurait été le
 *    redessiner deux fois.
 */
export function EnTetePage({
  manchette,
  compte,
  filtres,
}: {
  /** La ligne d'état de la veille, ou son squelette. */
  manchette?: ReactNode;
  /** « 574 offres · 140 notées ». Absent quand la liste est vide. */
  compte?: ReactNode;
  /** Les quatre onglets de statut. Absents si la base est injoignable. */
  filtres?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-border pb-5">
      {manchette}

      {/* Le titre et son compte forment un bloc serré, détaché des filtres :
          le compte qualifie le titre, les filtres sont une action. Un `gap`
          unique sur tout l'en-tête les mettrait à égale distance et effacerait
          ce rapport. */}
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl">
          Plan de travail
        </h1>
        {compte}
      </div>

      {filtres}
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
