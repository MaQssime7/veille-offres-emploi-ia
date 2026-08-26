/**
 * `/offres` — le poste de travail : tout ce que la collecte a ramené.
 *
 * Premier écran du produit qui lit vraiment la base. Quatre états, tous
 * atteignables : base vide, chargement, base injoignable, et la liste.
 *
 * Depuis la phase 2, la liste est classée par **intérêt décroissant** et chaque
 * offre porte ses deux notes avec leur justification. Les statuts et le lien
 * vers la fiche arrivent en phases 3 et 4.
 *
 * ⚠️ Pas de `robots: noindex` déclaré ici : il l'est une fois pour toutes dans
 * le layout du groupe `(site)`, donc pour toute page présente ou future
 * derrière la porte. Le déclarer page par page en ferait une option qu'on
 * oublie — le même raisonnement que le refus d'un `matcher` dans `proxy.ts`.
 */

import type { Metadata } from "next";

import { exigerSession } from "@/lib/acces";
import { listerOffres } from "@/lib/offres";

import { CadrePage, EnTetePage } from "./_composants/en-tete-page";
import { AucuneOffre, BaseInjoignable } from "./_composants/etats";
import { LigneOffre } from "./_composants/ligne-offre";

export const metadata: Metadata = {
  title: "Offres — Veille offres emploi IA",
};

export default async function PageOffres() {
  // ⚠️ Première ligne, sans exception. `proxy.ts` a déjà écarté le visiteur
  // sans cookie ; c'est cette ligne-ci qui protège les offres, au plus près de
  // ce qui les affiche.
  await exigerSession();

  const resultat = await listerOffres();

  // Une seule heure de référence pour toute la page : sinon deux lignes rendues
  // à cheval sur minuit ne dateraient pas du même jour.
  const maintenant = new Date();

  return (
    <CadrePage>
      <EnTetePage>
        {resultat.ok && resultat.offres.length > 0 && (
          <p className="font-mono text-xs text-muted-foreground">
            <CompteAffiche
              affichees={resultat.offres.length}
              total={resultat.total}
              notees={resultat.notees}
            />
          </p>
        )}
      </EnTetePage>

      {!resultat.ok ? (
        <BaseInjoignable
          motif={resultat.motif}
          explication={resultat.explication}
        />
      ) : resultat.offres.length === 0 ? (
        <AucuneOffre />
      ) : (
        <div className="border border-border bg-card">
          {resultat.offres.map((offre) => (
            <LigneOffre
              key={offre.identifiant}
              offre={offre}
              // `derniereExecution` vaut `null` si on n'a pas pu la lire : on
              // marque alors zéro offre plutôt que de marquer au hasard.
              nouvelle={
                resultat.derniereExecution !== null &&
                offre.execution_id === resultat.derniereExecution
              }
              maintenant={maintenant}
            />
          ))}
        </div>
      )}
    </CadrePage>
  );
}

/**
 * La ligne de compte, sous le titre : ce qui existe, ce qui est jugé, ce qui
 * est à l'écran — dans cet ordre.
 *
 * ⚠️ Elle annonce **le nombre de lignes réellement rendues**, jamais la
 * constante du plafond : les deux ne coïncident que tant que la base renvoie
 * exactement 200 offres. Dès que la phase 4 ajoutera un filtre, la page
 * afficherait « 200 offres affichées » en en montrant 150.
 *
 * ⚠️ **Le compte des offres notées n'est pas une statistique décorative, et ce
 * n'est pas non plus le « bandeau de quatre chiffres clés » que le DESIGN.md
 * refuse** — celui-là parle du marché de l'emploi, celui-ci parle de l'état de
 * la liste qu'on est en train de lire. Sans lui, le classement mentirait : la
 * page est triée par intérêt décroissant, donc les offres non notées se posent
 * **sous** la plus mauvaise note. Une offre jamais examinée se lirait alors
 * comme une offre jugée sans intérêt. Au 26 août 2026, c'est le cas de 438
 * offres sur 535.
 *
 * ⚠️ Le libellé ne dit jamais « les plus récentes » : depuis la phase 2 le tri
 * est sur la note, plus sur la date. Une formule laissée en place aurait
 * décrit un classement qui n'existe plus, sans que rien ne le signale.
 */
function CompteAffiche({
  affichees,
  total,
  notees,
}: {
  affichees: number;
  total: number | null;
  notees: number | null;
}) {
  const segments: string[] = [];

  if (total === null) {
    // On ne connaît pas le total : on ne parle que de ce qu'on montre.
    segments.push(`${affichees} ${accorder(affichees, "offre")} ${accorder(affichees, "affichée")}`);
  } else {
    segments.push(`${total} ${accorder(total, "offre")} ${accorder(total, "collectée")}`);
  }

  if (notees !== null) {
    segments.push(
      notees === 0 ? "aucune notée" : `${notees} ${accorder(notees, "notée")}`,
    );
  }

  // Le troisième segment ne s'écrit que si la liste est vraiment tronquée :
  // « 97 offres collectées · 97 affichées » n'apprendrait rien à personne.
  if (total !== null && total > affichees) {
    segments.push(`${affichees} ${accorder(affichees, "affichée")}`);
  }

  return <>{segments.join(" · ")}</>;
}

/**
 * Le pluriel français, qui se déclenche à partir de deux — **zéro reste au
 * singulier** (« 0 offre collectée »), contrairement à l'anglais. Un
 * `nombre > 1 ? "s" : ""` recopié dans chaque interpolation finit toujours par
 * être oublié une fois sur deux dans la même phrase.
 */
function accorder(nombre: number, mot: string): string {
  return nombre >= 2 ? `${mot}s` : mot;
}
