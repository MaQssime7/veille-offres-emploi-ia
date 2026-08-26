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

La page d'accueil actuelle est une **page de contrôle temporaire** : elle prouve
que la chaîne fonctionne — trois polices, jetons de couleur, mode sombre — et sera
remplacée en phase 1. Depuis le 21 août, elle est derrière la porte comme le
reste du site.

**Phase 1 en cours — le schéma est en base** (20 août 2026).

Avant de figer une seule table, l'API France Travail a été interrogée sur 235
offres réelles. La mesure a invalidé deux hypothèses du plan et fermé une question
laissée ouverte : la description est plafonnée à 5 000 caractères et l'endpoint de
détail n'apporte rien de plus · 44 % des offres ne nomment pas l'entreprise et
54 % n'indiquent aucun salaire · le champ structuré `experienceExige` existe bien,
ce qui évite de faire déduire l'expérience par le modèle. Tout est consigné dans
[`docs/API_FRANCE_TRAVAIL.md`](docs/API_FRANCE_TRAVAIL.md).

Deux tables sont créées — `executions_veille` et `offres` — en deux migrations
versionnées. Les deux autres sont **délibérément reportées à la phase 6** : la
forme d'une fiche d'enrichissement dépend de ce que l'agent produira, et rien ne
l'alimente d'ici là.

Le schéma n'a pas été relu, il a été **attaqué** : 18 contrôles vérifient qu'une
clé publique ne peut rien lire ni écrire (HTTP 401), qu'un échec sans motif est
refusé, qu'un identifiant mal formé est rejeté, qu'une offre ne peut pas être
rattachée à une exécution inexistante, qu'une double insertion ne crée qu'une
ligne, et qu'une exécution portant des offres ne peut pas être supprimée. Ce test
a d'ailleurs révélé un vrai défaut invisible à la relecture — le serveur n'avait
aucun droit sur ses propres tables — corrigé par une migration suivante.

### La collecte tourne, toute seule

Le pipeline Python collecte pour de vrai depuis le 21 août 2026, et **sans intervention
depuis le 26** : un cron GitHub Actions le réveille chaque nuit à 02:23 UTC. **373 offres
réelles en base**, 10 exécutions tracées. Cinq modules, une responsabilité chacun —
le trousseau de clés, le client France Travail, la normalisation, le stockage,
l'orchestration. Aucun ne connaît le métier des autres : quand une nuit échoue, le
motif enregistré en base dit lequel a lâché.

Trois faits ont été **mesurés contre l'API réelle avant d'écrire une ligne**, et
deux ont invalidé des hypothèses déjà écrites :

- **La recherche France Travail n'indexe pas la description d'une annonce.** Un mot
  pris dans le corps d'une offre ne la retrouve pas. La collecte a donc deux filets :
  des mots-clés, et un filtre par famille de métier — structurel, indépendant des
  mots employés — dont le modèle lira ensuite les descriptions.
- **Son vocabulaire est fermé et français.** « IA générative », « agent IA »,
  « LLM », « chatbot », « MLOps » renvoient tous zéro offre.
- **Trois largeurs de collecte ont été chiffrées** avant d'en choisir une : 0,80 $,
  3 $ ou 173 $ par mois selon qu'on ratisse étroit, moyen ou tout l'Île-de-France.

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

⚠️ Le code de la porte n'est **pas encore en ligne** : les deux variables
d'environnement ne sont pas posées chez Vercel.

**Prochaine étape** : remesurer la mise en page contre le contenu réel, puis clôturer la
phase 1. Le site est en ligne derrière son mot de passe, l'écran `/offres` lit la base, et
la collecte tourne toute seule.
