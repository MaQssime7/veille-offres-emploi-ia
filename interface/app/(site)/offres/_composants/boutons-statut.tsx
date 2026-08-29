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

import { useOptimistic, useState, useTransition } from "react";
import { Check, Undo2, X } from "lucide-react";

import { LIBELLES_STATUT, STATUT_PAR_DEFAUT, type Statut } from "@/lib/statuts";

import { definirStatut } from "../actions";

export function BoutonsStatut({
  identifiant,
  statut,
  compact = false,
}: {
  identifiant: string;
  statut: Statut;
  /** En liste, les boutons se réduisent à leur icône sous 640 px. */
  compact?: boolean;
}) {
  const [enCours, demarrer] = useTransition();
  const [echec, setEchec] = useState<string | null>(null);

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
          enCours={enCours}
          compact={compact}
          onClick={() => basculer("candidate")}
          teinte="candidate"
        />
        <BoutonStatut
          cible="ecarte"
          actif={statutAffiche === "ecarte"}
          enCours={enCours}
          compact={compact}
          onClick={() => basculer("ecarte")}
          teinte="ecarte"
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
}: {
  cible: Statut;
  actif: boolean;
  enCours: boolean;
  compact: boolean;
  onClick: () => void;
  teinte: "candidate" | "ecarte";
}) {
  const libelle = LIBELLES_STATUT[cible];

  // Actif, le bouton est plein ; au repos, il n'a qu'un contour. `--input` et
  // non `--border` : c'est une bordure de composant d'interface, elle doit
  // tenir 3:1 — `--border` est un filet décoratif sans exigence.
  const habit = actif
    ? teinte === "candidate"
      ? "border-success bg-success text-success-foreground"
      : "border-destructive bg-destructive text-destructive-foreground"
    : "border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground";

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
      className={`relative z-10 inline-flex items-center gap-1.5 border font-mono text-[0.6875rem] font-semibold uppercase tracking-wider outline-none transition-colors before:absolute before:inset-x-0 before:-inset-y-2 before:content-[''] focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${compact ? "p-2 sm:px-2.5 sm:py-1" : "px-2.5 py-1"} ${habit}`}
      title={actif ? `Remettre « ${LIBELLES_STATUT.a_traiter} »` : libelle}
    >
      <Icone className="size-3.5 shrink-0" aria-hidden="true" />
      <span className={compact ? "sr-only sm:not-sr-only" : undefined}>
        {libelle}
      </span>
    </button>
  );
}
