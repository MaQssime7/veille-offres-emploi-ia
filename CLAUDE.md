# CLAUDE.md — Veille offres emploi IA

Lu à chaque session de Claude Code dans ce dépôt. Complète le `CLAUDE.md` global
de Maxime (`~/.claude/CLAUDE.md`), il ne le remplace pas.

## Où trouver quoi

| Sujet | Où |
|---|---|
| **Pourquoi** une décision de cadrage est ce qu'elle est · questions encore ouvertes | `docs/DECISIONS.md` |
| API France Travail : authentification, pagination, quota, cas limites | `docs/API_FRANCE_TRAVAIL.md` |
| API Anthropic : modèles, paramètres, sortie structurée, cache, batches | référence `/claude-api` |
| Claude Agent SDK : surface d'API | `code.claude.com/docs/en/agent-sdk` |
| Ce que le produit doit faire · ce qu'il refuse de faire | `docs/PRD.md` |
| Dans quel ordre le construire | `docs/PLAN.md` *(à venir)* |

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
| Écran de suivi d'exploitation (exécutions, réussite, durée, coût) | Tracer chaque exécution et chaque enquête dès le premier jour, en **compteurs bruts** jamais en euros. Un historique ne se reconstitue pas |
| Conversation avec le contenu de la base | Fiche d'enquête stockée en **champs séparés**, pas en texte rédigé · identifiant d'offre stable · dates et notes en champs typés |

⚠️ Ne pas confondre l'écran de suivi d'exploitation, prévu, avec l'**analyse du
marché de l'emploi** (tendances, salaires, graphiques), refusée. Et la conversation
avec la base ne doit pas devenir la porte de service par laquelle rentre ce que le
hors périmètre refuse.

**Cadrage complet** : `docs/PRD.md` — 37 user stories, 13 critères de succès.
À rouvrir avant toute décision produit.
<!-- produit:end -->

## État actuel (au 16 août 2026)

Squelette et documentation de cadrage. **Aucun code n'existe encore** — ni
Python, ni Next.js.

Le cadrage a avancé le 16 août 2026 : critères de recherche, notation à deux
axes, forme du livrable, stack et règles de sécurité sont tranchés dans
`docs/DECISIONS.md` ; le périmètre produit l'est dans `docs/PRD.md`.
**Ces décisions sont acquises — ne pas les rouvrir.**

Prochaine étape : **`/design`, puis `/planifie`** — dans cet ordre. `/planifie`
découpe en tranches verticales livrables, et chaque tranche contient de
l'interface : découper avant de savoir à quoi ressemble le produit, c'est
planifier des écrans à l'aveugle. Ne pas écrire de pipeline avant que le plan
existe.

⚠️ **La tension à trancher en `/design`** : ce produit a deux publics — Maxime le
matin, qui veut lire vite et décider, ce qui pousse vers un instrument dense et
sobre ; et un lead technique en entretien, à qui un tableau de bord gris ne fait
aucun effet. Un outil purement fonctionnel rate la vitrine, un site trop léché
perd la crédibilité de l'outil qui tourne. Le système doit tenir les deux.

## Stack

Tranchée le 16 août 2026. Justifications dans `docs/DECISIONS.md` § 3.

- **Python 3.11+** pour le pipeline, environnement virtuel dédié (voir Commandes).
- **Supabase** (Postgres hébergé) pour la persistance. **Pas SQLite** : une
  interface hébergée ne peut pas lire un fichier posé sur le Mac de Maxime.
- **Next.js + shadcn/ui sur Vercel** pour l'interface.
- **GitHub Actions** (cron) pour le déclenchement quotidien — Vercel est un
  environnement JavaScript, il n'héberge pas un processus Python long.
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
| `claude-agent-sdk` | Claude Code en bibliothèque : boucle d'agent, outils Read/Write/Edit/Bash/Glob/Grep/WebSearch/WebFetch, MCP, sous-agents, permissions | L'enquête ouverte : enrichir les offres retenues |
| `anthropic` (API Messages) | Un appel, une réponse structurée | La notation en volume : une offre → deux notes |

**Le placement de cette frontière est l'argument d'entretien le plus fort du
projet.** Un agent posé sur une classification — une entrée, une sortie, aucune
exploration — est plus lent, plus cher et non déterministe pour aucun gain, et un
lead technique qui connaît le SDK le verra. Un agent posé sur une enquête ouverte
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
3. **Le dépôt est public.** Des robots scannent GitHub en continu à la recherche
   de clés commitées et les exploitent en minutes, aux frais du propriétaire. Une
   clé poussée par erreur reste dans l'historique Git même après suppression du
   fichier : la **révoquer**, pas seulement la supprimer.
4. **Supabase : deux clés, deux rôles opposés.** La clé **anon** est publique par
   conception. La clé **service_role** contourne *toutes* les règles de sécurité
   de la base — jamais dans une variable `NEXT_PUBLIC_*`, jamais dans un composant
   client, jamais commitée. RLS activé sur toutes les tables, et **le navigateur
   ne parle jamais directement à Supabase** : tout passe par le serveur.
5. **Aucun déclenchement d'agent accessible publiquement sans garde-fou.** Un
   bouton en ligne qui lance un agent Claude sans protection est une facture
   ouverte : un robot qui scanne les URL peut l'actionner en boucle. Tranché au
   cadrage : le site entier est derrière un mot de passe unique vérifié **côté
   serveur**, couvrant les pages *et* les adresses servant des données — protéger
   la page en laissant l'adresse de données ouverte ne protège rien.
6. **Pas de données personnelles en base.** Les offres sont publiques ; les
   coordonnées de contact qu'elles contiennent parfois ne le sont pas au sens du
   RGPD. Ne stocker que ce dont le pipeline a besoin. Les notes personnelles
   ajoutées par Maxime sur une offre échappent à cette règle par nature — ne pas
   les exposer, ne pas les journaliser, ne pas les faire sortir de la base.

Si un secret a déjà été commité : le révoquer côté France Travail / Anthropic /
Supabase **avant** de nettoyer l'historique. Le nettoyage seul ne protège rien.

## Convention de travail

- Français partout : messages de commit, docstrings, noms de variables métier
  (`offres_pertinentes`, pas `relevant_offers`).
- Un module = une responsabilité. `client_france_travail.py`, `evaluation.py`,
  `stockage.py`, `synthese.py` — pas de `main.py` de 400 lignes.
- Toute fonction qui appelle le réseau gère explicitement l'échec. Pas de
  `try/except` nu qui avale l'erreur.
