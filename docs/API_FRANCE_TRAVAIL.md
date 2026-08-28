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
| `typeContrat` | `CDI` **depuis le 28 août 2026** | Filtre **côté serveur** : les offres écartées ne sont pas transférées et ne comptent ni dans la pagination ni dans le total. Vérifié — `motsCles=IA` rend 91 offres, avec `typeContrat=CDI` il en rend 55. Plusieurs valeurs séparées par une virgule sont acceptées (`CDI,CDD` → 81). Valeurs observées en base : `CDI`, `CDD`, `MIS` (intérim), `LIB` (profession libérale) |

⚠️ **`typeContrat` est sûr à filtrer, contrairement aux autres métadonnées.** Le
champ est renseigné sur **560 offres sur 560** (vérifié le 28 août) : aucune
offre ne disparaît faute de valeur. C'est l'exception — voir plus bas pourquoi
`qualification` et `experienceLibelle` ne peuvent PAS servir de filtre.

⚠️ **Mais le filtre est irréversible pour le passé.** France Travail dépublie
ses annonces : une offre écartée aujourd'hui n'existera plus le jour où on la
voudrait. Rendre `TYPE_CONTRAT` à `None` rouvre la collecte pour l'avenir,
jamais pour les semaines écoulées — et la perte est **silencieuse**, rien dans
la base ne témoigne de ce qui n'a pas été collecté.

### Les métadonnées ne peuvent pas servir de filtre — sauf `typeContrat`

Mesuré le 28 août 2026 sur les 123 offres notées, en cherchant un filtre
structurel qui remplacerait les mots-clés :

| Qualification | Offres notées | Note d'intérêt moyenne | ≥ 25 |
|---|---|---|---|
| Cadre | 20 | 24,0 | 6 |
| *(non renseignée)* | **86** | 10,0 | **11** |
| Technicien | 8 | 18,4 | 2 |
| Agent de maîtrise | 4 | 17,8 | 1 |
| Employé qualifié | 5 | 6,6 | 0 |

**Le champ est vide sur 86 offres sur 123, et 11 des 20 meilleures sont dans ce
trou.** Filtrer sur « Cadre » perdrait 70 % des bonnes offres.

C'est le même défaut que `experienceLibelle`, faux une fois sur deux. **Et c'est
l'argument central du projet** : les métadonnées de France Travail sont trop
lacunaires pour trier, d'où un modèle qui lit le texte de l'annonce.

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

## ⚠️ Ce que `motsCles` cherche vraiment — mesuré le 21 août 2026

**La description N'EST PAS indexée.** C'est le fait le plus important de ce
document, et il commande toute la stratégie de collecte.

Test : prendre un mot dans le corps d'une annonce, le chercher, vérifier que
l'annonce remonte. **Échec 4 fois sur 4.** « polytechnique », présent noir sur
blanc dans une description, renvoie **zéro offre**.

⚠️ **CORRIGÉ LE 28 AOÛT 2026 — la phrase qui suivait était fausse.** Elle
affirmait : « la recherche porte sur l'intitulé, le libellé ROME, l'appellation
et le champ `competences` ». C'est une description de **correspondance
textuelle**, et le moteur n'en fait pas.

Mesure : sur les 40 offres rendues par `motsCles=intelligence artificielle` que
personne d'autre ne ramène, **26 ne contiennent ni « intelligence », ni
« artificiel », ni « IA » nulle part** — pas dans l'intitulé, pas dans le libellé
ROME, pas dans l'appellation, pas dans les compétences, pas dans la description,
et pas ailleurs dans la charge brute complète. Exemples : « Développeur
Mulesoft », « Ingénieur Logiciel Embarqué », « Comptable support logiciel ».

Et le moteur n'est pas non plus **compositionnel** :

| Recherche (30 jours, région 11) | Offres |
|---|---|
| `intelligence artificielle` | 168 |
| `intelligence` seul | 64 |
| `artificielle` seul | 43 |
| union des deux | **64** |

**125 des 168 ne sont ramenées par aucun des deux mots pris isolément.** Ce
n'est donc ni un ET, ni un OU : l'expression entière déclenche un élargissement
au *domaine* — ici, l'informatique.

**Ce qu'il faut en retenir, opposable :**

1. **Un terme ramène des offres qui ne le contiennent pas.** Aucun raisonnement
   du type « ce mot est dans l'intitulé donc l'offre remontera » — ni sa
   réciproque — n'est fiable.
