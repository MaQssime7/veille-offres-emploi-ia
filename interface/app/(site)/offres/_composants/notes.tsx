import { TriangleAlert } from "lucide-react";

import type { OffreEnListe } from "@/lib/offres";

import { CartoucheAbsent } from "./cartouche";
import { RYTHME_LIGNE } from "./rythme";

/**
 * Les seuls champs dont la notation a besoin pour s'afficher.
 *
 * ⚠️ **Ce type existe pour que la liste et la fiche partagent le MÊME
 * composant, pas deux copies.** Les justifications sont l'instrument qui révèle
 * une notation mal étalonnée : deux rendus divergents, et une note bizarre
 * s'afficherait différemment selon l'écran où on la regarde. `OffreEnListe` et
 * `OffreEnFiche` le satisfont tous les deux sans rien déclarer — TypeScript
 * compare les formes, pas les noms.
 */
export type ChampsNotation = Pick<
  OffreEnListe,
  | "note_interet"
  | "justification_interet"
  | "note_accessibilite"
  | "justification_accessibilite"
  | "notation_motif_echec"
  | "notation_tentatives"
>;

/**
 * Où en est la notation d'une offre. Trois cas, et **un seul endroit qui les
 * distingue**.
 *
 * ⚠️ **L'échec se teste AVANT l'absence de note.** Les deux se ressemblent en
 * base — pas de note dans les deux cas — mais ils ne disent pas la même chose :
 * « on n'a pas encore regardé » contre « on a regardé et ça a raté ». Tester
 * l'absence de note en premier écraserait le second et l'échec deviendrait
 * invisible, ce qui est exactement ce que la colonne `notation_motif_echec`
 * existe pour empêcher.
 *
 * ⚠️ **Une offre à moitié notée est physiquement impossible** en base
 * (contraintes `notes_indissociables`, `interet_justifie` et
 * `accessibilite_justifiee` de la migration du 26 août 2026). C'est ce qui
 * autorise à traiter les deux notes comme un bloc, sans cas mixte à gérer.
 */
export type EtatNotation = "notee" | "en-attente" | "echec";

export function etatNotation(offre: ChampsNotation): EtatNotation {
  if (offre.notation_motif_echec !== null) return "echec";
  if (offre.note_interet === null || offre.note_accessibilite === null) {
    return "en-attente";
  }
  return "notee";
}

/**
 * Les deux notes d'une offre, en liste.
 *
 * Entre : l'offre lue en base.
 * Sort : soit les deux barres avec leur justification, soit le message d'échec.
 * Casse : rien à l'exécution.
 *
 * ⚠️ **Ce bloc ne se rend PAS pour une offre en attente de note.** Le cas est
 * porté par un cartouche dans la rangée des métadonnées (`CartoucheEnAttente`
 * ci-dessous) — c'est `ligne-offre.tsx` qui arbitre. Mesuré le 26 août 2026 :
 * en bloc séparé, avec son filet et ses marges, « pas encore notée » coûtait
 * **42 px de hauteur pour une phrase d'excuse**, sur 103 des 200 lignes
 * affichées. Un état vide ne doit pas être plus encombrant que l'état plein.
 *
 * ⚠️ **Les justifications se lisent À PLAT, jamais derrière une infobulle ni un
 * dépliage.** C'est une décision de produit, pas une paresse de mise en page :
 * c'est le seul mécanisme qui révèle une notation mal étalonnée. Une note
 * bizarre cachée derrière un survol ne se découvre jamais — et le 26 août, le
 * barème d'accessibilité a précisément été corrigé parce qu'on a pu LIRE
 * pourquoi le modèle mettait 40 là où le barème commandait 90.
 */
export function BlocNotes({ offre }: { offre: ChampsNotation }) {
  return (
    <div className={RYTHME_LIGNE.blocNotes}>
      <ContenuNotes offre={offre} />
    </div>
  );
}

