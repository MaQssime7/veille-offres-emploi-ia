-- L'employeur réel, lu dans le texte de l'annonce par le modèle.
--
-- Migration **purement additive** : aucune colonne supprimée, aucune donnée
-- réécrite. Les 580 offres déjà en base restent intactes, avec deux colonnes
-- vides que la notation remplira au fur et à mesure.
--
-- ---------------------------------------------------------------------------
-- Le défaut mesuré, le 30 août 2026, contre les 580 offres réelles
-- ---------------------------------------------------------------------------
--
-- `entreprise_nom` vient du champ `entreprise.nom` de France Travail. Il est :
--
--   * **absent sur 229 offres — 39 %** (47 % des 146 offres notées) ;
--   * **souvent celui d'un intermédiaire** : 206 descriptions sur 580 (36 %)
--     contiennent « notre client », « cabinet de recrutement », « agence
--     d'emploi » ou « pour le compte de » — dont 185 pour le seul « notre
--     client » ;
--   * ⚠️ **parfois tout simplement FAUX.** L'offre `6426819` porte
--     `entreprise_nom = 'NEW NET 3D'` et sa description dit mot pour mot :
--     « En tant qu'organisateur de forums de recrutement, Talents Handicap
--     accompagne […] L'entreprise **Wavestone** recherche actuellement des
--     profils ». Ni l'employeur (Wavestone), ni même l'intermédiaire réel
--     (Talents Handicap). NEW NET 3D apparaît sur 20 offres allant d'« Ingénieur
--     Hardware » à « Chargé de veille stratégique » : c'est un compte de dépôt,
--     pas un employeur.
--
-- Le nom réel, lui, est presque toujours **dans le texte** de l'annonce. D'où
-- ces deux colonnes : le modèle lit déjà la description entière pour noter
-- l'offre, il en extrait l'employeur dans le même appel.
--
-- ---------------------------------------------------------------------------
-- Pourquoi DEUX colonnes et pas une correction de `entreprise_nom`
-- ---------------------------------------------------------------------------
--
-- ⚠️ **`entreprise_nom` n'est jamais écrasé.** Exactement la même règle que
-- `salaire_libelle` face à `salaire_annuel_min` : ce que la source a dit reste
-- lisible, la déduction vient à côté. Trois raisons concrètes :
--
--   1. Le modèle peut se tromper. Écraser rendrait l'erreur indétectable, et
--      irréversible — France Travail dépublie ses annonces.
--   2. L'écran doit pouvoir montrer les deux (« Wavestone, annoncé par NEW NET
--      3D ») pour que l'utilisateur sache ce qu'il regarde.
--   3. Les 434 offres non notées gardent leur valeur d'origine sans qu'aucune
--      requête n'ait à distinguer « déduit » de « d'origine ».

alter table public.offres
  -- Le nom de l'employeur chez qui on travaillerait vraiment, tel qu'écrit dans
  -- l'annonce. NULL = le modèle n'a pas trouvé de nom, ce qui est un cas normal
  -- et fréquent (une annonce de cabinet qui ne nomme pas son client).
  add column entreprise_identifiee text,

  -- L'annonce est-elle déposée par un tiers pour le compte d'un autre ?
  -- ⚠️ NULL ≠ false, règle 3 du projet : NULL = « pas encore évalué » (les 580
  -- offres actuelles, et toute offre dont la notation a échoué), false = « le
  -- modèle a regardé et a répondu non ». Un `default false` fabriquerait 580
  -- réponses que personne n'a données.
  add column entreprise_intermediaire boolean;

-- Le vide n'a qu'une seule représentation, NULL. Même formulation que
-- `note_personnelle_non_vide` — « contient au moins un caractère non blanc »
-- plutôt que « n'est pas vide après nettoyage » : la première forme n'a rien à
-- énumérer, donc ne peut pas oublier un caractère blanc. C'est très exactement
-- ce que la version `btrim()` du 29 août avait coûté.
alter table public.offres
  add constraint entreprise_identifiee_non_vide
    check (entreprise_identifiee is null
           or entreprise_identifiee ~ '[^[:space:]]'),

  -- Garde-fou contre un modèle qui rendrait une phrase au lieu d'un nom
  -- (« l'entreprise n'est pas nommée dans cette annonce »). 200 caractères est
  -- très large pour un nom d'entreprise — le plus long observé sur 580 offres
  -- en fait 44.
  --
  -- ⚠️ **Le contrôle du code est volontairement PLUS STRICT que celui-ci** :
  -- `pipeline/notation.py` refuse au-delà de 120 caractères. C'est le seul sens
  -- qui évite un 400 que rien n'annoncerait — si la base était la plus stricte
  -- des deux, une valeur de 150 caractères passerait tous les contrôles Python
  -- pour mourir sur une erreur PostgREST opaque, en pleine notation nocturne.
  add constraint entreprise_identifiee_courte
    check (entreprise_identifiee is null
           or length(entreprise_identifiee) <= 200);

-- ⚠️ **Pas de contrainte liant ces colonnes à `notee_a`**, et c'est délibéré.
-- Elle serait vraie aujourd'hui par construction (l'identification se fait
-- pendant la notation), mais elle interdirait le seul mode qu'on voudra
-- peut-être un jour : identifier l'employeur d'une offre sans repayer sa
-- notation. Une contrainte doit interdire ce qui est faux, pas ce qui n'est pas
-- encore arrivé.

comment on column public.offres.entreprise_identifiee is
  'L''employeur réel, extrait du TEXTE de l''annonce par le modèle et vérifié '
  'en Python (le nom doit apparaître littéralement dans la description, sinon '
  'il est rejeté). NULL = non identifiable, cas normal. Ne remplace jamais '
  'entreprise_nom, qui reste la valeur brute de France Travail — absente sur '
  '39 % des offres et parfois fausse (mesuré le 2026-08-30).';

comment on column public.offres.entreprise_intermediaire is
  'true = l''annonce est déposée par un cabinet, une ESN, une agence ou un '
  'organisateur de forum pour le compte d''un tiers. NULL = pas encore évalué, '
  'jamais « non ». Sert à expliquer à l''écran pourquoi le nom affiché diffère '
  'de celui annoncé par France Travail.';
