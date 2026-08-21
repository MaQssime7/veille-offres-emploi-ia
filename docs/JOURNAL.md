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


## 21 août 2026 — Le pipeline de collecte, et ce que l'API cachait

**Étape 2 sur 6 de la phase 1 livrée.** `pipeline/` existe, tourne contre les
vraies API, et 43 offres réelles sont en base.

### La mesure qui a tout réorienté

Maxime a posé une question de fond avant qu'on code : *si on oublie un mot-clé,
on rate des offres — pourquoi ne pas tout faire lire par le modèle ?* La réponse
demandait des chiffres, pas un avis. Quatre séries de mesures contre l'API réelle
plus tard, trois découvertes, dont une qui invalidait une décision écrite.

**1. `motsCles` n'indexe pas la description.** Test : prendre un mot dans le corps
d'une annonce et le chercher. L'annonce ne remonte pas — 4 fois sur 4.
« polytechnique », présent noir sur blanc, renvoie zéro offre. La recherche porte
sur l'intitulé, le libellé ROME et un champ `competences` qu'on ne connaissait
pas.

Conséquence : `docs/DECISIONS.md` affirmait « la requête API reste large mais
bornée, et le tri est fait par le modèle ». **Faux tel quel** — le modèle ne peut
trier que ce que la requête a ramené, et la requête est aveugle au texte. Corrigé
dans le document, avec la mesure à l'appui.

**2. Le vocabulaire de France Travail est fermé, et français.** Les termes que
Maxime proposait — `IA générative`, `IA agentique`, `agent IA`, `POC IA`,
`intégration IA`, `LLM` — renvoient **tous zéro offre**. `chatbot`, `GenAI`,
`MLOps`, `OpenAI`, `ChatGPT`, `copilot` aussi. Seuls des termes courts et
courants répondent.

**3. `avant-vente` est un piège.** 299 offres — des postes de *Conseiller de
vente*, *Vendeur en animalerie*, *Réceptionnaire Après-Vente Automobile*. Le
moteur coupe le terme et matche « vente ». **Un mot-clé ne s'ajoute jamais sans
mesurer ce qu'il ramène.**

### Correction de cadrage de Maxime

Ma première proposition de mots-clés — `machine learning`, `deep learning`,
`data scientist`, `NLP`, `MLOps` — désignait des postes de **modélisation**. Il
vise les postes qui **branchent un modèle existant chez un client** : Forward
Deployed Engineer, AI Solutions Engineer, consultant IA, ingénieur
d'intégration. Ce n'est pas le même métier ni les mêmes entreprises. Liste
refaite.

### La décision, chiffrée

Trois largeurs de collecte, mesurées sur 7 jours réels :

| | Offres/jour | Notation | Ce qu'on rate |
|---|---|---|---|
| A — mots-clés seuls | 9 | ~0,80 $/mois | Les intitulés banals |
| **B — + familles ROME** (retenu) | ~28 | ~3 $/mois | Ce qui sort des familles informatiques |
| C — tout l'Île-de-France | 1 925 | **~173 $/mois** | Rien |

**B retenu.** Le code ROME est un filtre *structurel* : il attrape « Ingénieur
études et développement » sans dépendre des mots de l'annonce, et le modèle lit
ensuite la description — le travail que la recherche ne sait pas faire.

⚠️ **Honnêteté sur la mesure** : sur la semaine testée, B n'aurait trouvé aucune
offre IA que A ratait. C'est une assurance à 2 $, pas un gain démontré. À
réévaluer quand la veille aura deux semaines d'historique.

### Ce qui a été construit

