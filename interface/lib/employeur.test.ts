import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type ChampsEmployeur,
  lireEmployeur,
  provenanceEmployeur,
} from "@/lib/employeur";

/**
 * Ce que ces tests protègent.
 *
 * ⚠️ **Le défaut que `lireEmployeur` évite est silencieux et coûteux** : un
 * écran qui montre « NEW NET 3D » alors que l'annonce recrute pour Wavestone
 * envoie Maxime candidater à l'aveugle. Rien ne plante, rien ne s'affiche en
 * rouge — l'écran est simplement faux.
 *
 * ⚠️ **Le second défaut est l'inverse : afficher une déduction comme si elle
 * venait de France Travail.** C'est ce que `annoncePar` et
 * `provenanceEmployeur` empêchent. Un test qui vérifierait seulement « le bon
 * nom sort » laisserait passer une régression où l'écran perd la trace de sa
 * source.
 */

/** Les trois colonnes, avec des valeurs par défaut sans employeur. */
function offre(champs: Partial<ChampsEmployeur> = {}): ChampsEmployeur {
  return {
    entreprise_nom: null,
    entreprise_identifiee: null,
    entreprise_intermediaire: null,
    ...champs,
  };
}

describe("lireEmployeur", () => {
  it("préfère le nom identifié au champ France Travail, et garde la trace du second", () => {
    // Le cas réel qui a motivé tout le module : offre 6426819.
    const resultat = lireEmployeur(
      offre({
        entreprise_nom: "NEW NET 3D",
        entreprise_identifiee: "Wavestone",
        entreprise_intermediaire: true,
      }),
    );
    assert.equal(resultat.nom, "Wavestone");
    assert.equal(resultat.source, "identifie");
    assert.equal(resultat.annoncePar, "NEW NET 3D");
    assert.equal(resultat.parIntermediaire, true);
  });

  it("comble un champ France Travail absent", () => {
    // 39 % des offres — le cas le plus fréquent.
    const resultat = lireEmployeur(offre({ entreprise_identifiee: "Wavestone" }));
    assert.equal(resultat.nom, "Wavestone");
    assert.equal(resultat.source, "identifie");
    assert.equal(resultat.annoncePar, null, "rien à opposer : France Travail se taisait");
  });

  it("ne signale PAS un écart quand les deux noms disent la même chose", () => {
    // ⚠️ Sans la normalisation, la fiche afficherait « France Travail annonce
    // THALES » sous « Thales » — du bruit qui décrédibilise la mention là où
    // elle compte vraiment.
    for (const [annonce, identifie] of [
      ["THALES", "Thales"],
      ["Société Générale", "SOCIETE GENERALE"],
      ["Institut  Curie", "Institut Curie"],
      ["L’Oréal", "L'Oréal"],
    ]) {
      const resultat = lireEmployeur(
        offre({ entreprise_nom: annonce, entreprise_identifiee: identifie }),
      );
      assert.equal(resultat.nom, identifie);
      assert.equal(resultat.annoncePar, null, `${annonce} ≈ ${identifie}`);
    }
  });

  it("garde le nom LONG quand le modèle n'a rendu qu'une forme abrégée", () => {
    // ⚠️ **Mesuré sur le premier rattrapage réel, le 30 août 2026.** France
    // Travail annonçait « IPPON Technologies », l'annonce écrivait « IPPON », et
    // la règle « l'identifié l'emporte » remplaçait un nom complet par son
    // abréviation. Ce n'est pas une correction : c'est le même employeur, écrit
    // moins bien. Aucune provenance à afficher — le modèle a confirmé la
    // source, il ne l'a pas contredite.
    const resultat = lireEmployeur(
      offre({ entreprise_nom: "IPPON Technologies", entreprise_identifiee: "IPPON" }),
    );
    assert.equal(resultat.nom, "IPPON Technologies");
    assert.equal(resultat.source, "france-travail");
    assert.equal(resultat.annoncePar, null);
    assert.equal(provenanceEmployeur(resultat), null);
  });

  it("préfère la forme du modèle quand les deux noms sont équivalents", () => {
    // ⚠️ Le pendant du test précédent : la règle de sous-chaîne ne doit pas
    // mordre sur « THALES » / « Thales », sinon l'écran passerait en capitales
    // sans rien gagner. Elle ne joue que si France Travail en dit STRICTEMENT
    // plus.
    const resultat = lireEmployeur(
      offre({ entreprise_nom: "THALES", entreprise_identifiee: "Thales" }),
    );
    assert.equal(resultat.nom, "Thales");
    assert.equal(resultat.annoncePar, null);
  });

  it("retombe sur France Travail quand le modèle n'a rien identifié", () => {
    // L'état des 434 offres non notées, et de toutes celles d'avant le
    // 30 août 2026 : la colonne est vide, l'écran ne change pas.
    const resultat = lireEmployeur(offre({ entreprise_nom: "MBDA" }));
    assert.equal(resultat.nom, "MBDA");
    assert.equal(resultat.source, "france-travail");
    assert.equal(resultat.annoncePar, null);
  });

  it("dit « inconnu » quand aucune source ne nomme l'employeur", () => {
    assert.deepEqual(lireEmployeur(offre()), {
      nom: null,
      source: "inconnu",
      annoncePar: null,
      parIntermediaire: false,
    });
  });

  it("traite le vide et les blancs comme une absence", () => {
    // France Travail ne garantit rien sur ce champ, et la colonne n'a pas de
    // contrainte de non-vide : `""` doit se comporter comme `null`, sans quoi
    // l'écran afficherait un nom d'entreprise vide au lieu de son italique
    // « Entreprise non communiquée ».
    for (const vide of ["", "   ", "\n\t "]) {
      assert.equal(lireEmployeur(offre({ entreprise_nom: vide })).source, "inconnu");
      assert.equal(
        lireEmployeur(offre({ entreprise_identifiee: vide, entreprise_nom: "MBDA" })).source,
        "france-travail",
        "un identifié vide ne doit pas masquer un champ renseigné",
      );
    }
  });

  it("ne prend `parIntermediaire` que sur un vrai `true`", () => {
    // ⚠️ `NULL` ≠ `false` en base : « pas encore évalué » ne doit pas se lire
    // « ce n'est pas un intermédiaire ». Ici les deux donnent `false` à
    // l'affichage — ce qui est correct, on n'affirme rien — mais la colonne,
    // elle, garde la distinction.
    assert.equal(lireEmployeur(offre({ entreprise_intermediaire: null })).parIntermediaire, false);
    assert.equal(lireEmployeur(offre({ entreprise_intermediaire: false })).parIntermediaire, false);
    assert.equal(lireEmployeur(offre({ entreprise_intermediaire: true })).parIntermediaire, true);
  });
});

