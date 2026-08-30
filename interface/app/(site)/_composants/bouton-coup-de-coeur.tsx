"use client";

/**
 * Le cœur qu'on pose sur une offre.
 *
 * Entre : l'identifiant de l'offre, son état actuel, la densité voulue, et si
 * un clic peut la faire sortir de la liste affichée.
 * Sort : un bouton bascule, et un message quand l'enregistrement échoue.
 * Casse : un échec réseau, une session expirée ou une offre disparue laissent
 * le cœur affiché **revenir à sa valeur réelle**, message à l'appui.
 *
 * ⚠️ **Composant client, donc règle n° 4 du `CLAUDE.md` : on ne lui passe que
 * des valeurs scalaires, jamais l'objet `offre`.** `<BoutonCoupDeCoeur
 * offre={offre} />` compilerait sans la moindre erreur et enverrait les
 * **toutes ses colonnes** dans le document — message d'erreur technique de
 * notation, `contact_nom`, et la note personnelle de Maxime sur la fiche.
 * ⚠️ **Pas de nombre ici** : il périme à chaque migration — voir
 * `boutons-statut.tsx`.
 *
 * ⚠️ **Le cœur n'est PAS un bouton de statut, et l'écart est visible dans sa
 * forme** : les deux autres s'excluent l'un l'autre et ramènent à « à traiter »
 * quand on reclique ; celui-ci est une bascule indépendante qui ne touche
 * jamais la colonne `statut`. Voir `lib/coup-de-coeur.ts` pour le motif de
 * cette séparation.
 */

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { Heart } from "lucide-react";

import {
  LIBELLE_COUP_DE_COEUR,
  LIBELLE_RETIRER_COUP_DE_COEUR,
} from "@/lib/coup-de-coeur";

import { definirCoupDeCoeur } from "../actions";
import { useVerrouTri } from "./verrou-tri";

