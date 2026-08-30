import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type OffreRegroupable,
  annoncesRepresentees,
  normaliserIntitule,
  regrouperParPoste,
} from "@/lib/regroupement";

/**
 * Ce que ces tests protègent.
 *
 * ⚠️ **Un regroupement trop large FAIT DISPARAÎTRE une offre de l'écran du
 * matin**, et c'est le sens dangereux. Une offre affichée en trop se remarque —
 * c'est même ce qui a déclenché ce module. Une offre fondue à tort dans une
 * autre ne se remarque jamais : elle n'apparaît nulle part, et rien ne la
 * signale. La plupart des cas ci-dessous éprouvent donc ce que le module refuse
 * de regrouper.
 *
 * ⚠️ **Les données viennent des offres réelles du 29 août 2026**, celles que
 * Maxime a vues en quatre exemplaires.
 */

const offre = (
  identifiant: string,
  intitule: string,
  reste: Partial<OffreRegroupable> = {},
): OffreRegroupable => ({
  identifiant,
  intitule,
  entreprise_nom: "MBDA",
  lieu_libelle: "92 - Plessis-Robinson",
  note_interet: 50,
  ...reste,
});

describe("normaliserIntitule", () => {
  it("efface les marques de genre, quelle que soit leur forme", () => {
    const attendu = "coordinateur transformation ia";
    for (const variante of [
      "Coordinateur transformation ia f/h",
      "Coordinateur transformation ia (H/F)",
      "Coordinateur transformation ia f/h (H/F)",
      "COORDINATEUR TRANSFORMATION IA F/H",
      "Coordinateur  transformation   ia",
    ]) {
      assert.equal(normaliserIntitule(variante), attendu, variante);
    }
  });

  it("garde les accents, qui distinguent deux graphies de la source", () => {
    assert.notEqual(
      normaliserIntitule("Ingénieur IA"),
      normaliserIntitule("Ingenieur IA"),
    );
  });

  it("ne mange pas un mot du titre qui ressemble à une marque de genre", () => {
    // « chef » contient un h, « f » isolé n'apparaît pas : rien ne doit sauter.
    assert.equal(normaliserIntitule("Chef de projet IA"), "chef de projet ia");
  });
});

