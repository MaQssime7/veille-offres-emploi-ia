import Link from "next/link";

import { FILTRES, LIBELLES_FILTRE, type FiltreListe } from "@/lib/filtres";
import { type Tri } from "@/lib/tri";

import { adresseListe } from "../../_composants/adresse";

/**
 * La barre de filtres de `/offres` : à traiter, nouveau, candidaté, écarté,
 * toutes.
 *
 * Entre : le filtre actif, le classement en cours (pour le conserver dans les
 * liens) et le compte de chaque onglet.
 * Sort : cinq liens, dont un marqué comme la page courante.
 * Casse : un compte à `null` masque son chiffre — l'onglet reste cliquable.
 *
 * ⚠️ **Ce sont des LIENS, jamais des boutons, et c'est le critère
 * d'acceptation lui-même.** Le plan exige que « `/offres?statut=candidate` se
 * mette en favori et survive au bouton retour ». Des boutons avec un état React
 * donneraient le même écran et perdraient les deux : rien à mettre en favori,
 * et le retour arrière quitterait la page au lieu de revenir au filtre
 * précédent. Un `<Link>` écrit l'état dans l'adresse, qui est le seul endroit
 * qu'un navigateur sait conserver.
 *
 * ⚠️ **`aria-current="page"` et non une simple classe CSS.** L'onglet actif se
 * distingue à l'œil par sa saturation et son relief ; sans cet attribut, rien
 * ne le distingue pour un lecteur d'écran, qui annoncerait cinq liens
 * identiques. Le plancher du projet interdit qu'une information tienne sur la
 * seule apparence.
 *
 * ⚠️ **REVIREMENT du 29 août 2026, demandé par Maxime et assumé comme tel.**
 * Ce fichier portait la règle inverse : « l'actif se marque par le FOND violet,
 * jamais par une teinte de signal — colorer l'onglet Candidaté en menthe le
 * ferait ressembler à un bouton de statut alors qu'il n'en change aucun ». La
 * teinte est désormais celle du statut filtré, et **le risque décrit alors est
 * réel, pas théorique** : dans la liste, un bouton menthe ÉCRIT en base ; en
 * haut, une pilule menthe ne fait que filtrer.
 *
 * Ce qui les sépare, et qu'il ne faut pas effacer par mégarde :
 *
 * | | Pilule de filtre | Bouton de statut |
 * |---|---|---|
 * | Position | dans l'en-tête, une seule fois | dans chaque ligne, deux fois |
 * | Contenu | libellé **+ un chiffre** | libellé **+ une icône** |
 * | Effet | change l'adresse | écrit en base |
 *
 * Le chiffre et l'icône sont donc porteurs : leur retrait « pour gagner de la
 * place » rendrait les deux objets indiscernables.
 */
export function FiltresStatut({
  actif,
  tri,
  comptes,
}: {
  actif: FiltreListe;
  /** Conservé dans chaque lien : changer de filtre ne doit pas reclasser. */
  tri: Tri;
  /** Le compte de chaque onglet. `null` = comptage impossible. */
  comptes: Record<FiltreListe, number | null>;
}) {
  return (
    // `nav` et non une simple `div` : un lecteur d'écran peut sauter
    // directement à un point de repère de navigation.
    <nav aria-label="Filtrer les offres" className="flex flex-wrap gap-1.5">
      {/* ⚠️ **L'ordre et les libellés viennent de `lib/filtres.ts`, pas d'une
          liste écrite ici** — correctif de revue du 29 août 2026. Une liste
          locale et le `LIBELLES_FILTRE` de `page.tsx` nommaient les mêmes
          onglets deux fois : l'état vide dit « Aucune offre "Nouveau" » en
          reprenant le second, et deux libellés divergents auraient fait croire
          à deux filtres différents. */}
      {FILTRES.map((filtre) => (
        <OngletFiltre
          key={filtre}
          filtre={filtre}
          libelle={LIBELLES_FILTRE[filtre]}
          compte={comptes[filtre]}
          actif={filtre === actif}
          tri={tri}
        />
      ))}
    </nav>
  );
}

/**
 * L'habit de chaque onglet : sa teinte au repos et engagé.
 *
 * ⚠️ **Les opacités sont MESURÉES sur le fond de page, pas reprises des boutons
 * de statut** — et c'est ce qui a changé un chiffre. Les boutons de la liste
 * sont posés sur une carte blanche et s'atténuent à `55 % / 70 %` ; ces
 * pilules-ci sont sur le fond de page, qui est presque noir en mode sombre.
 * Mesuré le 29 août 2026 : à 70 %, le violet de « À traiter » ne portait plus
 * que **4,11:1** — sous le plancher de 4,5:1 — parce qu'il se mélange vers
 * `#12111a` au lieu de `#211f2b`.
 *
 * À **80 %** en sombre, les cinq repassent : violet 5,09:1 · rose 6,03:1 ·
 * bleu 5,78:1 · menthe 7,48:1 · jaune 7,88:1.
 * En clair à **55 %** : de 7,79:1 (violet) à 9,95:1 (jaune).
 *
 * ⚠️ **La leçon, déjà écrite une fois dans `boutons-statut.tsx` et qui vient de
 * resservir** : une couleur composée par transparence n'est pas dans la
 * palette, donc elle échappe à la vérification des paires de jetons. Toute
 * opacité posée sur une teinte se remesure **sur la surface qui est vraiment
 * derrière**.
 *
 * ⚠️ **La pilule elle-même ne pèse que 1,06 à 1,32:1 contre le fond en mode
 * clair**, très en dessous des 3:1 d'un objet d'interface. Elle est délimitée
 * par le coussin — `cushion-control` pose une lèvre foncée et une ombre portée
 * — et non par sa couleur, exactement comme les boutons de statut. C'est la
 * grammaire de 1st-Pouf ; la remplacer par une bordure teintée ferait cinq
 * contours de cinq couleurs dans un espace de 40 px de haut.
 */
