-- L'enrichissement à la demande — les trois tables de la phase 6.
--
-- Reportées depuis le schéma initial du 20 août 2026, qui écrivait : « leur
-- forme dépend de ce que l'agent produira réellement, et rien ne les alimente
-- d'ici là ». Le report a payé : la forme ci-dessous ne ressemble pas à celle
-- qu'on aurait devinée en août.
--
-- ---------------------------------------------------------------------------
-- Ce que la mesure du 30 août 2026 a changé
-- ---------------------------------------------------------------------------
--
-- Le registre public des entreprises (recherche-entreprises.api.gouv.fr) a été
-- interrogé sur cinq sociétés réelles avant d'écrire une ligne de SQL. Trois
-- constats commandent la forme des tables :
--
--   1. **Le registre ne rend qu'UN exercice comptable, et c'est le dernier
--      DÉPOSÉ, pas le dernier écoulé.** Capgemini 2024, Wavestone 2023,
--      Dataiku 2018, OCTO 2016, Mirakl rien du tout. Un chiffre d'affaires
--      sans son année est donc un mensonge, pas une imprécision — d'où
--      `chiffre_affaires_toujours_date`, qui rend le couple inséparable.
--      Même raisonnement sur la tranche d'effectif, millésimée elle aussi.
--
--   2. **La moitié de la fiche ne vient PAS du registre.** Le site officiel,
--      l'appartenance à un groupe, le modèle économique (éditeur, ESN, cabinet,
--      laboratoire) n'y figurent pas : le code NAF range Capgemini, Sopra
--      Steria et OCTO dans la même case `62.02A`. Ces rubriques sont DÉDUITES
--      par l'agent en lisant le site de l'entreprise. Une fiche qui ne
--      distinguerait pas les deux origines serait fausse d'apparence
--      rigoureuse — le risque nommé au PRD.
--
--   3. **Le rapprochement par nom est un pari.** « Orion » rend 4 382
--      entreprises. D'où `appariement`, qui porte le degré de certitude du
--      rapprochement, et son motif quand il y a doute (US-31).
--
-- ---------------------------------------------------------------------------
-- Pourquoi DEUX formes de stockage, et pas une
-- ---------------------------------------------------------------------------
--
-- ⚠️ Les données de la fiche sont de deux natures, et les mélanger aurait coûté
-- quelque chose dans les deux sens :
--
--   · **L'ancrage** — SIREN, date de création, tranche d'effectif, chiffre
--     d'affaires — est en COLONNES TYPÉES sur `enrichissements`. Une date de
--     création est une `date`, un chiffre d'affaires est un `bigint` : le
--     moteur peut alors refuser une année à cinq chiffres ou un CA négatif.
--     Rangées dans une table de rubriques, ces valeurs seraient devenues du
--     texte et « bonjour » aurait valu « 1990-04-01 ».
--
--   · **Les rubriques rédigées** — groupe, modèle économique, effectif annoncé
--     — vivent dans `rubriques_enrichissement`, une ligne par rubrique avec
--     SON marqueur et son rang d'affichage. Elles n'ont pas de type utile (ce
--     sont des paragraphes), leur nombre grandira en phase 7, et chacune peut
--     être vérifiée ou déduite indépendamment des autres.
--
-- ⚠️ **L'absence de ligne veut dire « non disponible ».** On n'écrit JAMAIS la
-- chaîne « non disponible » en base : ce serait confondre une information
-- manquante avec une information dont le contenu est « non disponible », et
-- rendre impossible de compter ce que l'agent trouve vraiment. C'est
-- l'affichage qui rend l'absence en toutes lettres.
--
-- ---------------------------------------------------------------------------
-- La garde contre le double clic est un INDEX, pas du code — US-35
-- ---------------------------------------------------------------------------
--
-- ⚠️ `enrichissements_un_seul_en_vol` interdit physiquement deux lignes
-- `demande` ou `en_cours` sur la même offre. Deux requêtes envoyées à la même
-- milliseconde : la seconde est refusée par Postgres AVANT d'atteindre la
-- moindre ligne de TypeScript, et le workflow GitHub n'est jamais lancé. Une
-- vérification en code (« lire, puis écrire si rien ») laisse au contraire une
-- fenêtre entre la lecture et l'écriture — c'est le bug classique, et il coûte
-- ici une facture, pas un doublon d'affichage.
--
-- L'index est PARTIEL (`where issue in (...)`) : une fois l'enrichissement
-- conclu, la ligne sort de l'index et une relance redevient possible. La règle
-- exprimée est donc exactement « au plus un enrichissement EN VOL par offre »,
-- et pas « un seul enrichissement par offre », qui interdirait de relancer.
--
-- ---------------------------------------------------------------------------
-- Une relance crée une LIGNE DE PLUS, elle n'écrase jamais
-- ---------------------------------------------------------------------------
--
-- Le plan dit « la relance remplace la fiche précédente » : c'est vrai à
-- l'écran, où l'on affiche le dernier enrichissement conclu. En base, écraser
-- détruirait la trace de la tentative ratée — alors qu'US-23 interdit de
-- supprimer et qu'US-37 réclame l'historique pour l'écran de suivi. On affiche
-- le dernier, on garde tout.
--
-- ---------------------------------------------------------------------------
-- Ce qu'on ne stocke PAS
-- ---------------------------------------------------------------------------
--
--   · **Aucun compteur « tokens consommés aujourd'hui ».** L'enveloppe
--     quotidienne se calcule en SOMMANT les lignes du jour. Un compteur séparé
--     divergerait à la première écriture ratée, et plus rien ne le
--     rattraperait ; une somme, elle, ne peut pas mentir sur ce qui est écrit.
--     Règle 2 du projet : ce qui se calcule ne se stocke pas.
--
--   · **Aucune durée.** `termine_a - demande_a` la donne.
--
--   · **Aucun montant en euros.** Les tarifs changent, les tokens non. Une
--     facture recalculée à partir de compteurs bruts reste juste ; un euro
--     figé au moment de l'appel devient faux au premier changement de grille.
--
--   · ⚠️ **AUCUN DIRIGEANT.** Le registre rend les personnes physiques
--     dirigeantes, nommées, avec leur date de naissance. C'est exactement la
--     nature de donnée que la collecte écarte AVANT écriture depuis le 20 août
--     (seuls `contact_nom` et `contact_url_postulation` sont conservés). Aucune
--     colonne ne les accueille ici, et c'est délibéré : une donnée qui n'a pas
--     de colonne ne peut pas être écrite par distraction.

