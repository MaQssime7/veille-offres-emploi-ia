# Veille offres emploi IA

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
| `SUPABASE_SERVICE_ROLE_KEY` | Clé d'accès serveur à la base |

Le fichier `.env` n'est jamais commité — il est exclu par le `.gitignore`.

⚠️ `SUPABASE_SERVICE_ROLE_KEY` contourne toutes les règles de sécurité de la
base. Elle ne doit jamais atteindre le navigateur : ni dans une variable
`NEXT_PUBLIC_*`, ni dans un composant client, ni dans ce dépôt.

## Documentation

| Fichier | Contenu |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Ce que le produit doit faire, et ce qu'il refuse de faire |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Le système de design : jetons, contrastes vérifiés, composants propres au produit |
| [`docs/PLAN.md`](docs/PLAN.md) | Le découpage en phases, les décisions architecturales, le contenu de test |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Les décisions de cadrage et **leur justification** |
| [`docs/API_FRANCE_TRAVAIL.md`](docs/API_FRANCE_TRAVAIL.md) | L'API Offres d'emploi v2 vérifiée en conditions réelles |
| `CLAUDE.md` | Règles de travail et pièges techniques établis |

## Statut

Cadrage et planification terminés le 16 août 2026 : le périmètre produit est fixé
dans [`docs/PRD.md`](docs/PRD.md), le système de design dans
[`docs/DESIGN.md`](docs/DESIGN.md) — avec un aperçu HTML autonome,
`docs/design-preview.html`, qui recalcule ses contrastes dans la page — et le
découpage en huit phases dans [`docs/PLAN.md`](docs/PLAN.md).

Prochaine étape, l'installation de la stack, puis la phase 1 : la porte, la
collecte et les premières offres réelles à l'écran. **Aucun code n'est encore
écrit.**
