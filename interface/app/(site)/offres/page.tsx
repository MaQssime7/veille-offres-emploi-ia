/**
 * `/offres` — le poste de travail : tout ce que la collecte a ramené.
 *
 * Premier écran du produit qui lit vraiment la base. Quatre états, tous
 * atteignables : base vide, chargement, base injoignable, et la liste.
 *
 * Les notes, les statuts et le lien vers la fiche n'existent pas encore — ils
 * arrivent en phases 2, 3 et 4. Ce qui est ici est ce que la collecte fournit.
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
 * La ligne de compte, sous le titre.
 *
 * ⚠️ Elle annonce **le nombre de lignes réellement rendues**, jamais la
 * constante du plafond : les deux ne coïncident que tant que la base renvoie
 * exactement 200 offres. Dès que la phase 4 ajoutera un filtre, la page
 * afficherait « 200 offres les plus récentes » en en montrant 150.
 */
function CompteAffiche({
  affichees,
  total,
}: {
  affichees: number;
  total: number | null;
}) {
  if (total === null) {
    // On ne connaît pas le total : on ne parle que de ce qu'on montre.
    return <>{affichees} offres affichées</>;
  }

  if (total > affichees) {
    return (
      <>
        {affichees} offres les plus récentes, sur {total} collectées
      </>
    );
  }

  const pluriel = total > 1 ? "s" : "";
  return (
    <>
      {total} offre{pluriel} collectée{pluriel}
    </>
  );
}
