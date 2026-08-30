import {
  CalendarOff,
  CheckCheck,
  CircleDashed,
  Hourglass,
  Inbox,
  Moon,
} from "lucide-react";
import type { ReactNode } from "react";

import { accorder, daterPassage } from "@/lib/francais";
import { SEUIL_INTERET_MATIN } from "@/lib/matin";

import { Panneau } from "./etats";

/**
 * Les écrans du matin qui n'ont aucune offre à montrer.
 *
 * Entre : la date de la collecte dont on rend compte, et ce que le résumé a
 * compté.
 * Sort : un panneau qui dit **laquelle** des six situations on est en train de
 * vivre.
 * Casse : rien, ce sont des composants d'affichage.
 *
 * ⚠️ **Six panneaux plutôt qu'un seul, et c'est le cœur de l'écran.** Un unique
 * « rien à afficher ce matin » dirait la même chose une nuit calme, une nuit où
 * la notation est tombée, un matin où tout a été trié et un jour où la base ne
 * répond pas. Quatre situations, quatre réactions différentes : fermer
 * l'onglet, aller voir le journal GitHub Actions, se féliciter, recharger.
 * C'est US-27, et c'est ce qui distingue un compte rendu d'un écran vide.
 *
 * ⚠️ **Chacun rappelle la date de la dernière collecte réussie** — critère
 * d'acceptation de la phase 5. Un écran vide sans date laisse croire qu'il
 * parle de ce matin ; c'est précisément le cas où il faut savoir que la
 * dernière nuit remonte à trois jours.
 */

/**
 * L'ossature des panneaux du matin : le panneau commun, plus la ligne de date.
 *
 * ⚠️ **La date est en pied et non dans le texte**, pour qu'elle tombe toujours
 * au même endroit d'un panneau à l'autre. Noyée dans une phrase, elle changerait
 * de place à chaque message et cesserait de se lire d'un coup d'œil.
 */
function PanneauMatin({
  icone,
  titre,
  collecteA,
  maintenant,
  children,
}: {
  icone: ReactNode;
  titre: string;
  /** Horodatage ISO de la collecte dont l'écran rend compte. */
  collecteA: string;
  maintenant: Date;
  children: ReactNode;
}) {
  return (
    <Panneau icone={icone} titre={titre}>
      {children}
      <p className="libelle-mono mt-4 text-muted-foreground">
        Dernière collecte&nbsp;: {daterPassage(collecteA, maintenant)}
      </p>
    </Panneau>
  );
}

/**
 * Aucune collecte n'a jamais réussi : il n'y a pas de nuit de référence.
 *
 * ⚠️ **Le seul panneau du matin SANS date**, forcément — il n'y en a aucune à
 * afficher. C'est aussi ce qui le distingue de « la base est injoignable » : ici
 * la base répond très bien, c'est le pipeline qui n'a jamais abouti.
 */
export function AucuneCollecte() {
  return (
    <Panneau
      icone={<CalendarOff className="size-6" aria-hidden="true" />}
      titre="Aucune collecte n’a encore abouti"
    >
      <p>
        La base répond, mais aucune collecte ne s’est terminée avec
        succès&nbsp;: il n’y a pas encore de nuit dont rendre compte. L’état de
        la veille, en haut de page, dit où en est le pipeline.
      </p>
    </Panneau>
  );
}

/**
 * La collecte a réussi et aucune offre ne lui est rattachée.
 *
 * ⚠️ **Le message dit « aucune annonce NOUVELLE », et le mot est un correctif de
 * revue du 30 août 2026.** Il disait « aucune annonce ne correspondait aux
 * critères de recherche cette nuit-là » — une affirmation sur ce que France
 * Travail publiait, alors que `resume.total === 0` ne dit rien de tel : il dit
 * qu'aucune offre ne porte cet `execution_id`. Or la collecte écrit en
 * `ignore-duplicates` (`pipeline/stockage.py`), donc **une offre déjà connue
 * reste rattachée à l'exécution qui l'a vue en premier**.
 *
 * ⚠️ **Le scénario n'est pas théorique, c'est le mode opératoire actuel.** Le
 * cron de GitHub Actions ne part jamais à l'heure, et la rustine est un
 * `gh workflow run` lancé le matin (`CLAUDE.md`). Cette seconde collecte réussit
 * avec zéro offre nouvelle, devient « la dernière collecte réussie », et
 * **remplace le compte rendu des offres de la nuit par cet écran**. Les offres
 * ne sont pas perdues — elles sont dans la carte de passage, qui compte tout ce
 * qui attend hors de l'écran — mais le compte rendu du matin, lui, a disparu.
 *
 * ⚠️ **Ce n'est PAS corrigé ici, et c'est délibéré** : le plan dit « c'est la
 * dernière réussie qui fait foi », et lui préférer « la dernière non vide »
 * empêcherait d'afficher une vraie nuit blanche. La question appartient à
 * Maxime ; en attendant, le texte ne ment pas et la sortie existe.
 */
