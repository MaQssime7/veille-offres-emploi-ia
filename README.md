# Veille offres emploi IA

**En ligne** : https://veille-offres-emploi-ia.vercel.app

Agent de veille quotidienne sur les offres d'emploi dans l'IA. Récupère les
offres via l'API France Travail, les évalue selon des critères de pertinence
définis, et présente un classement dans une interface web.

Chaque offre reçoit **deux notes séparées** : l'*intérêt* (le sujet
correspond-il ?) et l'*accessibilité* (ai-je une chance d'être retenu ?). Elles
ne sont jamais fusionnées, parce qu'un poste passionnant mais hors de portée et
un poste tiède mais accessible n'appellent pas la même décision.

## Architecture

```
GitHub Actions (cron quotidien)  →  pipeline Python  →  Supabase (Postgres)
                                                              ↑
                                    Vercel + Next.js + shadcn/ui (lecture serveur)
```

Les deux moitiés ne se parlent jamais directement : le pipeline écrit dans la
base, l'interface y lit. C'est ce découplage qui leur permet de tourner dans deux
langages, sur deux hébergements, à deux moments différents.

```
veille-offres-emploi-ia/
├── pipeline/     Python — collecte, notation, enrichissement
├── interface/    Next.js + shadcn/ui — le site
├── docs/         PRD, DESIGN, PLAN, DECISIONS, API France Travail
└── .github/      le cron quotidien et le déclenchement des agents
```

Le pipeline se découpe en trois étapes, et la frontière entre elles est la
décision d'architecture centrale du projet :

| Étape | Outil | Pourquoi |
|---|---|---|
| **Collecte** | Python, sans IA | Un appel d'API et une écriture en base n'ont besoin d'aucun modèle |
| **Notation** | API Messages (`anthropic`), sortie structurée | Une entrée, une sortie, aucune exploration : un agent y serait plus lent, plus cher et non déterministe pour aucun gain |
| **Enrichissement** | Claude Agent SDK | Tâche ouverte et multi-étapes sur l'entreprise : c'est exactement ce pour quoi un agent existe |

## Stack

- Python 3.11+ (pipeline)
- Next.js + shadcn/ui, hébergé sur Vercel (interface)
- Supabase / Postgres (persistance)
- GitHub Actions (déclenchement quotidien)
- API France Travail — Offres d'emploi v2
- API Anthropic — `anthropic` pour la notation, `claude-agent-sdk` pour
  l'enrichissement

## Configuration

Copier `.env.example` vers `.env` et renseigner les clés :

```bash
cp .env.example .env
```

Les variables attendues :

| Variable | Rôle |
|---|---|
| `FT_CLIENT_ID` | Identifiant client de l'API France Travail |
| `FT_CLIENT_SECRET` | Clé secrète de l'API France Travail |
| `ANTHROPIC_API_KEY` | Clé d'API Anthropic |
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_SECRET_KEY` | Clé secrète (`sb_secret_…`) — accès serveur à la base |

Le fichier `.env` n'est jamais commité — il est exclu par le `.gitignore`.

⚠️ `SUPABASE_SECRET_KEY` contourne toutes les règles de sécurité de la base. Elle
ne doit jamais atteindre le navigateur : ni dans une variable `NEXT_PUBLIC_*`, ni
dans un composant client, ni dans ce dépôt.

La clé **publiable** (`sb_publishable_…`) n'est volontairement pas utilisée : elle
existe pour qu'un navigateur interroge la base directement, ce que ce projet
s'interdit. Les anciennes clés `anon` et `service_role`, dépréciées fin 2026, sont
à désactiver une fois le pipeline en service.

Ce `.env` sert au pipeline en local. En production, les secrets vivent ailleurs
et jamais dans le dépôt : **secrets GitHub Actions** pour le pipeline, **variables
d'environnement Vercel** pour l'interface. Le site ne détient aucune clé de
modèle — il lit la base côté serveur, rien de plus.

### Les secrets du site, à part

Next.js lit son propre fichier, `interface/.env.local` — pas le `.env` de la
racine. Deux périmètres, deux fichiers :

```bash
cp interface/.env.example interface/.env.local
```

| Variable | Rôle |
|---|---|
| `MOT_DE_PASSE_SITE` | La porte. Tiré au hasard, jamais choisi de tête |
| `SECRET_SESSION` | Signe le cookie de session |

⚠️ `SECRET_SESSION` vaut exactement autant que le mot de passe : qui la détient
peut fabriquer un cookie valide **sans connaître le mot de passe**. La changer
déconnecte immédiatement toutes les sessions ouvertes.

⚠️ **Aucune variable de ce projet ne porte le préfixe `NEXT_PUBLIC_`.** Ce préfixe
publie la valeur dans le code source de la page servie au navigateur, sans le
moindre message d'erreur.

## Développement local

Le pipeline et l'interface se lancent séparément.

```bash
# Pipeline — Python
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
which python                 # doit pointer vers .venv, pas vers /opt/anaconda3