Cinq modules, un métier chacun : `config.py` (trousseau de clés, échoue au
démarrage jamais au milieu) · `client_france_travail.py` (le seul qui téléphone
à France Travail) · `normalisation.py` (le seul qui jette les données
personnelles) · `stockage.py` (le seul qui écrit en base) · `collecte.py` (le
chef d'orchestre). Plus deux fichiers de critères versionnés et éditables sans
toucher au code.

**Accès à Supabase par l'API REST, pas par connexion Postgres directe** : le
pipeline tournera chez GitHub, et l'accès direct réclamerait en plus le mot de
passe du schéma. Un secret de moins en circulation.

**Fenêtre de collecte auto-cicatrisante** : elle repart de la dernière exécution
*réussie* moins une heure de recouvrement, plafonnée à 30 jours. Trois jours de
panne se rattrapent au lieu de se perdre.

### Une fuite de donnée personnelle trouvée et fermée

Quand Postgres refuse une ligne, PostgREST recopie **la ligne entière** dans le
champ `details` de son erreur :

```
"Failing row contains (mauvais, 7, X, …, Mme Caroline COQUET, https://…, …)"
```

Le journal de GitHub Actions est **public** sur ce dépôt. Une erreur d'insertion
journalisée telle quelle y publierait le nom d'une personne. `stockage.py` ne
garde que le `code` et le `message` ; jamais `details` ni `hint`. **Vérifié en
provoquant la violation** : le message rendu ne contient rien de personnel.

### Migration `competences`

Colonne ajoutée par une migration suivante — la première n'a pas été retouchée.
⚠️ Le champ n'est rempli que sur **6 %** des offres (3 sur 43). Utile quand il
est là, jamais une valeur sur laquelle compter. Il justifie surtout une chose :
il explique *pourquoi* la recherche se comporte comme elle se comporte.

### Vérifié comment

Pas relu — **attaqué**, méthode du 20 août :

| Ce qu'on a tenté | Réponse |
|---|---|
| Collecte réelle contre les deux API | 43 offres reçues, 43 écrites |
| La relancer immédiatement | 0 nouvelle — déduplication par le moteur |
| Identifiant mal formé, description vide, date absente | Écartés à la normalisation, la nuit continue |
| Clé étrangère inexistante | HTTP 409, message sans donnée personnelle |
| `echec` sans motif · issue inventée | Refusés |
| Identifiants France Travail faussés | `echec` motivé, code 1, aucun `en_cours` |
| Exécution laissée `en_cours` | Refermée au démarrage suivant |
| Lecture des offres avec la clé publiable | **HTTP 401** |
| `contact` dans une archive `charge_brute` | **0 sur 43** — ni courriel, ni adresse, ni téléphone |

**Non vérifié en conditions réelles, et dit comme tel** : le renouvellement de
jeton en milieu de pagination (le jeton dure 25 min, aucune collecte n'y arrive)
et le HTTP 429 (la temporisation de 0,25 s l'empêche). Les deux sont écrits et
relus, pas déclenchés.

### `/code-review` — 15 défauts, dont un que je venais d'introduire

Le module a été relu par un agent de revue. **Rien n'a été annoncé avant.**
Sept défauts touchaient la correction ou la sécurité :

| Défaut | Ce qui serait arrivé |
|---|---|
| **Journal d'une offre brute** (que je venais d'ajouter en « corrigeant » autre chose) | Une offre sans identifiant faisait journaliser le dict brut — `contact` non encore retiré. **Nom et courriel publiés dans un journal GitHub Actions public.** Remplacé par un compteur |
| **HTTP 204 en milieu de pagination** | Page 1 rend 150 offres, page 2 rend 204 (offres dépubliées entre deux appels) → `return []` jetait les 150. Le journal disait « aucune offre », indistinguable d'une nuit calme |
| **`--sans-ecrire` écrivait** | Il appelait `refermer_executions_orphelines`, un PATCH. Lancé pendant la collecte nocturne, il marquait l'exécution vivante en `echec` — puis concluait « Rien n'a été écrit » |
| **Plafond de pagination testé sur le mauvais compteur** | Le plafond porte sur l'index demandé, pas sur les offres reçues. Dès qu'une page rendait moins de 150 résultats, un `range` au-delà de 1149 partait → HTTP 400 → **toute l'exécution en échec**, les 10 autres critères perdus |
| **Refermage des orphelines sans seuil d'âge** | Un lancement manuel pendant le cron déclarait `echec` une exécution vivante, avec un motif mensonger. Seuil posé à 6 h |
| **`_erreur_assainie` plantait sur un corps non-objet** | Un 502 dont le corps est `["gateway error"]` levait une `AttributeError` **depuis le gestionnaire d'erreur**, effaçant la panne d'origine |
| **`fermer_execution` ne vérifiait rien** | Un PATCH qui ne touche aucune ligne renvoie 204 — succès apparent. Job GitHub au vert, aucune trace en base |

Quatre autres corrigés : HTTP 429 sans réessai (un 429 sur le 9ᵉ critère jetait
les 8 déjà collectés) · `Content-Range` absent qui tronquait en silence ·
`--depuis-jours` négatif ou nul non validé · horloge murale au lieu de
monotone dans la temporisation.

Deux relevaient de la conception, corrigés aussi : le garde-fou `NEXT_PUBLIC_`
était posé dans le pipeline, qui ne rend aucune page — il ne protégeait rien et
pouvait annuler la collecte pour une variable étrangère au projet ; les délais
réseau et la région étaient dupliqués entre modules.

**Une migration en plus** : `offres_rejetees`. Les motifs de rejet étaient
calculés puis jetés (`lignes, _ = normaliser_lot(...)`). Une nuit à 12 rejets
sur 40 enregistrait un écart indistinguable de 12 doublons. Le commentaire de
`offres_recues` a été précisé au passage : ce sont les offres **distinctes**,
après union des critères.

**Un défaut reste, sans correctif propre** : l'écriture par lots de 50 n'est pas
atomique, et l'API REST n'expose pas de transaction. Si le lot 3 échoue, les
lots 1 et 2 sont écrits et rattachés à une exécution marquée `echec` — ces
offres ne seront jamais « nouvelles » sur aucun écran. Le compte partiel est
désormais remonté dans le motif d'échec, faute de mieux. À rouvrir si le cas se
produit.

**Corriger a introduit un bug de plus, trouvé en exécutant** : le `+` de
`+00:00` dans une chaîne de requête est interprété comme une espace, et Postgres
refusait la date du seuil d'ancienneté. Invisible à la relecture. Et mon premier
correctif du plafond de pagination était lui-même faux — il demandait encore
l'index 1199. Vérifié sur trois tailles de page avant d'être déclaré bon.

**État final** : 67 offres réelles en base, 4 exécutions tracées, compteurs
justes.

### Le recollage des offres orphelines — et un bug d'horloge trouvé en le testant

**Décidé avec Maxime le 21 août 2026.** Le défaut « écriture par lots non
atomique » laissé sans correctif est refermé.

**Le problème, reformulé.** Une nuit écrit 100 offres puis échoue. Les 100 sont
en base, rattachées à une exécution `echec`. Or « Nouveau » se définit par
l'appartenance à la dernière exécution *réussie* : ces offres n'apparaissent sur
aucun écran du matin, et la nuit suivante ne les réécrit pas
(`on conflict do nothing`). **Invisibles pour toujours.**

**La piste écartée, proposée par Maxime** : définir « Nouveau » par une date
plutôt que par le lien. Écartée pour les raisons déjà écrites au `PLAN.md` —
deux exécutions le même jour mélangeraient une collecte ratée avec une réussie,
et une offre cesserait d'être nouvelle toute seule au bout de 24 h, même jamais
regardée. L'offre ne porte d'ailleurs aucune date de collecte : c'est le lien
vers l'exécution qui la porte.

**Le correctif retenu** : `recoller_offres_orphelines()`. Au terme d'une
collecte aboutie, les offres pointant vers une exécution `echec` sont rattachées
à l'exécution en cours. Elles apparaissent le lendemain, avec un jour de retard.
Idempotent — une fois recollées, elles pointent vers une réussite et ne sont
plus reprises.

⚠️ **Contrepartie assumée** : on réécrit l'histoire. L'offre a été *trouvée* par
l'exécution ratée, on note qu'elle l'a été par la suivante. Le lien sert à
décider ce qui s'affiche le matin, pas à établir une chronologie ; l'archive
`charge_brute` garde la réponse d'origine.

**Les deux mécanismes se composent** : une exécution tuée net reste `en_cours`,
`refermer_executions_orphelines` la passe en `echec` au bout de 6 h, et le
recollage la ramasse la nuit d'après.

#### Le bug d'horloge, trouvé en écrivant le test

Le test du recollage a fait sauter la contrainte `terminee_apres_demarree`.
Cause : `demarree_a` a pour valeur par défaut le `now()` de **Postgres**, et
`terminee_a` était posé avec `datetime.now()` de **la machine locale**. Mesure du
21 août : cette machine est **186 ms derrière** le serveur Supabase.

Conséquence en production, pas seulement en test : **toute exécution bouclée en
moins de 186 ms** — une nuit calme sans nouvelles offres — voyait sa fin
précéder son début et se faisait refuser. La collecte partait en échec pour une
nuit parfaitement normale.

Corrigé en confiant les deux horodatages au serveur : la chaîne `'now'` est une
valeur spéciale que Postgres résout lui-même à l'heure de la transaction.

**Leçon transférable** : comparer deux horodatages venus de deux horloges
différentes est un bug, même quand les deux horloges sont « à l'heure ».
Invisible à la relecture, invisible en développement quand la collecte dure
plusieurs secondes, et il ne se serait manifesté qu'une nuit sans offres — la
nuit où on aurait justement conclu « rien n'est arrivé ».

### Remplissage manuel sur 7 jours, et un cas de test retiré

**189 offres réelles en base** après `--depuis-jours 7`. Maxime a préféré 7 jours à 30,
pour deux raisons dont une seule tient à la mesure.

*Son argument sur les offres périmées n'est pas confirmé* : l'API ne renvoie que les
offres encore actives, et les annonces de six jours reviennent en nombre (35, autant
qu'aujourd'hui). Trente jours auraient donné ~800 offres, toutes vivantes.

*Son argument de coût tient, mais il est petit* : noter 189 offres coûtera ~0,60 $ contre
~2,40 $ pour 800. Le vrai bénéfice est ailleurs — **relire 189 notes pour juger si le
modèle note juste, c'est quatre fois plus rapide que 800.**

**Un cas du contenu de test retiré, sur décision de Maxime** : « l'intitulé le plus long
que France Travail puisse renvoyer, environ 150 caractères ». Il n'existe pas. Maximum
mesuré : **99 caractères** sur 235 offres le 20 août, **79** sur 189 le 21 août. Ne pas
fabriquer un cas que la source ne produira jamais. Ce qui reste dû : vérifier la mise en
page à 375 px contre l'intitulé le plus long *réellement observé*.

**Contenu de test acquis, mesuré, à ne pas rechercher** : 5 descriptions à exactement
5 000 caractères (le plafond de l'API) · la plus courte à 419 · 6 formes de salaire plus
l'absence · **34 % des offres sans nom d'entreprise, 69 % sans salaire** — le vide est le
cas normal · CDI 149, CDD 10, intérim 18.

### Où en est le projet au soir du 21 août

**Fait** : le schéma (2 tables, 4 migrations), le pipeline de collecte (5 modules,
1 166 lignes), 189 offres réelles en base, 8 exécutions tracées.

**Prochaine étape** : la porte — `/connexion`, `proxy.ts`, session. Étape 3 sur 6 de la
phase 1. C'est la première brique dont un défaut laisse le site ouvert.

**Non commité** : tout le travail du 21 août est sur disque, pas dans git.

---

## 21 août 2026 — La porte

Étape 3 sur 6 de la phase 1. Première brique de l'interface dont un défaut
laisse le site ouvert : le site est en ligne depuis le 17 août, et la base
contient désormais 189 offres réelles.

### Ce qui a été construit

| Fichier | Métier |
|---|---|
| `interface/lib/session.ts` | Fabriquer le cookie, le relire, vérifier le mot de passe. **Sans aucune dépendance à Next.js**, pour être importable par le proxy comme par les pages |
| `interface/lib/acces.ts` | `sessionOuverte()` et `exigerSession()` — la serrure, côté page |
| `interface/proxy.ts` | La porte au niveau du réseau |
| `interface/app/connexion/` | L'écran, son action serveur, son état |

### Une session sans base de données

Le cookie contient sa propre échéance et une signature HMAC-SHA256 calculée
avec un secret serveur : `échéance.signature`. Le serveur ne stocke rien — il
recalcule la signature et refuse si elle ne colle pas.

L'alternative, un jeton en base, aurait coûté une table et une requête à chaque
page pour un seul utilisateur qu'on n'a jamais besoin de déconnecter à
distance. Rien d'autre ne voyage dans le cookie : il n'y a pas d'identité à
transporter.

**Session glissante** : le critère dit « 30 jours **d'inactivité** ». Le proxy
réémet le cookie dès qu'il a plus d'un jour. Sans ça, les 30 jours auraient
compté depuis la connexion, et une session utilisée tous les matins aurait
quand même expiré au trentième jour.

### Deux décisions prises contre la documentation

**1. Aucun `matcher` dans `proxy.ts`.** La documentation officielle de Next 16
montre `export const config` dans `proxy.ts`, là où notre `CLAUDE.md` et la
skill `next-best-practices` annoncent `proxyConfig`. Impossible de trancher
sans essayer — alors on n'a pas parié : sans matcher, le proxy s'exécute sur
*toutes* les requêtes et c'est le code qui écarte les exceptions.

Se tromper de nom de constante devient alors sans conséquence. Avec une liste
blanche d'adresses protégées, la même erreur aurait ouvert le site en silence.
Bénéfice observé immédiatement : `curl` sur `/api/enrichissements/190MTLR/etapes`,
une adresse qui **n'existe pas encore**, renvoie déjà 307 vers la porte.

**2. `node:crypto` et non Web Crypto.** Le proxy de Next 16 tourne en runtime
Node.js et **cela n'est pas configurable** — c'est `middleware.ts` qui tournait
en Edge. Le plan de séance annonçait Web Crypto par prudence ; vérification
faite dans la documentation, c'était inutile.

### La serrure n'est pas dans le proxy

`proxy.ts` redirige joliment, mais un middleware Next.js a déjà été
contournable par un simple en-tête HTTP (CVE-2025-29927, corrigée depuis). La
vérification qui compte est donc `exigerSession()`, appelée **dans** la page,
au plus près de ce qui s'affiche. `app/page.tsx` a été rebasculée en composant
serveur pour pouvoir l'appeler ; la page de contrôle de `/installe` est
descendue dans `app/_controle/`, un dossier privé hors routage.

### Le vrai vecteur d'attaque, et il n'est pas celui qu'on croit

En relisant, la justification « le proxy peut être contourné par un en-tête »
(CVE-2025-29927) est vraie mais faible : la faille est corrigée. La raison
concrète est ailleurs, et elle est structurelle.

**Une action serveur ne s'invoque pas par son adresse à elle**, mais par un
`POST` portant un en-tête `Next-Action` sur une route. Or `/connexion` est la
seule route que le proxy laisse passer sans cookie.

**Mesuré plutôt que supposé** — j'avais d'abord écrit que n'importe quelle
action serait appelable depuis n'importe quelle route. Le test dit autre chose :

| Requête | Résultat |
|---|---|
| Action de `/zztest` postée sur `/zztest`, sans session | **307** — le proxy bloque |
| Action de `/zztest` postée sur **`/connexion`**, sans session | **200, action non exécutée** |
| Action de `/zztest` postée sur `/`, sans session | **307** |
| Action de `/zztest` postée sur `/zztest`, **avec** session | 200, action exécutée |

Next 16 porte un **manifeste d'actions par route** : une action déclarée
ailleurs ne s'exécute pas sur `/connexion`. La surface est plus étroite que
craint.

⚠️ **Elle se rouvre dans deux cas**, et c'est pour ça que la règle tient quand
même : dès qu'un composant partagé rendu par `/connexion` — un en-tête commun,
demain — importera une action sensible, celle-ci entrera dans le manifeste de
`/connexion` · et ce cloisonnement est un détail d'implémentation de Next, pas
un contrat de sécurité documenté sur lequel s'appuyer.

Aucune action sensible n'existe encore — `connecter()` *est* la porte. Mais le
jour où « Enrichir cette offre » sera écrit, une action sans `exigerSession()`
en première ligne sera **déclenchable par un robot, aux frais de Maxime**.
Règle inscrite dans `CLAUDE.md` et dans l'en-tête de `lib/acces.ts`.

### Le bug que seule une capture d'écran a révélé

Le champ de mot de passe s'affichait **encadré de rouge dès le chargement**,
sans qu'aucune erreur ne soit survenue.

Cause : `app/connexion/actions.ts` porte la directive `"use server"`, qui
transforme **tout** ce que le fichier exporte en référence appelable à
distance — y compris une constante. `ETAT_CONNEXION_INITIAL` n'arrivait donc
pas au navigateur avec sa valeur, `etat.erreur` valait `undefined` au lieu de
`null`, et l'attribut `aria-invalid` était émis.

**Ni TypeScript ni `next build` ne l'ont signalé.** Correction : le type et la
constante vivent maintenant dans `app/connexion/etat.ts`, un fichier ordinaire.

Second piège dans la même ligne : le variant `aria-invalid:` de Tailwind réagit
à la **présence** de l'attribut, pas à sa valeur. `aria-invalid={false}` aurait
donc quand même déclenché le style d'erreur — d'où le `|| undefined`.

**Leçon transférable** : une directive de frontière (`"use server"`,
`"use client"`) change la nature de *tout* ce que le fichier exporte, pas
seulement des fonctions qu'on avait en tête en l'écrivant.

### Vérifié comment

**Cryptographie du cookie** — 7 cas, script Python qui forge des jetons avec le
vrai secret :

| Cas | Résultat |
|---|---|
| Jeton légitime | HTTP 200 |
| Un caractère changé dans la signature | 307 |
| Échéance repoussée à 10 ans, signature d'origine | 307 |
| Jeton bien signé mais expiré hier | 307 |
| Cookie vide · sans séparateur · échéance non numérique | 307 |

**Parcours au navigateur**, joué en développement **et** sur le build de
production (`next start`) :

- `/offres?statut=candidate` sans cookie → `/connexion?suite=%2Foffres%3Fstatut%3Dcandidate`
- Mauvais mot de passe → message affiché, **aucun cookie posé**, champ vidé
- Cinq tentatives ratées : 1362 / 1367 / 1376 / 1387 / 1384 ms
- Bon mot de passe → atterrissage sur `/offres?statut=candidate`, la destination mémorisée
- Cookie : `httpOnly` · `SameSite=Lax` · `path=/` · **`secure=true` en production**, `false` en développement · échéance à 30 jours · **invisible au JavaScript de la page** (vérifié via `document.cookie`)
- `?suite=https://exemple-pirate.test/vol` → atterrit sur `/`, la redirection ouverte est neutralisée
- Session glissante : cookie de 12 h non renouvelé, de 2 jours et de 25 jours renouvelés

**Trois moments de clic**, parce qu'un formulaire ne se soumet pas de la même
façon selon l'état du JavaScript :

| Moment | Résultat |
|---|---|
| **JavaScript désactivé** (repli progressif de React) | Message affiché, **aucun cookie posé** — la porte tient |
| Clic **avant** l'hydratation | `POST 200`, message affiché, aucun cookie |
| Clic après hydratation | Message affiché sans rechargement de page |

⚠️ Une première mesure de ce cas a donné un faux négatif : le navigateur avait
atterri sur un **second serveur Next du même projet**, laissé ouvert sur le port
3999 par une autre session. Vérifier l'hôte *et* le port d'une URL de test avant
de conclure à un défaut.

**Secrets manquants** (le cas « variable oubliée chez Vercel ») — serveur de
production relancé avec `.env.local` mis de côté : `/` renvoie toujours 307. La
porte se ferme, elle ne s'entrouvre pas. En isolation, `motDePasseCorrect()`
lève `ConfigurationManquante` sur un mot de passe absent, vide, ou de moins de
16 caractères — sans ce plancher, une variable oubliée aurait ouvert le site
**sur un champ vide**.

**Accessibilité et rendu**, à 375 px et en 1280 px, mode clair et mode sombre :

- Aucun débordement horizontal (`scrollWidth` = `innerWidth` = 375)
- Contrastes recalculés dans la page, sur canvas parce que les couleurs
  calculées sortent en `oklab` : message d'erreur **6,15:1** en clair et
  **4,85:1** en sombre · libellé 15,76 / 14,13 · texte d'aide 6,67 / 7,40 ·
  bordure de champ 6,15 / 4,83 (exigé 3:1) · bouton 11,07 / 11,67
- Focus clavier visible sur le champ et sur le bouton
- État de chargement : bouton désactivé, « Vérification… », champ figé sans
  perdre la saisie
- Console : **aucune erreur** sur `/connexion` ni sur `/`. La seule erreur
  observée est un 404 sur `/offres`, qui n'existe pas encore

### Deux à-côtés, tranchés en passant

**Le mode sombre n'avait aucun mécanisme** : la palette existait sous une classe
`.dark` que rien ne posait. Il suit désormais la préférence du système, par un
script de six lignes exécuté avant la peinture — sans lui, l'écran clignoterait
en clair avant de basculer. Pas de bascule manuelle : le PRD n'en demande pas.

**Un champ d'identifiant masqué** a été ajouté au formulaire. Chrome se
plaignait en console, et sans lui les gestionnaires de mots de passe
enregistrent une fiche bancale.

### `/code-review` — quatre défauts, tous corrigés

**1. Le focus clavier retombait sur `<body>` après une tentative ratée.** Le
champ portait `disabled={enAttente}` : React vide le formulaire, le champ
désactivé perd le focus, et plus rien n'est sélectionné. Il fallait re-cliquer
pour réessayer — et sur téléphone le clavier se referme. Corrigé : `readOnly`
au lieu de `disabled` (le champ reste dans l'ordre de tabulation, le bouton
désactivé suffit à empêcher une double soumission) et un effet qui ramène le
focus dans le champ. Vérifié : focus dans le champ pendant *et* après la
vérification, et la frappe reprend sans re-cliquer.

**2. Un `POST` d'action serveur sans session était redirigé en 307 — donc perdu.**
Le navigateur suivait la redirection jusqu'à `/connexion`, qui répondait `200`
avec un corps vide : le bouton cliqué ne faisait **rien du tout**, sans erreur
ni renvoi vers la porte. Le cas est réel : session expirée pendant la nuit,
onglet resté ouvert, clic le lendemain matin. Corrigé : le proxy répond
désormais **401** aux requêtes portant `Next-Action`, et ne redirige que les
navigations. Vérifié : `POST` avec `Next-Action` → `401 {"erreur":"session_absente"}`,
`GET` → toujours `307` vers la porte.

**3. `SECRET_SESSION` oublié = le bon mot de passe accepté, puis un 500 opaque.**
`lireJeton` ne lève pas quand il n'y a pas de cookie, donc la porte s'affichait
normalement et le mot de passe était validé — c'est `fabriquerJeton()` qui
échouait ensuite. La porte se fermait, mais au pire moment et sans rien
d'exploitable, **juste avant l'étape 5 qui consiste précisément à poser ces
variables chez Vercel**. Corrigé par `verifierConfiguration()` appelée en tête
de `connecter()`. Vérifié en lançant la production avec `SECRET_SESSION` vide :
message « Le site n'est pas configuré. Variable(s) d'environnement absente(s)
ou trop courte(s) : SECRET_SESSION. », aucun cookie posé.

**4. « Ce fichier ne s'exécute que sur le serveur » n'était qu'un commentaire.**
`destinationSure` est un utilitaire pur qu'un futur composant client aurait pu
importer, tirant tout le module et `node:crypto` dans le graphe du navigateur.
Corrigé par `import "server-only"` en tête de `session.ts` et `acces.ts`.
Vérifié en fabriquant exprès un composant client qui importe le module : le
build échoue avec *« 'server-only' cannot be imported from a Client Component
module »*.

⚠️ **La revue a écrasé `interface/.env.local`** avec ses propres valeurs de test
pour pouvoir lancer le site. Les deux secrets ont été **régénérés** ; aucune
conséquence en production, rien n'étant déployé. Enseignement pour les
prochaines revues : un agent qui a besoin de lancer l'app écrira dans les
fichiers de configuration locaux — ne pas y laisser une valeur qu'on n'a notée
nulle part ailleurs.

### Ce qui n'est pas fait, et pourquoi

**Pas de déconnexion** : il n'existe aucun en-tête de page où loger le bouton.
Elle viendra avec la coquille de l'étape 4.

**Pas de compteur de tentatives**, seulement le délai d'une seconde. En mémoire
il ne survivrait pas à l'hébergement sans état de Vercel ; en base il coûterait
une table pour un seul utilisateur. Ce qui protège réellement est la longueur
du mot de passe : 24 caractères tirés au hasard sont hors de portée d'un
forçage brut même sans aucun délai.

**Les deux secrets ne sont pas encore chez Vercel** — c'est l'étape 5.
`MOT_DE_PASSE_SITE` et `SECRET_SESSION` vivent dans `interface/.env.local`, que
Next lit et que git ignore. ⚠️ Ce fichier est distinct du `.env` de la racine,
qui appartient au pipeline Python : deux périmètres de secrets, deux fichiers.
