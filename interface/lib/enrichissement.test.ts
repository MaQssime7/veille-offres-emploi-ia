import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculerConsommation,
  detaillerConsommation,
  calculerEtatEnrichissement,
  COUT_PRESUME_TOKENS,
  ENVELOPPE_QUOTIDIENNE_TOKENS,
  estPerime,
  MOTIF_INTERROMPU,
  PEREMPTION_MINUTES,
  type Enrichissement,
  type LigneConsommation,
} from "@/lib/enrichissement";

/**
 * Ce que ces tests protègent.
 *
 * ⚠️ **Le cas qui compte le plus est celui qu'on ne peut PAS provoquer à la
 * main** : un enrichissement demandé dont le workflow GitHub ne démarre jamais.
 * Il faudrait couper le jeton, cliquer, puis attendre dix minutes devant
 * l'écran. La logique a été sortie en fonction pure exprès pour que ce cas
 * s'éprouve en une milliseconde.
 */

const MINUTE = 60_000;
const REFERENCE = new Date("2026-08-30T18:00:00Z");

function tentative(partiel: Partial<Enrichissement> = {}): Enrichissement {
  return {
    id: 1,
    issue: "demande",
    demandeA: REFERENCE.toISOString(),
    termineA: null,
    motifEchec: null,
    fiche: null,
    ...partiel,
  };
}

describe("calculerEtatEnrichissement", () => {
  it("rend « absent » quand l'offre n'a jamais été enrichie", () => {
    assert.deepEqual(calculerEtatEnrichissement(null, [], REFERENCE), {
      etat: "absent",
    });
  });

  it("rend « en cours » sur une demande fraîche", () => {
    const etat = calculerEtatEnrichissement(tentative(), [], REFERENCE);
    assert.equal(etat.etat, "en_cours");
  });

  it("rend « en cours » à une minute du seuil", () => {
    const juste = new Date(REFERENCE.getTime() + (PEREMPTION_MINUTES - 1) * MINUTE);
    assert.equal(calculerEtatEnrichissement(tentative(), [], juste).etat, "en_cours");
  });

  it("bascule en échec APRÈS le seuil, avec le motif « interrompu »", () => {
    const trop = new Date(REFERENCE.getTime() + (PEREMPTION_MINUTES + 1) * MINUTE);
    const etat = calculerEtatEnrichissement(tentative(), [], trop);
    assert.equal(etat.etat, "echoue");
    assert.equal(etat.etat === "echoue" && etat.motif, MOTIF_INTERROMPU);
  });

  it("périme aussi un « en_cours » — l'agent a démarré puis a été tué", () => {
    const trop = new Date(REFERENCE.getTime() + 30 * MINUTE);
    assert.equal(
      calculerEtatEnrichissement(tentative({ issue: "en_cours" }), [], trop).etat,
      "echoue",
    );
  });

  it("rend « réussi » sans se soucier de l'âge — une tentative conclue ne périme pas", () => {
    const dansUnMois = new Date(REFERENCE.getTime() + 30 * 24 * 60 * MINUTE);
    const etat = calculerEtatEnrichissement(
      tentative({ issue: "reussite", termineA: REFERENCE.toISOString() }),
      [],
      dansUnMois,
    );
    assert.equal(etat.etat, "reussi");
  });

  it("rend l'échec avec SON motif quand la base en porte un", () => {
    const etat = calculerEtatEnrichissement(
      tentative({
        issue: "echec",
        termineA: REFERENCE.toISOString(),
        motifEchec: "Le registre n’a pas répondu.",
      }),
      [],
      REFERENCE,
    );
    assert.equal(etat.etat === "echoue" && etat.motif, "Le registre n’a pas répondu.");
  });

  it("garde les étapes déjà franchies sur un échec — elles disent où ça s'est arrêté", () => {
    const etapes = [
      // ⚠️ `url: null` et non un oubli : « Demande reçue » est écrite par
      // l'interface au clic, avant qu'aucune page n'ait été ouverte.
      { rang: 0, libelle: "Demande reçue", ecriteA: REFERENCE.toISOString(), url: null },
    ];
    const etat = calculerEtatEnrichissement(
      tentative({ issue: "echec", termineA: REFERENCE.toISOString(), motifEchec: "Panne." }),
      etapes,
      REFERENCE,
    );
    assert.equal(etat.etat === "echoue" && etat.etapes.length, 1);
  });
});

