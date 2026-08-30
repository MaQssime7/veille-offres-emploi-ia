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

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Check, Eye, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContenu,
  DialogCorps,
  DialogEntete,
  DialogTrigger,
} from "@/components/ui/dialog";

import { FicheEnrichissement } from "./fiche-enrichissement";

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

  /**
   * ⚠️ **Trois causes d'attente, un seul état visible.** Le clic est parti
   * (`enCoursDeClic`), le serveur a répondu et le sondage prend le relais
   * (`etat.etat === "en_cours"`) : pour qui regarde, c'est la même chose. Les
   * séparer à l'écran ferait clignoter le bouton entre deux apparences pendant
   * la seconde qui les sépare.
   */
  const enAttente = enCoursDeClic || etat.etat === "en_cours";

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
            // Rien n'a encore été cherché : il n'y a pas de fiche à montrer, et
            // il n'y en aura pas avant la conclusion.
            fiche: null,
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
        {/* Le compte accompagne la ligne unique : c'est lui qui montre que ça
            avance quand une seule étape est visible à la fois. Il disparaît
            avec elle, le chemin complet étant repris dans la fenêtre. */}
        {etat.etat === "en_cours" && etapes.length > 0 && (
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

        {/* ⚠️ **La ligne d'étape ne vit que PENDANT le travail.** Une fois
            l'enrichissement conclu, ce qu'on veut savoir n'est plus « où il en
            est » mais « qu'a-t-il trouvé » — et cela vit dans la fenêtre. La
            laisser afficherait une quatrième ligne dans une section que Maxime
            a demandée à trois : le bouton, la confirmation, l'accès à la
            fiche. */}
        {etat.etat === "en_cours" && etapes.length > 0 && (
          <EtapeCourante etapes={etapes} />
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

        {/* ⚠️ **La fiche s'ouvre en fenêtre, elle ne se déplie pas dans la
            page.** Décision de Maxime le 30 août 2026. Ce que ça gagne : la
            section reste courte quel que soit ce que l'agent a trouvé, et la
            fiche dispose de toute la surface plutôt que d'une colonne de
            1 000 px partagée avec le reste.
            ⚠️ Ce que ça impose en retour, et que Radix prend en charge : le
            focus doit être piégé dans la fenêtre, `Échap` doit fermer, et le
            reste de la page doit passer en `aria-hidden`. Une `<div>` posée
            par-dessus ne ferait rien de tout cela — un lecteur d'écran
            continuerait de lire la page dessous comme si de rien n'était. */}
        {/* ⚠️ **`items-start` sur l'enveloppe, sinon le bouton s'étire.** Le
            cadre est un `flex flex-col`, dont l'alignement par défaut est
            `stretch` : un bouton posé directement dedans occupe toute la
            largeur et cesse de ressembler à un bouton. Vu à l'écran. */}
        {etat.etat === "reussi" && etat.enrichissement.fiche && (
          <div className="flex flex-col items-start">
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="lg">
                <Eye className="size-4 shrink-0" aria-hidden="true" />
                Voir l’enrichissement
              </Button>
            </DialogTrigger>
            <DialogContenu large>
              <DialogEntete
                titre="Ce que l’agent a trouvé"
                description={
                  etat.enrichissement.fiche.nomOfficiel ?? undefined
                }
              />
              <DialogCorps>
                <FicheEnrichissement
                  fiche={etat.enrichissement.fiche}
                  etapes={etapes}
                />
              </DialogCorps>
            </DialogContenu>
          </Dialog>
          </div>
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
          {/* ⚠️ **Le `<button>` natif cède la place au `Button` du projet le
              30 août 2026**, pour son état d'attente — un tourniquet repris du
              registre 1st-Pouf. Ce n'est pas une préférence de style : `loading`
              DÉSACTIVE le bouton, et un bouton qui a l'air actif pendant qu'une
              demande est en vol se clique deux fois. Le second clic partirait
              vers une action serveur facturée.
              ⚠️ Pendant l'attente, l'icône disparaît au profit du tourniquet —
              sinon les deux se disputeraient la place et la largeur du bouton
              sauterait au démarrage. */}
          <Button
            type="button"
            size="lg"
            onClick={lancer}
            loading={enAttente}
            disabled={plafondAtteint || enveloppeIllisible || indisponible}
          >
            {!enAttente && (
              <Sparkles className="size-4 shrink-0" aria-hidden="true" />
            )}
            {enAttente
              ? "Enrichissement en cours"
              : plafondAtteint
                ? "Plafond du jour atteint"
                : enveloppeIllisible
                  ? "Enveloppe non vérifiable"
                  : etat.etat === "absent"
                    ? "Enrichissement par IA"
                    : "Relancer l’enrichissement"}
          </Button>

          {/* ⚠️ **Les deux avertissements d'enveloppe se taisent pendant qu'un
              enrichissement tourne.** Vu à l'écran le 30 août 2026 : « le
              plafond du jour est atteint » s'affichait sous un bouton qui
              annonçait « Enrichissement en cours », ce qui se lit comme une
              contradiction — celui qui tourne, lui, ira au bout. Ces messages
              expliquent pourquoi on ne peut PAS lancer ; ils n'ont rien à dire
              tant que quelque chose est déjà parti. */}
          {plafondAtteint && !enAttente && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              L’enveloppe quotidienne de tokens est consommée. Elle repart de
              zéro à minuit.
            </p>
          )}

          {enveloppeIllisible && !enAttente && (
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
 * L'étape en cours, et elle seule — affichée pendant que l'agent travaille.
 *
 * ⚠️ **UNE LIGNE, PAS UNE LISTE — revirement du 30 août 2026, demandé par
 * Maxime après avoir vu un enrichissement réel défiler.** La version précédente
 * empilait les étapes dans un cadre défilant de 320 px. Elle avait été écrite
 * pour répondre à un vrai défaut — à 40 étapes, la neuvième était tranchée à
 * mi-hauteur sans rien pour dire qu'il y en avait trente et une autres — mais
 * elle répondait à côté : le problème n'était pas que la liste fût mal coupée,
 * c'est qu'une liste n'était pas le bon objet. Ce qu'on regarde pendant qu'un
 * agent travaille, c'est **où il en est**, pas par où il est passé.
 *
 * ⚠️ **Le chemin complet n'est plus ici du tout** : il est repris dans la
 * fenêtre « Voir l'enrichissement », avec la fiche. Ce composant ne connaît que
 * le présent.
 *
 * ⚠️ **La hauteur est bornée en BAS et en HAUT, et c'est ce qui empêche un
 * saut.** Les libellés n'ont pas tous la même longueur : « Lecture du site
 * bnf.fr » tient sur une ligne, « Registre : 32 entreprises portent
 * "Expertime", 5 examinées » en prend deux, et la contrainte de base en
 * autorise 200 caractères. Sans plancher, le bouton en dessous remonterait et
 * redescendrait à chaque étape ; sans plafond, il serait chassé hors de
 * l'écran. C'est le piège de méthode n° 5 du projet, pris là où il se produit.
 *
 * ⚠️ **`aria-live="polite"` et pas `assertive`** : les étapes arrivent toutes
 * les quelques secondes ; `assertive` interromprait la lecture en cours à
 * chacune, ce qui rendrait la page inutilisable au lecteur d'écran.
 */
function EtapeCourante({
  etapes,
}: {
  etapes: { rang: number; libelle: string; ecriteA: string }[];
}) {
  const courante = etapes[etapes.length - 1];
  if (!courante) return null;

  return (
    // ⚠️ La zone vivante est ce `div`, PAS la ligne qui change. Une région
    // `aria-live` posée sur un élément que React remplace à chaque étape serait
    // retirée puis réinsérée : les lecteurs d'écran n'annoncent pas le contenu
    // d'une région qui vient d'apparaître, ils annoncent ce qui change DANS une
    // région déjà présente. Posée ici, elle survit à tous les remplacements.
    <div aria-live="polite" className="flex min-h-13 items-start gap-2">
      <span
        aria-hidden="true"
        // ⚠️ La pulsation est coupée sous `prefers-reduced-motion` par la règle
        // globale de `globals.css`, qui force `animation-iteration-count: 1`.
        className="mt-2 size-2 shrink-0 animate-pulse rounded-full bg-signal-fort"
      />
      {/* ⚠️ La `key` porte le rang : elle force React à REMONTER ce nœud à
          chaque étape, ce qui rejoue l'animation d'entrée. Sans elle, React
          réutiliserait le même élément en changeant son texte, et le libellé se
          remplacerait sèchement — on ne verrait pas que quelque chose vient de
          se passer. */}
      <span
        key={courante.rang}
        className="animate-in fade-in slide-in-from-bottom-1 line-clamp-3 text-base leading-relaxed text-foreground"
      >
        {courante.libelle}
      </span>
    </div>
  );
}
