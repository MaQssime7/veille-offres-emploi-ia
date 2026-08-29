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

/**
 * ⚠️ **Deux densités, et c'est la seule raison d'être de cette propriété.**
 * Le même bloc sert la liste et la fiche, qui ne se lisent pas de la même façon :
 *
 * | | Liste | Fiche |
 * |---|---|---|
 * | Ce qu'on y fait | balayer 200 lignes | lire UNE offre |
 * | Ce que coûte l'air | du défilement, à chaque ligne | rien, la page est courte |
 *
 * Serrer la liste est donc juste, et l'appliquer à la fiche était un défaut —
 * relevé par Maxime le 29 août 2026 en regardant l'écran : « c'est un peu trop
 * compacté, alors qu'il y a de la place ». **Ne pas unifier les deux** : ce
 * serait rendre à la liste l'air qu'elle n'a pas les moyens de payer.
 */
export function ContenuNotes({
  offre,
  aere = false,
}: {
  offre: ChampsNotation;
  /** `true` sur la fiche, où l'on lit ; `false` en liste, où l'on balaye. */
  aere?: boolean;
}) {
  if (etatNotation(offre) !== "notee") {
    return <NotationEnEchec tentatives={offre.notation_tentatives} />;
  }

  return (
    // Deux colonnes en bureau, empilées sous 640 px. Empilées partout, la ligne
    // passerait de 170 à 210 px : sur une liste de 200 offres c'est un tiers
    // d'écran perdu à chaque ligne.
    //
    // ⚠️ **L'écart HORIZONTAL grandit aussi, et pas seulement le vertical.**
    // Les deux justifications sont deux textes différents posés côte à côte : à
    // 32 px, la dernière ligne de la colonne de gauche et la première de droite
    // se lisent comme une seule phrase qui court. C'est le défaut le plus net
    // sur une fiche large.
    <div
      className={`grid sm:grid-cols-2 ${aere ? "gap-x-12 gap-y-6" : "gap-x-8 gap-y-2.5"}`}
    >
      <Note
        libelle="Intérêt"
        valeur={offre.note_interet as number}
        justification={offre.justification_interet}
        remplissage="bg-interet-barre"
        piste="bg-interet-piste"
        teinteLibelle="text-interet-texte"
        aere={aere}
      />
      <Note
        libelle="Accessibilité"
        valeur={offre.note_accessibilite as number}
        justification={offre.justification_accessibilite}
        remplissage="bg-success-barre"
        piste="bg-success-piste"
        teinteLibelle="text-success-texte"
        aere={aere}
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
  piste,
  teinteLibelle,
  aere = false,
}: {
  libelle: string;
  valeur: number;
  justification: string | null;
  remplissage: string;
  /**
   * Le fond de la barre, dans le pastel de la même note. ⚠️ **Il vient en
   * paire avec `remplissage` : les deux doivent toujours être de la même
   * famille**, sinon la barre porte deux teintes et la règle « un rôle, une
   * couleur » tombe à l'endroit précis où elle compte le plus.
   */
  piste: string;
  /**
   * ⚠️ **Le libellé prend la teinte de SA jauge, et c'est le système qui le
   * demande.** `docs/DESIGN.md` attribue un rôle unique à chaque teinte : bleu
   * = intérêt, menthe = accessibilité et candidaté. Colorer ces deux mots
   * n'invente rien, ça applique la table — et ça relie le libellé à sa barre
   * pour l'œil.
   *
   * ⚠️ **Ça ne remplace PAS le libellé, ça le renforce.** L'information reste
   * portée par le mot écrit en toutes lettres : la couleur seule est interdite
   * par le plancher d'accessibilité du projet.
   *
   * ⚠️ **Le libellé et la barre ne prennent PAS le même jeton, depuis la
   * refonte du 29 août 2026.** Le libellé est du texte — 4,5:1 —, la barre est
   * un objet graphique — 3:1. Deux seuils, donc deux valeurs : `-texte` pour le
   * mot, `-barre` pour la jauge. Les confondre ferait retomber l'un des deux
   * sous son seuil, et c'est le texte qui perdrait.
   *
   * Contrastes mesurés sur le fond de page, qui est le cas le plus exigeant :
   * libellé d'intérêt **4,53:1**, libellé d'accessibilité **4,54:1**, jauges
   * **3,52:1** toutes les deux. ⚠️ **Les deux notes sont du même ordre, et
   * c'est voulu** : une mesure qui contrasterait deux fois plus que l'autre se
   * lirait comme la plus importante, ce que le produit refuse — il repose sur
   * le refus de fusionner ou de hiérarchiser les deux notes.
   */
  teinteLibelle: string;
  /** Espacements de lecture plutôt que de balayage — voir `ContenuNotes`. */
  aere?: boolean;
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
        {/* ⚠️ **Largeur fixe en liste, largeur naturelle sur la fiche.** Les
            108 px alignent les barres d'une offre à l'autre sur 200 lignes ;
            sur une fiche, ils ne font qu'ouvrir un vide — « INTÉRÊT » ne mesure
            que 60 px, d'où **48 px de blanc** entre le mot et le début de la
            jauge. Relevé par Maxime le 29 août 2026 : « il y a quand même un
            gros espace blanc ». Sur la fiche il n'y a rien à aligner d'une ligne
            à l'autre, donc rien à réserver.
            ⚠️ **`whitespace-nowrap` reste dans les deux cas** : sans lui,
            « ACCESSIBILITÉ » se couperait en deux lignes dès que la colonne se
            resserre, et la rangée doublerait de hauteur. */}
        <span
          className={`libelle-mono shrink-0 whitespace-nowrap font-semibold ${teinteLibelle} ${aere ? "" : "w-[6.75rem]"}`}
        >
          {libelle}
        </span>

        {/* ⚠️ **Sur la fiche, la barre prend toute la place restante ; en liste,
            elle garde sa largeur fixe.** C'est le défaut « barres restées à la
            largeur de la liste », relevé et laissé le 29 août 2026, puis rouvert
            par Maxime le même jour : « la jauge fait un peu petit par rapport au
            texte ». Mesuré, il avait raison — 88 px de barre sous une
            justification de 428 px de large, soit **la moitié de la colonne
            vide** à droite du chiffre.

            ⚠️ **La largeur fixe n'est PAS un caprice en liste, et c'est pour ça
            qu'elle y reste** : c'est elle qui aligne les barres d'une offre à
            l'autre, et cet alignement est ce qui permet de comparer deux cents
            offres d'un coup d'œil sans lire les chiffres. Sur une fiche, il n'y
            a qu'une offre — l'argument tombe, la contrainte aussi.

            ⚠️ **Le plafond de 13 rem est un second réglage, demandé après avoir
            vu le premier.** Sans lui la jauge prenait toute la colonne (290 px),
            ce qui était trop : une barre plus large que la moitié du texte
            qu'elle surmonte se lit comme un objet à part entière plutôt que
            comme la mesure d'une note. Le plafond ne s'applique qu'à partir de
            640 px — en dessous, la place manque déjà et la barre prend ce qui
            reste.
            ⚠️ **`basis-0` avec `flex-1`** : sans lui, la base d'un élément
            `flex` est sa largeur de contenu, ici zéro, et le calcul du plafond
            se ferait sur une répartition qu'on ne contrôle pas. */}
        <span
          aria-hidden="true"
          // ⚠️ **La piste est TEINTÉE dans la couleur de sa note, et elle n'a
          // plus de filet — demande de Maxime du 29 août 2026.**
          //
          // Il y avait un filet violet (`--input`) parce que la piste neutre ne
          // pesait que 1,31:1 sur la carte : sans lui, une note à 15/100 montrait
          // un court trait de couleur et **rien** autour, si bien qu'on ne
          // voyait plus de quoi la barre était une fraction. Le filet réglait ce
          // problème en cernant la barre d'une teinte étrangère aux deux notes.
          //
          // Teinter la piste règle le même problème sans couleur tierce : la
          // barre est entièrement bleue ou entièrement verte, pastel pour le
          // vide et franc pour le plein.
          //
          // ⚠️ **Ce que l'arbitrage coûte, et pourquoi il tient quand même** :
          // la piste pèse 1,73:1 (bleu) et 1,31:1 (menthe) sur la carte, sous
          // les 3:1 exigés d'un objet graphique porteur de sens. Il est
          // acceptable **parce que le chiffre est écrit juste à côté** —
          // l'information n'a jamais reposé sur la barre seule, qui porte
          // d'ailleurs `aria-hidden`. ⚠️ **Le jour où ce chiffre disparaîtrait
          // de la ligne, ce choix redeviendrait un défaut.**
          className={`box-border overflow-hidden rounded-full ${piste} ${aere ? "h-2.5 min-w-0 flex-1 basis-0 sm:max-w-[13rem]" : "h-2 w-[5.5rem] shrink-0"}`}
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

        {/* `shrink-0` : sans lui, le chiffre serait le seul élément compressible
            de la rangée une fois la barre passée en `flex-1`, et « 100 » se
            couperait sur deux lignes.

            ⚠️ **Le chiffre grandit avec la barre, et c'est une conséquence, pas
            un ajout.** À 12 px au bout d'une jauge de 290 px et sous un texte de
            16, il devenait le plus petit élément d'une rangée dont il est
            pourtant l'information principale — la barre, elle, porte
            `aria-hidden`. 14 px l'aligne sur les valeurs du classement, qui sont
            des données du même ordre. Le LIBELLÉ, lui, reste à 11 px : c'est une
            étiquette, pas une donnée. */}
        <span
          className={`shrink-0 font-mono font-semibold tabular-nums text-foreground ${aere ? "text-sm" : "text-xs"}`}
        >
          {valeur}
          <span className="sr-only"> sur 100</span>
        </span>
      </div>

      {/* ⚠️ **4 px sous la barre en liste, 10 px sur la fiche.** L'écart doit
          rester plus petit que l'interligne du paragraphe (21 px), sinon la
          justification se détache de la note qu'elle explique et se lit comme un
          texte indépendant — on perd le couple.

          ⚠️ **Sur la fiche, la justification prend la MÊME typographie que le
          résumé — 16 px en encre pleine — et c'est un correctif de fond, pas de
          forme.** Relevé par Maxime le 29 août 2026 : « c'est bizarre que le
          texte du résumé ne soit pas le même que celui des justifications ».
          Il avait raison, et l'écart était double : 16 px contre 13, encre
          contre gris atténué. Or **les deux textes ont le même auteur et le même
          statut** — c'est ce que le modèle a compris de l'offre, une fois en
          synthèse et une fois par note. Les afficher à deux niveaux annonçait une
          hiérarchie que le produit ne défend pas : les justifications SONT
          l'argument du projet, pas une annotation sous une barre.

          ⚠️ **En LISTE, elles restent à 13 px atténuées**, et ça n'est pas une
          incohérence : sur 200 lignes, la justification est un commentaire qu'on
          survole, pas un texte qu'on lit. Le rôle change avec l'écran, la
          typographie suit. */}
      {justification && (
        <p
          className={
            aere
              ? "mt-2.5 text-base leading-relaxed text-foreground"
              : "mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground"
          }
        >
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
