import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { adresseListe } from "@/app/(site)/offres/_composants/adresse";
import { TRIS, estTri } from "@/lib/tri";

/**
 * Ce que ces tests protègent.
 *
 * ⚠️ **`adresseListe` est la seule chose qui empêche les deux contrôles de
 * s'effacer l'un l'autre.** Le défaut qu'elle évite est silencieux : changer de
 * filtre en perdant son classement ne produit aucune erreur, juste un écran qui
 * « oublie » ce qu'on vient de régler. Personne ne le voit en relisant le code,
 * et on ne le remarque à l'usage qu'après l'avoir subi trois fois.
 *
 * ⚠️ **`estTri` est le verrou qui empêche une valeur d'adresse d'atteindre le
 * `&order=` de la requête.** Il n'a pas de logique compliquée — c'est
 * précisément pour ça qu'il faut le figer : quelqu'un qui « simplifierait » en
 * acceptant toute chaîne ne casserait aucun test sans celui-ci.
 */
describe("estTri", () => {
  it("accepte les trois classements connus", () => {
    for (const tri of TRIS) assert.equal(estTri(tri), true);
  });

  it("refuse tout le reste, y compris ce qui y ressemble", () => {
    // ⚠️ Le dernier cas est le vrai danger : un fragment de requête PostgREST
    // glissé dans `?tri=` deviendrait un `&order=` si on ne validait pas.
    for (const valeur of [
      undefined,
      null,
      "",
      "Interet",
      "interêt",
      "note_interet",
      ["interet"],
      "publiee_a.desc,charge_brute",
    ]) {
      assert.equal(estTri(valeur), false, `refusé : ${JSON.stringify(valeur)}`);
    }
  });
});

describe("adresseListe", () => {
  it("n'écrit rien quand tout est au défaut", () => {
    // Deux adresses pour un même écran fabriqueraient deux favoris et deux
    // entrées d'historique.
    assert.equal(adresseListe("a_traiter", "interet"), "/offres");
  });

  it("n'écrit que ce qui s'écarte du défaut", () => {
    assert.equal(adresseListe("candidate", "interet"), "/offres?statut=candidate");
    assert.equal(adresseListe("a_traiter", "recentes"), "/offres?tri=recentes");
  });

  it("garde les deux quand les deux s'écartent, toujours dans le même ordre", () => {
    // ⚠️ L'ordre est ce qui rend l'adresse comparable à elle-même : inversé,
    // le même écran produirait deux chaînes différentes.
    assert.equal(
      adresseListe("ecarte", "accessibilite"),
      "/offres?statut=ecarte&tri=accessibilite",
    );
  });

  it("traite « toutes » et « nouvelles » comme des filtres à part entière", () => {
    assert.equal(adresseListe("toutes", "interet"), "/offres?statut=toutes");
    assert.equal(adresseListe("nouvelles", "interet"), "/offres?statut=nouvelles");
  });
});
