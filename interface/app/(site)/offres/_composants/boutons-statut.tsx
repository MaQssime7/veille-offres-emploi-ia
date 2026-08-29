"use client";

/**
 * Les deux boutons qui trient une offre : « Candidaté » et « Écarté ».
 *
 * Entre : l'identifiant de l'offre, son statut actuel, et la densité voulue.
 * Sort : deux boutons bascule, et un message quand l'enregistrement échoue.
 * Casse : un échec réseau, une session expirée ou une offre disparue laissent
 * le statut affiché **revenir à sa valeur réelle**, message à l'appui.
 *
 * ⚠️ **PREMIER composant client du projet, et il casse une propriété mesurée en
 * phase 2 : jusqu'ici, toute la chaîne de `/offres` était en composants
 * serveur, et aucune colonne sensible n'atteignait le navigateur.** Ce qui la
 * remplace n'est pas une propriété du code mais une discipline de props :
 * **on ne passe ici que des valeurs scalaires, jamais l'objet `offre`.** Lui
 * passer l'offre enverrait ses 20 colonnes dans le document — le message
 * d'erreur technique de notation, `contact_nom`, et dès l'étape suivante la
 * note personnelle de Maxime. Règle opposable n° 6 du `CLAUDE.md`.
 *
 * ⚠️ **Deux boutons et non trois.** « À traiter » n'a pas le sien : c'est l'état
 * de départ, et on y revient en recliquant sur le bouton actif. Un troisième
 * bouton pour « annuler mon choix » demanderait de lire trois libellés là où
 * l'action est binaire — et le plan exige « un clic ».
 */

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { Check, Undo2, X } from "lucide-react";

import { LIBELLES_STATUT, STATUT_PAR_DEFAUT, type Statut } from "@/lib/statuts";

import { definirStatut } from "../actions";
import { useVerrouTri } from "./verrou-tri";