export function CollecteVide({
  collecteA,
  maintenant,
}: {
  collecteA: string;
  maintenant: Date;
}) {
  return (
    <PanneauMatin
      icone={<Inbox className="size-6" aria-hidden="true" />}
      titre="La collecte n’a rien rapporté"
      collecteA={collecteA}
      maintenant={maintenant}
    >
      <p>
        La dernière collecte s’est bien terminée, mais elle n’a rapporté aucune
        annonce <strong>nouvelle</strong>. Deux explications, et rien ne les
        départage depuis cet écran&nbsp;: France Travail a peu publié cette
        nuit-là, ou bien une collecte précédente avait déjà ramené les mêmes
        annonces — c’est ce qui arrive quand la veille est relancée à la main
        après un cron parti en retard.
      </p>
    </PanneauMatin>
  );
}

/**
 * Des offres sont arrivées et **aucune n'a été notée**.
 *
 * ⚠️ **C'est une PANNE, et c'est le panneau le plus important des six.** Sans
 * lui, l'écran affichait « aucune offre n'atteint le seuil » — c'est-à-dire
 * « journée calme » — un matin où la notation était tombée. La collecte et la
 * notation sont deux étapes du même workflow : la première peut réussir quand
 * la seconde échoue, et le bandeau d'état ne le voit pas puisqu'il ne regarde
 * que l'étape `collecte`.
 *
 * ⚠️ **Le texte envoie au bon endroit.** Un message qui constate sans dire où
 * regarder laisse chercher dans la base un défaut qui est dans le pipeline.
 */
export function PasEncoreNotees({
  combien,
  dejaTentees,
  collecteA,
  maintenant,
}: {
  combien: number;
  /**
   * ⚠️ **Au-delà de zéro, la reprise n'est plus promise** — correctif de revue du
   * 30 août 2026. `pipeline/notation.py` abandonne une offre au bout de trois
   * tentatives : promettre « elles seront reprises à la prochaine notation » sur
   * des offres déjà tentées, c'est répéter la même phrase fausse tous les matins.
   * Le seuil du pipeline n'est pas recopié ici — on distingue seulement « jamais
   * tentée » de « déjà tentée », ce qui suffit à ne rien affirmer de faux.
   */
  dejaTentees: number;
  collecteA: string;
  maintenant: Date;
}) {
  return (
    <PanneauMatin
      icone={<Hourglass className="size-6" aria-hidden="true" />}
      titre={`${combien} ${combien >= 2 ? "offres collectées" : "offre collectée"}, aucune notée`}
      collecteA={collecteA}
      maintenant={maintenant}
    >
      <p>
        {combien >= 2
          ? "Les annonces sont bien en base, mais la notation ne leur a pas encore donné de note d’intérêt"
          : "L’annonce est bien en base, mais la notation ne lui a pas encore donné de note d’intérêt"}
        &nbsp;: rien ne peut donc être classé ce matin. C’est le signe que
        l’étape de notation n’a pas tourné, ou qu’elle a échoué — son journal est
        dans l’exécution GitHub Actions de la nuit.
      </p>
      <p className="mt-3">
        {dejaTentees > 0
          ? `${dejaTentees === combien ? "Toutes" : `${dejaTentees} d’entre elles`} ont déjà été soumises à la notation au moins une fois : passé un certain nombre d’échecs, le pipeline cesse de les reprendre. Le compte exact des tentatives est lisible sur chaque fiche.`
          : combien >= 2
            ? "Les offres ne sont pas perdues : elles n’ont encore jamais été soumises à la notation, et seront reprises au prochain passage."
            : "L’offre n’est pas perdue : elle n’a encore jamais été soumise à la notation, et sera reprise au prochain passage."}{" "}
        Elles restent visibles dans le plan de travail.
      </p>
    </PanneauMatin>
  );
}