export function ContenuNotes({ offre }: { offre: ChampsNotation }) {
  if (etatNotation(offre) !== "notee") {
    return <NotationEnEchec tentatives={offre.notation_tentatives} />;
  }

  return (
    // Deux colonnes en bureau, empilées sous 640 px. Empilées partout, la ligne
    // passerait de 170 à 210 px : sur une liste de 200 offres c'est un tiers
    // d'écran perdu à chaque ligne.
    <div className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
      <Note
        libelle="Intérêt"
        valeur={offre.note_interet as number}
        justification={offre.justification_interet}
        remplissage="bg-primary"
        teinteLibelle="text-primary"
      />
      <Note
        libelle="Accessibilité"
        valeur={offre.note_accessibilite as number}
        justification={offre.justification_accessibilite}
        remplissage="bg-success"
        teinteLibelle="text-success"
      />
    </div>
  );
}

/**
 * Une note : son libellé, sa barre, son chiffre, sa justification dessous.
 *
 * ⚠️ **Le libellé ne se retire jamais, et il s'écrit en toutes lettres.** Sans
 * lui, la distinction entre les deux notes ne tiendrait que sur la teinte :
 * perdue pour un daltonien, perdue sur un partage d'écran compressé — et le
 * partage d'écran en entretien est un usage réel de ce produit. Les
 * abréviations `INT` / `ACC` ont été abandonnées le 26 août 2026 parce qu'elles
 * demandaient un décodage au premier regard.
 *
 * ⚠️ **La barre porte `aria-hidden`, et ce n'est pas la mettre de côté.** Elle
 * ne fait que redessiner le chiffre qui est juste à côté ; annoncée en plus,
 * un lecteur d'écran lirait deux fois la même note. L'information vocale est
 * portée par « Intérêt 85 sur 100 », qui est du texte.
 */
function Note({
  libelle,
  valeur,
  justification,
  remplissage,
  teinteLibelle,
}: {
  libelle: string;
  valeur: number;
  justification: string | null;
  remplissage: string;
  /**
   * ⚠️ **Le libellé prend la teinte de SA jauge, et c'est le système qui le
   * demande.** `docs/DESIGN.md` attribue un rôle unique à chaque teinte :
   * brun-encre = « action principale · note d'intérêt · texte », olive =
   * « accessibilité ». Colorer ces deux mots n'invente rien, ça applique la
   * table — et ça relie le libellé à sa barre pour l'œil.
   *
   * ⚠️ **Ça ne remplace PAS le libellé, ça le renforce.** L'information reste
   * portée par le mot écrit en toutes lettres : la couleur seule est interdite
   * par le plancher d'accessibilité du projet.
   *
   * Contrastes recalculés le 28 août 2026, sur le fond des cartes :
   * brun 11,53:1 en clair et 11,74:1 en sombre · olive 6,13:1 et 6,74:1 —
   * tous au-dessus du plancher de 4,5:1 exigé pour du texte.
   */
  teinteLibelle: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {/* Largeur fixe : c'est elle qui aligne les barres d'une offre à
            l'autre, et cet alignement est ce qui permet de comparer deux
            offres d'un coup d'œil sans lire les chiffres.
            ⚠️ **108 px et non 104**, mesuré au DOM le 26 août 2026 :
            « ACCESSIBILITÉ » rendu en Geist Mono fait **exactement 104 px**,
            soit zéro marge. Geist Mono est une police web ; le temps qu'elle
            charge, ou si elle ne charge pas du tout, le repli système est plus
            large et pousse la barre — l'alignement d'une ligne à l'autre, qui
            est toute la raison d'être de cette largeur fixe, tombe alors sans
            que rien ne le signale. `whitespace-nowrap` empêche en plus le
            libellé de se couper en deux lignes. */}
        <span
          className={`libelle-mono w-[6.75rem] shrink-0 whitespace-nowrap font-semibold ${teinteLibelle}`}
        >
          {libelle}
        </span>

        <span
          aria-hidden="true"
          className="box-border h-2 w-[5.5rem] shrink-0 overflow-hidden border border-border bg-secondary"
        >
          {/* La largeur est un pourcentage calculé au rendu : Tailwind lit le
              code source pour savoir quelles classes produire, il ne peut donc
              pas générer `w-[85%]` pour une valeur connue seulement à
              l'exécution. Le style en ligne est ici la solution correcte, pas
              un raccourci.
              ⚠️ À 0, la barre disparaît — c'est voulu, et l'information ne
              tient pas dessus : le chiffre « 0 » reste écrit à côté. */}
          <span
            className={`block h-full ${remplissage}`}
            style={{ width: `${valeur}%` }}
          />
        </span>

        <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
          {valeur}
          <span className="sr-only"> sur 100</span>
        </span>
      </div>

      {justification && (
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
          {justification}
        </p>
      )}
    </div>
  );
}

