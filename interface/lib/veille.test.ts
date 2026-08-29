import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type PassageVeille,
  SEUIL_ALERTE_HEURES,
  calculerEtat,
} from "@/lib/veille";

/**
 * Ce que ces tests protègent.
 *
 * ⚠️ **`calculerEtat` décide de ce que l'écran annonce sur la santé du système**,
 * et ses erreurs sont toutes du même genre : elles affichent « tout va bien »
 * alors que quelque chose est cassé. C'est le sens dangereux — un faux négatif
 * ne se remarque jamais, alors qu'une fausse alerte se voit tout de suite.
 *
 * ⚠️ **Le module lit la base, mais cette fonction-là n'y touche pas** : elle
 * reçoit ce que les requêtes ont rendu. C'est cette séparation qui permet
 * d'éprouver les seuils sans base ni réseau. Les deux lectures, elles, ne sont
 * pas testées ici — elles n'ont pas de logique à éprouver.
 */

/** 29 août 2026, 15 h 30 à Paris. */
const MAINTENANT = new Date("2026-08-29T13:30:00Z");

const reussite = (iso: string, nouvelles: number | null = 7): PassageVeille => ({
  demarreeA: iso,
  offresNouvelles: nouvelles,
});

const passage = (issue: string, demarreeA: string) => ({ issue, demarreeA });

describe("calculerEtat — une collecte tuée en plein vol", () => {
  // ⚠️ **Le défaut que ces trois tests ferment.** Une exécution tuée laisse sa
  // ligne en `en_cours`, et `pipeline/stockage.py` ne la referme en `echec` qu'au
  // démarrage suivant, soit la nuit d'après. Sans seuil de temps, l'écran lisait
  // la dernière *réussite* et affichait « à jour » pendant près de 24 heures sur
  // une nuit morte.
  const derniereReussite = reussite("2026-08-28T12:25:00Z");

  it("signale un ratage quand l'exécution traîne en_cours depuis 13 h", () => {
    const etat = calculerEtat(
      derniereReussite,
      passage("en_cours", "2026-08-29T00:23:00Z"),
      MAINTENANT,
    );
    assert.equal(etat.sorte, "echec");
  });

  it("la dit « interrompue » et non « en échec » — il n'y a aucun motif en base", () => {
    const etat = calculerEtat(
      derniereReussite,
      passage("en_cours", "2026-08-29T00:23:00Z"),
      MAINTENANT,
    );
    assert.equal(etat.sorte === "echec" && etat.interrompue, true);
  });

  it("garde la dernière réussite, qui dit depuis quand les données ne bougent plus", () => {
    const etat = calculerEtat(
      derniereReussite,
      passage("en_cours", "2026-08-29T00:23:00Z"),
      MAINTENANT,
    );
    assert.equal(
      etat.sorte === "echec" ? etat.reussite?.demarreeA : null,
      "2026-08-28T12:25:00Z",
    );
  });
});

describe("calculerEtat — mais une collecte qui tourne vraiment n'alerte pas", () => {
  const fraiche = reussite("2026-08-29T09:11:00Z");

  it("laisse tranquille une exécution démarrée il y a 10 minutes", () => {
    const etat = calculerEtat(fraiche, passage("en_cours", "2026-08-29T13:20:00Z"), MAINTENANT);
    assert.equal(etat.sorte, "a_jour");
  });

  it("laisse tranquille à 55 minutes — sous le seuil de 60", () => {
    const etat = calculerEtat(fraiche, passage("en_cours", "2026-08-29T12:35:00Z"), MAINTENANT);
    assert.equal(etat.sorte, "a_jour");
  });

  it("bascule à 65 minutes — le workflow se tue lui-même à 30", () => {
    const etat = calculerEtat(fraiche, passage("en_cours", "2026-08-29T12:25:00Z"), MAINTENANT);
    assert.equal(etat.sorte, "echec");
  });
});

describe("calculerEtat — les cinq états", () => {
  it("à jour quand la dernière réussite est récente", () => {
    const etat = calculerEtat(
      reussite("2026-08-29T09:11:00Z"),
      passage("reussite", "2026-08-29T09:11:00Z"),
      MAINTENANT,
    );
    assert.equal(etat.sorte, "a_jour");
  });

  it(`en retard au-delà de ${SEUIL_ALERTE_HEURES} h`, () => {
    const etat = calculerEtat(
      reussite("2026-08-27T12:55:00Z"),
      passage("reussite", "2026-08-27T12:55:00Z"),
      MAINTENANT,
    );
    assert.equal(etat.sorte, "en_retard");
  });

  it("en échec, sans le marquer interrompu, quand le pipeline a écrit son échec", () => {
    const etat = calculerEtat(
      reussite("2026-08-28T12:25:00Z"),
      passage("echec", "2026-08-29T02:23:00Z"),
      MAINTENANT,
    );
    assert.equal(etat.sorte, "echec");
    assert.equal(etat.sorte === "echec" && etat.interrompue, false);
  });

  it("« jamais » quand aucune collecte n'a jamais réussi", () => {
    assert.equal(calculerEtat(null, null, MAINTENANT).sorte, "jamais");
  });

  it("« inconnu » quand la lecture échoue — distinct de « jamais »", () => {
    // ⚠️ Les confondre annoncerait une panne de collecte un jour où seule la
    // base est injoignable.
    assert.equal(calculerEtat("erreur", null, MAINTENANT).sorte, "inconnu");
  });

  it("« inconnu » dès qu'UNE des deux lectures échoue", () => {
    // Dater le bandeau sur une moitié d'information dirait « à jour » alors
    // qu'un échec est peut-être survenu depuis.
    const etat = calculerEtat(reussite("2026-08-29T09:11:00Z"), "erreur", MAINTENANT);
    assert.equal(etat.sorte, "inconnu");
  });
});

describe("calculerEtat — les cas limites", () => {
  it("ignore un échec ANTÉRIEUR à la dernière réussite", () => {
    // La collecte suivante a rattrapé : il n'y a rien à signaler.
    const etat = calculerEtat(
      reussite("2026-08-29T09:11:00Z"),
      passage("echec", "2026-08-28T02:23:00Z"),
      MAINTENANT,
    );
    assert.equal(etat.sorte, "a_jour");
  });

  it("rend « inconnu » sur une date illisible, jamais « à jour »", () => {
    // ⚠️ `NaN` échoue à toutes les comparaisons : sans garde-fou explicite, une
    // date corrompue tomberait dans la branche la plus rassurante, et la fausse.
    const etat = calculerEtat(
      reussite("pas-une-date"),
      passage("reussite", "pas-une-date"),
      MAINTENANT,
    );
    assert.equal(etat.sorte, "inconnu");
  });

  it("ne prend pas un en_cours à date illisible pour une exécution morte", () => {
    const etat = calculerEtat(
      reussite("2026-08-29T09:11:00Z"),
      passage("en_cours", "n'importe quoi"),
      MAINTENANT,
    );
    assert.equal(etat.sorte, "a_jour");
  });

  it("accepte un échec sans aucune réussite antérieure", () => {
    const etat = calculerEtat(null, passage("echec", "2026-08-29T02:23:00Z"), MAINTENANT);
    assert.equal(etat.sorte === "echec" && etat.reussite, null);
  });

  it("ne confond pas offresNouvelles à null avec zéro", () => {
    const etat = calculerEtat(
      reussite("2026-08-29T09:11:00Z", null),
      passage("reussite", "2026-08-29T09:11:00Z"),
      MAINTENANT,
    );
    assert.equal(etat.sorte === "a_jour" && etat.reussite.offresNouvelles, null);
  });
});
