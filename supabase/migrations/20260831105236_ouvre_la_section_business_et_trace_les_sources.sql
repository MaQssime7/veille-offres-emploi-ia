-- La section « Business » de la fiche, et les sources que l'agent a consultées.
--
-- Deux besoins de la phase 7, une seule migration — parce qu'ils touchent les
-- deux tables filles du même enrichissement et qu'appliquer deux migrations
-- pour six lignes de SQL n'apprendrait rien à personne.
--
-- ---------------------------------------------------------------------------
-- 1. Trois rubriques de plus — la migration annoncée par la précédente
-- ---------------------------------------------------------------------------
--
-- La migration 10 écrivait, au-dessus de `rubrique_connue` : « Liste FERMÉE, et
-- la phase 7 devra l'étendre par une migration d'une ligne. C'est le prix
-- assumé de la fermeture ». Nous y sommes, et le prix est celui annoncé.
--
-- Ce que la fermeture achète, et qui vaut ce prix : un nom de rubrique mal
-- orthographié par l'agent — `activite_IA` au lieu d'`activite_ia` — serait
-- écrit en base et JAMAIS affiché, l'écran cherchant un nom exact dans sa table
-- de titres. Ni erreur, ni journal, ni page blanche : une information payée,
-- stockée, et invisible. C'est exactement la classe de bug que ce projet
-- traque, et une contrainte du moteur est le seul garde-fou qui ne dépende
-- d'aucune discipline de code.
--
-- ⚠️ `groupe` et `effectif_annonce` RESTENT dans la liste, et ce n'est pas un
-- oubli. L'agent ne les produit plus depuis le 30 août 2026 — décision de
-- Maxime : « l'effectif me suffit » — mais trois fiches déjà en base en
-- portent. Les retirer de la liste ferait échouer toute écriture future sur ces
-- lignes-là, pour supprimer un mot dans une contrainte. Une liste fermée
-- s'étend ; elle ne se nettoie pas.
--
-- ⚠️ `offre_commerciale`, et JAMAIS `offre`. Dans ce projet « offre » veut dire
-- *offre d'emploi*, partout et sans exception : la table `offres`, les routes
-- `/offres`, la colonne `offre_identifiant` juste à côté. Une rubrique nommée
-- `offre` créerait dans le vocabulaire la collision exacte que le projet a déjà
-- refusée en figeant « enrichissement, jamais enquête » — un mot pour deux
-- choses, qui finit en deux tables et deux fonctions.

alter table public.rubriques_enrichissement
  drop constraint rubrique_connue,
  add constraint rubrique_connue
    check (rubrique in (
      -- Produites aujourd'hui
      'modele_economique',
      'clients',
      'offre_commerciale',
      'activite_ia',
      -- Plus produites depuis le 30 août 2026, mais présentes en base
      'groupe',
      'effectif_annonce'
    ));

comment on constraint rubrique_connue on public.rubriques_enrichissement is
  'Liste fermée des rubriques rédigées. Étendue le 31 août 2026 pour la section '
  '« Business » (clients, offre commerciale, activité IA). Un nom hors liste '
  'est refusé par le moteur plutôt qu''écrit puis jamais affiché.';

-- ---------------------------------------------------------------------------
-- 2. L'adresse exacte de chaque page lue — US-21
-- ---------------------------------------------------------------------------
--
-- US-21 demande de voir « les sources consultées par l'enrichissement, chacune
-- avec son adresse ». L'information existait déjà à moitié : depuis le 30 août,
-- une étape de lecture web s'intitule « Lecture de octo.com/nos-clients ».
--
-- ⚠️ Ce libellé est du texte MIS EN FORME, et il ne peut pas servir de lien.
-- Le `https://` en a été retiré, le `www.` aussi, et le chemin est tronqué à
-- 60 caractères pour tenir dans la contrainte `libelle_borne`. Reconstruire une
-- adresse à partir de là donnerait un lien faux une fois sur trois — et un lien
-- faux vers une source est pire qu'aucun lien : il fait croire qu'on peut
-- vérifier.
--
-- ⚠️ Pourquoi une COLONNE et non une quatrième table `sources_enrichissement` :
-- une étape de lecture EST une source consultée. Deux tables porteraient la
-- même information sous deux formes, et la règle du projet — « ce qui se
-- calcule ne se stocke pas » — s'applique telle quelle : la liste des sources
-- se calcule, c'est l'ensemble des étapes qui portent une `url`.
--
-- La colonne est NULLABLE, et c'est le sens qui compte : `null` = cette étape
-- n'a consulté aucune page (un appel au registre, un dépôt de fiche). Ce n'est
-- pas une valeur manquante, c'est une étape d'une autre nature.