describe("estPerime", () => {
  it("ne périme jamais une tentative conclue, même très ancienne", () => {
    const dansUnAn = new Date(REFERENCE.getTime() + 365 * 24 * 60 * MINUTE);
    assert.equal(estPerime(tentative({ issue: "reussite" }), dansUnAn), false);
    assert.equal(estPerime(tentative({ issue: "echec" }), dansUnAn), false);
  });

  it("traite une date illisible comme périmée, jamais comme un travail en cours", () => {
    // Une date que la base ne peut pas produire — mais une comparaison sur NaN
    // est toujours fausse, donc sans ce garde-fou la ligne resterait « en
    // cours » pour l'éternité et bloquerait l'offre définitivement.
    assert.equal(estPerime({ issue: "demande", demandeA: "pas une date" }, REFERENCE), true);
  });
});

describe("calculerConsommation — la seule borne de dépense du système", () => {
  /**
   * ⚠️ **Ces tests existent parce qu'une revue a trouvé un trou béant** le
   * 30 août 2026, dans du code qui « marchait » et que j'avais regardé tourner
   * à l'écran. Le cas qui l'ouvrait est précisément celui qu'on ne reproduit
   * pas à la main : plusieurs enrichissements lancés en vol en même temps, sur
   * des offres différentes.
   */
  const ligne = (partiel: Partial<LigneConsommation> = {}): LigneConsommation => ({
    issue: "reussite",
    demande_a: REFERENCE.toISOString(),
    tokens_entree: null,
    tokens_sortie: null,
    tokens_cache_lu: null,
    tokens_cache_ecrit: null,
    ...partiel,
  });

  it("ne compte rien quand la journée est vide", () => {
    assert.equal(calculerConsommation([], REFERENCE), 0);
  });

  it("additionne les quatre compteurs d'une tentative conclue", () => {
    const total = calculerConsommation(
      [ligne({ tokens_entree: 1000, tokens_sortie: 200, tokens_cache_lu: 5000, tokens_cache_ecrit: 300 })],
      REFERENCE,
    );
    assert.equal(total, 6500);
  });

  it("compte zéro sur une tentative conclue SANS compteurs, jamais NaN", () => {
    // Un échec dont on ne connaît pas la consommation. `undefined + 3` vaut
    // NaN, et un NaN comparé à un plafond est toujours faux : l'enveloppe
    // s'ouvrirait en grand sans le moindre message.
    const total = calculerConsommation([ligne({ issue: "echec" })], REFERENCE);
    assert.equal(total, 0);
    assert.equal(Number.isNaN(total), false);
  });

  it("RÉSERVE le coût présumé d'une tentative en vol, dont les compteurs sont vides", () => {
    assert.equal(
      calculerConsommation([ligne({ issue: "en_cours" })], REFERENCE),
      COUT_PRESUME_TOKENS,
    );
    assert.equal(
      calculerConsommation([ligne({ issue: "demande" })], REFERENCE),
      COUT_PRESUME_TOKENS,
    );
  });

  it("⚠️ ferme l'enveloppe au-delà de deux tentatives simultanées — LE trou trouvé en revue", () => {
    // Dix offres différentes cliquées dans la même minute : l'index unique ne
    // sérialise que PAR OFFRE, donc rien ne les empêchait de partir ensemble.
    // Sans réservation, les dix lisaient « 0 consommé » et passaient la garde.
    const dix = Array.from({ length: 10 }, () => ligne({ issue: "demande" }));
    const total = calculerConsommation(dix, REFERENCE);
    assert.equal(total, 10 * COUT_PRESUME_TOKENS);
    assert.ok(total > ENVELOPPE_QUOTIDIENNE_TOKENS);

    // Et la garde mord dès la troisième : deux réservations tiennent dans
    // l'enveloppe, la troisième la dépasse.
    const deux = calculerConsommation([ligne({ issue: "demande" }), ligne({ issue: "demande" })], REFERENCE);
    assert.equal(deux >= ENVELOPPE_QUOTIDIENNE_TOKENS, true);
  });

  it("ne réserve RIEN pour une tentative en vol périmée", () => {
    // Elle est morte : l'écran l'affiche déjà comme un échec, et la compter
    // fermerait l'enveloppe pour la journée entière sans qu'aucun
    // enrichissement n'ait réellement tourné.
    const trop = new Date(REFERENCE.getTime() + (PEREMPTION_MINUTES + 1) * MINUTE);
    assert.equal(calculerConsommation([ligne({ issue: "demande" })], trop), 0);
  });

  it("mélange réservations et dépenses réelles", () => {
    const total = calculerConsommation(
      [
        ligne({ issue: "reussite", tokens_entree: 12_000, tokens_sortie: 3_000 }),
        ligne({ issue: "en_cours" }),
        ligne({ issue: "echec", tokens_entree: 500 }),
      ],
      REFERENCE,
    );
    assert.equal(total, 12_000 + 3_000 + COUT_PRESUME_TOKENS + 500);
  });

  it("ne réserve pas sur une issue inconnue — le sens le plus prudent", () => {
    // Une cinquième valeur d'issue viendrait d'une migration future. On compte
    // ses compteurs réels plutôt que de réserver au hasard.
    const total = calculerConsommation(
      [ligne({ issue: "peut_etre", tokens_entree: 42 })],
      REFERENCE,
    );
    assert.equal(total, 42);
  });
});