/**
 * Tout a été noté, rien n'atteint le seuil — la vraie journée calme (US-27).
 *
 * ⚠️ **`nonNotees` change le message, et ce n'est pas un ornement.** Une
 * notation à moitié tombée laisse un mélange : affirmer « rien d'intéressant »
 * sur un lot dont un tiers n'a pas été jugé serait faux. La phrase s'ajoute au
 * lieu de remplacer, pour que le constat principal reste lisible.
 */
export function SousLeSeuil({
  total,
  nonNotees,
  collecteA,
  maintenant,
}: {
  total: number;
  nonNotees: number;
  collecteA: string;
  maintenant: Date;
}) {
  return (
    <PanneauMatin
      icone={<Moon className="size-6" aria-hidden="true" />}
      titre="Journée calme"
      collecteA={collecteA}
      maintenant={maintenant}
    >
      <p>
        La dernière collecte a rapporté {total}{" "}
        {accorder(total, "offre")}, et aucune n’atteint {SEUIL_INTERET_MATIN}/100
        en intérêt. Rien à lire ce matin, et ce n’est pas une panne&nbsp;: tout
        est en base et reste consultable.
      </p>
      {nonNotees > 0 && (
        <p className="mt-3">
          {nonNotees >= 2
            ? `À nuancer : ${nonNotees} de ces offres n’ont pas encore été notées.`
            : "À nuancer : l’une de ces offres n’a pas encore été notée."}{" "}
          Le verdict ne porte donc pas sur la totalité de la collecte.
        </p>
      )}
    </PanneauMatin>
  );
}

/** Des offres atteignaient le seuil, et elles ont toutes été triées. */
export function ToutTraite({
  auSeuil,
  collecteA,
  maintenant,
}: {
  auSeuil: number;
  collecteA: string;
  maintenant: Date;
}) {
  return (
    <PanneauMatin
      icone={<CheckCheck className="size-6" aria-hidden="true" />}
      titre="Tout est traité"
      collecteA={collecteA}
      maintenant={maintenant}
    >
      {/* ⚠️ **Deux phrases entières plutôt qu'une phrase à trous — défaut VU à
          l'écran le 30 août 2026.** La première version accordait mot par mot
          autour d'un « Les {auSeuil} » figé, et affichait « Les 1 offre retenue
          de cette collecte a été classée ». Au singulier, ce n'est pas
          l'article qui change, c'est la tournure : on ne dit pas « la 1 offre »,
          on dit « la seule ». Une phrase à trous ne sait pas faire ça. */}
      <p>
        {auSeuil >= 2
          ? `Les ${auSeuil} offres retenues de cette collecte ont toutes été classées, en candidature ou écartées.`
          : "La seule offre retenue de cette collecte a été classée, en candidature ou écartée."}{" "}
        Il n’y a plus rien à lire ici jusqu’à la prochaine nuit.
      </p>
    </PanneauMatin>
  );
}

/**
 * La liste est vide et le résumé n'a pas pu être lu.
 *
 * ⚠️ **On dit qu'on ne sait pas, plutôt que de choisir le message le plus
 * probable.** Les cinq autres panneaux affirment quelque chose sur la nuit
 * passée ; celui-ci n'affirme rien, parce que les comptages qui permettraient
 * de trancher ont échoué ou sont tronqués. Servir « journée calme » à la place
 * serait exactement le mensonge que ce fichier existe pour éviter.
 */
export function VideSansDetail({
  collecteA,
  maintenant,
}: {
  collecteA: string;
  maintenant: Date;
}) {
  return (
    <PanneauMatin
      icone={<CircleDashed className="size-6" aria-hidden="true" />}
      titre="Rien à lire ce matin"
      collecteA={collecteA}
      maintenant={maintenant}
    >
      <p>
        Aucune offre de la dernière collecte n’attend d’être lue. Le détail de ce
        qu’elle contenait n’a pas pu être établi&nbsp;: recharger la page suffit
        souvent, et le plan de travail reste accessible en attendant.
      </p>
    </PanneauMatin>
  );
}