alter table public.etapes_enrichissement
  add column url text;

comment on column public.etapes_enrichissement.url is
  'L''adresse exacte de la page lue, quand cette étape en a lu une. NULL pour '
  'toute étape qui n''a consulté aucune page web — appel au registre, dépôt de '
  'la fiche. La liste des sources de US-21 est l''ensemble des étapes où cette '
  'colonne n''est pas nulle : une source ne se stocke pas deux fois.';

-- ⚠️ CETTE CONTRAINTE EST UNE PROTECTION CONTRE L'EXÉCUTION DE CODE, pas du
-- rangement. L'adresse vient d'un modèle qui a lu des pages web que personne ne
-- contrôle, et l'écran de la fiche va en faire un `<a href={url}>`. Une page
-- hostile qui pousserait le modèle à écrire `javascript:alert(document.cookie)`
-- ou `data:text/html,…` produirait un lien EXÉCUTABLE dans la session de
-- Maxime — celle qui est déjà authentifiée derrière le mot de passe du site.
--
-- ⚠️ **Un contrôle jumeau existe côté Python (`_URL_AFFICHABLE` dans
-- `stockage.py`), et le doublon est délibéré.** Les deux n'ont pas le même
-- rôle : le filtre Python évite de perdre l'étape ENTIÈRE quand l'adresse est
-- douteuse — refusée par le moteur, la ligne emporterait son libellé avec elle ;
-- celle-ci garantit qu'une adresse dangereuse n'entre JAMAIS, même le jour où
-- quelqu'un touchera au code Python sans y penser. Une règle gravée dans le
-- moteur vaut mieux qu'une discipline de code — c'est déjà le raisonnement des
-- trois contraintes de notation.
--
-- ⚠️ **À NE PAS lire comme « `entreprise_site` est protégé de la même
-- façon » : il ne l'est PAS.** Relevé en revue le 31 août 2026, la première
-- version de ce commentaire le laissait entendre. Ce champ — l'autre valeur de
-- la fiche qui devient un lien cliquable — n'a AUCUNE contrainte de format en
-- base : la migration 10 ne lui donne que `site_marqueur_connu` et
-- `site_toujours_marque`. Ses gardes sont `_valider_fiche()` côté Python et une
-- revérification au rendu. C'est suffisant aujourd'hui, mais **ne pas relâcher
-- le contrôle Python en croyant que le moteur rattrape** — et lui poser une
-- contrainte le jour où une migration passe par là.
--
-- ⚠️ La borne de longueur est à 2000 et non à 200 comme le libellé : ce sont
-- deux choses différentes. Le libellé est une ligne à l'écran, l'adresse est
-- une adresse — les URL de sites institutionnels dépassent couramment 200
-- caractères, et une adresse tronquée est une adresse morte.

alter table public.etapes_enrichissement
  add constraint url_est_une_adresse_web
    check (url is null
           or (url ~ '^https?://[^[:space:]<>"'']+$' and length(url) <= 2000));

comment on constraint url_est_une_adresse_web on public.etapes_enrichissement is
  'Seuls http:// et https:// entrent. Ferme la porte à javascript: et data:, '
  'qui deviendraient du code exécutable une fois rendus en <a href>. L''adresse '
  'vient d''un modèle ayant lu des pages non contrôlées : ce qui se vérifie ne '
  'se croit pas.';
