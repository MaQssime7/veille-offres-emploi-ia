"use client";

/**
 * Le bloc d'enrichissement : le bouton, les étapes qui défilent, la conclusion.
 *
 * Entre : l'identifiant de l'offre, l'état calculé au rendu serveur, et si
 * l'enveloppe du jour est déjà consommée.
 * Sort : les quatre états du `DESIGN.md` — pas encore lancé, en cours, terminé,
 * échoué — et le cas « plafond atteint » sur le bouton.
 * Casse : une session expirée, une base injoignable ou un jeton GitHub périmé
 * rendent un message lisible ; le bloc ne reste jamais figé sans explication.
 *
 * ⚠️ **Composant client, donc règle n° 4 du `CLAUDE.md` : jamais l'objet
 * `offre`.** On reçoit un identifiant, un état déjà réduit à ce qui s'affiche,
 * et un booléen. `<BlocEnrichissement offre={offre} />` compilerait sans erreur
 * et enverrait toutes les colonnes dans le document.
 *
 * ⚠️ **L'état vient du SERVEUR, à chaque tour.** Ce composant ne décide jamais
 * seul qu'un enrichissement est mort : il affiche ce que
 * `calculerEtatEnrichissement` a conclu avec l'heure du serveur. Une horloge de
 * Mac en avance de vingt minutes déclarerait sinon morts des enrichissements qui
 * tournent.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Check, Sparkles } from "lucide-react";

import type { EtatEnrichissement } from "@/lib/enrichissement";
import { accorder } from "@/lib/francais";

import { demanderEnrichissement, suivreEnrichissement } from "../../../actions";

/**
 * Le rythme du sondage, tranché au cadrage du 16 août 2026.
 *
 * Supabase Realtime aurait écouté depuis le **navigateur**, avec une clé
 * publique, ce qui aurait obligé à ouvrir une politique de lecture publique sur
 * la table des étapes — en contradiction avec « le navigateur ne parle jamais
 * directement à Supabase ». Au pire 200 requêtes sur la durée d'un
 * enrichissement, pour un site à un utilisateur.
 *
 * ⚠️ **Le coût a été MESURÉ, parce qu'une revue a soulevé un doute fondé.**
 * L'objection : une action serveur renvoie normalement le rendu RSC de la route
 * courante, donc chaque tour rejouerait tout le rendu de la fiche — `lireOffre`
 * comprise — soit cinq requêtes Supabase toutes les 1,5 s au lieu de deux.
 * **Mesure du 30 août 2026 : 323 octets décodés par tour, contre 89 112 pour le
 * document complet.** Il n'y a pas de re-rendu, et la raison est précise :
 * `suivreEnrichissement` n'appelle **pas** `revalidatePath`, donc Next n'a
 * aucune route à réémettre. ⚠️ **Y ajouter un `revalidatePath` un jour ferait
 * basculer ce sondage d'une requête légère à un rendu complet toutes les 1,5
 * secondes**, sans le moindre signal.
 */
const RYTHME_MS = 1500;

/**
 * Le décalage du fondu-glissé, et son PLAFOND.
 *
 * ⚠️ **Le plafond n'est pas une coquetterie.** Le `DESIGN.md` demande 130 ms
 * entre deux étapes, ce qui est juste quand elles arrivent par une ou deux.
 * Mais rouvrir la fiche d'un enrichissement déjà terminé les monte **toutes en
 * même temps** : à 40 étapes, le dernier commencerait à apparaître 5,2 secondes
 * après l'ouverture de la page. On plafonne donc le cumul à sept rangs, soit
 * 780 ms — l'effet de cascade reste lisible, l'attente disparaît.
 */
const DECALAGE_MS = 130;
const DECALAGE_MAX_RANGS = 6;

