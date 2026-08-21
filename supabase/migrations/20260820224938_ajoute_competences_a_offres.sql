-- Ajoute le champ `competences` de France Travail, découvert le 21 août 2026 en
-- interrogeant l'API.
--
-- Pourquoi il compte, alors qu'il ne figurait pas dans le schéma initial :
--
--   1. C'est ce que la recherche par mots-clés indexe réellement. La mesure du
--      21 août a montré que `motsCles` ne lit PAS la description : un mot pris
--      dans le corps d'une annonce ne la retrouve pas (4 essais sur 4). La
--      recherche porte sur l'intitulé, le libellé ROME et ce champ-ci.
--   2. C'est de la donnée déjà structurée par France Travail, que le modèle
--      n'aura pas à déduire du texte libre. Exemples relevés :
--        « Documenter les processus et les architectures d'IA »
--        « Optimiser les performances des systèmes d'IA »
--        « Python, PyTorch, Scikit-Learn »
--
-- Forme : [{"code": "123456", "libelle": "…", "exigence": "E"}]
-- jsonb comme `langues` et `formations` — une liste de longueur variable dont
-- on ne connaît pas encore les usages. La normaliser en table demanderait de
-- savoir ce qu'on veut en faire ; on ne le sait pas avant la phase 2.
--
-- ⚠️ Migration ADDITIVE sur des tables vides : la colonne tolère le vide, rien
-- n'est réécrit. Le schéma initial n'est pas modifié — une migration déjà
-- appliquée ne se retouche jamais.

alter table public.offres
  add column competences jsonb;

comment on column public.offres.competences is
  'Compétences normalisées par France Travail. C''est le champ que la recherche '
  'par mots-clés indexe — la description, elle, n''est pas cherchable.';
