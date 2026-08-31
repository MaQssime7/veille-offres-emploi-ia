-- La corbeille : le marqueur que Maxime pose sur une offre qu'il ne veut plus
-- jamais voir à l'écran.
--
-- Migration **purement additive** : aucune colonne supprimée, aucune donnée
-- réécrite. Les 580 offres déjà en base reçoivent une colonne vide, ce qui est
-- exactement leur état réel — aucune n'a encore été mise à la corbeille.
--
-- ---------------------------------------------------------------------------
-- Ce que « supprimer » veut dire ici, et ce qu'il ne veut PAS dire
-- ---------------------------------------------------------------------------
--
-- ⚠️ **RIEN N'EST EFFACÉ. Le mot « supprimer » désigne un retrait d'AFFICHAGE.**
-- Décision de Maxime, 31 août 2026, énoncée dans ces termes : « supprimer une
-- offre de l'affichage ». La ligne reste en base, avec sa charge brute, ses
-- notes et son éventuel enrichissement — déjà payé.
--
-- Trois raisons qui rendent l'effacement réel indéfendable ici, et elles valent
-- au-delà de ce cas :
--
--   1. **France Travail dépublie.** Une ligne effacée ne se récupère jamais :
--      ni par une recollecte, ni par l'API. C'est le même raisonnement que
--      `TYPE_CONTRAT` dans `pipeline/config.py`, dont le commentaire dit que la
--      perte est *silencieuse*.
--   2. **L'écran de suivi prévu (PRD) compte les exécutions et les volumes.**
--      Effacer des offres trouerait cet historique a posteriori, et un
--      historique ne se reconstitue pas.
--   3. **Une clé étrangère l'interdirait de toute façon** :
--      `enrichissements.offre_identifiant` référence `offres(identifiant)`.
--      Un `delete` sur une offre enrichie échouerait — ce qui est exactement ce
--      qu'on veut, mais mieux vaut ne pas construire un geste qui rate une fois
--      sur six.
--
-- ---------------------------------------------------------------------------
-- Pourquoi ce n'est PAS un quatrième statut — et pourquoi ce n'est pas
-- « Écarté » non plus
-- ---------------------------------------------------------------------------
--
-- **Pas un statut**, exactement pour les raisons gravées dans la migration du
-- coup de cœur, le 30 août 2026 : un statut est *exclusif*. Supprimer une offre
-- candidatée lui ferait perdre son statut « candidaté », donc effacerait la
-- trace d'une candidature réelle. Le marqueur est donc **transverse** : une
-- offre peut être « candidaté + supprimé », et le jour où elle est restaurée,
-- elle est toujours candidatée.
--
-- ⚠️ **Et ce n'est pas un doublon d'« Écarté », qui existait déjà.** Les deux
-- gestes coexistent parce qu'ils ne disent pas la même chose, et Maxime a
-- tranché la distinction le 31 août 2026 :
--
--   | Geste      | Ce qu'il dit                  | Où l'offre reste visible |
--   |------------|-------------------------------|--------------------------|
--   | `ecarte`   | « regardé, pas pour moi »     | onglet « Écarté »        |
--   | `supprime` | « ne me la remontre jamais »  | nulle part               |
--
-- Autrement dit : « Écarté » est une décision de tri, qu'on peut vouloir
-- relire ; la corbeille est un retrait du champ de vision. Confondre les deux
-- aurait fait de l'onglet « Écarté » la seule liste qu'on n'ouvre jamais et qui
-- contient tout.
--
-- ---------------------------------------------------------------------------
-- Pourquoi UNE date, et pas un booléen
-- ---------------------------------------------------------------------------
--
-- ⚠️ **Même forme que `coup_de_coeur_a`, et ce n'est pas de l'imitation.** Une
-- seule colonne `timestamptz` porte les deux informations : `NULL` = pas
-- supprimée, une date = supprimée à cet instant. Le couple `boolean` +
-- `timestamptz` aurait ouvert un état incohérent qu'aucune contrainte simple ne
-- ferme — `true` sans date. La forme rend l'incohérence **inexprimable**, ce
-- qui vaut toujours mieux qu'une règle à faire respecter.
--
-- ⚠️ **`NULL` ≠ `false`, règle 3 du projet.** Un `boolean not null default
-- false` affirmerait de 580 offres que Maxime a décidé de ne pas les
-- supprimer — ce qu'il n'a jamais dit.
--
-- ⚠️ **La date n'est pas décorative : elle rend l'annulation possible.**
-- L'interface affiche « Annuler » quelques secondes après le clic. Sans
-- horodatage, on ne saurait pas distinguer une suppression d'il y a trois
-- secondes d'une suppression d'il y a trois semaines — et une future corbeille
-- consultable, si elle voit le jour, se classera par cette date.
--
-- ⚠️ **`timestamptz` et jamais `timestamp`** : écrite par Vercel en région
-- Paris, relue à côté de collectes écrites par GitHub Actions en UTC.
--
-- ⚠️ **Aucun `default now()`** : il aurait horodaté les 580 lignes existantes à
-- l'instant de cette migration, c'est-à-dire vidé toute la base d'un coup.

alter table public.offres
  add column supprime_a timestamptz;

-- ---------------------------------------------------------------------------
-- Ce qu'on N'ajoute PAS, et pourquoi
-- ---------------------------------------------------------------------------
--
-- **Aucune contrainte `check`.** Il n'existe pas de valeur fausse à interdire :
-- toute date est une suppression plausible, et `NULL` est l'absence. Une
-- contrainte doit interdire ce qui est faux, pas ce qui est improbable.
--
-- **Aucun index**, comme pour `statut` le 29 août 2026 et `coup_de_coeur_a` le
-- 30. La table fait 580 lignes, et `supprime_a is null` sera vrai pour la quasi
-- totalité d'entre elles : un index sur une colonne dont presque toutes les
-- valeurs sont `NULL` n'aiderait pas la requête qui cherche justement ces
-- `NULL`. Un index se pose quand une lenteur est mesurée.

comment on column public.offres.supprime_a is
  'Quand Maxime a retiré cette offre de l''affichage. NULL = visible — c''est '
  'la seule représentation de l''absence, il n''y a pas de booléen à côté. '
  '⚠️ RETRAIT D''AFFICHAGE, PAS EFFACEMENT : la ligne, sa charge brute, ses '
  'notes et son enrichissement restent en base. TRANSVERSE au statut, et '
  'jamais une valeur de statut : une offre peut être candidatée ET supprimée, '
  'et retrouve son statut intact si elle est restaurée. Distinct de '
  'statut = ''ecarte'', qui reste consultable dans son onglet. Écrit depuis '
  'l''interface uniquement, jamais par le pipeline.';