describe("regrouperParPoste", () => {
  it("fond les deux annonces d'un même poste, cas réel du 29 août", () => {
    const groupes = regrouperParPoste([
      offre("6414980", "Coordinateur transformation ia au profit des métiers de l'ingénierie f/h", { note_interet: 68 }),
      offre("6414967", "Coordinateur transformation ia au profit des métiers de l'ingénierie f/h (H/F)", { note_interet: 45 }),
    ]);

    assert.equal(groupes.length, 1);
    assert.equal(groupes[0].annonces, 2);
    // ⚠️ La MIEUX notée est montrée : 68, pas la première arrivée.
    assert.equal(groupes[0].principale.identifiant, "6414980");
    assert.deepEqual(groupes[0].jumelles, ["6414967"]);
  });

  it("laisse deux postes différents séparés", () => {
    const groupes = regrouperParPoste([
      offre("6414980", "Coordinateur transformation ia f/h"),
      offre("6415006", "Coordinateur industrialisation ia produit f/h"),
    ]);

    assert.equal(groupes.length, 2);
    assert.deepEqual(groupes.map((g) => g.annonces), [1, 1]);
  });

  describe("ce qu'il REFUSE de regrouper — le sens qui fait disparaître une offre", () => {
    it("ne fond pas deux villes différentes", () => {
      const groupes = regrouperParPoste([
        offre("A", "Ingénieur IA f/h", { lieu_libelle: "75 - Paris" }),
        offre("B", "Ingénieur IA (H/F)", { lieu_libelle: "92 - Nanterre" }),
      ]);
      assert.equal(groupes.length, 2);
    });

    it("ne fond pas deux employeurs NOMMÉS différents", () => {
      const groupes = regrouperParPoste([
        offre("A", "Ingénieur IA f/h", { entreprise_nom: "MBDA" }),
        offre("B", "Ingénieur IA (H/F)", { entreprise_nom: "Safran" }),
      ]);
      assert.equal(groupes.length, 2);
    });

    it("isole les anonymes quand deux employeurs nommés s'opposent", () => {
      // ⚠️ On ne rattache l'anonyme à personne : rien dans l'annonce ne dit à
      // qui elle appartient, et deviner ferait disparaître une offre.
      const groupes = regrouperParPoste([
        offre("A", "Ingénieur IA f/h", { entreprise_nom: "MBDA" }),
        offre("B", "Ingénieur IA (H/F)", { entreprise_nom: "Safran" }),
        offre("C", "Ingénieur IA", { entreprise_nom: null }),
      ]);

      assert.equal(groupes.length, 3);
      assert.deepEqual(groupes.map((g) => g.annonces), [1, 1, 1]);
    });
  });

  describe("l'employeur SÉPARE, il ne rapproche pas", () => {
    it("fond deux annonces anonymes du même poste — le cas réel du 29 août", () => {
      // ⚠️ **C'est le cas qui a fait retourner la règle, et il a été vu à
      // l'écran.** La première version mettait l'entreprise dans la clé et
      // refusait de regrouper sans employeur nommé. Or les quatre annonces MBDA
      // que Maxime a vues en double affichent toutes « Entreprise non
      // communiquée » : la prudence protégeait d'un risque théorique en ne
      // servant jamais.
      const groupes = regrouperParPoste([
        offre("6414980", "Coordinateur transformation ia f/h", { entreprise_nom: null, note_interet: 68 }),
        offre("6414967", "Coordinateur transformation ia f/h (H/F)", { entreprise_nom: null, note_interet: 45 }),
      ]);

      assert.equal(groupes.length, 1);
      assert.equal(groupes[0].principale.identifiant, "6414980");
    });

    it("fond une annonce nommée avec son anonyme, quand rien ne les oppose", () => {
      const groupes = regrouperParPoste([
        offre("A", "Ingénieur IA f/h", { entreprise_nom: "MBDA" }),
        offre("B", "Ingénieur IA (H/F)", { entreprise_nom: null }),
      ]);

      assert.equal(groupes.length, 1);
      assert.equal(groupes[0].annonces, 2);
    });
  });

  describe("quelle annonce est montrée", () => {
    it("préfère une note à une absence de note", () => {
      // Une offre non notée en tête de groupe cacherait une jumelle notée 68.
      const groupes = regrouperParPoste([
        offre("A", "Ingénieur IA f/h", { note_interet: null }),
        offre("B", "Ingénieur IA (H/F)", { note_interet: 68 }),
      ]);

      assert.equal(groupes[0].principale.identifiant, "B");
      assert.deepEqual(groupes[0].jumelles, ["A"]);
    });

    it("départage deux notes égales par l'identifiant, pour rester stable", () => {
      // ⚠️ Sans départage, la ligne du matin changerait d'identifiant d'un
      // chargement à l'autre selon l'ordre rendu par Postgres.
      const ordreUn = regrouperParPoste([
        offre("6415006", "Coordinateur industrialisation ia produit f/h", { note_interet: 35 }),
        offre("6414974", "Coordinateur industrialisation ia produit f/h (H/F)", { note_interet: 35 }),
      ]);
      const ordreDeux = regrouperParPoste([
        offre("6414974", "Coordinateur industrialisation ia produit f/h (H/F)", { note_interet: 35 }),
        offre("6415006", "Coordinateur industrialisation ia produit f/h", { note_interet: 35 }),
      ]);

      assert.equal(ordreUn[0].principale.identifiant, "6414974");
      assert.equal(ordreDeux[0].principale.identifiant, "6414974");
    });

    it("garde toutes les jumelles quand le poste est publié trois fois", () => {
      const groupes = regrouperParPoste([
        offre("A", "Technicien informatique (H/F)", { note_interet: 3 }),
        offre("B", "Technicien informatique f/h", { note_interet: 3 }),
        offre("C", "Technicien informatique", { note_interet: 3 }),
      ]);

      assert.equal(groupes[0].annonces, 3);
      assert.equal(groupes[0].jumelles.length, 2);
    });
  });

  it("préserve l'ordre du classement SQL, sans le refaire", () => {
    // ⚠️ Retrier ici referait mal, en mémoire, ce que Postgres a déjà fait — et
    // ferait diverger l'ordre de `/` de celui de `/offres`.
    const groupes = regrouperParPoste([
      offre("A", "Poste A f/h", { note_interet: 68 }),
      offre("B", "Poste B f/h", { note_interet: 20 }),
      offre("C", "Poste C f/h", { note_interet: 45 }),
    ]);

    assert.deepEqual(
      groupes.map((g) => g.principale.identifiant),
      ["A", "B", "C"],
    );
  });

  it("rend une liste vide sur une entrée vide", () => {
    assert.deepEqual(regrouperParPoste([]), []);
  });
});

describe("annoncesRepresentees", () => {
  it("compte les jumelles, pas seulement les lignes affichées", () => {
    // ⚠️ C'est ce compte qui sert à la carte de passage : les jumelles ne sont
    // pas à l'écran mais le clic les traite, donc elles ne sont pas « en
    // attente ailleurs ».
    const groupes = regrouperParPoste([
      offre("A", "Poste A f/h"),
      offre("B", "Poste A (H/F)"),
      offre("C", "Poste C f/h"),
    ]);

    assert.equal(groupes.length, 2);
    assert.equal(annoncesRepresentees(groupes), 3);
  });
});
