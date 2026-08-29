-- Phase 4 — le tri de la matinée : un statut par offre, et une note libre.
--
-- Migration **purement additive** : aucune colonne supprimée, aucune donnée
-- réécrite. Les 567 offres déjà en base basculent toutes en 'a_traiter', ce qui
-- est exactement leur état réel — aucune n'a encore été triée.
--
-- ⚠️ **C'est la première fois que l'INTERFACE écrit en base.** Tout ce qui
-- précède était écrit par le pipeline Python, seul et de nuit. Ces quatre
-- colonnes sont écrites depuis le navigateur de Maxime, par une action serveur,
-- pendant qu'il lit. Deux conséquences qui expliquent la forme de ce fichier :
-- les contraintes sont la seule protection qui ne dépend pas du code appelant,
-- et les colonnes de date sont écrites par ce code — pas par un `default now()`
-- qui mentirait sur les lignes existantes.

-- ---------------------------------------------------------------------------
-- offres — le statut
-- ---------------------------------------------------------------------------
--
-- ⚠️ **`not null default 'a_traiter'` n'est PAS une entorse à la règle
-- `NULL` ≠ `false` du projet.** Cette règle interdit de fabriquer une donnée
-- absente : un `default false` sur un champ souvent non renseigné invente un
-- « non » là où il n'y a que du silence. Ici c'est l'inverse — « à traiter » est
-- *réellement* l'état de toute offre qui vient d'arriver, et il le restera tant
-- que personne ne l'aura touchée. La valeur par défaut décrit la vérité, elle ne
-- la devine pas. Il n'existe donc aucun troisième état « statut inconnu » à
-- représenter, et `not null` ferme la porte à une offre sans statut.
--
-- ⚠️ **Pas d'accents et pas de tirets dans les valeurs** : 'a_traiter' et non
-- 'à traiter'. Ces chaînes voyagent dans la barre d'adresse
-- (`/offres?statut=candidate`) ; un accent y devient `%C3%A0` et un espace `%20`,
-- ce qui rend l'adresse illisible et le favori fragile. Le libellé français
-- s'affiche à l'écran, il ne se stocke pas.

alter table public.offres
  add column statut           text not null default 'a_traiter',
  add column statut_modifie_a timestamptz,
  add column note_personnelle text,
  add column note_modifiee_a  timestamptz;

-- ⚠️ **La liste des statuts est gravée dans le moteur, pas seulement dans le
-- code.** Le projet a déjà tranché ainsi pour les notes : « une règle gravée
-- dans le moteur vaut mieux qu'une discipline de code ». Ici l'enjeu est
-- concret — la valeur arrive de la barre d'adresse, donc de l'extérieur. Le code
-- la valide contre une liste blanche avant d'écrire ; cette contrainte tient
-- encore le jour où quelqu'un ajoutera un chemin d'écriture en oubliant de
-- valider.
alter table public.offres
  add constraint statut_connu
    check (statut in ('a_traiter', 'candidate', 'ecarte'));

-- ⚠️ **La borne de longueur protège la base d'un copier-coller, pas Maxime de
-- lui-même.** Le plan exige qu'une note de 5 000 caractères s'enregistre et se
-- réaffiche ; 20 000 laisse quatre fois cette marge. Sans borne, un
-- copier-coller malheureux pousserait plusieurs mégaoctets dans une ligne que
-- `COLONNES_FICHE` relit à chaque affichage de la fiche.
--
-- ⚠️ **`length()` et non `octet_length()`** : on compte des caractères, comme
-- l'utilisateur les voit. En UTF-8, « é » pèse deux octets — borner les octets
-- ferait une limite qui varie selon la langue du texte.
alter table public.offres
  add constraint note_personnelle_bornee
    check (note_personnelle is null or length(note_personnelle) <= 20000);

-- ⚠️ **Le vide de la note n'a qu'UNE seule représentation : `NULL`.** Sans cette
-- contrainte, une note effacée pourrait arriver en base sous deux formes
-- indiscernables à l'œil — `NULL` (jamais écrite) et `''` (écrite puis vidée) —
-- et chaque requête devrait tester les deux. C'est le même piège que
-- `NULL` ≠ `false`, appliqué au texte. Le code normalise la chaîne vide en
-- `NULL` avant d'écrire ; cette contrainte le prouve plutôt que d'y croire.
--
-- ⚠️ **`btrim` et pas seulement `<> ''`** : une note réduite à des espaces ou à
-- un saut de ligne est vide pour l'utilisateur, qui ne voit aucune différence
-- avec un champ jamais rempli.
alter table public.offres
  add constraint note_personnelle_non_vide
    check (note_personnelle is null or btrim(note_personnelle) <> '');

-- ---------------------------------------------------------------------------
-- Les deux horodatages
-- ---------------------------------------------------------------------------
--
-- ⚠️ **Aucun `default now()`, et c'est délibéré.** Un défaut aurait horodaté les
-- 567 lignes existantes à l'instant de cette migration, affirmant que Maxime a
-- statué sur chacune ce matin — c'est faux, et ce serait indétectable ensuite.
-- `NULL` dit ici sa vérité habituelle : « ça n'est jamais arrivé ».
--
-- ⚠️ **`timestamptz` et jamais `timestamp`.** Règle du projet, et elle mord
-- précisément ici : ces dates sont écrites par Vercel en région Paris, lues par
-- un navigateur à Paris, et comparées à des collectes écrites par GitHub Actions
-- en UTC. Sans fuseau, un clic de 14 h s'afficherait « 12 h ».
--
-- ⚠️ **Ces colonnes se remplissent en même temps que leur valeur, jamais après.**
-- Une écriture qui poserait `statut` sans toucher `statut_modifie_a` produirait
-- une offre candidatée sans date de candidature — l'incohérence exacte que la
-- phase 2 a interdite entre une note et sa justification. Ici la contrainte
-- inverse serait fausse (une offre 'a_traiter' n'a jamais été touchée, donc pas
-- de date), on ne peut donc graver que la moitié utile :

alter table public.offres
  add constraint statut_touche_est_date
    check (statut = 'a_traiter' or statut_modifie_a is not null);

alter table public.offres
  add constraint note_ecrite_est_datee
    check (note_personnelle is null or note_modifiee_a is not null);

-- ---------------------------------------------------------------------------
-- Documentation portée par la base elle-même
-- ---------------------------------------------------------------------------

comment on column public.offres.statut is
  'a_traiter (défaut) | candidate | ecarte. Écrit depuis l''interface, jamais '
  'par le pipeline. Sans accent ni espace : la valeur voyage dans la barre '
  'd''adresse (/offres?statut=candidate).';

comment on column public.offres.statut_modifie_a is
  'Quand Maxime a trié cette offre. NULL tant qu''elle est a_traiter. Sans '
  'cette colonne, la liste des candidatures ne peut se classer que par note '
  'd''intérêt — un historique ne se reconstitue pas après coup.';

comment on column public.offres.note_personnelle is
  'Note libre de Maxime. DONNÉE PERSONNELLE au sens du projet : ne sort de la '
  'base que sur la fiche qui l''affiche, jamais dans la liste, jamais dans un '
  'journal (ceux de GitHub Actions sont publics), jamais dans un export. Vide '
  'et NULL sont la même chose, garanti par contrainte.';

comment on column public.offres.note_modifiee_a is
  'Dernier enregistrement réussi de la note. Sert l''indicateur « enregistré à '
  'telle heure » exigé par US-13 : sans heure, un « enregistré » affiché après '
  'un échec réseau ne se distingue pas d''un vrai succès.';
