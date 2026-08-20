# Décisions de cadrage

Ce fichier consigne les décisions prises en session de cadrage **et leur
justification**. Le `CLAUDE.md` renvoie ici au lieu de tout absorber, pour rester
court et lisible à chaque session.

Répartition des rôles entre documents :

| Fichier | Ce qu'il dit |
|---|---|
| `CLAUDE.md` | Les règles de travail et les pièges techniques établis |
| `docs/DECISIONS.md` (ce fichier) | Ce qui a été décidé, et **pourquoi** plutôt qu'autrement |
| `docs/PRD.md` (`/cadre`) | Ce que le produit doit faire |
| `docs/PLAN.md` (`/planifie`) | Dans quel ordre le construire |

Toute décision inscrite ici est acquise : ne pas la rouvrir à chaque session.
Ce qui reste ouvert est regroupé en fin de fichier.

---

## 1. Ce que Maxime cherche — session du 16 août 2026

| Axe | Décision |
|---|---|
| Sujet | Agents IA, orchestration LLM, automatisation intelligente |
| Zone | Île-de-France |
| Exclusion ferme (sujet) | ML/DL portant sur les modèles : entraînement, fine-tuning, recherche |
| Exclusion ferme (sujet) | Développement classique où l'IA n'est qu'un décor — un poste full-stack dans une entreprise d'IA n'est pas un poste d'IA |
| Exclusion ferme (séniorité) | Intitulés *senior, confirmé, lead, staff, principal, architecte, head of, manager* |
| Expérience chiffrée | **Pénalise, ne bannit jamais** : 0-1 an neutre · 2 ans légère pénalité · 3 ans forte · 4 ans et plus, score plancher |
| Salaire | **Hors critères de notation.** Affiché sur la fiche quand l'offre l'indique, sans effet sur la note |

**Profil à opposer à chaque offre** — c'est le contexte que le modèle utilise
pour juger l'accessibilité :

> Bac+5, école d'ingénieur ENSEA. Six mois d'expérience professionnelle chez
> AI Builders, cabinet de conseil en stratégie data et IA, au pôle research :
> développement de POC agentiques, animation d'ateliers agentiques pour projeter
> consultants et clients vers une mise en production, études de marché et
> benchmarks, vulgarisation.

### Pourquoi le sujet et non la quantité de code

Le premier réflexe était d'exclure les postes « trop développement ». C'est faux :
Maxime accepte un poste d'AI Engineer avec du Python quotidien, parce qu'il
travaille avec Claude Code et s'en tire. Ce qu'il refuse, c'est un poste où l'IA
n'est pas le métier. Le discriminant est donc **le sujet du poste**, pas le
volume de code.

### Pourquoi on ne bannit pas à 2 ans d'expérience

Trois raisons, contre l'intuition de départ :

1. « 2 ans » est le plus souvent un réflexe RH recopié d'une fiche précédente,
   pas un mur. Un profil ENSEA avec des POC agentiques livrés en cabinet passe
   ce filtre régulièrement, surtout sur un sujet où les candidats sont rares.
   Ce qui est réellement fermé, ce sont les 5 ans et les intitulés de séniorité.
2. **Le coût de l'erreur est asymétrique.** Une offre bannie est invisible et
   irrécupérable. Une offre notée 30/100 apparaît en bas de liste et coûte trois
   secondes de lecture. Sur quelques dizaines d'offres par jour, il n'y a aucune
   raison de payer le coût de l'invisibilité.
3. La distribution réelle des exigences d'expérience sur ce marché n'est pas
   connue. Elle le sera après deux semaines de veille — les seuils se règlent
   alors sur des données, pas sur une intuition.

### Pourquoi le salaire n'est jamais un filtre de collecte

Le champ salaire de France Travail est du texte libre très irrégulier :
« Annuel de 38000,00 Euros sur 12 mois », « Mensuel de 3500 Euros »,
« Selon profil », « À négocier ». Deux pièges :

- La majorité des offres n'affichent rien. Filtrer côté API jetterait d'un coup
  la plus grande part du gisement.
