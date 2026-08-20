-- Schéma initial — phase 1 : la collecte et l'affichage des offres.
--
-- Deux tables seulement. `enrichissements` et `etapes_enrichissement` sont
-- reportées à la phase 6 : leur forme dépend de ce que l'agent produira
-- réellement, et rien ne les alimente d'ici là. Ajouter une table ou une colonne
-- qui tolère le vide est une opération instantanée et sans risque ; écrire du
-- code contre des colonnes mal devinées ne l'est pas.
--
-- Conventions du projet :
--   · pas d'accents dans les noms — Postgres les accepte mais exige alors des
--     guillemets dans chaque requête, et l'oubli d'un seul produit une erreur
--     incompréhensible ;
--   · `timestamptz` partout, jamais `timestamp` — GitHub Actions tourne en UTC
--     et le navigateur est à Paris ; sans fuseau, une collecte de 4 h
--     s'afficherait « 02:00 » en été ;
--   · ce qui se calcule ne se stocke pas (pas de colonne `duree`, pas de date
--     de collecte sur l'offre : le lien vers l'exécution la porte déjà).

-- ---------------------------------------------------------------------------
-- executions_veille — une ligne par passage nocturne
-- ---------------------------------------------------------------------------
--
-- La ligne est écrite AU DÉMARRAGE, puis complétée à la fin. Écrire à la fin
-- imposerait de garder toutes les offres en mémoire (la clé étrangère exige que
-- l'exécution existe avant la première offre) et surtout : un plantage ne
-- laisserait aucune trace, rendant la panne indistinguable d'une nuit calme.
-- Conséquence directe : tout ce qui n'est connu qu'à la fin tolère le vide.

create table public.executions_veille (
  id            bigint generated always as identity primary key,

  demarree_a    timestamptz not null default now(),
  terminee_a    timestamptz,

  issue         text not null default 'en_cours',
  motif_echec   text,

  offres_recues     integer,
  offres_nouvelles  integer,

  constraint issue_connue
    check (issue in ('en_cours', 'reussite', 'echec')),

  -- Une panne muette est impossible à écrire. US-25 gravée dans le moteur
  -- plutôt que confiée à la discipline du développeur.
  constraint echec_toujours_motive
    check (issue <> 'echec' or motif_echec is not null),

  constraint terminee_apres_demarree
    check (terminee_a is null or terminee_a >= demarree_a)
);

comment on table public.executions_veille is
  'Une ligne par passage de la veille. Écrite au démarrage, complétée à la fin. '
  'Une ligne restée en_cours au-delà de quelques heures est une exécution tuée '
  'net : le pipeline les referme en echec à son démarrage suivant.';

comment on column public.executions_veille.issue is
  'en_cours | reussite | echec. Un en_cours ne compte JAMAIS comme une réussite '
  'côté interface : la page d''accueil affiche la dernière exécution reussie.';

-- Retrouver la dernière exécution réussie est la requête la plus fréquente du
-- produit : elle définit la page d'accueil et le marqueur « Nouveau ».
create index executions_veille_derniere_reussite
  on public.executions_veille (demarree_a desc)
  where issue = 'reussite';

-- ---------------------------------------------------------------------------
-- offres — l'annonce telle que France Travail la publie
-- ---------------------------------------------------------------------------
--
-- Clé primaire : l'identifiant France Travail lui-même. Adopter une clé produite
-- par un tiers est un risque assumé, écarté par une décision produit déjà
-- écrite — « toute source d'offres autre que France Travail » est au hors
-- périmètre opposable du PRD. En échange, la déduplication de US-34 est garantie
-- par le moteur (on conflict do nothing) et non par du code qu'on pourrait
-- oublier d'écrire.

create table public.offres (
  identifiant   text primary key
                  -- Cette valeur arrivera un jour depuis la barre d'adresse :
                  -- elle est écrite par l'extérieur, donc jamais de confiance.
                  constraint identifiant_bien_forme
                  check (identifiant ~ '^[0-9A-Z]{7}$'),

  -- Une offre est trouvée par UNE exécution ; une exécution en trouve
  -- PLUSIEURS. La clé étrangère vit toujours du côté « plusieurs ».
  -- on delete restrict : « rien n'est jamais supprimé » (docs/DECISIONS.md § 2)
  -- appliqué par le moteur.
  execution_id  bigint not null
                  references public.executions_veille(id) on delete restrict,

  -- --- L'annonce -----------------------------------------------------------
  intitule                 text not null,
  appellation_libelle      text,
  description              text not null,
  entreprise_nom           text,          -- absent sur 44 % des offres réelles
  lieu_libelle             text,
  type_contrat             text,
  type_contrat_libelle     text,
  nature_contrat           text,
  alternance               boolean not null default false,
  salaire_libelle          text,          -- absent sur 54 % des offres réelles
  url_origine              text,
  publiee_a                timestamptz not null,
  actualisee_a             timestamptz,

  -- --- Signaux structurés --------------------------------------------------
  -- Ce que France Travail donne déjà et que le modèle n'aura pas à déduire.
  experience_code          text,          -- D = débutant accepté, E = exigée, S attendu
  experience_libelle       text,          -- « Débutant accepté », « 2 An(s) »…
  qualification_libelle    text,          -- « Cadre », « Technicien »…
  rome_code                text,
  rome_libelle             text,
  code_naf                 text,          -- carburant de la phase 6 : identifier
  secteur_activite_libelle text,          -- une entreprise que l'annonce ne nomme pas
  tranche_effectif         text,          -- la taille d'entreprise de US-17, gratuite
  langues                  jsonb,         -- [{"libelle":"Anglais","exigence":"E"}]
  formations               jsonb,         -- [{"niveauLibelle":"Bac+5 et plus"}]

  -- Sans valeur par défaut, délibérément : le champ n'arrive que sur 27 % des
  -- offres. NULL = « France Travail n'a rien dit », false = « a dit non ».
  -- Un default false fabriquerait une donnée qui n'existe pas.
  manque_candidats         boolean,

  -- --- Contact : données personnelles, périmètre restreint -----------------
  -- Voir docs/PRD.md § « Données personnelles ». Ces deux champs sont en
  -- colonnes NOMMÉES et jamais dans charge_brute : une colonne se cherche,
  -- s'exclut d'un export et se vide d'une requête ; noyée dans un bloc JSON,
  -- la donnée voyagerait partout où le bloc voyage.
  contact_nom              text,
  contact_url_postulation  text,

  -- --- Archive -------------------------------------------------------------
  -- La réponse complète de l'API, `contact` retiré AVANT écriture.
  -- ⚠️ JAMAIS lue pour afficher quoi que ce soit : c'est une archive, pas une
  -- seconde source de vérité. Elle existe parce que France Travail dépublie ses
  -- offres — un champ non extrait aujourd'hui serait perdu pour toujours.
  charge_brute             jsonb not null
);

comment on table public.offres is
  'Une ligne par offre France Travail, clé = son identifiant. Rien n''est jamais '
  'supprimé : les offres écartées restent, pour régler les seuils sur des '
  'données réelles plutôt que sur une intuition.';

comment on column public.offres.charge_brute is
  'Archive de la réponse API, champ contact retiré. Jamais lue pour afficher.';

-- Postgres indexe automatiquement la clé primaire, mais PAS les clés
-- étrangères. Sans cet index, « les offres de la dernière exécution » parcourt
-- toute la table à chaque chargement de la page d'accueil.
create index offres_par_execution on public.offres (execution_id);
create index offres_par_date      on public.offres (publiee_a desc);

-- ---------------------------------------------------------------------------
-- Autorisation — deux verrous indépendants
-- ---------------------------------------------------------------------------
--
-- 1. RLS activé, AUCUNE politique définie : la base refuse tout accès à qui
--    n'est pas service_role. Le navigateur ne parle jamais à Supabase.
-- 2. Les droits retirés à anon et authenticated : même si une politique était
--    ajoutée par erreur un jour, il n'y aurait toujours aucun droit dessous.
--
-- Un seul verrou suffirait en théorie. Deux font qu'un oubli ne suffit pas à
-- ouvrir une table au monde.

alter table public.executions_veille enable row level security;
alter table public.offres            enable row level security;

revoke all on table public.executions_veille from anon, authenticated;
revoke all on table public.offres            from anon, authenticated;