2. **Chercher une expression ≠ chercher ses mots.** On ne peut pas prédire ce
   que ramène `X Y` en mesurant `X` et `Y`.
3. **Donc un critère se mesure, jamais ne se déduit.** C'est la même règle
   qu'avant, mais elle repose désormais sur le bon motif : ce n'est pas que
   l'index est étroit, c'est qu'il est *opaque*.
4. ⚠️ **Corollaire coûteux** : un terme générique peut ratisser un domaine
   entier. `agents` rend **2 718 offres** — agent d'accueil, agent de sécurité.

Ce que le paragraphe corrigé disait n'était pas entièrement faux : le libellé
ROME et l'appellation sont bien atteints. C'est ainsi que `IA` ramène trois
« Inspecteur » par mois — leur appellation est `Inspecteur(trice) pédago rég,
inspect académie (IPR-IA)`, ROME K2117. Mais ces champs ne sont qu'**une partie**
de ce que le moteur regarde, et l'énumération donnait l'illusion d'un contrat.

**Conséquence opposable** : une offre intitulée « Ingénieur études et
développement », dont l'IA n'apparaît que dans la description, est **invisible à
toute requête par mots-clés**, quelle que soit la liste. Le seul recours possible
est un filtre structurel — `codeROME` — suivi d'une lecture de la description par
le modèle.

⚠️ **MESURÉ LE 26 AOÛT 2026 : ce recours ne fonctionne pas en pratique.** Le
raisonnement ci-dessus est juste, sa mise en œuvre a échoué. Les six codes ROME
alors configurés apportaient bien 445 offres nettes par mois — que les mots-clés
ne trouvaient effectivement pas — mais sur **50 de ces offres notées au hasard,
aucune ne dépassait 30 sur 100** d'intérêt : technicien helpdesk, développeur
Salesforce, ingénieur travaux promoteur immobilier. Le filet attrape, et il
attrape le mauvais poisson. Tous les codes ont été retirés ; `codes_rome.txt`
reste en place, vide, avec la mesure qui l'a vidé.

⚠️ **Et un code ROME dont le libellé contient un mot déjà cherché n'apporte
RIEN.** Puisque la recherche indexe le libellé ROME et l'appellation (voir
ci-dessus), une offre classée `M1889` — libellé « Ingénieur en Intelligence
Artificielle (IA) » — est **déjà** ramenée par le mot-clé `intelligence
artificielle`. Mesuré : `M1889` et `M1861`, les deux codes de meilleure qualité
mesurée, ont un apport net de **zéro** offre sur 30 jours. La question à poser
avant d'ajouter un code n'est donc pas « ce métier est-il proche de la cible ? »
mais « **quelles offres apporte-t-il que les mots-clés ratent, et que
valent-elles une fois notées ?** ». Les deux moitiés comptent.

### Le vocabulaire est étroit — mais PAS français seulement

⚠️ **CORRIGÉ LE 26 AOÛT 2026.** Cette section s'intitulait « Le vocabulaire est
fermé, et français ». Les deux moitiés étaient fausses, et la seconde coûtait
cher : **`AI` en anglais ramène 33 offres sur 30 jours, dont 28 qu'aucun autre
critère ne trouvait** — *AI Engineer*, *Generative AI & Agentic Engineer*, *AI
Lead Engineer*, *Consultant Data et AI Engineer jeune diplômé*. Beaucoup
d'employeurs franciliens rédigent leurs annonces en anglais. Le projet a cherché
`IA` pendant dix jours sans jamais chercher `AI`.

Le vocabulaire n'est pas non plus **fermé** : il s'ouvre lentement. Termes qui
renvoyaient zéro le 21 août et ne renvoient plus zéro le 26 (30 jours glissants) :
`GenAI` 3 · `LLM` 1 · `copilot` 2 · `prompt` 1 · `RAG` 1. Encore marginal, mais
à **remesurer périodiquement** plutôt qu'à tenir pour acquis.

**Mesuré et ÉCARTÉ le 26 août, à ne pas réintroduire au flair** : `machine
learning` (53 offres nouvelles — data scientist, bioinformaticien, analyste
quantitatif : le PRD refuse la modélisation) · `data` (275 offres nouvelles,
postes de données pures, même motif) · `AI engineer` (14 offres, toutes déjà
ramenées par `AI`).

