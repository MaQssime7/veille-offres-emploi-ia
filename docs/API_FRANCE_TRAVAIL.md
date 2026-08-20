# API France Travail — Offres d'emploi v2

Référence d'implémentation du client de collecte. Le `CLAUDE.md` renvoie ici
plutôt que de porter ces lignes à chaque session.

**Paramètres vérifiés en conditions réelles** — authentification et appel de
recherche testés avec succès contre les identifiants du projet le 15 août 2026,
forme des réponses relevée sur 50 offres réelles le 20 août 2026. Ne pas les
rechercher à nouveau, ils sont établis.

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

### Bornage de la requête — vérifié le 20 août 2026

| Paramètre | Valeur retenue | Pourquoi |
|---|---|---|
| `region` | `11` (Île-de-France) | **`departement` est plafonné à 5 valeurs** et l'Île-de-France en compte 8 : `departement=75,77,78,91,92,93,94,95` renvoie une HTTP 400 « Le nombre de départements maximum autorisé pour la recherche est de 5 ». `region` est la seule voie |
| `motsCles` | plusieurs recherches, union déduplique | Sans mots-clés, l'Île-de-France seule renvoie **68 856 offres**, très au-dessus du plafond de pagination |
| `minCreationDate` / `maxCreationDate` | ISO 8601 `AAAA-MM-JJTHH:MM:SSZ` | **Les deux sont indissociables.** Fournir `minCreationDate` seul renvoie une HTTP 400 : « les paramètres sont dépendants et doivent être renseignés ensemble » |
| `range` | `0-149` maximum | Voir pagination |

**Volumes observés le 20 août 2026** (région 11) — ce sont les ordres de grandeur
qui dimensionnent la collecte quotidienne :

| Mots-clés | Total | Créées dans les dernières 24 h |
|---|---|---|
| `intelligence artificielle` | 246 | **6** |
| `machine learning` | 116 | — |
| `data scientist` | 74 | — |
| `agent IA` | 9 | — |
| `LLM` | 3 | — |
| *(aucun)* | 68 856 | 2 745 |

Le régime quotidien se compte donc en **unités, pas en centaines**. Le plafond de
pagination n'est jamais approché avec une fenêtre de 24 h.

## Pièges de pagination — le point qui casse en pratique

Le paramètre `range` prend la forme `0-149` :

- Maximum **150 résultats par appel**.
- Plafond d'environ **1150 offres par recherche** (index maximum ~1149).
  Au-delà, il faut affiner la requête — typiquement en découpant par date de
  création — et non paginer davantage.
- L'en-tête `Content-Range` de la réponse donne le total réellement disponible.
  Format exact : **`offres 0-49/246`**. C'est lui qui doit piloter la boucle de
  pagination, pas une constante en dur.
- Une réponse partielle renvoie **HTTP 206**, pas 200. Un code qui teste
  `status_code == 200` rate silencieusement toutes les pages intermédiaires.
- **Zéro résultat renvoie HTTP 204 avec un corps entièrement vide** et
  `Content-Range: */0`. Appeler `.json()` dessus lève une exception. C'est le cas
  normal d'un jour calme : il doit être traité avant toute tentative de décodage.

## Ce qu'une réponse réelle contient — relevé sur 50 offres le 20 août 2026

### L'identifiant

- Forme : **exactement 7 caractères**, `^[0-9A-Z]{7}$`. Exemples : `212PTDC`,
  `211KNVL`, `5914133`.
- L'alphabet observé exclut les voyelles (`0123456789BCDFGHJKLMNPQRSTVWXYZ`),
  mais **ne pas coder cette exclusion** : elle n'est garantie nulle part, et un
  identifiant purement numérique existe déjà.
- Tous distincts et non vides sur l'échantillon. C'est la clé de déduplication.

### L'expérience exigée — le champ structuré existe

La question était ouverte. **Réponse : oui.**

| Champ | Contenu |
|---|---|
| `experienceExige` | Code d'une lettre. Observés : `D` (débutant accepté, 26/50) et `E` (exigée, 24/50). `S` (souhaitée) est attendu mais **non observé** — le code doit tolérer une valeur inconnue |
| `experienceLibelle` | Le texte lisible : `Débutant accepté`, `1 An(s)`, `2 An(s)`, `3 An(s)`, `5 An(s)`, `6 An(s)` |
| `experienceCommentaire` | **Toujours `null`** sur l'échantillon. Ne pas s'y fier |

