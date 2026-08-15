# CLAUDE.md — Veille offres emploi IA

Ce fichier est lu à chaque session de Claude Code dans ce dépôt. Il complète le
`CLAUDE.md` global de Maxime (`~/.claude/CLAUDE.md`), il ne le remplace pas.

## Le projet

Agent de veille quotidienne sur les offres d'emploi dans l'IA. Le pipeline :
récupérer les offres via l'API France Travail → les évaluer contre des critères
de pertinence → produire une synthèse classée.

**Deux usages, pas un seul.** Le projet sert à Maxime pour sa recherche d'emploi
*et* de vitrine technique en entretien — le dépôt est public
(https://github.com/MaQssime7/veille-offres-emploi-ia). Conséquences concrètes :

- Le code sera lu par un recruteur ou un lead technique. Nommage explicite,
  fonctions courtes, pas de fichier fourre-tout.
- L'historique Git compte autant que le code. Commits atomiques, messages en
  français qui expliquent le *pourquoi*.
- Le README est la première chose lue. Il doit rester à jour quand
  l'architecture bouge.

## État actuel (au 15 août 2026)

Squelette seulement : `README.md`, `.gitignore`, `.env.example`. **Aucun code
Python n'existe encore.** Pas de `docs/PRD.md`, pas de `docs/PLAN.md`.

Avant d'écrire la première ligne de pipeline, passer par `/cadre` puis
`/planifie` — le découpage en phases n'existe pas et le construire à l'aveugle
produirait du jetable.

## Stack

- **Python 3.11+**, environnement virtuel dédié (voir Commandes).
- **SQLite** pour la persistance (déduplication des offres, historique des
  évaluations).
- **API France Travail** — Offres d'emploi v2.
- **API Anthropic** pour l'évaluation — voir la section dédiée, le choix de la
  bibliothèque n'est pas celui que le README laisse entendre.

Pas de framework web pour l'instant. Si une interface devient nécessaire, la
question se repose de zéro (`/planifie`), elle n'est pas tranchée ici.

## Commandes

Le `python3` par défaut de cette machine est celui d'Anaconda (`/opt/anaconda3`).
**Ne pas installer les dépendances du projet dedans** — créer un environnement
isolé, sinon les paquets du projet se mélangent à l'installation Anaconda
globale et deviennent impossibles à démêler.

```bash
# Créer l'environnement (une seule fois)
python3 -m venv .venv

# L'activer (à chaque nouvelle session de terminal)
source .venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt

# Vérifier qu'on est dans le bon environnement
which python   # doit afficher .../veille-offres-emploi-ia/.venv/bin/python
```

`.venv/` est exclu par le `.gitignore`. Si `which python` pointe vers
`/opt/anaconda3`, l'environnement n'est pas activé — toute installation partira
au mauvais endroit.

## API France Travail — Offres d'emploi v2

**Paramètres vérifiés en conditions réelles le 15 août 2026** — authentification
et appel de recherche testés avec succès contre les identifiants du projet. Ne
pas les rechercher à nouveau, ils sont établis.

**Authentification** — OAuth2 `client_credentials`, sans interaction
utilisateur. Un jeton de courte durée est obtenu contre l'identifiant et la clé
secrète, puis envoyé en `Authorization: Bearer` sur chaque appel.

```
POST https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
client_id=<FT_CLIENT_ID>
client_secret=<FT_CLIENT_SECRET>
scope=api_offresdemploiv2 o2dsoffre
```

- **Le scope est exactement `api_offresdemploiv2 o2dsoffre`**, les deux valeurs
  séparées par une espace. Pas de préfixe `application_<client_id>` — cette
  variante échoue.
- **Les identifiants vont dans le corps de la requête, pas en en-tête Basic.**
  Une authentification `Authorization: Basic` est rejetée par le serveur avec
  une page HTML d'erreur de contrôle d'accès en HTTP 409 — pas un JSON, ce qui
  fait planter tout code qui suppose une réponse JSON sur le chemin d'erreur.
- Un `invalid_client` en HTTP 400 alors que les identifiants sont bons signifie
  presque toujours que **l'API n'est pas rattachée à l'application** sur
  francetravail.io. Créer l'application ne suffit pas.
- La clé secrète n'est affichée **qu'une fois**, à la création de l'application.
  Perdue, elle ne se relit pas : il faut renouveler les identifiants, ce qui
  invalide les anciens.

**Recherche d'offres**

```
GET https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search
Authorization: Bearer <jeton>
```

**Quota : 10 appels par seconde** pour cette application. Le pipeline doit
espacer ses appels — une boucle de pagination sans temporisation le dépassera.

**Pièges de pagination — le point qui casse en pratique.** Le paramètre `range`
prend la forme `0-149` :

- Maximum **150 résultats par appel**.
- Plafond d'environ **1150 offres par recherche** (index maximum ~1149).
  Au-delà, il faut affiner la requête — typiquement en découpant par date de
  création — et non paginer davantage.
- L'en-tête `Content-Range` de la réponse donne le total réellement disponible.
  C'est lui qui doit piloter la boucle de pagination, pas une constante en dur.
- Une réponse partielle renvoie **HTTP 206**, pas 200. Un code qui teste
  `status_code == 200` rate silencieusement toutes les pages intermédiaires.

**Cas limites à gérer dès la première version**, parce que personne ne les
rattrapera ensuite : jeton expiré en milieu de pagination (le renouveler et
reprendre, pas planter) ; réponse vide (zéro offre n'est pas une erreur) ;
quota d'appels dépassé ; offre déjà présente en base (déduplication sur
l'identifiant de l'offre, pas sur le titre).

## La partie IA — décision prise, et où elle s'applique

**Décision de Maxime (15 août 2026) : le Claude Agent SDK est retenu, et
l'objectif d'apprentissage prime.** Ce projet sert à monter en compétence sur
l'orchestration d'agents, qui est ce que les entreprises demandent. Ne pas
rouvrir cette décision à chaque session.

Ce qu'il faut savoir pour la mettre en œuvre correctement, parce que les deux
outils coexistent dans ce projet :

| | Ce que c'est | Ce qu'il fait ici |
|---|---|---|
| `claude-agent-sdk` | Claude Code en bibliothèque : boucle d'agent, outils Read/Write/Edit/Bash/Glob/Grep/WebSearch/WebFetch intégrés, MCP, sous-agents, permissions | L'enquête ouverte : enrichir les offres retenues |
| `anthropic` (API Messages) | Un appel, une réponse structurée | La notation en volume : une offre → une note |

**Le placement de la frontière est la décision d'architecture centrale de ce
projet, et l'argument d'entretien le plus fort.** Un agent posé sur une tâche
de classification (une entrée, une sortie, aucune exploration) est plus lent,
plus cher et non déterministe pour aucun gain — un lead technique qui connaît
le SDK le verra. Un agent posé sur une enquête ouverte (chercher l'entreprise,
lire son site, croiser, rédiger une fiche) est exactement ce pour quoi le SDK
existe, et ses outils web et fichier intégrés le font sans code maison.

Découpage recommandé (à valider en `/cadre`) :

1. **Collecte** — appel API France Travail, écriture en SQLite. Python simple,
   zéro IA.
2. **Notation** — API Messages, sortie structurée, traitement par lot. Rapide
   et bon marché sur le volume.
3. **Enrichissement** — Claude Agent SDK, sur les quelques offres retenues.
   Tâche ouverte, multi-étapes, imprévisible : le vrai terrain d'un agent.

⚠️ **Avant d'écrire du code Agent SDK, lire la documentation officielle**
(`code.claude.com/docs/en/agent-sdk`). La référence `/claude-api` de cette
machine couvre l'API Messages et les Managed Agents — elle ne couvre **pas** le
Agent SDK, et improviser sa surface d'API produirait du code faux.

Le SDK fournit la boucle d'agent et les outils, **pas l'hébergement** : c'est
au projet de décider où le processus tourne.

Pour la partie API Messages (étape 2) :

- Paquet : `pip install anthropic`
- Modèle par défaut : `claude-opus-5`. Pour une classification en volume,
  `claude-haiku-4-5` coûte 5× moins cher — l'arbitrage est celui de Maxime,
  pas le mien, et se pose dans la conversation.
- **Sortie structurée** (`output_config.format` avec un schéma JSON) plutôt que
  parser du texte libre. Une note et une justification par offre, garanties
  bien formées.
- **Mise en cache du prompt** (`cache_control`) : les critères de pertinence
  sont identiques d'une offre à l'autre. Les mettre en préfixe stable et les
  marquer divise leur coût par dix sur les appels suivants.
- **API Batches** : la veille est quotidienne et non urgente. Un traitement par
  lot coûte 50 % moins cher qu'appel par appel.
- Vérifier `stop_reason` avant de lire `response.content` — lire `content[0]`
  sans contrôle casse sur un refus.

Avant d'écrire du code appelant l'API Anthropic, charger la référence
`/claude-api` — les identifiants de modèles et les paramètres changent, et un
identifiant inventé renvoie une 404.

## Sécurité — non négociable

Les clés de ce projet donnent accès à un compte facturé. Règles dures :

1. **Aucune clé en clair dans le code, jamais.** Les secrets vivent dans
   `.env`, lu via `os.environ`. `.env` est exclu par le `.gitignore` — vérifier
   la sortie de `git status` avant chaque commit ; si `.env` y apparaît,
   s'arrêter.
2. **Aucune clé dans la conversation, les logs ou un message d'erreur.** Un
   `print(config)` qui affiche le jeton finit dans un terminal, une capture
   d'écran, un dépôt public.
3. **Le dépôt est public.** Des robots scannent GitHub en continu à la
   recherche de clés commitées et les exploitent en minutes, aux frais du
   propriétaire. Une clé poussée par erreur est compromise même après
   suppression du fichier : elle reste dans l'historique Git. La révoquer,
   pas seulement la supprimer.
4. **Pas de données personnelles en base.** Les offres sont publiques ; les
   coordonnées de contact qu'elles contiennent parfois ne le sont pas au sens
   du RGPD. Ne stocker que ce dont le pipeline a besoin.

Si un secret a déjà été commité : le révoquer côté France Travail / Anthropic
**avant** de nettoyer l'historique. Le nettoyage seul ne protège rien.

## Ce qui n'est pas tranché

À ne pas décider en écrivant du code — ces questions se posent dans la
conversation, et pour la plupart relèvent de `/cadre` :

- **La forme du livrable quotidien** : fichier Markdown ? e-mail ? notification ?
  interface web ? Ça commande toute l'architecture aval.
- **Les critères de pertinence eux-mêmes** : métiers visés, localisation,
  niveau d'expérience, taille d'entreprise. C'est le cœur du filtrage et
  personne d'autre que Maxime ne les connaît.
- **Le déclenchement** : lancement manuel, tâche planifiée locale (`cron`),
  hébergement distant ?
- **Le schéma de la base** : découle des trois points ci-dessus.
- **La frontière agent / code déterministe** : le découpage en trois étapes
  ci-dessus est une recommandation, pas une décision. À valider en `/cadre`.
- **Un serveur MCP maison** pour exposer l'API France Travail à l'agent, au
  lieu d'outils Python directs. Coût : une phase de plus. Bénéfice : MCP est le
  protocole standard de branchement d'outils sur un agent, et c'est une
  compétence recherchée au moins autant que le SDK lui-même. À arbitrer une
  fois les trois étapes de base livrées, pas avant.

## Convention de travail

- Français partout : messages de commit, docstrings, noms de variables métier
  (`offres_pertinentes`, pas `relevant_offers`).
- Un module = une responsabilité. `client_france_travail.py`, `evaluation.py`,
  `stockage.py`, `synthese.py` — pas de `main.py` de 400 lignes.
- Toute fonction qui appelle le réseau gère explicitement l'échec. Pas de
  `try/except` nu qui avale l'erreur.
