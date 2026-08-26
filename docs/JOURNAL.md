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

### Où en est le projet à ce moment de la journée

**Fait** : le schéma (2 tables, 4 migrations), le pipeline de collecte (5 modules,
1 166 lignes), 189 offres réelles en base, 8 exécutions tracées.

**Prochaine étape** : la porte — `/connexion`, `proxy.ts`, session. Étape 3 sur 6 de la
phase 1. C'est la première brique dont un défaut laisse le site ouvert.

*(Le travail ci-dessus était encore sur disque à cet instant. Il a été commité dans la
foulée — voir l'entrée suivante, écrite le même jour.)*

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

### Où en est le projet à la fin de la séance du 21 août

| | État |
|---|---|
| Schéma | 2 tables sur 4, 4 migrations appliquées. `enrichissements` et `etapes_enrichissement` reportées en phase 6 |
| Pipeline | Collecte livrée, 189 offres réelles, 8 exécutions tracées. **Ne tourne encore qu'à la main** |
| Interface | La porte (`/connexion`, `proxy.ts`, session signée) + la page de contrôle de `/installe`, désormais protégée. **Aucun écran qui lit les offres** |
| En ligne | Vercel déploie, mais **sans aucune variable d'environnement** — le site public n'a donc toujours pas de mot de passe |

**Phase 1, étapes 1 à 3 sur 6 terminées.** Prochaine : l'écran `/offres` et ses quatre
états — le premier qui lit vraiment la base. La coquille qu'il pose devra porter le
bouton de déconnexion.

⚠️ **Trois choses à ne pas redécouvrir en ouvrant la prochaine séance :**

1. **Rien ne doit lire `offres` tant que les variables ne sont pas chez Vercel.** Le code
   de la porte existe, il n'est pas en service. Il en faut quatre : `SUPABASE_URL`,
   `SUPABASE_SECRET_KEY`, `MOT_DE_PASSE_SITE`, `SECRET_SESSION`.
2. **`interface/.env.local` détient l'unique copie des deux secrets du site.** Non
   versionné, nulle part ailleurs.
3. **`ANTHROPIC_API_KEY` est toujours un texte d'exemple** — bloquant pour la phase 2.

---

## 26 août 2026 — Le cron, et six jours de veille perdus

Le pipeline marchait depuis le 21 août. Il ne tournait pas.

En ouvrant la séance, la dernière exécution en base datait du 20 août à 23 h 52.
**Six jours sans collecte** — six jours d'offres que France Travail ne rendra
jamais, sa fenêtre de recherche ne remontant pas indéfiniment. C'est exactement
le risque que le plan avait anticipé en écrivant « allumer le cron dès le premier
jour » ; il a suffi que l'étape 5 s'arrête à moitié pour qu'il se réalise.

Le rattrapage l'a chiffré : **182 offres nouvelles** en une exécution. La base est
passée de 189 à 373.

### Ce qui a été posé

`.github/workflows/collecte-nocturne.yml`, 4 secrets chez GitHub
(`FT_CLIENT_ID`, `FT_CLIENT_SECRET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`),
poussés par un tube depuis le `.env` — jamais en argument de commande, où ils
seraient apparus dans la liste des processus de la machine.

**Quatre décisions qui méritent leur ligne :**

**02:23 UTC, pas 02:00.** GitHub planifie en UTC et ignore l'heure d'été : cela
donne 4 h 23 à Paris en été, 3 h 23 en hiver. Un créneau entre 2 h et 5 h reste
correct dans les deux régimes, ce qu'une heure « fixée à Paris » ne permettrait
pas. Et la minute non ronde évite la file d'attente des crons planifiés à l'heure
pile, que GitHub retarde.

**`concurrency` sans annulation.** Deux collectes simultanées se marcheraient
dessus : chacune referme au démarrage les exécutions restées `en_cours`, et borne
sa fenêtre sur la dernière réussite en base. `cancel-in-progress: false` est
délibéré — annuler celle qui tourne laisserait une ligne orpheline jusqu'au
lendemain. On préfère faire la queue.

**L'entrée de rattrapage manuel passe par l'environnement**, jamais par une
interpolation `${{ }}` posée dans la commande. Interpolée, elle serait recopiée
telle quelle dans le script avant exécution : une valeur comme
`1; curl monsite/$SUPABASE_SECRET_KEY` s'exécuterait comme une commande. Par
l'environnement, le shell la traite comme une donnée. Seul le propriétaire du
dépôt peut déclencher ce workflow — mais un garde-fou qui dépend de qui appuie
n'est pas un garde-fou.

**`permissions: contents: read`.** Ce job lit du code et écrit en base. Il n'a
aucune raison de pouvoir pousser un commit ou ouvrir une issue.

### Ce qui a été vérifié, et comment

Deux exécutions réelles chez GitHub, pas une relecture :

| Chemin | Résultat |
|---|---|
| Fenêtre automatique | 20/08 22:52 → 26/08 12:12 (recouvrement d'1 h appliqué), **182 offres nouvelles**, 0 rejetée, exécution fermée `reussite` en 9,1 s |
| Rattrapage `--depuis-jours 1` | 67 offres présentées, **2 nouvelles** — les 65 autres déjà en base : la déduplication tient |
| Journaux publics | Les 4 secrets apparaissent en `***`. Aucune donnée personnelle : le pipeline ne trace que des comptes et des critères |
| Base | 373 offres, 182 rattachées à l'exécution #25, **0 ligne restée `en_cours`** |

⚠️ **Ce qui n'est PAS prouvé** : que le déclenchement *planifié* se produise. Un
`workflow_dispatch` qui réussit ne dit rien du réveil nocturne. Ça ne se vérifie
qu'au matin du 27 août, en regardant si une exécution est apparue toute seule.

### Un commentaire qui mentait

`pipeline/config.py` justifiait son seuil `AGE_EXECUTION_ORPHELINE_HEURES = 6`
par « le workflow GitHub Actions est lui-même plafonné à 6 h » — un workflow qui
n'existait pas encore, et dont le `timeout-minutes` vaut maintenant 30. Le seuil
reste à 6 h : il n'existe pas pour détecter vite, mais pour ne **jamais** déclarer
`echec` une collecte encore vivante. Seule sa justification a été corrigée.

C'est le genre de dette qu'un dépôt public paie cher : le commentaire était le
seul endroit où la valeur 6 était expliquée.

### Le contenu de test a doublé — remesuré, pas recopié

Les valeurs de `docs/DESIGN.md` avaient été posées contre du contenu inventé, et
les mesures du 21 août portaient sur 189 offres. Sur **373** :

| | 21 août (189) | 26 août (373) |
|---|---|---|
| Sans nom d'entreprise | 34 % | **36 %** |
| Sans salaire | 69 % | **65 %** |
| Sans lieu | — | **0 %** |
| Intitulé le plus long | 79 car. | **94 car.** (médiane 40) |

Les proportions tiennent quand le volume double : **le vide reste le cas normal**,
pas le cas limite. Le lieu, lui, est toujours renseigné — une information neuve,
et une hypothèse de moins à défendre dans la mise en page.

Trois types de contrat seulement (CDI 301, MIS 39, CDD 33), mais **76 formes de
salaire distinctes** en texte libre : la normalisation de la phase 2 aura du
travail.

### Où en est le projet

**Phase 1, étapes 1 à 5 sur 6 terminées.** Reste l'étape 6 : remesurer la mise en
page contre ces 373 offres — pas contre les 189 d'avant — puis `/cloture`.

⚠️ **La dette du 21 août reste ouverte** : `MOT_DE_PASSE_SITE` doit être régénéré.
Non bloquant pour le cron, qui ne touche pas au site ; impératif avant la phase 4.

---

## 26 août 2026 — Rotation des secrets du site

La dette du 21 août est fermée. `MOT_DE_PASSE_SITE` avait fuité dans une
conversation par une sélection dans l'éditeur ; il a été régénéré.

### Ce qui a élargi le geste, et pourquoi ça comptait

La dette demandait littéralement « régénérer le mot de passe ». Ç'aurait été une
**révocation à moitié**.

Un cookie de session est signé avec `SECRET_SESSION`, pas avec le mot de passe.
La porte vérifie le mot de passe **une fois**, à la connexion, puis pose un jeton
qui vaut 30 jours ; ensuite, plus personne ne redemande le mot de passe. Donc
quelqu'un qui aurait utilisé la valeur fuitée pour se connecter **aurait gardé
son accès un mois entier** après le changement de mot de passe — sa session ne
dépend plus de lui.

Les deux ont donc été régénérés. Coût : une reconnexion. Maxime a tranché en ce
sens.

C'est une distinction transférable en entretien : **changer le facteur
d'authentification ne révoque pas les sessions qu'il a déjà émises.** C'est aussi
pour ça qu'un vrai système d'authentification garde une liste de sessions
révocables — ici, avec un seul utilisateur et aucune table de sessions, tourner
le secret de signature *est* le bouton « déconnecter partout ».

### Comment les valeurs ont été produites

Module `secrets` de Python, pas `random` — le premier tire d'une source
cryptographique, le second est prévisible si on connaît son état.

| | Forme | Entropie |
|---|---|---|
| `MOT_DE_PASSE_SITE` | 24 caractères en 6 groupes de 4, alphabet de 32 symboles sans `I`/`O`/`0`/`1` | 120 bits |
| `SECRET_SESSION` | 32 octets en hexadécimal | 256 bits |

`session.ts` impose 16 caractères minimum sur les deux ; la marge est large.

L'écriture dans `interface/.env.local` a été ciblée ligne par ligne, avec
contrôle que le nombre de lignes ne bougeait pas — ce fichier détient l'unique
copie des secrets du site, et un agent de revue l'avait déjà écrasé le 21 août.

Chez Vercel : `vercel env add <nom> <cible> --sensitive --force --yes`, valeur
lue **sur l'entrée standard**. `--value` l'aurait exposée dans la liste des
processus de la machine, lisible par n'importe quel programme local.

### Deux pièges rencontrés

**`vercel env ls` ne prouve rien sur une rotation.** La colonne « created »
affichait encore « 5d ago » juste après l'écrasement : `--force` remplace la
valeur sans réinitialiser la date. Comme les variables *Sensitive* ne sont pas
relisibles, **le seul test possible reste une connexion réelle au site en ligne**
— ce qui prolonge exactement le piège déjà consigné le 21 août.

**La porte ne se teste pas en `curl`.** Le formulaire est un composant client :
Next n'émet aucun champ caché `$ACTION_ID_`, l'action s'invoque par un en-tête
`Next-Action` dont le corps suit un format React interne. Deux tentatives ont
rendu des HTTP 500 qui ne prouvaient rien — ni que le mot de passe était bon, ni
qu'il était mauvais. Un test qui échoue pour la mauvaise raison est pire qu'un
test absent : il ressemble à une preuve.

La sortie a été un script Playwright lancé hors du dépôt, **qui lit les valeurs
dans les fichiers**. C'était la contrainte structurante de toute l'opération :
taper le mot de passe dans un navigateur piloté l'aurait fait entrer dans la
conversation — c'est-à-dire recréer exactement la fuite qu'on réparait.

### Ce qui a été vérifié, sur le site en ligne

| Test | Résultat |
|---|---|
| `/` sans cookie | renvoie vers `/connexion` ✓ |
| **Ancien mot de passe** (le fuité) | **refusé, aucune session ouverte** ✓ |
| Mot de passe arbitraire | refusé ✓ |
| **Nouveau mot de passe** | ouvre, session posée ✓ |
| `/offres` avec la nouvelle session | 200 offres affichées, **console sans erreur** ✓ |

Les offres visibles portent la date du **26 août** : la chaîne complète est
prouvée de bout en bout — cron GitHub → Supabase → site en ligne.

Le plafond de 200 sur 373 offres en base est `PLAFOND_AFFICHAGE` dans
`lib/offres.ts`, une limite voulue et documentée, pas une troncature accidentelle.

Copies temporaires de l'ancien mot de passe : écrasées puis supprimées. Nouveau
mot de passe déposé dans le presse-papiers, jamais affiché.

---

## 26 août 2026 — Clôture de la phase 1

La phase 1 est close. Le site est en ligne derrière son mot de passe, la
collecte tourne toute seule, l'écran des offres lit la base, et les valeurs de
mise en page ne sont plus des suppositions.

### Ce que la clôture a attrapé, et que rien d'autre n'aurait vu

**Un défaut que je venais de créer.** Resserrer la ligne d'offre (`py-4` →
`py-2.5`) sans toucher au squelette de chargement faisait **sauter la page de
56 px** au moment où les offres arrivaient. Ni le compilateur ni le linter ne
bronchent : les deux fichiers étaient cohérents séparément. Le commentaire de
`loading.tsx` promettait pourtant exactement l'inverse — il expliquait que le
cadre était partagé « pour que le contenu réel ne fasse pas sauter la mise en
page ». La promesse valait pour l'en-tête ; la ligne, elle, était recopiée.

**Un défaut invisible au réglage par défaut.** Ma première correction posait les
hauteurs du squelette en pixels durs. Mesuré ensuite : avec une police par
défaut à 20 px — un réglage d'accessibilité courant — le saut revenait à **54 px**,
et à **105 px** à 24 px. Le texte grandissait, la barre grise restait figée.
Corrigé en `rem`. Personne n'aurait trouvé ça par hasard : au réglage standard,
tout allait bien.

**Une divergence documentaire en six endroits.** Décider que les libellés de
notes s'écrivent en toutes lettres a laissé derrière : un critère de la phase 2
qui imposait toujours `INT` / `ACC`, le README de l'interface, la page de
contrôle, et 26 occurrences dans l'aperçu de design — lequel affichait encore la
largeur de 1180 px abandonnée le matin même. Trois sources décrivaient le même
libellé, deux disaient le contraire de la décision.

### La leçon que je retiens

**Un test peut échouer — ou réussir — pour la mauvaise raison, et ça ressemble à
une preuve.** Trois fois aujourd'hui :

| Le test disait | La réalité |
|---|---|
| Contraste de l'intitulé : **1,44:1**, sous le plancher | Le calcul lisait les couleurs `lab()` du projet comme du RGB. Vraie valeur : **14,88:1** |
| Focus du bouton : « indicateur présent » | `box-shadow` n'était pas la chaîne `none`, mais toutes ses couleurs étaient transparentes. Tranché par **comparaison d'images** |
| Police agrandie : saut de **135 px** | Le test posait la police sur `DOMContentLoaded`, après le rendu du squelette. Vrai chiffre : **54 px** — le défaut existait, mon test en exagérait l'ampleur |

Le remède qui a marché à chaque fois : **ne pas croire le nombre, aller chercher
la preuve la plus bête possible.** Comparer deux captures d'écran octet par
octet a tranché la question du focus en une seconde, là où trois lectures de
propriétés CSS m'avaient égaré.

### Ce que la revue de code a apporté

Quinze constats, dont un seul faux — elle affirmait que le squelette sautait
aussi à 375 px, ce que la mesure a démenti (écart de **0 px** : le squelette se
replie exactement comme la ligne). Les quatorze autres tenaient, y compris ceux
que je n'aurais pas trouvés seul : la contradiction arithmétique entre la
largeur figée à 1000 px et la barre latérale de 208 px prévue en phase 4
(1000 − 48 − 208 = 744 px de liste, sous les 820 px où 34 lignes cassent).

**Elle raisonne bien et mesure peu.** C'est exactement l'inverse de ce que je
dois faire : prendre ses raisonnements au sérieux, et aller vérifier moi-même.

### Une décision de conception, prise à cause du défaut

Le rythme vertical de la ligne vit désormais dans `rythme.ts`, importé par la
ligne **et** par son squelette. L'alternative était un commentaire demandant
« pense à reporter la valeur » — c'est ce qui existait, et ça n'a pas tenu une
seule modification. Un garde-fou qui suppose qu'on l'ait lu n'est pas un
garde-fou.

⚠️ Les classes y sont écrites **en entier**, jamais assemblées : Tailwind lit le
code source pour savoir quelles classes produire, et une classe concaténée ne
serait jamais générée — le style disparaîtrait sans aucun message d'erreur.

### Ce qui reste ouvert

| | |
|---|---|
| **Le cron planifié** | Deux exécutions manuelles réussies, mais le réveil de 2 h 23 UTC ne se prouve qu'au matin du 27 août |
| **`PGRST303`** | Reproductible au premier appel après recompilation, **en développement seulement** — jamais observé en production. Symptôme : l'écran affiche « base injoignable » alors que la base va bien |
| **1000 px contre 208 px** | La largeur figée ne laisse pas la place à la barre latérale de filtres. À trancher en phase 4, pas à reconduire |
| **L'en-tête de `/offres`** | Maxime ne l'aime pas. Reporté **après la phase 4**, quand les filtres y auront pris place : le redessiner avant, c'est le redessiner deux fois |

---

## 26 août 2026 — Décisions de cadrage pour la phase 2

Séance de fin de journée, sans code. Trois questions posées par Maxime, trois
réponses chiffrées, et une décision que j'ai contestée avant qu'elle soit prise.

### Où intervient l'API Claude, et ce que ça coûte vraiment

Rappel demandé sur la frontière agent / appel d'API. Elle n'a pas bougé :
**API Messages pour la notation** (une offre entre, deux notes sortent — aucune
exploration), **Agent SDK pour l'enrichissement** en phase 6 (tâche ouverte,
nombre d'étapes inconnu). C'est l'argument d'entretien le plus solide du projet ;
inverser les deux est l'erreur qu'un lead technique repère immédiatement.

Coût mesuré avec les tarifs officiels — pas de mémoire, la référence
`/claude-api` a été chargée pour ça :

| | Brut | + Batches | + cache de prompt |
|---|---|---|---|
| Sonnet 5 (tarif normal) | 9,40 $ | 4,70 $ | **3,46 $/mois** |
| Opus 5 | 15,66 $ | 7,83 $ | 5,76 $/mois |

Sur 30 offres par jour, description médiane de 2 313 caractères. **Noter toute la
base coûte moins qu'un café par mois** — et un test unique sur les 373 offres
revient à **1,35 $**.

Conséquence que je n'attendais pas : **le choix Sonnet 5 contre Opus 5 ne se joue
plus sur le coût**, l'écart étant de 2,30 $ par mois. Il avait été tranché sans
chiffres au cadrage ; à ce niveau de dépense, la seule question qui compte est le
nombre de bonnes offres ratées. Question rouverte pour la phase 2, à décider en
faisant tourner les deux modèles sur les mêmes 50 offres.

### 80 % des offres collectées sont du bruit

Maxime a remarqué que la plupart des offres n'ont rien à voir avec ce qu'il
cherche. Mesuré : **298 offres sur 373 ne contiennent aucun mot du champ lexical
de l'IA**, ni dans l'intitulé ni dans la description.

Les codes ROME en sont la cause, et le plus gros est le pire : **`H1206` ramène
111 offres pour 6 pertinentes — 5 %**, à lui seul 30 % du volume. `M1403` en
ramène 7 pour zéro.

⚠️ **Le fichier `codes_rome.txt` affirmait que ce filet « n'a trouvé aucune offre
IA que les mots-clés rataient ». C'est faux — il en a rattrapé 18.** Mais en les
regardant : « Ingénieur système rf », « Chef de projet médical pharmaceutique »,
« Ingénieur brevets ». Le mot IA est quelque part dans leur description, leur
métier n'a rien à voir. **Le filet attrape, mais il attrape le mauvais poisson.**

**Décision : ne rien retirer maintenant.** La notation *est* le filtre — c'est
tout le propos de la phase 2. Retirer les codes ROME avant, c'est faire à la main
et au lexique ce que le modèle fera mieux ; et après, on disposera d'une mesure
autrement solide, la note d'intérêt réelle par code ROME. Le bruit coûte 2,77 $
par mois, donc l'argument économique ne tranche pas. Le vrai risque est ailleurs :
le **plafond de pagination** de France Travail, qu'un rattrapage de 30 jours
approcherait.

### Effacer la base : contesté, et abandonné

Maxime voulait tester la notation sur 50 offres seulement, « quitte à effacer la
base et n'en garder que 50 » — les offres d'août étant périmées pour quelqu'un qui
postule en octobre.

**Le raisonnement liait deux choses sans rapport** : noter peu et stocker peu. La
notation est incrémentale par construction — « une offre déjà notée n'est jamais
renotée » — donc limiter la notation ne demande aucune suppression.

Quatre raisons contre l'effacement, dans l'ordre où elles pèsent :

1. **France Travail dépublie ses annonces.** Une offre effacée ne se re-collecte
   **jamais**. C'est la raison d'être écrite de la colonne `charge_brute` :
   effacer, c'est détruire ce que cette colonne existe pour protéger.
2. **Ces 373 offres sont le jeu de test, et il venait d'être mesuré le matin
   même** — neuf familles de salaire, dont une (`Horaire …`) présente sur **une
   seule offre**. Ce sont exactement les cas qui feront tomber le normaliseur.
3. **L'écran de suivi d'exploitation** a besoin de l'historique, et un historique
   ne se reconstitue pas.
4. **Le problème se règle tout seul** : ~1 500 offres de plus d'ici octobre, tri
   par date décroissante. Les anciennes descendent d'elles-mêmes.

Et si des offres périmées gênent vraiment à l'écran, **c'est un filtre
d'affichage qu'il faut, pas une suppression**.

Maxime a répondu en réduisant l'échantillon à **5 offres** sans revenir sur
l'effacement — la base reste intacte.

### Ce que je retiens

**Chiffrer avant de discuter.** Les trois questions de la séance portaient sur le
coût, et dans les trois cas le chiffre a déplacé la conversation : le coût ne
justifiait pas de tester petit (mais la relecture, si), ne justifiait pas de
retirer les codes ROME, et ne justifiait plus le choix de Sonnet sur Opus. Une
intuition de prix vaut rarement une multiplication.

**Un commentaire de code peut mentir avec assurance.** `codes_rome.txt`
expliquait clairement pourquoi son filet ne servait à rien — et se trompait. Il
avait été écrit après une mesure honnête sur une semaine ; cinq jours de données
en plus l'ont démenti.

---

## 26 août 2026 — La notation tourne, et les critères de collecte s'effondrent

Séance longue. Elle devait livrer la phase 2 ; elle a livré la notation **et**
démoli la moitié de ce que le projet croyait savoir sur sa propre collecte.

### Ce qui a été construit

Quatre briques, quatre commits, ~60 centimes d'API dépensés sur 5 $.

**La migration 5** — deux notes, deux justifications, un résumé, un salaire
annualisé, la trace de consommation, et une colonne `etape` sur
`executions_veille`. 25 vérifications contre la vraie base : lecture, écriture
d'une notation complète, et violation une par une de chaque contrainte.

Une seule a échoué au premier essai, et c'était mon test qui était faux : j'avais
écrit une heure de fin en heure de Paris contre un début en UTC, et la contrainte
`terminee_apres_demarree` l'a attrapée. Le piège que `timestamptz` existe pour
rendre visible s'est refermé sur moi.

**`pipeline/salaire.py`** — annualisation des 9 formes réelles. Sur 373 offres :
129 montants retenus, 242 absents, **2 écartés comme invraisemblables**. Ces deux
sont faux à la source : « Mensuel de 45000 à 60000 Euros sur 12 mois » (× 12 =
540 000 à 720 000 €/an — et c'est une offre d'ingénieur IA) et « Annuel de 35.0
Euros ». Sans garde-fou, la première aurait été l'offre la mieux payée du site.

Trois comportements possibles, un seul acceptable : parser bêtement fait d'une
faute de frappe la meilleure offre ; requalifier le mensuel en annuel revient à
deviner l'intention de l'employeur, donc à fabriquer de la donnée ; **écarter avec
un motif** laisse le libellé d'origine visible et l'humain tranche. Sur une donnée
d'entrée qu'on ne contrôle pas, une valeur absente est récupérable, une valeur
fausse ne l'est pas — parce que rien en aval ne saura qu'elle est fausse.

**`pipeline/notation.py`** — critères dans un fichier versionné, sortie
structurée, cache de prompt, appels directs et Batches.

**Un bug attrapé avant le premier centime.** Le mode `--sans-appeler` affiche le
prompt exact et compte ses tokens gratuitement. Il a montré que mon filtre de
commentaires, qui retirait les lignes commençant par `#`, **emportait aussi tous
les titres Markdown** du fichier de critères. Le paragraphe définissant la note
d'intérêt arrivait au modèle amputé de son titre : « Elle mesure l'adéquation… »
— *elle* qui ? Prompt grammaticalement correct, notation livrée au hasard, aucune
erreur nulle part. Les commentaires sont passés en `//`.

### L'étalonnage : quand le modèle a raison contre son barème

Premier essai sur une offre, puis trois. Le modèle s'écartait systématiquement du
barème d'accessibilité, toujours vers le bas. Sur une annonce d'administration
réseau marquée « débutant accepté » mais exigeant Cisco, Aruba et Palo Alto, mon
barème commandait 90-100 ; le modèle a mis 40.

**C'était le barème qui avait tort.** Il classait l'expérience exigée en facteur
n°1 et les technologies en n°5. Un employeur qui accepte un débutant accepte un
débutant *de son domaine*. Deux facteurs dominent désormais à égalité — expérience
et adéquation technique — et les repères chiffrés ne valent que pour une pile
familière. Effet vérifié en renotant les mêmes trois offres : l'administration
réseau tombe de 40 à 5, l'ingénierie qualité médicale de 25 à 15, et le poste
Python/IA reste à 45. **Seules bougent les offres dont la pile est étrangère.**

### Le champ qui ment une fois sur deux

Le modèle a écrit « trois ans d'expérience sont exigés » sur une offre dont le
champ `experience_libelle` dit « Débutant accepté ». Vérification faite : le texte
de l'annonce dit « une première expérience, de 3 ans minimum ». Deuxième cas, une
autre offre : champ « 2 An(s) », texte « au moins 3 ans ».

**Sur trois offres vérifiées ligne à ligne, deux ont un champ structuré contredit
par leur propre texte.** Toute logique bâtie dessus — filtre, tri, seuil — sera
fausse une fois sur deux. Et c'est l'argument qui justifie de faire *lire* les
annonces à un modèle plutôt que de les filtrer sur leurs métadonnées : aucune
règle n'aurait attrapé ça, il fallait lire la phrase.

### Puis Maxime a posé la bonne question

« Le code ROME, c'est quand même assez large comme filtre. Il n'y a pas une autre
manière de les collecter ? »

La mesure a donné une réponse que je n'attendais pas, en trois temps.

**Un : les codes ROME collectés étaient les mauvais.** `H1206` = « Management et
ingénierie R&D **industriel** » est un domaine entier, pas un métier. 238 offres
par mois, et sur 17 tirées au hasard, **aucune au-dessus de 8 sur 100**. Il existe
`M1889` = « Ingénieur en Intelligence Artificielle (IA) », un code taillé pour le
projet — **jamais collecté**.

**Deux : ajouter les bons codes n'aurait rien apporté.** M1889 et M1861 ont la
meilleure qualité mesurée de tous les codes (moyennes 21,3 et 17,7 ; c'est de
M1861 que vient la seule offre à 75/100). Leur apport **net** est de zéro : leurs
47 offres mensuelles sont **déjà toutes** ramenées par les mots-clés. La recherche
texte indexe le libellé ROME et l'appellation — une offre classée « Ingénieur en
Intelligence Artificielle » est trouvée par le mot-clé « intelligence
artificielle ». **Un code ROME dont le libellé contient un mot déjà cherché ne
peut rien apporter.** Ce n'était écrit nulle part.

**Trois : le vrai trou était ailleurs, et il était béant.** Le projet cherchait
`IA` depuis dix jours **sans jamais chercher `AI`**. En anglais : 33 offres sur 30
jours, dont **28 qu'aucun autre critère ne trouvait** — *AI Engineer*, *Generative
AI & Agentic Engineer*, *AI Lead Engineer*, *Consultant Data et AI Engineer jeune
diplômé*. Le commentaire de `mots_cles.txt` affirmait que le vocabulaire est
« FERMÉ et FRANÇAIS ». La seconde moitié était fausse et coûtait cher.

Configuration finale : les six codes ROME retirés, `AI`, `GenAI` et `agentique`
ajoutés. Mesuré sur 15 offres tirées au hasard dans la collecte de
reconfiguration, contre les 82 notées sous l'ancienne :

| | Nouvelle config | Ancienne |
|---|---|---|
| Volume | 294 offres/mois | 707 |
| Moyenne d'intérêt | **16,2** | 7,7 |
| Au-dessus de 50 | **7 %** | 1 % |
| Coût de notation | ~1,75 $/mois | ~4,20 $ |

La meilleure offre de la soirée, **« Alternant Ingénieur IA Agentique » à 85/100**,
était invisible avant. Son accessibilité est de 15 — c'est une alternance,
passionnante et hors de portée. Première fois que les deux notes travaillent en
sens opposé : c'est le cas qui valide leur séparation.

### Ce que je retiens

**Deux de mes recommandations étaient fausses, et la mesure l'a dit.** J'ai
proposé d'ajouter M1889 et M1861 : apport net zéro. J'ai annoncé M1805 « le plus
prometteur » : 6,1 de moyenne. Les deux fois j'avais un raisonnement plausible.
Aucun des deux n'aurait été détecté sans mesurer — un raisonnement plausible sur
une API qu'on connaît mal produit des conclusions plausibles et fausses.

**Un échantillon pris par date n'est pas un échantillon.** Les 18 premières offres
notées venaient toutes de la même journée de collecte. Toute conclusion tirée de
là aurait porté sur cette journée, pas sur le gisement. `--au-hasard` est né de
cette gêne, et c'est lui qui rend les mesures de la soirée opposables.

**Une décision prise sans instrument de mesure doit être marquée provisoire.**
L'arbitrage du 21 août sur les deux filets était raisonnable et faux, et il ne
*pouvait pas* être tranché ce jour-là : la notation n'existait pas. Ce qui manquait
n'était pas de la rigueur, c'était l'instrument. Une décision dans cette situation
mérite une date de réouverture, pas seulement une justification.

**Savoir dire ce que la mesure ne dit pas.** Sur 17 offres H1206 sans succès, la
tentation était de conclure « le gisement est vide ». Le calcul dit autre chose :
si le gisement contenait 6 offres pertinentes sur 111, rater les 17 a 36 % de
chances d'arriver. La conclusion honnête était « au plus 15 sur 111, et je ne peux
pas exclure 6 » — ce qui suffisait à décider, sans prétendre à une preuve.

---

## 26 août 2026, dans la soirée — l'écran des deux notes

**Ce qui est livré** : `/offres` affiche les deux notes avec leurs justifications à
plat, classées par intérêt décroissant, et le salaire ramené à l'année quand il
peut l'être. C'est le dernier morceau visuel de la phase 2.

### La question posée avant de coder : dans quel ordre ?

Maxime demandait s'il fallait finir de mesurer les critères de collecte d'abord.
Réponse retenue : **l'écran d'abord, parce que c'est lui l'instrument de mesure.**
Jusqu'ici, juger un mot-clé voulait dire noter un échantillon puis lire les
justifications dans le terminal, une par une. Depuis ce soir, il suffit d'ouvrir la
page : « Conducteur d'engins Polyvalent » noté **0/100** avec sa justification se
voit en deux secondes. Construire les critères avant l'outil qui sert à les juger,
c'était travailler dans le mauvais sens.

Argument secondaire mais réel : mesurer un critère n'est pas gratuit non plus — la
qualité se mesure en notant un échantillon, soit ~9 centimes par terme testé.
Repousser l'écran ne repoussait pas la dépense, ça la déplaçait.

### Ce que la mesure a démenti, trois fois

**1. Les notes ne pouvaient pas aller dans la réserve de droite.** `docs/DESIGN.md`
l'affirmait, mesuré « le 26 août avec des barres simulées ». La mesure était juste
et la conclusion fausse : elle portait sur des **barres nues**. Une justification
fait 145 caractères en médiane — dans les 192 px de la réserve, cela donne dix
lignes. Le bloc est passé pleine largeur, en deux colonnes sous les cartouches.
**Une mesure faite sur une maquette incomplète mesure la maquette, pas la chose.**

**2. « L'intitulé très long n'existe pas » était faux.** Le `PLAN.md` le tenait pour
acquis depuis le 21 août, sur quatre mesures concordantes : 99 caractères au maximum
sur 235 offres, 79 sur 189, 94 sur 373. Sur les **535** d'aujourd'hui : **223
caractères**. Rien n'était erroné dans ces mesures — un maximum observé n'est pas une
borne, c'est un échantillon, et il ne peut que monter. Vérifié à l'écran : 6 lignes à
375 px, rien ne casse.

**3. Le salaire normalisé ne libère pas la largeur de page.** `DESIGN.md` pariait que
la phase 2 raccourcirait le libellé (« 50–60 k€ ») et permettrait de descendre sous
1000 px. Le code est livré et **31 offres sur 535** en bénéficient : l'annualisation
est calculée *pendant la notation*, donc une offre non notée n'a pas de valeur
annuelle, quelle que soit la qualité de son libellé. Le pari couplait deux choses qui
ne le sont pas — une mise en forme qui arrive d'un coup, et un calcul payant qui
arrive au goutte-à-goutte.

### Deux corrections nées de l'écran regardé, pas du code relu

**Le libellé est passé de 104 à 108 px.** « ACCESSIBILITÉ » mesure exactement
100,1 px en Geist Mono. À 104 px il restait 4 px de marge — assez tant que la police
web est chargée, plus rien si elle ne l'est pas encore. L'alignement des barres d'une
ligne à l'autre, qui est toute la raison d'être de cette largeur fixe, serait tombé
sans le moindre signal.

**La piste de la jauge a reçu un filet.** Elle ne contrastait qu'à **1,21:1** avec la
carte. Aucune exigence WCAG ne s'y applique — l'information est portée par le chiffre
— mais à 0, il ne restait littéralement rien à l'écran, et avec elle disparaissait la
longueur commune aux deux barres, celle qui permet de comparer deux offres d'un coup
d'œil.

**Et l'état vide a été dégonflé.** « Pas encore notée » en bloc séparé, avec son filet
et ses marges, coûtait **42 px pour une phrase d'excuse**, sur 103 des 200 lignes
affichées. Ramené en cartouche creux dans la rangée des métadonnées — le même
traitement que « Salaire non précisé » — la ligne non notée reste à 91 px.
**Un état vide ne doit jamais être plus encombrant que l'état plein.**

### Un piège attrapé au bon endroit

`ORDER BY note_interet DESC` place les `NULL` **en premier** en PostgreSQL. Sans
`nullslast`, les 438 offres non notées auraient occupé les 200 lignes affichées et
**aucune offre notée ne serait apparue**. Ni erreur, ni ligne vide : une liste d'allure
parfaitement normale qui n'aurait classé personne. Le piège était écrit dans le
`CLAUDE.md` depuis l'ouverture de la phase — c'est la seule raison pour laquelle il n'a
pas été découvert en production.

Même famille, plus discret : `lireDerniereExecution()` filtre désormais sur
`etape = 'collecte'`. Les notations écrivent leurs propres lignes dans
`executions_veille` ; sans ce filtre, la dernière notation réussie serait devenue « la
dernière exécution » et **plus aucune offre n'aurait porté le marqueur « Nouveau »**,
puisqu'une notation ne collecte rien. C'est le pendant, côté interface, du bug que la
colonne `etape` avait corrigé côté pipeline.

### Ce que je retiens

**Une hypothèse chiffrée marquée ⏳ dans un document n'est pas moins dangereuse qu'un
chiffre inventé — elle est juste mieux signalée.** Les trois démentis de la soirée
portaient tous sur des valeurs écrites, datées et sourcées. Ce qui les a rendues
fausses n'est jamais un défaut de rigueur : c'est que la chose mesurée n'était pas
encore la chose réelle. Le marqueur ⏳ a bien fait son travail — il a dit quand
remesurer.

**Le premier calcul de contraste était faux, et silencieusement.**
`getComputedStyle` rend désormais de l'OKLCH ; un parseur qui lit
`oklch(0.988 0.007 84)` comme un triplet RVB sort des ratios voisins de 1:1 sans lever
la moindre erreur. J'ai failli conclure que la moitié de la palette violait le
plancher d'accessibilité. La parade tient en une ligne : faire convertir la couleur
par le navigateur lui-même, en la peignant sur un canvas de 1 × 1 pixel.

---

## 26 août 2026, tard — la notation passe sur le cron

**Trois choses livrées** : le chemin d'échec exercé pour de vrai, l'API Batches
lancée pour la première fois, et la notation branchée sur GitHub Actions.

### Provoquer un échec sans dépenser un centime

Le critère demandait de vérifier qu'une notation ratée laisse l'offre en base
sans note, avec son motif. Il restait ouvert depuis l'écriture du module :
**0 échec sur 97 appels**, donc un chemin jamais parcouru.

La façon de le déclencher est presque triviale une fois trouvée : demander un
**modèle qui n'existe pas**. L'API répond 404 avant tout traitement, donc
`APIStatusError` est levée et **rien n'est facturé**. Vérifié en base : motif
tracé, note restée `NULL`, compteur de tentatives incrémenté, exécution fermée
en `echec`, code de sortie 1.

**La leçon est réutilisable** : pour exercer un chemin d'erreur d'une API
payante, chercher l'erreur que l'API rejette *avant* de facturer. Une clé
invalide, un modèle inconnu, un paramètre hors bornes — tous gratuits, tous
produisant la même exception que la vraie panne.

### L'API Batches a tourné, et le test ne prouve pas ce qu'il semble prouver

Premier lot déposé, `msgbatch_018yAG…`, une offre. Réussite en **2 min 33**,
là où la documentation annonce jusqu'à une heure. Dépôt, attente, récupération
des résultats, écriture en base, trace d'exécution : tout est validé.

⚠️ **Sauf le point qui compte.** Le module rattache les résultats par
`custom_id` parce que l'API les rend dans un ordre quelconque — apparier par
position donnerait à une offre les notes d'une autre, en silence. Or **sur une
seule offre, les deux méthodes donnent le même résultat**. Le test ne peut pas
distinguer un code correct d'un code faux : il ne prouve rien sur ce point.

**Un test qui ne peut pas échouer ne prouve rien**, et un cas limite de taille 1
est souvent de ceux-là. C'est écrit tel quel dans le `PLAN.md` plutôt que coché.

Mesuré au passage : sur un lot d'une offre, `cache_ecriture` vaut 3 715 et
`cache_lecture` **zéro**. On paie l'écriture du cache sans jamais le relire —
le lot n'est rentable qu'à partir de plusieurs offres.

Coïncidence utile : le lot a noté `212YRCR`, l'offre que l'échec volontaire
avait fait échouer deux fois vingt minutes plus tôt. Remise dans la file
(2 tentatives < 3), elle est repassée et a été notée. **Le cycle échec →
reprise → réussite a donc tourné en conditions réelles sans que personne ne
l'orchestre.**

### Le cron, et le garde-fou qui coûtait 90 centimes

Maxime a tranché : **on ne rattrape pas les 437 offres déjà en base**, on ne
note que ce qui vient d'arriver. D'où un nouveau drapeau `--derniere-collecte`,
qui restreint la notation aux offres de la dernière collecte réussie.

Il résout cet identifiant **par la base**, pas par un canal GitHub Actions. Le
workflow aurait pu faire remonter l'identifiant en sortie de job ; ce serait
coupler les deux étapes par un mécanisme qui n'existe que chez GitHub, donc
casser le lancement à la main. La base est déjà la source de vérité commune :
le producteur y dépose, le consommateur y lit, et chaque étape reste lançable
seule.

⚠️ **Le vrai piège était ailleurs, et il se chiffre.** « La dernière collecte
réussie » désigne une collecte *antérieure* si celle de la nuit échoue. Mesuré
ce soir : la dernière collecte réussie portait alors **146 offres non notées**,
soit environ **90 centimes** payés d'un coup — la nuit où la collecte plante,
c'est-à-dire exactement quand on ne veut pas de surprise.

La parade tient en deux mots de YAML : `needs: collecter` **sans**
`if: always()`. Si la collecte échoue, la notation ne tourne pas du tout. Un
échec réseau ne coûte plus rien au lieu de coûter de l'argent.

Un second plafond, `--limite 60`, borne le `workflow_dispatch` de rattrapage
manuel, qui peut ramener 300 offres d'un coup. Et quand cette limite mord, le
module émet désormais un **avertissement** : avec `--derniere-collecte`, les
offres laissées ne repasseront jamais toutes seules.

### Un défaut trouvé en passant

`--sans-appeler` ignorait **silencieusement** les filtres de sélection.
`--sans-appeler --rome H1206` affichait le prompt d'une offre quelconque, sans
rien signaler. Un aperçu qui ne montre pas l'offre qu'on s'apprête à envoyer
est pire que pas d'aperçu — on croit vérifier, et on ne vérifie rien. Corrigé :
`apercevoir()` reçoit exactement les mêmes filtres qu'`executer()`.

### Ce que je retiens

**Un garde-fou de facturation se conçoit en se demandant ce qui se passe quand
l'étape précédente échoue**, pas quand tout va bien. Le mode nocturne était
correct dans le cas nominal et coûtait 90 centimes dans le cas dégradé — et le
cas dégradé n'était ni rare ni tordu, juste une collecte ratée.

**Une clé d'API se pose dans un secret sans jamais s'afficher.** `printf '%s'
"$(grep '^CLE=' .env | cut -d= -f2-)" | gh secret set CLE` : la valeur passe de
fichier à secret sans transiter par un terminal, une capture d'écran ou une
conversation. Seuls sa longueur et son préfixe ont été montrés, et aucun des
deux n'identifie quoi que ce soit.
