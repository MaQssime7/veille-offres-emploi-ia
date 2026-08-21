-- Trace les offres écartées à la normalisation.
--
-- Trouvé par `/code-review` le 21 août 2026 : `normaliser_lot` rend ses motifs
-- de rejet, et `collecte.py` les jetait (`lignes, _ = ...`). Une nuit où 12
-- offres sur 40 sont refusées pour identifiant mal formé enregistrait
-- `offres_recues=40, offres_nouvelles=28` — un écart de 12 indistinguable de
-- 12 doublons, et visible seulement dans un journal GitHub Actions qui expire.
--
-- Le CLAUDE.md impose de tracer chaque exécution « en compteurs bruts dès le
-- premier jour » précisément parce qu'« un historique ne se reconstitue pas ».
-- L'écran de suivi d'exploitation, prévu, en a besoin.
--
-- Nullable sans valeur par défaut, comme les deux autres compteurs : la valeur
-- n'est connue qu'à la fin, et NULL veut dire « exécution jamais terminée »,
-- pas « zéro rejet ».

alter table public.executions_veille
  add column offres_rejetees integer;

comment on column public.executions_veille.offres_rejetees is
  'Offres reçues de France Travail mais impossibles à écrire : identifiant mal '
  'formé, intitulé ou description vide, date de création absente. Une offre '
  'rejetée n''interrompt pas la collecte.';

-- Le nom `offres_recues` promettait plus que ce qu'il contient : ce sont les
-- offres DISTINCTES, après union des critères. Une même offre remontant sur
-- trois mots-clés y compte une fois. On précise plutôt que de renommer — la
-- valeur distincte est celle qui a du sens pour « combien en a-t-on regardé ».
comment on column public.executions_veille.offres_recues is
  'Offres DISTINCTES reçues de France Travail, après union des critères de '
  'recherche et déduplication sur l''identifiant. Une offre remontant sur '
  'plusieurs mots-clés compte une seule fois.';
