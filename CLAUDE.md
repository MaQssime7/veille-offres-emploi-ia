# CLAUDE.md — Veille offres emploi IA

Lu à chaque session de Claude Code dans ce dépôt. Complète le `CLAUDE.md` global
de Maxime (`~/.claude/CLAUDE.md`), il ne le remplace pas.

## Où trouver quoi

| Sujet | Où |
|---|---|
| **Pourquoi** une décision de cadrage est ce qu'elle est · questions encore ouvertes | `docs/DECISIONS.md` |
| **Schéma de la base** : tables, colonnes, contraintes, et le *pourquoi* de chacune | `supabase/migrations/` — **seule source de vérité, jamais recopiée ailleurs** |
| API France Travail : authentification, pagination, quota, cas limites | `docs/API_FRANCE_TRAVAIL.md` |
| API Anthropic : modèles, paramètres, sortie structurée, cache, batches | référence `/claude-api` |
| Claude Agent SDK : surface d'API | `code.claude.com/docs/en/agent-sdk` |
| Ce que le produit doit faire · ce qu'il refuse de faire | `docs/PRD.md` |
| Identité visuelle : jetons, contrastes vérifiés, composants propres au produit | `docs/DESIGN.md` |
| Dans quel ordre le construire · contenu de test · parcours à repasser | `docs/PLAN.md` |
| Ce qui s'est passé et pourquoi, dans l'ordre | `docs/JOURNAL.md` |
| Conventions Next.js 16 : fichiers, frontières RSC, données, métadonnées | skill `next-best-practices` (`.agents/skills/`) |
| **Comment le site est protégé** : cookie de session, mot de passe, adresses libres | `interface/lib/session.ts` et `interface/lib/acces.ts` — abondamment commentés, **seule source de vérité** |

**Règle de tenue de ce fichier.** Il ne contient que ce qui change mon
comportement sur *n'importe quelle* tâche du projet. Toute référence propre à un
module — paramètres d'API, schémas, procédures — part dans `docs/` avec un
pointeur impératif ici. Une section qui dépasse une vingtaine de lignes de détail
technique doit sortir. Sans cette règle, ce fichier fait 800 lignes dans un mois
et personne ne le lit plus.

## Le projet

Agent de veille quotidienne sur les offres d'emploi dans l'IA. Le pipeline :
récupérer les offres via l'API France Travail → les évaluer contre des critères
de pertinence → présenter un classement dans une interface web.

