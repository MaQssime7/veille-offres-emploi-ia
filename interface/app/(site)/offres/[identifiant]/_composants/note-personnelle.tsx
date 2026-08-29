"use client";

/**
 * Le carnet de Maxime sur une offre : un champ libre qui s'enregistre tout
 * seul.
 *
 * Entre : l'identifiant de l'offre, la note déjà en base, et la date de son
 * dernier enregistrement.
 * Sort : la section « Ma note » — champ, indicateur d'état, et un recours en
 * cas d'échec.
 * Casse : réseau coupé, session expirée ou base en panne affichent un message
 * **sans jamais toucher au texte tapé**. C'est le critère de succès n° 6, et
 * c'est la seule chose que ce composant ne doit jamais rater.
 *
 * ⚠️ **SECOND composant client du projet, et il transporte la seule donnée
 * personnelle que Maxime produise lui-même.** La discipline de props vaut donc
 * ici plus que partout ailleurs : on ne reçoit que trois valeurs scalaires,
 * **jamais l'objet `offre`**. Lui passer l'offre enverrait `contact_nom`, la
 * description intégrale et le message d'erreur technique de notation dans le
 * document — et rien ne le signalerait, puisque `<NotePersonnelle offre={offre} />`
 * compilerait sans la moindre erreur. Règle opposable n° 6 du `CLAUDE.md`.
 *
 * ⚠️ **Pourquoi `useState` et surtout PAS `useOptimistic`**, alors que les
 * boutons de statut font l'inverse : `useOptimistic` retombe automatiquement
 * sur la valeur de la prop dès la fin de la transition. C'est exactement ce
 * qu'on veut pour un statut — un échec fait revenir l'affichage à la vérité de
 * la base. Ici, ce serait le défaut à ne pas commettre : un enregistrement raté
 * effacerait sous les doigts de Maxime le paragraphe qu'il vient d'écrire. Le
 * texte à l'écran appartient à celui qui tape, pas à la base.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Loader2, PenLine, TriangleAlert } from "lucide-react";

import { LONGUEUR_MAX_NOTE } from "@/lib/notes";

import { definirNote } from "../../actions";
import { formaterEnregistrement } from "../../_composants/formats";

/**
 * Le temps de silence après la dernière frappe avant d'écrire en base.
 *
 * ⚠️ **Ni un réglage arbitraire, ni une optimisation.** Trop court (200 ms),
 * on écrit à chaque mot : une note de trois phrases coûterait quinze allers-
 * retours vers Paris et autant de lignes dans les journaux. Trop long (3 s),
 * l'indicateur reste muet pendant qu'on relit sa phrase, et fermer l'onglet
 * dans cet intervalle perdrait le texte. 800 ms tombe après une pause de
 * réflexion normale et avant que la main n'aille vers la souris.
 *
 * ⚠️ **Le délai n'est pas le seul déclencheur**, et c'est ce qui rend le
 * réglage peu critique : quitter le champ enregistre immédiatement.
 */
const DELAI_ENREGISTREMENT_MS = 800;

/**
 * À partir de combien de caractères le compteur apparaît.
 *
 * Un compteur permanent transformerait un carnet en devoir surveillé. Il ne
 * sert qu'à une chose : prévenir avant que la borne ne coupe la frappe.
 */
const SEUIL_COMPTEUR = LONGUEUR_MAX_NOTE - 2000;