- Un code naïf cherchant « un nombre ≥ 40000 » rate « Mensuel de 3500 Euros »,
  qui vaut pourtant 42 k annuels.

Le salaire est donc lu et normalisé par le modèle à l'étape de notation, puis
affiché. Il n'entre pas dans le calcul de la note.

---

## 2. Comment le système décide

### Deux notes séparées, jamais fusionnées

Chaque offre reçoit **deux notes distinctes de 0 à 100** :

| Note | Question posée |
|---|---|
| **Intérêt** | Le sujet correspond-il à ce que je cherche ? |
| **Accessibilité** | Ai-je une chance réelle d'être retenu ? |

Pourquoi ne pas les fusionner : un poste passionnant chez un éditeur exigeant
6 ans d'expérience et un poste tiède mais accessible donneraient le même score
moyen, alors que la décision n'est pas la même. Les offres *intérêt élevé /
accessibilité faible* ont en outre une valeur propre — elles indiquent ce que le
marché demande et sur quoi se muscler.

### Rien n'est supprimé

Toutes les offres collectées sont conservées en base, y compris les écartées,
**avec leurs deux notes et le motif d'écartement**. Coût : quelques milliers de
lignes. Bénéfice : au bout de deux semaines, on regarde ce que le filtre a jeté
et on ajuste les seuils sur des données réelles. Un filtre qui supprime est
figé le premier jour.

### Les critères vivent dans un fichier, pas dans le code

Les critères de la section 1 sont écrits en français dans un fichier texte
versionné, injecté en préfixe du prompt de notation (avec `cache_control`, les
critères étant identiques d'une offre à l'autre).

1. Ces critères **ne sont pas exprimables en booléens**. « Le sujet doit être
   l'IA » est une nuance de degré ; un `if "développeur" in titre` écarterait de
   bonnes offres et en laisserait passer de mauvaises. Lire une description
   complète et juger, c'est la seule vraie plus-value du modèle ici.
2. Les critères vont bouger après quelques semaines d'usage. Un fichier texte se
   corrige en trente secondes ; du code de filtrage se re-teste.
3. Argument d'entretien : « les critères métier sont des données, pas du code ».

### Aucun filtre par mots-clés sur le titre de l'offre

Les intitulés France Travail sont bruités : une offre pertinente peut s'appeler
« Ingénieur études et développement (H/F) » avec la partie IA enterrée dans la
description. Un filtre serré sur le titre la rate **silencieusement**. La requête
API reste donc large mais bornée (mots-clés + zone géographique), et le tri est
fait par le modèle.

---

## 3. Architecture retenue

```
GitHub Actions (cron quotidien)  →  pipeline Python  →  Supabase (Postgres)
                                                              ↑
                                    Vercel + Next.js + shadcn/ui (lecture serveur)
```

| Brique | Choix | Raison |
|---|---|---|
| Base de données | **Supabase** (Postgres hébergé) | Une interface hébergée ne peut pas lire un SQLite posé sur le Mac de Maxime |
| Interface | **Next.js + shadcn/ui sur Vercel** | Décidé pour l'apprentissage (intégrer un agent dans une interface) et pour la vitrine d'entretien |
| Pipeline | **Python**, déclenché par **GitHub Actions** | 6 h de durée par exécution contre 300 s chez Vercel ; gratuit et illimité sur dépôt public ; secrets gérés ; le workflow est versionné, donc visible d'un recruteur |

### Notation : deux réglages dictés par l'usage, pas par principe

Ces deux choix d'implémentation de l'étape de notation découlent de la nature de
ce projet précis. Les paramètres généraux de l'API Messages relèvent de la
référence `/claude-api`, pas d'ici.

- **Mise en cache du prompt (`cache_control`)** : les critères de pertinence sont
  rigoureusement identiques d'une offre à l'autre. Les placer en préfixe stable
  et les marquer divise leur coût par dix sur les appels suivants du même lot.
