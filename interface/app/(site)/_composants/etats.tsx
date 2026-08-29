import { CalendarOff, DatabaseZap, Inbox } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { MotifEchec } from "@/lib/supabase";

/** L'ossature commune aux écrans qui n'ont pas d'offres à montrer. */
function Panneau({
  icone,
  titre,
  children,
  ton = "neutre",
  niveauTitre = 2,
}: {
  icone: ReactNode;
  titre: string;
  children: ReactNode;
  ton?: "neutre" | "erreur";
  /**
   * ⚠️ **Le niveau se choisit selon la page, pas selon l'apparence.** Sur
   * `/offres`, le `h1` « Offres » existe déjà et ce panneau vient dessous :
   * niveau 2. Sur la fiche d'une offre, le `h1` est l'intitulé — qu'on n'a
   * précisément pas pu lire : le panneau devient alors le premier titre de la
   * page, et sauter du niveau 1 au niveau 2 casse le plan sur lequel un
   * lecteur d'écran navigue. La taille visuelle, elle, ne bouge pas.
   */
  niveauTitre?: 1 | 2;
}) {
  const Titre = niveauTitre === 1 ? "h1" : "h2";
  return (
    <div
      // ⚠️ **Le panneau d'erreur garde son FILET, là où le panneau neutre
      // prend un coussin.** Les deux sont arrondis comme les cartes de la
      // liste, mais l'erreur ne doit pas ressembler à une carte de contenu de
      // plus : le filet brique la désigne comme un avertissement, ce qu'une
      // ombre douce ferait exactement le contraire.
      className={cn(
        "flex flex-col items-start gap-3 rounded-2xl px-5 py-8 sm:px-8 sm:py-10",
        ton === "erreur"
          ? "border border-destructive/40 bg-destructive/5"
          : "cushion-card bg-card",
      )}
    >
      <span
        className={cn(
          ton === "erreur" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {icone}
      </span>
      <Titre className="font-display text-xl font-bold leading-tight text-foreground">
        {titre}
      </Titre>
      <div className="max-w-prose text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

/**
 * La base répond, mais elle est vide. C'est l'écran du tout premier matin,
 * avant que le cron n'ait jamais tourné — et il ne doit surtout pas ressembler
 * à une panne, sinon on cherchera un bug là où il n'y en a pas.
 */
export function AucuneOffre() {
  return (
    <Panneau
      icone={<Inbox className="size-6" aria-hidden="true" />}
      titre="Aucune offre pour l'instant"
    >
      <p>
        La base est joignable, elle ne contient simplement encore aucune offre.
        La collecte tourne chaque nuit&nbsp;; les premières annonces
        apparaîtront ici au prochain passage.
      </p>
    </Panneau>
  );
}

/**
 * Le filtre choisi ne contient aucune offre — alors que la base, elle, en a.
 *
 * ⚠️ **C'est un état DISTINCT de « la base est vide », et les confondre serait
 * un vrai défaut.** Depuis la phase 4, `/offres` n'affiche par défaut que les
 * offres « à traiter » : le jour où Maxime aura tout trié, il verra un écran
 * vide. Lui servir « la collecte tourne chaque nuit, les premières annonces
 * apparaîtront au prochain passage » lui ferait croire à une panne de collecte
 * un matin où il a simplement fini son travail. Le même mot pour deux
 * situations est ce qui rend un écran vide anxiogène.
 *
 * ⚠️ **Le message nomme le filtre et rappelle où sont les autres offres.** Un
 * état vide qui ne dit pas comment en sortir est une impasse — d'autant que le
 * filtre par défaut ne laisse aucune trace dans l'adresse, donc rien à l'écran
 * ne rappelle qu'un filtre est actif hormis la barre d'onglets.
 */
export function AucuneOffreDansCeFiltre({
  libelle,
  totalBase,
  raison = "mais aucune ne porte ce statut pour l’instant",
}: {
  /** Le libellé du filtre actif, tel qu'il s'écrit sur son onglet. */
  libelle: string;
  /** Combien d'offres existent tous statuts confondus. `null` si inconnu. */
  totalBase: number | null;
  /**
   * ⚠️ **La raison est PARAMÉTRABLE depuis l'arrivée de l'onglet « Nouveau »,
   * et ce n'est pas de la souplesse gratuite.** « Aucune ne porte ce statut »
   * était juste tant que les quatre onglets filtraient un statut ; « Nouveau »
   * n'en est pas un — il désigne la dernière collecte. La phrase générique
   * aurait affirmé qu'un statut nommé « Nouveau » existe en base, ce qui est
   * faux et enverrait chercher une colonne qui n'existe pas.
   */
  raison?: string;
}) {
  return (
    <Panneau
      icone={<Inbox className="size-6" aria-hidden="true" />}
      titre={`Aucune offre « ${libelle} »`}
    >
      <p>
        La base répond et contient
        {totalBase !== null ? ` ${totalBase} offre${totalBase >= 2 ? "s" : ""}` : " des offres"}
        , {raison}. Les autres filtres ci-dessus restent accessibles.
      </p>
    </Panneau>
  );
}

/**
 * L'onglet « Nouveau » est ouvert, la base répond, et **aucune collecte n'a
 * jamais abouti**.
 *
 * ⚠️ **C'est un CINQUIÈME état, et il ne doit être fondu ni dans « ce filtre
 * est vide » ni dans « la base est injoignable ».** Les trois montrent une page
 * sans offres et disent trois choses différentes : « la nuit n'a rien ramené de
 * neuf », « rien ne répond », et ici « il n'y a pas encore de nuit de
 * référence ». C'est l'écran du tout premier matin, ou celui d'une base dont
 * toutes les exécutions ont échoué.
 *
 * ⚠️ **Le message a été CORRIGÉ le 29 août 2026, et l'ancien était faux.** Il
 * disait « la liste des offres répond, mais pas le journal des collectes » —
 * une affirmation sur la liste, alors qu'avec ce filtre la liste n'est même pas
 * interrogée : sans identifiant d'exécution, il n'y a rien à demander. Vu à
 * l'écran en coupant Supabase : la panne générale s'affichait comme une panne
 * du seul journal des collectes, et aurait envoyé chercher au mauvais endroit.
 * Le cas « injoignable » est désormais trié en amont, dans `listerOffres`.
 *
 * ⚠️ **Même cause que la bulle « Nouveau » absente de toutes les lignes** : sans
 * dernière collecte réussie, plus rien à l'écran ne distingue les offres de la
 * nuit. L'écran le dit au lieu de le taire.
 */
export function NouveautesInconnues() {
  return (
    <Panneau
      // ⚠️ **PAS `DatabaseZap`, qui est l'icône de « la base est injoignable ».**
      // Relevé en revue le 29 août 2026 : tout l'intérêt de cet état est de ne
      // pas se lire comme une panne de base — c'est même pour ça que
      // `lireDerniereExecution` distingue désormais l'échec de l'absence. Deux
      // écrans que le code sépare avec soin et que l'œil confond au même
      // pictogramme, c'est le travail défait par un détail. Un calendrier barré
      // dit ce dont il s'agit : il n'y a pas eu de nuit de référence.
      icone={<CalendarOff className="size-6" aria-hidden="true" />}
      titre="Aucune collecte n’a encore abouti"
    >
      {/* Apostrophes typographiques, comme partout ailleurs dans ces panneaux :
          l’apostrophe droite est refusée par le lint en texte JSX. */}
      <p>
        La base répond, mais aucune collecte ne s’est terminée avec
        succès&nbsp;: il n’y a donc pas de «&nbsp;dernière nuit&nbsp;» à laquelle
        comparer les offres. Les autres filtres ci-dessus restent accessibles, et
        l’état de la veille en haut de page dit où en est la collecte.
      </p>
    </Panneau>
  );
}

/**
 * La base n'a pas répondu.
 *
 * ⚠️ **Le détail technique ne descend jamais jusqu'ici.** Le corps d'une erreur
 * PostgREST peut contenir l'adresse du projet ou la structure de la requête
 * refusée ; il reste dans le journal du serveur. L'écran ne dit que ce qui est
 * actionnable — sauf pour le motif « configuration », où la variable absente
 * est nommée : ce site n'a qu'un utilisateur, et c'est lui qui pose les
 * variables chez l'hébergeur.
 */
export function BaseInjoignable({
  motif,
  explication,
  niveauTitre,
}: {
  motif: MotifEchec;
  explication: string;
  niveauTitre?: 1 | 2;
}) {
  return (
    <Panneau
      ton="erreur"
      niveauTitre={niveauTitre}
      icone={<DatabaseZap className="size-6" aria-hidden="true" />}
      titre={
        motif === "configuration"
          ? "Le site n'est pas configuré"
          : "La base est injoignable"
      }
    >
      {motif === "configuration" ? (
        <p>
          {explication} Les offres ne peuvent pas être lues tant qu’elle n’est
          pas posée dans les variables d’environnement.
        </p>
      ) : (
        <p>
          Les offres n’ont pas pu être lues. Elles ne sont pas perdues&nbsp;:
          elles sont en base, c’est la lecture qui a échoué. Recharger la page
          suffit souvent&nbsp;; le détail de la panne est dans le journal du
          serveur.
        </p>
      )}
    </Panneau>
  );
}
