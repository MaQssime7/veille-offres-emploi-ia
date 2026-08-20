# Journal de bord

Ce qui s'est passé, dans l'ordre, avec les décisions prises en chemin. Le
`CLAUDE.md` ne garde que l'état courant et ce qui commande le comportement :
tout l'historique est ici.

---

## 16 août 2026 — Cadrage, design, plan

**`/cadre`** : critères de recherche, notation à deux axes, forme du livrable,
stack et règles de sécurité tranchés dans `docs/DECISIONS.md` ; périmètre produit
dans `docs/PRD.md` (37 user stories, 13 critères de succès).

**`/design`** : la tension entre les deux publics — Maxime qui veut lire vite le
matin, le lead technique en entretien à qui un tableau de bord gris ne fait aucun
effet — est tranchée par la direction **éditorial technique** : chaud dans la
matière, froid dans la précision. Détail dans `docs/DESIGN.md`.

**`/planifie`** : découpage en **sept** tranches verticales. Deux amendements
consignés — l'écran du matin n'affiche que la collecte de la nuit (et non plus
tout ce qui reste à traiter), et l'enrichissement **manuel se construit avant
l'automatique**. La huitième phase, l'enrichissement automatique nocturne, est
retirée : elle dépensait sans supervision sur des seuils non calibrés.

## 17 août 2026 — Installation de la stack

**`/installe`**, sur la branche `installation-stack`, fusionnée dans `main`.

Le preset `nova` avait écrasé plusieurs décisions du `DESIGN.md` — palette grise à
la place de la palette chaude, Fraunces absente, `--font-heading` pointé vers la
police sans-serif, `--radius` à 0.625rem. Toutes rétablies et vérifiées par
commande.

Corrections annexes : `lang="fr"` au lieu de `"en"` (un lecteur d'écran prononçait
le français avec une phonétique anglaise), `font-feature-settings` et le bloc
`prefers-reduced-motion` ajoutés.

Vérifié à l'écran : bureau et 375 px, mode clair et sombre, console vide,
`npm run build` passant.

## 17 août 2026 — Mise en service des hébergements

**Supabase** : projet `veille-offres-emploi-ia` créé en région **Paris**. Réglages
retenus à la création — **RLS automatique activé**, **exposition automatique des
nouvelles tables désactivée**. Deux verrous indépendants, pour qu'un oubli ne
suffise pas à ouvrir une table au monde. Connexion vérifiée en HTTP 200 avec la
clé secrète.

**Vercel** : déployé sur https://veille-offres-emploi-ia.vercel.app, avec
`Root Directory = interface` et les fonctions en région **cdg1 (Paris)**. Fluid
Compute activé.

Comportement des déploiements : chaque `push` sur `main` met le site à jour ; une
branche poussée obtient une adresse d'aperçu séparée ; une compilation qui échoue
ne remplace pas la version en ligne ; `Deployments → Promote to Production` sur un
déploiement antérieur rétablit le site en quelques secondes.

**Nommage des clés Supabase** : `anon` / `service_role` sont l'ancienne
génération, dépréciée fin 2026. Le projet utilise `sb_publishable_` /
`sb_secret_`, révocables une par une là où les anciennes se révoquaient en bloc.
`SUPABASE_SERVICE_ROLE_KEY` est renommée `SUPABASE_SECRET_KEY` partout.

**Décision Git** : après avoir fait le geste complet une fois (brancher,
développer, demander la fusion, fusionner), on **travaille directement sur
`main`**. Seul sur le dépôt, une demande de fusion qu'on s'adresse à soi-même
n'apporte aucune relecture et ralentit sans rien protéger.

## 20 août 2026 — Outillage

Skill **`next-best-practices`** (vercel-labs) installée dans `.agents/skills/`.
Elle a immédiatement révélé un piège : en **Next 16, `middleware.ts` devient
`proxy.ts`** et `config` devient `proxyConfig`. La documentation du projet parlait
encore de middleware — corrigé.

**Correction d'une justification fausse** : « Vercel est un environnement
JavaScript, il n'héberge pas un processus Python » était erroné. Vercel exécute du
Python et propose des sandboxes conçus pour les agents, démarrant en
millisecondes. Le vrai argument en faveur de GitHub Actions est la durée (6 h
contre 300 s en offre gratuite), la gratuité sur dépôt public et un workflow
versionné donc visible d'un recruteur. Ce qu'on laisse sur la table — la latence
au clic sur « Enrichir » — est un arbitrage assumé, pas une impossibilité.