-- ---------------------------------------------------------------------------
-- enrichissements — une ligne par TENTATIVE
-- ---------------------------------------------------------------------------

create table public.enrichissements (
  id  bigint generated always as identity primary key,

  offre_identifiant  text not null references public.offres (identifiant),

  -- Toujours 'manuel' : l'enrichissement automatique est au hors périmètre
  -- opposable du PRD depuis le 30 août 2026. La colonne existe pour l'écran de
  -- suivi d'exploitation, qui doit pouvoir dire d'où vient chaque
  -- enrichissement — elle ne prépare aucun retour de l'automatique, et la
  -- contrainte ci-dessous rend ce retour impossible sans migration.
  declenchement  text not null default 'manuel',

  -- Trois instants distincts, et l'écart entre les deux premiers est
  -- l'information la plus intéressante du lot : `demande_a` est écrit par
  -- Vercel au clic, `demarre_a` par le runner GitHub quand l'agent démarre.
  -- Leur différence mesure la latence d'allocation d'une machine — 30 à 60 s
  -- attendues, et c'est ce qu'on veut voir dériver.
  demande_a  timestamptz not null default now(),
  demarre_a  timestamptz,
  termine_a  timestamptz,

  issue        text not null default 'demande',
  motif_echec  text,

  -- Compteurs bruts. NULL tant que l'agent n'a pas conclu : NULL veut dire
  -- « pas encore connu », jamais « zéro ».
  modele              text,
  tours               integer,
  tokens_entree       integer,
  tokens_sortie       integer,
  tokens_cache_lu     integer,
  tokens_cache_ecrit  integer,

  -- L'ancrage : ce que le registre public a rendu, et à quel point on croit
  -- que c'est la bonne entreprise.
  appariement        text,
  appariement_motif  text,

  entreprise_siren                   text,
  entreprise_nom_officiel            text,
  entreprise_creee_le                date,
  entreprise_categorie               text,
  entreprise_tranche_effectif        text,
  entreprise_tranche_effectif_annee  integer,
  chiffre_affaires                   bigint,
  chiffre_affaires_annee             integer,

  -- Le site n'est pas au registre : il est trouvé par l'agent. Il porte donc
  -- son propre marqueur, contrairement au reste de l'ancrage dont la fiabilité
  -- est celle de l'appariement.
  entreprise_site           text,
  entreprise_site_marqueur  text,

  constraint declenchement_connu
    check (declenchement in ('manuel')),

  constraint issue_connue
    check (issue in ('demande', 'en_cours', 'reussite', 'echec')),

  -- Reprise de `executions_veille` : une panne muette est impossible à écrire.
  constraint echec_toujours_motive
    check (issue <> 'echec' or motif_echec is not null),

  -- Un enrichissement conclu porte forcément sa fin. Sans cette contrainte,
  -- une réussite sans `termine_a` ferait pulser indéfiniment l'écran.
  constraint conclu_est_termine
    check (issue in ('demande', 'en_cours') or termine_a is not null),

  constraint demarre_apres_demande
    check (demarre_a is null or demarre_a >= demande_a),
  constraint termine_apres_demande
    check (termine_a is null or termine_a >= demande_a),

  constraint appariement_connu
    check (appariement is null
           or appariement in ('verifie', 'probable', 'non_identifie', 'intermediaire')),

  -- Une réussite doit avoir conclu quelque chose sur l'identité, même si cette
  -- conclusion est « je n'ai pas trouvé ». C'est US-31 gravée dans le moteur :
  -- le doute doit être DIT, pas laissé vide.
  constraint reussite_conclut_l_appariement
    check (issue <> 'reussite' or appariement is not null),

  -- Dire « c'est cette entreprise » sans pouvoir donner son SIREN, c'est
  -- exactement la fiche fausse d'apparence rigoureuse que le PRD redoute.
  constraint entreprise_designee_a_un_siren
    check (appariement is null
           or appariement not in ('verifie', 'probable')
           or entreprise_siren is not null),

  constraint siren_est_neuf_chiffres
    check (entreprise_siren is null or entreprise_siren ~ '^[0-9]{9}$'),

  -- ⚠️ Les deux contraintes qui viennent de la mesure du 30 août : un chiffre
  -- d'affaires ou un effectif sans son millésime est inexploitable, et le
  -- registre rend des exercices vieux de huit ans. Le couple est indissociable.
  constraint chiffre_affaires_toujours_date
    check ((chiffre_affaires is null) = (chiffre_affaires_annee is null)),
  constraint effectif_toujours_date
    check ((entreprise_tranche_effectif is null) = (entreprise_tranche_effectif_annee is null)),

  constraint chiffre_affaires_positif
    check (chiffre_affaires is null or chiffre_affaires >= 0),
  constraint annees_plausibles
    check ((chiffre_affaires_annee is null
            or chiffre_affaires_annee between 1900 and 2200)
           and (entreprise_tranche_effectif_annee is null
                or entreprise_tranche_effectif_annee between 1900 and 2200)),

  constraint site_marqueur_connu
    check (entreprise_site_marqueur is null
           or entreprise_site_marqueur in ('verifie', 'deduit')),
  -- Un site sans marqueur laisserait le lecteur croire qu'il est vérifié.
  constraint site_toujours_marque
    check ((entreprise_site is null) = (entreprise_site_marqueur is null)),

  -- Des compteurs négatifs signaleraient une soustraction quelque part dans le
  -- code d'écriture ; mieux vaut le savoir tout de suite qu'au moment de
  -- sommer l'enveloppe du jour.
  constraint compteurs_positifs
    check (coalesce(tours, 0) >= 0
           and coalesce(tokens_entree, 0) >= 0
           and coalesce(tokens_sortie, 0) >= 0
           and coalesce(tokens_cache_lu, 0) >= 0
           and coalesce(tokens_cache_ecrit, 0) >= 0),

  -- Bornes hautes : un agent parti en vrille écrirait sinon des mégaoctets de
  -- prose dans une colonne de motif.
  constraint motif_echec_borne
    check (motif_echec is null or length(motif_echec) <= 2000),
  constraint appariement_motif_borne
    check (appariement_motif is null or length(appariement_motif) <= 1000)
);