describe("detaillerConsommation — ce que la jauge montre, et pourquoi en deux parts", () => {
  /**
   * ⚠️ **Ces tests gardent une propriété plus importante que chaque cas pris
   * séparément : le total de `detaillerConsommation` est EXACTEMENT celui que
   * la garde compare au plafond.** La jauge et la garde lisent la même règle ;
   * le jour où quelqu'un les séparerait en deux sommes indépendantes, l'écran
   * pourrait afficher 40 % pendant que le bouton refuse de partir.
   */
  const ligne = (partiel: Partial<LigneConsommation> = {}): LigneConsommation => ({
    issue: "reussite",
    demande_a: REFERENCE.toISOString(),
    tokens_entree: null,
    tokens_sortie: null,
    tokens_cache_lu: null,
    tokens_cache_ecrit: null,
    ...partiel,
  });

  it("rend trois zéros sur une journée vide", () => {
    assert.deepEqual(detaillerConsommation([], REFERENCE), {
      reels: 0,
      reserves: 0,
      total: 0,
    });
  });

  it("range une tentative conclue dans « réels », jamais dans « réservés »", () => {
    const detail = detaillerConsommation(
      [ligne({ tokens_entree: 1000, tokens_sortie: 200, tokens_cache_lu: 5000, tokens_cache_ecrit: 300 })],
      REFERENCE,
    );
    assert.deepEqual(detail, { reels: 6500, reserves: 0, total: 6500 });
  });

  it("range un enrichissement EN VOL dans « réservés », jamais dans « réels »", () => {
    // C'est le cœur du problème d'affichage : au clic, rien n'est encore
    // dépensé. Une jauge qui compterait cette réserve en dépense réelle
    // bondirait à 50 % sans qu'un seul token ait été facturé.
    const detail = detaillerConsommation([ligne({ issue: "demande" })], REFERENCE);
    assert.deepEqual(detail, {
      reels: 0,
      reserves: COUT_PRESUME_TOKENS,
      total: COUT_PRESUME_TOKENS,
    });
  });

  it("sépare les deux parts quand la journée mélange conclus et en vol", () => {
    const detail = detaillerConsommation(
      [
        ligne({ tokens_entree: 12_000, tokens_sortie: 3_000 }),
        ligne({ issue: "en_cours" }),
      ],
      REFERENCE,
    );
    assert.deepEqual(detail, {
      reels: 15_000,
      reserves: COUT_PRESUME_TOKENS,
      total: 15_000 + COUT_PRESUME_TOKENS,
    });
  });

  it("ne réserve rien pour un en-vol PÉRIMÉ — il est mort, pas lent", () => {
    const trop = new Date(REFERENCE.getTime() + (PEREMPTION_MINUTES + 1) * 60_000);
    const detail = detaillerConsommation([ligne({ issue: "demande" })], trop);
    assert.deepEqual(detail, { reels: 0, reserves: 0, total: 0 });
  });

  it("rend le MÊME total que calculerConsommation, sur les mêmes lignes", () => {
    // ⚠️ **La propriété qui compte, et la seule qui ne se voit pas à l'écran.**
    // Si ces deux nombres divergeaient, la jauge et la garde raconteraient deux
    // histoires différentes sans qu'aucune erreur ne soit levée.
    const lignes = [
      ligne({ tokens_entree: 8_000, tokens_cache_lu: 40_000 }),
      ligne({ issue: "en_cours" }),
      ligne({ issue: "echec", tokens_sortie: 120 }),
      ligne({ issue: "peut_etre", tokens_entree: 7 }),
    ];
    assert.equal(
      detaillerConsommation(lignes, REFERENCE).total,
      calculerConsommation(lignes, REFERENCE),
    );
  });
});
