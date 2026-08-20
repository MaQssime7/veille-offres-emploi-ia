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

## 20 août 2026 — Phase 1, collecte à blanc contre l'API France Travail

Avant de figer le schéma, un script jetable (hors dépôt) a interrogé l'API sur
**50 offres réelles**, sans rien écrire nulle part. Concevoir les tables avec la
matière sous les yeux plutôt que d'après la documentation. Détail complet dans
`docs/API_FRANCE_TRAVAIL.md`, qui ne porte plus aucune mention « non vérifié ».

**Ce qui était ouvert et qui est tranché :**

- **`experienceExige` existe bien en champ structuré** — `D` (débutant accepté,
  26/50) et `E` (exigée, 24/50), doublé de `experienceLibelle` en clair
  (`Débutant accepté`, `2 An(s)`…). `S` (souhaitée) attendu mais non observé : le
  code doit tolérer une valeur inconnue. L'échelle de pénalité par années
  d'expérience du `DECISIONS.md` § 1 se branche dessus **sans faire lire le
  modèle**.

**Ce qui invalide une hypothèse écrite ailleurs :**

- **La description est plafonnée à 5 000 caractères** — 5 offres sur 50 sont
  coupées à 5 000 pile, en plein mot. `GET /offres/{id}` renvoie **le même texte
  tronqué et aucun champ supplémentaire** : il n'existe pas de version longue.
  Donc **pas d'appel de détail par offre**, `/search` suffit — un appel économisé
  par offre. Le contenu de test du `PLAN.md` visait 20 000 caractères : corrigé à
  5 000.
- **44 % des offres ne nomment pas l'entreprise** (28/50 seulement), et **54 %
  n'indiquent aucun salaire** (23/50). Ce sont les cas normaux, pas les cas
  limites. Aucun repli disponible : quand `entreprise.nom` manque, `contact.nom`
  manque aussi. Le `DESIGN.md` place l'entreprise en tête de ligne d'offre — cet
  emplacement sera vide une fois sur deux, il lui faut un traitement propre.
  Annonce aussi la difficulté de la phase 6 : identifier l'employeur sans son nom.

**Ce qui touche la sécurité :**

- ⛔ **Le champ `contact` porte des données personnelles au sens du RGPD** —
  nom de personne physique, adresse postale, courriel, URL de postulation
  nominative — sur 50 offres sur 50. **Écarté à la collecte, pas à l'affichage** :
  filtré seulement à l'affichage, il serait quand même écrit en base et dans les
  journaux d'exécution.

**Trois pièges d'appel, vérifiés :**

- **Zéro résultat = HTTP 204, corps entièrement vide**, `Content-Range: */0`. Un
  `.json()` dessus lève une exception. C'est le jour calme, pas une panne.
- **`departement` est plafonné à 5 valeurs**, l'Île-de-France en compte 8 →
  `region=11` est la seule voie.
- **`minCreationDate` et `maxCreationDate` sont indissociables** ; l'un sans
  l'autre renvoie une HTTP 400.

**Volume réel** : 6 offres créées en 24 h sur « intelligence artificielle » en
Île-de-France (246 au total, toutes dates confondues). Le régime quotidien se
compte en unités — le plafond de pagination de 1 150 ne sera jamais approché.

### Schéma — décisions prises en séance avec Maxime

- **`offres.identifiant` = l'identifiant France Travail en clé primaire.** Le
  risque d'adopter une clé produite par un tiers est écarté par une décision
  produit déjà écrite : « toute source d'offres autre que France Travail » est au
  hors périmètre opposable du PRD. En échange, la déduplication de US-34 est
  garantie par le moteur (`on conflict do nothing`) et non par du code Python.
  Contrainte de forme `^[0-9A-Z]{7}$` — la valeur arrivera un jour de la barre
  d'adresse.