-- ⚠️ LA garde d'US-35. Voir le préambule : au plus un enrichissement EN VOL par
-- offre, garanti par le moteur et non par une lecture suivie d'une écriture.
create unique index enrichissements_un_seul_en_vol
  on public.enrichissements (offre_identifiant)
  where issue in ('demande', 'en_cours');

comment on table public.enrichissements is
  'Une ligne par TENTATIVE d''enrichissement, jamais écrasée : une relance '
  'ajoute une ligne et l''affichage prend la dernière conclue. Écrite par '
  'l''interface au clic (issue = demande), complétée par l''agent qui tourne '
  'chez GitHub Actions. Une ligne restée demande ou en_cours au-delà de '
  'quelques minutes est une exécution tuée net.';

comment on column public.enrichissements.appariement is
  'Le degré de certitude du rapprochement entre l''annonce et une entreprise du '
  'registre. verifie = confirmé par une preuve externe (SIREN ou mentions '
  'légales du site) · probable = un seul candidat plausible, sans preuve · '
  'non_identifie = aucun candidat sûr, la fiche le DIT (US-31) · intermediaire '
  '= l''annonce émane d''un cabinet ou d''une ESN et l''employeur final reste '
  'inconnu (US-30). ⚠️ La fiabilité de tout l''ancrage découle de cette '
  'valeur : des données exactes sur la mauvaise entreprise restent fausses.';