C'est un signal fiable pour l'axe accessibilité, sans dépendre de la lecture du
modèle. L'échelle de pénalité du `DECISIONS.md` § 1 se branche dessus.

### La description est plafonnée à 5 000 caractères

**5 offres sur 50 font exactement 5 000 caractères**, coupées en plein milieu
d'un mot. Le plafond vient de France Travail, pas de l'endpoint : appeler
`GET /offres/{id}` renvoie **le même texte tronqué** et **aucun champ
supplémentaire**. Il n'existe pas de version longue à aller chercher.

Conséquences : l'appel de détail par offre est **inutile**, `/search` suffit ; et
le contenu de test du `PLAN.md` doit viser 5 000 caractères, pas 20 000.

Longueurs observées : `intitule` 9 → 99 caractères (médiane 49) ·
`description` 419 → 5 000 (médiane 2 519).

### Les champs souvent absents — le cas normal, pas le cas limite

| Champ | Rempli | Remarque |
|---|---|---|
| `entreprise.nom` | **28/50** | **44 % des offres ne nomment pas l'entreprise.** Aucun repli : `contact.nom` est vide dans ces cas-là. L'affichage doit prévoir « Entreprise non communiquée » comme un état courant |
| `salaire` | **23/50** | **54 % des offres n'indiquent aucun salaire.** Quand il est là, il prend au moins 8 combinaisons de sous-champs différentes (`libelle`, `commentaire`, `complement1`, `complement2`, `listeComplements`) |
| `codeNAF`, `secteurActivite` | 26/50 | Utile à l'enrichissement quand présent |
| `trancheEffectifEtab` | 24/50 | Taille de l'établissement, déjà donnée par l'API |
| `qualificationLibelle` | 21/50 | `Cadre` notamment |

Formes de salaire rencontrées : `Annuel de 38000.0 Euros à 40000.0 Euros sur 12
mois` · `Mensuel de 2960.0 Euros à 3860.0 Euros sur 12 mois` · `Annuel de 21000.0
Euros` · variantes avec `sur 12.0 mois` · commentaire libre seul · absent.

### Champs utiles présents à 100 %

`id` · `intitule` · `description` · `dateCreation` · `dateActualisation` ·
`typeContrat` (`CDI` 32, `CDD` 12, `MIS` 5, `LIB` 1) · `typeContratLibelle` ·
`natureContrat` · `alternance` (booléen, **9/50 à `true`**) · `lieuTravail.libelle` ·
`romeCode` / `romeLibelle` · `appellationlibelle` · `experienceExige` /
`experienceLibelle` · `origineOffre.urlOrigine`.

`origineOffre.urlOrigine` est bien un lien **vers l'offre précise**
(`https://candidat.francetravail.fr/offres/recherche/detail/212PTDC`), jamais un
lien générique.

### ⛔ `contact` ne doit jamais être stocké

Le champ est présent sur 50/50 et contient des **données personnelles au sens du
RGPD** : nom de personne physique (`SCES COMMUNS IMT BUSINESS SCHOOL TELECOM -
Mme Caroline COQUET`), adresse postale, courriel, URL de postulation nominative.

Le `CLAUDE.md` l'interdit explicitement. Ce champ est **écarté à la collecte**,
avant toute écriture — pas filtré à l'affichage. Il ne doit apparaître ni en
base, ni dans une charge brute conservée, ni dans un journal.

## Cas limites à gérer dès la première version

Personne ne les rattrapera ensuite :

- **Jeton expiré en milieu de pagination** — le renouveler et reprendre, pas
  planter.
- **Réponse vide** — HTTP 204, corps vide. Zéro offre n'est pas une erreur.
- **Quota d'appels dépassé** — géré explicitement, jamais avalé par un `except` nu.
- **Offre déjà présente en base** — déduplication sur l'identifiant de l'offre,
  jamais sur le titre.
- **Union de plusieurs recherches** — un même identifiant remonte sur plusieurs
  jeux de mots-clés. Déduplication avant écriture, pas après.
