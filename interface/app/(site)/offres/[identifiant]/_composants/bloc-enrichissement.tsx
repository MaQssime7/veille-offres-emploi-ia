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
  tokensReels,
  tokensReserves,
  tokensPlafond,
}: {
  identifiant: string;
  etatInitial: EtatEnrichissement;
  plafondAtteint: boolean;
  /** Ce qui a été RÉELLEMENT facturé aujourd'hui. Voir `JaugeEnveloppe`. */
  tokensReels: number;
  /** Ce que les enrichissements en vol immobilisent sans l'avoir dépensé. */
  tokensReserves: number;
  /** L'enveloppe du jour, `ENVELOPPE_QUOTIDIENNE_TOKENS`. */
  tokensPlafond: number;
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
   * ⚠️ **L'enveloppe est un ÉTAT, pas seulement une prop — correctif de revue
   * du 31 août 2026.** Ses nombres viennent du rendu serveur, et ce composant
   * ne le redemande jamais : `suivreEnrichissement` n'appelle délibérément pas
   * `revalidatePath` (voir `RYTHME_MS`). Laissée sur les props, la jauge restait
   * donc figée à sa valeur du chargement : l'écran annonçait « Enrichissement
   * terminé » au-dessus d'une barre affirmant encore « dont 150 000 réservés
   * pour l'enrichissement en cours », avec un total ignorant ce qui venait
   * d'être dépensé. Il fallait recharger la page pour voir juste.
   *
   * Le sondage renvoie maintenant l'enveloppe **à la conclusion**, et c'est ici
   * qu'elle atterrit.
   */
  const [enveloppe, setEnveloppe] = useState({
    reels: tokensReels,
    reserves: tokensReserves,
    plafond: tokensPlafond,
  });

  /**
   * ⚠️ **Recalculé sur l'enveloppe COURANTE, et c'est de l'affichage seul.**
   * La prop `plafondAtteint` vieillit avec les nombres qui l'ont produite : à la
   * conclusion d'un gros enrichissement, le bouton se rouvrait en « Relancer »
   * alors que l'enveloppe venait de se remplir. **La garde qui compte reste
   * côté serveur**, dans `demanderEnrichissement` — celle-ci ne fait qu'éviter
   * de proposer un geste qui serait refusé.
   *
   * ⚠️ On garde `plafondAtteint` comme plancher : le serveur peut savoir la
   * journée fermée pour une raison que ces trois nombres ne montrent pas.
   */
  const plafondCourant =
    plafondAtteint || enveloppe.reels + enveloppe.reserves >= enveloppe.plafond;

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
        // ⚠️ `null` pendant le travail — la jauge garde alors son dernier
        // nombre sûr, réservation comprise, qui est exact. `null` signifie
        // aussi « enveloppe illisible » : dans les deux cas on ne remplace pas
        // une valeur juste par un zéro inventé.
        if (resultat.enveloppe) setEnveloppe(resultat.enveloppe);
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
            disabled={plafondCourant || enveloppeIllisible || indisponible}
          >
            {!enAttente && (
              <Sparkles className="size-4 shrink-0" aria-hidden="true" />
            )}
            {enAttente
              ? "Enrichissement en cours"
              : plafondCourant
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
          {plafondCourant && !enAttente && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              L’enveloppe quotidienne de tokens est consommée.
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

          {/* ⚠️ **La jauge ne se tait JAMAIS, même quand l'enveloppe est
              illisible** — elle affiche alors zéro sur le plafond, et le
              message d'à côté explique qu'on n'a pas pu vérifier. La masquer
              ferait disparaître le seul repère de dépense au moment précis où
              le bouton refuse de partir sans qu'on sache pourquoi. */}
          <JaugeEnveloppe
            reels={enveloppe.reels}
            reserves={enveloppe.reserves}
            plafond={enveloppe.plafond}
          />
        </div>
      </div>
    </section>
  );
}

/**
 * Ce que la journée a consommé sur l'enveloppe, en barre et en toutes lettres.
 *
 * Entre : les tokens réellement facturés, ceux réservés par un enrichissement
 * en vol, et le plafond du jour.
 * Sort : une barre à deux segments et la même information écrite.
 * Casse : ne lève pas. Un plafond à zéro ne divise rien, un dépassement sature
 * la barre à 100 % au lieu de la faire déborder de son cadre.
 *
 * ⚠️ **DEUX SEGMENTS, parce qu'un seul nombre mentirait à l'œil.** Un
 * enrichissement en vol réserve `COUT_PRESUME_TOKENS` (150 000) avant d'avoir
 * dépensé un token — c'est ce qui empêche dix clics dans la même minute de
 * crever l'enveloppe ensemble. Une jauge nourrie du seul total **bondirait de
 * 0 à 50 % au clic** puis redescendrait à la conclusion : le chiffre serait
 * vrai et se lirait comme un défaut. Le segment pâle dit « pas encore dépensé,
 * mais déjà retenu ».
 *
 * ⚠️ **« Remise à zéro à minuit », et surtout PAS un décompte.** Cette page est
 * rendue côté serveur : un temps restant y serait figé à l'heure du chargement
 * et vieillirait en silence dans un onglet resté ouvert — le défaut que le
 * projet porte déjà, assumé, sur l'indicateur de veille. Une phrase vraie sans
 * horloge vaut mieux qu'un compte à rebours qui ment.
 *
 * ⚠️ **La barre porte `aria-hidden`, et l'information ne repose jamais sur
 * elle.** Le total, le plafond et le pourcentage sont écrits juste dessous —
 * c'est ce qui rend acceptable que le segment de réserve soit un pastel sous
 * les 3:1 exigés d'un objet graphique en mode clair, exactement l'arbitrage
 * déjà tenu pour les barres de note. **Le jour où ce texte disparaîtrait, ce
 * choix redeviendrait un défaut.**
 */
function JaugeEnveloppe({
  reels,
  reserves,
  plafond,
}: {
  reels: number;
  reserves: number;
  plafond: number;
}) {
  const total = reels + reserves;
  // Un plafond à zéro ne devrait pas exister, mais une division par zéro rend
  // `Infinity` — et `width: Infinity%` casse la mise en page sans erreur.
  const part = (valeur: number) =>
    plafond > 0 ? Math.min(100, (valeur / plafond) * 100) : 0;

  const partReels = part(reels);
  // ⚠️ La réserve est bornée par CE QUI RESTE après le réel, sinon les deux
  // segments additionnés dépassent 100 % et le second déborde de la piste.
  const partReserves = Math.min(part(reserves), 100 - partReels);
  const pourcentage = plafond > 0 ? Math.min(100, Math.round((total / plafond) * 100)) : 0;

  return (
    // ⚠️ **Largeur BORNÉE, et ce n'est pas cosmétique.** Vu à l'écran : à pleine
    // largeur de carte (930 px), la barre écrasait les deux boutons au-dessus
    // et se lisait comme l'objet principal de la section — alors que l'objet
    // principal est le bouton. Même arbitrage que les barres de note sur la
    // fiche, bornées à 13 rem. En dessous de `sm`, elle reprend toute la
    // largeur : la place y est comptée et la borne n'a plus de sens.
    <div className="mt-2 w-full sm:max-w-sm">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        {/* ⚠️ **Le libellé ne se retire pas, même pour gagner une ligne.** Sans
            lui, « 204 944 / 300 000 tokens » ne dit pas DE QUOI la barre est une
            fraction — on lit un compteur sans savoir ce qu'il compte. C'est la
            même règle que « Intérêt » et « Accessibilité » devant les barres de
            note, et elle a la même raison. */}
        <span className="libelle-mono text-foreground">Enveloppe du jour</span>
        <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
          {pourcentage}&nbsp;%
        </span>
      </div>

      <span
        aria-hidden="true"
        // ⚠️ **Teintes NEUTRES, et c'est une décision de système, pas un défaut
        // de goût.** Les six accents du projet sont pris et portent chacun un
        // rôle : le bleu est la note d'intérêt, la menthe l'accessibilité, le
        // jaune le temporel. Une jauge de consommation peinte en bleu se serait
        // lue comme un troisième usage du bleu et aurait suggéré un lien avec
        // la note d'intérêt, qui n'existe pas. **Une consommation est une
        // quantité, pas un signal catégoriel** : elle n'a donc pas à prendre un
        // accent, et le septième signal que le `CLAUDE.md` interdit reste
        // interdit.
        className="flex h-2 w-full overflow-hidden rounded-full bg-foreground/12"
      >
        {/* La largeur est calculée à l'exécution : Tailwind lit le code source
            pour savoir quelles classes produire et ne peut pas générer
            `w-[37%]` pour une valeur qu'il ne voit pas. Le style en ligne est
            ici la solution correcte, pas un raccourci. Même raisonnement que
            les barres de note. */}
        <span className="block h-full bg-foreground" style={{ width: `${partReels}%` }} />

        {/* ⚠️ **La réserve se distingue par une TEXTURE, pas par une teinte — et
            c'est une correction mesurée le 31 août 2026.** Le premier jet la
            peignait en encre atténuée (`bg-foreground/35`) sur une piste
            atténuée : mesuré au canvas, **1,64:1 entre les deux en mode
            sombre**, c'est-à-dire indiscernable du rail vide. Trois densités
            d'une même encre sur une barre de 8 px de haut ne peuvent pas
            s'écarter assez — le problème est structurel, pas un mauvais
            réglage.
            Des hachures d'encre PLEINE règlent ça sans couleur tierce : elles
            se distinguent du plein par leur trame et du vide par leur encre,
            dans les deux modes, **sans dépendre d'un rapport de clarté**. Et
            « retenu, pas encore dépensé » se lit naturellement en hachuré.
            ⚠️ `currentColor` et non un jeton en dur : la trame suit l'encre du
            mode courant, sinon elle serait noire sur fond sombre. */}
        <span
          className="block h-full text-foreground"
          style={{
            width: `${partReserves}%`,
            backgroundImage:
              "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
          }}
        />
      </span>

      <p className="mt-1.5 text-sm leading-relaxed text-foreground">
        <span className="font-mono tabular-nums">
          {formaterMilliers(total)} / {formaterMilliers(plafond)}
        </span>{" "}
        tokens
      </p>

      {reserves > 0 && (
        // ⚠️ Ce n'est pas un détail à masquer : sans cette ligne, le bond de la
        // barre au clic n'a aucune explication à l'écran.
        <p className="text-sm leading-relaxed text-muted-foreground">
          dont <span className="font-mono tabular-nums">{formaterMilliers(reserves)}</span>{" "}
          réservés pour l’enrichissement en cours
        </p>
      )}

      <p className="text-sm leading-relaxed text-muted-foreground">
        Remise à zéro à minuit.
      </p>
    </div>
  );
}

/**
 * 112000 → « 112 000 », avec des espaces INSÉCABLES.
 *
 * ⚠️ **Écrit à la main plutôt que `toLocaleString("fr-FR")`, et c'est une
 * précaution d'hydratation.** Ce composant est rendu une première fois sur le
 * serveur puis réhydraté dans le navigateur : si les deux environnements ne
 * s'accordent pas sur le séparateur de milliers — Node et les navigateurs ont
 * employé tour à tour l'espace fine insécable U+202F et l'espace insécable
 * U+00A0 selon leur version d'ICU — React signale une différence d'hydratation
 * en console et remplace le nœud. Un caractère écrit en dur ne peut pas
 * diverger.
 *
 * ⚠️ Insécable et non ordinaire : « 300 000 » coupé en fin de ligne se lirait
 * comme deux nombres.
 */
function formaterMilliers(valeur: number): string {
  return Math.max(0, Math.round(valeur))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
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
