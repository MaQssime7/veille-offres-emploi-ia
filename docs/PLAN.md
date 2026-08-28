# Plan : Veille offres emploi IA

> PRD source : `docs/PRD.md` · Décisions de cadrage : `docs/DECISIONS.md` · Design : `docs/DESIGN.md`
>
> Écrit en session `/planifie` le 16 août 2026. Les décisions architecturales ci-dessous
> ont été validées une par une ; elles ne se rouvrent pas en cours d'implémentation.

---

## Décisions architecturales

### Stack

- **Python 3.11+** pour le pipeline, environnement virtuel dédié dans `pipeline/`.
- **Next.js + shadcn/ui sur Vercel** pour l'interface, dans `interface/`.
- **Supabase (Postgres)** pour la persistance, **dès le premier jour** — pas de SQLite
  local en amont : GitHub Actions ne peut pas lire un fichier posé sur le Mac, la couche
  de stockage serait à écrire deux fois.
- **GitHub Actions** (cron) pour la veille nocturne et pour l'exécution des agents.
- **API France Travail** Offres d'emploi v2 — voir `docs/API_FRANCE_TRAVAIL.md`.
- **`claude-sonnet-5`** pour la notation en volume, avec cache de prompt et API Batches.
  Retenu contre Haiku 4.5 parce que le cache de prompt de Haiku ne s'active qu'au-delà de
  4 096 tokens : le fichier de critères passerait sous le seuil et ne serait **jamais mis
  en cache, silencieusement**. L'écart de coût entre les deux est d'environ 3 $ par mois.
- **Claude Agent SDK** pour l'enrichissement.

### Frontend — figé à l'installation

| Choix | Valeur | Pourquoi |
|---|---|---|
| Template | `next` | Il faut un serveur à soi : mot de passe vérifié côté serveur, clé `service_role` qui ne doit jamais atteindre le navigateur, écriture de la demande d'enrichissement |
| Moteur des composants | **`radix`** | Beaucoup plus de code en circulation. En `base`, le mauvais réflexe sur `Select`, les déclencheurs de menu et `Accordion` produit un composant **qui ne s'ouvre pas, sans erreur en console** |
| Monorepo | Non | Une seule application JavaScript |
| Icônes | **lucide** | Décidé par `/design`, figé à l'installation |

### Arborescence

```
veille-offres-emploi-ia/
├── pipeline/      Python : collecte, notation, enrichissement
├── interface/     Next.js + shadcn : le site
├── docs/          PRD, DESIGN, DECISIONS, PLAN, API_FRANCE_TRAVAIL
├── .github/       le cron quotidien et le workflow d'enrichissement
├── README.md · CLAUDE.md · .gitignore · .env.example
```

⚠️ **Vercel doit être réglé sur `Root Directory = interface`.** Sans ça, il cherche un
`package.json` à la racine, n'en trouve pas, et le déploiement échoue.

### Routes

| Adresse | Contenu |
|---|---|
| `/` | Le **compte rendu** de la nuit — offres de la dernière exécution réussie, statut « à traiter », intérêt ≥ 50, tri par intérêt décroissant |
| `/offres` | Le **poste de travail** — tout ce qui a été collecté, filtre de statut dans l'adresse (`?statut=a-traiter\|candidate\|ecarte`) |
| `/offres/[identifiant]` | La fiche d'une offre |
| `/connexion` | La porte |

Non adressables : les actions serveur (changer un statut, enregistrer une note, lancer un
enrichissement). Adresse de données unique : `GET /api/enrichissements/[identifiant]/etapes`.

**L'identifiant est celui de France Travail** (`190MTLR`) — déjà stable, déjà unique, déjà
la clé de déduplication. ⚠️ Il doit être **validé avant d'atteindre la base** : une valeur
venue de la barre d'adresse est écrite par l'extérieur, jamais de confiance.

### Schéma

Quatre tables **à terme**. **Pas d'accents dans les noms** — Postgres les accepte mais exige
alors des guillemets dans chaque requête, et l'oubli d'un seul produit une erreur
incompréhensible.

> ⚠️ **État au 20 août 2026 — deux tables sur quatre existent.** `executions_veille` et
> `offres` sont en base ; `enrichissements` et `etapes_enrichissement` sont reportées à la
> **phase 6**. La description ci-dessous reste la cible ; **la source de vérité de ce qui
> existe réellement est `supabase/migrations/`**, jamais ce tableau. Deux descriptions du
> même schéma finissent toujours par diverger.
>
> Écarts déjà connus entre la cible ci-dessous et ce qui est en base, tous décidés en
> séance : **pas de colonne `duree`** (elle se calcule) · **pas de compteurs de tokens ni
> de modèle** avant la phase 2 (rien ne les alimente) · **pas de date de collecte sur
> l'offre** (le lien vers l'exécution la porte) · **deux colonnes de contact ajoutées**
> (`contact_nom`, `contact_url_postulation`) et une **archive `charge_brute`** · **six
> colonnes de signaux ajoutées** après mesure de l'API (`code_naf`,
> `secteur_activite_libelle`, `tranche_effectif`, `qualification_libelle`,
> `appellation_libelle`, `manque_candidats`, `langues`, `formations`).