comment on column public.enrichissements.chiffre_affaires_annee is
  'L''exercice du chiffre d''affaires. ⚠️ INDISSOCIABLE du montant, par '
  'contrainte : le registre ne rend que le dernier exercice DÉPOSÉ, mesuré à '
  'huit ans d''âge sur OCTO Technology (2016) le 30 août 2026. Un CA sans son '
  'année laisserait croire qu''il est récent.';

comment on column public.enrichissements.entreprise_tranche_effectif is
  'Le CODE INSEE de tranche d''effectif (par exemple 32, 41, 51), pas un '
  'nombre de salariés. La traduction en toutes lettres se fait à l''affichage. '
  'Millésimé par entreprise_tranche_effectif_annee, et le registre ne rend '
  'qu''un seul millésime : l''évolution sur plusieurs années n''existe pas ici, '
  'elle est approchée par la rubrique rédigée effectif_annonce.';

comment on column public.enrichissements.declenchement is
  'Toujours manuel. L''enrichissement automatique est REFUSÉ (hors périmètre '
  'opposable du PRD, 30 août 2026), pas reporté. Cette colonne sert à l''écran '
  'de suivi d''exploitation, elle ne prépare pas un retour.';

-- ---------------------------------------------------------------------------
-- rubriques_enrichissement — ce que l'agent a RÉDIGÉ, avec son marqueur
-- ---------------------------------------------------------------------------

create table public.rubriques_enrichissement (
  id  bigint generated always as identity primary key,

  enrichissement_id  bigint not null
    references public.enrichissements (id) on delete cascade,

  rubrique  text not null,
  valeur    text not null,
  marqueur  text not null,
  rang      integer not null,

  -- ⚠️ Liste FERMÉE, et la phase 7 devra l'étendre par une migration d'une
  -- ligne. C'est le prix assumé de la fermeture : sans elle, un nom de rubrique
  -- mal orthographié par l'agent produirait une information écrite en base et
  -- invisible à l'écran — le bug silencieux exact que le projet traque.
  constraint rubrique_connue
    check (rubrique in ('groupe', 'modele_economique', 'effectif_annonce')),

  constraint marqueur_connu
    check (marqueur in ('verifie', 'deduit')),

  -- Même garde que note_personnelle_non_vide : une rubrique blanche est une
  -- rubrique absente, et l'absence s'exprime en n'écrivant pas de ligne.
  constraint valeur_non_vide
    check (valeur ~ '[^[:space:]]'),
  constraint valeur_bornee
    check (length(valeur) <= 4000),

  constraint rang_positif
    check (rang >= 0),

  -- Deux valeurs pour la même rubrique du même enrichissement seraient deux
  -- vérités concurrentes, et l'affichage en choisirait une au hasard.
  constraint une_seule_ligne_par_rubrique
    unique (enrichissement_id, rubrique)
);

