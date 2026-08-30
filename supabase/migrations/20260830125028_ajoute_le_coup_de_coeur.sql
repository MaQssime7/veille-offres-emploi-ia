-- Le coup de cœur : le marqueur que Maxime pose sur une offre qui l'accroche.
--
-- Migration **purement additive** : aucune colonne supprimée, aucune donnée
-- réécrite. Les 580 offres déjà en base reçoivent une colonne vide, ce qui est
-- exactement leur état réel — aucune n'a encore été likée.
--
-- ---------------------------------------------------------------------------
-- Pourquoi ce n'est PAS un quatrième statut — décision de Maxime, 30 août 2026
-- ---------------------------------------------------------------------------
--
-- La forme évidente aurait été d'ajouter 'coup_de_coeur' à la contrainte
-- `statut_connu`, à côté de 'a_traiter', 'candidate' et 'ecarte'. Elle a été
-- écartée, et le motif tient en deux conséquences que le statut exclusif
-- produit mécaniquement :
--
--   1. **Une offre likée cesserait d'être « à traiter »**, donc quitterait
--      l'écran du matin (`/` ne montre que `statut = 'a_traiter'`, voir
--      `interface/lib/matin.ts`) et le plan de travail par défaut. C'est
--      l'inverse de ce qu'on attend d'un coup de cœur.
--   2. **Candidater effacerait le cœur.** L'offre passerait à 'candidate' et
--      sortirait de la liste des coups de cœur : cette liste se viderait à
--      mesure que Maxime avance, et la question « où j'en suis sur mes coups
--      de cœur ? » deviendrait sans réponse.
--
-- Le coup de cœur est donc **transverse aux statuts** : une offre peut être
-- « à traiter + coup de cœur », puis « candidaté + coup de cœur ». L'interface
-- a déjà ce cas et sa forme est éprouvée — c'est l'onglet « Nouveau », qui
-- montre les offres de la dernière collecte quel que soit leur statut, et dont
-- le compte ne s'additionne donc pas avec les autres.
--
-- ---------------------------------------------------------------------------
-- Pourquoi UNE date et pas un booléen (+ éventuellement sa date)
-- ---------------------------------------------------------------------------
--
-- ⚠️ **Une seule colonne, `timestamptz`, qui porte les deux informations à la
-- fois** : `NULL` = pas de coup de cœur, une date = coup de cœur posé à cette
-- date. Le couple `boolean` + `timestamptz` aurait été la forme réflexe, et il
-- aurait ouvert un état incohérent qu'aucune contrainte simple ne ferme :
-- `true` sans date. Le projet a déjà payé ce genre d'écart entre une valeur et
-- son horodatage — d'où `statut_touche_est_date`, gravée en phase 4. Ici on
-- n'a pas besoin de la contrainte : la forme rend l'incohérence
-- **inexprimable**, ce qui vaut toujours mieux qu'une règle à faire respecter.
--
-- ⚠️ **`NULL` ≠ `false`, règle 3 du projet, et elle est respectée à la
-- lettre** : `NULL` dit ici sa vérité habituelle, « ça n'est jamais arrivé ».
-- Un `boolean not null default false` aurait affirmé de 580 offres que Maxime
-- les a regardées et n'en a aimé aucune — ce qu'il n'a jamais dit.
--
-- ⚠️ **`timestamptz` et jamais `timestamp`.** Cette date est écrite par Vercel
-- en région Paris et comparée à des collectes écrites par GitHub Actions en
-- UTC. Sans fuseau, un clic de 14 h se relirait « 12 h ».
--
-- ⚠️ **Aucun `default now()`** : il aurait horodaté les 580 lignes existantes à
-- l'instant de cette migration, c'est-à-dire liké toute la base d'un coup.

alter table public.offres
  add column coup_de_coeur_a timestamptz;

-- ---------------------------------------------------------------------------
-- Ce qu'on N'ajoute PAS, et pourquoi
-- ---------------------------------------------------------------------------
--
-- **Aucune contrainte `check`.** Il n'existe pas de valeur fausse à interdire :
-- toute date est un coup de cœur plausible, et `NULL` est l'absence. Une
-- contrainte « pas dans le futur » se retournerait contre nous au premier
-- décalage d'horloge entre Vercel et Supabase, pour un défaut que personne ne
-- subirait. Une contrainte doit interdire ce qui est faux, pas ce qui est
-- improbable.
--
-- **Aucun index**, comme pour `statut` le 29 août 2026 et pour la même raison :
-- la table fait 580 lignes et la seule requête filtrante
-- (`coup_de_coeur_a=not.is.null`) balaye de toute façon un ensemble que
-- Postgres lit plus vite en séquentiel qu'en passant par un index. Un index se
-- pose quand une lenteur est mesurée, pas par précaution.

comment on column public.offres.coup_de_coeur_a is
  'Quand Maxime a posé un coup de cœur sur cette offre. NULL = aucun coup de '
  'cœur — c''est la seule représentation de l''absence, il n''y a pas de '
  'booléen à côté. TRANSVERSE au statut, et jamais une valeur de statut : une '
  'offre peut être candidatée ET coup de cœur. Écrit depuis l''interface '
  'uniquement, jamais par le pipeline. La date sert à classer les coups de '
  'cœur du plus récent au plus ancien.';
