import Link from "next/link";

import { FILTRES, LIBELLES_FILTRE, type FiltreListe } from "@/lib/filtres";
import { type Tri } from "@/lib/tri";

import { adresseListe } from "../../_composants/adresse";

/**
 * La barre de filtres de `/offres` : à traiter, nouveau, coup de cœur,
 * candidaté, écarté, toutes.
 *
 * Entre : le filtre actif, le classement en cours (pour le conserver dans les
 * liens) et le compte de chaque onglet.
 * Sort : six liens, dont un marqué comme la page courante.
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
 * ne le distingue pour un lecteur d'écran, qui annoncerait six liens
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
 *
 * ⚠️ **C'est pour ça que « Coup de cœur » n'a PAS d'icône de cœur ici**, le
 * 30 août 2026, alors que c'était le premier réflexe et que la maquette montrée
 * à Maxime en portait une. Une pilule pêche frappée d'un cœur serait l'exact
 * sosie du bouton posé sur chaque ligne — sauf que l'une filtre et que l'autre
 * **écrit en base**. Le libellé en toutes lettres et le chiffre suffisent à la
 * nommer ; le cœur reste le signe du geste, jamais celui de la vue.
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
 * À **80 %** en sombre, les six repassent : violet 5,09:1 · rose 6,03:1 ·
 * bleu 5,78:1 · menthe 7,48:1 · jaune 7,88:1 · **pêche 5,78:1**.
 * En clair à **55 %** : de 7,79:1 (violet) à 9,95:1 (jaune), **pêche 8,28:1**.
 *
 * ⚠️ **L'onglet ENGAGÉ ne porte plus le pastel plein en mode clair depuis le
 * 30 août 2026, mais une teinte assombrie** (`bg-*-engage`) — demande de Maxime,
 * qui voyait que « tout garde la même couleur » sans pouvoir dire pourquoi. La
 * mesure a donné la cause : l'écart de clarté engagé/repos valait **0,8 point
 * sur le jaune et 1,5 sur la menthe**, là où il en faut ~10 pour se voir. Et le
 * réflexe — atténuer davantage le repos — ne pouvait pas marcher : ces deux
 * pastels sont déjà presque blancs, il n'y a pas de place au-dessus.
 * Le détail du calcul est dans `globals.css`, au-dessus de `--primary-engage`.
 * Contrastes de l'encre sur les engagés : violet 4,64:1 · jaune 5,99:1 ·
 * pêche 4,81:1 · menthe 5,81:1 · rose 4,96:1.
 *
 * ⚠️ **En SOMBRE, `--*-engage` vaut le pastel nu** : l'écart y était déjà de 12
 * à 15 points, et les teintes assombries l'auraient ramené à moins de 2. Rien
 * n'a donc changé en mode sombre, et c'est délibéré.
 *
 * ⚠️ **La teinte assombrie n'a PAS suffi, et le motif compte plus que le
 * correctif.** Maxime, devant l'écran, a maintenu qu'il ne repérait pas l'onglet
 * courant — alors que la mesure annonçait 17 à 18 points d'écart, bien au-dessus
 * du seuil. Les deux ont raison : un écart de clarté est un signal **relatif**,
 * et comme chaque pilule porte une teinte différente, repérer « la plus foncée »
 * dans une rangée de six couleurs oblige à les comparer. Un jaune assombri reste
 * plus clair qu'un violet au repos.
 *
 * D'où le **contour sur l'engagée** : c'est le seul signal de cette rangée qui
 * **ne dépend d'aucune couleur**, donc le seul qui se voie sans comparer — et il
 * vaut aussi pour un œil daltonien. Le repos est passé de 55 % à 40 % dans le
 * même geste, ce qui creuse encore l'écart de 2 à 3 points sur le violet, le
 * pêche et le rose — mais **seulement 0,2 sur le jaune et 0,6 sur la menthe**,
 * toujours pour la même raison de plafond.
 *
 * ⚠️ **`border-current` et surtout PAS `border-foreground` — mesuré, pas
 * supposé.** Le premier réflexe fut l'encre de la page ; elle est foncée en
 * clair (le contour passait à 4,64-5,99:1, très bien) et **claire en sombre**,
 * où elle se retrouvait posée sur un pastel clair : **1,52:1**, c'est-à-dire un
 * contour invisible, dans le mode où l'on ne l'aurait jamais cherché.
 * `border-current` reprend la couleur du TEXTE de la pilule — déjà calculée pour
 * être lisible sur ce fond-là — donc 4,64 à 5,99:1 en clair et **9:1** en
 * sombre, sans qu'aucune valeur n'ait à être maintenue en double.
 *
 * ⚠️ **La leçon, déjà écrite une fois dans `boutons-statut.tsx` et qui vient de
 * resservir** : une couleur composée par transparence n'est pas dans la
 * palette, donc elle échappe à la vérification des paires de jetons. Toute
 * opacité posée sur une teinte se remesure **sur la surface qui est vraiment
 * derrière**.
 *
 * ⚠️ **La pilule AU REPOS ne pèse que 1,06 à 1,32:1 contre le fond en mode
 * clair**, très en dessous des 3:1 d'un objet d'interface. Elle est délimitée
 * par le coussin — `cushion-control` pose une lèvre foncée et une ombre portée
 * — et non par sa couleur. C'est la grammaire de 1st-Pouf ; donner à chacune une
 * bordure teintée ferait six contours de six couleurs dans 40 px de haut.
 * ⚠️ **L'ENGAGÉE fait exception depuis le 30 août 2026** : elle seule porte un
 * contour, et il est à l'encre — donc identique quelle que soit sa teinte. Une
 * exception unique se lit comme un signal ; six variantes se liraient comme une
 * décoration.
 *
 * ⚠️ **La bordure fait 2 px sur les SIX, transparente sur les cinq au repos.**
 * Ne la remettre à 1 px que sur les inactives ferait 2 px de largeur d'écart, et
 * **toute la rangée se décalerait à chaque changement de filtre** — un défaut
 * invisible sur une capture et évident à l'usage. C'est la même précaution qui
 * existait déjà pour 1 px, étendue.
 */