| Table | Contenu |
|---|---|
| `executions_veille` | Une ligne par passage nocturne : début, fin, durée, offres reçues / nouvelles / notées, issue, motif d'échec, **modèle utilisé**, compteurs de tokens bruts |
| `offres` | Clé : l'identifiant France Travail. L'annonce (intitulé, entreprise, lieu, contrat, date, salaire tel qu'écrit **et** annualisé, expérience exigée, description intégrale, lien) · la notation (deux notes, deux justifications, résumé) · toi (statut, note personnelle, dates de modification) · `tokens_cumules` et `tokens_conversation` |
| `enrichissements` | La conduite (déclenchement, horodatages, durée, étapes, issue, motif, modèle, compteurs) · la fiche : **neuf rubriques, chacune en deux colonnes — sa valeur et son marqueur *vérifié* / *déduit*** · les sources · les drapeaux « employeur final non identifié » et « entreprise incertaine » |
| `etapes_enrichissement` | Ordre, libellé, détail, horodatage |

**Liens, dans les deux sens :**

- Une exécution collecte **plusieurs** offres ; une offre est trouvée par **une seule**
  exécution — celle qui l'a vue en premier. Ce lien est imposé par la définition de `/` :
  une simple date de collecte ne suffirait pas (deux exécutions le même jour, ou une
  exécution qui plante à mi-course, et le compte est faux).
- Une offre a **au plus un** enrichissement ; un enrichissement porte sur **une seule**
  offre. Une relance **remplace** la fiche précédente ; la tentative échouée survit dans
  sa trace.
- Un enrichissement produit **plusieurs** étapes ; une étape appartient à **un seul**
  enrichissement.

**Deux compteurs de tokens sur l'offre, et pas un :** `tokens_cumules` porte tout
(notation + enrichissement + conversation future) pour l'écran de suivi ;
`tokens_conversation` portera la borne des 80 000. Avec un compteur unique, un
enrichissement coûteux mangerait l'enveloppe de discussion avant le premier message.

**Le marqueur « Nouveau » ne demande aucune colonne** : une offre est nouvelle si elle
appartient à la dernière exécution réussie. Aucune « date de dernière visite » n'est
stockée — elle viderait la liste sous les yeux de l'utilisateur au rechargement.

**Hors base** : la grille tarifaire vit dans un **fichier versionné**. Même logique que les
critères de pertinence — une donnée qu'on corrige à la main et qu'on relit dans git.

### Autorisation — opposable

**Aucune colonne d'appartenance, et c'est délibéré.** Sur une application
multi-utilisateurs, toute table portant les données de quelqu'un doit dire à qui elles
appartiennent. Ce produit n'a **pas de deuxième utilisateur** : une telle colonne porterait
la même valeur sur toutes les lignes et donnerait l'illusion d'un contrôle.

Ce qui la remplace :

1. **RLS activé sur toutes les tables, aucune politique.** La base refuse tout accès
   direct ; seul le serveur, avec la clé `service_role`, passe. Le navigateur ne parle
   jamais à Supabase.
2. **Un `proxy.ts` unique protège tout par défaut** (le middleware de Next 16), avec une
   **liste blanche** d'exceptions. L'inverse — énumérer les adresses à protéger —
   laisserait toute adresse ajoutée plus tard ouverte, **sans rien signaler**.
   > **Livré le 21 août, deux écarts avec ce qui était prévu ici** — décidés à
   > l'implémentation, sur mesure :
   > · **Aucun `matcher` n'est déclaré**, alors que le réflexe est d'en poser un. La
   > documentation Next 16 montre `export const config` là où d'autres sources annoncent
   > `proxyConfig` ; sans matcher, se tromper de nom est sans conséquence puisque le proxy
   > s'exécute partout, tandis qu'avec une liste d'adresses protégées la même erreur aurait
   > ouvert le site en silence.
   > · **Deux exceptions et non trois** : `/connexion` et les ressources de chargement
   > (`/_next/*`, `favicon.ico`, `robots.txt`). L'action qui vérifie le mot de passe n'en
   > est pas une — une action serveur n'a pas d'adresse à elle, elle s'invoque **sur** une
   > route, en l'occurrence `/connexion`, déjà en liste blanche.
   > · **Un `POST` d'action serveur reçoit `401`, jamais une redirection** : redirigé, le
   > navigateur suivrait jusqu'à la porte, recevrait un corps vide, et le bouton cliqué ne
   > ferait *rien du tout*.
3. **Session** : cookie signé HMAC-SHA256, `HttpOnly` + `Secure` + `SameSite=Lax`,
   **30 jours glissants**. Aucune table de sessions. *(Livré le 21 août.)*
4. **Mot de passe** : **comparaison à temps constant** (une comparaison ordinaire s'arrête
   au premier caractère différent et se devine au chronomètre), **délai d'une seconde**
   imposé à chaque tentative.
   > **Livré à 24 caractères aléatoires et non 32**, sur un alphabet de 32 symboles sans
   > caractère confondable (ni `l`, ni `1`, ni `0`, ni `o`) : **120 bits d'entropie**, déjà
   > très au-delà de ce qu'un forçage brut atteint, et il se tape au téléphone — US-8. Le
   > chiffre de 32 était posé sans mesure ; c'est l'entropie qui compte, pas la longueur.

**Le test que Maxime peut faire lui-même, sans lire de code** : ouvrir un onglet de
navigation privée et appeler directement `…/api/enrichissements/190MTLR/etapes`. Si des
données s'affichent au lieu d'un renvoi vers `/connexion`, le contrôle est cassé. **À
refaire à chaque nouvelle adresse de données.**

### Secrets

| Endroit | Secrets |
|---|---|
| `.env` local, **non versionné** | Tous |
| Secrets GitHub Actions | `FT_CLIENT_ID` · `FT_CLIENT_SECRET` · `ANTHROPIC_API_KEY` · `SUPABASE_URL` · `SUPABASE_SECRET_KEY` |
| Variables Vercel | `SUPABASE_URL` · `SUPABASE_SECRET_KEY` · `MOT_DE_PASSE_SITE` · le jeton GitHub de déclenchement |
| Le navigateur | **Rien. Aucune exception.** |

**Le site ne détient aucune clé de modèle** — conséquence du découplage : Next.js écrit une
ligne en base, il ne parle jamais à Anthropic ni à France Travail.

⚠️ **Avec Next.js, c'est une convention de nommage qui décide si une variable part dans le
navigateur.** Tout ce qui est préfixé `NEXT_PUBLIC_` est envoyé au navigateur et lisible
par n'importe quel visiteur dans le code source de la page. Renommer
`SUPABASE_SECRET_KEY` en `NEXT_PUBLIC_SUPABASE_SECRET_KEY` publierait la clé
qui contourne toute la sécurité de la base, **sans le moindre message d'erreur**.
**Aucune variable de ce projet ne porte ce préfixe.**

⚠️ Un secret commité reste dans l'historique git après suppression du fichier. Le
rattraper impose de **révoquer la clé**, pas seulement de nettoyer.

### Enveloppe quotidienne de tokens

**300 000 tokens par jour pour les enrichissements**, dans le fichier de configuration
versionné, **vérifiée côté serveur**. Elle se calcule en **sommant les traces du jour**
plutôt que dans un compteur séparé, qui divergerait à la première écriture ratée. Valeur de
départ estimée, à re-régler en phase 7 sur la mesure réelle.

Elle remplace « au plus deux enrichissements par nuit », qui était le seul plafond de
dépense du système avant que l'automatique soit retiré — et elle borne mieux : des euros,
plutôt qu'un nombre de clics dont le coût varie du simple au quintuple.

⚠️ **La notation nocturne n'entre pas dans l'enveloppe.** Un matin où France Travail
renvoie quatre cents offres, un plafond ferait **rater des offres** pour économiser vingt
centimes. Règle en une phrase : *l'enveloppe borne ce que l'utilisateur déclenche, jamais
ce que le système fait de lui-même chaque nuit.*

La conversation, quand elle viendra, aura **sa propre enveloppe quotidienne, séparée**.
Deux fonctionnalités qui partagent un plafond se volent leur budget : une matinée
d'enrichissement bloquerait toute discussion l'après-midi, sans que rien ne l'explique à
l'écran.

### Frontières des services tiers

L'enrichissement est **découplé de l'interface** : une fonction Vercel dure de l'ordre de
la minute, un agent qui explore un site dépasse.

1. Le clic écrit une demande en base et rend la main immédiatement.
2. Le serveur **appelle l'API GitHub pour lancer le workflow sur-le-champ**. Un cron ne
   descend pas sous 5 minutes et se déclenche souvent avec 10 à 15 minutes de retard —
   inutilisable pour la démonstration en entretien, qui est un objectif produit explicite.
3. Les étapes remontent par **sondage d'une route serveur toutes les 1,5 s**, jamais par
   Supabase Realtime. Realtime écouterait **depuis le navigateur** avec la clé publique, ce
   qui obligerait à ouvrir une politique de lecture publique sur une table — en
   contradiction directe avec les deux règles ci-dessus. Le rendu à l'écran est identique.

⚠️ **Le jeton GitHub est un point de fragilité à deux titres.** Il doit être limité à ce
dépôt et au seul droit de lancer un workflow — s'il fuitait, on pourrait lancer en boucle
le workflow qui détient la clé Anthropic. Et **il expire** : son expiration est une panne
parfaitement silencieuse — le site marche, la veille tourne, seul le bouton « Enrichir »
cesse d'agir.

---

## Phase 1 : La porte, la collecte, et les vraies offres à l'écran

**User stories** : US-8, US-22, US-23, US-26, US-33, US-34, US-37 *(partiel)*

> **Avancement au 26 août 2026 — étapes 1 à 5 terminées. Le cron GitHub Actions tourne.**
>
> | # | Étape | État |
> |---|---|---|
> | 0 | Collecte à blanc contre l'API France Travail | ✅ faite — résultats dans `docs/API_FRANCE_TRAVAIL.md` |
> | 1 | Le schéma en base, migrations versionnées | ✅ **fait** — 18 contrôles au vert |
> | 2 | Le pipeline Python de collecte (`pipeline/`) | ✅ **fait** — 189 offres réelles en base, 15 défauts corrigés après `/code-review` |
> | 3 | La porte : `/connexion` + `proxy.ts` + session | ✅ **fait** — parcours vérifié en développement *et* sur le build de production |
> | 4 | L'écran `/offres` et ses quatre états | ✅ **fait** — 5 états atteints et regardés, 14 défauts corrigés après `/code-review` |
> | 5 | Mise en ligne : variables Vercel + cron GitHub Actions | ✅ **fait** — les 4 variables sont posées, la porte est en ligne et testée, et **le cron tourne depuis le 26 août** : deux exécutions réelles chez GitHub, 182 offres nouvelles écrites |
> | 6 | Remesure de la mise en page contre le contenu réel, puis `/cloture` | ⬅️ **prochaine étape** |
>
> ⚠️ **Ce que l'étape 5 a révélé, et qui vaut pour toute mise en ligne future** : les
> variables étaient posées mais **les 3 commits portant la porte n'avaient jamais été
> poussés**. Le site public répondait 200 sans mot de passe et `/connexion` renvoyait 404,
> alors que tout semblait fait côté Vercel. Vérifier `git log origin/main..main`, pas
> seulement le tableau de bord de l'hébergeur.
>
> ⚠️ **Une étape 0 a été ajoutée au plan initial** : interroger l'API *avant* de figer le
> schéma. Elle a invalidé deux hypothèses écrites (longueur des descriptions, taux de
> remplissage du nom d'entreprise) et fermé la question ouverte sur `experienceExige`.
> Concevoir une table après avoir vu les données, jamais avant.

### Ce qu'on livre

L'utilisateur ouvre l'adresse du site, tombe sur un champ de mot de passe, le tape, et voit
les vraies offres IA d'Île-de-France collectées cette nuit par un cron déjà actif — sur un
site déjà en ligne. Sans notes, sans statuts, sans fiche.

**Cette phase met le site en ligne et allume le cron dès le premier jour.** Ce n'est pas de
l'empressement : un historique ne se reconstitue pas, et les seuils se règlent sur deux
semaines de données réelles. Chaque jour sans cron est un jour perdu définitivement. C'est
aussi la phase qui a levé le plus d'incertitude — **et elle l'a fait** : le champ
« expérience exigée » existe bien (`experienceExige`, codes `D` et `E` observés), et une
description France Travail plafonne à 5 000 caractères. Détail dans
`docs/API_FRANCE_TRAVAIL.md`.

### Critères d'acceptation

- [x] ~~Les **quatre** tables existent~~ → **deux** tables (`executions_veille`, `offres`), RLS activé, **aucune politique**, et **tous droits retirés à `anon`** en second verrou. Vérifié le 20 août 2026 : lecture *et* écriture avec la clé publiable renvoient **HTTP 401**.
      ⚠️ **Entorse assumée, validée en séance** : `enrichissements` et `etapes_enrichissement` sont reportées à la **phase 6**. Leur forme dépend de ce que l'agent produira réellement, rien ne les alimente d'ici là, et la collecte à blanc a montré que France Travail fournit déjà gratuitement plusieurs informations que l'enrichissement devait aller chercher (`tranche_effectif`, `code_naf`, `secteur_activite_libelle`). Le critère qui compte — *tout accès direct refusé* — se prouve aussi bien sur deux tables que sur quatre.
- [x] Le client France Travail s'authentifie avec le scope exact `api_offresdemploiv2 o2dsoffre`, identifiants **dans le corps** de la requête et non en en-tête Basic — vérifié le 21 août, jeton obtenu contre les vrais identifiants
- [x] La pagination est pilotée par l'en-tête `Content-Range` de la réponse, **pas par une constante**, et traite le **HTTP 206** comme un succès — `_total_disponible()` dans `client_france_travail.py`
- [x] Une offre déjà en base n'est pas réinsérée — vérifié : deuxième insertion du même lot → **0 nouvelle**, `on conflict do nothing` sur la clé primaire
- [x] Jeton expiré en milieu de pagination : renouvelé, la collecte reprend — HTTP 401 intercepté, jeton vidé, appel rejoué une fois. ⚠️ **Écrit et relu, pas déclenché en conditions réelles** : le jeton dure 25 min et aucune collecte n'est allée jusque-là
- [x] Réponse vide traitée comme un jour normal — HTTP 204 à corps vide intercepté **avant** tout `.json()`, vérifié sur une fenêtre de 5 minutes
- [x] Quota d'appels dépassé : `QuotaDepasse` levée sur HTTP 429, et 0,25 s imposé entre deux appels. ⚠️ **Non déclenché en réel** — la temporisation l'empêche
- [x] Chaque exécution écrit sa ligne dans `executions_veille` — vérifié dans les deux sens : réussite (43 reçues / 43 nouvelles) et échec (identifiants faussés → `echec` motivé, code de sortie 1, aucun `en_cours` orphelin)
- [x] Sans mot de passe, `/` et `/offres` renvoient vers `/connexion` — HTTP 307 vérifié en curl et au navigateur, avec la destination mémorisée dans `?suite=`
- [x] **Sans mot de passe, une adresse de données appelée en dehors du navigateur ne renvoie aucune offre** — critère de succès n° 5.
      **Rejoué en production le 26 août 2026, hors navigateur**, sur 4 adresses — `/`, `/offres`, `/api/offres`, `/api/enrichissements/190MTLR/etapes` : toutes répondent **HTTP 307 avec un corps de 15 octets**, et aucune ne contient le moindre champ d'offre (`intitule`, `entreprise_nom`) — vérifié par recherche dans le corps de chaque réponse. `proxy.ts` n'a *aucun* `matcher`, donc il protège aussi les adresses qui n'existent pas encore. ⚠️ **À rejouer en phase 6**, quand la première adresse de données existera vraiment : ce contrôle-ci porte sur des adresses vides.
- [x] Une session ouverte survit à un rechargement et à la fermeture du navigateur, et expire après 30 jours d'inactivité — cookie **persistant** (échéance à 30 jours, pas un cookie de session), et **glissant** : trois cas mesurés (cookie de 12 h non renouvelé, de 2 jours et de 25 jours renouvelés)
- [x] Cinq tentatives de mot de passe erronées prennent chacune au moins une seconde — mesuré sur le build de production : 1362 / 1367 / 1376 / 1387 / 1384 ms
- [x] `/offres` affiche les offres collectées avec intitulé, entreprise, lieu, contrat, date — **189 offres réelles**, salaire compris (brut : la normalisation est en phase 2)
- [x] **États de `/offres`** : les quatre sont atteints et regardés, **plus un cinquième** (« le site n'est pas configuré », variable absente). Base vide obtenue par filtre temporaire, chargement par ralentissement temporaire, injoignable par adresse Supabase invalide, et 189 offres à 375 px **sans débordement horizontal** (0 élément sur 189 lignes, mesuré au DOM)
- [x] Le site est **déployé sur Vercel** ✅ et le **cron GitHub tourne** ✅.
      **Déploiement vérifié en conditions réelles le 21 août** sur l'URL publique : `/` → 307 vers `/connexion?suite=%2F`, `/connexion` → 200, le mot de passe ouvre, la session survit au rechargement. ⚠️ Une adresse **jamais écrite dans le code** (`/api/enrichissements/190MTLR/etapes`) renvoie elle aussi 307 : le proxy sans `matcher` protège bien les adresses qui n'existent pas encore. **Cron allumé le 26 août** : `.github/workflows/collecte-nocturne.yml`, planifié à 02:23 UTC (4 h 23 à Paris l'été, 3 h 23 l'hiver), 4 secrets posés chez GitHub. Deux exécutions réelles vérifiées — fenêtre automatique (182 offres nouvelles, base passée de 189 à 371) et rattrapage manuel `--depuis-jours 1` (67 présentées, 2 nouvelles : la déduplication tient). Les 4 secrets apparaissent en `***` dans les journaux, qui sont publics. ⚠️ **Le déclenchement planifié lui-même n'est pas encore prouvé** — il ne le sera qu'au premier réveil nocturne, le 27 août.
- [x] À 375 px et en mode sombre : aucun débordement horizontal, **aucune erreur en console**
      **Fait pour `/connexion` et pour `/offres`** — les 4 combinaisons (375 px / 1280 px × clair / sombre), 0 élément débordant sur 189 lignes, console vide sur chacune et sur tout le parcours. Les 7 couleurs de la ligne d'offre recalculées dans le navigateur : toutes au-dessus du plancher de 4,5:1 dans les deux thèmes.
- [x] Aucune variable `NEXT_PUBLIC_` dans le code source de la page publiée
      **Vérifié le 21 août sur la page RÉELLEMENT PUBLIÉE** (945 Ko de HTML et de JavaScript analysés sur l'URL de production, après connexion) : ni le mot de passe, ni le secret de session, ni la clé Supabase, ni l'adresse du projet Supabase, ni aucune occurrence de `NEXT_PUBLIC_`, ni aucun motif de clé (`sb_secret_`, `sk-ant-`).
- [x] Les valeurs de mise en page de `docs/DESIGN.md`, posées contre du contenu inventé, sont **remesurées contre le contenu réel** puis figées.
      **Mesuré et figé le 26 août 2026** contre les 373 offres réelles : **largeur de page 1000 px** (contre 1180) et **ligne d'offre de 91 px** (contre 109) — de 6 à 10 offres par écran en bureau, de 5,5 à 6,2 en mobile. Vérifié aux 4 combinaisons 375/1280 px × clair/sombre : 200 offres, aucun débordement, console propre, focus clavier visible.
      **Méthode** : à chaque largeur, compter les lignes dont les cartouches passent à la ligne. 820 px → 34 cassées · 900 px → 6 · 960 px → 0 · 1000 px → 0. ⚠️ **30 des 34 sont les offres qui affichent un salaire** — le libellé brut « Annuel de 50000 Euros à 60000 Euros » (la chaîne **rendue** : `formaterSalaire()` retire les « .0 ») déborde. Le seuil vaut donc pour le salaire **non normalisé** ; la phase 2 rendra de la marge.
      ⚠️ **Entorse assumée : seules 2 des 7 valeurs de `DESIGN.md` ont pu être figées.** Les cinq autres — barre latérale de filtres, panneau d'enrichissement, colonne d'enrichissement de la fiche, bascule sous 1000 px — décrivent des écrans **qui n'existent pas encore**. Les figer aurait donné à des chiffres inventés le statut d'une mesure. Elles portent désormais une **échéance nommée** (phase 3, 4 ou 6) au lieu d'un « à remesurer » sans date.
      ⚠️ **Décision de séance du 26 août** : les libellés de notes s'écrivent **en toutes lettres** (« Intérêt », « Accessibilité ») et non `INT` / `ACC`. Mesuré : ça tient en bureau et en mobile, mais **déplace le seuil de largeur de 960 à 1000 px** — d'où l'ordre, libellé d'abord, largeur ensuite.

### Bloquée par

Aucune — démarrable immédiatement. *(Préalable hors plan : `/installe` pose la stack.)*

---

## Phase 2 : Les deux notes

**User stories** : US-1 *(tri)*, US-3, US-4, US-22, US-32 *(normalisation)*

### Ce qu'on livre

Chaque offre porte une note d'intérêt, une note d'accessibilité, et une phrase qui explique
chacune. La liste se classe par intérêt décroissant. Le salaire est ramené à un montant
annuel quand c'est possible.

**Après cette phase, le produit est déjà utile** — même sans fiche, sans statut et sans
écran du matin.

### Critères d'acceptation

- [x] Les critères de pertinence vivent dans un **fichier texte versionné**, pas dans le code, et sont injectés en préfixe du prompt
- [x] ✅ Le cache de prompt est **actif et vérifié** — `cache_read` = 3 715 dès le 2ᵉ appel, `cache_write` = 0. Préfixe 3 144 tokens, plancher 1024.
      ~~ : `cache_read_input_tokens` est non nul dès le deuxième appel du même lot
- [x] ✅ **L'API Batches est entièrement validée, rattachement par `custom_id` COMPRIS** — fermé le 28 août 2026, lot `msgbatch_016Vf4…`, **3 offres**, 5 min 06, réussite, 0 échec (exécution #51).
      ✅ **Le point qui manquait est prouvé.** Le lot du 26 août portait **une seule** offre : apparier par identifiant et apparier par position y donnent le même résultat, donc le test ne pouvait pas échouer. Trois offres de métiers étrangers l'un à l'autre ont été déposées — Ingénieur IVV satellite, Formateur en réseaux sociaux, Alternance DevOps + AI Agent — et **chaque justification revenue parle bien du métier de son offre** : « validation/test logiciel (IVV) pour systèmes embarqués spatiaux » sur la première, « mission de formation en réseaux sociaux » sur la deuxième, « full stack et agents IA/LLM avec RAG » sur la troisième. Un appariement positionnel aurait produit un décalage visible.
      ⚠️ **La vérification devait être SÉMANTIQUE, pas mécanique** : contrôler que trois notes ont bien été écrites serait passé à côté d'un appariement inversé. C'est le contenu qui prouve, pas le compte.
      ⚠️ **Leçon à garder** : un test qui ne peut pas échouer ne prouve rien. Un cas limite de taille 1 est souvent de ceux-là.
      ✅ **Le cache mord dès qu'il y a plusieurs offres** : sur ce lot de 3, `cache_ecriture` = 3 715 et `cache_lecture` = **7 430**, soit exactement deux relectures du préfixe. Sur le lot d'une offre du 26 août, `cache_lecture` valait **zéro** — on payait l'écriture sans jamais relire. Le lot n'est donc rentable qu'à partir de plusieurs offres, et c'est maintenant mesuré des deux côtés.
- [x] ✅ Le module accepte une **limite d'offres à noter** (`--limite N`) et sait faire des **appels directs** sans Batches.
      *(Case restée vide par oubli — corrigé le 28 août. Preuve : `--limite` est déclaré dans `pipeline/notation.py`, les appels directs sont le mode par défaut, et les exécutions #41, #42, #44 et #50 ont noté 10, 10, 15 et 25 offres par ce chemin. La progression prévue ci-dessous a bien été suivie.)*
      ⚠️ **Décidé le 26 août 2026 : premier essai sur UNE offre** — la consigne du matin disait 5, révisée à 1 le jour même — puis quelques-unes, puis 50, puis le reste. Pas pour le coût — noter les 373 revient à **1,35 $ une seule fois** — mais pour pouvoir relire la notation *et* le prompt qui l'a produite, et refaire l'aller-retour en quelques secondes. Les Batches mettant jusqu'à une heure à rendre leurs résultats, un essai de cette taille **doit** passer en direct, sinon chaque itération sur le prompt coûte une heure d'attente.
      ⚠️ **La base ne s'efface pas pour autant** : noter peu et stocker peu sont deux choses sans rapport, la notation étant incrémentale. Voir `CLAUDE.md` § État actuel pour les quatre raisons.
- [x] ✅ Le modèle renvoie une **sortie structurée** — 97 appels, 97 réponses conformes, 0 échec.
      ~~ : deux entiers de 0 à 100, deux justifications, un résumé court, un salaire annualisé
- [x] ✅ Une offre déjà notée n'est **jamais renotée** (sauf `--renoter`, explicite, jamais par défaut).
      ~~, même si l'annonce a changé à la source
- [x] ✅ `executions_veille` enregistre le **modèle utilisé** et les compteurs de tokens bruts
- [x] ✅ Le compteur `tokens_cumules` de chaque offre est incrémenté
- [x] ✅ Les deux barres portent leur libellé **en toutes lettres**, vérifié à 1280 px et à 375 px, en clair et en sombre. Boîte portée de 104 à **108 px** : « ACCESSIBILITÉ » mesure 100,1 px et les 4 px restants tombaient dès que la police web n'était pas encore chargée
      ~~ : jamais retirés, même à 375 px ; les abréviations `INT` / `ACC` restent abandonnées
- [x] ✅ Les justifications se lisent **à plat**, en deux colonnes sous les cartouches. ⚠️ **Elles ne pouvaient PAS aller dans la réserve de droite** comme le prévoyait `docs/DESIGN.md` : 145 caractères de médiane n'entrent pas dans 192 px. Prix mesuré et accepté — la ligne notée passe de 91 à **195 px** en bureau, de 146 à **361 px** à 375 px
- [x] ✅ **0 vérifié sur données réelles** (plusieurs offres notées 0), **100 vérifié par un rendu forcé** puis retiré — les deux axes, en bureau et à 375 px. Le chiffre reste dans le cadre, la barre à 0 laisse voir sa piste. ⚠️ C'est ce cas-là qui a imposé le **filet autour de la piste** : sans lui, à 0, il ne restait rien du tout à l'écran
- [x] ✅ **Vérifié à l'écran** le 26 août : salaire absent (cartouche creux italique), annualisé (« 40–50 k€ »), et libellé brut quand `salaire.py` a **renoncé** — « Mensuel de 45000 Euros à 60000 Euros sur 12 mois » reste affiché tel quel, le refus du pipeline n'est pas rattrapé à l'affichage
      ⚠️ **Le pari de `docs/DESIGN.md` sur la largeur de page est démenti** : l'annualisation étant calculée *pendant* la notation, seules **31 offres sur 535** l'ont. Les 504 autres affichent le libellé long, donc les 1000 px ne peuvent pas baisser
- [x] ✅ **DÉCLENCHÉ POUR DE VRAI le 26 août 2026**, et gratuitement : un modèle inexistant fait répondre **404** à l'API avant tout traitement, donc `APIStatusError` est levée sans qu'un seul token soit facturé.
      Vérifié en base sur l'offre `212YRCR` : motif tracé, `note_interet` resté `NULL` (contrainte `echec_sans_note` respectée), `notation_tentatives` incrémenté, exécution #45 fermée en `echec`, **code de sortie 1** — c'est lui qui fait rougir le job GitHub Actions.
      ✅ **Le cycle complet a même tourné sans être orchestré** : la même offre, remise dans la file (2 tentatives < 3), a été notée avec succès par le lot Batches vingt minutes plus tard. Échec → reprise → réussite, sur données réelles.
      ✅ Vérifié à l'écran : le message affiche le compte de tentatives, et **le motif technique ne quitte pas le serveur** (`not_found_error` absent du document reçu par le navigateur).
- [~] **États** : ✅ offre en attente de note (cartouche creux, ligne inchangée à 91 px) · ✅ échec de notation (icône + message, rendu forcé) · ✅ chargement (squelette à 203 px contre 195 px de ligne réelle) · ⚠️ **200 offres notées vérifié en SIMULATION seulement** — 97 dupliquées jusqu'à 200 : 39 567 px de haut, 5 699 nœuds, 153 Ko transférés, 70 ms de recalcul, aucun débordement. La base n'a pas 200 offres notées
      ✅ **Deux états ajoutés à la clôture du 28 août** : **base injoignable**, déclenché pour de vrai en relançant le serveur sur une URL Supabase morte — encadré brique, « La base est injoignable », et le message précise que les offres ne sont pas perdues ; **mot de passe incorrect**, bordure brique *et* icône *et* message, l'information ne tenant jamais sur la seule couleur.
      ⚠️ **Ce que la clôture n'a PAS pu voir, et il faut le dire** : le squelette **en vol** — Turbopack répond en 332 ms, donc il n'apparaît jamais. Ce qui est établi à la place est structurel : `loading.tsx` et `ligne-offre.tsx` importent le même `RYTHME_LIGNE`, en `rem`, et **aucun des deux ne porte de hauteur en dur** (vérifié par lecture des deux fichiers). C'est une garantie par construction, pas une observation.
      ⚠️ Et l'état **base vide** n'est plus reproductible : la base ne s'efface pas.
- [x] ✅ **375 px, mode sombre, console propre** — 0 erreur, 0 avertissement · 0 ligne cassée sur 200 à 1000 px, cartouche supplémentaire compris · aucun débordement horizontal à 375 px · 11 nouvelles paires de contraste mesurées, toutes conformes

### Bloquée par

Phase 1.

---

## Phase 3 : La fiche d'une offre

**User stories** : US-5, US-6, US-7, US-32 *(affichage)*

### Ce qu'on livre

Un clic sur une offre ouvre tout d'un écran : entête complet, les deux notes avec leurs
justifications, le résumé court, la description intégrale repliée derrière un bouton, et le
lien vers l'annonce d'origine.

### Critères d'acceptation

- [ ] `/offres/190MTLR` affiche l'entête : intitulé, entreprise, lieu, type de contrat, date de publication, salaire
- [ ] Un identifiant au mauvais format est **refusé avant d'atteindre la base**, avec une page « offre introuvable »
- [ ] Un identifiant bien formé mais inexistant donne la même page, pas une erreur serveur
- [ ] La description intégrale est **conservée et affichable même si l'annonce a été dépubliée** à la source
- [ ] Le lien externe n'est **pas présenté comme garanti**
- [ ] « Salaire non précisé » a son traitement propre — cartouche vide et italique
- [ ] Un intitulé de 150 caractères ne casse pas l'entête à 375 px
- [ ] Une description de 20 000 caractères se déplie sans faire déborder la page
- [ ] La **colonne gauche creuse** identifiée comme défaut connu dans `docs/DESIGN.md` est tranchée sur du contenu réel
- [ ] **États** : offre sans notes *(non encore notée)* · en chargement · offre introuvable · description très longue
- [ ] 375 px, mode sombre, focus clavier visible, console propre

### Bloquée par

Phase 2.

---

## Phase 4 : Statuts et notes personnelles

**User stories** : US-9, US-10, US-11, US-12, US-13

### Ce qu'on livre

Trier sa matinée : « candidaté » ou « écarté » en un clic depuis la liste comme depuis la
fiche, l'offre quitte le filtre « à traiter ». Et une note libre par offre, qui s'enregistre
toute seule.

### Critères d'acceptation

- [ ] Trois statuts : à traiter *(par défaut)*, candidaté, écarté — changement en **un clic**, depuis la liste et depuis la fiche
- [ ] Un statut modifié **persiste après rechargement et après fermeture du navigateur** — critère de succès n° 7
- [ ] Le filtre de statut est **dans l'adresse** : `/offres?statut=candidate` se met en favori et survit au bouton retour
- [ ] Le filtre par défaut n'affiche que « à traiter » ; candidaté et écarté restent accessibles
- [ ] Chaque statut porte **une icône ou un symbole en plus de sa couleur**
- [ ] La note personnelle s'enregistre **sans bouton**, avec un indicateur d'état visible
- [ ] Réseau coupé pendant la saisie : **un message d'échec apparaît et le texte n'est pas effacé** — critère de succès n° 6
- [ ] Une note de 5 000 caractères s'enregistre et se réaffiche intégralement
- [ ] Deux clics rapides sur un bouton de statut ne produisent pas deux écritures
- [ ] **Aucune requête ne fait `SELECT *` sur `offres`** — les notes personnelles ne sortent de la base que là où elles s'affichent
- [ ] **États** : aucune offre dans le filtre choisi · enregistrement en cours · échec d'enregistrement · note vide · 200 offres filtrées
- [ ] 375 px, mode sombre, focus clavier visible, console propre

### Bloquée par

Phase 3.

---

## Phase 5 : L'écran du matin

**User stories** : US-1, US-2, US-24, US-25, US-27

### Ce qu'on livre

`/` devient le **compte rendu de la nuit** : ce que l'agent a trouvé, l'étiquette
« Nouveau », l'état de santé du système, et un passage franc vers le poste de travail.

⚠️ **Décision produit du 16 août 2026, qui amende `docs/PRD.md`** : `/` n'affiche **que la
collecte de la dernière exécution réussie**, et non plus « tout ce qui reste à traiter ».
Motif : la page porte la date du jour en tête ; y mêler des offres de la semaine
précédente ferait mentir cet entête. Le travail se fait dans la vue d'ensemble ; `/` est un
compte rendu. La ligne de passage chiffrée empêche l'oubli.

### Critères d'acceptation

- [ ] `/` n'affiche **que les offres de la dernière exécution réussie**, statut « à traiter », intérêt ≥ 50, classées par intérêt décroissant
- [ ] La date en tête est celle de la collecte affichée — jamais la date du jour si la dernière collecte est plus ancienne
- [ ] L'étiquette « Nouveau » se calcule par appartenance à la dernière exécution réussie — **aucune date de dernière visite stockée**
- [ ] L'étiquette est **à côté de l'entreprise**, pas à droite où elle se cognerait aux barres de notes
- [ ] Une ligne de passage vers `/offres?statut=a-traiter` indique **le nombre d'offres plus anciennes en attente**
- [ ] L'indicateur de dernière veille réussie est visible **en permanence**, sur cet écran comme sur le poste de travail
- [ ] Au-delà de **36 heures** sans veille réussie, il passe en alerte visuelle — critère de succès n° 2
- [ ] L'alerte porte **un symbole en plus de sa couleur**
- [ ] Trois états vides **distincts** : « la collecte de cette nuit n'a rien ramené » · « aucune offre n'atteint le seuil » · « tu as tout traité » — chacun rappelant la date de la dernière veille réussie
- [ ] Deux exécutions le même jour : c'est la **dernière réussie** qui fait foi
- [ ] Une exécution en échec ne devient jamais la référence — l'écran montre la dernière **réussie**, et l'indicateur signale l'échec
- [ ] **États** : les trois vides ci-dessus · en chargement · Supabase injoignable · 40 offres d'un coup
- [ ] 375 px, mode sombre, focus clavier visible, console propre

### Bloquée par

Phases 2 et 4.

---

## Phase 6 : L'enrichissement à la demande, et l'identité de l'entreprise

**User stories** : US-15, US-16, US-17 *(identité, taille)*, US-20, US-29, US-30, US-31,
US-35, US-36, US-37 *(enrichissement)*, **US-38** *(enveloppe quotidienne)*

### Ce qu'on livre

Un clic sur « Enrichir cette offre », les étapes défilent sous les yeux, et la fiche donne
l'identité vérifiable de l'entreprise : nom officiel, âge, taille, chiffre d'affaires quand
il est public.

**C'est la phase qui contient tout le mécanisme** — l'agent, le déclenchement, le flux
d'étapes, les quatre états du bloc, et l'enveloppe quotidienne de tokens. Tranche
volontairement étroite sur le contenu : elle isole le **risque d'appariement** identifié au
PRD, le rapprochement par nom qui ramène une homonyme et produit une fiche fausse
d'apparence rigoureuse.

⚠️ **L'enrichissement est exclusivement manuel** — décision du 16 août 2026, qui amende
`docs/DECISIONS.md` § 6 (« les deux »). L'automatique nocturne aurait produit une
soixantaine de fiches par mois, lues ou non, sur une sélection reposant sur des seuils que
la v1 n'a pas encore calibrés. Il part en Évolutions prévues avec sa condition de retour.

⚠️ **En retirant l'automatique, on retire le seul plafond de dépense du système** — « au
plus deux par nuit » n'était pas qu'une règle de sélection. L'enveloppe quotidienne de
tokens le remplace, et le remplace mieux : elle borne des euros, pas un nombre de clics
dont le coût varie du simple au quintuple.

### Critères d'acceptation

- [ ] Le bouton n'apparaît que sur une offre non encore enrichie, et se désactive dès le premier clic
- [ ] **La garde qui compte est côté serveur** : deux requêtes envoyées simultanément ne produisent qu'un seul enrichissement — vérifiable sans passer par le navigateur
- [ ] Une **première étape « Demande reçue »** est écrite par le serveur en moins d'une seconde — critère de succès n° 4
- [ ] Le workflow GitHub est lancé par appel ; le jeton est **limité à ce dépôt et au seul droit de lancer un workflow**
- [ ] L'agent est **borné en nombre d'étapes et en durée** ; au-delà il s'arrête et rend ce qu'il a trouvé
- [ ] Un enrichissement se conclut — fiche produite ou échec signalé — **en moins de cinq minutes**
- [ ] Les étapes remontent par **sondage d'une route serveur toutes les 1,5 s** ; le navigateur ne parle jamais à Supabase
- [ ] Le sondage **s'arrête** quand l'enrichissement se conclut — pas de requête en boucle sur un onglet oublié
- [ ] Chaque étape apparaît en fondu-glissé décalé de 130 ms ; la pulsation « en cours » est **coupée sous `prefers-reduced-motion`**
- [ ] La fiche remplit : nom officiel, date de création, site officiel, catégorie, tranche d'effectif, chiffre d'affaires
- [ ] **Chaque rubrique porte son marqueur *vérifié* ou *déduit***, et une rubrique sans information affiche **« non disponible »** — jamais une supposition
- [ ] Annonce émanant d'un intermédiaire sans employeur nommé : la fiche l'indique explicitement et **ne se rabat pas sur l'intermédiaire** — critère de succès n° 12
- [ ] Entreprise non identifiable avec certitude : la fiche le **signale** au lieu de trancher
- [ ] Un enrichissement échoué affiche **son motif** et un bouton « Relancer » ; la relance remplace la fiche précédente
- [ ] Chaque enrichissement écrit sa trace : offre, déclenchement, horodatages, durée, étapes effectuées, issue, motif, **modèle**, compteurs bruts
- [ ] La colonne `declenchement` existe et vaut « manuel » — elle ne se rajoute pas rétroactivement sur l'historique le jour où l'automatique reviendra
- [ ] Les compteurs alimentent `tokens_cumules`, **sans toucher** à `tokens_conversation`
- [ ] **L'enveloppe quotidienne vit dans le fichier de configuration versionné**, valeur de départ **300 000 tokens**, et elle est **vérifiée côté serveur** — pas seulement affichée
- [ ] L'enveloppe consommée se **calcule en sommant les traces du jour**, jamais depuis un compteur séparé qui divergerait à la première écriture ratée
- [ ] Au-delà de l'enveloppe, le bouton indique « plafond du jour atteint » et **aucun enrichissement ne part** — vérifiable en envoyant la requête sans passer par le navigateur
- [ ] Le compte **repart de zéro** le lendemain, à minuit heure de Paris
- [ ] **La notation nocturne n'entre pas dans l'enveloppe** — vérifiable en constatant qu'une nuit à 400 offres notées ne consomme rien du plafond du lendemain
- [ ] **Aucune trace ne porte un déclenchement automatique** — critère de succès n° 3
- [ ] Les rubriques **acceptent plusieurs paragraphes** — une rubrique dimensionnée pour une ligne invite l'agent à répondre en une ligne
- [ ] **États du bloc d'enrichissement** — les quatre du `DESIGN.md`, plus le débordement : pas encore lancé *(vide)* · en cours *(chargement et action en cours)* · terminé · échoué *(erreur)* · **un enrichissement de 40 étapes qui défile sans faire déborder le panneau ni la page**
- [ ] 375 px, mode sombre, focus clavier visible, console propre

### Bloquée par

Phases 2 et 3.

---

## Phase 7 : Ce que l'entreprise fait vraiment

**User stories** : US-17 *(ce qu'elle vend, à qui)*, US-18, US-19, US-21

### Ce qu'on livre

L'agent explore le site de l'entreprise et complète la fiche : ce qu'elle vend et à quels
clients, ce qu'elle fait réellement en IA, la technique attendue sur ce poste — et les
sources consultées.

### Critères d'acceptation

- [ ] Quatre rubriques ajoutées : ce qu'elle vend · à quel type de clients · ce qu'elle fait réellement en IA · la technique attendue sur ce poste
- [ ] Chacune porte son marqueur *vérifié* ou *déduit*
- [ ] **Les sources consultées sont listées**, chacune avec son adresse
- [ ] Un site officiel injoignable **ne fait pas échouer l'enrichissement** : la fiche se rend partielle, les rubriques manquantes en « non disponible »
- [ ] La borne de durée et d'étapes tient **malgré l'exploration** — c'est la phase qui la met à l'épreuve
- [ ] Le **coût réel** d'un enrichissement est mesuré, en euros **et en tokens**, et comparé aux deux estimations du PRD (0,20 € à 1 € · 100 000 à 150 000 tokens) ; l'écart est consigné
- [ ] **L'enveloppe quotidienne de 300 000 tokens est re-réglée sur cette mesure** — c'est le seul moment du plan où l'on dispose du chiffre réel, et une enveloppe laissée sur une estimation ne borne rien de connu
- [ ] Une fiche dont toutes les rubriques sont longues s'affiche sans casser la mise en page à 375 px
- [ ] Une fiche dont **toutes** les rubriques sont « non disponible » reste lisible et ne ressemble pas à un bogue
- [ ] **États** : fiche complète · fiche partielle · toutes rubriques non disponibles
- [ ] 375 px, mode sombre, console propre

### Bloquée par

Phase 6.

---

## Phase retirée : l'enrichissement automatique nocturne

Le plan comptait huit phases jusqu'au 16 août 2026. La huitième — *l'enrichissement
automatique, chaque nuit* — a été retirée le jour même de l'écriture du plan, avant tout
développement.

**Motif** : elle aurait produit une soixantaine de fiches par mois, lues ou non, à raison
de 0,20 € à 1 € pièce, sur une sélection reposant sur des seuils que le PRD marque
lui-même « à re-régler après deux semaines de données réelles ». On aurait payé pour des
fiches choisies par une heuristique pendant exactement la période où elle est la moins
fiable. Le bon déclencheur d'un enrichissement est la lecture d'une offre qui accroche.

**Ce qui l'a remplacée** : l'enveloppe quotidienne de tokens en phase 6. Retirer
l'automatique retirait aussi « au plus deux par nuit », qui était le seul plafond de
dépense du système — l'enveloppe le remplace et borne mieux, en euros plutôt qu'en clics.

Elle figure en **Évolutions prévues** du PRD avec sa condition de retour : *quand les
seuils auront été calibrés sur des données réelles et que le coût par enrichissement aura
été mesuré.* Les deux chiffres sortent de la v1. La remettre coûterait une phase courte —
le mécanisme d'agent est identique, seule la règle de sélection change — à condition que la
phase 1 ait bien conservé **toutes les notes de toutes les offres**, y compris sous le
seuil, et que la phase 6 ait bien créé la colonne `declenchement`.

---

## Contenu de test

Le jeu de données minimal sans lequel les critères ci-dessus ne sont pas vérifiables. Écrit
une fois, réutilisé à chaque phase. **Sans lui, tout se testera avec trois lignes courtes et
tout tiendra toujours.**

- [x] ⚠️ **L'intitulé très long EXISTE — le « ça n'existe pas » du 21 août 2026 est démenti.** L'historique de cette ligne est instructif : 99 caractères au maximum sur 235 offres (20 août), 79 sur 189 (21 août), 94 sur 373 (26 août au matin) — d'où la conclusion « les intitulés France Travail sont courts, ne pas fabriquer ce cas ». Remesuré le 26 août **au soir sur 535 offres** : **223 caractères** (« Stage de fin d'études / Alternance - Sujet de stage : Accompagner les transformations majeures des acteurs du transport… »), médiane 43, **3 offres au-dessus de 94**. ✅ Vérifié à l'écran : 6 lignes à 375 px, 2 en bureau, rien ne casse.
      ⚠️ **La leçon : un maximum observé n'est pas une borne, c'est un échantillon — et il ne peut que monter.** Quatre mesures concordantes ont produit une conclusion fausse. Ne jamais écrire qu'un cas « n'existe pas » sur la foi d'un maximum ; écrire ce qu'on a vu, avec la taille de l'échantillon et la date
- [x] La description France Travail la plus longue possible — **5 000 caractères**, le plafond de l'API, vérifié le 20 août 2026 : au-delà le texte est coupé en plein mot et `GET /offres/{id}` renvoie la même troncature. ✅ **5 offres à exactement 5 000 caractères sont en base** (la plus courte fait 419)
- [x] L'offre au minimum de champs remplis : pas de salaire, entreprise non communiquée, contrat imprécis — celle qui teste les replis d'affichage. ⚠️ **Ce n'est pas un cas limite** : remesuré le 26 août sur **373 offres**, **36 % ne nomment pas l'entreprise et 65 % n'indiquent aucun salaire** (contre 34 % et 69 % sur les 189 du 21 août — les proportions tiennent quand le volume double). Le lieu, lui, est **toujours renseigné** : 0 offre sur 373 sans lieu
- [x] Les formes de salaire — ⚠️ **9 familles au 26 août 2026, pas 6** : remesuré sur 373 offres. `Annuel de N Euros à N Euros` (77) · `Annuel de N Euros à N Euros sur N mois` (35) · `Mensuel de N Euros à N Euros sur N mois` (6) · **`Annuel de N Euros` (5)** · `Mensuel de N Euros à N Euros` (3) · `Annuel de N Euros sur N mois` (2) · `Mensuel de N Euros sur N mois` (2) · **`Horaire de N Euros à N Euros sur N mois` (1)** · **absent (242)**.
      ⚠️ **Trois familles sont apparues entre le 21 et le 26 août**, dont deux qui changent le travail de la phase 2 : `Annuel de N Euros` porte un **montant unique et non une fourchette**, et `Horaire` demande une **conversion par le temps de travail**, pas une simple lecture. Le normaliseur doit couvrir 9 formes, et le compte augmentera encore — **ne pas coder une liste fermée**
- [x] **200 offres** dans la vue d'ensemble — ✅ **189 en base au 21 août** (remplissage manuel sur 7 jours, `--depuis-jours 7`). Le volume grandit d'environ 25 offres par jour avec le cron
- [x] ✅ **L'échantillon d'essai : l'offre la plus récente non notée.** Décidé le 26 août 2026 (révisé de 5 à 1 le jour même). Assez petit pour relire la note, la justification *et* le prompt qui les a produites — c'est le seul moyen de voir un étalonnage qui dérive avant d'en produire des centaines
- [x] ✅ **97 offres notées au 26 août 2026** — utiliser ce jeu plutôt que d'en fabriquer un. Distribution réelle : médiane d'intérêt **5**, moyenne **9**, maximum **85** ; **6 offres au-dessus de 30**, **2 au-dessus de 50**. ⚠️ **La distribution est ÉCRASÉE EN BAS** : la grande majorité des notes sont entre 0 et 10. À l'écran, deux offres à 3 et 8 sont effectivement indistinguables sur une barre linéaire 0-100.
      ✅ **TRANCHÉ le 26 août 2026 : l'échelle reste linéaire.** Le chiffre exact est écrit à côté de la barre, donc rien n'est perdu ; étaler le bas ferait paraître prometteuses des offres qui ne le sont pas. Décision de Maxime, motif dans `docs/DESIGN.md` § Les deux notes
- [x] ✅ **Le cas « intérêt haut / accessibilité basse » existe en vrai** : « Alternant Ingénieur IA Agentique » à **85 / 15**. C'est une alternance — passionnante et hors de portée. C'est le cas qui valide la séparation des deux notes, et il est en base
- [x] Les valeurs extrêmes de notes. ✅ **0 existe en vrai sur les deux axes** (« Conducteur d'engins Polyvalent » à 0/5, plusieurs offres à 0/0). **100 n'existe sur aucun axe** — maximum réel observé : **85 en intérêt, 55 en accessibilité** sur 97 notées. Vérifié le 26 août par un **rendu forcé à 100/100**, puis retiré : le chiffre reste dans le cadre, la barre ne déborde pas, en bureau comme à 375 px
      ⚠️ **Que le maximum réel plafonne à 85 / 55 n'est pas un défaut d'affichage, c'est une information sur le gisement** — et elle rejoint le chantier des critères de collecte
- [ ] Une note personnelle de **5 000 caractères**
- [ ] Une justification de note anormalement longue — le modèle peut déraper, l'écran doit tenir
- [ ] Une offre **écartée**, avec ses notes et sa justification, consultable
- [ ] Une offre dont l'annonce a été **dépubliée** à la source : description toujours lisible, lien mort
- [ ] Une fiche d'enrichissement dont **toutes** les rubriques sont « non disponible »
- [ ] Une fiche produite depuis une annonce d'**intermédiaire** : employeur final non identifié
- [ ] Une fiche portant le **doute** sur l'identification de l'entreprise
- [ ] Un enrichissement **échoué**, avec son motif, relançable
- [ ] **Deux exécutions de veille le même jour**, dont une en échec
- [ ] Une base **sans aucune veille réussie depuis 40 heures**, pour déclencher l'alerte à 36 h
- [ ] Une base **entièrement vide** — le tout premier matin

---

## Parcours à repasser

Ce que l'application doit toujours savoir faire. **Liste cumulative** : chaque phase livrée
dépose les siens, aucun ne s'enlève. À dérouler avec Playwright avant chaque mise en ligne,
et après toute phase qui touche à une partie déjà livrée — c'est le seul filet contre les
régressions tant qu'il n'y a pas de tests automatisés.

**Après la phase 1** — *tous déroulés en production le 26 août 2026*

- [x] Ouvrir le site sans être connecté, être renvoyé vers `/connexion` — 307 vers `/connexion?suite=%2F` et `?suite=%2Foffres`
- [x] Taper le mot de passe, arriver sur les offres, recharger la page, être toujours connecté — 200 offres avant et après rechargement
- [x] **Appeler une adresse de données en dehors du navigateur, sans mot de passe, et ne recevoir aucune offre** — 4 adresses, 307, corps de 15 octets, aucun champ d'offre
- [x] Vérifier que la collecte de cette nuit a bien écrit sa trace — l'écran annonce « 200 offres les plus récentes, sur 373 collectées »
- [x] **Voir la liste sans qu'elle saute au chargement** — le squelette et la ligne réelle ont la même hauteur, à 375 px comme en bureau, et **quelle que soit la taille de police du navigateur** (mesuré à 16, 20 et 24 px de racine)

**Après la phase 2** — *déroulés en développement le 26 août 2026, sur les 535 offres réelles*

- [x] Voir sur chaque offre notée deux notes chiffrées et **deux justifications non vides** — 97 offres, aucune justification vide (les contraintes `interet_justifie` et `accessibilite_justifiee` le rendent impossible en base)
- [x] **Vérifier que le classement place bien les offres notées en tête** — 85, 75, 40, 38, 35… puis les 103 non notées, qui portent leur cartouche « Pas encore notée ». ⚠️ C'est le parcours qui attrape le piège `NULLS FIRST` : sans `nullslast`, la liste aurait l'air normale **et n'aurait classé personne**
- [x] **Compter les lignes dont les cartouches cassent sur deux lignes à 1000 px** — 0 sur 200, cartouche « Pas encore notée » compris. À refaire à chaque ajout de cartouche
- [ ] Retrouver une offre écartée par le seuil, avec sa note et son motif — *dépend du filtre de statut, phase 4*

**Après la phase 2 — le cron** — *déroulé en production le 26 août 2026, exécution `33011739111`*

- [x] **Déclencher le workflow à la main et voir les deux jobs verts** — collecte puis notation, enchaînées par `needs: collecter`
- [x] **Vérifier que le secret est masqué dans les journaux PUBLICS** — `ANTHROPIC_API_KEY: ***` dans la sortie du runner
- [x] **Vérifier que `--derniere-collecte` désigne la collecte qui vient de tourner** — journal : « Notation restreinte à la collecte **#48** », et non #43 qui portait 146 offres non notées. ⚠️ C'est le parcours qui attrape le risque à 90 centimes
- [x] **Vérifier qu'une notation sans rien à faire n'écrit AUCUNE ligne d'exécution** — `offres_a_noter()` rend une liste vide et le module sort *avant* `ouvrir_execution()`. Une table d'exécutions polluée de lignes vides fausserait l'écran de suivi d'exploitation
- [ ] ⚠️ **NON VÉRIFIÉ : l'appel payant depuis le runner.** La collecte de 22 h 42 a ramené **0 offre nouvelle** (la précédente datait de 20 h 32), donc la notation n'avait rien à noter. Le chemin réseau vers `api.anthropic.com` depuis GitHub Actions n'a jamais été exercé.
      ⚠️ **Et il ne peut pas être forcé** : la collecte ne rattache à son exécution que les offres **nouvelles**, donc un rattrapage manuel sur 30 jours ne ramène que des offres déjà en base, dédupliquées, non rattachées — toujours zéro à noter. Ce parcours se fermera de lui-même au premier cron qui trouve des offres.
      ✅ Ce qui est établi malgré tout : `configuration.charger_notation()` **vérifie explicitement** la présence de `ANTHROPIC_API_KEY` avant toute lecture de base. Le job étant vert, la clé est lisible depuis le runner — ce n'est pas une supposition

**Après la phase 2 — la clôture du 28 août 2026** — *déroulés en développement sur les 560 offres réelles*

- [x] **Se déconnecter, retaper l'adresse des offres, retomber sur la porte** — bouton « Se déconnecter » → `/connexion`, puis `/offres` → 307 vers `/connexion?suite=%2Foffres`
- [x] **Taper un mauvais mot de passe et voir pourquoi ça a échoué** — bordure brique *et* icône *et* « Mot de passe incorrect. », champ vidé, message générique qui ne dit pas si le mot de passe existe
- [x] **Se reconnecter et revenir là où on voulait aller** — le paramètre `suite` ramène sur `/offres`, pas sur l'accueil
- [x] **Voir la frontière entre offres notées et non notées** — la première « Pas encore notée » tombe à l'index **126**, soit exactement le nombre de notées. ⚠️ C'est ce parcours qui attrape une inversion de tri : un `NULLS FIRST` la mettrait à l'index 0 sans qu'aucune erreur n'apparaisse
- [x] **Recharger deux fois et retrouver le MÊME ordre** — 200 identifiants identiques. Sans départage jusqu'à `identifiant`, les ex æquo (trois offres à 85, cinq à 75) permuteraient d'un chargement à l'autre
- [x] **Couper la base et regarder l'écran** — serveur relancé sur une URL Supabase morte : « La base est injoignable », le message dit que les offres ne sont pas perdues, et **le motif technique ne quitte pas le serveur**
- [x] **Compter les colonnes sensibles reçues par le navigateur** — `notation_motif_echec`, `execution_id`, `salaire_annuel_min`, `notation_tentatives`, `charge_brute`, `contact_nom`, `tokens_cumules` : **0 occurrence chacune**, contre 126 pour un texte réellement affiché. ⚠️ **Le témoin n'est pas décoratif** : sans lui, un test qui ne trouve rien peut simplement être cassé
- [x] **Vérifier qu'une passe à blanc n'écrit RIEN** — `--sans-ecrire` sur la notation : aucune écriture tentée, ni ligne d'exécution ni note. ⚠️ Ce parcours existe parce que le contraire était vrai jusqu'au 28 août
- [ ] Retrouver une offre écartée par le seuil, avec sa note et son motif — *dépend du filtre de statut, phase 4*

**Après la phase 3**

- [ ] Ouvrir une offre, déplier la description intégrale, la replier
- [ ] Suivre le lien vers l'annonce d'origine

**Après la phase 4**

- [ ] Passer une offre en « candidaté », la voir quitter le filtre « à traiter », la retrouver dans le filtre « candidaté »
- [ ] Écrire une note personnelle, quitter la page sans rien enregistrer, revenir, la retrouver
- [ ] Couper le réseau pendant la saisie d'une note : voir le message d'échec **et retrouver son texte**

**Après la phase 5**

- [ ] Ouvrir `/` le matin, voir la collecte de la nuit et la date exacte
- [ ] Suivre la ligne de passage vers le poste de travail et retrouver les offres plus anciennes
- [ ] Lire la date de la dernière veille réussie sur les deux écrans

**Après la phase 6**

- [ ] Cliquer sur « Enrichir », voir la première étape en moins d'une seconde, puis les étapes de l'agent défiler
- [ ] Double-cliquer sur « Enrichir » et vérifier qu'**un seul** enrichissement part
- [ ] Relancer un enrichissement échoué
- [ ] **Saturer l'enveloppe du jour et constater que le bouton refuse de partir**, puis vérifier qu'il repart le lendemain
- [ ] Constater après une nuit de veille que **le plafond du jour est intact** — la notation n'y touche pas

**Après la phase 7**

- [ ] Lire une fiche complète et **distinguer d'un coup d'œil ce qui est vérifié de ce qui est déduit**
- [ ] Ouvrir une source citée et vérifier qu'elle dit bien ce que la fiche affirme

**À chaque mise en ligne**

- [ ] Chercher `NEXT_PUBLIC` dans le code source de la page publiée — ne rien trouver
- [ ] Chercher les préfixes de clés Supabase et Anthropic dans le code source de la page publiée — ne rien trouver
- [ ] Repasser tous les parcours ci-dessus à **375 px** et sur écran d'ordinateur, en clair et en sombre, **console ouverte**
