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
2. **Un `proxy.ts` unique protège tout par défaut** (le middleware de Next 16), avec exactement trois exceptions en
   **liste blanche** : la page de connexion, l'action qui vérifie le mot de passe, les
   fichiers statiques. L'inverse — énumérer les adresses à protéger — laisserait toute
   adresse ajoutée plus tard ouverte, **sans rien signaler**.
3. **Session** : cookie signé, `HttpOnly` + `Secure` + `SameSite=Lax`, **30 jours
   glissants**. Aucune table de sessions.
4. **Mot de passe** : 32 caractères aléatoires, **comparaison à temps constant** (une
   comparaison ordinaire s'arrête au premier caractère différent et se devine au
   chronomètre), **délai d'une seconde** imposé à chaque tentative.

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

> **Avancement au 21 août 2026 — étapes 1 et 2 sur 6 terminées.**
>
> | # | Étape | État |
> |---|---|---|
> | 0 | Collecte à blanc contre l'API France Travail | ✅ faite — résultats dans `docs/API_FRANCE_TRAVAIL.md` |
> | 1 | Le schéma en base, migrations versionnées | ✅ **fait** — 18 contrôles au vert |
> | 2 | Le pipeline Python de collecte (`pipeline/`) | ✅ **fait** — 189 offres réelles en base, 15 défauts corrigés après `/code-review` |
> | 3 | La porte : `/connexion` + `proxy.ts` + session | ⬅️ **prochaine étape** |
> | 4 | L'écran `/offres` et ses quatre états | à faire |
> | 5 | Mise en ligne : variables Vercel + cron GitHub Actions | à faire |
> | 6 | Remesure de la mise en page contre le contenu réel, puis `/cloture` | à faire |
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
aussi la phase qui lève le plus d'incertitude — c'est là qu'on découvre si le champ
« expérience exigée » existe vraiment (marqué *à confirmer* dans `API_FRANCE_TRAVAIL.md`)
et à quoi ressemble une description France Travail complète.

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
- [ ] Sans mot de passe, `/` et `/offres` renvoient vers `/connexion`
- [ ] **Sans mot de passe, une adresse de données appelée en dehors du navigateur ne renvoie aucune offre** — critère de succès n° 5
- [ ] Une session ouverte survit à un rechargement et à la fermeture du navigateur, et expire après 30 jours d'inactivité
- [ ] Cinq tentatives de mot de passe erronées prennent chacune au moins une seconde
- [ ] `/offres` affiche les offres collectées avec intitulé, entreprise, lieu, contrat, date
- [ ] **États de `/offres`** : aucune offre en base · en chargement · Supabase injoignable · 200 offres affichées sans débordement horizontal
- [ ] Le site est **déployé sur Vercel** et le **cron GitHub tourne**, tous deux vérifiés en conditions réelles
- [ ] À 375 px et en mode sombre : aucun débordement horizontal, **aucune erreur en console**
- [ ] Aucune variable `NEXT_PUBLIC_` dans le code source de la page publiée
- [ ] Les valeurs de mise en page de `docs/DESIGN.md`, posées contre du contenu inventé, sont **remesurées contre le contenu réel** puis figées

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

- [ ] Les critères de pertinence vivent dans un **fichier texte versionné**, pas dans le code, et sont injectés en préfixe du prompt
- [ ] Le cache de prompt est **actif et vérifié** : `cache_read_input_tokens` est non nul dès le deuxième appel du même lot
- [ ] La notation passe par l'**API Batches**, et les résultats sont rattachés par leur identifiant, **jamais par leur position**
- [ ] Le modèle renvoie une **sortie structurée** : deux entiers de 0 à 100, deux justifications, un résumé court, un salaire annualisé
- [ ] Une offre déjà notée n'est **jamais renotée**, même si l'annonce a changé à la source
- [ ] `executions_veille` enregistre le **modèle utilisé** et les compteurs de tokens bruts
- [ ] Le compteur `tokens_cumules` de chaque offre est incrémenté
- [ ] Les deux barres portent leur libellé **`INT` et `ACC`** — jamais retirés, même à 375 px : sans eux l'information tient sur la seule couleur
- [ ] Les justifications se lisent **à plat dans la liste**, ni derrière une infobulle, ni derrière un dépliage — c'est le seul mécanisme qui révèle une notation mal étalonnée
- [ ] Notes à 0 et à 100 sur les deux axes : les barres restent lisibles, le chiffre reste dans le cadre
- [ ] Salaire absent, « Selon profil », « Mensuel de 3500 Euros » : l'offre s'affiche correctement dans les trois cas
- [ ] Une notation qui échoue laisse l'offre en base **sans note**, avec son motif tracé — elle n'est pas perdue
- [ ] **États** : aucune offre notée · notation en cours · échec de notation · 200 offres notées
- [ ] 375 px, mode sombre, console propre

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

- [x] ~~L'intitulé le plus long — environ **150 caractères**~~ → **retiré le 21 août 2026 : ça n'existe pas.** Mesuré deux fois sur des données réelles — **99 caractères** au maximum sur 235 offres le 20 août, **79** sur 189 offres le 21 août. Les intitulés France Travail sont courts. Décision de Maxime : ne pas fabriquer un cas que la source ne produira jamais. ⚠️ **Ce qui reste vrai** : il faut quand même vérifier la mise en page à 375 px contre l'intitulé le plus long **réellement observé**, pas contre trois lignes de démo
- [x] La description France Travail la plus longue possible — **5 000 caractères**, le plafond de l'API, vérifié le 20 août 2026 : au-delà le texte est coupé en plein mot et `GET /offres/{id}` renvoie la même troncature. ✅ **5 offres à exactement 5 000 caractères sont en base** (la plus courte fait 419)
- [x] L'offre au minimum de champs remplis : pas de salaire, entreprise non communiquée, contrat imprécis — celle qui teste les replis d'affichage. ⚠️ **Ce n'est pas un cas limite** : sur les 189 offres en base au 21 août, **34 % ne nomment pas l'entreprise et 69 % n'indiquent aucun salaire**
- [x] Les formes de salaire — **6 observées en base au 21 août**, l'absence comprise : `Annuel de N Euros à N Euros` (32) · `Annuel de N Euros à N Euros sur N mois` (17) · `Mensuel de N Euros à N Euros` (3) · `Mensuel de N Euros à N Euros sur N mois` (2) · `Annuel de N Euros sur N mois` (1) · `Mensuel de N Euros sur N mois` (1) · **absent (131)**
- [x] **200 offres** dans la vue d'ensemble — ✅ **189 en base au 21 août** (remplissage manuel sur 7 jours, `--depuis-jours 7`). Le volume grandit d'environ 25 offres par jour avec le cron
- [ ] Les valeurs extrêmes de notes, dans les deux sens : une offre **100 / 0** et une offre **0 / 100**
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

**Après la phase 1**

- [ ] Ouvrir le site sans être connecté, être renvoyé vers `/connexion`
- [ ] Taper le mot de passe, arriver sur les offres, recharger la page, être toujours connecté
- [ ] **Appeler une adresse de données en dehors du navigateur, sans mot de passe, et ne recevoir aucune offre**
- [ ] Vérifier que la collecte de cette nuit a bien écrit sa trace

**Après la phase 2**

- [ ] Voir sur chaque offre deux notes chiffrées et **deux justifications non vides**
- [ ] Retrouver une offre écartée par le seuil, avec sa note et son motif

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