- **API Batches** : la veille est quotidienne et non urgente. Rien n'exige une
  réponse dans la seconde, et un traitement par lot coûte moitié moins cher qu'un
  appel par offre.

### L'enrichissement par agent est découplé de l'interface

Une fonction Vercel a une durée maximale de **300 s** en offre gratuite (800 s en
Pro, 1800 s en bêta — vérifié le 17 août 2026). Un agent qui explore le site d'une
entreprise peut dépasser. Plutôt que de contourner la limite, on l'évite :

1. Le clic sur « enrichir » fait écrire au serveur Next.js une ligne « à traiter »
   dans Supabase, et rend la main **immédiatement**.
2. Le processus Python voit la demande, lance l'agent, et écrit chaque étape dans
   une table au fur et à mesure.
3. L'interface s'abonne à cette table via **Supabase Realtime** et affiche les
   étapes au fil de l'eau.

Résultat visuel identique au streaming direct — on voit l'agent travailler — sans
qu'aucune connexion doive tenir deux minutes. C'est un découplage
producteur/consommateur, plus solide et plus démontrable que le réflexe du
streaming synchrone.

### Le navigateur ne parle jamais directement à Supabase

Tout accès aux données passe par le serveur Next.js. Voir section 4.

**Ce que ce choix écarte, nommé correctement — précisé le 20 août 2026.** Il existe
exactement deux façons de faire arriver des données jusqu'à un écran, et elles se
distinguent par **où vit l'autorisation** :

| | **Trois tiers** *(retenu)* | **BaaS + RLS** *(le défaut Supabase)* |
|---|---|---|
| Chemin | navigateur → serveur → base | navigateur → base, directement |
| Autorisation | dans le code du serveur | dans la base, par politiques RLS |
| Ce que la base voit | toujours `service_role`, tout-puissant | l'identité réelle de la personne |
| Si la vérification est oubliée | **tout est exposé, aucun filet** | la base refuse quand même |
| Si le mot de passe fuite | l'attaquant voit ce que les pages affichent | l'attaquant compose ses propres requêtes |

**Pourquoi les trois tiers ici** : un seul utilisateur — une politique RLS dirait
« tout le monde voit tout », donc n'écarterait personne · un serveur est de toute
façon nécessaire (mot de passe, déclenchement GitHub, clé du modèle) · une fois
qu'il existe, un seul endroit de vérification est plus simple à défendre que des
politiques réparties sur chaque table.

⚠️ **La contrepartie dicte deux règles du `PLAN.md`, et explique pourquoi elles ne sont
pas négociables** : dans ce modèle il n'y a **aucun second filet**. D'où le `proxy.ts`
unique qui protège tout par défaut, et la fonction de contrôle **unique** par laquelle
tous les accès passent. Recopier la vérification garantit qu'un accès finira par être
oublié — et rien, en dessous, ne le rattrapera.

*Un troisième chemin existe, non retenu : le serveur transmet à Supabase le jeton de
l'utilisateur, si bien que RLS s'applique en plus. Deux filets au lieu d'un. Sans objet
ici, puisqu'il n'y a personne à distinguer de qui que ce soit.*

**Tranché au `/planifie` du 16 août 2026 : Supabase Realtime est écarté, le flux
passe par une route serveur sondée toutes les 1,5 seconde.** Realtime écoute
depuis le **navigateur**, avec la clé publique, ce qui obligerait à ouvrir une
politique de lecture publique sur la table des étapes — en contradiction directe
avec les deux règles dures de la section 4 (« RLS activé, aucune politique
publique » et « le navigateur ne parle jamais directement à Supabase »). Une
exception ouverte pour une seule table est exactement ce qui s'oublie et s'étend.

Le coût est nul : un enrichissement dure au plus cinq minutes et produit une
poignée d'étapes, soit au pire 200 requêtes sur toute sa durée, pour un site à un
seul utilisateur. **Le rendu à l'écran est identique** — les étapes apparaissent
au fil de l'eau, avec le fondu-glissé décalé de 130 ms prévu au `DESIGN.md`. Et
l'argument d'entretien est meilleur, pas moins bon : refuser d'exposer sa base au
navigateur pour un gain de confort nul se défend mieux qu'un WebSocket décoratif.

