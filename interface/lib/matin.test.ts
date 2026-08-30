import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type AffichageMatin,
  type CollecteAffichee,
  type ResumeCollecte,
  SEUIL_INTERET_MATIN,
  choisirAffichage,
} from "@/lib/matin";
import type { OffreEnListe } from "@/lib/offres";
import { type GroupeOffres, regrouperParPoste } from "@/lib/regroupement";

/**
 * Ce que ces tests protègent.
 *
 * ⚠️ **`choisirAffichage` décide de ce que l'écran AFFIRME un matin où il n'a
 * rien à montrer**, et ses erreurs vont toutes dans le même sens : elles
 * annoncent « journée calme » là où quelque chose est cassé. Une journée calme
 * ne se vérifie pas — on la croit, on ferme l'onglet, et on découvre trois
 * jours plus tard que la notation était tombée.
 *
 * ⚠️ **Le cas le plus important est `pas_encore_notees`**, et il est
 * **impossible à provoquer à la main** : il demande une collecte réussie suivie
 * d'une notation en échec, c'est-à-dire un demi-workflow. C'est exactement ce
 * pour quoi la fonction a été séparée des requêtes.
 *
 * ⚠️ **Aucun test de date ici, donc rien qui dépende du fuseau.** Le second
 * passage de `verifie` en UTC ne trouve rien à mordre dans ce fichier — c'est
 * `francais.test.ts` et `veille.test.ts` qui portent cette charge.
 */

const COLLECTE: CollecteAffichee = {
  id: 42,
  demarreeA: "2026-08-30T02:23:00Z",
};

/**
 * Un groupe, réduit à ce que `choisirAffichage` regarde — c'est-à-dire à sa
 * seule présence. Il passe par `regrouperParPoste` plutôt que d'être écrit à la
 * main : un faux objet aurait continué de compiler le jour où la forme du
 * groupe change.
 */
const GROUPE: GroupeOffres<OffreEnListe>[] = regrouperParPoste([
  {
    identifiant: "1234567",
    intitule: "Coordinateur transformation ia f/h",
    entreprise_nom: "MBDA",
    lieu_libelle: "92 - Plessis-Robinson",
    note_interet: 68,
  } as OffreEnListe,
]);

const resume = (partiel: Partial<ResumeCollecte> = {}): ResumeCollecte => ({
  total: 30,
  auSeuil: 4,
  nonNotees: 0,
  dejaTentees: 0,
  complet: true,
  ...partiel,
});

/** Le raccourci qui rend les assertions lisibles : on compare la sorte. */
function sorte(affichage: AffichageMatin): string {
  return affichage.sorte;
}