export function BoutonCoupDeCoeur({
  identifiant,
  actif,
  peutSortirDeLaListe = false,
  aere = false,
}: {
  identifiant: string;
  actif: boolean;
  /**
   * Est-ce qu'un clic peut faire **disparaître cette ligne** de la liste
   * affichée ? Vrai sur `/offres?statut=coup_de_coeur` et nulle part ailleurs.
   *
   * ⚠️ **C'est ce qui décide de prendre ou non le verrou de tri**, et le défaut
   * qu'il répare a été relevé en revue le 30 août 2026 : le cœur prenait le
   * verrou **global** à chaque clic, gelant les 200 lignes — cœurs *et* boutons
   * de statut — pendant les ~900 ms du re-rendu. Dans les cinq autres onglets,
   * liker ne réorganise pourtant rien : un clic sur un cœur rendait le clic
   * « Écarté » suivant inopérant pendant près d'une seconde, sans autre signal
   * qu'un bouton légèrement pâli.
   *
   * ⚠️ **Le verrou est PRIS conditionnellement, il est RESPECTÉ toujours** — les
   * deux ne vont pas ensemble. Un clic de statut peut réorganiser la liste
   * pendant qu'on vise un cœur, quel que soit l'onglet.
   */
  peutSortirDeLaListe?: boolean;
  /**
   * ⚠️ **`true` sur la fiche uniquement**, où le libellé s'affiche en toutes
   * lettres à côté du cœur. En liste, le cœur est seul et son libellé passe en
   * `sr-only` : deux cents fois « Coup de cœur » écrit en clair noierait les
   * intitulés, et la forme du cœur se comprend sans mot.
   */
  aere?: boolean;
}) {
  const [enCours, demarrer] = useTransition();
  const [echec, setEchec] = useState<string | null>(null);

  /**
   * ⚠️ **Le verrou de tri sert ici, mais PAS toujours — et la nuance est le
   * point le moins intuitif de ce composant.** Le réflexe est de se dire qu'un
   * coup de cœur ne fait disparaître aucune ligne, contrairement à « Écarté » :
   * la liste ne bouge pas, donc rien à verrouiller.
   *
   * **C'est vrai dans cinq onglets sur six, et faux dans « Coup de cœur ».**
   * Là, retirer un cœur sort l'offre du filtre exactement comme un clic de
   * statut la sort de « à traiter » : la ligne disparaît, les suivantes
   * remontent, et un second clic lancé pendant la réorganisation atteint une
   * offre que Maxime n'a jamais regardée. Mesuré le 29 août 2026 sur les
   * statuts : la réponse serveur arrive à +80 ms, le décalage à l'écran à
   * +900 ms.
   *
   * D'où la dissymétrie, qui est délibérée :
   *
   * 1. Ce bouton **prend** le verrou **seulement si `peutSortirDeLaListe`**.
   *    Le prendre partout gelait les 200 lignes pour rien — défaut relevé en
   *    revue le 30 août 2026.
   * 2. Ce bouton **respecte** le verrou **toujours** : un clic de statut peut
   *    réorganiser la liste pendant qu'on vise un cœur, dans n'importe quel
   *    onglet.
   *
   * Hors d'une liste (sur la fiche), le contexte rend son défaut et `verrouille`
   * vaut toujours `false` : rien n'y bouge sous le curseur.
   */
  const { verrouille, prendre } = useVerrouTri();

  /**
   * ⚠️ **Le verrou suit `enCours`, jamais la fin de l'appel serveur.**
   * `useTransition` reste vrai jusqu'à ce que le nouveau rendu soit **appliqué
   * au DOM**, c'est-à-dire l'instant du décalage. Un verrou relâché dans un
   * `finally` tiendrait 30 ms pour un défaut qui survient à 900.
   *
   * ⚠️ **Le nettoyage joue AUSSI au démontage** : quand l'offre délikée quitte
   * l'onglet « Coup de cœur », ce composant disparaît avec elle. Sans ce retour
   * de fonction, son verrou ne serait jamais relâché et plus aucun bouton de la
   * page ne répondrait jusqu'au rechargement.
   */
  useEffect(() => {
    if (!enCours || !peutSortirDeLaListe) return;
    return prendre();
  }, [enCours, peutSortirDeLaListe, prendre]);

  /**
   * ⚠️ **`useOptimistic` est le bon patron ICI parce que la vérité appartient
   * au serveur** — règle 7 du `CLAUDE.md`. Il retombe automatiquement sur la
   * valeur de la prop en fin de transition : si l'écriture a réussi,
   * `revalidatePath` a re-rendu et la prop porte le nouvel état, rien ne bouge ;
   * si elle a échoué, la prop porte encore l'ancien et le cœur revient tout
   * seul à la vérité. **Un `useState` aurait gardé le mensonge à l'écran.**
   *
   * C'est exactement l'inverse de la note personnelle, où la vérité est sous
   * les doigts de Maxime et où `useOptimistic` effacerait sa frappe.
   */
  const [afficheActif, poserOptimiste] = useOptimistic(actif);

  function basculer() {
    const suivant = !afficheActif;

    setEchec(null);
    demarrer(async () => {
      // ⚠️ **Appelé DANS la transition**, jamais avant : hors transition, React
      // n'a aucun moment où revenir en arrière, et il le signale en console.
      poserOptimiste(suivant);

      try {
        const resultat = await definirCoupDeCoeur(identifiant, suivant);
        if (!resultat.ok) setEchec(resultat.message);
      } catch {
        // ⚠️ **Le cas le plus probable en usage réel : la session expirée
        // pendant la nuit, l'onglet resté ouvert.** Le `POST` se fait alors
        // répondre 401 par `proxy.ts` et l'appel lève avant d'atteindre le
        // serveur. Sans ce filet, le bouton ne ferait **rien du tout** — ni
        // changement, ni erreur, ni explication.
        setEchec("Session expirée ou réseau coupé. Recharge la page.");
      }
    });
  }

  const bloque = enCours || verrouille;

  return (
    // `items-end` : le message d'erreur déborde vers la GAUCHE, dans la réserve
    // vide de la rangée, plutôt que de pousser les boutons de statut vers la
    // droite ou de passer sous l'intitulé.
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={basculer}
        disabled={bloque}
        // ⚠️ **`aria-pressed` porte l'état, le libellé porte le NOM.** Un
        // lecteur d'écran annonce « Coup de cœur, activé ». Faire varier le
        // libellé accessible entre « Coup de cœur » et « Retirer le coup de
        // cœur » casserait WCAG 2.5.3 sur la fiche, où le texte est visible : le
        // nom accessible doit contenir le texte affiché. L'action, elle, est
        // dite par l'infobulle.
        aria-pressed={afficheActif}
        title={afficheActif ? LIBELLE_RETIRER_COUP_DE_COEUR : LIBELLE_COUP_DE_COEUR}
        // ⚠️ **`relative z-10` n'est pas de la mise en page, c'est ce qui rend le
        // bouton cliquable en liste.** La ligne d'offre étend son lien sur toute
        // sa surface (`after:absolute after:inset-0`) : sans remonter au-dessus,
        // le clic ouvrirait la fiche au lieu de liker.
        //
        // ⚠️ **`before:-inset-y-2` agrandit la CIBLE TACTILE, verticalement
        // SEULEMENT.** Le cœur seul mesure environ 30 × 30 px, au-dessus du
        // minimum WCAG 2.5.8 mais juste pour un doigt. L'extension horizontale
        // est exclue : le bouton de statut voisin n'est qu'à 6 px, et viser le
        // cœur candidaterait une offre sur deux. Une cible trop grande est un
        // pire défaut que la cible trop petite qu'elle corrige.
        //
        // ⚠️ **Le focus passe par `outline` (`focus-produit`) et JAMAIS par
        // `ring`** : les `cushion-*` posent un `box-shadow` brut et les `ring-*`
        // de Tailwind passent par la même propriété — le coussin gagne, et
        // l'anneau serait dans la classe mais absent du style calculé.
        // ⚠️ **Ne jamais ajouter `outline-none`** : il neutraliserait le repli
        // global de `pouf.css`.
        className={`relative z-10 inline-flex items-center gap-1.5 rounded-full transition-colors before:absolute before:inset-x-0 before:-inset-y-2 before:content-[''] focus-produit disabled:opacity-60 ${
          aere
            ? "px-4 py-1.5 font-mono text-[0.8125rem] font-bold uppercase tracking-wider"
            : // ⚠️ **`sm:p-[0.3125rem]` n'est PAS un réglage esthétique — c'est un
              // calage MESURÉ le 30 août 2026, et sans lui le squelette de toute
              // la liste devenait faux.** Le cœur n'a pas de libellé visible :
              // avec le `p-2` des boutons de statut compacts, il ne contenait
              // qu'une icône de 14 px et mesurait **30 px** de haut, contre
              // 24,5 px pour « Candidaté » et « Écarté » qui, eux, portent du
              // texte. Trois pixels de trop, donc `RYTHME_LIGNE.rangeeEntete`
              // passait de 27 à 30 px, donc **chacune des 200 lignes grandissait
              // de 3 px** — et `squelette-ligne.tsx`, qui n'a aucun lien
              // mécanique avec la ligne réelle, ne l'aurait jamais su.
              //
              // À 24 px le cœur reste sous le `sm:min-h-[1.6875rem]` (27 px) de
              // la rangée : rien ne bouge, et il s'aligne à l'œil avec ses deux
              // voisins à un demi-pixel près.
              //
              // ⚠️ En dessous de 640 px il garde `p-2`, comme les boutons de
              // statut compacts : 30 px pour tous les trois, sous le
              // `min-h-[2rem]` (32 px) de la rangée en mobile.
              "p-2 sm:p-[0.3125rem]"
        } ${
          // ⚠️ **L'état se lit d'abord par la FORME du cœur — plein ou vide —
          // et non par sa couleur.** Ce n'est pas un principe abstrait : mesuré
          // le 30 août 2026, le pêche du coup de cœur et le rose d'« Écarté »
          // sont à **1,05:1 l'un de l'autre**, c'est-à-dire strictement la même
          // clarté. Un œil protanope ou deutéranope ne les sépare pas. Le cœur
          // contre la croix, si.
          //
          // ⚠️ **Le fond pastel n'apparaît qu'à l'état ACTIF**, et le repos
          // reste sans fond : un cœur creux posé sur un rond pêche à côté des
          // deux boutons pleins ferait trois pastilles colorées par ligne, sur
          // deux cents lignes. Le coussin ne s'inverse donc pas ici comme sur
          // les boutons de statut — il n'y a pas de coussin au repos.
          afficheActif
            ? "cushion-control-active bg-coup-de-coeur text-coup-de-coeur-foreground"
            : // ⚠️ **Le survol ne change QUE la couleur du cœur, jamais le fond
              // — et c'est un correctif MESURÉ le 30 août 2026, pas un parti
              // pris.** La première version ajoutait `hover:bg-accent`, par
              // réflexe de bouton. Le fond lavande `#e7dcff` se glissait alors
              // sous le cœur, qui tombait de **3,66:1 à 2,80:1** : sous le
              // plancher opposable de 3:1 pour un objet graphique, et
              // uniquement au survol, c'est-à-dire dans l'état qu'aucune
              // capture d'écran ne montre.
              //
              // C'est le piège du 29 août, resservi une troisième fois : **une
              // couleur se mesure sur la surface qui est VRAIMENT derrière**,
              // pas sur celle qu'on croit. Ici la surface change avec l'état,
              // donc le contraste aussi.
              //
              // Sans ce fond, le cœur reste sur la carte blanche (3,66:1 en
              // clair) ou la carte sombre (9,31:1). Et le survol reste parfaitement
              // lisible : le cœur passe du violet atténué au pêche foncé, ce qui
              // annonce l'action mieux qu'un rectangle de fond ne le ferait.
              "text-muted-foreground hover:text-coup-de-coeur-icone"
        }`}
      >
        <Heart
          // ⚠️ **`fill-current` est le signal principal.** Sans lui, actif et
          // repos ne se distingueraient que par la couleur du trait — c'est-à-dire
          // par rien, pour une partie des lecteurs.
          className={`shrink-0 ${aere ? "size-4" : "size-3.5"} ${
            afficheActif ? "fill-current" : "fill-none"
          }`}
          aria-hidden="true"
        />
        <span className={aere ? undefined : "sr-only"}>
          {LIBELLE_COUP_DE_COEUR}
        </span>
      </button>

      {/* ⚠️ **`role="alert"` fait annoncer le message sans qu'un lecteur
          d'écran ait à le chercher.** Un échec d'enregistrement silencieux est
          exactement ce que le critère de succès n° 6 interdit : croire que
          c'est enregistré alors que non.

          `w-max max-w-[13rem]` : le message s'étale vers la gauche dans la
          réserve vide de la rangée au lieu d'écraser le cœur sur trois lignes
          de deux caractères. */}
      {echec && (
        <p
          role="alert"
          className="w-max max-w-[13rem] text-right text-[0.8125rem] leading-snug text-destructive"
        >
          {echec}
        </p>
      )}
    </div>
  );
}