**Deux usages, pas un seul.** Le projet sert à Maxime pour sa recherche d'emploi
*et* de vitrine technique en entretien — le dépôt est public
(https://github.com/MaQssime7/veille-offres-emploi-ia). Conséquences concrètes :

- Le code sera lu par un recruteur ou un lead technique. Nommage explicite,
  fonctions courtes, pas de fichier fourre-tout.
- L'historique Git compte autant que le code. Commits atomiques, messages en
  français qui expliquent le *pourquoi*.
- Le README est la première chose lue. Il doit rester à jour quand
  l'architecture bouge.

<!-- produit:start -->
## Produit — Veille offres emploi IA

**Le problème** : trier à la main des dizaines d'annonces France Travail chaque
matin pour en garder deux ou trois, rater silencieusement celles dont l'intitulé
est banal, puis passer un quart d'heure par offre à comprendre à qui on a affaire.

**Pour qui** : un utilisateur unique — Maxime, jeune diplômé ENSEA, six mois en
cabinet de conseil IA, en recherche active en Île-de-France, qui consulte dix
minutes le matin et ouvre parfois le site en entretien pour le montrer.

**Hors périmètre, opposable** : mail et notifications · lettre de motivation et
argumentaire de candidature · candidature automatique · toute source d'offres
autre que France Travail · toute zone hors Île-de-France · comptes utilisateurs
et rôles · suivi de candidature avancé (calendrier, relances, CV) · réglage des
critères depuis l'interface · modification manuelle des notes du modèle · analyse
du marché de l'emploi (tendances, salaires, graphiques sectoriels) · application
mobile installable · démo publique à données fictives · traduction et offres hors
France · import de CV et appariement de compétences.

Le PRD fait autorité sur le périmètre : ce qui figure ici ne se construit pas, même
si ça semble une bonne idée sur le moment. Une demande qui tombe dedans se signale
**avant** d'être satisfaite, elle ne se glisse pas dans une phase.

**Évolutions prévues — ni v1, ni refusées.** Deux items, et chacun **contraint la v1
dès maintenant** : ne pas construire l'écran n'excuse pas de ne pas capturer sa
matière.

| Évolution | Ce que ça impose dès la v1 |
|---|---|
| Écran de suivi d'exploitation (exécutions, réussite, durée, coût) | Tracer chaque exécution et chaque enrichissement dès le premier jour, en **compteurs bruts** jamais en euros. Un historique ne se reconstitue pas |
| Conversation avec l'agent **sur une offre enrichie** — challenger sa fiche | Fiche d'enrichissement stockée en **champs séparés**, pas en texte rédigé · identifiant d'offre stable · enveloppe de consommation par offre en **tokens cumulés**, décidée avant la première table |

⚠️ Ne pas confondre l'écran de suivi d'exploitation, prévu, avec l'**analyse du
marché de l'emploi** (tendances, salaires, graphiques), refusée. Et la conversation
ne doit pas devenir la porte de service par laquelle rentre ce que le hors périmètre
refuse.

⚠️ **Ne jamais nommer cet écran « analytics ».** Le mot recouvre les deux à la fois —
celui qui est prévu et celui qui est refusé — et c'est par ce glissement qu'un graphe
de salaires finit par entrer « tant qu'on y est ». Le nom est **écran de suivi
d'exploitation**, et il ne parle que du système : exécutions, réussite, durée,
volumes, consommation. Jamais du marché de l'emploi.

⚠️ **La conversation porte sur *une* offre, jamais sur toute la base.** L'agent
global en page d'accueil a été explicitement refusé le 16 août 2026 et versé au hors
périmètre : son contexte et son coût ne sont pas bornables. Ne pas le réintroduire.

⚠️ **La borne de conversation se compte en tokens cumulés, jamais en nombre de
messages.** Le contexte est renvoyé au modèle à chaque tour : la consommation croît
quadratiquement avec les échanges. À 100 %, la saisie se bloque définitivement sur
cette offre — pas de bouton de réinitialisation, sinon ce n'est plus une borne.

⚠️ **Vocabulaire figé : « enrichissement », jamais « enquête ».** Le terme couvre
l'étape du pipeline, l'action dans l'interface et la fiche produite. Deux mots pour
la même chose finissent en deux tables et deux fonctions.

**Cadrage complet** : `docs/PRD.md` — 37 user stories, 13 critères de succès.
À rouvrir avant toute décision produit.
<!-- produit:end -->

## État actuel (au 21 août 2026, fin de séance)

**La stack est posée. Le schéma est en base. Le pipeline collecte pour de vrai, et depuis le
26 août **le cron GitHub Actions est allumé** — 373 offres réelles en base. La porte est EN
LIGNE et vérifiée. L'écran `/offres` lit la base.**

| Brique | État |
|---|---|
| `interface/` | Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui moteur `radix`. Jetons, polices et rayon du `DESIGN.md` appliqués. **La porte est posée** (`/connexion`, `proxy.ts`, session signée) ; mode sombre branché sur la préférence système. Aucun écran de données |
| Supabase | Projet en région Paris. **`executions_veille` et `offres` créées et alimentées** — 373 offres, 10 exécutions tracées (les identifiants montent à #26 : la séquence Postgres ne se rembobine pas après la suppression des lignes de test). RLS activé, droits vérifiés par 18 contrôles |
| Migrations | **4** dans `supabase/migrations/`, toutes appliquées via `npx supabase` — voir Commandes |
| Vercel | https://veille-offres-emploi-ia.vercel.app · `Root Directory = interface` · fonctions en région Paris. **Les 4 variables sont posées** (Production + Preview, marquées *Sensitive*) et **la porte est en ligne, testée le 21 août** : `/` renvoie 307 vers `/connexion`, le mot de passe ouvre, la session survit au rechargement. CLI lié depuis `interface/` (`.vercel/`, ignoré par git) |
| `pipeline/` | **Collecte livrée et exécutée.** 5 modules, 1 métier chacun. Critères éditables dans `mots_cles.txt` et `codes_rome.txt`. Notation et enrichissement : phases 2 et 6 |
| `.venv/` | Créé à la racine, `requirements.txt` versionné |

⚠️ **Quatre pièges actifs :**

1. La page d'accueil est une **page de contrôle temporaire** posée par `/installe` —
   pas un écran du produit. L'étape 4 la remplace. Ne pas construire dessus.
   ⚠️ Elle vit maintenant dans `app/(site)/page.tsx` — un **composant serveur** qui appelle
   `exigerSession()` puis rend `app/(site)/_controle/page-de-controle.tsx`. En la
   remplaçant, **garder la première ligne** : c'est elle qui referme la porte.
   ⚠️ **Le groupe `(site)` n'est pas de l'organisation, c'est une serrure.** `/connexion`
   est délibérément *hors* du groupe : une action serveur s'invoque par un `POST` sur une
   route, et `/connexion` est la seule que le proxy laisse passer sans cookie. Un
   composant rendu par la porte et important une action sensible la ferait entrer dans son
   manifeste, donc déclenchable sans session. Ne jamais déplacer `/connexion` dans le
   groupe, ni faire rendre l'en-tête par elle.
2. ⚠️ **Poser une variable chez Vercel ne suffit pas : il faut redéployer.** Elles ne
   s'appliquent qu'aux déploiements *suivants*, jamais à celui déjà en ligne.
   ⚠️ **Et un code non poussé n'est pas en ligne, même si les variables y sont.** Le
   21 août, les 3 commits portant la porte étaient restés en local pendant que les
   variables étaient posées : le site public répondait 200 sur `/`, sans mot de passe,
   et `/connexion` renvoyait 404. Vérifier `git log origin/main..main` avant de conclure
   qu'une protection est active.
   ⚠️ Les variables marquées *Sensitive* ne sont **pas relisibles**, même par le CLI :
   `vercel env pull` renvoie `[REDACTED]`. On ne peut donc pas comparer la valeur posée à
   la valeur locale — le seul test possible est de se connecter au site déployé.
   ⚠️ **Une variable listée chez Vercel n'est pas une variable qui marche.** Le 21 août,
   `SUPABASE_URL` et `SUPABASE_SECRET_KEY` apparaissaient dans `vercel env ls` depuis
   quatre jours — posées à la main dans l'interface — et le site déployé répondait
   pourtant « Variable d'environnement absente : SUPABASE_URL ». Les reposer depuis
   `interface/.env.local` via le CLI a tout réglé. Comme *Sensitive* interdit de relire la
   valeur, ce genre de défaut ne se voit **que** sur le site en ligne : après toute
   modification de variable, ouvrir la page et regarder, jamais se fier à la liste.
   ⚠️ Et une variable modifiée ne prend effet qu'au **redéploiement** :
   `npx vercel@59.3.0 redeploy <url-du-dernier-déploiement>` (sans `--yes`, l'option
   n'existe pas sur cette commande).
3. **Un aperçu Vercel parle à la *même* base que la production.** Vercel isole le code,
   jamais les données : une branche qui migre ou supprime touche les vraies données.
4. **Les tables d'enrichissement n'existent pas, et c'est une décision** — voir
   « Base de données » ci-dessous. Ne pas les créer avant la phase 6.

⚠️ **DETTE OUVERTE — `MOT_DE_PASSE_SITE` a fuité le 21 août 2026** dans une conversation,
par une sélection dans l'éditeur (voir § Sécurité). Il n'est ni public, ni dans git, ni
dans un journal, mais il est sorti de son périmètre : **il doit être régénéré.** Décision
de Maxime le 21 août : plus tard, il partait. **À faire à la reprise, et impérativement
avant la phase 4** (notes personnelles) **et la phase 6** (bouton « Enrichir », qui engage
une dépense). La procédure : nouveau mot de passe de 24 caractères par groupes de 4 sans
caractère confondable → `interface/.env.local` → `vercel env rm` puis `env add` sur
Production *et* Preview → `vercel redeploy` → dépôt dans le presse-papiers, jamais à
l'écran.

**En attente :** `ANTHROPIC_API_KEY` du `.env` contient un texte d'exemple, pas une vraie
clé — **bloquant pour la phase 2**, et il empêche déjà de compter les tokens exactement
(les estimations de coût du 21 août sont à ±30 %) · les clés Supabase legacy restent
actives en parallèle des nouvelles, à désactiver maintenant que le cron tourne.

⚠️ **Chez Vercel, exactement 4 variables et pas une de plus** : `SUPABASE_URL`,
`SUPABASE_SECRET_KEY`, `MOT_DE_PASSE_SITE`, `SECRET_SESSION`. `ANTHROPIC_API_KEY`,
`FT_CLIENT_ID` et `FT_CLIENT_SECRET` y avaient été posées le 17 août et ont été **retirées
le 21 août** : le pipeline Python tourne chez GitHub Actions, aucune ligne du site ne les
lit, et les garder offrait la clé Anthropic — qui est facturée — à qui entrerait dans le
compte Vercel. Ne pas les y remettre.

⚠️ **`interface/.env.local` détient l'unique copie des deux secrets du site.** Il n'est pas
versionné et n'existe nulle part ailleurs tant qu'ils ne sont pas chez Vercel. Le supprimer
ou l'écraser oblige à tout régénérer — c'est arrivé le 21 août, un agent de revue l'ayant
écrasé pour lancer l'app.

⚠️ **Un défaut connu, laissé ouvert faute de correctif propre** : l'écriture des offres se
fait par lots de 50 et **n'est pas atomique** — l'API REST n'expose pas de transaction. Si
un lot échoue, les précédents sont écrits et rattachés à une exécution marquée `echec`. Le
recollage (`recoller_offres_orphelines`) les récupère la nuit suivante, et le compte
partiel remonte dans le motif d'échec. À rouvrir si le cas se produit vraiment.

**Les décisions de cadrage, de design et de plan sont acquises — ne pas les rouvrir.**
Elles sont dans `docs/DECISIONS.md`, `docs/DESIGN.md` et `docs/PLAN.md` ; leur histoire et
les arbitrages en chemin sont dans **`docs/JOURNAL.md`**.

**Prochaine étape : la remesure de la mise en page contre le contenu réel, puis `/cloture`** —
étape 6 sur 6 de la phase 1. Les étapes 1 à 5 sont faites.

⚠️ **Le contenu de test a doublé le 26 août : 373 offres, plus 189.** Les mesures de mise en
page du 21 août portaient sur la moitié du volume actuel — les refaire, pas les reprendre.

⚠️ **Le bouton de déconnexion est un composant client** (`_coquille/formulaire-deconnexion.tsx`),
et ce n'est pas un choix de confort : quand la session est tombée, le proxy répond **401** au
`POST` de l'action, et **un `error.tsx` ne rattrape pas cet échec** — mesuré le 21 août, le
routeur le traite au-dessus des frontières d'erreur, qui ne sont jamais consultées. Sans ce
composant, l'utilisateur tombait sur l'écran de secours de Next, en anglais et sans issue.

**On travaille directement sur `main` par défaut.** Le geste complet (brancher, développer,
demander la fusion) a été fait une fois le 17 août 2026 ; seul sur le dépôt, le répéter
n'apporte aucune relecture. Ne pas reproposer de brancher par principe.

⚠️ **Deux exceptions, où je propose de brancher sans qu'on me le demande** : une
**migration de schéma** ou tout changement touchant des données déjà en base · un
**chantier qu'on peut vouloir jeter en entier**. La branche y sert de filet, pas de rituel.

## Collecte — trois faits mesurés, opposables

Mesurés contre l'API réelle le 21 août 2026. Détail et méthode dans
`docs/API_FRANCE_TRAVAIL.md`. **Ne pas les redécouvrir, ne pas les contredire de
mémoire.**

1. **La recherche France Travail n'indexe PAS la description.** Un mot pris dans le
   corps d'une annonce ne la retrouve pas. Elle porte sur l'intitulé, le libellé ROME
   et le champ `competences`. Conséquence directe : une offre au titre banal dont l'IA
   n'apparaît que dans le texte est invisible à **toute** liste de mots-clés. C'est
   pour ça que `codes_rome.txt` existe — un filtre structurel que le lexique ne peut
   pas remplacer.
2. **Le vocabulaire est fermé et français.** `IA générative`, `agent IA`, `POC IA`,
   `LLM`, `GenAI`, `chatbot`, `MLOps`, `ChatGPT` renvoient **zéro offre**. Les
   expressions à plusieurs mots sont pires qu'inutiles : `avant-vente` ramène 299
   postes de vendeur en magasin, le moteur ayant matché « vente ».
3. ⚠️ **Un mot-clé ne s'ajoute jamais sans mesurer ce qu'il ramène.** Ni au flair, ni
   par analogie avec l'anglais. Le script de mesure tient en vingt lignes ; l'erreur,
   elle, pollue la base en silence.

**Les postes visés** sont ceux qui *branchent* un modèle chez un client — Forward
Deployed Engineer, AI Solutions Engineer, consultant IA, ingénieur d'intégration.
**Pas** les postes de modélisation (`machine learning`, `data scientist`, `deep
learning`) : autre métier, autres entreprises. Corrigé par Maxime le 21 août après
que je me sois trompé de cible.

## Base de données — ce qui change mon comportement

**Source de vérité du schéma : `supabase/migrations/`.** Les fichiers sont abondamment
commentés — chaque décision y est expliquée. **Ne jamais recopier le schéma dans un autre
document** : deux descriptions du même schéma divergent toujours.

⚠️ **Une migration déjà appliquée ne se modifie jamais.** Elle est dans la base : la
réécrire ne défait rien et fait diverger git de la réalité. On corrige par une migration
suivante. C'est arrivé le 20 août — voir `docs/JOURNAL.md`.

**Deux tables sur quatre existent** : `executions_veille`, `offres`.
`enrichissements` et `etapes_enrichissement` sont **reportées à la phase 6** — entorse
assumée au critère d'acceptation du `PLAN.md`, validée en séance : leur forme dépend de ce
que l'agent produira réellement, et rien ne les alimente d'ici là.

**Six règles opposables, toutes déjà appliquées :**

1. **`timestamptz` partout, jamais `timestamp`.** GitHub Actions tourne en UTC, le
   navigateur est à Paris : sans fuseau, une collecte de 4 h s'affiche « 02:00 » en été.
2. **Ce qui se calcule ne se stocke pas.** Pas de colonne `duree` (`terminee_a -
   demarree_a`), pas de date de collecte sur l'offre (le lien vers l'exécution la porte).
3. **`NULL` ≠ `false`.** `NULL` veut dire « non renseigné », `false` veut dire « renseigné
   à non ». Un `default false` sur un champ souvent absent fabrique de la donnée qui
   n'existe pas.
4. **La ligne d'`executions_veille` s'écrit au démarrage** (`issue = 'en_cours'`), se
   complète à la fin. Une ligne restée `en_cours` est une exécution tuée net : le pipeline
   les referme en `echec` à son démarrage suivant, et **un `en_cours` ne compte jamais
   comme une réussite** côté interface.
5. **`offres.charge_brute` est une archive, jamais lue pour afficher.** Elle existe parce
   que France Travail dépublie ses offres. Les colonnes extraites sont les seules valeurs
   de travail.
6. **`contact_nom` et `contact_url_postulation` sont en colonnes nommées**, jamais dans
   `charge_brute` — pour rester repérables et supprimables. Tout le reste du champ
   `contact` est **écarté à la collecte**, avant écriture. Voir `docs/PRD.md`
   § « Données personnelles ».

**Autorisation — deux verrous indépendants, vérifiés :** RLS activé sans aucune politique,
*et* tous droits retirés à `anon` et `authenticated`. Une politique ajoutée par erreur
n'ouvrirait donc toujours rien. Seul `service_role` (la clé `sb_secret_…`) a des droits.

## Stack

Tranchée le 16 août 2026. Justifications dans `docs/DECISIONS.md` § 3.

- **Python 3.11+** pour le pipeline, environnement virtuel dédié (voir Commandes).
- **Supabase** (Postgres hébergé) pour la persistance. **Pas SQLite** : une
  interface hébergée ne peut pas lire un fichier posé sur le Mac de Maxime.
- **Next.js + shadcn/ui sur Vercel** pour l'interface.
- **GitHub Actions** (cron) pour le déclenchement quotidien — 6 h de durée par
  exécution contre 300 s chez Vercel, gratuit et illimité sur dépôt public, et le
  workflow est versionné donc visible d'un recruteur.
  ⚠️ **Ne pas justifier ce choix par « Vercel ne fait pas de Python » : c'est faux.**
  Vercel exécute du Python et propose des sandboxes conçus pour les agents, démarrant
  en millisecondes. Ce qu'on laisse sur la table, c'est la latence au clic sur
  « Enrichir » — un arbitrage assumé, pas une impossibilité technique.
- **API France Travail** Offres d'emploi v2 · **API Anthropic** pour l'évaluation.

## Commandes

Le `python3` par défaut de cette machine est celui d'Anaconda (`/opt/anaconda3`).
**Ne pas installer les dépendances du projet dedans** — elles se mélangeraient à
l'installation Anaconda globale et deviendraient impossibles à démêler.

```bash
python3 -m venv .venv          # une seule fois
source .venv/bin/activate      # à chaque nouvelle session de terminal
pip install -r requirements.txt
which python                   # doit afficher .../veille-offres-emploi-ia/.venv/bin/python
```

Si `which python` pointe vers `/opt/anaconda3`, l'environnement n'est pas activé
et toute installation partira au mauvais endroit. `.venv/` est exclu par le
`.gitignore`.

### Lancer le pipeline

```bash
source .venv/bin/activate
python -m pipeline.collecte                   # la collecte nocturne : fenêtre automatique
python -m pipeline.collecte --sans-ecrire     # tout sauf l'écriture, pour vérifier sans risque
python -m pipeline.collecte --depuis-jours 7  # remplissage manuel, N strictement positif
```

Code de sortie **0** = réussite, **1** = échec — c'est lui qui fera rougir le job GitHub
Actions. La trace part en base dans `executions_veille`, dans les deux cas.

⚠️ **Les critères de collecte sont des données, pas du code** : `pipeline/mots_cles.txt` et
`pipeline/codes_rome.txt`. Ils s'éditent sans toucher aux modules — mais **jamais sans
mesurer d'abord ce que le nouveau terme ramène** (voir § Collecte).

### Migrations Supabase

**Le CLI passe par `npx`, pas par Homebrew** — les Command Line Tools de la machine
datent de 2023 et Homebrew refuse de compiler. `npx` évite la mise à jour et épingle la
version dans le dépôt.

```bash
set -a; source .env; set +a          # charge SUPABASE_DB_PASSWORD et le reste
npx supabase@2.115.0 migration new <nom_en_francais>
npx supabase@2.115.0 db push --yes   # applique ce qui n'est pas encore appliqué
npx supabase@2.115.0 migration list  # ce qui est local vs ce qui est en base
```

⚠️ **Ne jamais passer le mot de passe en argument** (`--password …`) : il devient visible
dans la liste des processus de la machine. Le CLI lit `SUPABASE_DB_PASSWORD` depuis
l'environnement.

⚠️ **Sans `set -a; source .env`, la commande attend une saisie qui n'arrivera jamais** et
reste bloquée jusqu'au délai d'expiration.

**Valider une migration avant de la pousser**, avec le vrai analyseur de PostgreSQL :

```bash
.venv/bin/python -c "from pglast import parse_sql; import pathlib; \
  print(len(parse_sql(pathlib.Path('supabase/migrations/<fichier>.sql').read_text())), 'instructions')"
```

⚠️ **Syntaxe valide ne veut pas dire « ça marche ».** Le 20 août, une migration
syntaxiquement irréprochable a créé deux tables que le serveur ne pouvait pas lire.
**Après chaque migration : tenter de lire, d'écrire, et de violer chaque contrainte.**

## API France Travail

⚠️ **Avant d'écrire une ligne du client de collecte, lire
`docs/API_FRANCE_TRAVAIL.md`.** Les paramètres d'authentification, de pagination
et de quota y sont **vérifiés en conditions réelles** — ne pas les rechercher à
nouveau, ne pas les improviser. Les pièges qui font échouer *silencieusement* y
sont documentés avec leur symptôme : scope exact, identifiants dans le corps et
non en en-tête Basic, HTTP 206 sur réponse partielle, plafond de pagination,
déduplication sur l'identifiant de l'offre.

## La partie IA — la frontière est la décision centrale

**Décision de Maxime (15 août 2026) : le Claude Agent SDK est retenu, et
l'objectif d'apprentissage prime.** Ne pas rouvrir cette décision.

Les deux outils coexistent dans ce projet, et les confondre est l'erreur à ne pas
commettre :

| | Ce que c'est | Ce qu'il fait ici |
|---|---|---|
| `claude-agent-sdk` | Claude Code en bibliothèque : boucle d'agent, outils Read/Write/Edit/Bash/Glob/Grep/WebSearch/WebFetch, MCP, sous-agents, permissions | L'enrichissement : une tâche ouverte et multi-étapes sur les offres retenues |
| `anthropic` (API Messages) | Un appel, une réponse structurée | La notation en volume : une offre → deux notes |

**Le placement de cette frontière est l'argument d'entretien le plus fort du
projet.** Un agent posé sur une classification — une entrée, une sortie, aucune
exploration — est plus lent, plus cher et non déterministe pour aucun gain, et un
lead technique qui connaît le SDK le verra. Un agent posé sur une tâche ouverte
— chercher l'entreprise, lire son site, croiser, rédiger une fiche — est
exactement ce pour quoi le SDK existe.

Découpage en trois étapes (collecte / notation / enrichissement) : voir le README
et `docs/DECISIONS.md` § 3. **Validé au cadrage du 16 août 2026** — le comportement
produit de l'enrichissement est fixé dans `docs/PRD.md`.

⚠️ **Avant d'écrire du code Agent SDK, lire la documentation officielle**
(`code.claude.com/docs/en/agent-sdk`). La référence `/claude-api` couvre l'API
Messages et les Managed Agents — **pas** le Agent SDK. Improviser sa surface
d'API produit du code faux. Le SDK fournit la boucle d'agent et les outils,
**pas l'hébergement**.

⚠️ **Avant d'écrire du code appelant l'API Anthropic, charger `/claude-api`.**
Les identifiants de modèles et les paramètres changent ; un identifiant inventé
renvoie une 404.

## Sécurité — non négociable

Les clés de ce projet donnent accès à un compte facturé et à une base de données.

1. **Aucune clé en clair dans le code, jamais.** Les secrets vivent dans `.env`,
   lu via `os.environ`. `.env` est exclu par le `.gitignore` — vérifier la sortie
   de `git status` avant chaque commit ; si `.env` y apparaît, s'arrêter.
2. **Aucune clé dans la conversation, les logs ou un message d'erreur.** Un
   `print(config)` qui affiche le jeton finit dans un terminal, une capture
   d'écran, un dépôt public.
   ⚠️ **Y compris par la sélection dans l'éditeur.** Quand un fichier est ouvert dans
   l'IDE, **le texte sélectionné m'est transmis automatiquement**. Le 21 août 2026, une
   sélection dans `interface/.env.local` a fait entrer `MOT_DE_PASSE_SITE` dans la
   conversation. Ce n'est pas une faute d'inattention, c'est le fonctionnement normal de
   l'intégration — donc la parade est une habitude, pas de la vigilance :
   **ne jamais demander à Maxime d'ouvrir un fichier de secrets, ni de recopier une
   valeur.** Quand il lui en faut une, la déposer dans son presse-papiers
   (`grep '^NOM=' fichier | cut -d= -f2- | tr -d '\n' | pbcopy`) : rien ne s'affiche,
   rien ne transite.
3. **Le dépôt est public.** Des robots scannent GitHub en continu à la recherche
   de clés commitées et les exploitent en minutes, aux frais du propriétaire. Une
   clé poussée par erreur reste dans l'historique Git même après suppression du
   fichier : la **révoquer**, pas seulement la supprimer.
4. **Supabase : deux clés, deux rôles opposés.** La clé **publiable**
   (`sb_publishable_…`) est publique par conception — **inutilisée ici**, puisque le
   navigateur ne parle jamais à la base. La clé **secrète** (`sb_secret_…`, variable
   `SUPABASE_SECRET_KEY`) contourne *toutes* les règles de sécurité — jamais dans une
   variable `NEXT_PUBLIC_*`, jamais dans un composant client, jamais commitée. RLS
   activé sur toutes les tables, et **le navigateur ne parle jamais directement à
   Supabase** : tout passe par le serveur.
   ⚠️ Les anciennes clés `anon` / `service_role` sont l'ancienne génération, **dépréciée
   fin 2026**. Elles restent actives en parallèle tant qu'on ne les désactive pas
   explicitement : quatre accès valides pour deux utilisés. À désactiver dans
   `Settings > API Keys` une fois le pipeline en service.
5. **Aucun déclenchement d'agent accessible publiquement sans garde-fou.** Un
   bouton en ligne qui lance un agent Claude sans protection est une facture
   ouverte : un robot qui scanne les URL peut l'actionner en boucle. Tranché au
   cadrage : le site entier est derrière un mot de passe unique vérifié **côté
   serveur**, couvrant les pages *et* les adresses servant des données — protéger
   la page en laissant l'adresse de données ouverte ne protège rien.
   ⚠️ **Posé le 21 août, trois règles opposables :**
   - **Toute page et toute action serveur appelle `exigerSession()`
     (`interface/lib/acces.ts`) en première ligne** — seule exception, `connecter()`
     qui *est* la porte. Le proxy est la commodité, `exigerSession()` est la serrure.
     ⚠️ **La raison la plus concrète n'est pas la CVE-2025-29927** : une action
     serveur s'invoque par un `POST` avec en-tête `Next-Action` sur une route, et
     `/connexion` est la seule que le proxy laisse passer sans cookie. Une action
     déclarée là s'exécuterait sans session, **sans rien contourner**.
     **Mesuré le 21 août** : Next 16 refuse d'exécuter sur `/connexion` une action
     déclarée dans une autre route (manifeste par route) — mais ça se rouvre dès
     qu'un composant partagé rendu par `/connexion` importera une action sensible,
     et ce cloisonnement n'est pas un contrat de sécurité documenté.
   - **Ne jamais ajouter de `matcher` à `proxy.ts`.** Il protège *tout* par défaut ;
     les trois exceptions sont dans le code. Un matcher rouvrirait la question à
     chaque adresse ajoutée.
   - **Un `POST` d'action serveur ne se redirige jamais** : le proxy lui répond
     **401**. Redirigé, le navigateur suit jusqu'à `/connexion`, reçoit un corps
     vide, et le bouton cliqué ne fait *rien du tout* — sans erreur ni renvoi vers
     la porte. Cas réel : session expirée la nuit, onglet resté ouvert.
   - **`import "server-only"` en tête de tout module qui lit un secret.** Sans lui,
     un composant client peut importer le module et tirer `node:crypto` dans le
     graphe du navigateur ; la panne est alors incompréhensible.
   - **Les secrets du site vivent dans `interface/.env.local`**, pas dans le `.env`
     de la racine, qui appartient au pipeline Python. Deux périmètres, deux fichiers.
     ⚠️ **Un agent de revue qui lance l'app écrit dans ce fichier** — c'est arrivé le
     21 août, les secrets ont dû être régénérés. Ne jamais y laisser l'unique copie
     d'une valeur.
6. **Données personnelles : périmètre restreint et explicite.** Les offres sont
   publiques ; les coordonnées de contact qu'elles contiennent parfois ne le sont
   pas au sens du RGPD. **Deux champs seulement sont conservés**, parce qu'ils
   servent directement à candidater : `contact.nom` et `contact.urlPostulation`.
   Adresses postales (`coordonnees1/2/3`), courriels et tout autre élément
   d'identification sont **écartés à la collecte, avant écriture** — jamais
   filtrés à l'affichage : filtré à l'affichage, un champ est quand même en base
   et dans les journaux. Ces deux champs vivent en **colonnes nommées, jamais
   dans l'archive JSON brute** — une colonne se cherche, s'exclut d'un export et
   se vide d'une requête ; noyée dans un bloc JSON, la donnée voyage partout où
   le bloc voyage. Ils ne sortent pas de la base : ni journal, ni export, ni page
   publique. Les notes personnelles ajoutées par Maxime sur une offre relèvent de
   la même règle — ne pas les exposer, ne pas les journaliser, ne pas les faire
   sortir de la base.
   ⚠️ **Tranché le 20 août 2026 sur mesure, pas sur intuition** : sur 235 offres
   réelles, `contact.courriel` ne contient **aucune adresse** (le champ porte une
   phrase), `contact.nom` est présent sur 9 % des offres et ne nomme une personne
   que dans 3 % des cas. La règle absolue précédente (« pas de données
   personnelles ») interdisait aussi `urlPostulation`, qui n'en est pas une.

Si un secret a déjà été commité : le révoquer côté France Travail / Anthropic /
Supabase **avant** de nettoyer l'historique. Le nettoyage seul ne protège rien.

## Convention de travail

- Français partout : messages de commit, docstrings, noms de variables métier
  (`offres_pertinentes`, pas `relevant_offers`).
- Un module = une responsabilité. `client_france_travail.py`, `evaluation.py`,
  `stockage.py`, `synthese.py` — pas de `main.py` de 400 lignes.
- Toute fonction qui appelle le réseau gère explicitement l'échec. Pas de
  `try/except` nu qui avale l'erreur.

### Capitaliser les notions apprises

Quand Maxime demande de noter une notion technique comprise en séance, elle va dans
**`~/Documents/Coffre Obsidian/Maxime M/Apprentissage/`**, **dans le sous-dossier du sujet**
(`Supabase/`, `Outillage/`… — lister le dossier avant d'écrire, il en crée au fil de l'eau).
Pas dans `docs/` : `docs/` porte le projet, ce dossier porte le savoir transférable.

**Une notion = un fichier.** Ne jamais grouper deux sujets parce qu'ils sont tombés dans la
même conversation : ils ne se relisent pas au même moment. *(Erreur commise le 20 août avec
« CLI, MCP et migrations », découpée en deux à sa demande.)*

**Concises**, il en aura beaucoup. Frontmatter `title` / `tags` / `aliases` · un callout
`> [!tip] En une phrase` en tête · tableaux et blocs de code plutôt que des paragraphes ·
un `> [!danger] Le piège` à la fin · wikilinks vers les autres notes.

**Les tags portent ce que les dossiers ne peuvent pas** — la sécurité traverse la base, le
serveur et le navigateur. Un dossier par sujet principal, plusieurs tags par note.

La version *projet* de la même notion (pourquoi **ce** projet a tranché ainsi) reste dans
`docs/DECISIONS.md`. Les deux se complètent, aucune ne remplace l'autre.

### Répartition du travail — tranché le 20 août 2026

Maxime **n'écrit pas le code**, et c'est une position argumentée, pas un renoncement :
écrire est dévalué puisque l'IA écrit, ce qui compte est de savoir **que ça existe, à quoi
ça sert et comment ça casse**, pour localiser une panne et savoir quoi demander.

Ce que ça m'impose, et qui n'est pas négociable :

1. **Une note de diagnostic à la fin de chaque phase**, dans `Apprentissage/`. Pas une
   explication ligne par ligne — il ne la rouvrirait jamais. Les quelques **formes** de
   code que le projet utilise vraiment · **la phrase française** que chacune dit · **comment
   chacune casse** · **le symptôme à l'écran** de chaque panne.
2. **Trois questions à la fin de chaque module.** S'il bloque sur une, la lecture manque là,
   et il faut le savoir avant l'entretien.
3. ⚠️ **Écrire est dévalué, lire ne l'est pas** — c'est *plus* important qu'avant, puisqu'il
   produit dix fois plus de code. Son propre critère (« savoir où est le problème ») repose
   entièrement dessus. Une lecture d'un module à voix haute par phase.
4. ⚠️ **Ne jamais annoncer qu'une chose marche sans l'avoir lancée.** Son seul garde-fou est
   de pouvoir demander « tu l'as lancé, ou tu l'as juste relu ? ». Le 20 août, une migration
   validée par l'analyseur officiel de PostgreSQL a créé deux tables illisibles par le
   serveur : le défaut n'est apparu qu'en essayant d'écrire.

<!-- design:start -->
## Design — Veille offres emploi IA

**Ce qu'on retient** : un instrument de décision, pas un tableau de bord. On voit
tout de suite quoi lire en premier, et pourquoi.

**Direction** : éditorial technique — décoration intentionnelle, mise en page en
grille stricte, mouvement minimal fonctionnel. Chaud dans la matière (beige papier,
serif, encre brune), froid dans la précision (densité, chasse fixe, filets).

**Polices** : titrage **Fraunces 700** · texte et interface **Geist** · données et
libellés **Geist Mono** · code **Geist Mono**. Une seule fonderie, Google Fonts.
Le serif ne descend jamais sous 20 px — en dessous, Geist.

**Icônes** : **lucide** — figé à l'installation (`shadcn apply --only` accepte
`theme` et `font`, jamais `icon`). **Ne jamais en mélanger un second.**

**Jetons** : `interface/app/globals.css` — c'est la source de vérité. Jamais de couleur en
dur, toujours les jetons sémantiques (`bg-primary`, `text-muted-foreground`). Un
seul `--radius`, les autres en dérivent. Bloc CSS prêt à coller dans
`docs/DESIGN.md`.

**Quatre teintes de signal, un rôle chacune** : brun-encre = action principale et
note d'intérêt · ocre = le temporel (« nouveau », enrichissement en cours) ·
olive = accessibilité et candidaté · brique = erreur et écarté. Une teinte qui sert
à deux choses ne sert plus à rien.

⚠️ **Trois pièges qui ne se voient pas à l'œil**, détaillés dans `docs/DESIGN.md` :
`--border` (filet décoratif, sans exigence) n'est pas `--input` (bordure de champ,
3:1 obligatoire) · `--accent` chez shadcn est la surface de survol, pas une couleur
vive · l'ocre existe en deux valeurs (`--signal`, `--signal-fort`) parce qu'il doit
être clair sous un texte foncé et foncé dans une jauge.