export function BlocEnrichissement({
  identifiant,
  etatInitial,
  plafondAtteint,
  enveloppeIllisible = false,
  indisponible = false,
}: {
  identifiant: string;
  etatInitial: EtatEnrichissement;
  plafondAtteint: boolean;
  /**
   * L'enveloppe du jour n'a pas pu être lue.
   *
   * ⚠️ **Distinct de `plafondAtteint`.** On refuse de lancer dans les deux cas,
   * mais on ne dit pas la même chose : annoncer « le plafond est atteint »
   * après un aléa réseau de 20 ms serait une explication catégorique et fausse.
   */
  enveloppeIllisible?: boolean;
  /**
   * La base n'a pas pu dire où en est cet enrichissement.
   *
   * ⚠️ **Distinct de « jamais enrichie », exactement comme `veille.ts` sépare
   * « aucune veille » d'« état indisponible ».** Les confondre proposerait
   * d'enrichir une offre dont un enrichissement tourne peut-être déjà — et le
   * clic se ferait refuser par l'index sans que rien ne l'ait annoncé.
   */
  indisponible?: boolean;
}) {
  const [etat, setEtat] = useState(etatInitial);
  const [message, setMessage] = useState<string | null>(null);
  const [enCoursDeClic, demarrer] = useTransition();

  /**
   * ⚠️ **Le sondage est une chaîne de `setTimeout`, jamais un `setInterval`.**
   * Un intervalle relance au rythme fixe, que la requête précédente ait répondu
   * ou non : sur une base lente, les appels s'empilent et le navigateur en
   * garde plusieurs en vol pour la même information. Ici, le suivant n'est armé
   * qu'à la réception du précédent — le rythme devient un délai *entre* deux
   * réponses, ce qui est ce qu'on voulait dire.
   *
   * ⚠️ **`vivant` protège du démontage.** Sans lui, une réponse qui arrive après
   * que Maxime a quitté la fiche appellerait `setEtat` sur un composant démonté.
   */
  const etatCourant = etat.etat;
  useEffect(() => {
    if (etatCourant !== "en_cours") return;

    let vivant = true;
    let minuterie: ReturnType<typeof setTimeout> | undefined;

    const sonder = async () => {
      const resultat = await suivreEnrichissement(identifiant);
      if (!vivant) return;

      if (resultat.ok) {
        setEtat(resultat.etat);
        // ⚠️ **On n'arme PAS la suite ici quand l'état a conclu.** Le
        // changement d'état démonte cet effet, qui nettoie sa minuterie : c'est
        // ce qui réalise « le sondage s'arrête quand l'enrichissement se
        // conclut ». Réarmer avant le re-rendu ferait passer une requête de
        // trop après la fin.
        if (resultat.etat.etat === "en_cours") {
          minuterie = setTimeout(sonder, RYTHME_MS);
        }
        return;
      }

      // Une erreur de suivi n'interrompt pas l'enrichissement, qui tourne
      // ailleurs : on réessaie, sans effacer les étapes déjà affichées.
      minuterie = setTimeout(sonder, RYTHME_MS);
    };

    minuterie = setTimeout(sonder, RYTHME_MS);

    return () => {
      vivant = false;
      if (minuterie) clearTimeout(minuterie);
    };
  }, [etatCourant, identifiant]);

  const etapes = etat.etat === "absent" ? [] : etat.etapes;

  const lancer = () => {
    setMessage(null);
    demarrer(async () => {
      const resultat = await demanderEnrichissement(identifiant);
      if (resultat.ok) {
        // ⚠️ **On bascule à la main en « en cours » sans attendre le serveur.**
        // Le sondage prendra le relais 1,5 s plus tard et remplacera cet état
        // par la vérité de la base — mais entre le clic et la première réponse,
        // l'écran doit déjà montrer que quelque chose est parti.
        setEtat({
          etat: "en_cours",
          enrichissement: {
            id: 0,
            issue: "demande",
            demandeA: new Date().toISOString(),
            termineA: null,
            motifEchec: null,
          },
          etapes: [],
        });
        return;
      }
      setMessage(resultat.message);
    });
  };

  return (
    <section aria-labelledby="titre-enrichissement">
      {/* ⚠️ **Le compte n'est pas décoratif : sans lui, une liste qui défile
          se lit comme un texte tronqué.** Vu à 375 px avec 40 étapes — la
          neuvième était tranchée à mi-hauteur, sans rien pour dire qu'il y en
          avait trente et une autres. Même défaut que celui relevé par Maxime le
          29 août sur le résumé, et même correction : donner au lecteur de quoi
          savoir que la coupure est un cadre, pas une fin. */}
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="titre-enrichissement" className="titre-section">
          Enrichissement
        </h2>
        {etapes.length > 0 && (
          <span className="libelle-mono text-muted-foreground">
            {etapes.length} {accorder(etapes.length, "étape")}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 carte-produit p-6">
        {indisponible && (
          <p
            role="alert"
            className="flex items-start gap-2 text-base leading-relaxed text-foreground"
          >
            <AlertTriangle
              className="mt-1 size-4 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <span>
              L’état de l’enrichissement n’a pas pu être lu. Rechargez la page
              avant de relancer&nbsp;: un enrichissement est peut-être déjà en
              cours.
            </span>
          </p>
        )}

        {etat.etat === "absent" && !indisponible && (
          <p className="text-base leading-relaxed text-muted-foreground">
            Personne n’a encore cherché qui est cet employeur. L’enrichissement
            interroge le registre public des entreprises et lit le site de la
            société pour vérifier qu’il s’agit bien d’elle.
          </p>
        )}

        {etapes.length > 0 && (
          <ListeEtapes
            etapes={etapes}
            enCours={etat.etat === "en_cours"}
          />
        )}

        {etat.etat === "reussi" && (
          <p className="flex items-start gap-2 text-base leading-relaxed text-foreground">
            {/* ⚠️ `success-barre`, PAS `accessibilite-barre` : ce dernier n'existe
                dans aucun fichier de style. Tailwind n'émettait donc RIEN, et la
                coche héritait de l'encre du paragraphe — le seul repère de
                couleur de l'état « terminé » manquait, sans erreur de
                compilation. Trouvé en revue le 30 août 2026 ; le jeton du
                projet est celui qu'utilise déjà la barre d'accessibilité dans
                `notes.tsx`. */}
            <Check className="mt-1 size-4 shrink-0 text-success-barre" aria-hidden="true" />
            <span>Enrichissement terminé.</span>
          </p>
        )}

        {etat.etat === "echoue" && (
          <p
            role="alert"
            className="flex items-start gap-2 text-base leading-relaxed text-foreground"
          >
            <AlertTriangle
              className="mt-1 size-4 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <span>{etat.motif}</span>
          </p>
        )}

        <div className="flex flex-col items-start gap-2">
          <button
            type="button"
            onClick={lancer}
            disabled={
              etat.etat === "en_cours" ||
              enCoursDeClic ||
              plafondAtteint ||
              enveloppeIllisible ||
              indisponible
            }
            // ⚠️ Focus par `outline` via `focus-produit`, jamais par `ring` : le
            // `cushion-control` pose un `box-shadow` brut qui écrase les
            // `ring-*` de Tailwind, et l'anneau disparaît du style calculé.
            className="cushion-control inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors focus-produit hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="size-4 shrink-0" aria-hidden="true" />
            {etat.etat === "en_cours"
              ? "Enrichissement en cours…"
              : plafondAtteint
                ? "Plafond du jour atteint"
                : enveloppeIllisible
                  ? "Enveloppe non vérifiable"
                  : etat.etat === "absent"
                    ? "Enrichir cette offre"
                    : "Relancer l’enrichissement"}
          </button>

          {plafondAtteint && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              L’enveloppe quotidienne de tokens est consommée. Elle repart de
              zéro à minuit.
            </p>
          )}

          {enveloppeIllisible && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Impossible de vérifier ce qui a été dépensé aujourd’hui. Rien ne
              part tant qu’on ne le sait pas — rechargez la page.
            </p>
          )}

          {message && (
            <p role="alert" className="text-sm leading-snug text-destructive">
              {message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Les étapes franchies, de la plus ancienne à la plus récente.
 *
 * ⚠️ **`aria-live="polite"` et pas `assertive`** : les étapes arrivent toutes
 * les quelques secondes ; `assertive` interromprait la lecture en cours à
 * chacune, ce qui rendrait la page inutilisable au lecteur d'écran.
 *
 * ⚠️ **La liste défile dans son propre cadre.** Sans `max-h` et `overflow-y`,
 * un enrichissement de 40 étapes pousserait le bouton hors de l'écran et
 * allongerait la page entière — le critère du plan le nomme explicitement.
 */
function ListeEtapes({
  etapes,
  enCours,
}: {
  etapes: { rang: number; libelle: string; ecriteA: string }[];
  enCours: boolean;
}) {
  const listeRef = useRef<HTMLOListElement>(null);
  /**
   * ⚠️ **On ne suit la fin que si le lecteur y était déjà.** Rembobiner de
   * force la liste sous les yeux de quelqu'un qui vient de remonter lire une
   * étape passée serait la pire des « aides ». Ce drapeau est mis à jour au
   * défilement, jamais pendant le rendu.
   */
  const auBas = useRef(true);

  /**
   * ⚠️ **Pendant qu'un enrichissement tourne, l'information est en BAS.**
   * Sans cet effet, à 40 étapes on regardait la première pendant que la
   * dernière — celle qui pulse, celle qui dit où on en est — était hors du
   * cadre. Vu à l'écran le 30 août 2026.
   *
   * Le défilement est instantané et non « lissé » : la règle
   * `prefers-reduced-motion` de `globals.css` force déjà `scroll-behavior:
   * auto`, donc un lissage ne s'appliquerait qu'à une partie des visiteurs et
   * ne serait jamais éprouvé sur l'autre.
   */
  useEffect(() => {
    const liste = listeRef.current;
    if (!liste || !enCours || !auBas.current) return;
    liste.scrollTop = liste.scrollHeight;
  }, [etapes.length, enCours]);
  /**
   * ⚠️ **Le décalage se compte depuis la PREMIÈRE étape affichée, pas depuis le
   * rang absolu.** Sur un enrichissement rouvert plus tard, la 40ᵉ étape a le
   * rang 39 : un délai fondé sur le rang la ferait apparaître cinq secondes
   * après les autres. On plafonne de toute façon, mais partir du premier rang
   * visible garde l'effet juste quand le bloc se remonte.
   */
  //
  // ⚠️ **Un `useState` à initialiseur paresseux, jamais un `useRef`.** La
  // première écriture utilisait une ref, et le lint l'a refusée avec raison :
  // lire `ref.current` pendant le rendu est un piège connu de React — la valeur
  // peut changer sans déclencher de nouveau rendu, et l'affichage se met alors
  // à dépendre d'une donnée que React ne suit pas. `useState(() => …)` calcule
  // la même valeur une seule fois, au montage, et elle est faite pour être lue
  // pendant le rendu.
  const [premierRang] = useState(() => etapes[0]?.rang ?? 0);

  return (
    <ol
      ref={listeRef}
      aria-live="polite"
      onScroll={(evenement) => {
        const liste = evenement.currentTarget;
        // 40 px de tolérance : on considère qu'on « suit » la fin même sans
        // être collé au pixel près, sinon le moindre cran de molette décroche.
        auBas.current =
          liste.scrollTop + liste.clientHeight >= liste.scrollHeight - 40;
      }}
      className="flex max-h-80 flex-col gap-2 overflow-y-auto"
    >
      {etapes.map((etape, index) => {
        const rangs = Math.min(
          Math.max(0, etape.rang - premierRang),
          DECALAGE_MAX_RANGS,
        );
        const derniere = index === etapes.length - 1;
        return (
          <li
            key={etape.rang}
            // `fill-mode-both` retient l'état initial pendant le délai : sans
            // lui, l'étape s'affiche pleine, disparaît, puis réapparaît.
            className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both flex items-start gap-2 text-base leading-relaxed text-foreground"
            style={{ animationDelay: `${rangs * DECALAGE_MS}ms` }}
          >
            <span
              aria-hidden="true"
              // ⚠️ La pulsation est coupée sous `prefers-reduced-motion` par la
              // règle globale de `globals.css`, qui force
              // `animation-iteration-count: 1` — la pastille s'allume une fois
              // puis reste fixe, au lieu de battre indéfiniment.
              className={`mt-2 size-2 shrink-0 rounded-full ${
                derniere && enCours ? "animate-pulse bg-signal-fort" : "bg-muted-foreground"
              }`}
            />
            <span>{etape.libelle}</span>
          </li>
        );
      })}
    </ol>
  );
}
