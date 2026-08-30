import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  LIBELLE_COUP_DE_COEUR,
  LIBELLE_RETIRER_COUP_DE_COEUR,
  aCoupDeCoeur,
} from "@/lib/coup-de-coeur";
import { FILTRES, LIBELLES_FILTRE } from "@/lib/filtres";
import { STATUTS } from "@/lib/statuts";

/**
 * `aCoupDeCoeur` est une fonction pure, et c'est la SEULE lecture de la colonne
 * `coup_de_coeur_a` dans tout le projet. Ce qu'on éprouve ici n'est pas sa
 * logique — elle tient en une ligne — mais les valeurs qu'elle peut vraiment
 * recevoir : ce qui sort de PostgREST, et ce qu'un développement distrait
 * pourrait lui passer.
 */
describe("aCoupDeCoeur", () => {
  it("reconnaît une date telle que la base la rend", () => {
    // Le format réel, relevé le 30 août 2026 sur l'offre cobaye de la migration.
    assert.equal(aCoupDeCoeur("2026-08-30T12:34:56+00:00"), true);
    assert.equal(aCoupDeCoeur("2026-08-30T12:34:56.000Z"), true);
  });

  it("rend false sur NULL, qui est le cas de 580 offres sur 580", () => {
    assert.equal(aCoupDeCoeur(null), false);
  });

  it("rend false sur undefined — une colonne absente du SELECT", () => {
    // ⚠️ Le cas qui compte vraiment : oublier `coup_de_coeur_a` dans
    // `COLONNES_LISTE` ne lèverait aucune erreur. La fonction doit alors dire
    // « pas de coup de cœur » plutôt que de laisser passer un `undefined`
    // truthy plus loin dans le rendu.
    assert.equal(aCoupDeCoeur(undefined), false);
  });

  it("rend false sur la chaîne vide, que la base ne produit jamais", () => {
    // La colonne est un `timestamptz` : elle ne peut pas contenir `""`. On le
    // vérifie quand même, parce que c'est exactement ce qu'un
    // `String(valeur ?? "")` posé en amont fabriquerait — et un `!!""` vaut
    // `false` par chance, pas par intention.
    assert.equal(aCoupDeCoeur(""), false);
  });
});

/**
 * ⚠️ **Le coup de cœur N'EST PAS un statut, et ce test est là pour que ça le
 * reste.** C'est la décision structurante du 30 août 2026 : le jour où
 * quelqu'un ajouterait `"coup_de_coeur"` à `STATUTS` pour « simplifier », une
 * offre likée cesserait d'être « à traiter » — elle quitterait l'écran du matin,
 * et candidater effacerait son cœur. Rien dans le code ne signalerait la
 * régression ; ce test, si.
 */
describe("le coup de cœur reste hors des statuts", () => {
  it("n'apparaît pas dans STATUTS", () => {
    assert.equal((STATUTS as readonly string[]).includes("coup_de_coeur"), false);
  });

  it("est bien un filtre, en revanche", () => {
    assert.equal((FILTRES as readonly string[]).includes("coup_de_coeur"), true);
  });

  it("porte le même libellé partout — pilule de filtre et bouton", () => {
    // Deux copies du même mot finiraient par diverger, et l'écran nommerait
    // « Coup de cœur » ce que le bouton appellerait autrement.
    assert.equal(LIBELLES_FILTRE.coup_de_coeur, LIBELLE_COUP_DE_COEUR);
  });

  it("distingue son NOM de son ACTION", () => {
    // ⚠️ Le nom accessible du bouton ne bouge pas (WCAG 2.5.3) ; c'est
    // l'infobulle qui dit ce qu'un clic fera. Les deux ne doivent donc pas
    // être la même chaîne.
    assert.notEqual(LIBELLE_COUP_DE_COEUR, LIBELLE_RETIRER_COUP_DE_COEUR);
  });
});
