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
| Identité visuelle : jetons, contrastes vérifiés, composants propres au produit | `docs/DESIGN.md` |
| Dans quel ordre le construire · contenu de test · parcours à repasser | `docs/PLAN.md` |

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

## État actuel (au 17 août 2026)

**La stack est posée, le pipeline n'existe pas encore.** `interface/` contient
Next.js 16, React 19, TypeScript, Tailwind v4 et shadcn/ui sur le moteur
`radix`, avec les jetons, les trois polices et le rayon de bordure du
`DESIGN.md` déjà appliqués. `pipeline/` **n'existe pas** : aucune ligne de
Python n'est écrite.

⚠️ La page d'accueil de `interface/` est une **page de contrôle temporaire**
posée par `/installe` — elle affiche les polices et les jetons pour prouver que
la chaîne fonctionne. Ce n'est pas un écran du produit : la phase 1 la remplace
par le compte rendu de la nuit. Ne pas construire dessus.

Le cadrage a avancé le 16 août 2026 : critères de recherche, notation à deux
axes, forme du livrable, stack et règles de sécurité sont tranchés dans
`docs/DECISIONS.md` ; le périmètre produit l'est dans `docs/PRD.md` ; l'identité
visuelle dans `docs/DESIGN.md`. **Ces décisions sont acquises — ne pas les
rouvrir.**

`/design` est passé le 16 août 2026. La tension entre les deux publics — Maxime qui
veut lire vite le matin, le lead technique en entretien à qui un tableau de bord gris
ne fait aucun effet — est tranchée par la direction **éditorial technique** : chaud
dans la matière, froid dans la précision. Voir la section Design en fin de fichier.

`/planifie` est passé le 16 août 2026. Le découpage en **sept** tranches verticales, les
décisions architecturales, le contenu de test et les parcours à repasser sont dans
`docs/PLAN.md`. Deux amendements y sont consignés : l'écran du matin n'affiche que la
collecte de la nuit (et non plus tout ce qui reste à traiter), et l'enrichissement **manuel
se construit avant l'automatique**.

`/installe` est passé le 17 août 2026, sur la branche `installation-stack` (deux commits,
non poussés). Le preset `nova` avait écrasé plusieurs décisions du `DESIGN.md` — palette
grise à la place de la palette chaude, Fraunces absente, `--font-heading` pointé vers la
police sans-serif, `--radius` à 0.625rem — **toutes rétablies et vérifiées par commande**.
Les cinq jetons propres au produit (`signal`, `signal-fort`, `success` et leurs textes)
sont déclarés dans `:root` **et** exposés dans `@theme inline` : sans le second, `bg-signal`
n'existe pas comme classe et l'élément reste sans fond, **sans aucune erreur**.

Prochaine étape : la **phase 1** — la porte, la collecte, les premières offres réelles à
l'écran.

⚠️ **Deux choses restent à faire hors code**, et leur oubli se voit tard : pousser la
branche et la fusionner · régler Vercel sur `Root Directory = interface`, sans quoi le
déploiement échoue en cherchant un `package.json` à la racine.

**On travaille directement sur `main` par défaut.** Décidé le 17 août 2026, après avoir
fait le geste complet une fois sur `installation-stack` : seul sur le dépôt, une demande de
fusion qu'on s'adresse à soi-même n'apporte aucune relecture et ralentit sans rien
protéger. Ne pas reproposer de brancher par principe.

⚠️ **Deux exceptions, où l'on branche quand même** — et là je le propose sans attendre
qu'on me le demande :

- **une migration de schéma** ou tout changement qui touche des données déjà en base ;
- **un chantier qu'on peut vouloir jeter en entier** (essai d'architecture, refonte).

La branche n'y sert pas de rituel : elle sert de **filet**. Sans elle, revenir en arrière
suppose de savoir manier `git revert` et `git reset` — ce qui n'est pas acquis.

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

**Frontend** : template `next` · moteur des composants **`radix`** · pas de monorepo ·
icônes lucide — **figés à l'installation**. ⚠️ Vercel doit être réglé sur
`Root Directory = interface`.

**Routes** : `/` le compte rendu de la nuit · `/offres` le poste de travail (filtre de
statut dans l'adresse) · `/offres/[identifiant]` la fiche · `/connexion` la porte.
L'identifiant est celui de France Travail, **validé avant d'atteindre la base**.

**Schéma** : `executions_veille` · `offres` · `enrichissements` · `etapes_enrichissement`.
Pas d'accents dans les noms. Une offre est rattachée à l'exécution qui l'a trouvée ; elle a
**au plus un** enrichissement (une relance remplace la fiche). Deux compteurs de tokens sur
l'offre : `tokens_cumules` et `tokens_conversation`.
**La colonne qui dit à qui la donnée appartient : aucune, délibérément** — un seul
utilisateur, une seule porte ; une telle colonne porterait la même valeur partout et
donnerait l'illusion d'un contrôle.

**Autorisation, opposable** : RLS activé sur toutes les tables, **aucune politique** ; le
navigateur ne parle jamais à Supabase. Un middleware unique protège **tout par défaut**,
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