**Comment le processus Python apprend qu'un enrichissement est demandé** — ce
point manquait à la description ci-dessus. Le serveur Next.js **appelle l'API
GitHub pour lancer le workflow sur-le-champ**. Un cron ne descend pas sous cinq
minutes et se déclenche souvent avec dix à quinze minutes de retard : la
démonstration en entretien, qui est un objectif produit explicite, deviendrait
impossible. Le serveur écrit lui-même une première étape « Demande reçue » en
moins d'une seconde ; la première étape produite par l'agent arrive 30 à 60
secondes plus tard, le temps que GitHub alloue une machine.

⚠️ Ce choix ajoute un **jeton GitHub** dans les variables Vercel. Il doit être
limité à ce dépôt et au seul droit de lancer un workflow — s'il fuitait, on
pourrait lancer en boucle le workflow qui détient la clé Anthropic. Et **il
expire** : son expiration est une panne parfaitement silencieuse, où le site
marche, la veille tourne, et seul le bouton « Enrichir » cesse d'agir.

---

## 4. Sécurité — règles dures ajoutées par cette session

Elles complètent la section « Sécurité » du `CLAUDE.md`, elles ne la remplacent
pas.

**1. Les deux clés Supabase n'ont rien à voir.**

- La clé **anon** est conçue pour être publique : elle part dans le navigateur et
  est visible dans le code source de la page. C'est normal.
- La clé **service_role** contourne *toutes* les règles de sécurité de la base et
  donne un accès total en lecture et en écriture. Dans une variable
  `NEXT_PUBLIC_...`, dans un composant client, ou commitée sur ce dépôt public,
  elle permet à n'importe qui de lire et d'effacer la base entière. Des robots
  scannent GitHub pour ces clés en continu.

La `service_role` vit dans les variables d'environnement de Vercel et dans le
`.env` local. Nulle part ailleurs.

**2. RLS activé sur toutes les tables, aucune politique publique.** Le réflexe,
quand une requête échoue, est de désactiver la Row Level Security. À cet instant
la table devient lisible par quiconque possède la clé anon — qui est publique par
construction. Le projet n'a qu'un seul utilisateur : aucun besoin d'autorisation
fine, tout passe par le serveur avec la `service_role`.

**3. Aucun déclenchement d'agent accessible publiquement sans garde-fou.** Un
bouton en ligne qui lance un agent Claude sans protection est une facture
ouverte : n'importe qui, y compris un robot qui scanne les URL, peut l'actionner
en boucle aux frais de Maxime. À trancher avant la mise en ligne, pas après la
première facture. Trois sorties possibles : authentification, plafond d'appels
par visiteur, ou agent déclenché uniquement côté pipeline.

**4. Le rapport de PFE ne rentre pas dans ce dépôt.** Un rapport de fin d'études
en cabinet de conseil contient des noms de clients, des chiffres de mission et
des méthodes internes, souvent sous clause de confidentialité. Le dépôt est
public, et un fichier poussé reste dans l'historique Git même après suppression.
Seul un **résumé de compétences assumé public**, sans nom de client ni chiffre de
mission, alimente le prompt de notation.

---

## 5. Faits techniques établis en session

Ils sont consignés à leur place, dans `docs/API_FRANCE_TRAVAIL.md` : le plafond
de ~1150 offres par recherche n'est pas un problème en régime quotidien, et
l'expérience exigée serait disponible dans un champ structuré — à confirmer.

---

## 6. Tranché au cadrage du 16 août 2026 (`/cadre`)

Quatre questions de la liste ouverte sont fermées. Le détail est dans
`docs/PRD.md` ; seul le verdict est rappelé ici.

