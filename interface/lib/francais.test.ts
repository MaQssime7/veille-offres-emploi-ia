import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  accorder,
  daterPassage,
  debutDuJourParisien,
  duree,
} from "@/lib/francais";

/**
 * Ce que ces tests protègent.
 *
 * ⚠️ **Ils existent à cause d'un bug que la machine de développement ne pouvait
 * pas montrer.** Le Mac sur lequel ce projet est écrit est à l'heure de Paris ;
 * Vercel tourne en UTC. Un calcul de date faux dans le second cas passait
 * parfaitement dans le premier. **Le script `npm run verifie` les lance donc
 * deux fois, dont une avec `TZ=UTC`** — c'est la seconde qui compte.
 *
 * ⚠️ **On teste des fonctions PURES, et c'est ce qui rend l'exercice possible.**
 * Aucune base, aucun réseau, aucun navigateur : la logique a été séparée de la
 * lecture exprès pour ça. Si `daterPassage` allait chercher l'heure elle-même au
 * lieu de la recevoir, aucun de ces cas ne serait éprouvable.
 */

describe("accorder — le pluriel français", () => {
  it("laisse zéro au singulier, contrairement à l'anglais", () => {
    assert.equal(`0 ${accorder(0, "offre")}`, "0 offre");
  });

  it("laisse un au singulier", () => {
    assert.equal(`1 ${accorder(1, "offre")}`, "1 offre");
  });

  it("accorde à partir de deux", () => {
    assert.equal(`2 ${accorder(2, "offre")}`, "2 offres");
  });
});

describe("duree — une durée nue, accordée", () => {
  it("accorde l'heure au singulier", () => {
    assert.equal(duree(1.9), "1 heure");
  });

  it("accorde les heures au pluriel", () => {
    assert.equal(duree(40), "40 heures");
  });

  it("arrondit à l'unité INFÉRIEURE — 47 h ne font pas encore 2 jours", () => {
    assert.equal(duree(47), "47 heures");
  });

  it("bascule aux jours à 48 h, pas à 24", () => {
    assert.equal(duree(48), "2 jours");
    assert.equal(duree(122.6), "5 jours");
  });

  it("ne dit jamais « il y a » : c'est l'appelant qui fait la phrase", () => {
    // ⚠️ Ce test protège d'un couplage par chaîne de caractères. Une première
    // version rendait « il y a 3 jours » et l'appelant retirait le préfixe par
    // `replace("il y a ", "")` ; reformuler ici aurait affiché « Aucune veille
    // depuis il y a 3 jours », sans la moindre erreur pour le signaler.
    assert.ok(!duree(72).includes("il y a"));
    assert.ok(!duree(40).includes("depuis"));
  });
});

describe("daterPassage — l'heure de Paris, toujours", () => {
  // 29 août 2026, 15 h 30 à Paris (UTC+2 en été).
  const reference = new Date("2026-08-29T13:30:00Z");

  it("convertit en heure de Paris, pas en heure du serveur", () => {
    // 09:11 UTC = 11:11 à Paris. Sur un serveur en UTC, sans le forçage de
    // fuseau, ce test rendrait « 09:11 ».
    assert.equal(daterPassage("2026-08-29T09:11:26Z", reference), "Aujourd'hui, 11:11");
  });

  it("dit « Hier » pour la veille", () => {
    assert.equal(daterPassage("2026-08-28T12:25:00Z", reference), "Hier, 14:25");
  });

  it("nomme le jour au-delà de la veille", () => {
    assert.equal(daterPassage("2026-08-27T12:55:00Z", reference), "Jeudi 27 août, 14:55");
  });

  it("rend « date inconnue » plutôt qu'un NaN affichable", () => {
    assert.equal(daterPassage("pas-une-date", reference), "date inconnue");
  });

  it("compare des jours CIVILS, pas des écarts de 24 heures", () => {
    // 30 août 00 h 10 à Paris. Une collecte de 23 h 50 la veille au soir date de
    // vingt minutes — et appartient pourtant à hier.
    const justeApresMinuit = new Date("2026-08-29T22:10:00Z");
    assert.equal(
      daterPassage("2026-08-29T21:50:00Z", justeApresMinuit),
      "Hier, 23:50",
    );
  });

  it("ne confond pas avant-hier avec hier", () => {
    const justeApresMinuit = new Date("2026-08-29T22:10:00Z");
    assert.equal(
      daterPassage("2026-08-28T21:50:00Z", justeApresMinuit),
      "Vendredi 28 août, 23:50",
    );
  });

  it("tient la nuit du passage à l'heure d'ÉTÉ, où la journée fait 23 h", () => {
    // ⚠️ **Le cas qui a motivé un correctif.** Le 30 mars 2026 à 00 h 30 à Paris
    // (UTC+2), l'ancien calcul retranchait un jour dans le fuseau du serveur
    // puis comparait des jours parisiens : il atterrissait sur le 28 mars, et
    // une collecte du 29 s'affichait « Dimanche 29 mars » au lieu de « Hier ».
    // ⚠️ Invisible sur une machine à l'heure de Paris — d'où le passage `TZ=UTC`.
    assert.equal(
      daterPassage("2026-03-29T12:00:00Z", new Date("2026-03-29T22:30:00Z")),
      "Hier, 14:00",
    );
  });

  it("tient la nuit du passage à l'heure d'HIVER, où la journée fait 25 h", () => {
    assert.equal(
      daterPassage("2026-10-25T12:00:00Z", new Date("2026-10-25T23:30:00Z")),
      "Hier, 13:00",
    );
  });
});

describe("debutDuJourParisien", () => {
  /**
   * ⚠️ Ces cas sont écrits en UTC de bout en bout, et c'est délibéré : c'est le
   * fuseau de Vercel, donc celui où le calcul doit être juste. Sur le Mac de
   * développement, à l'heure de Paris, une implémentation fausse passerait.
   */
  it("rend minuit à Paris, pas minuit UTC, en heure d'été (UTC+2)", () => {
    assert.equal(
      debutDuJourParisien(new Date("2026-08-30T18:09:00Z")).toISOString(),
      "2026-08-29T22:00:00.000Z",
    );
  });

  it("rend minuit à Paris en heure d'hiver (UTC+1)", () => {
    assert.equal(
      debutDuJourParisien(new Date("2026-01-15T09:00:00Z")).toISOString(),
      "2026-01-14T23:00:00.000Z",
    );
  });

  it("place dans la BONNE journée un instant qui a déjà changé de jour à Paris", () => {
    // 22:30 UTC en août = 00:30 le lendemain à Paris. L'enveloppe de tokens
    // doit déjà être repartie de zéro, sinon les clics de la nuit sont imputés
    // à la journée de la veille.
    assert.equal(
      debutDuJourParisien(new Date("2026-08-30T22:30:00Z")).toISOString(),
      "2026-08-30T22:00:00.000Z",
    );
  });

  it("tient la nuit du passage à l'heure d'ÉTÉ, où la journée fait 23 h", () => {
    assert.equal(
      debutDuJourParisien(new Date("2026-03-29T10:00:00Z")).toISOString(),
      "2026-03-28T23:00:00.000Z",
    );
  });

  it("tient la nuit du passage à l'heure d'HIVER, où la journée fait 25 h", () => {
    assert.equal(
      debutDuJourParisien(new Date("2026-10-25T10:00:00Z")).toISOString(),
      "2026-10-24T22:00:00.000Z",
    );
  });
});
