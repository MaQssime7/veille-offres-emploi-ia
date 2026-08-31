import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FILTRES,
  SEUIL_INTERET,
  leSeuilRetireQuelqueChose,
  regimeDuSeuil,
} from "@/lib/filtres";

/**
 * Ce que ces tests protègent.
 *
 * ⚠️ **Le seuil d'intérêt est la seule chose du produit qui CACHE une offre**,
 * et ses erreurs sont silencieuses dans les deux sens. Trop bas, l'écran
 * redevient l'archive de 580 lignes qu'il vient de cesser d'être. Appliqué au
 * mauvais filtre, il annule un geste de Maxime — une offre likée à 30 quitte
 * ses coups de cœur sans le moindre message, puisqu'une offre cachée ne laisse
 * aucune trace. Aucun de ces deux défauts ne lève d'erreur ni ne rougit un job.
 */
describe("le seuil d'intérêt", () => {
  it("vaut 40, et le fige", () => {
    // ⚠️ C'est une décision produit, pas un réglage : la changer doit casser un
    // test, pas passer inaperçu. Elle valait 50 (critère d'acceptation de la
    // phase 5), puis 35 le 30 août 2026 — à 50, l'écran du matin était vide
    // quatre matins sur six — puis 40 le 31 août 2026, quand elle a cessé
    // d'appartenir au seul écran du matin pour valoir aussi sur `/offres`.
    assert.equal(SEUIL_INTERET, 40);
  });

  it("épargne ce que Maxime a lui-même désigné", () => {
    // ⚠️ **Le cœur de la décision du 31 août 2026.** Le seuil filtre ce que le
    // MODÈLE propose ; ces deux listes-là ne contiennent que des offres
    // choisies au clic. Les y soumettre ferait disparaître une offre likée ou
    // déjà candidatée parce qu'un modèle l'a jugée faible — l'inverse de ce que
    // le geste voulait dire.
    assert.equal(regimeDuSeuil("coup_de_coeur"), "aucun");
    assert.equal(regimeDuSeuil("candidate"), "aucun");
  });

  it("s'applique à tout ce que le modèle propose, « Écarté » compris", () => {
    assert.equal(regimeDuSeuil("a_traiter"), "seuil");
    assert.equal(regimeDuSeuil("nouvelles"), "seuil");
    // ⚠️ **« Écarté » est le cas qui se discute**, puisque écarter est aussi un
    // clic. Mais c'est la corbeille : l'exempter ferait de la seule liste qu'on
    // n'ouvre jamais celle qui contient tout le bruit.
    assert.equal(regimeDuSeuil("ecarte"), "seuil");
  });

  it("garde « Toutes » en sur-ensemble des autres onglets", () => {
    // ⚠️ **Le défaut que ce régime répare, relevé en revue le 31 août 2026.**
    // Avec un simple booléen, « Toutes » appliquait le seuil sec : une offre
    // likée sous 40 s'affichait dans « Coup de cœur » puis disparaissait en
    // cliquant « Toutes », et la pilule « Toutes » pouvait afficher moins que la
    // pilule « Candidaté » juste à côté. Un onglet nommé « Toutes » qui montre
    // moins que son voisin est un défaut, pas un arbitrage.
    assert.equal(regimeDuSeuil("toutes"), "visible");
  });

  it("gèle la partition des trois régimes", () => {
    // ⚠️ **Ce test remplace un « chaque filtre répond quelque chose » qui ne
    // pouvait pas échouer** — relevé en revue le 31 août 2026. Le `switch` de
    // `regimeDuSeuil` est exhaustif et sans `default` : un septième filtre non
    // traité est déjà une erreur `tsc`, que `npm run verifie` lève avant même
    // d'arriver ici. Vérifier « la fonction rend un booléen » revenait donc à
    // ré-affirmer ce que le compilateur avait prouvé.
    //
    // Ce qu'aucun type ne protège, en revanche, c'est le **contenu** de la
    // décision : ajouter `default: return "seuil"` pour faire taire le
    // compilateur, ou basculer « Candidaté » du mauvais côté, compile
    // parfaitement. La partition ci-dessous est la décision produit elle-même,
    // et elle est construite depuis `FILTRES` réel — pas depuis une liste
    // recopiée qui périmerait en silence.
    const partition: Record<string, string[]> = {};
    for (const filtre of FILTRES) {
      (partition[regimeDuSeuil(filtre)] ??= []).push(filtre);
    }

    assert.deepEqual(partition, {
      seuil: ["a_traiter", "nouvelles", "ecarte"],
      aucun: ["coup_de_coeur", "candidate"],
      visible: ["toutes"],
    });
  });

  it("distingue « le seuil s'applique » de « le seuil retire quelque chose »", () => {
    // ⚠️ Les deux questions ne se confondent pas : « Toutes » n'est pas en
    // régime `"seuil"`, et pourtant une offre peut y manquer à cause de sa note.
    // C'est cette question-ci que se posent le sous-titre et l'écran vide.
    assert.equal(leSeuilRetireQuelqueChose("toutes"), true);
    assert.equal(leSeuilRetireQuelqueChose("a_traiter"), true);
    assert.equal(leSeuilRetireQuelqueChose("coup_de_coeur"), false);
    assert.equal(leSeuilRetireQuelqueChose("candidate"), false);
  });
});