const HABITS: Record<FiltreListe, { repos: string; engage: string }> = {
  a_traiter: {
    repos:
      "border-transparent bg-primary/40 dark:bg-primary/80 text-primary-foreground hover:bg-primary dark:hover:bg-primary",
    engage: "border-current bg-primary-engage text-primary-foreground",
  },
  nouvelles: {
    repos:
      "border-transparent bg-signal/40 dark:bg-signal/80 text-signal-foreground hover:bg-signal dark:hover:bg-signal",
    engage: "border-current bg-signal-engage text-signal-foreground",
  },
  /**
   * ⚠️ **Pêche — le sixième et dernier accent du système**, resté libre jusqu'au
   * 30 août 2026 : les cinq autres portaient déjà un rôle chacun. Il n'y en a
   * pas de septième, et c'est une contrainte à connaître avant d'inventer un
   * filtre de plus.
   *
   * ⚠️ **Il est à 1,05:1 du rose d'« Écarté »**, c'est-à-dire de la même clarté
   * exacte : côte à côte dans cette rangée, les deux ne se départagent que par
   * leur teinte — et pas du tout pour un œil protanope. Ce sont **les libellés**
   * qui les séparent, pas les couleurs, et c'est une raison de plus pour
   * qu'aucune de ces pilules ne soit jamais réduite à une pastille.
   */
  coup_de_coeur: {
    repos:
      "border-transparent bg-coup-de-coeur/40 dark:bg-coup-de-coeur/80 text-coup-de-coeur-foreground hover:bg-coup-de-coeur dark:hover:bg-coup-de-coeur",
    engage: "border-current bg-coup-de-coeur-engage text-coup-de-coeur-foreground",
  },
  candidate: {
    repos:
      "border-transparent bg-success/40 dark:bg-success/80 text-success-foreground hover:bg-success dark:hover:bg-success",
    engage: "border-current bg-success-engage text-success-foreground",
  },
  ecarte: {
    repos:
      "border-transparent bg-ecarte/40 dark:bg-ecarte/80 text-ecarte-foreground hover:bg-ecarte dark:hover:bg-ecarte",
    engage: "border-current bg-ecarte-engage text-ecarte-foreground",
  },
  /**
   * ⚠️ **« Toutes » n'a PAS de teinte, et c'est le seul onglet dans ce cas.**
   * Les cinq autres portent la couleur de ce qu'ils montrent ; « Toutes » ne
   * montre rien de particulier — et depuis que le coup de cœur a pris le pêche,
   * il n'existe de toute façon **plus aucune teinte libre** à lui donner.
   *
   * ⚠️ **Son contour permanent a été RETIRÉ le 30 août 2026, et il était devenu
   * franchement contradictoire.** Relevé par Maxime devant l'écran : depuis que
   * le contour signifie « c'est l'onglet où vous êtes », en porter un au repos
   * disait l'inverse de la vérité. Pire — et c'est la relecture du code qui l'a
   * montré — cet onglet portait `border-input` au repos et `border-transparent`
   * **engagé** : il perdait son contour au moment exact où les cinq autres
   * gagnaient le leur.
   *
   * Il se distingue donc désormais comme eux : **par son fond**. Lavande
   * (`bg-accent`) au repos, **blanc** (`bg-card`) engagé, plus le contour commun.
   * Contrastes mesurés : texte au repos **4,51:1** en clair — juste au plancher,
   * à ne pas atténuer davantage — et 6,83:1 en sombre ; engagé 12,17:1 et
   * 14,83:1, contour compris.
   *
   * ⚠️ **En sombre, l'écart de clarté repos/engagé n'est que de 4,7 points**,
   * contre 10,4 en clair : `--card` y est plus SOMBRE que `--accent`. C'est
   * acceptable **parce que le contour porte le signal** — et c'est exactement la
   * raison pour laquelle il a été ajouté : un écart de clarté ne suffisait pas.
   */
  toutes: {
    repos:
      "border-transparent bg-accent text-muted-foreground hover:bg-card hover:text-foreground",
    engage: "border-current bg-card text-foreground",
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
      className={`inline-flex items-center gap-2 rounded-full border-2 px-3.5 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider transition-colors focus-produit ${
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