export function NotePersonnelle({
  identifiant,
  noteInitiale,
  dateInitiale,
}: {
  identifiant: string;
  noteInitiale: string | null;
  dateInitiale: string | null;
}) {
  /** Ce qui est affiché dans le champ. La source de vérité, c'est ça. */
  const [texte, setTexte] = useState(noteInitiale ?? "");

  /**
   * Le dernier texte dont la base a accusé réception.
   *
   * ⚠️ **Il vit en double — un état pour le rendu, une référence pour les
   * fermetures.** Le rendu en a besoin pour dire « modification non
   * enregistrée » ; la fonction d'envoi, elle, s'exécute après un délai et
   * lirait sinon la valeur figée au moment où elle a été créée. Une référence
   * est toujours à jour, un état ne l'est que dans le rendu suivant.
   */
  const [enregistre, setEnregistre] = useState(noteInitiale ?? "");
  const enregistreRef = useRef(enregistre);
  const texteRef = useRef(texte);

  const [quand, setQuand] = useState<string | null>(dateInitiale);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);

  /**
   * La note vient d'être effacée, et l'effacement a bien été écrit.
   *
   * ⚠️ **Sans cet état, effacer sa note ne produisait AUCUN retour** — relevé
   * en revue le 29 août 2026. Le mécanisme est logique et le résultat mauvais :
   * une note effacée vaut `NULL` en base, donc `note_modifiee_a` vaut `NULL`
   * aussi (il n'y a plus rien à dater), donc l'indicateur n'avait plus d'heure
   * à afficher et se taisait. Or **effacer est une écriture** : Maxime doit
   * savoir qu'elle a eu lieu, exactement comme pour une note écrite (US-13).
   *
   * ⚠️ **Il ne survit pas au rechargement, et c'est juste** : après
   * rafraîchissement, il n'y a plus de note, et la base ne garde aucune trace
   * de celle qui a disparu. L'écran retombe alors sur le silence du premier
   * chargement, qui dit la vérité — il n'y a rien.
   */
  const [efface, setEfface] = useState(false);

  /**
   * ⚠️ **Une seule écriture en vol à la fois, et c'est une correction de bug,
   * pas de la frugalité.** Deux `PATCH` lancés à 100 ms d'intervalle peuvent
   * revenir dans l'ordre inverse : la réponse de l'ancienne version arriverait
   * en dernier et l'écran afficherait « Enregistré » pour un texte que la base
   * ne détient plus. Pire, c'est la dernière requête *reçue par Postgres* qui
   * gagne — et rien ne garantit que ce soit la dernière envoyée.
   *
   * `relancer` mémorise qu'une frappe est survenue pendant l'envoi : on
   * repart dès que la place est libre, avec le texte le plus récent.
   */
  const enVolRef = useRef(false);
  const relancerRef = useRef(false);

  const champRef = useRef<HTMLTextAreaElement>(null);

  const enregistrer = useCallback(async function enregistrer(): Promise<void> {
    if (enVolRef.current) {
      relancerRef.current = true;
      return;
    }

    const aEnvoyer = texteRef.current;
    // Rien n'a bougé depuis le dernier accusé de réception : ne pas écrire
    // pour écrire. Un `blur` sur un champ intact ne doit rien coûter.
    //
    // ⚠️ **On efface quand même le message d'échec au passage**, et c'est un
    // correctif : sans lui, annuler sa frappe après une panne réseau laissait
    // « Enregistré le 29 août à 14:32 » et « Enregistrement impossible »
    // affichés l'un sous l'autre. Deux messages contradictoires sur
    // l'information dont dépend tout le critère de succès n° 6.
    if (aEnvoyer === enregistreRef.current) {
      setEchec(null);
      return;
    }

    enVolRef.current = true;
    setEnvoiEnCours(true);
    setEchec(null);

    try {
      const resultat = await definirNote(identifiant, aEnvoyer);

      if (resultat.ok) {
        enregistreRef.current = aEnvoyer;
        setEnregistre(aEnvoyer);
        // ⚠️ **L'heure ne s'affiche que si le texte n'a pas rebougé pendant
        // l'aller-retour.** Sinon on annoncerait « Enregistré à 14:32 » alors
        // que la phrase à l'écran n'est pas celle que la base détient. Le
        // rendu retombe alors de lui-même sur « modification non enregistrée »,
        // puisqu'il compare `texte` et `enregistre`.
        setQuand(resultat.enregistreA);
        // `enregistreA` vaut `null` exactement quand la note vient d'être
        // vidée : c'est le serveur qui le dit, on ne le redéduit pas ici.
        setEfface(resultat.enregistreA === null);
      } else {
        setEchec(resultat.message);
      }
    } catch {
      // ⚠️ **Le cas le plus probable en usage réel n'est pas la panne de base,
      // c'est la session expirée pendant la nuit sur un onglet resté ouvert.**
      // `proxy.ts` répond alors 401 au `POST` sans rediriger, et l'appel lève
      // avant d'atteindre le serveur. Sans ce filet, le champ resterait
      // silencieux et Maxime croirait sa note enregistrée — précisément ce que
      // le critère de succès n° 6 interdit.
      setEchec(
        "Enregistrement impossible : session expirée ou réseau coupé. Ta note est toujours à l’écran.",
      );
    } finally {
      enVolRef.current = false;
      setEnvoiEnCours(false);

      if (relancerRef.current) {
        relancerRef.current = false;
        void enregistrer();
      }
    }
  }, [identifiant]);

  /**
   * Le champ grandit avec la note, jusqu'à un plafond.
   *
   * ⚠️ **Mesuré le 29 août 2026, et c'est ce qui a imposé cet effet** : une note
   * de 5 000 caractères — le maximum du critère d'acceptation — tenait dans un
   * champ de **148 px**, soit cinq lignes visibles sur soixante. Le texte était
   * bien là et se relisait intégralement, mais dans un ascenseur imbriqué dans
   * la page : le geste le plus pénible de toute interface.
   *
   * ⚠️ **`height = "auto"` AVANT de lire `scrollHeight`, sans quoi le champ ne
   * rétrécit jamais.** `scrollHeight` ne descend pas en dessous de la hauteur
   * déjà posée en style : sans cette remise à zéro, effacer vingt lignes
   * laisserait un champ vide de vingt lignes de haut, définitivement.
   *
   * ⚠️ **`useLayoutEffect` et non `useEffect`** : la mesure et la pose de la
   * hauteur ont lieu avant que le navigateur ne peigne. Avec `useEffect`, une
   * note longue s'afficherait d'abord sur cinq lignes puis sauterait à sa
   * hauteur réelle, à chaque ouverture de la fiche.
   *
   * Le plafond est en CSS (`max-h-[60vh]`), pas ici : au-delà, c'est le champ
   * qui défile, et la page reste navigable.
   */
  useLayoutEffect(() => {
    const champ = champRef.current;
    if (!champ) return;

    champ.style.height = "auto";
    champ.style.height = `${champ.scrollHeight}px`;
  }, [texte]);

  /**
   * L'enregistrement automatique : 800 ms de silence après la dernière frappe.
   *
   * ⚠️ **Le nettoyage est ce qui fait le retardement.** Chaque frappe annule le
   * minuteur précédent ; sans ce `return`, taper vingt caractères programmerait
   * vingt écritures au lieu d'une.
   */
  useEffect(() => {
    // ⚠️ **Le retour à la valeur enregistrée passe par ICI, pas par
    // `enregistrer()`** : annuler sa frappe (Cmd-Z) ne déclenche aucun envoi,
    // donc c'est le seul endroit où l'échec peut être levé sans que
    // l'utilisateur ait à quitter le champ.
    if (texte === enregistreRef.current) {
      setEchec(null);
      return;
    }

    const minuteur = setTimeout(() => {
      void enregistrer();
    }, DELAI_ENREGISTREMENT_MS);

    return () => clearTimeout(minuteur);
  }, [texte, enregistrer]);

  /**
   * Le dernier filet : prévenir avant de fermer un onglet qui contient du
   * texte non enregistré.
   *
   * ⚠️ **Il ne couvre qu'une fenêtre de 800 millisecondes en marche normale**
   * — mais il couvre *tout* le temps qu'un échec dure, et c'est là qu'il
   * compte : réseau coupé, message affiché, Maxime ferme l'onglet en pensant
   * que c'est enregistré. Le navigateur pose alors sa propre confirmation, dont
   * on ne choisit ni le texte ni l'apparence.
   *
   * ⚠️ **On n'écrit PAS dans `localStorage` en secours.** Ce serait une seconde
   * copie persistante d'une donnée personnelle, hors de la base, sur une
   * machine — exactement ce que la règle du projet refuse pour `contact_nom`.
   */
  useEffect(() => {
    if (texte === enregistre) return;

    function avantFermeture(evenement: BeforeUnloadEvent) {
      evenement.preventDefault();
    }

    window.addEventListener("beforeunload", avantFermeture);
    return () => window.removeEventListener("beforeunload", avantFermeture);
  }, [texte, enregistre]);

  function saisir(valeur: string) {
    setTexte(valeur);
    // La référence se met à jour tout de suite : l'envoi différé lit celle-ci,
    // pas l'état, qui ne sera à jour qu'au rendu suivant.
    texteRef.current = valeur;
  }

  const enAttente = texte !== enregistre;
  const trop = texte.length >= SEUIL_COMPTEUR;

  return (
    <section aria-labelledby="titre-ma-note">
      <h2 id="titre-ma-note" className="titre-section mb-3">
        Ma note
      </h2>

      <div className="carte-produit px-4 py-4">
        {/* ⚠️ **`aria-labelledby` vers le titre de section, plutôt qu'un
            `<label>` de plus.** Un champ sans nom accessible est annoncé
            « zone de saisie » et rien d'autre ; un second libellé au-dessus du
            titre ferait doublon à l'écran. `aria-describedby` accroche en plus
            l'indicateur d'état : entrer dans le champ annonce « Ma note, zone
            de texte, Enregistré le 29 août à 14:32 ». */}
        <textarea
          ref={champRef}
          id="note-personnelle"
          aria-labelledby="titre-ma-note"
          aria-describedby="etat-ma-note"
          value={texte}
          onChange={(evenement) => saisir(evenement.target.value)}
          // Quitter le champ écrit sans attendre : partir vers un autre onglet
          // ou cliquer « Postuler » ne doit pas dépendre d'un minuteur.
          onBlur={() => void enregistrer()}
          // ⚠️ Confort de frappe uniquement. La borne qui compte est vérifiée
          // par l'action serveur, puis par la contrainte
          // `note_personnelle_bornee` en base : un attribut HTML se retire en
          // trois clics dans les outils du navigateur.
          maxLength={LONGUEUR_MAX_NOTE}
          rows={5}
          placeholder="Un contact, une date de relance, une impression…"
          // ⚠️ **`resize-none` alors que le réflexe serait `resize-y`** : la
          // hauteur est désormais pilotée par l'effet ci-dessus, qui la
          // réécrit à chaque frappe. Laisser la poignée de redimensionnement
          // donnerait une prise qui ne tient pas — le champ reviendrait à sa
          // hauteur calculée dès le caractère suivant.
          className="max-h-[60vh] min-h-28 w-full resize-none overflow-auto rounded-lg border border-input bg-transparent px-3 py-2 text-base leading-relaxed transition-colors placeholder:text-muted-foreground dark:bg-input/30"
        />

        <div className="mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          {/* ⚠️ **`aria-live="polite"` et non `assertive`** : l'état
              d'enregistrement change à chaque pause de frappe. Annoncé de
              force, il couperait la parole au lecteur d'écran toutes les
              secondes. L'échec, lui, a son propre `role="alert"` juste en
              dessous — c'est le seul qui mérite d'interrompre. */}
          <p
            id="etat-ma-note"
            aria-live="polite"
            className="inline-flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground"
          >
            <IndicateurEtat
              envoiEnCours={envoiEnCours}
              enAttente={enAttente}
              quand={quand}
              efface={efface}
            />
          </p>

          {trop && (
            <p className="font-mono text-[0.6875rem] tabular-nums text-muted-foreground">
              {texte.length.toLocaleString("fr-FR")} /{" "}
              {LONGUEUR_MAX_NOTE.toLocaleString("fr-FR")}
            </p>
          )}
        </div>

        {echec && (
          <div
            role="alert"
            className="mt-2 flex flex-wrap items-start gap-x-3 gap-y-1.5 border border-destructive/40 bg-destructive/5 px-3 py-2"
          >
            <p className="flex items-start gap-1.5 text-[0.8125rem] leading-snug text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {echec}
            </p>
            {/* ⚠️ **Le seul bouton de ce composant, et il ne contredit pas
                « sans bouton ».** L'enregistrement normal n'en demande aucun ;
                celui-ci n'existe que sur l'écran d'échec. Sans lui, relancer
                une écriture ratée obligerait à taper un caractère au hasard —
                le réseau revenu, on veut cliquer une fois, pas modifier sa
                note pour la sauver. */}
            <button
              type="button"
              onClick={() => void enregistrer()}
              disabled={envoiEnCours}
              className="inline-flex items-center rounded-full border border-input bg-transparent px-3 py-1 font-mono text-[0.6875rem] font-bold uppercase tracking-wider transition-colors hover:bg-accent hover:text-foreground focus-produit disabled:opacity-60"
            >
              Réessayer
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Ce que dit l'indicateur, dans l'ordre de priorité.
 *
 * ⚠️ **Un texte, jamais une seule couleur ni une seule icône.** Le plancher
 * d'accessibilité du projet l'exige, et ici il tombe particulièrement juste :
 * « enregistré » et « pas enregistré » ne se distingueraient que par une
 * nuance de gris pour un daltonien, sur l'information dont dépend tout le
 * critère de succès n° 6.
 *
 * ⚠️ **L'ocre est la teinte du temporel** (`--signal`), celle du marqueur
 * « Nouveau » et de l'enrichissement en cours. « En train de s'écrire » et
 * « pas encore écrit » sont exactement ça. L'olive n'est pas utilisée ici,
 * alors qu'un « enregistré » vert serait tentant : elle porte déjà
 * l'accessibilité et le statut « candidaté », et une teinte qui sert à trois
 * choses ne sert plus à rien.
 */
function IndicateurEtat({
  envoiEnCours,
  enAttente,
  quand,
  efface,
}: {
  envoiEnCours: boolean;
  enAttente: boolean;
  quand: string | null;
  efface: boolean;
}) {
  if (envoiEnCours) {
    return (
      <>
        {/* `motion-reduce:animate-none` : le mouvement se coupe sous
            `prefers-reduced-motion`, plancher du projet. Le texte suffit. */}
        <Loader2
          className="size-3.5 shrink-0 animate-spin text-signal-fort motion-reduce:animate-none"
          aria-hidden="true"
        />
        Enregistrement…
      </>
    );
  }

  if (enAttente) {
    return (
      <>
        <PenLine className="size-3.5 shrink-0 text-signal-fort" aria-hidden="true" />
        Modification non enregistrée
      </>
    );
  }

  if (quand) {
    const moment = formaterEnregistrement(quand);
    return (
      <>
        <Check className="size-3.5 shrink-0" aria-hidden="true" />
        {moment ? `Enregistré le ${moment}` : "Enregistré"}
      </>
    );
  }

  if (efface) {
    return (
      <>
        <Check className="size-3.5 shrink-0" aria-hidden="true" />
        Note effacée
      </>
    );
  }

  // Aucune note, aucune frappe : l'indicateur se tait plutôt que d'annoncer un
  // vide que le champ vide dit déjà. L'élément reste dans le document pour que
  // `aria-describedby` et `aria-live` ne pointent jamais dans le vide.
  return null;
}