comment on table public.rubriques_enrichissement is
  'Les rubriques RÉDIGÉES de la fiche, une ligne chacune. ⚠️ L''absence de '
  'ligne signifie « non disponible » — cette chaîne ne s''écrit JAMAIS dans '
  'valeur, sinon on ne distingue plus une information manquante d''une '
  'information dont le contenu est « non disponible ». Séparées de l''ancrage '
  'en colonnes typées parce que ce sont des paragraphes sans type utile, dont '
  'chacun peut être vérifié ou déduit indépendamment des autres.';

comment on column public.rubriques_enrichissement.marqueur is
  'verifie = lu sur une source qui fait foi · deduit = inféré par l''agent. '
  'US-21 : ne jamais prendre une supposition pour un fait en entretien. En '
  'phase 6 ces rubriques sont presque toutes déduites, le registre ne portant '
  'ni le modèle économique ni l''appartenance à un groupe.';

-- ---------------------------------------------------------------------------
-- etapes_enrichissement — ce que l'écran montre défiler
-- ---------------------------------------------------------------------------

create table public.etapes_enrichissement (
  id  bigint generated always as identity primary key,

  enrichissement_id  bigint not null
    references public.enrichissements (id) on delete cascade,

  rang      integer not null,
  libelle   text not null,
  ecrite_a  timestamptz not null default now(),

  constraint libelle_non_vide
    check (libelle ~ '[^[:space:]]'),
  -- Une étape est une ligne à l'écran, pas un paragraphe.
  constraint libelle_borne
    check (length(libelle) <= 200),
  constraint rang_positif
    check (rang >= 0),

  -- Sert deux fois : elle interdit deux étapes au même rang (l'ordre
  -- d'affichage serait alors indéterminé), et l'index qu'elle crée est celui
  -- que le sondage toutes les 1,5 s empruntera pour lire les étapes d'un
  -- enrichissement dans l'ordre.
  constraint un_seul_rang_par_enrichissement
    unique (enrichissement_id, rang)
);

comment on table public.etapes_enrichissement is
  'Une ligne par étape franchie, lue par le sondage de l''interface toutes les '
  '1,5 s. ⚠️ AUCUNE colonne « en cours » : la dernière étape d''un '
  'enrichissement non conclu EST l''étape en cours. Ce qui se déduit ne se '
  'stocke pas, et un état dupliqué finit par diverger de son issue.';

-- ---------------------------------------------------------------------------
-- Droits — la leçon du 20 août 2026
-- ---------------------------------------------------------------------------
--
-- ⚠️ Le projet a « exposition automatique des nouvelles tables » DÉSACTIVÉE :
-- une table neuve n'accorde AUCUN droit à personne, service_role compris. Sans
-- ces trois lignes, les tables existeraient et le serveur recevrait
-- « permission denied » au premier clic sur « Enrichir » — panne impossible à
-- relier à un réglage pris des semaines plus tôt. Trouvé en essayant d'écrire,
-- pas en relisant du SQL.

grant select, insert, update, delete on table public.enrichissements          to service_role;
grant select, insert, update, delete on table public.rubriques_enrichissement to service_role;
grant select, insert, update, delete on table public.etapes_enrichissement    to service_role;

-- Second verrou, indépendant du premier : RLS activé sans aucune politique.
-- Une politique ajoutée par erreur n'ouvrirait toujours rien, les droits
-- restant retirés.
alter table public.enrichissements          enable row level security;
alter table public.rubriques_enrichissement enable row level security;
alter table public.etapes_enrichissement    enable row level security;

revoke all on table public.enrichissements          from anon, authenticated;
revoke all on table public.rubriques_enrichissement from anon, authenticated;
revoke all on table public.etapes_enrichissement    from anon, authenticated;
