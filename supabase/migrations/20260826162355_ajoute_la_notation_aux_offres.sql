-- Phase 2 — la notation : deux notes, deux justifications, un résumé court, un
-- salaire annualisé, et la trace de ce que tout cela a consommé.
--
-- Migration **purement additive** : aucune colonne supprimée, aucune donnée
-- réécrite. Les 373 offres déjà en base restent intactes et simplement non
-- notées — la notation est incrémentale, une offre notée n'est jamais renotée.

-- ---------------------------------------------------------------------------
-- executions_veille — distinguer la collecte de la notation
-- ---------------------------------------------------------------------------
--
-- ⚠️ `etape` n'est pas du rangement, c'est un correctif de bug. La fenêtre de
-- collecte est bornée par `derniere_execution_reussie()`, qui prend la dernière
-- ligne `issue = 'reussite'` sans autre filtre. Si la notation écrivait ses
-- lignes ici sans se distinguer, une notation réussie à 14 h ferait croire à la
-- collecte de la nuit suivante qu'elle n'a que dix heures à rattraper : les
-- offres publiées avant seraient perdues, **sans la moindre erreur**. La requête
-- de fenêtre filtre désormais sur `etape = 'collecte'`.
--
-- Le défaut `'collecte'` classe correctement les 10 exécutions déjà en base :
-- ce sont toutes des collectes.

alter table public.executions_veille
  add column etape                 text not null default 'collecte',
  add column offres_notees         integer,
  add column modele                text,
  add column tokens_entree         integer,
  add column tokens_sortie         integer,
  add column tokens_cache_ecriture integer,
  add column tokens_cache_lecture  integer;

alter table public.executions_veille
  add constraint etape_connue
    check (etape in ('collecte', 'notation'));

comment on column public.executions_veille.etape is
  'collecte | notation. Filtre indispensable : derniere_execution_reussie() ne '
  'regarde que les collectes, sinon une notation décalerait la fenêtre de '
  'collecte et ferait rater des offres en silence.';

comment on column public.executions_veille.modele is
  'Identifiant exact du modèle qui a noté (claude-sonnet-5, claude-opus-5…). '
  'Sans lui, impossible de comparer deux étalonnages a posteriori.';

comment on column public.executions_veille.tokens_entree is
  'Compteurs BRUTS, jamais des euros — les tarifs changent, les tokens non. '
  'La conversion en coût se fait à l''affichage, contre une grille versionnée.';

-- ---------------------------------------------------------------------------
-- offres — la notation
-- ---------------------------------------------------------------------------
--
-- Les champs de la fiche sont **séparés**, jamais un bloc de texte rédigé : la
-- conversation prévue en évolution doit pouvoir challenger une note précise, et
-- deux barres à l'écran ont besoin de deux entiers, pas d'un paragraphe.

alter table public.offres
  add column note_interet                smallint,
  add column justification_interet       text,
  add column note_accessibilite          smallint,
  add column justification_accessibilite text,
  add column resume                      text,

  -- Salaire ramené à l'année quand c'est possible. `salaire_libelle` reste la
  -- valeur d'origine et n'est jamais écrasé : l'annualisation est une lecture,
  -- pas une correction de la source.
  add column salaire_annuel_min integer,
  add column salaire_annuel_max integer,

  add column notee_a               timestamptz,
  add column notation_execution_id bigint references public.executions_veille(id),
  add column notation_modele       text,
  add column notation_motif_echec  text,
  add column notation_tentatives   integer not null default 0,

  add column tokens_cumules      integer not null default 0,
  add column tokens_conversation integer not null default 0;

alter table public.offres
  add constraint note_interet_sur_cent
    check (note_interet is null or note_interet between 0 and 100),
  add constraint note_accessibilite_sur_cent
    check (note_accessibilite is null or note_accessibilite between 0 and 100),

  -- Les deux notes vont ensemble. Une offre à moitié notée n'existe pas : elle
  -- afficherait une barre pleine et une barre vide, illisible.
  add constraint notes_indissociables
    check ((note_interet is null) = (note_accessibilite is null)),

  -- Une note sans sa justification tient sur la seule couleur à l'écran, ce que
  -- le plancher d'accessibilité du projet interdit. La contrainte rend le cas
  -- impossible à écrire plutôt que de le confier à la discipline du code.
  add constraint interet_justifie
    check ((note_interet is null) = (justification_interet is null)),
  add constraint accessibilite_justifiee
    check ((note_accessibilite is null) = (justification_accessibilite is null)),

  -- Une notation qui échoue laisse l'offre SANS note, avec son motif. L'offre
  -- n'est pas perdue : elle repasse au tour suivant.
  add constraint echec_sans_note
    check (notation_motif_echec is null or note_interet is null),

  add constraint salaire_annuel_ordonne
    check (salaire_annuel_min is null or salaire_annuel_max is null
           or salaire_annuel_max >= salaire_annuel_min),

  -- Un salaire annuel négatif ou nul est absurde. Le seuil de *plausibilité*
  -- (les mensuels à 45 000 € qui sont en fait des annuels) vit dans
  -- `pipeline/salaire.py` et nulle part ailleurs : deux seuils dans deux
  -- endroits finissent toujours par diverger.
  add constraint salaire_annuel_positif
    check ((salaire_annuel_min is null or salaire_annuel_min > 0)
           and (salaire_annuel_max is null or salaire_annuel_max > 0)),

  add constraint tokens_jamais_negatifs
    check (tokens_cumules >= 0 and tokens_conversation >= 0),
  add constraint tentatives_jamais_negatives
    check (notation_tentatives >= 0);

comment on column public.offres.note_interet is
  'Note de 0 à 100. NULL = pas encore notée (ce n''est pas un zéro). '
  'Les offres non notées ne descendent donc pas en bas d''un tri par intérêt : '
  'elles se filtrent explicitement.';

comment on column public.offres.notation_tentatives is
  'Nombre d''appels au modèle tentés sur cette offre. Garde-fou de facturation : '
  'sans compteur, une offre qui fait systématiquement échouer l''appel serait '
  'retentée chaque nuit, indéfiniment et à chaque fois payante.';

comment on column public.offres.notation_execution_id is
  'L''exécution de notation qui a produit ces notes. Même raison que pour la '
  'collecte : une simple date ne suffit pas — deux notations le même jour, ou '
  'une notation qui plante à mi-course, et le compte de l''écran de suivi est faux.';

comment on column public.offres.salaire_annuel_min is
  'Salaire ramené à l''année, ou NULL quand la source est absente, non chiffrée '
  '(« Selon profil ») ou invraisemblable. NULL veut dire « pas de valeur de '
  'travail », jamais « zéro euro ».';

comment on column public.offres.tokens_conversation is
  'Compteur séparé de tokens_cumules, et c''est délibéré : la conversation '
  'prévue en évolution aura sa propre borne. Avec un compteur unique, un '
  'enrichissement coûteux mangerait l''enveloppe de discussion avant le premier '
  'message.';