| Question | Verdict |
|---|---|
| Ce que contient exactement une fiche d'offre à l'écran | Entête, les deux notes avec justification, résumé court, description intégrale repliée, lien d'origine, bloc d'enrichissement, note personnelle |
| Heure de la veille, fréquence, comportement un jour sans offre | Une exécution par jour, tôt le matin, heure de Paris. Un jour sans offre est un jour normal : état vide explicite, et aucun enrichissement lancé |
| Enrichissement automatique, bouton manuel, ou les deux | ~~**Les deux.**~~ **Amendé le 16 août 2026 : manuel uniquement.** Voir section 9 |
| Comment éviter qu'un recruteur lise la note d'accessibilité de sa propre entreprise | **Mot de passe unique**, vérifié côté serveur, couvrant pages et adresses de données. Ni comptes, ni rôles. Écarte du même coup le risque de facture ouverte sur le bouton d'enrichissement |

Le cadrage a aussi ajouté deux exigences qui n'étaient dans aucune liste :
**tracer chaque exécution et chaque enrichissement dès le premier jour** (durée, volumes,
issue, compteurs de consommation bruts — jamais un montant en euros seul), et
**afficher en permanence la date de la dernière veille réussie**, sans quoi une
liste vide ne se distingue pas d'un pipeline mort.

## 7. Vitrine : publier la méthode de travail

**Décision du 16 août 2026.** Les skills personnels de Maxime (`/amorce`,
`/interroge`, `/cadre`, `/design`, `/planifie`, `/installe`, `/cloture`,
`/investigue`) seront publiés dans un **dépôt public séparé**, lié depuis le
README de ce projet — **une fois que la veille tournera**, pas avant.

**Pourquoi les publier.** Beaucoup de candidats diront « j'utilise Claude Code ».
Presque aucun ne montrera ses propres outils de méthode. C'est la même thèse que
celle du projet — *les critères métier sont des données, pas du code* — appliquée
à la démarche de travail elle-même.

**Pourquoi un dépôt séparé et pas celui-ci.** Les skills ne sont pas propres à la
veille d'emploi. Les copier ici créerait un second exemplaire qui divergerait de
celui réellement utilisé en quelques semaines, et une vitrine périmée est pire
qu'absente. Le dépôt doit **être** `~/.claude/skills/`, versionné sur place :
un seul exemplaire, celui qui sert tous les jours. Bénéfice secondaire, ce
dossier n'a aujourd'hui aucune sauvegarde.

**Pourquoi pas maintenant.** Publier une méthode avant d'avoir livré le produit
envoie le mauvais signal : quelqu'un qui a écrit des processus au lieu de
construire. Les skills prennent leur valeur *à côté* d'une veille qui tourne.

### ⛔ Ce qui ne doit jamais être publié

**`~/.claude/CLAUDE.md`** — le fichier de consignes de travail personnel — **ne
va dans aucun dépôt public.** Il décrit franchement la façon de travailler de
Maxime : construction intégralement assistée, code et documents non relus, niveau
inégal selon les domaines. Cette franchise est ce qui rend l'assistant utile ;
elle est écrite **pour lui**, pas pour un lead technique qui évalue une
embauche. Publiée à côté du projet, elle serait lue avant le code et annulerait
tout le reste.

### Avant toute publication

1. **Exclure les skills tiers** — `shadcn`, `defuddle`, `obsidian-*`,
   `json-canvas` ne sont pas de Maxime. Les republier diffuserait le travail
   d'autrui sous son nom.
2. **Créditer les dérivés** — `design`, `planifie` et `investigue` portent un
   fichier `.upstream-SKILL.md` : ils dérivent d'un skill existant. L'attribution
   est due, et elle est un argument de plus en entretien.
3. **Relire chaque fichier** — chemin de machine, nom de client, clé oubliée dans
   un exemple. Un dépôt public est scanné par des robots en continu.

## 8. Tranché au `/planifie` du 16 août 2026

Les questions laissées ouvertes en cadrage sont fermées. Le détail est dans
`docs/PLAN.md` ; seul le verdict et son motif sont rappelés ici.