python -m pipeline.collecte                   # une collecte : fenêtre automatique
python -m pipeline.collecte --sans-ecrire     # tout sauf l'écriture
python -m pipeline.collecte --depuis-jours 7  # remplissage manuel

# Interface — Next.js
cd interface
npm install
cp .env.example .env.local   # puis remplir les deux secrets, voir Configuration
npm run dev                  # http://localhost:3000
```

⚠️ **Sans `interface/.env.local`, le site démarre mais personne ne peut entrer** :
la porte refuse tout le monde plutôt que de s'ouvrir, et l'écran de connexion
nomme la variable manquante.

⚠️ **Vercel doit être réglé sur `Root Directory = interface`.** Sans ce réglage,
il cherche un `package.json` à la racine, n'en trouve pas, et le déploiement
échoue.

### Migrations de la base

Le schéma vit dans `supabase/migrations/`, en fichiers SQL numérotés et commités.
Chaque fichier ne contient que le **changement** qu'il apporte, et **ne se modifie
plus une fois appliqué** : on corrige par une migration suivante, sinon git et la
base divergent en silence.

```bash
set -a; source .env; set +a               # charge SUPABASE_DB_PASSWORD
npx supabase@2.115.0 db push --yes        # applique ce qui manque
npx supabase@2.115.0 migration list       # local vs distant
```

⚠️ Ne jamais passer le mot de passe en argument (`--password …`) : il devient
visible dans la liste des processus. Le CLI lit `SUPABASE_DB_PASSWORD` depuis
l'environnement.

## Documentation

| Fichier | Contenu |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Ce que le produit doit faire, et ce qu'il refuse de faire |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Le système de design : jetons, contrastes vérifiés, composants propres au produit |
| [`docs/PLAN.md`](docs/PLAN.md) | Le découpage en phases, les décisions architecturales, le contenu de test |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Les décisions de cadrage et **leur justification** |
| [`docs/JOURNAL.md`](docs/JOURNAL.md) | Ce qui s'est passé, dans l'ordre, et les arbitrages en chemin |
| [`docs/API_FRANCE_TRAVAIL.md`](docs/API_FRANCE_TRAVAIL.md) | L'API Offres d'emploi v2 vérifiée en conditions réelles |
| [`supabase/migrations/`](supabase/migrations/) | **Le schéma de la base**, migration par migration, avec le *pourquoi* de chaque décision en commentaire |
| `CLAUDE.md` | Règles de travail et pièges techniques établis |

## Statut

Cadrage et planification terminés le 16 août 2026 : le périmètre produit est fixé
dans [`docs/PRD.md`](docs/PRD.md), le système de design dans
[`docs/DESIGN.md`](docs/DESIGN.md) — avec un aperçu HTML autonome,
`docs/design-preview.html`, qui recalcule ses contrastes dans la page — et le
découpage en sept phases dans [`docs/PLAN.md`](docs/PLAN.md).

**La stack est posée et les hébergements sont en place** (17 août 2026).

- `interface/` : Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui sur le
  moteur `radix`. Les jetons de couleur, les trois polices et le rayon de bordure
  du `DESIGN.md` sont appliqués — le preset d'installation avait posé une palette
  grise et omis le serif de titrage.
- **Supabase** : projet créé en région Paris.
- **Vercel** : déployé, `Root Directory = interface`, fonctions en région Paris.

La page d'accueil était alors une **page de contrôle temporaire**, qui prouvait
que la chaîne fonctionnait — trois polices, jetons de couleur, mode sombre.
**Elle a été remplacée par l'écran du matin le 30 août 2026** (voir plus bas).
Depuis le 21 août, tout le site est derrière la porte.

**Le schéma, posé le 20 août 2026.**

Avant de figer une seule table, l'API France Travail a été interrogée sur 235
offres réelles. La mesure a invalidé deux hypothèses du plan et fermé une question
laissée ouverte : la description est plafonnée à 5 000 caractères et l'endpoint de
détail n'apporte rien de plus · 44 % des offres ne nomment pas l'entreprise et
54 % n'indiquent aucun salaire · le champ structuré `experienceExige` existe bien,
ce qui évite de faire déduire l'expérience par le modèle. Tout est consigné dans
[`docs/API_FRANCE_TRAVAIL.md`](docs/API_FRANCE_TRAVAIL.md).

Deux tables d'abord — `executions_veille` et `offres` — les trois autres
**délibérément reportées à la phase 6**, au motif que la forme d'une fiche
d'enrichissement dépend de ce que l'agent produira. Le report a payé : quand elles
sont arrivées, leur forme ne ressemblait pas à ce qu'on aurait deviné. Le registre
public des entreprises, interrogé sur cinq sociétés réelles *avant* d'écrire une ligne
de SQL, ne rend qu'**un seul exercice comptable — le dernier déposé**, parfois vieux de
huit ans. Un chiffre d'affaires sans son année n'est donc pas une imprécision mais un
mensonge, et une contrainte rend désormais le couple indissociable.

Le schéma n'a pas été relu, il a été **attaqué** : 18 contrôles vérifient qu'une
clé publique ne peut rien lire ni écrire (HTTP 401), qu'un échec sans motif est
refusé, qu'un identifiant mal formé est rejeté, qu'une offre ne peut pas être
rattachée à une exécution inexistante, qu'une double insertion ne crée qu'une
ligne, et qu'une exécution portant des offres ne peut pas être supprimée. Ce test
a d'ailleurs révélé un vrai défaut invisible à la relecture — le serveur n'avait
aucun droit sur ses propres tables — corrigé par une migration suivante.

### La collecte tourne, toute seule

Le pipeline Python collecte pour de vrai depuis le 21 août 2026, et **sans intervention
depuis le 26** : un cron GitHub Actions le réveille chaque nuit à 02:23 UTC. **535 offres
réelles en base**, une quinzaine d'exécutions tracées. Cinq modules, une responsabilité chacun —
le trousseau de clés, le client France Travail, la normalisation, le stockage,
l'orchestration. Aucun ne connaît le métier des autres : quand une nuit échoue, le
motif enregistré en base dit lequel a lâché.

Trois faits ont été **mesurés contre l'API réelle avant d'écrire une ligne**, et
deux ont invalidé des hypothèses déjà écrites :

- **La recherche France Travail n'indexe pas la description d'une annonce.** Un mot
  pris dans le corps d'une offre ne la retrouve pas. Une offre au titre banal dont l'IA
  n'apparaît que dans le texte est invisible à **toute** liste de mots-clés. C'est ce fait
  qui justifie de faire *lire* les annonces par un modèle plutôt que de les filtrer sur
  leurs métadonnées. *(La seconde moitié de ce constat — « la recherche porte sur
  l'intitulé, le libellé ROME, l'appellation et les compétences » — s'est révélée fausse
  le 28 août. Voir plus bas.)*
- **Trois largeurs de collecte ont été chiffrées** avant d'en choisir une : 0,80 $,
  3 $ ou 173 $ par mois selon qu'on ratisse étroit, moyen ou tout l'Île-de-France.

Le 26 août, ces critères ont été **remesurés** — et deux des conclusions initiales étaient
fausses. C'est la partie du projet dont je suis le plus content, parce que c'est la mesure
qui a tranché contre le raisonnement :

- **« Le vocabulaire est fermé et français » était faux**, et c'était l'erreur la plus
  coûteuse de la configuration. `AI` en anglais ramène **28 offres nettes par mois** qu'aucun
  autre critère ne trouvait. *(La suite de ce constat — « `GenAI`, `LLM`, `copilot`, `prompt`
  et `RAG` ne renvoient plus zéro non plus » — n'a pas tenu deux jours : voir plus bas. Un
  terme qui ramène une offre ne ramène rien, il fait du bruit.)*
- **Les codes ROME ne rattrapaient pas ce que le lexique ratait.** Le raisonnement était bon —
  un filtre par famille de métier, structurel, indépendant des mots employés. La mesure l'a
  démenti : les six codes apportaient 445 offres nettes par mois pour **zéro offre au-dessus
  de 30/100** sur cinquante notées au hasard. Tous retirés.
- Corollaire non évident : **un code ROME dont le libellé contient un mot déjà cherché
  n'apporte rien**, puisque la recherche indexe ce libellé. `M1889` « Ingénieur en
  Intelligence Artificielle » avait la meilleure qualité mesurée de tous les codes, et un
  apport net de **zéro**.

Le 28 août, une troisième mesure a démenti le fait le plus structurant du projet.

En cherchant pourquoi `intelligence artificielle` ramenait « Développeur Mulesoft » et
« Comptable support logiciel », j'ai cherché le terme dans la **charge brute complète** de
chaque offre — la réponse intégrale de l'API, pas seulement les colonnes extraites.
**26 offres sur 40 ne le contiennent nulle part.** Puis ce test :

| Recherche (30 jours, Île-de-France) | Offres |
|---|---|
| `intelligence artificielle` | 168 |
| `intelligence` seul | 64 |
| `artificielle` seul | 43 |
| union des deux | **64** |

**125 des 168 ne sont ramenées par aucun des deux mots pris isolément.** Le moteur ne fait
ni un ET ni un OU : l'expression entière déclenche un élargissement au *domaine*. Le
paramètre `motsCles` n'est donc **ni textuel, ni compositionnel** — on ne peut pas prédire
ce que ramène `X Y` en mesurant `X` et `Y` séparément.

La règle de travail ne change pas — un critère se mesure, jamais ne se déduit — mais son
motif, si : ce n'est pas que l'index est *étroit*, c'est qu'il est **opaque**. Corollaire
coûteux vérifié dans la foulée : `agents` rend **2 718 offres** (agent d'accueil, agent de
sécurité).

Dans le même mouvement, un balayage de **50 termes candidats** a montré que le rappel est
saturé : tout le lexique IA spécialisé (`consultant IA`, `IA générative`, `RAG`, `copilot`,
`MLOps`, `multi-agents`…) a un apport net de **zéro**, et le vocabulaire anglais pointu
(`LLM`, `GPT`, `OpenAI`, `LangChain`, `embeddings`, `NLP`) n'existe pas sur France Travail.
Un seul terme est entré : `chatbot`, pour une offre par mois.

**Et un piège de méthode, qui vaut plus que ces listes :** l'apport net n'est pas une
propriété du terme, mais du couple *(terme, configuration)*. En retirant un mot-clé de la
liste, des termes mesurés à zéro redeviennent utiles — donc toute mesure d'apport net se
périme dès que la configuration bouge.

- **Aucune métadonnée France Travail ne peut servir de filtre — sauf le type de contrat.**
  La `qualification` est vide sur 86 des 123 offres notées, et 11 des 20 meilleures sont
  dans ce trou : filtrer sur « Cadre » perdrait 70 % des bonnes offres. Avec
  `experienceLibelle`, faux une fois sur deux, ça fait deux champs inexploitables. C'est le
  même constat que le premier, par un autre chemin : **il faut lire le texte.** Le
  `typeContrat` fait exception — renseigné sur 560 offres sur 560 — et sert depuis le
  28 août à ne collecter que des CDI.

Effet mesuré le 26 août : le volume tombe de 707 à **294 offres par mois**, la moyenne
d'intérêt monte de 7,7 à **16,2**, et la part d'offres au-dessus de 50/100 passe de 1 % à
**7 %**. Après le tri du 28 août — `deploiement` et `RPA` retirés, `chatbot` ajouté, CDI
seulement — le volume descend à **208 offres par mois**, pour environ **1,25 $** de notation
mensuelle. *(La qualité, elle, n'a pas été remesurée depuis le 26 : les 16,2 et les 7 %
ci-dessus datent de cette configuration-là, sur un échantillon de 15 offres.)*

Le code a ensuite été relu par une revue automatisée qui a trouvé **15 défauts**,
tous corrigés — dont une fuite de donnée personnelle vers un journal public, et une
comparaison entre deux horloges différentes qui aurait fait échouer toute nuit sans
nouvelles offres.

### La porte est posée

Le site entier est derrière un mot de passe unique vérifié côté serveur (21 août
2026). La session tient dans un cookie signé en HMAC-SHA256 — **rien en base** :
le serveur recalcule la signature et refuse si elle ne colle pas.

Deux partis pris qui se défendent :

- **`proxy.ts` n'a aucun `matcher`** : il protège toute adresse par défaut, y
  compris celles qui n'existent pas encore. Énumérer les adresses à protéger
  laisserait ouverte la prochaine qu'on ajoute.
- **La serrure n'est pas dans le proxy.** Un middleware Next.js a déjà été
  contournable par un simple en-tête HTTP (CVE-2025-29927) : la vérification qui
  compte est `exigerSession()`, appelée dans la page elle-même.

**Phase 1 close le 26 août 2026.** Le site est en ligne derrière son mot de passe, l'écran
`/offres` lit la base, la collecte tourne toute seule, et les valeurs de mise en page ne sont
plus des suppositions : elles ont été mesurées contre 373 offres réelles.

La clôture a servi à quelque chose — elle a attrapé un défaut créé le matin même. Resserrer
la ligne d'offre sans toucher au squelette de chargement faisait sauter la page de 56 px
quand les offres arrivaient ; ni le compilateur ni le linter ne bronchent, les deux fichiers
étant cohérents séparément. Le rythme vertical vit désormais dans un module partagé, importé
par la ligne et par son squelette : la contrainte est portée par le code, plus par un
commentaire qu'il fallait avoir lu.

### Les deux notes, et le refus de n'en faire qu'une

**Phase 2, 26 août 2026.** Chaque offre porte une note d'**intérêt** et une note
d'**accessibilité**, séparées, chacune avec la phrase qui l'explique. La liste se classe par
intérêt décroissant.

Le produit repose sur le **refus de fusionner ces deux notes** en un « 87 % de match ». Un cas
réel montre pourquoi : « Alternant Ingénieur IA Agentique » obtient **85 en intérêt et 15 en
accessibilité** — le poste est exactement le bon, et c'est une alternance, donc hors de portée.
Un score unique aurait rendu cette offre indistinguable d'une offre médiocre et accessible.

**Les justifications se lisent à plat dans la liste**, jamais derrière une infobulle ni un
dépliage. Ce n'est pas un choix de mise en page : c'est le seul mécanisme qui révèle une
notation mal étalonnée. Il a servi dès le premier jour — sur une annonce réseau « débutant
accepté » exigeant Cisco, Aruba et Palo Alto, le barème commandait 90 et le modèle a mis 40.
**C'est le barème qui avait tort**, et il a été corrigé.

Deux décisions d'ingénierie qui se défendent :

- **La frontière agent / appel d'API.** La notation est un appel unique à sortie structurée,
  pas un agent : une entrée, une sortie, aucune exploration. Un agent y serait plus lent, plus
  cher et non déterministe pour aucun gain. Le Claude Agent SDK est réservé à l'enrichissement,
  qui est une vraie tâche ouverte.
- **Le cache de prompt a un plancher de 1 024 tokens, et en dessous il ne dit rien** — pas
  d'erreur, pas de message, juste un compteur qui reste à zéro pendant qu'on repaie le préfixe
  à chaque offre. Le préfixe fait 3 144 tokens, le cache mord, et le module journalise les
  quatre compteurs à chaque appel pour que le jour où il cesserait de mordre se voie.

Coût réel mesuré : **0,6 centime par offre**, cache chaud.

### La fiche d'une offre — phase 3, livrée le 28 août 2026

`/offres/[identifiant]` : entête, résumé, les deux notes avec leurs
justifications, le classement France Travail, la description intégrale repliée,
et comment candidater.

Trois choix qui se défendent en entretien :

- **Colonne unique, et c'est mesuré.** Le `DESIGN.md` prévoyait deux colonnes, la
  droite portant l'enrichissement — qui n'arrive qu'en phase 6. Le résumé fait
  122 caractères en médiane et manque sur les offres non notées : deux colonnes
  laisseraient 404 px de vide sur toute la hauteur.
- **Aucun composant client à ce stade, donc aucune fuite possible.** La page lit
  `contact_nom`, la seule donnée nominative du projet. Tant que toute la chaîne
  reste en composants serveur, les props ne traversent pas vers le navigateur —
  seul le rendu traverse. D'où le dépliage de la description en `<details>` natif
  plutôt qu'un composant à état. **La phase 4 a levé cette propriété** : voir
  ci-dessous ce qui la remplace.
- **Deux verrous indépendants sur l'identifiant**, qui vient de la barre
  d'adresse : format refusé avant la base, valeur encodée au point de passage
  unique. L'injection a été rejouée contre la vraie base — sans encodage, un
  `&select=*` placé avant le `select` légitime rend 44 colonnes dont l'archive
  complète.

### Trier sa matinée — phase 4, livrée le 29 août 2026

Trois statuts en un clic (à traiter, candidaté, écarté) depuis la liste comme
depuis la fiche, un filtre qui vit **dans l'adresse**, et une note libre par offre
qui s'enregistre sans bouton. C'est la première fois que l'interface **écrit** en
base : jusque-là, seul le pipeline Python écrivait, seul et de nuit.

Quatre choix qui se défendent en entretien :

- **La propriété « tout en composants serveur » est tombée, et ce qui la remplace
  est une discipline de props.** Les boutons de statut et le champ de note sont
  des composants clients : on ne leur passe que des valeurs scalaires —
  `identifiant`, `statut` — jamais l'objet `offre`, qui enverrait ses vingt-deux
  colonnes dans le document. `<BoutonsStatut offre={offre} />` compilerait sans la
  moindre erreur. **Le seul garde-fou restant est la mesure**, refaite après chaque
  nouveau composant client : douze noms de colonnes interdites cherchés dans le
  document reçu par le navigateur, plus le contenu d'une note cherché dans la liste
  et sur la fiche d'une autre offre — aucun, avec témoin positif.
- **L'état optimiste est le bon patron pour un statut et le mauvais pour un
  texte.** `useOptimistic` retombe sur la valeur du serveur en fin de transition :
  parfait pour ramener un statut à la vérité de la base après un échec, destructeur
  pour un paragraphe en cours de frappe, qu'il effacerait sous les doigts. Le bon
  patron dépend de qui détient la vérité.
- **Le vide d'un champ à enregistrement automatique n'est pas la chaîne vide.**
  Effacer une note produit `"   \n"` : sans normalisation en `NULL` avant écriture,
  la contrainte de la base répond 400 et l'écran affiche « échec » sur le geste le
  plus banal qui soit. La borne de 20 000 caractères est vérifiée trois fois —
  attribut HTML (confort), action serveur (le contrôle qui compte), contrainte en
  base (le dernier mot) — parce qu'un attribut HTML se retire en trois clics.
- **Un clic qui atteint toujours l'offre visée.** Trier une offre la retire du
  filtre et les suivantes remontent d'un cran : un second clic au même endroit
  triait une autre offre. Le verrou suit `useTransition` et non la fin de l'appel
  serveur — mesuré, la réponse arrive à +80 ms et la liste se réorganise à +900 ms.

### L'écran du matin — phase 5, livrée le 30 août 2026

`/` n'est plus une page de contrôle : c'est le **compte rendu de la nuit**. Les
offres de la dernière collecte réussie qui restent à traiter et qui dépassent le
seuil d'intérêt, classées par intérêt décroissant, sous un indicateur de santé de
la veille partagé avec le poste de travail, et une carte de passage chiffrée vers
le reste de la base.

Quatre choses qui se défendent en entretien :

- **Un écran vide doit dire LEQUEL des vides il montre.** Le plan en prévoyait
  trois ; six ont été livrés, et le quatrième n'était pas prévu : *« la notation
  n'a pas tourné »*. Sans lui, une collecte réussie suivie d'une notation tombée
  s'affichait « journée calme » — le système annonçait une bonne nouvelle un matin
  où il était à moitié en panne. C'est la classe de défaut qui ne se remarque
  jamais : une fausse alerte se voit tout de suite, un « tout va bien » qui ment
  se croit. L'**ordre** des tests qui départagent ces six cas *est* la logique, et
  il est éprouvé par des tests unitaires — la panne de notation ne se provoque pas
  à la main.
- **Un seuil se mesure, il ne s'estime pas.** Le cadrage fixait l'affichage à 50
  sur 100. Mesuré sur les six dernières collectes réelles, l'écran était alors vide
  **quatre matins sur six**, et 10 offres sur 574 dépassaient ce score. Abaissé à
  **35** : deux matins vides, 20 offres. Descendre à 25 n'en ajouterait que 7 —
  le gain s'aplatit. Le seuil est figé par un test : le changer casse la suite au
  lieu de passer inaperçu. **Suite le 31 août** : il vaut désormais **40** et
  s'applique aux deux écrans — voir plus bas.
- **France Travail publie le même poste deux fois, et la déduplication par
  identifiant ne peut pas le voir.** Une version « f/h », une version « (H/F) »,
  deux identifiants, deux lignes en base : **29 annonces en trop sur 574**. L'écran
  du matin les regroupe — une ligne par poste, la mieux notée, un cartouche
  « 2 annonces », et un clic de statut qui traite le poste entier. **Rien n'est
  effacé** : le rapprochement se fait à l'affichage, jamais à la collecte, et le
  poste de travail reste exhaustif. ⚠️ Ces doublons révèlent au passage un fait
  plus gênant qu'eux : le modèle note parfois **68 et 45** deux annonces du même
  poste, pour des justifications qui disent la même chose.
- **Un squelette de chargement s'aligne sur ce que SA page affiche le plus
  souvent.** Trois barres avaient été posées par analogie avec le poste de travail,
  qui en pose quatre. La mesure dit l'inverse : un panneau vide fait 230 px, une
  ligne d'offre 222 — **une** barre cale donc les deux cas, là où trois se
  trompaient de 450 px dans les deux à la fois. ⚠️ La première vérification de ce
  calage était fausse : elle mesurait la hauteur du conteneur, qui porte `flex-1`
  et vaut donc la hauteur de la fenêtre quel que soit son contenu. Elle annonçait
  « écart nul » avec assurance. **Un chiffre qui tombe pile doit éveiller le
  soupçon avant de rassurer.**

### Le coup de cœur — 30 août 2026, hors phase

Un cœur posé sur une offre, et un sixième filtre pour les retrouver. Demandé en
une phrase — *« un bouton à côté de à traiter et écarté, qui serait liké »* — et
c'est la forme, pas la fonctionnalité, qui a demandé une décision.

Trois choses qui se défendent en entretien :

- **La demande décrivait un bouton, elle impliquait une architecture.** Un
  quatrième statut aurait été la lecture littérale, et elle produisait deux effets
  que personne ne voulait : un statut étant **exclusif**, une offre likée cessait
  d'être « à traiter » — donc quittait l'écran du matin — et **candidater effaçait
  le cœur**, vidant la liste des coups de cœur à mesure qu'on avance. Les deux
  formes ont été montrées avec leur conséquence concrète avant d'écrire une ligne.
  Le choix retenu, un **marqueur transverse au statut**, n'était pas une invention :
  l'onglet « Nouveau » a déjà cette forme, compte non additionnable compris.
- **Une seule colonne, parce qu'une forme vaut mieux qu'une contrainte.**
  `coup_de_coeur_a` est un `timestamptz` : `NULL` = pas de cœur, une date = un
  cœur. Le réflexe — un booléen *et* sa date — ouvrait un état incohérent (`true`
  sans date) qu'aucune contrainte simple ne ferme ; le projet avait déjà payé cet
  écart en phase 4. Ici l'incohérence est **inexprimable**, donc il n'y a rien à
  faire respecter.
- **Trois défauts trouvés en mesurant, aucun visible à l'œil.** Le cœur, n'ayant
  pas de libellé, mesurait 30 px contre 24,5 pour ses voisins : les 200 lignes
  grandissaient de 3 px et le squelette de chargement l'ignorait. Un
  `hover:bg-accent` ajouté par réflexe glissait un fond lavande sous le cœur, qui
  tombait de 3,66:1 à **2,80:1** — sous le plancher, et seulement au survol, l'état
  qu'aucune capture ne montre. Et le squelette de la fiche portait deux largeurs
  périmées depuis un changement d'échelle antérieur. ⚠️ Deux tentatives de mesure
  fausses ont précédé la bonne : **un bloc de mesure se substitue à l'original, il
  ne se pose pas à côté** — sinon il lui vole sa largeur et se replie différemment.

**Où en est la phase 6** : le mécanisme complet est en place et tourne en production —
un clic ouvre une demande, l'interface appelle l'API GitHub, le workflow part, et les
étapes remontent à l'écran par sondage. Mesuré sur un vrai clic : **agent démarré en
16 secondes, conclu en 24**, là où le plan en alloue 300. Le tout a été construit et
prouvé **sans appeler le modèle une seule fois** : la tranche suivante branche l'agent
réel.

Deux choses valent d'être retenues de cette tranche. La garde contre le double clic est
un **index unique partiel**, pas du code : deux requêtes simultanées, et la seconde est
refusée par Postgres avant d'atteindre la moindre ligne de TypeScript — une vérification
en code laisserait une fenêtre entre la lecture et l'écriture, et cette fenêtre-là coûte
une facture. Et l'enveloppe de dépense a failli avoir un trou béant : les compteurs de
tokens restent vides tant qu'un enrichissement tourne, si bien que dix lancés dans la
même minute lisaient tous « zéro consommé ». Un enrichissement en vol **réserve**
désormais son coût présumé, et ce calcul — le seul code qui protège d'une facture
emballée — est une fonction pure couverte par huit tests.

### Le seuil d'affichage et la corbeille — 31 août 2026, hors phase

`/offres` montrait 580 lignes dont **434 jamais notées** : l'arriéré d'avant la mise
en place du cron, que la notation ne reprendra pas puisqu'elle ne tourne que sur la
dernière collecte. Les quelques annonces à lire s'y noyaient. Deux gestes répondent à
ça, et les deux ont commencé par une mesure plutôt que par du code.

- **Le seuil ne s'est pas choisi rond, il s'est lu dans la distribution.** Les 146
  offres notées font deux paquets séparés par un vide : **115 sous 20**, quinze entre
  20 et 39, **seize au-dessus de 40**. Le seuil coupe juste après le trou. Passer à
  50 — l'autre option envisagée — n'aurait retiré que **quatre** annonces, toutes
  dans la bande 40-49 : on aurait coupé dans ce qui reste, plus dans le bruit.
- **Cacher n'est pas supprimer, et c'est cette propriété qui rend la décision
  réversible.** Le pipeline continue de tout collecter et de tout noter : baisser le
  seuil rend les offres immédiatement, sans recollecte et sans repayer une notation.
  France Travail dépublie ses annonces — une ligne effacée ne revient jamais.
- **Le seuil filtre ce que le modèle propose, jamais ce qu'on a désigné soi-même.**
  « Coup de cœur » et « Candidaté » y échappent : sinon une offre likée à 30 quitterait
  ses coups de cœur, et sans le moindre message, puisqu'une offre cachée ne laisse
  aucune trace. Ce qui a imposé **trois régimes** et non un booléen : avec deux états,
  l'onglet « Toutes » cessait d'être un sur-ensemble et pouvait afficher **moins** que
  la pilule voisine.
- **`NULL >= 40` est faux en SQL** : une offre pas encore notée disparaît aussi. C'est
  ce qui écarte les 434 gratuitement — et ce qui fait qu'un ratage de la notation vide
  l'écran sans qu'aucun job ne rougisse. D'où « N retenues **sur M** » affiché en
  permanence : l'écart est la seule chose qui trahisse ce cas.
- **La corbeille n'est pas un quatrième statut**, pour la raison déjà apprise avec le
  coup de cœur : un statut est exclusif, donc retirer une offre candidatée effacerait
  la trace de la candidature. C'est un marqueur transverse, vérifié contre la base —
  après écriture, le statut valait toujours `a_traiter`. Et elle se distingue
  d'« Écarté », qui existait déjà : « Écarté » dit *regardé, pas pour moi* et l'offre
  reste dans son onglet ; la corbeille dit *ne me la remontre jamais*.
- ⚠️ **Un défaut vu en vrai, pas en théorie.** Pendant les essais, une seconde offre
  est partie à la corbeille sans avoir été visée. Cause établie par le journal du
  serveur : la liste met **~900 ms** à se réorganiser après la fin d'une action, et le
  bouton restait actif sur la ligne qui prenait la place — une seule barre d'annulation
  existait, la seconde suppression a écrasé la première sans un mot. Le bouton est
  désormais désactivé pendant l'écriture. L'incident vaut plus que le correctif : il
  s'est produit dans la première demi-heure d'usage, sur le seul geste qui n'est pas
  réversible passé huit secondes.
- **Et le bouton ne se cliquait même pas au départ** : la ligne est un « lien-carte »
  dont le lien étendu couvre toute la surface et avalait le clic. À la souris, on
  aurait ouvert la fiche en croyant avoir supprimé — aucune erreur nulle part.

L'en-tête a été refaite le même soir : une pilule blanche flottant sur le fond lavande,
deux onglets, deux actions en icônes rondes. **Sans logo ni nom de marque** — le produit
n'en a pas, et en inventer un pour remplir l'emplacement du gabarit aurait été pire que
le vide.
