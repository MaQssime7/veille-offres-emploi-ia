# Veille offres emploi IA

Agent de veille quotidienne sur les offres d'emploi dans l'IA.
Récupère les offres via l'API France Travail, les évalue selon des
critères de pertinence définis, et génère une synthèse classée.

## Stack

- Claude Agent SDK
- API France Travail (Offres d'emploi v2)
- SQLite

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
| `ANTHROPIC_API_KEY` | Clé d'API Anthropic (Claude Agent SDK) |

Le fichier `.env` n'est jamais commité — il est exclu par le `.gitignore`.

## Statut

En cours de développement.