| Question | Verdict |
|---|---|
| **Ordre de construction de l'enrichissement** | Question devenue sans objet : l'automatique a été **retiré de la v1** le même jour. Voir section 9 |
| **Local d'abord ou Supabase dès le premier jour** | **Supabase dès le premier jour.** GitHub Actions ne peut pas lire un fichier posé sur le Mac : la couche de stockage serait à écrire deux fois, et la seconde fois avec des données réelles dedans |
| **Modèle pour la notation en volume** | **`claude-sonnet-5`**, avec cache de prompt et API Batches. Écarte Haiku 4.5 dont le cache ne s'active qu'au-delà de 4 096 tokens : le fichier de critères passerait sous le seuil et ne serait **jamais mis en cache, silencieusement**. L'écart de coût entre les deux est d'environ 3 $ par mois — dérisoire face au risque d'un jugement mal étalonné sur le cœur du produit |
| Serveur MCP maison pour exposer France Travail à l'agent | **Toujours ouvert.** Après les trois étapes de base, comme prévu au `CLAUDE.md` |

### Trois décisions produit prises en séance et reportées au PRD

- **L'écran d'accueil n'affiche que la collecte de la nuit**, et non plus tout ce
  qui reste à traiter. La page porte la date de la collecte en tête ; y mêler des
  offres de la semaine précédente ferait mentir cet entête. Le tri quotidien se
  fait dans la vue d'ensemble, qui devient le poste de travail réel — et donc
  l'écran le plus important du produit, alors qu'il est le seul des quatre que
  `/design` n'a jamais dessiné.
- **Le marqueur « nouveau » se calcule par appartenance à la dernière exécution
  réussie**, jamais par comparaison à une date de dernière visite. Une date de
  visite stockée viderait la liste sous les yeux de l'utilisateur au
  rechargement.
- **L'enrichissement automatique nocturne est retiré de la v1** — voir section 9.

---

## 9. L'enrichissement devient exclusivement manuel

**Décision du 16 août 2026**, prise en fin de session `/planifie`, avant tout
développement. Elle annule le verdict « les deux » de la section 6.

### Pourquoi

1. **Soixante fiches par mois, lues ou non.** Deux par nuit sur trente nuits, à
   0,20 € à 1 € pièce. C'est le poste de dépense dominant du projet, et il
   tournait sans supervision.
2. **La sélection reposait sur des seuils non calibrés.** Le seuil à 50/50 est
   marqué au PRD « à re-régler après deux semaines de données réelles » :
   l'automatique aurait dépensé sur une heuristique pendant exactement la période
   où elle est la moins fiable.
3. **Le bon déclencheur est la lecture.** On ouvre une offre, elle accroche, on
   veut savoir à qui on a affaire. C'est là que la fiche vaut quelque chose. Une
   fiche produite à quatre heures du matin sur une offre qu'on ne lira peut-être
   jamais est du travail payé et perdu. Cohérent avec la décision prise plus tôt
   dans la même séance : le poste de travail est la vue d'ensemble, pas l'écran du
   matin.

### Ce que ce retrait emportait avec lui, et qu'il a fallu remplacer

⚠️ « Au plus deux enrichissements par nuit » n'était pas seulement une règle de
sélection : **c'était le seul mécanisme du projet qui bornait la dépense d'une
journée.** En manuel, rien n'empêche quarante clics dans l'après-midi — ni un bug
de double soumission, ni une boucle de relance sur un enrichissement qui échoue en
série.

Il est remplacé par une **enveloppe quotidienne comptée en tokens**, et non en
nombre d'enrichissements. Même raisonnement que la borne de conversation : un
plafond en nombre ne borne rien quand le coût unitaire varie du simple au
quintuple. Valeur de départ **300 000 tokens par jour**, dans le fichier de
configuration versionné, vérifiée côté serveur, **calculée en sommant les traces
du jour** — un compteur séparé divergerait à la première écriture ratée.

⚠️ **La notation nocturne n'entre pas dans l'enveloppe.** Son coût est faible et
prévisible, et surtout : un matin où France Travail renvoie quatre cents offres,
un plafond ferait **rater des offres** pour économiser vingt centimes. Règle en
une phrase : *l'enveloppe borne ce que Maxime déclenche, jamais ce que le système
fait de lui-même chaque nuit.*

