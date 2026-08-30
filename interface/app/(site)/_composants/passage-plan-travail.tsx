import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { accorder } from "@/lib/francais";
import { FILTRE_PAR_DEFAUT } from "@/lib/filtres";
import { TRI_PAR_DEFAUT } from "@/lib/tri";

import { adresseListe } from "./adresse";

/**
 * Le passage de l'écran du matin vers le plan de travail.
 *
 * Entre : le nombre d'offres à traiter qui ne viennent pas de la collecte
 * affichée.
 * Sort : une carte cliquable qui mène à `/offres`.
 * Casse : rien.
 *
 * ⚠️ **C'est ce lien qui rend acceptable le parti pris de l'écran du matin.**
 * `/` ne montre qu'une nuit, et seulement ce qui dépasse le seuil d'intérêt :
 * sans cette ligne, tout le reste de la base disparaîtrait sans laisser de
 * trace, et un matin calme ressemblerait à une base vide. Critère
 * d'acceptation de la phase 5 : le nombre y est **chiffré**, précisément pour
 * que l'oubli soit impossible.
 *
 * ⚠️ **Il s'affiche aussi — et surtout — sous les écrans vides.** C'est là
 * qu'il sert le plus : le jour où la nuit n'a rien rapporté, il reste 380
 * offres à trier ailleurs.
 *
 * ⚠️ **L'adresse passe par `adresseListe()` et n'est pas écrite en dur.** Le
 * filtre par défaut ne s'inscrit pas dans l'URL : `/offres` et
 * `/offres?statut=a_traiter` mènent au même écran mais font deux entrées
 * d'historique et deux favoris possibles. La fonction est la seule à détenir
 * cette règle.
 */
export function PassagePlanTravail({ enAttente }: { enAttente: number }) {
  return (
    <Link
      href={adresseListe(FILTRE_PAR_DEFAUT, TRI_PAR_DEFAUT)}
      // ⚠️ **Le focus passe par `outline`, jamais par `ring`.** La carte porte
      // un `cushion-card`, c'est-à-dire un `box-shadow` brut, et les `ring-*`
      // de Tailwind empruntent la même propriété : l'anneau disparaîtrait
      // purement et simplement du style calculé. C'est le défaut d'accessibilité
      // trouvé en mesurant le 29 août 2026, sur toute la refonte.
      className="mt-6 flex items-center justify-between gap-4 rounded-2xl bg-card px-5 py-4 cushion-card transition-shadow hover:cushion-row-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground sm:px-6"
    >
      <span className="text-sm leading-snug text-foreground">
        {/* ⚠️ **« autres » et non « plus anciennes » — correctif de revue du
            30 août 2026.** Le compteur retranche les offres AFFICHÉES, pas
            celles de la collecte : il inclut donc les offres de la nuit restées
            sous le seuil, qui ne sont pas plus anciennes du tout. Le mot
            précédent aurait fait mentir le chiffre le jour où une nuit entière
            passe sous 50. */}
        <strong className="font-semibold">{enAttente}</strong>{" "}
        {accorder(enAttente, "autre")} {accorder(enAttente, "offre")}{" "}
        {/* ⚠️ Le verbe s'accorde à la main : `accorder()` ne sait ajouter qu'un
            « s », ce qui donnerait « attends ». Elle est faite pour les noms et
            les adjectifs, et l'étendre aux verbes demanderait une table de
            conjugaison pour un seul appelant. */}
        {enAttente >= 2 ? "attendent" : "attend"} dans le plan de travail
      </span>
      <ArrowRight
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
    </Link>
  );
}

/**
 * Le squelette du passage, pour `loading.tsx`.
 *
 * ⚠️ **Il vit dans le même fichier que la carte réelle**, comme la ligne d'état
 * de la veille : rien ne relie mécaniquement un squelette à ce qu'il double, et
 * le projet a déjà payé trois sauts de mise en page pour l'avoir oublié. Les
 * garder côte à côte est le seul rappel qui survive à six mois.
 *
 * ⚠️ **Sa hauteur est CALCULÉE, pas choisie à l'œil** : `py-4` (2 × 16 px) plus
 * une ligne de `text-sm` à `leading-snug` (14 × 1,375 = 19,25 px), soit
 * 51,25 px. La barre grise reprend la hauteur du texte, l'enveloppe reprend les
 * marges — les deux boîtes font donc la même hauteur par construction, et pas
 * par coïncidence.
 *
 * ⚠️ **Le squelette est affiché INCONDITIONNELLEMENT, la carte non.** Elle
 * disparaît quand plus rien n'attend ailleurs, ou quand le compte n'a pas pu
 * être fait. C'est un écart assumé, calé sur le cas courant : au 30 août 2026,
 * 571 offres sont à traiter, donc la carte s'affiche tous les matins. Le jour
 * où la base sera vidée de son arriéré, l'écart de 51 px se produira sur un
 * écran qui n'a de toute façon plus rien à montrer.
 */
export function SquelettePassage() {
  return (
    <div
      aria-hidden="true"
      className="mt-6 flex items-center justify-between gap-4 rounded-2xl bg-card px-5 py-4 cushion-card sm:px-6"
    >
      {/* ⚠️ **DEUX barres sous 640 px, une seule au-dessus — mesuré au DOM le
          30 août 2026.** La phrase réelle (« 570 autres offres attendent dans le
          plan de travail ») tient sur une ligne en bureau et se replie sur deux
          à 375 px : la carte y passe de 51 à 71 px. Une barre unique calait donc
          le bureau et se trompait de 20 px sur téléphone, c'est-à-dire là où le
          repli existe. */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="h-[1.203125rem] w-[16rem] max-w-full animate-pulse rounded-full bg-muted" />
        <div className="h-[1.203125rem] w-[9rem] max-w-full animate-pulse rounded-full bg-muted sm:hidden" />
      </div>
      <div className="size-4 shrink-0 animate-pulse rounded-full bg-muted" />
    </div>
  );
}
