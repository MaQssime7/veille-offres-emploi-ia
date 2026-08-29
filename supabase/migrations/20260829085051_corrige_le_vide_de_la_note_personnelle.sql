-- Corrige `note_personnelle_non_vide`, posée quelques minutes plus tôt par
-- 20260829084815 et **prise en défaut par son propre test d'acceptation**.
--
-- ⚠️ **La migration fautive n'est PAS réécrite, et c'est une règle du projet.**
-- Elle est déjà dans la base : la corriger sur place ne défait rien et fait
-- diverger git de la réalité. On corrige toujours par une migration suivante.
-- Même leçon que le 20 août 2026 (`docs/JOURNAL.md`).
--
-- ---------------------------------------------------------------------------
-- Le défaut, mesuré contre la base réelle
-- ---------------------------------------------------------------------------
--
-- La contrainte écrite était :
--
--     check (note_personnelle is null or btrim(note_personnelle) <> '')
--
-- Elle visait à n'avoir qu'**une seule** représentation du vide, `NULL`, pour
-- qu'aucune requête n'ait à tester deux formes indiscernables à l'écran.
--
-- ⚠️ **`btrim(texte)` à un seul argument ne retire QUE les espaces.** Ni saut de
-- ligne, ni tabulation, ni retour chariot. Donc `btrim('   ' || chr(10))` vaut
-- `chr(10)`, qui n'est pas la chaîne vide : la contrainte laissait passer. Test
-- réel du 29 août 2026 sur l'offre `6141371` : un PATCH de `"   \n"` a rendu
-- **HTTP 204**, là où les six autres violations rendaient bien 400.
--
-- ⚠️ **Le cas n'a rien de théorique.** Un champ de saisie automatique renvoie
-- très exactement ça : l'utilisateur tape du texte, l'efface avec quelques
-- retours à la ligne restants, l'enregistrement part tout seul. La note serait
-- alors « vide à l'écran mais renseignée en base » — et l'indicateur dirait
-- « enregistré » pour du néant.
--
-- ---------------------------------------------------------------------------
-- Le correctif
-- ---------------------------------------------------------------------------
--
-- `~ '[^[:space:]]'` se lit : « contient au moins un caractère qui n'est pas
-- un blanc ». La classe POSIX `[:space:]` couvre l'espace, la tabulation, le
-- saut de ligne, le retour chariot, le saut de page et la tabulation verticale
-- — c'est-à-dire tout ce que `btrim` par défaut ignorait.
--
-- ⚠️ **Formulé en « contient du contenu » plutôt qu'en « n'est pas vide après
-- nettoyage ».** La première forme n'a rien à énumérer : elle ne peut pas
-- oublier un caractère blanc, alors que la seconde devait tous les lister.
-- C'est ce que le défaut ci-dessus a coûté.

alter table public.offres
  drop constraint note_personnelle_non_vide;

alter table public.offres
  add constraint note_personnelle_non_vide
    check (note_personnelle is null or note_personnelle ~ '[^[:space:]]');

comment on constraint note_personnelle_non_vide on public.offres is
  'Le vide n''a qu''une seule représentation : NULL. Le code normalise avant '
  'd''écrire ; cette contrainte le prouve au lieu d''y croire. Formulée en '
  '« contient au moins un caractère non blanc » — la version btrim() du '
  '2026-08-29 laissait passer les sauts de ligne.';