describe("provenanceEmployeur", () => {
  it("oppose les deux noms quand ils diffèrent", () => {
    const employeur = lireEmployeur(
      offre({ entreprise_nom: "NEW NET 3D", entreprise_identifiee: "Wavestone" }),
    );
    assert.equal(
      provenanceEmployeur(employeur),
      "Identifié dans l’annonce · France Travail annonce NEW NET 3D",
    );
  });

  it("dit que l'annonce vient d'un intermédiaire quand le modèle l'a vu", () => {
    // ⚠️ **Ce test existe parce que le champ ne servait à RIEN**, relevé en
    // revue le 30 août 2026 : `entreprise_intermediaire` était demandé au
    // modèle, payé, écrit en base, et jamais lu. Le commentaire de la colonne
    // — désormais dans la base, donc non réécrivable — promet qu'il explique à
    // l'écran pourquoi le nom diffère. C'est cette promesse qu'on tient ici.
    const employeur = lireEmployeur(
      offre({
        entreprise_nom: "NEW NET 3D",
        entreprise_identifiee: "Wavestone",
        entreprise_intermediaire: true,
      }),
    );
    assert.equal(
      provenanceEmployeur(employeur),
      "Annonce déposée par un intermédiaire · France Travail annonce NEW NET 3D",
    );
  });

  it("dit d'où vient le nom même quand France Travail se taisait", () => {
    // ⚠️ La mention reste nécessaire ici : c'est elle qui distingue une donnée
    // déduite d'une donnée officielle. La retirer ferait passer une déduction
    // du modèle pour un champ de l'annonce.
    const employeur = lireEmployeur(offre({ entreprise_identifiee: "Wavestone" }));
    assert.equal(provenanceEmployeur(employeur), "Identifié dans l’annonce");
  });

  it("ne dit rien quand il n'y a rien à dire", () => {
    for (const champs of [{ entreprise_nom: "MBDA" }, {}]) {
      assert.equal(provenanceEmployeur(lireEmployeur(offre(champs))), null);
    }
  });
});