**Deux enveloppes, et non une.** La conversation, quand elle viendra, aura la
sienne. Un plafond commun ferait qu'une matinée d'enrichissement bloquerait toute
discussion l'après-midi — un blocage que rien n'expliquerait à l'écran. Cette
enveloppe quotidienne est distincte de la borne des 80 000 tokens **par offre**,
qui borne le contexte d'une conversation et reste définitive.

### Condition de retour

L'automatique part en **Évolutions prévues** du PRD, pas au hors périmètre : ce
n'est pas un refus de principe. Il revient quand les deux chiffres qui lui
manquent existeront — **les seuils calibrés sur deux semaines de données réelles,
et le coût par enrichissement mesuré**. Les deux sortent de la v1.

Le retour coûterait une phase courte, le mécanisme d'agent étant identique. À deux
conditions, toutes deux déjà tenues par le plan : conserver **toutes les notes de
toutes les offres**, y compris sous le seuil, faute de quoi la sélection sera
incalibrable ; et créer dès la phase 6 la colonne `declenchement`, qui ne se
rajoute pas rétroactivement sur l'historique.

---

## 10. Données personnelles — la règle absolue remplacée par une règle mesurée

**20 août 2026, en séance de conception du schéma.**

La règle en vigueur disait « pas de données personnelles en base ». Maxime a
demandé à conserver les contacts des offres, jugeant utile d'avoir un nom et une
adresse pour candidater. Plutôt que d'arbitrer sur des principes, le champ
`contact` a été mesuré sur **235 offres réelles**.

**Ce que la mesure a montré :**

| Sous-champ | Présence | Contenu réel |
|---|---|---|
| `courriel` | 12/235 | **Zéro adresse.** Le champ porte une phrase : « Pour postuler, utiliser le lien suivant : https://… » |
| `nom` | 22/235 (9 %) | Nomme une personne dans 8 cas (3 %) ; sinon une agence France Travail ou un service |
| `coordonnees1/2/3` | 33/235 (14 %) | Adresses postales |
| `urlPostulation` | 16/235 (7 %) | Lien de candidature — **pas une donnée personnelle** |

**Décision** : conserver `contact.nom` et `contact.urlPostulation`, écarter le
reste **à la collecte**. Détail et garde-fous dans `docs/PRD.md` §
« Données personnelles ».

**Trois raisons de ne pas s'en tenir à la règle absolue :**

1. Elle interdisait `urlPostulation`, qui porte l'essentiel de la valeur d'usage
   et n'est pas une donnée personnelle. Une règle qui range dans le même sac un
   lien public et une adresse postale n'est pas une règle de sécurité, c'est un
   raccourci.
2. Le besoin exprimé — des noms, des courriels — **n'existe quasiment pas** :
   zéro courriel, 3 % de noms de personnes. Débattre du principe aurait coûté
   plus cher que mesurer.
3. Une règle absolue qu'on contourne en silence protège moins qu'une règle
   précise qu'on respecte. Le contournement, lui, ne laisse aucune trace écrite.

**Le garde-fou qui compte, et qui n'est pas cosmétique** : ces deux champs vont
en **colonnes nommées, jamais dans l'archive JSON brute**. Une colonne se
cherche, s'exclut d'un export, se vide d'une requête. Dans un bloc JSON, la
donnée devient invisible et voyage avec le bloc — export, session de débogage,
copier-coller dans un terminal. C'est ainsi que les données personnelles fuitent
en pratique : jamais par une décision, toujours par un oubli.

**Argument transférable en entreprise** : à la question « et les données
personnelles ? », « il n'y en a pas » est une réponse faible. « J'ai mesuré ce
qu'il y avait, gardé les deux champs utiles, écarté le reste avant écriture, et
mis ce qui reste en colonnes nommées pour pouvoir le supprimer d'une requête »
en est une forte.
