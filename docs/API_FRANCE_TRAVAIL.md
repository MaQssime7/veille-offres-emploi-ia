# API France Travail — Offres d'emploi v2

Référence d'implémentation du client de collecte. Le `CLAUDE.md` renvoie ici
plutôt que de porter ces 60 lignes à chaque session.

**Paramètres vérifiés en conditions réelles le 15 août 2026** — authentification
et appel de recherche testés avec succès contre les identifiants du projet. Ne
pas les rechercher à nouveau, ils sont établis.

## Authentification

OAuth2 `client_credentials`, sans interaction utilisateur. Un jeton de courte
durée est obtenu contre l'identifiant et la clé secrète, puis envoyé en
`Authorization: Bearer` sur chaque appel.

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

## Recherche d'offres

```
GET https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search
Authorization: Bearer <jeton>
```

**Quota : 10 appels par seconde** pour cette application. Le pipeline doit
espacer ses appels — une boucle de pagination sans temporisation le dépassera.

## Pièges de pagination — le point qui casse en pratique

Le paramètre `range` prend la forme `0-149` :

- Maximum **150 résultats par appel**.
- Plafond d'environ **1150 offres par recherche** (index maximum ~1149).
  Au-delà, il faut affiner la requête — typiquement en découpant par date de
  création — et non paginer davantage.
- L'en-tête `Content-Range` de la réponse donne le total réellement disponible.
  C'est lui qui doit piloter la boucle de pagination, pas une constante en dur.
- Une réponse partielle renvoie **HTTP 206**, pas 200. Un code qui teste
  `status_code == 200` rate silencieusement toutes les pages intermédiaires.

**Ce plafond n'est pas un problème en régime quotidien.** Chaque passage ne
récupère que les offres créées depuis la veille : sur « IA + Île-de-France »,
cela se compte en dizaines. Le découpage par date de création n'est nécessaire
que pour un éventuel rattrapage initial d'historique.

## Cas limites à gérer dès la première version

Personne ne les rattrapera ensuite :

- **Jeton expiré en milieu de pagination** — le renouveler et reprendre, pas
  planter.
- **Réponse vide** — zéro offre n'est pas une erreur.
- **Quota d'appels dépassé.**
- **Offre déjà présente en base** — déduplication sur l'identifiant de l'offre,
  jamais sur le titre.

## À confirmer sur une réponse réelle

France Travail exposerait l'expérience exigée dans un **champ structuré**
(débutant accepté / souhaitée / exigée), et pas seulement dans le texte libre de
la description. Ce serait un signal fiable pour l'axe accessibilité de la
notation, sans dépendre de la lecture du modèle. **Non vérifié** — à contrôler
en écrivant la collecte.