/**
 * L'offre attend son tour, dit dans la rangée des métadonnées.
 *
 * ⚠️ **Surtout pas deux barres vides.** Elles se liraient « notée 0 sur 100 »,
 * c'est-à-dire l'inverse exact de ce qui est vrai — et sur 438 offres, pas sur
 * un cas rare. `NULL` veut dire « pas encore notée », jamais « zéro » : la
 * règle est gravée dans les commentaires de la migration, elle doit tenir
 * jusqu'à l'écran.
 *
 * ⚠️ **C'est le même cartouche creux que « Salaire non précisé », et c'est
 * voulu.** Les deux disent la même chose — l'information n'existe pas encore —
 * et le produit a déjà un traitement pour ça : filet pointillé, italique,
 * aucune teinte propre. En inventer un second dirait au lecteur qu'il y a deux
 * sortes de vide.
 */
export function CartoucheEnAttente() {
  return <CartoucheAbsent>Pas encore notée</CartoucheAbsent>;
}

/**
 * La notation a été tentée et a échoué.
 *
 * ⚠️ **Le motif technique n'est pas affiché.** Il porte un message d'exception
 * (`APIStatusError : 529 …`) : lisible sur la fiche d'une offre, illisible
 * répété sur deux cents lignes.
 *
 * ⚠️ **Cette phrase ne promet PLUS la reprise, et c'est une correction.** Elle
 * disait « elle sera reprise à la prochaine notation » — vrai deux fois, faux
 * la troisième : le pipeline cesse de reprendre une offre au-delà de
 * `MAX_TENTATIVES` (`pipeline/notation.py`), et la page aurait continué à
 * promettre un rattrapage qui n'arriverait jamais, à chaque chargement, pour
 * toujours. **Un écran qui rassure sans savoir est pire qu'un écran qui se
 * tait.**
 *
 * On affiche donc le **compte brut de tentatives**, qui est un fait, et jamais
 * une conclusion tirée d'un seuil. ⚠️ **Recopier `MAX_TENTATIVES` ici pour
 * écrire « abandonnée » serait le vrai piège** : le seuil vit dans le pipeline,
 * c'est lui qui décide, et deux copies d'une même limite divergent toujours.
 * Le lecteur, lui, voit « 3 tentatives » et en tire ce qu'il faut.
 *
 * ⚠️ **L'icône n'est pas décorative** : sans elle, l'état ne se distinguerait
 * de « pas encore notée » que par la couleur du texte, ce que le plancher
 * d'accessibilité du projet interdit.
 */
function NotationEnEchec({ tentatives }: { tentatives: number }) {
  return (
    <p className="flex items-start gap-2 text-[0.8125rem] leading-relaxed text-destructive">
      <TriangleAlert
        className="mt-0.5 size-3.5 shrink-0"
        aria-hidden="true"
      />
      <span>
        Notation impossible après {tentatives}&nbsp;tentative
        {tentatives >= 2 ? "s" : ""}. L’offre reste en base, sans note.
      </span>
    </p>
  );
}