describe("choisirAffichage", () => {
  it("montre la liste dès qu'une offre est à lire", () => {
    assert.equal(sorte(choisirAffichage(GROUPE, resume(), COLLECTE)), "liste");
  });

  it("montre la liste même si le résumé n'a pas pu être lu", () => {
    // La liste est ce qui compte ; les compteurs ne servent qu'aux écrans vides.
    assert.equal(sorte(choisirAffichage(GROUPE, null, COLLECTE)), "liste");
  });

  it("annonce l'absence de nuit de référence avant tout le reste", () => {
    // ⚠️ Sans collecte, même une liste non vide serait un non-sens : elle ne
    // pourrait pas venir d'une exécution qu'on n'a pas trouvée.
    assert.equal(sorte(choisirAffichage(GROUPE, resume(), null)), "sans_collecte");
  });

  it("distingue une collecte vide d'une collecte sans rien d'intéressant", () => {
    const vide = choisirAffichage([], resume({ total: 0, auSeuil: 0 }), COLLECTE);
    assert.equal(sorte(vide), "collecte_vide");
  });

  describe("la notation tombée", () => {
    it("est annoncée comme telle, et jamais comme une journée calme", () => {
      const affichage = choisirAffichage(
        [],
        resume({ total: 34, auSeuil: 0, nonNotees: 34 }),
        COLLECTE,
      );

      assert.equal(sorte(affichage), "pas_encore_notees");
      assert.deepEqual(affichage, {
        sorte: "pas_encore_notees",
        combien: 34,
        // Jamais tentées : c'est le cas où la reprise peut être promise.
        dejaTentees: 0,
        collecteA: COLLECTE.demarreeA,
      });
    });

    it("passe la main au seuil dès qu'une seule offre a été notée", () => {
      // 33 non notées sur 34 reste une panne, mais on ne peut plus l'affirmer :
      // l'offre notée, elle, n'atteint pas le seuil. L'écran le dit avec son
      // compte de non notées plutôt que de trancher à la place du lecteur.
      const affichage = choisirAffichage(
        [],
        resume({ total: 34, auSeuil: 0, nonNotees: 33 }),
        COLLECTE,
      );

      assert.deepEqual(affichage, {
        sorte: "sous_le_seuil",
        total: 34,
        nonNotees: 33,
        collecteA: COLLECTE.demarreeA,
      });
    });
  });

  it("annonce la journée calme quand tout est noté et rien n'atteint le seuil", () => {
    const affichage = choisirAffichage(
      [],
      resume({ total: 12, auSeuil: 0, nonNotees: 0 }),
      COLLECTE,
    );

    assert.deepEqual(affichage, {
      sorte: "sous_le_seuil",
      total: 12,
      nonNotees: 0,
      collecteA: COLLECTE.demarreeA,
    });
  });

  it("annonce le travail fini quand des offres atteignaient le seuil", () => {
    // Cinq offres au-dessus du seuil, aucune encore « à traiter » : elles ont
    // toutes été candidatées ou écartées.
    const affichage = choisirAffichage(
      [],
      resume({ total: 30, auSeuil: 5, nonNotees: 0 }),
      COLLECTE,
    );

    assert.deepEqual(affichage, {
      sorte: "tout_traite",
      auSeuil: 5,
      collecteA: COLLECTE.demarreeA,
    });
  });

  describe("quand on ne sait pas", () => {
    it("se tait si le résumé n'a pas pu être lu", () => {
      assert.equal(sorte(choisirAffichage([], null, COLLECTE)), "vide_sans_detail");
    });

    it("se tait aussi si le résumé est tronqué", () => {
      // ⚠️ Un résumé incomplet donne des MINORANTS : `auSeuil: 0` ne prouve
      // alors rien, puisque les offres non lues pourraient toutes être à 90.
      const tronque = resume({ total: 2000, auSeuil: 0, nonNotees: 0, complet: false });
      assert.equal(sorte(choisirAffichage([], tronque, COLLECTE)), "vide_sans_detail");
    });
  });

  it("remonte les offres déjà tentées par la notation, pour ne rien promettre à l'aveugle", () => {
    // ⚠️ 34 non notées dont 34 déjà tentées : le pipeline les a peut-être
    // abandonnées. L'écran doit pouvoir le dire au lieu d'annoncer une reprise.
    const affichage = choisirAffichage(
      [],
      resume({ total: 34, auSeuil: 0, nonNotees: 34, dejaTentees: 34 }),
      COLLECTE,
    );

    assert.deepEqual(affichage, {
      sorte: "pas_encore_notees",
      combien: 34,
      dejaTentees: 34,
      collecteA: COLLECTE.demarreeA,
    });
  });

  describe("la date de la collecte", () => {
    it("voyage avec chaque panneau daté", () => {
      // ⚠️ Elle est DANS le résultat et non passée à côté : c'est ce qui rend
      // impossible d'afficher un panneau daté sans sa date.
      const affichage = choisirAffichage([], resume({ auSeuil: 0, nonNotees: 0 }), COLLECTE);
      assert.equal(
        "collecteA" in affichage ? affichage.collecteA : null,
        COLLECTE.demarreeA,
      );
    });

    it("est absente du seul panneau qui n'en a aucune", () => {
      const affichage = choisirAffichage([], null, null);
      assert.deepEqual(affichage, { sorte: "sans_collecte" });
    });
  });

  it("garde le seuil décidé, et le fige", () => {
    // ⚠️ Le seuil est une décision produit, pas un réglage : le changer doit
    // casser un test, pas passer inaperçu. Il valait 50 (critère d'acceptation
    // de la phase 5) jusqu'au 30 août 2026, où Maxime l'a abaissé à 35 sur
    // mesure — à 50, l'écran du matin était vide quatre matins sur six.
    assert.equal(SEUIL_INTERET_MATIN, 35);
  });
});