⚠️ **shadcn pose des ombres par défaut** sur `Card`, `Popover` et les menus. Les
retirer : ce produit n'a **aucune ombre**, uniquement des filets. Conséquence, la
hiérarchie repose entièrement sur la typographie.

⚠️ **Le libellé `INT` / `ACC` devant chaque barre de note ne se retire jamais**,
même pour gagner de la place : sans lui l'information tient sur la seule couleur.

⚠️ **Contenu de test réel disponible en base (remesuré le 26 août 2026 sur 373 offres)** — à
utiliser plutôt qu'à réinventer : **36 % sans nom d'entreprise, 65 % sans salaire, 0 % sans
lieu** — le vide est le cas normal, pas le cas limite · 3 types de contrat seulement (CDI 301,
MIS 39, CDD 33) · **76 formes de salaire distinctes** en texte libre, non normalisé (phase 2) ·
descriptions : médiane 2 313 caractères, 17 au plafond de 5 000 imposé par l'API.

⚠️ **Le cas « intitulé très long » a été retiré du contenu de test le 21 août : il
n'existe pas.** Maximum observé **99 caractères** sur 235 offres, **94** sur les 373 en base au
26 août (médiane : 40). Ne pas fabriquer un cas que France Travail ne produira jamais — mais
vérifier quand même la mise en page à 375 px contre l'intitulé le plus long *réellement
observé* : « Ingénieur intégration & validation système (h/f)  aéronautique / spatial /
défense (H/F) », qui porte deux fois la mention (h/f) et une double espace.

