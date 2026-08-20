-- Droits explicites pour service_role.
--
-- Pourquoi cette migration existe : le projet a été créé avec « exposition
-- automatique des nouvelles tables » DÉSACTIVÉE. Aucune permission n'est donc
-- accordée par défaut sur une table neuve — à personne, service_role compris.
-- La migration initiale créait deux tables que même le serveur ne pouvait pas
-- lire : le pipeline aurait échoué à sa première écriture, avec une erreur
-- « permission denied » impossible à relier à un réglage pris des semaines plus
-- tôt, à la création du projet.
--
-- Trouvé en essayant d'écrire dans la base, pas en relisant le SQL.
--
-- ⚠️ La migration initiale n'est PAS modifiée. Elle est déjà appliquée : la
-- réécrire ne défait rien et ferait diverger git de la réalité. Une migration
-- appliquée se corrige toujours par une migration suivante.

-- service_role est le rôle porté par SUPABASE_SECRET_KEY : le serveur Next.js
-- et le pipeline Python, tous deux côté serveur. Il contourne RLS par
-- conception — c'est pourquoi cette clé ne doit jamais atteindre le navigateur.
grant select, insert, update, delete on table public.executions_veille to service_role;
grant select, insert, update, delete on table public.offres            to service_role;

-- Réaffirmé : anon (la clé publiable) et authenticated n'ont aucun droit.
-- Le navigateur ne parle jamais directement à Supabase. RLS sans politique est
-- le premier verrou ; l'absence de droits en est un second, indépendant. Un
-- seul suffirait en théorie ; deux font qu'un oubli n'ouvre pas la table.
revoke all on table public.executions_veille from anon, authenticated;
revoke all on table public.offres            from anon, authenticated;
