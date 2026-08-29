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
  tri,
}: {
  /** La ligne d'état de la veille, ou son squelette. */
  manchette?: ReactNode;
  /** « 574 offres · 200 affichées ». Absent quand la liste est vide. */
  compte?: ReactNode;
  /** Les cinq onglets de filtre. Absents si la base est injoignable. */
  filtres?: ReactNode;
  /** Le menu de classement, à droite de la même rangée. */
  tri?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-border pb-5">
      {manchette}

      {/* Le titre et son compte forment un bloc serré, détaché des filtres :
          le compte qualifie le titre, les filtres sont une action. Un `gap`
          unique sur tout l'en-tête les mettrait à égale distance et effacerait
          ce rapport. */}
      <div className="flex flex-col gap-2">
        {/* ⚠️ **« Bonjour Maxime » ne NOMME PAS la page, et c'est ce qui rend
            la règle d'à côté inapplicable ici.** Le titre d'onglet et le `h1`
            devaient coïncider parce que tous deux nommaient l'écran — c'était
            vrai de « Plan de travail ». Un salut s'adresse à quelqu'un ; il ne
            désigne rien qu'on puisse mettre en favori. L'onglet garde donc
            « Plan de travail », qui reste ce qu'on lit dans l'historique et
            entre deux onglets ouverts.
            ⚠️ **Il ne change PAS avec l'heure**, délibérément : « Bonsoir » à
            19 h supposerait de connaître le fuseau du visiteur au rendu serveur
            — exactement la classe de bug que `verifie` traque en rejouant les
            tests en UTC. Un salut faux à minuit coûterait plus que la variation
            n'apporte, sur un écran consulté le matin. */}
        <h1 className="font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl">
          Bonjour Maxime
        </h1>
        {compte}
      </div>

      {/* ⚠️ **Les filtres et le classement partagent UNE rangée, et le second
          est collé au bord droit — demande de Maxime, alignée sur la bordure
          droite de la liste.** L'alignement ne se règle pas : il tombe tout
          seul, parce que cet en-tête et la liste vivent dans le même
          `CadrePage`, donc dans la même largeur `--largeur-page`. Poser une
          marge à la main ici la ferait diverger au premier ajustement de
          `CadrePage`.

          ⚠️ **`flex-col` en dessous de 640 px, et pas un `flex-wrap`.** Avec
          `justify-between` et un retour à la ligne, le bouton se serait retrouvé
          collé à GAUCHE sur sa propre ligne — c'est-à-dire aligné sur rien.
          Empilés, les deux blocs commencent au même bord.

          ⚠️ **`items-start` sur la colonne, et c'est un défaut VU à l'écran.**
          Sans lui, l'alignement par défaut (`stretch`) étirait le bouton
          « Trier » sur toute la largeur à 375 px : un réglage secondaire prenait
          l'apparence du bouton d'action principal de l'écran. */}
      {(filtres || tri) && (
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          {filtres}
          {tri}
        </div>
      )}
    </header>
  );
}

/*
 * ⚠️ **`CadrePage` a QUITTÉ ce fichier le 30 août 2026** — elle vit désormais
 * dans `app/(site)/_composants/cadre-page.tsx`. Elle enveloppe tous les écrans
 * du site, y compris `/`, qui n'a rien à faire de l'en-tête de `/offres`.
 */