- **La ligne d'`executions_veille` s'écrit au démarrage, se complète à la fin.**
  Écrire à la fin obligerait à tout garder en mémoire (la clé étrangère exige que
  l'exécution existe avant la première offre) et **un plantage ne laisserait
  aucune trace** — la panne deviendrait indistinguable d'une nuit calme, contre
  US-24, US-25 et US-37. Conséquence : `terminee_a`, le motif et les compteurs
  doivent tolérer le vide.
- **Contrepartie assumée** : un processus tué net laisse une ligne bloquée en
  `en_cours`. Traitée à deux endroits — le pipeline referme au démarrage les
  `en_cours` trop vieilles en `echec`, et l'interface ne compte jamais un
  `en_cours` comme une réussite.
- **Pas de colonne `duree`**, contrairement à ce qu'annonçait le `PLAN.md` : elle
  se calcule (`terminee_a - demarree_a`). Une valeur dérivée stockée est un
  endroit où la vérité peut diverger.
- **Pas de colonnes de tokens ni de modèle en phase 1.** Rien ne les alimente
  avant la phase 2, et ajouter une colonne qui tolère le vide est instantané, sans
  verrou et sans effet sur le code existant. La règle « un historique ne se
  reconstitue pas » du PRD porte sur les **données**, pas sur les colonnes.
- **`echec_toujours_motive`** : contrainte `check` interdisant un `echec` sans
  motif. US-25 gravée dans le moteur plutôt que confiée à la discipline.
- **`timestamptz` partout, jamais `timestamp`.** GitHub Actions tourne en UTC et
  le navigateur est à Paris : une collecte de 4 h s'afficherait « 02:00 » en été.

## 20 août 2026 — Le schéma est en base

Deux migrations versionnées, appliquées sur le projet Supabase de production.
`executions_veille` et `offres` existent. `enrichissements` et
`etapes_enrichissement` sont **reportées à la phase 6** — entorse assumée au
critère d'acceptation du `PLAN.md`, validée en séance : leur forme dépend de ce
que l'agent produira réellement, rien ne les alimente d'ici là, et la collecte à
blanc venait justement de montrer que France Travail fournit déjà gratuitement
plusieurs informations que l'enrichissement devait aller chercher.

**Outillage** : CLI Supabase via `npx supabase@2.115.0`. Homebrew a refusé de
l'installer — les Command Line Tools de la machine datent de 2023. `npx` évite la
mise à jour et épingle la version dans le dépôt plutôt que de la laisser flotter.

### La migration corrective — le vrai enseignement de la séance

La migration initiale a été poussée avec succès… et **le serveur ne pouvait
lire ni écrire dans aucune des deux tables**. `service_role`, le rôle porté par
`SUPABASE_SECRET_KEY`, n'avait aucun droit dessus.

Cause : le projet a été créé avec **« exposition automatique des nouvelles
tables » désactivée** (voir l'entrée du 18 août). Aucune permission n'est donc
accordée par défaut sur une table neuve — à personne, `service_role` compris. Le
réglage était noté dans ce journal ; sa conséquence, non.

**Ce qui l'a trouvé** : essayer d'écrire dans la base. Pas relire le SQL, qui
était syntaxiquement irréprochable et validé par `libpg_query`. Sans cette
vérification, la panne serait apparue à la première exécution du pipeline, sous
la forme d'un `permission denied` que rien n'aurait relié à une case cochée des
semaines plus tôt.

**Corrigé par une migration suivante, jamais en modifiant la première.** Une
migration appliquée est déjà dans la base : la réécrire ne défait rien et fait
diverger git de la réalité.

### Vérification — 18 contrôles, tous au vert

Le schéma n'a pas été relu, il a été **attaqué** :

| Ce qu'on a tenté | Réponse de la base |
|---|---|
| Lire `offres` avec la clé publiable | **HTTP 401** — critère d'acceptation n° 1 satisfait |
| Écrire dans les deux tables avec la clé publiable | **HTTP 401** |
| Enregistrer un `echec` sans motif | Refusé — `echec_toujours_motive` |
| Écrire une issue inventée (`succes`) | Refusé — `issue_connue` |
| Terminer une exécution avant de l'avoir commencée | Refusé |
| Identifiant mal formé (`test99`) | Refusé — `identifiant_bien_forme` |
| Rattacher une offre à une exécution inexistante | **HTTP 409** — clé étrangère |
| Écrire une offre sans son archive `charge_brute` | Refusé |
| Insérer deux fois la même offre | Une seule ligne — déduplication US-34 garantie par le moteur |
| Supprimer une exécution portant des offres | **HTTP 409** — `on delete restrict` |

Base laissée vide après nettoyage.

**Deux verrous indépendants sur l'autorisation**, et c'est délibéré : RLS activé
sans aucune politique, *et* tous droits retirés à `anon` et `authenticated`. Un
seul suffirait en théorie. Deux font qu'une politique ajoutée par erreur un jour
n'ouvre toujours rien, parce qu'il n'y a aucun droit dessous.

## 20 août 2026 — Méthode : capitaliser les notions, et qui écrit quoi

**Un dossier `Apprentissage/` est ouvert dans le coffre Obsidian de Maxime**, avec un
sous-dossier par sujet. Les notions techniques comprises en séance y vont, une par fichier,
courtes. Quatre notes déposées : clés primaires et étrangères · migrations · CLI et MCP ·
accès aux données serveur ou navigateur.

Distinct de `docs/`, et les deux se complètent : `docs/DECISIONS.md` dit pourquoi **ce**
projet a tranché ainsi, `Apprentissage/` dit **comment ça marche en général**. Motif : il ne
relit ni le code ni les `.md` du dépôt, mais il rouvre son coffre quand il a un doute ou
qu'il prépare un entretien.

**Erreur corrigée en séance** : la première note groupait « CLI, MCP et migrations ».
Maxime a fait remarquer qu'une migration est une notion de base de données et n'a rien à
voir avec CLI/MCP. Découpée en deux. La règle en découle — **une notion, un fichier** ; ne
jamais grouper deux sujets parce qu'ils sont tombés dans la même conversation, ils ne se
relisent pas au même moment.

### Qui écrit le code — position de Maxime, et ce qu'elle impose

**Il n'écrira pas les requêtes.** Argument : écrire du code est dévalué puisque l'IA écrit ;
ce qui compte est de savoir que la chose existe, à quoi elle sert et comment elle casse,
pour localiser une panne et savoir quoi demander.

**L'argument tient — à une substitution près, qui a été posée explicitement : écrire est
dévalué, lire ne l'est pas.** Localiser une panne demande d'ouvrir le fichier et de suivre
le fil. Savoir que « la pagination existe » ne dit pas qu'une ligne teste `== 200` au lieu
de `in (200, 206)` et rate une page sur deux, silencieusement.

**Deuxième compétence, non nommée par lui et ajoutée au marché** : reconnaître une vraie
preuve. La migration du jour était validée par l'analyseur officiel de PostgreSQL et
créait pourtant des tables illisibles par le serveur. Son seul garde-fou est de pouvoir
demander « tu l'as lancé, ou tu l'as juste relu ? ».

**Signalé une fois, sans y revenir** : beaucoup d'entretiens techniques comportent encore un
exercice en direct. On peut avoir raison sur l'évolution du métier et échouer au filtre.
C'est son arbitrage.

**Accord retenu** : j'écris les requêtes · une note de diagnostic en fin de phase (les
formes de code du projet, ce que chacune dit en français, comment elle casse, le symptôme à
l'écran) · trois questions à la fin de chaque module · une lecture de module à voix haute
par phase.