**À remesurer en phase 1** : les valeurs de mise en page — largeurs, densité, grille
de colonnes — ont été posées sans écran réel, contre du contenu inventé. Les
confronter à du contenu long et réaliste dès la première tranche livrée, puis les
figer. Tout le reste du système est opposable dès maintenant.

**Interdits sur ce projet** : Inter, Roboto, Poppins, Montserrat, Space Grotesk et
les autres polices sur-utilisées · Instrument Serif (un seul poids, le gras y est
synthétique) · dégradé violet · boutons en dégradé · trois colonnes d'icônes dans
des ronds colorés · tout centré · arrondis en bulle · `system-ui` en titrage.

**Plancher d'accessibilité, opposable** : texte 4,5:1 · interface 3:1 · focus
clavier toujours visible · mouvement coupé sous `prefers-reduced-motion` · jamais
l'information par la seule couleur. Un choix qui casse ça est un défaut, pas un
parti pris. **Recalculer les contrastes à chaque changement de couleur** —
`docs/design-preview.html` le fait dans la page.

**Détail et justifications** : `docs/DESIGN.md`

<!-- archi:start -->
## Architecture — Veille offres emploi IA

**Stack** : Python 3.11+ (`pipeline/`) · Next.js + shadcn/ui sur Vercel (`interface/`) ·
Supabase/Postgres dès le premier jour · GitHub Actions (cron nocturne + déclenchement des
agents) · mot de passe unique, ni comptes ni rôles · API France Travail v2 ·
**`claude-sonnet-5`** pour la notation (cache de prompt + Batches) · Claude Agent SDK pour
l'enrichissement.