**Mesures du 21 août, conservées ci-dessous pour l'ordre de grandeur** — les
volumes portent sur 7 jours, ceux du 26 août sur 30 jours, ils ne se comparent
pas directement.

Volumes sur 7 jours en Île-de-France :

| Terme | Offres |
|---|---|
| conseil · consultant | 581 · 570 |
| avant-vente | 299 |
| transformation | 214 |
| data · integration | 80 · 60 |
| intelligence artificielle | 39 |
| IA | 18 |
| digital · deploiement · automatisation · RPA | 13 · 8 · 6 · 2 |

**Renvoyaient ZÉRO offre le 21 août** : `IA générative` · `IA agentique` ·
`agent IA` · `POC IA` · `intégration IA` · `solution IA` · `chef de projet IA` ·
`LLM` · `GenAI` · `chatbot` · `agent conversationnel` · `MLOps` · `no-code` ·
`prompt` · `OpenAI` · `ChatGPT` · `copilot` · `assistant virtuel`.

⚠️ Remesuré le 26 août sur 30 jours : `GenAI`, `LLM`, `copilot`, `prompt` et
`RAG` ne renvoient plus zéro. `chatbot`, `ChatGPT`, `MLOps` et `modèle de
langage` renvoient toujours zéro.

⚠️ **Les expressions à plusieurs mots sont dangereuses.** `avant-vente` ramène
299 postes de *Conseiller de vente*, *Vendeur en animalerie* et *Réceptionnaire
Après-Vente Automobile* : le moteur a coupé le terme et matché « vente ». Un
mot-clé ne s'ajoute jamais sans mesurer ce qu'il ramène.

⚠️ **La correspondance est élargie, pas littérale.** Sur les 39 offres de
« intelligence artificielle », 10 portent la phrase exacte et 28 ne contiennent
ni « intelligence » ni « artificiel » nulle part — dont *Ingénieur IA junior*,
que le moteur a su rapprocher. Élargi dans les deux sens : il ramène aussi des
offres de logiciel embarqué sans rapport.

## Champs supplémentaires relevés le 21 août 2026

`competences` (liste de phrases normalisées — **c'est ce que la recherche
indexe**) · `qualitesProfessionnelles` · `contexteTravail` · `nombrePostes` ·
`agence` · `entrepriseAdaptee` · `employeurHandiEngage` ·
`dureeTravailLibelle` / `dureeTravailLibelleConverti`.

⚠️ `competences` n'est rempli que sur **6 %** des offres collectées le 21 août
(3 sur 43). Utile quand il est là, jamais une valeur sur laquelle compter.

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

### `contact` — deux champs conservés, le reste écarté à la collecte

Le champ est présent sur 50/50 et contient des **données personnelles au sens
du RGPD** : nom de personne physique (`SCES COMMUNS IMT BUSINESS SCHOOL TELECOM
- Mme Caroline COQUET`), adresse postale, courriel, URL de postulation.

⚠️ **Tranché le 20 août 2026 sur mesure, pas sur intuition.** Sur 235 offres
réelles : `contact.courriel` ne contient **aucune adresse** (le champ porte une
phrase), `contact.nom` est présent sur 9 % des offres et ne nomme une personne
que dans 3 % des cas.

**Deux champs seulement sont conservés**, parce qu'ils servent directement à
candidater : `contact.nom` et `contact.urlPostulation`. Ils vivent en
**colonnes nommées**, jamais dans l'archive `charge_brute` — une colonne se
cherche, s'exclut d'un export et se vide d'une requête ; noyée dans un bloc
JSON, la donnée voyage partout où le bloc voyage.

**Tout le reste du champ `contact` est retiré à la collecte, avant écriture** —
pas filtré à l'affichage : filtré à l'affichage, un champ est quand même en
base et dans les journaux. Vérifié le 21 août sur les 189 offres réellement
collectées : aucune archive ne contient `contact`, ni `courriel`, ni
`coordonnees1/2/3`, ni `telephone`.

⚠️ **Le piège inverse, mesuré le 21 août** : quand Postgres refuse une ligne,
PostgREST recopie la ligne fautive dans le champ `details` de son erreur —
`"Failing row contains (…, Mme Caroline COQUET, https://…, …)"`. Le journal de
GitHub Actions étant **public** sur ce dépôt, une erreur d'insertion
journalisée telle quelle y publierait le nom. `pipeline/stockage.py` ne garde
que le `code` et le `message` ; jamais `details` ni `hint`.

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