const HABITS: Record<FiltreListe, { repos: string; engage: string }> = {
  a_traiter: {
    repos:
      "border-transparent bg-primary/55 dark:bg-primary/80 text-primary-foreground hover:bg-primary dark:hover:bg-primary",
    engage: "border-transparent bg-primary text-primary-foreground",
  },
  nouvelles: {
    repos:
      "border-transparent bg-signal/55 dark:bg-signal/80 text-signal-foreground hover:bg-signal dark:hover:bg-signal",
    engage: "border-transparent bg-signal text-signal-foreground",
  },
  candidate: {
    repos:
      "border-transparent bg-success/55 dark:bg-success/80 text-success-foreground hover:bg-success dark:hover:bg-success",
    engage: "border-transparent bg-success text-success-foreground",
  },
  ecarte: {
    repos:
      "border-transparent bg-ecarte/55 dark:bg-ecarte/80 text-ecarte-foreground hover:bg-ecarte dark:hover:bg-ecarte",
    engage: "border-transparent bg-ecarte text-ecarte-foreground",
  },
  /**
   * ⚠️ **« Toutes » n'a PAS de teinte, et c'est le seul onglet dans ce cas.**
   * Les quatre autres portent la couleur de ce qu'ils montrent ; « Toutes » ne
   * montre rien de particulier — lui donner une sixième teinte inventerait un
   * signal qui ne signale rien. Il se distingue par son contour, ce qui se lit
   * comme « aucun filtre » plutôt que comme « un filtre de plus ».
   */
  toutes: {
    repos: "border-input text-muted-foreground hover:bg-accent hover:text-foreground",
    engage: "border-transparent bg-card text-foreground",
  },
};

function OngletFiltre({
  filtre,
  libelle,
  compte,
  actif,
  tri,
}: {
  filtre: FiltreListe;
  libelle: string;
  compte: number | null;
  actif: boolean;
  tri: Tri;
}) {
  const habit = HABITS[filtre];

  return (
    <Link
      href={adresseListe(filtre, tri)}
      aria-current={actif ? "page" : undefined}
      // ⚠️ **Le relief S'INVERSE entre repos et engagé, et c'est le second
      // signal — pas une décoration.** Le pastel atténué contre le pastel plein
      // se compare mal quand les cinq onglets sont côte à côte ; le coussin
      // bombé contre le coussin enfoncé se voit sur un seul. C'est la grammaire
      // de 1st-Pouf, qui fournit les deux recettes exactement pour ça, et la
      // même que les boutons de statut de la liste.
      //
      // ⚠️ **Tous les onglets portent `border`, et la COULEUR vient de leur
      // habit** — jamais d'un `border-transparent` posé ici. C'est un correctif
      // de revue du 29 août 2026, et le défaut qu'il répare est invisible dans
      // le code : `border-transparent` en classe de base et `border-input` dans
      // l'habit sont **deux utilitaires de même propriété et même
      // spécificité**, départagés par leur ordre dans la feuille compilée. Le
      // transparent gagnait. Mesuré : `border-color: rgba(0, 0, 0, 0)` sur
      // « Toutes » dans les deux modes — c'est-à-dire le seul onglet sans
      // teinte réduit à du texte flottant, sans contour ni limite de cible.
      //
      // ⚠️ **La bordure reste sur les cinq**, transparente sur les quatre
      // teintés : sans elle, ils seraient **2 px plus étroits** en `border-box`
      // et chaque changement de filtre décalerait toute la rangée.
      //
      // ⚠️ **Le focus passe par `outline` (`focus-produit`) et jamais par
      // `ring`** : les `cushion-*` posent un `box-shadow` brut, les `ring-*` de
      // Tailwind passent par cette même propriété, et le coussin gagne —
      // l'anneau serait dans la classe et absent du style calculé.
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider transition-colors focus-produit ${
        actif
          ? `cushion-control-active font-bold ${habit.engage}`
          : `cushion-control font-semibold ${habit.repos}`
      }`}
    >
      {libelle}
      {/* ⚠️ **Un compte `null` n'affiche PAS zéro.** Le comptage a échoué : dire
          « 0 » affirmerait qu'il n'y a aucune offre dans ce filtre, ce qui est
          une information inventée. Le même `NULL` ≠ `0` que la base applique
          aux notes, tenu jusqu'à l'écran.

          ⚠️ **`opacity-70` a été RETIRÉ le 29 août 2026, et c'était un défaut
          mesuré.** Le chiffre était atténué pour se détacher du libellé ; posé
          sur un pastel plein, l'encre à 70 % tombait à **3,43:1** sur le violet
          engagé. Le contraste entre libellé et chiffre passe désormais par la
          seule graisse, qui ne coûte rien en lisibilité. */}
      {compte !== null && (
        <span className="tabular-nums font-normal">{compte}</span>
      )}
    </Link>
  );
}