⚠️ **Next 16 a renommé `middleware.ts` en `proxy.ts`** (et `config` en `proxyConfig`).
Plus largement, ses conventions ont bougé : **avant d'écrire du Next.js, s'appuyer sur la
skill `next-best-practices`** plutôt que sur des réflexes de Next 14.

**Frontend** : template `next` · moteur des composants **`radix`** · pas de monorepo ·
icônes lucide — **figés à l'installation**. ⚠️ Vercel doit être réglé sur
`Root Directory = interface`.

**Routes** : `/` le compte rendu de la nuit · `/offres` le poste de travail (filtre de
statut dans l'adresse) · `/offres/[identifiant]` la fiche · `/connexion` la porte.
L'identifiant est celui de France Travail, **validé avant d'atteindre la base**.

**Schéma, cible à terme** : `executions_veille` · `offres` · `enrichissements` · `etapes_enrichissement`. ⚠️ **Seules les deux premières existent** — voir § « Base de données », et `supabase/migrations/` pour ce qui est réellement en base.
Pas d'accents dans les noms. Une offre est rattachée à l'exécution qui l'a trouvée ; elle a
**au plus un** enrichissement (une relance remplace la fiche). Deux compteurs de tokens sur
l'offre : `tokens_cumules` et `tokens_conversation`.
**La colonne qui dit à qui la donnée appartient : aucune, délibérément** — un seul
utilisateur, une seule porte ; une telle colonne porterait la même valeur partout et
donnerait l'illusion d'un contrôle.

**Autorisation, opposable** : RLS activé sur toutes les tables, **aucune politique** ; le
navigateur ne parle jamais à Supabase. Un **`proxy.ts`** unique protège **tout par défaut**,
avec trois exceptions en liste blanche — énumérer les adresses à protéger laisserait toute
adresse ajoutée plus tard ouverte sans rien signaler. Une seule fonction fait le contrôle,
tous les accès passent par elle — recopier la vérification garantit qu'un accès finira par
être oublié. **Un écran qui masque un bouton ne protège rien : le contrôle qui compte est
côté serveur** (le double clic sur « Enrichir » se bloque en base, pas sur le bouton).

**Enrichissement** : **exclusivement manuel** — rien ne s'enrichit sans un clic, et
l'automatique nocturne est en Évolutions prévues, pas au hors périmètre. Une **enveloppe
quotidienne de 300 000 tokens** borne la dépense : fichier de configuration versionné,
**vérifiée côté serveur**, calculée en sommant les traces du jour et non dans un compteur
qui divergerait. **La notation nocturne n'y entre pas** — la borner ferait rater des offres
un matin de forte collecte.

**Secrets** : `.env` local non versionné · secrets GitHub Actions pour le pipeline ·
variables Vercel pour le site · **rien dans le navigateur, et aucune variable
`NEXT_PUBLIC_` sur ce projet** — ce préfixe publie la valeur dans le code source de la page
sans le moindre message d'erreur. Le site ne détient aucune clé de modèle. Un secret
commité reste dans l'historique git après suppression du fichier : le **révoquer**, pas
seulement le supprimer.

**Plan, contenu de test et parcours à repasser** : `docs/PLAN.md` — à rouvrir avant de
démarrer une phase et avant toute mise en ligne.
<!-- archi:end -->
<!-- design:end -->