export function BoutonsStatut({
  identifiant,
  statut,
  compact = false,
  aere = false,
}: {
  identifiant: string;
  statut: Statut;
  /** En liste, les boutons se réduisent à leur icône sous 640 px. */
  compact?: boolean;
  /**
   * ⚠️ **`true` sur la fiche uniquement.** Les deux boutons y sont le geste
   * principal de l'écran, sous un intitulé et un texte qui ont grandi ; à 11 px
   * ils devenaient les plus petits éléments d'une page qu'ils commandent. En
   * liste ils gardent leur taille : ils s'y répètent 200 fois.
   */
  aere?: boolean;
}) {
  const [enCours, demarrer] = useTransition();
  const [echec, setEchec] = useState<string | null>(null);

  /**
   * ⚠️ **Le verrou de la liste, et non celui de ce bouton.** `enCours` ne ferme
   * que les deux boutons de CETTE offre ; il ne protège de rien, parce que le
   * clic dangereux est celui qui atteint l'offre **voisine** après qu'elle a
   * remonté d'un cran. `verrouille` est partagé par toute la liste — voir
   * `verrou-tri.tsx` pour la mesure qui a imposé ce composant.
   *
   * Hors d'une liste (sur la fiche), le contexte rend son défaut et
   * `verrouille` vaut toujours `false` : rien n'y bouge sous le curseur.
   */
  const { verrouille, prendre } = useVerrouTri();

  /**
   * ⚠️ **Le verrou suit `enCours`, et surtout PAS la fin de l'appel serveur —
   * mesuré le 29 août 2026, et la première version était fausse.** Elle prenait
   * le verrou avant la transition et le relâchait dans un `finally`, c'est-à-dire
   * dès que la promesse de l'action revenait. Or il reste tout un temps entre
   * cette réponse et le moment où la liste se réorganise vraiment à l'écran :
   *
   * | Instant | Ce qui se passe |
   * |---|---|
   * | +0 à +30 ms | tous les boutons verrouillés |
   * | **+80 ms** | **le `finally` a relâché — les voisins redeviennent cliquables** |
   * | +900 ms | la ligne disparaît, les suivantes remontent |
   *
   * Le verrou tenait donc **30 ms** pour un décalage qui survient à **900 ms** :
   * il ne protégeait de rien. `enCours` de `useTransition`, lui, reste vrai
   * jusqu'à ce que le nouveau rendu soit **appliqué au DOM** — c'est exactement
   * l'instant du décalage, et donc la bonne borne.
   *
   * ⚠️ **Le nettoyage joue AUSSI au démontage**, et c'est ce qui évite de figer
   * la liste : quand l'offre triée quitte le filtre, ce composant disparaît avec
   * elle. Sans ce retour de fonction, son verrou ne serait jamais relâché et
   * plus aucun bouton de la page ne répondrait jusqu'au rechargement.
   */
  useEffect(() => {
    if (!enCours) return;
    return prendre();
  }, [enCours, prendre]);

  /**
   * ⚠️ **L'état optimiste n'est pas du confort, c'est ce qui rend le tri
   * utilisable.** Sans lui, chaque clic laisserait le bouton inerte le temps
   * d'un aller-retour vers Supabase à Paris — sur une matinée où l'on trie
   * quinze offres, l'écran paraîtrait cassé.
   *
   * ⚠️ **Et c'est AUSSI ce qui rattrape un échec, sans une ligne de plus.**
   * `useOptimistic` retombe automatiquement sur la valeur de la prop dès que la
   * transition s'achève. Si l'écriture a réussi, `revalidatePath` a re-rendu le
   * serveur et la prop porte le nouveau statut : rien ne bouge. Si elle a
   * échoué, la prop porte encore l'ancien : l'affichage revient tout seul à la
   * vérité. **Un état local en `useState` aurait gardé le mensonge à l'écran.**
   */
  const [statutAffiche, poserOptimiste] = useOptimistic(statut);

  function basculer(cible: Statut) {
    // Recliquer sur le bouton actif ramène à « à traiter » : la bascule est ce
    // qui permet de corriger un mauvais clic sans troisième bouton.
    const suivant = statutAffiche === cible ? STATUT_PAR_DEFAUT : cible;

    setEchec(null);
    demarrer(async () => {
      // ⚠️ **`useOptimistic` DOIT être appelé dans la transition**, jamais
      // avant : hors transition, React n'a aucun moment où revenir en arrière,
      // et il le signale par un avertissement en console.
      poserOptimiste(suivant);

      try {
        const resultat = await definirStatut(identifiant, suivant);
        if (!resultat.ok) setEchec(resultat.message);
      } catch {
        // ⚠️ **Ce `catch` attrape le cas le plus probable en usage réel : la
        // session expirée pendant la nuit, l'onglet resté ouvert.** Le `POST`
        // se fait alors répondre 401 par `proxy.ts` et l'appel lève avant
        // d'atteindre le serveur. Sans ce filet, le bouton ne ferait **rien du
        // tout** — ni changement, ni erreur, ni explication.
        setEchec("Session expirée ou réseau coupé. Recharge la page.");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <BoutonStatut
          cible="candidate"
          actif={statutAffiche === "candidate"}
          enCours={enCours || verrouille}
          compact={compact}
          onClick={() => basculer("candidate")}
          teinte="candidate"
          aere={aere}
        />
        <BoutonStatut
          cible="ecarte"
          actif={statutAffiche === "ecarte"}
          enCours={enCours || verrouille}
          compact={compact}
          onClick={() => basculer("ecarte")}
          teinte="ecarte"
          aere={aere}
        />
      </div>

      {/* ⚠️ **`role="alert"` fait annoncer le message par un lecteur d'écran
          sans qu'il ait à le chercher.** Un échec d'enregistrement silencieux
          est exactement ce que le critère de succès n° 6 interdit : croire que
          c'est enregistré alors que non. */}
      {echec && (
        <p role="alert" className="text-[0.8125rem] leading-snug text-destructive">
          {echec}
        </p>
      )}
    </div>
  );
}

/**
 * Un bouton de statut.
 *
 * ⚠️ **L'icône n'est pas décorative — elle est exigée.** Le plancher
 * d'accessibilité du projet interdit que l'information tienne sur la seule
 * couleur, et le plan le redit pour les statuts : « chaque statut porte une
 * icône ou un symbole en plus de sa couleur ». Olive et brique se ressemblent
 * pour un daltonien deutan ; la coche et la croix, non.
 *
 * ⚠️ **`aria-pressed` et non un simple bouton.** C'est ce qui fait annoncer
 * « Candidaté, activé » plutôt que « Candidaté » — sans quoi rien ne dirait à
 * un lecteur d'écran quel statut porte l'offre. L'état visuel (fond plein
 * contre contour) n'existe pas pour lui.
 *
 * ⚠️ **En mode compact, le libellé passe en `sr-only`, il ne DISPARAÎT pas.**
 * Retiré, le bouton ne serait plus qu'un pictogramme sans nom — illisible au
 * lecteur d'écran comme au survol.
 */
function BoutonStatut({
  cible,
  actif,
  enCours,
  compact,
  onClick,
  teinte,
  aere = false,
}: {
  cible: Statut;
  actif: boolean;
  enCours: boolean;
  compact: boolean;
  onClick: () => void;
  teinte: "candidate" | "ecarte";
  aere?: boolean;
}) {
  const libelle = LIBELLES_STATUT[cible];

  // ⚠️ **Les deux boutons portent leur couleur EN PERMANENCE depuis le
  // 29 août 2026, y compris au repos** — demande de Maxime, pour donner plus
  // de couleur à la liste. Avant, le repos était un simple contour gris.
  //
  // ⚠️ **Ce que ce choix coûte, et comment on le paie.** Quand le repos et
  // l'état engagé partagent la même teinte, la couleur ne distingue plus rien :
  // il faut donc que trois autres signaux portent la différence, et aucun n'est
  // décoratif.
  //
  //   1. **La saturation.** Au repos le pastel est atténué à 55 % sur la carte
  //      blanche ; engagé, il est plein. C'est le signal le plus lisible des
  //      trois, et le seul qui se voie sans comparer deux boutons voisins.
  //   2. **Le relief s'inverse.** Au repos le coussin est bombé
  //      (`cushion-control`) ; engagé, il est enfoncé (`cushion-control-active`).
  //      C'est la grammaire de 1st-Pouf, qui fournit les deux recettes
  //      exactement pour ça.
  //   3. **L'icône change** — coche/croix au repos, flèche de retour engagé —
  //      et `aria-pressed` porte l'état pour un lecteur d'écran.
  //
  // ⚠️ **Un anneau (`ring-*`) était le premier réflexe et il est IMPOSSIBLE
  // ici — mesuré au DOM, pas supposé.** Les utilitaires `cushion-*` de pouf
  // posent un `box-shadow` brut ; les `ring-*` de Tailwind passent par ce même
  // `box-shadow`. Le dernier appliqué gagne, et c'est le coussin : l'anneau
  // était bien dans la classe et **totalement absent du style calculé**. La
  // feuille de pouf l'annonce d'ailleurs en toutes lettres — elle a choisi le
  // `box-shadow` brut précisément pour ne pas dépendre de la pile de variables
  // de Tailwind.
  // ⚠️ **Corollaire à connaître** : `focus-visible:ring-*` est inopérant pour
  // la même raison sur tout élément portant un `cushion-*`. Le focus clavier
  // reste visible parce que `pouf.css` pose un `outline` global sur
  // `:focus-visible` — un `outline` n'entre pas en conflit avec `box-shadow`.
  // Retirer cette règle de pouf rendrait ces boutons inutilisables au clavier.
  //
  // Le plancher du projet interdit qu'une information tienne sur la seule
  // couleur ; ici elle ne tient sur aucune couleur du tout, ce qui est plus
  // robuste qu'avant.
  //
  // ⚠️ **`bg-ecarte` et non `bg-destructive`** : le rose de `--destructive` est
  // calculé pour tenir 4,5:1 en tant que TEXTE d'erreur, il est donc très
  // foncé. Sur un bouton, il jurerait avec le pastel de « Candidaté » d'à côté —
  // deux boutons voisins qui font le même geste doivent avoir le même poids.
  //
  // ⚠️ **L'opacité du repos DIFFÈRE entre les deux modes, et c'est un correctif
  // de revue — pas un raffinement.** Une première version posait 55 % dans les
  // deux, avec ce commentaire : « atténuer ÉCLAIRCIT le fond, donc l'état au
  // repos n'est jamais le moins lisible des deux ». **C'est vrai en clair et
  // faux en sombre**, où le pastel se mélange vers la carte sombre `#211f2b` :
  // atténuer y ASSOMBRIT. Mesuré sur le CSS compilé, le texte foncé posé dessus
  // tombait à **4,34:1 sur la menthe et 3,61:1 sur le rose**, sous le plancher
  // de 4,5:1 — un défaut qu'aucune vérification en mode clair ne pouvait voir.
  //
  // 70 % en sombre rétablit 6,21:1 et 5,07:1, tout en gardant l'écart avec
  // l'état plein assez lisible pour distinguer les deux.
  //
  // ⚠️ **La leçon dépasse ce composant** : une couleur composée par transparence
  // n'est PAS dans la palette, donc elle échappe à la vérification des paires de
  // jetons. Toute opacité posée sur une teinte doit être mesurée à part, dans
  // les deux modes.
  //
  // Contrastes du libellé, les quatre combinaisons en clair : menthe pleine
  // 9,30:1 · menthe à 55 % 10,48:1 · rose plein 7,32:1 · rose à 55 % 9,22:1.
  // En sombre à 70 % : menthe 6,21:1 · rose 5,07:1 · pleines 11,44 et 9,00:1.
  const habit = actif
    ? teinte === "candidate"
      ? "cushion-control-active bg-success text-success-foreground"
      : "cushion-control-active bg-ecarte text-ecarte-foreground"
    : teinte === "candidate"
      ? "cushion-control bg-success/55 dark:bg-success/70 text-success-foreground hover:bg-success dark:hover:bg-success"
      : "cushion-control bg-ecarte/55 dark:bg-ecarte/70 text-ecarte-foreground hover:bg-ecarte dark:hover:bg-ecarte";

  // Actif, l'icône devient une flèche de retour : c'est ce que le clic fera.
  // Un bouton doit annoncer son effet, pas répéter son état — celui-ci est déjà
  // porté par le fond plein, le libellé et `aria-pressed`.
  const Icone = actif ? Undo2 : cible === "candidate" ? Check : X;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={enCours}
      aria-pressed={actif}
      // ⚠️ **`relative z-10` n'est pas de la mise en page, c'est ce qui rend le
      // bouton cliquable en liste.** La ligne d'offre étend son lien sur toute
      // sa surface (`after:absolute after:inset-0`) : sans remonter au-dessus,
      // le clic ouvrirait la fiche au lieu de trier. Inutile sur la fiche, sans
      // effet, et le poser des deux côtés évite un composant en double.
      // ⚠️ **`before:` agrandit la CIBLE TACTILE sans agrandir le bouton.**
      // Mesuré au DOM le 29 août 2026 : en mode compact, le bouton faisait
      // **36 × 24 px** — au minimum exact de WCAG 2.5.8 (24 × 24), donc
      // conforme, mais très juste pour un doigt. Or l'un de ces deux boutons
      // fait **disparaître la ligne** de la liste filtrée : un doigt qui rate
      // coûte un aller-retour dans un autre filtre pour retrouver l'offre.
      //
      // ⚠️ **L'extension est VERTICALE seulement (`-inset-y-2`), et c'est le
      // point délicat.** Les deux boutons sont espacés de 6 px : une extension
      // horizontale de 8 px ferait se chevaucher leurs zones cliquables, et
      // viser « Candidaté » écarterait l'offre une fois sur deux. Une cible
      // trop grande est un pire défaut que la cible trop petite qu'elle
      // corrige. Verticalement, rien ne se trouve à côté — la zone monte à
      // **40 px** sans toucher personne.
      //
      // ⚠️ `p-2` en compact et non `px-2.5 py-1` : sans libellé visible, le
      // bouton se réduisait à son icône de 14 px. La surface visible passe à
      // 30 × 30 px, ce qui reste dans les 27 px de rangée du bureau puisque
      // le compact ne s'applique que sous 640 px.
      // ⚠️ **Le focus passe par `outline`, JAMAIS par `ring` — mesuré, pas
      // supposé.** Ces boutons portent un `cushion-*`, c'est-à-dire un
      // `box-shadow` brut, et les `ring-*` de Tailwind passent par ce même
      // `box-shadow` : l'anneau était écrasé et le style calculé affichait
      // `outline-style: none`. Un utilisateur au clavier n'avait **aucun
      // repère** sur les deux boutons qui trient la liste.
      // ⚠️ **`outline-none` a été RETIRÉ de cette classe** : c'est lui qui
      // neutralisait le repli de `pouf.css` (`:focus-visible { outline: 3px }`).
      // Le remettre reproduirait le défaut en silence.
      className={`relative z-10 inline-flex items-center gap-1.5 rounded-full font-mono font-bold uppercase tracking-wider transition-colors before:absolute before:inset-x-0 before:-inset-y-2 before:content-[''] focus-produit disabled:opacity-60 ${aere ? "px-4 py-1.5 text-[0.8125rem]" : "text-[0.6875rem]"} ${aere ? "" : compact ? "p-2 sm:px-3 sm:py-1" : "px-3 py-1"} ${habit}`}
      title={actif ? `Remettre « ${LIBELLES_STATUT.a_traiter} »` : libelle}
    >
      <Icone className={`shrink-0 ${aere ? "size-4" : "size-3.5"}`} aria-hidden="true" />
      <span className={compact ? "sr-only sm:not-sr-only" : undefined}>
        {libelle}
      </span>
    </button>
  );
}
