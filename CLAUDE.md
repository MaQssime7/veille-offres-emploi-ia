# CLAUDE.md — Veille offres emploi IA

Lu à chaque session de Claude Code dans ce dépôt. Complète le `CLAUDE.md` global
de Maxime (`~/.claude/CLAUDE.md`), il ne le remplace pas.

## Où trouver quoi

| Sujet | Où |
|---|---|
| **Pourquoi** une décision de cadrage est ce qu'elle est · questions encore ouvertes | `docs/DECISIONS.md` |
| **Schéma de la base** : tables, colonnes, contraintes, et le *pourquoi* de chacune | `supabase/migrations/` — **seule source de vérité, jamais recopiée ailleurs** |
| API France Travail : authentification, pagination, quota, cas limites | `docs/API_FRANCE_TRAVAIL.md` |
| **Mise en ligne** : variables Vercel, migrations Supabase, secrets GitHub Actions — commandes et pièges | `docs/HEBERGEMENT.md` |
| API Anthropic : modèles, paramètres, sortie structurée, cache, batches | référence `/claude-api` |
| Claude Agent SDK : surface d'API | `code.claude.com/docs/en/agent-sdk` |
| Ce que le produit doit faire · ce qu'il refuse de faire | `docs/PRD.md` |
| Identité visuelle : jetons, contrastes vérifiés, composants propres au produit | `docs/DESIGN.md` |
| Dans quel ordre le construire · contenu de test · parcours à repasser | `docs/PLAN.md` |
| Ce qui s'est passé et pourquoi, dans l'ordre | `docs/JOURNAL.md` |
| **Comment le modèle note** : profil, postes visés, barèmes des deux notes | `pipeline/criteres_pertinence.txt` — **c'est une donnée, pas du code** : s'édite à la main, se relit dans git. ⚠️ Deux marqueurs : `//` = commentaire retiré avant l'envoi, `##` = titre envoyé au modèle |
| **Ce que vaut chaque critère de collecte**, mesuré | `pipeline/codes_rome.txt` (vide, et porte la mesure qui l'a vidé) et `pipeline/mots_cles.txt` — ⚠️ **ne jamais éditer sans relire ces commentaires** : ils listent les termes déjà mesurés et écartés |
| Conventions Next.js 16 : fichiers, frontières RSC, données, métadonnées | skill `next-best-practices` (`.agents/skills/`) |
| **Comment le site est protégé** : cookie de session, mot de passe, adresses libres | `interface/lib/session.ts` et `interface/lib/acces.ts` — abondamment commentés, **seule source de vérité** |

**Règle de tenue de ce fichier.** Il ne contient que ce qui change mon
comportement sur *n'importe quelle* tâche du projet. Toute référence propre à un
module — paramètres d'API, schémas, procédures — part dans `docs/` avec un
pointeur impératif ici. Une section qui dépasse une vingtaine de lignes de détail
technique doit sortir. Sans cette règle, ce fichier fait 800 lignes dans un mois
et personne ne le lit plus.

## Le projet

Agent de veille quotidienne sur les offres d'emploi dans l'IA. Le pipeline :
récupérer les offres via l'API France Travail → les évaluer contre des critères
de pertinence → présenter un classement dans une interface web.

**Deux usages, pas un seul.** Le projet sert à Maxime pour sa recherche d'emploi
*et* de vitrine technique en entretien — le dépôt est public
(https://github.com/MaQssime7/veille-offres-emploi-ia). Conséquences concrètes :

- Le code sera lu par un recruteur ou un lead technique. Nommage explicite,
  fonctions courtes, pas de fichier fourre-tout.
- L'historique Git compte autant que le code. Commits atomiques, messages en
  français qui expliquent le *pourquoi*.
- Le README est la première chose lue. Il doit rester à jour quand
  l'architecture bouge.

<!-- produit:start -->
## Produit — Veille offres emploi IA

**Le problème** : trier à la main des dizaines d'annonces France Travail chaque
matin pour en garder deux ou trois, rater silencieusement celles dont l'intitulé
est banal, puis passer un quart d'heure par offre à comprendre à qui on a affaire.

**Pour qui** : un utilisateur unique — Maxime, jeune diplômé ENSEA, six mois en
cabinet de conseil IA, en recherche active en Île-de-France, qui consulte dix
minutes le matin et ouvre parfois le site en entretien pour le montrer.

**Hors périmètre, opposable** : mail et notifications · lettre de motivation et
argumentaire de candidature · candidature automatique · toute source d'offres
autre que France Travail · toute zone hors Île-de-France · comptes utilisateurs
et rôles · suivi de candidature avancé (calendrier, relances, CV) · réglage des
critères depuis l'interface · modification manuelle des notes du modèle · analyse
du marché de l'emploi (tendances, salaires, graphiques sectoriels) · application
mobile installable · démo publique à données fictives · traduction et offres hors
France · import de CV et appariement de compétences.

Le PRD fait autorité sur le périmètre : ce qui figure ici ne se construit pas, même
si ça semble une bonne idée sur le moment. Une demande qui tombe dedans se signale
**avant** d'être satisfaite, elle ne se glisse pas dans une phase.

**Évolutions prévues — ni v1, ni refusées.** Deux items, et chacun **contraint la v1
dès maintenant** : ne pas construire l'écran n'excuse pas de ne pas capturer sa
matière.

| Évolution | Ce que ça impose dès la v1 |
|---|---|
| Écran de suivi d'exploitation (exécutions, réussite, durée, coût) | Tracer chaque exécution et chaque enrichissement dès le premier jour, en **compteurs bruts** jamais en euros. Un historique ne se reconstitue pas |
| Conversation avec l'agent **sur une offre enrichie** — challenger sa fiche | Fiche d'enrichissement stockée en **champs séparés**, pas en texte rédigé · identifiant d'offre stable · enveloppe de consommation par offre en **tokens cumulés**, décidée avant la première table |

⚠️ Ne pas confondre l'écran de suivi d'exploitation, prévu, avec l'**analyse du
marché de l'emploi** (tendances, salaires, graphiques), refusée. Et la conversation
ne doit pas devenir la porte de service par laquelle rentre ce que le hors périmètre
refuse.

⚠️ **Ne jamais nommer cet écran « analytics ».** Le mot recouvre les deux à la fois —
celui qui est prévu et celui qui est refusé — et c'est par ce glissement qu'un graphe
de salaires finit par entrer « tant qu'on y est ». Le nom est **écran de suivi
d'exploitation**, et il ne parle que du système : exécutions, réussite, durée,
volumes, consommation. Jamais du marché de l'emploi.

⚠️ **La conversation porte sur *une* offre, jamais sur toute la base.** L'agent
global en page d'accueil a été explicitement refusé le 16 août 2026 et versé au hors
périmètre : son contexte et son coût ne sont pas bornables. Ne pas le réintroduire.

⚠️ **La borne de conversation se compte en tokens cumulés, jamais en nombre de
messages.** Le contexte est renvoyé au modèle à chaque tour : la consommation croît
quadratiquement avec les échanges. À 100 %, la saisie se bloque définitivement sur
cette offre — pas de bouton de réinitialisation, sinon ce n'est plus une borne.

⚠️ **Vocabulaire figé : « enrichissement », jamais « enquête ».** Le terme couvre
l'étape du pipeline, l'action dans l'interface et la fiche produite. Deux mots pour
la même chose finissent en deux tables et deux fonctions.

**Cadrage complet** : `docs/PRD.md` — 37 user stories, 13 critères de succès.
À rouvrir avant toute décision produit.
<!-- produit:end -->

## État actuel — 26 août 2026

**Phase 1 close. Phase 2 en cours — la notation tourne, l'écran reste à faire.**
Le site est en ligne derrière son mot de passe, la collecte tourne chaque nuit, l'écran
`/offres` lit la base. **535 offres réelles, 97 notées**, 0 échec sur 97 appels au modèle.
Les critères de collecte ont été entièrement refondus sur mesure le 26 août au soir.

| Brique | État |
|---|---|
| `interface/` | Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui moteur `radix`. La porte (`/connexion`, `proxy.ts`, session signée), l'écran `/offres`, mode sombre sur la préférence système |
| Supabase | Région Paris. `executions_veille` et `offres` créées et alimentées. RLS activé, droits vérifiés |
| Migrations | **5**, toutes appliquées — `supabase/migrations/`. La 5ᵉ ajoute la notation (deux notes, justifications, salaire annualisé, compteurs de tokens, colonne `etape`) |
| Vercel | https://veille-offres-emploi-ia.vercel.app · `Root Directory = interface` · région Paris |
| `pipeline/` | Collecte **et notation** livrées. **Cron GitHub Actions actif** à 02:23 UTC (4 h 23 à Paris l'été) — ⚠️ il ne fait QUE la collecte, la notation n'y est pas encore branchée. Critères dans `mots_cles.txt` (8 termes) et `codes_rome.txt` (**vide depuis le 26 août, délibérément**) |
| Modules | `collecte.py` · `notation.py` (`--limite`, `--modele`, `--effort`, `--lot`, `--rome`, `--collecte`, `--au-hasard`, `--renoter`, `--sans-ecrire`, `--sans-appeler`) · `salaire.py` · `criteres_pertinence.txt` |
| `.venv/` | À la racine, `requirements.txt` versionné |

**Reste à faire en phase 2 : l'écran.** Les deux barres de note et les justifications à plat
dans `/offres`, tri par intérêt décroissant. Rien d'autre.

⚠️ **La clé `ANTHROPIC_API_KEY` est posée et active** (`.env` racine, 5 $ de crédit, ~60
centimes consommés au 26 août). Elle n'est **pas** dans les secrets GitHub Actions : à y
mettre le jour où la notation sera branchée sur le cron. Jamais chez Vercel.

⚠️ **Huit choses à ne pas redécouvrir :**

1. **Le coût réel d'une notation : ~0,6 centime par offre**, cache chaud, Sonnet 5 au tarif
   d'introduction. Mesuré sur 97 appels. Une offre = ~4 500 tokens d'entrée dont 3 715 de
   préfixe mis en cache, ~250 de sortie. Noter les 453 offres restantes coûterait ~2,70 $ en
   direct, ~1,35 $ en Batches.
   ⚠️ **L'API Batches n'a JAMAIS tourné** — le code existe (`--lot`) et n'est pas testé. Elle
   met jusqu'à une heure à rendre ses résultats : appels directs pour régler le prompt,
   Batches pour le volume.
   ⚠️ **Prévenir Maxime avant tout appel facturé**, toujours, avec le nombre d'appels et
   l'ordre de grandeur. `models.list()` et `count_tokens()` sont gratuits — s'en servir sans
   demander. `--sans-appeler` affiche le prompt et compte ses tokens sans rien dépenser.

2. ⚠️ **Le cache de prompt a un plancher de 1024 tokens chez Sonnet 5, et EN DESSOUS IL NE DIT
   RIEN.** Pas d'erreur, pas de message : `cache_read_input_tokens` reste simplement à zéro et
   chaque offre repaie le préfixe. Le préfixe actuel fait **3 144 tokens**, donc le cache mord
   — vérifié, `cache_read` = 3 715 dès le deuxième appel. `notation.py` journalise les quatre
   compteurs à chaque appel et avertit si aucune lecture n'a lieu sur plusieurs offres.
   ⚠️ Toute modification de `criteres_pertinence.txt` invalide le cache : le premier appel
   suivant repaie le préfixe au tarif plein. C'est normal et ça ne coûte qu'une fois.

3. ⚠️ **Le champ `experience_libelle` de France Travail est FAUX une fois sur deux.** Mesuré :
   sur 3 offres vérifiées ligne à ligne, 2 portaient « Débutant accepté » ou « 2 An(s) » alors
   que le texte de l'annonce exigeait « 3 ans minimum ». **Toute logique bâtie sur ce champ —
   filtre, tri, seuil — sera fausse une fois sur deux.** Les critères de notation demandent
   explicitement de suivre le TEXTE et de signaler la contradiction. C'est aussi l'argument
   qui justifie de faire lire les annonces par un modèle plutôt que de les filtrer sur leurs
   métadonnées.

4. ⚠️ **Le barème d'accessibilité a été corrigé le 26 août, et la leçon est générale : quand le
   modèle s'écarte du barème, c'est souvent le barème qui a tort.** L'ancien classait
   l'expérience en facteur n°1 et les technologies en n°5 ; sur une annonce réseau « débutant
   accepté » exigeant Cisco/Aruba/Palo Alto, il commandait 90-100 alors que la chance réelle
   est nulle. Le modèle avait mis 40. Deux facteurs dominent désormais à égalité — expérience
   **et** adéquation technique — et les repères chiffrés ne valent que pour une pile familière.
   Effet vérifié en renotant les mêmes offres : seules bougent celles dont la pile est
   étrangère.
5. ⚠️ **La base ne s'efface pas.** Question posée et tranchée le 26 août : garder toutes les
   offres (373 alors, **535 depuis la recollecte du soir**), ne noter qu'un échantillon. Effacer et noter peu sont deux choses **sans rapport** —
   la notation est incrémentale (« une offre déjà notée n'est jamais renotée »). Quatre raisons
   de garder : France Travail **dépublie** ses annonces et une offre effacée ne revient jamais
   (c'est la raison d'être de `charge_brute`) · ces 373 offres **sont** le jeu de test mesuré,
   dont des formes de salaire présentes sur **une seule offre** · l'écran de suivi
   d'exploitation a besoin de l'historique, qui ne se reconstitue pas · et les offres anciennes
   se noient d'elles-mêmes (~1 500 de plus d'ici octobre, tri par date décroissante).
   **Si des offres périmées gênent à l'écran, c'est un filtre d'affichage qu'il faut, pas une
   suppression.**
6. **Le salaire : 9 familles de forme, et DEUX libellés faux à la source.** `pipeline/salaire.py`
   les traite — 129 montants retenus sur 373, 242 absents, 2 écartés. Les deux écartés :
   « Mensuel de 45000 à 60000 Euros sur 12 mois » (× 12 = 540 000 à 720 000 €/an, une offre
   d'**ingénieur IA**) et « Annuel de 35.0 Euros ». ⚠️ **Renoncer plutôt que deviner** : on ne
   les requalifie pas, on les écarte avec un motif et le libellé d'origine reste affiché.
   ⚠️ **Ne pas coder une liste fermée** de périodes — trois formes sont apparues en cinq jours.
   Une période inconnue rend `periode_inconnue:<mot>` et un avertissement, jamais une exception
   ni une conversion inventée. Le seuil de plausibilité vit **dans ce module et nulle part
   ailleurs**, surtout pas dupliqué en contrainte SQL.
7. **Les libellés de notes s'écrivent en toutes lettres** — « Intérêt », « Accessibilité ».
   C'est ce choix qui fonde `--largeur-page: 1000px` ; coder `INT`/`ACC` démentirait la mesure.
8. **Le rythme vertical de la ligne vit dans `_composants/rythme.ts`**, partagé avec le
   squelette de chargement. Le modifier ailleurs fait sauter la page sans aucune erreur.

### Les critères de collecte — refondus le 26 août, et le chantier n'est pas fini

**Question CLOSE : le bruit des codes ROME.** Elle était ouverte depuis le 26 août au matin
(« H1206 ramène 111 offres pour 6 pertinentes »). Tranchée le soir même, sur mesure :
**les six codes ROME sont retirés**, ils apportaient 445 offres nettes par mois pour zéro
offre au-dessus de 30 sur 50 notées au hasard. Détail dans `pipeline/codes_rome.txt`, qui
porte la mesure entière.

**Effet mesuré de la nouvelle configuration**, sur 15 offres tirées au hasard dans la collecte
de reconfiguration, comparées aux 82 notées sous l'ancienne :

| | Nouvelle config | Ancienne |
|---|---|---|
| Volume collecté | **294 offres/mois** | 707 |
| Moyenne d'intérêt | **16,2** | 7,7 |
| Médiane | **10** | 5 |
| Offres au-dessus de 50 | **7 %** | 1 % |
| Coût de notation | **~1,75 $/mois** | ~4,20 $ |

⚠️ **CHANTIER OUVERT — Maxime veut les critères les PLUS optimaux, et la mesure n'est pas
finie.** Ce qui reste à mesurer, dans l'ordre :

1. **`deploiement` (29 offres/mois) et `automatisation` (16)** ne sont pas mesurés. Ce sont eux
   qui ramènent « Conducteur d'engins Polyvalent » (noté **0/100**) et « Comptable support
   logiciel » (3/100). Premier gisement d'amélioration.
2. **`IA` matche `IPR-IA`** — « Inspecteur pédagogique régional ». Trois offres notées
   viennent de ce faux positif. À quantifier avant de décider quoi faire.
3. **`RPA` ne ramène que 3 offres/mois** — à garder ou retirer selon leur qualité.
4. **De nouveaux mots-clés à tester** : le vocabulaire s'ouvre (voir § Collecte), donc la
   liste des termes à zéro doit être remesurée périodiquement.

⚠️ **Question TOUJOURS OUVERTE : Sonnet 5 ou Opus 5 ?** **Rien n'a été testé sur Opus 5** — les
97 offres sont toutes notées par Sonnet 5. Le choix reste à faire en lançant `--renoter
--modele claude-opus-5` sur les mêmes offres et en comparant les notations côte à côte. À ce
niveau de dépense (~2,30 $/mois d'écart) il ne se joue pas sur le coût mais sur le nombre de
bonnes offres ratées.

### Ce qui reste ouvert

| | |
|---|---|
| `ANTHROPIC_API_KEY` dans GitHub Actions | Posée en local (`.env`), **absente des secrets GitHub** — à ajouter le jour où la notation sera branchée sur le cron. Jamais chez Vercel |
| Notation non branchée sur le cron | `.github/workflows/` ne lance que la collecte. La notation se lance à la main. À brancher avant de considérer la phase 2 close |
| Tri par note : piège `NULLS FIRST` | En PostgreSQL, `ORDER BY note_interet DESC` place les **NULL en PREMIER**. Sans `NULLS LAST` ou filtre explicite, les 438 offres non notées s'afficheraient **en haut** de la liste triée par intérêt. À traiter en construisant l'écran |
| API Batches jamais exécutée | `notation.py --lot` est écrit et **n'a jamais tourné**. Le rattachement par `custom_id` est en place mais non vérifié en conditions réelles |
| Critères de collecte non finis | `deploiement`, `automatisation`, `RPA` et le faux positif `IA`/`IPR-IA` restent à mesurer — voir § État actuel |
| Clés Supabase *legacy* | `anon` / `service_role` toujours actives en parallèle des nouvelles — à désactiver (`docs/HEBERGEMENT.md`) |
| `PGRST303` | « JWT issued at future » au premier appel après recompilation, **en développement seulement**. Symptôme : « base injoignable » alors que la base va bien |
| Largeur contre barre latérale | Les 1000 px figés ne laissent pas la place aux 208 px de filtres prévus en phase 4 — à trancher là-bas (`docs/DESIGN.md`) |
| En-tête de `/offres` | Ne plaît pas à Maxime. Reporté **après la phase 4**, quand les filtres y auront pris place |

⚠️ **Quatre règles opposables, qui ne se déduisent d'aucun fichier :**

1. **La page d'accueil `/` est une page de contrôle temporaire** posée par `/installe` — pas un
   écran du produit. Ne pas construire dessus. ⚠️ Elle vit dans `app/(site)/page.tsx`, un
   composant serveur qui appelle `exigerSession()` puis rend `_controle/page-de-controle.tsx`.
   En la remplaçant, **garder la première ligne** : c'est elle qui referme la porte.
   ⚠️ **Le groupe `(site)` n'est pas de l'organisation, c'est une serrure.** `/connexion` est
   délibérément *hors* du groupe — voir § Sécurité. Ne jamais l'y déplacer.
2. **Un aperçu Vercel parle à la *même* base que la production.** Vercel isole le code, jamais
   les données : une branche qui migre ou supprime touche les vraies données.
3. **Chez Vercel, exactement 4 variables** : `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
   `MOT_DE_PASSE_SITE`, `SECRET_SESSION`. Ni la clé Anthropic ni les identifiants France
   Travail — le pipeline tourne chez GitHub Actions, et les garder offrirait une clé facturée
   à qui entrerait dans le compte. Détail : `docs/HEBERGEMENT.md`.
4. **`interface/.env.local` détient l'unique copie des deux secrets du site.** Non versionné,
   nulle part ailleurs. ⚠️ **Un agent de revue qui lance l'app écrit dans ce fichier** — c'est
   arrivé le 21 août, les secrets ont dû être régénérés.

⚠️ **Un défaut connu, laissé ouvert faute de correctif propre** : l'écriture des offres se fait
par lots de 50 et **n'est pas atomique** — l'API REST n'expose pas de transaction. Si un lot
échoue, les précédents sont écrits et rattachés à une exécution marquée `echec`. Le recollage
(`recoller_offres_orphelines`) les récupère la nuit suivante. À rouvrir si le cas se produit.

**Les décisions de cadrage, de design et de plan sont acquises — ne pas les rouvrir.** Elles
sont dans `docs/DECISIONS.md`, `docs/DESIGN.md` et `docs/PLAN.md` ; leur histoire est dans
**`docs/JOURNAL.md`**.

## Collecte — trois faits mesurés, opposables

Mesurés contre l'API réelle le 21 août 2026, **remesurés et en partie corrigés le
26 août**. Détail et méthode dans `docs/API_FRANCE_TRAVAIL.md`. **Ne pas les
redécouvrir, ne pas les contredire de mémoire.**

1. **La recherche France Travail n'indexe PAS la description.** Un mot pris dans le
   corps d'une annonce ne la retrouve pas. Elle porte sur l'intitulé, le **libellé
   ROME**, l'**appellation** et le champ `competences`. Conséquence directe : une
   offre au titre banal dont l'IA n'apparaît que dans le texte est invisible à
   **toute** liste de mots-clés. Ce fait reste vrai et commande tout le reste.
2. ⚠️ **CORRIGÉ LE 26 AOÛT — le vocabulaire n'est ni fermé ni français.** L'ancienne
   version de ce point disait le contraire, et c'était l'erreur la plus coûteuse de
   la configuration : **`AI` en anglais ramène 28 offres nettes par mois** qu'aucun
   autre critère ne trouvait. `GenAI`, `LLM`, `copilot`, `prompt` et `RAG` ne
   renvoient plus zéro non plus. Ce qui reste vrai : les expressions à plusieurs mots
   sont dangereuses — `avant-vente` ramène 299 postes de vendeur, le moteur ayant
   matché « vente ».
3. ⚠️ **CORRIGÉ LE 26 AOÛT — les codes ROME ne rattrapent PAS ce que le lexique rate.**
   `codes_rome.txt` existait pour ça et le raisonnement était juste ; la mesure l'a
   démenti. Les six codes apportaient 445 offres nettes par mois pour **zéro offre
   au-dessus de 30 sur 50 notées au hasard**. Tous retirés. Le fichier reste en place,
   **vide et valide** (`config.charger()` l'autorise), avec la mesure qui l'a vidé.
   ⚠️ Corollaire non évident : **un code ROME dont le libellé contient un mot déjà
   cherché n'apporte rien**, la recherche indexant ce libellé. `M1889` « Ingénieur en
   Intelligence Artificielle » a la meilleure qualité mesurée de tous les codes et un
   apport net de **zéro**.
4. ⚠️ **Un critère ne s'ajoute jamais sans mesurer ce qu'il ramène** — ni mot-clé, ni
   code ROME. Et mesurer veut dire **deux choses** : le volume *net* (ce que les
   autres critères ne trouvent pas déjà) **et** la qualité, en notant un échantillon
   **tiré au hasard** (`--rome CODE --au-hasard`, `--collecte ID --au-hasard`).
   Prendre les N plus récentes n'est pas un échantillon : elles viennent d'une seule
   journée de collecte.

**Les postes visés** sont ceux qui *branchent* un modèle chez un client — Forward
Deployed Engineer, AI Solutions Engineer, consultant IA, ingénieur d'intégration.
**Pas** les postes de modélisation (`machine learning`, `data scientist`, `deep
learning`) : autre métier, autres entreprises. Corrigé par Maxime le 21 août après
que je me sois trompé de cible.

## Base de données — ce qui change mon comportement

**Source de vérité du schéma : `supabase/migrations/`.** Les fichiers sont abondamment
commentés — chaque décision y est expliquée. **Ne jamais recopier le schéma dans un autre
document** : deux descriptions du même schéma divergent toujours.

⚠️ **Une migration déjà appliquée ne se modifie jamais.** Elle est dans la base : la
réécrire ne défait rien et fait diverger git de la réalité. On corrige par une migration
suivante. C'est arrivé le 20 août — voir `docs/JOURNAL.md`.

**Deux tables sur quatre existent** : `executions_veille`, `offres`.
`enrichissements` et `etapes_enrichissement` sont **reportées à la phase 6** — entorse
assumée au critère d'acceptation du `PLAN.md`, validée en séance : leur forme dépend de ce
que l'agent produira réellement, et rien ne les alimente d'ici là.

**Huit règles opposables, toutes déjà appliquées :**

1. **`timestamptz` partout, jamais `timestamp`.** GitHub Actions tourne en UTC, le
   navigateur est à Paris : sans fuseau, une collecte de 4 h s'affiche « 02:00 » en été.
2. **Ce qui se calcule ne se stocke pas.** Pas de colonne `duree` (`terminee_a -
   demarree_a`), pas de date de collecte sur l'offre (le lien vers l'exécution la porte).
3. **`NULL` ≠ `false`.** `NULL` veut dire « non renseigné », `false` veut dire « renseigné
   à non ». Un `default false` sur un champ souvent absent fabrique de la donnée qui
   n'existe pas.
4. **La ligne d'`executions_veille` s'écrit au démarrage** (`issue = 'en_cours'`), se
   complète à la fin. Une ligne restée `en_cours` est une exécution tuée net : le pipeline
   les referme en `echec` à son démarrage suivant, et **un `en_cours` ne compte jamais
   comme une réussite** côté interface.
5. **`offres.charge_brute` est une archive, jamais lue pour afficher.** Elle existe parce
   que France Travail dépublie ses offres. Les colonnes extraites sont les seules valeurs
   de travail.
6. **`contact_nom` et `contact_url_postulation` sont en colonnes nommées**, jamais dans
   `charge_brute` — pour rester repérables et supprimables. Tout le reste du champ
   `contact` est **écarté à la collecte**, avant écriture. Voir `docs/PRD.md`
   § « Données personnelles ».
7. ⚠️ **`executions_veille.etape` n'est pas du rangement, c'est un correctif de bug.**
   `derniere_execution_reussie()` borne la fenêtre de collecte sur la dernière ligne
   `issue = 'reussite'`. Sans le filtre `etape = 'collecte'`, une notation réussie à 14 h
   ferait repartir la collecte de la nuit suivante de 14 h au lieu de la veille : **les offres
   publiées entre les deux seraient perdues, sans la moindre erreur** — ni exception, ni job
   rouge. `derniere_execution_reussie()` et `recoller_offres_orphelines()` filtrent dessus.
   Vérifié en plantant une notation réussie datée de maintenant : la fenêtre ne bouge pas.
8. **`NULL` sur une note veut dire « pas encore notée », jamais « zéro ».** Trois contraintes
   rendent physiquement impossible d'écrire une note sans sa justification — le plancher
   d'accessibilité interdit qu'une information tienne sur la seule couleur, et une règle gravée
   dans le moteur vaut mieux qu'une discipline de code. `notation_tentatives` borne la
   facturation : sans compteur, une offre qui fait systématiquement échouer l'appel serait
   retentée chaque nuit, payante à chaque fois.

**Autorisation — deux verrous indépendants, vérifiés :** RLS activé sans aucune politique,
*et* tous droits retirés à `anon` et `authenticated`. Une politique ajoutée par erreur
n'ouvrirait donc toujours rien. Seul `service_role` (la clé `sb_secret_…`) a des droits.

## Stack

Tranchée le 16 août 2026. Justifications dans `docs/DECISIONS.md` § 3.

- **Python 3.11+** pour le pipeline, environnement virtuel dédié (voir Commandes).
- **Supabase** (Postgres hébergé) pour la persistance. **Pas SQLite** : une
  interface hébergée ne peut pas lire un fichier posé sur le Mac de Maxime.
- **Next.js + shadcn/ui sur Vercel** pour l'interface.
- **GitHub Actions** (cron) pour le déclenchement quotidien — 6 h de durée par
  exécution contre 300 s chez Vercel, gratuit et illimité sur dépôt public, et le
  workflow est versionné donc visible d'un recruteur.
  ⚠️ **Ne pas justifier ce choix par « Vercel ne fait pas de Python » : c'est faux.**
  Vercel exécute du Python et propose des sandboxes conçus pour les agents, démarrant
  en millisecondes. Ce qu'on laisse sur la table, c'est la latence au clic sur
  « Enrichir » — un arbitrage assumé, pas une impossibilité technique.
- **API France Travail** Offres d'emploi v2 · **API Anthropic** pour l'évaluation.

## Commandes

Le `python3` par défaut de cette machine est celui d'Anaconda (`/opt/anaconda3`).
**Ne pas installer les dépendances du projet dedans** — elles se mélangeraient à
l'installation Anaconda globale et deviendraient impossibles à démêler.

```bash
python3 -m venv .venv          # une seule fois
source .venv/bin/activate      # à chaque nouvelle session de terminal
pip install -r requirements.txt
which python                   # doit afficher .../veille-offres-emploi-ia/.venv/bin/python
```

Si `which python` pointe vers `/opt/anaconda3`, l'environnement n'est pas activé
et toute installation partira au mauvais endroit. `.venv/` est exclu par le
`.gitignore`.

### Lancer le pipeline

```bash
source .venv/bin/activate
python -m pipeline.collecte                   # la collecte nocturne : fenêtre automatique
python -m pipeline.collecte --sans-ecrire     # tout sauf l'écriture, pour vérifier sans risque
python -m pipeline.collecte --depuis-jours 7  # remplissage manuel, N strictement positif
```

Code de sortie **0** = réussite, **1** = échec — c'est lui qui fera rougir le job GitHub
Actions. La trace part en base dans `executions_veille`, dans les deux cas.

⚠️ **Les critères de collecte sont des données, pas du code** : `pipeline/mots_cles.txt` et
`pipeline/codes_rome.txt`. Ils s'éditent sans toucher aux modules — mais **jamais sans
mesurer d'abord ce que le nouveau terme ramène** (voir § Collecte).

### Lancer la notation

```bash
source .venv/bin/activate
python -m pipeline.notation --sans-appeler --limite 1   # GRATUIT : affiche le prompt, compte les tokens
python -m pipeline.notation --limite 15                 # note 15 offres, appels directs
python -m pipeline.notation --lot                       # via l'API Batches : moitié prix, jusqu'à 1 h
python -m pipeline.notation --sans-ecrire --limite 1    # appelle le modèle, n'écrit rien en base
```

⚠️ **Tout ce qui n'est pas `--sans-appeler` est FACTURÉ. Prévenir Maxime avant, toujours**,
avec le nombre d'appels et l'ordre de grandeur (~0,6 centime par offre, cache chaud).
`models.list()` et `count_tokens()` sont gratuits — s'en servir librement.

**Les drapeaux de mesure** — liste complète dans `--help`, deux portent une leçon :

- ⚠️ **`--au-hasard`** tire l'échantillon au sort au lieu de prendre les plus récentes. Sans
  lui, une « mesure » porte sur une seule journée de collecte et ne dit rien du gisement.
- **`--renoter`** reprend les offres **déjà notées** : le seul moyen de juger une correction de
  critères sur les mêmes annonces. Chaque offre est repayée. C'est aussi la commande pour
  trancher Sonnet contre Opus : `--renoter --modele claude-opus-5`.

**La recette de mesure d'un critère**, celle qui a fait tomber les codes ROME :

1. Volume brut contre l'API (gratuit) — combien d'offres sur 30 jours.
2. **Volume NET** — combien que les autres critères ne trouvent pas déjà. Un critère à fort
   volume et apport net nul est inutile ; c'est le piège dans lequel `M1889` est tombé.
3. Collecter, puis `--au-hasard` sur un échantillon, puis lire les notes. **Le volume ne dit
   rien de la qualité** — `H1206` ramenait 238 offres/mois pour zéro au-dessus de 30.

### Migrations Supabase

⚠️ **Procédure complète dans `docs/HEBERGEMENT.md` § Migrations Supabase** — commandes
`npx supabase`, validation par l'analyseur de PostgreSQL, et les deux pièges qui bloquent
ou exposent le mot de passe. **Deux règles restent ici parce qu'elles se perdraient :**

- **Une migration déjà appliquée ne se modifie jamais.** On corrige par une suivante.
- ⚠️ **Syntaxe valide ne veut pas dire « ça marche ».** Le 20 août, une migration
  irréprochable a créé deux tables que le serveur ne pouvait pas lire. **Après chaque
  migration : tenter de lire, d'écrire, et de violer chaque contrainte.**

## API France Travail

⚠️ **Avant d'écrire une ligne du client de collecte, lire
`docs/API_FRANCE_TRAVAIL.md`.** Les paramètres d'authentification, de pagination
et de quota y sont **vérifiés en conditions réelles** — ne pas les rechercher à
nouveau, ne pas les improviser. Les pièges qui font échouer *silencieusement* y
sont documentés avec leur symptôme : scope exact, identifiants dans le corps et
non en en-tête Basic, HTTP 206 sur réponse partielle, plafond de pagination,
déduplication sur l'identifiant de l'offre.

## La partie IA — la frontière est la décision centrale

**Décision de Maxime (15 août 2026) : le Claude Agent SDK est retenu, et
l'objectif d'apprentissage prime.** Ne pas rouvrir cette décision.

Les deux outils coexistent dans ce projet, et les confondre est l'erreur à ne pas
commettre :

| | Ce que c'est | Ce qu'il fait ici |
|---|---|---|
| `claude-agent-sdk` | Claude Code en bibliothèque : boucle d'agent, outils Read/Write/Edit/Bash/Glob/Grep/WebSearch/WebFetch, MCP, sous-agents, permissions | L'enrichissement : une tâche ouverte et multi-étapes sur les offres retenues |
| `anthropic` (API Messages) | Un appel, une réponse structurée | La notation en volume : une offre → deux notes |

**Le placement de cette frontière est l'argument d'entretien le plus fort du
projet.** Un agent posé sur une classification — une entrée, une sortie, aucune
exploration — est plus lent, plus cher et non déterministe pour aucun gain, et un
lead technique qui connaît le SDK le verra. Un agent posé sur une tâche ouverte
— chercher l'entreprise, lire son site, croiser, rédiger une fiche — est
exactement ce pour quoi le SDK existe.

Découpage en trois étapes (collecte / notation / enrichissement) : voir le README
et `docs/DECISIONS.md` § 3. **Validé au cadrage du 16 août 2026** — le comportement
produit de l'enrichissement est fixé dans `docs/PRD.md`.

⚠️ **Avant d'écrire du code Agent SDK, lire la documentation officielle**
(`code.claude.com/docs/en/agent-sdk`). La référence `/claude-api` couvre l'API
Messages et les Managed Agents — **pas** le Agent SDK. Improviser sa surface
d'API produit du code faux. Le SDK fournit la boucle d'agent et les outils,
**pas l'hébergement**.

⚠️ **Avant d'écrire du code appelant l'API Anthropic, charger `/claude-api`.**
Les identifiants de modèles et les paramètres changent ; un identifiant inventé
renvoie une 404.

## Sécurité — non négociable

Les clés de ce projet donnent accès à un compte facturé et à une base de données.

1. **Aucune clé en clair dans le code, jamais.** Les secrets vivent dans `.env`,
   lu via `os.environ`. `.env` est exclu par le `.gitignore` — vérifier la sortie
   de `git status` avant chaque commit ; si `.env` y apparaît, s'arrêter.
2. **Aucune clé dans la conversation, les logs ou un message d'erreur.** Un
   `print(config)` qui affiche le jeton finit dans un terminal, une capture
   d'écran, un dépôt public.
   ⚠️ **Y compris par la sélection dans l'éditeur.** Quand un fichier est ouvert dans
   l'IDE, **le texte sélectionné m'est transmis automatiquement**. Le 21 août 2026, une
   sélection dans `interface/.env.local` a fait entrer `MOT_DE_PASSE_SITE` dans la
   conversation. Ce n'est pas une faute d'inattention, c'est le fonctionnement normal de
   l'intégration — donc la parade est une habitude, pas de la vigilance :
   **ne jamais demander à Maxime d'ouvrir un fichier de secrets, ni de recopier une
   valeur.** Quand il lui en faut une, la déposer dans son presse-papiers
   (`grep '^NOM=' fichier | cut -d= -f2- | tr -d '\n' | pbcopy`) : rien ne s'affiche,
   rien ne transite.
3. **Le dépôt est public.** Des robots scannent GitHub en continu à la recherche
   de clés commitées et les exploitent en minutes, aux frais du propriétaire. Une
   clé poussée par erreur reste dans l'historique Git même après suppression du
   fichier : la **révoquer**, pas seulement la supprimer.
4. **Supabase : la clé secrète (`sb_secret_…`, `SUPABASE_SECRET_KEY`) contourne *toutes*
   les règles de sécurité** — jamais dans une variable `NEXT_PUBLIC_*`, jamais dans un
   composant client, jamais commitée. RLS activé sur toutes les tables, et **le navigateur
   ne parle jamais directement à Supabase** : tout passe par le serveur.
   ⚠️ Les deux générations de clés et celles restées actives à tort :
   `docs/HEBERGEMENT.md` § Les clés Supabase.
5. **Aucun déclenchement d'agent accessible publiquement sans garde-fou.** Un
   bouton en ligne qui lance un agent Claude sans protection est une facture
   ouverte : un robot qui scanne les URL peut l'actionner en boucle. Tranché au
   cadrage : le site entier est derrière un mot de passe unique vérifié **côté
   serveur**, couvrant les pages *et* les adresses servant des données — protéger
   la page en laissant l'adresse de données ouverte ne protège rien.
   ⚠️ **Posé le 21 août, trois règles opposables :**
   - **Toute page et toute action serveur appelle `exigerSession()`
     (`interface/lib/acces.ts`) en première ligne** — seule exception, `connecter()`
     qui *est* la porte. Le proxy est la commodité, `exigerSession()` est la serrure.
     ⚠️ **La raison la plus concrète n'est pas la CVE-2025-29927** : une action
     serveur s'invoque par un `POST` avec en-tête `Next-Action` sur une route, et
     `/connexion` est la seule que le proxy laisse passer sans cookie. Une action
     déclarée là s'exécuterait sans session, **sans rien contourner**.
     **Mesuré le 21 août** : Next 16 refuse d'exécuter sur `/connexion` une action
     déclarée dans une autre route (manifeste par route) — mais ça se rouvre dès
     qu'un composant partagé rendu par `/connexion` importera une action sensible,
     et ce cloisonnement n'est pas un contrat de sécurité documenté.
   - **Ne jamais ajouter de `matcher` à `proxy.ts`.** Il protège *tout* par défaut ;
     les trois exceptions sont dans le code. Un matcher rouvrirait la question à
     chaque adresse ajoutée.
   - **Un `POST` d'action serveur ne se redirige jamais** : le proxy lui répond
     **401**. Redirigé, le navigateur suit jusqu'à `/connexion`, reçoit un corps
     vide, et le bouton cliqué ne fait *rien du tout* — sans erreur ni renvoi vers
     la porte. Cas réel : session expirée la nuit, onglet resté ouvert.
   - **`import "server-only"` en tête de tout module qui lit un secret.** Sans lui,
     un composant client peut importer le module et tirer `node:crypto` dans le
     graphe du navigateur ; la panne est alors incompréhensible.
   - **Les secrets du site vivent dans `interface/.env.local`**, pas dans le `.env`
     de la racine, qui appartient au pipeline Python. Deux périmètres, deux fichiers.
     ⚠️ **Un agent de revue qui lance l'app écrit dans ce fichier** — c'est arrivé le
     21 août, les secrets ont dû être régénérés. Ne jamais y laisser l'unique copie
     d'une valeur.
6. **Données personnelles : périmètre restreint et explicite.** Les offres sont
   publiques ; les coordonnées de contact qu'elles contiennent parfois ne le sont
   pas au sens du RGPD. **Deux champs seulement sont conservés**, parce qu'ils
   servent directement à candidater : `contact.nom` et `contact.urlPostulation`.
   Adresses postales (`coordonnees1/2/3`), courriels et tout autre élément
   d'identification sont **écartés à la collecte, avant écriture** — jamais
   filtrés à l'affichage : filtré à l'affichage, un champ est quand même en base
   et dans les journaux. Ces deux champs vivent en **colonnes nommées, jamais
   dans l'archive JSON brute** — une colonne se cherche, s'exclut d'un export et
   se vide d'une requête ; noyée dans un bloc JSON, la donnée voyage partout où
   le bloc voyage. Ils ne sortent pas de la base : ni journal, ni export, ni page
   publique. Les notes personnelles ajoutées par Maxime sur une offre relèvent de
   la même règle — ne pas les exposer, ne pas les journaliser, ne pas les faire
   sortir de la base.
   ⚠️ **Tranché le 20 août 2026 sur mesure, pas sur intuition** : sur 235 offres
   réelles, `contact.courriel` ne contient **aucune adresse** (le champ porte une
   phrase), `contact.nom` est présent sur 9 % des offres et ne nomme une personne
   que dans 3 % des cas. La règle absolue précédente (« pas de données
   personnelles ») interdisait aussi `urlPostulation`, qui n'en est pas une.

Si un secret a déjà été commité : le révoquer côté France Travail / Anthropic /
Supabase **avant** de nettoyer l'historique. Le nettoyage seul ne protège rien.

## Convention de travail

- Français partout : messages de commit, docstrings, noms de variables métier
  (`offres_pertinentes`, pas `relevant_offers`).
- Un module = une responsabilité. `client_france_travail.py`, `evaluation.py`,
  `stockage.py`, `synthese.py` — pas de `main.py` de 400 lignes.
- Toute fonction qui appelle le réseau gère explicitement l'échec. Pas de
  `try/except` nu qui avale l'erreur.

### Capitaliser les notions apprises

Quand Maxime demande de noter une notion technique comprise en séance, elle va dans
**`~/Documents/Coffre Obsidian/Maxime M/Apprentissage/`**, **dans le sous-dossier du sujet**
(`Supabase/`, `Outillage/`… — lister le dossier avant d'écrire, il en crée au fil de l'eau).
Pas dans `docs/` : `docs/` porte le projet, ce dossier porte le savoir transférable.

**Une notion = un fichier.** Ne jamais grouper deux sujets parce qu'ils sont tombés dans la
même conversation : ils ne se relisent pas au même moment. *(Erreur commise le 20 août avec
« CLI, MCP et migrations », découpée en deux à sa demande.)*

**Concises**, il en aura beaucoup. Frontmatter `title` / `tags` / `aliases` · un callout
`> [!tip] En une phrase` en tête · tableaux et blocs de code plutôt que des paragraphes ·
un `> [!danger] Le piège` à la fin · wikilinks vers les autres notes.

**Les tags portent ce que les dossiers ne peuvent pas** — la sécurité traverse la base, le
serveur et le navigateur. Un dossier par sujet principal, plusieurs tags par note.

La version *projet* de la même notion (pourquoi **ce** projet a tranché ainsi) reste dans
`docs/DECISIONS.md`. Les deux se complètent, aucune ne remplace l'autre.

### Répartition du travail — tranché le 20 août 2026

Maxime **n'écrit pas le code**, et c'est une position argumentée, pas un renoncement :
écrire est dévalué puisque l'IA écrit, ce qui compte est de savoir **que ça existe, à quoi
ça sert et comment ça casse**, pour localiser une panne et savoir quoi demander.

Ce que ça m'impose, et qui n'est pas négociable :

1. **Une note de diagnostic à la fin de chaque phase**, dans `Apprentissage/`. Pas une
   explication ligne par ligne — il ne la rouvrirait jamais. Les quelques **formes** de
   code que le projet utilise vraiment · **la phrase française** que chacune dit · **comment
   chacune casse** · **le symptôme à l'écran** de chaque panne.
2. **Trois questions à la fin de chaque module.** S'il bloque sur une, la lecture manque là,
   et il faut le savoir avant l'entretien.
3. ⚠️ **Écrire est dévalué, lire ne l'est pas** — c'est *plus* important qu'avant, puisqu'il
   produit dix fois plus de code. Son propre critère (« savoir où est le problème ») repose
   entièrement dessus. Une lecture d'un module à voix haute par phase.
4. ⚠️ **Ne jamais annoncer qu'une chose marche sans l'avoir lancée.** Son seul garde-fou est
   de pouvoir demander « tu l'as lancé, ou tu l'as juste relu ? ». Le 20 août, une migration
   validée par l'analyseur officiel de PostgreSQL a créé deux tables illisibles par le
   serveur : le défaut n'est apparu qu'en essayant d'écrire.

<!-- design:start -->
## Design — Veille offres emploi IA

**Ce qu'on retient** : un instrument de décision, pas un tableau de bord. On voit
tout de suite quoi lire en premier, et pourquoi.

**Direction** : éditorial technique — décoration intentionnelle, mise en page en
grille stricte, mouvement minimal fonctionnel. Chaud dans la matière (beige papier,
serif, encre brune), froid dans la précision (densité, chasse fixe, filets).

**Polices** : titrage **Fraunces 700** · texte et interface **Geist** · données et
libellés **Geist Mono** · code **Geist Mono**. Une seule fonderie, Google Fonts.
Le serif ne descend jamais sous 20 px — en dessous, Geist.

**Icônes** : **lucide** — figé à l'installation (`shadcn apply --only` accepte
`theme` et `font`, jamais `icon`). **Ne jamais en mélanger un second.**

**Jetons** : `interface/app/globals.css` — c'est la source de vérité. Jamais de couleur en
dur, toujours les jetons sémantiques (`bg-primary`, `text-muted-foreground`). Un
seul `--radius`, les autres en dérivent. Bloc CSS prêt à coller dans
`docs/DESIGN.md`.

**Quatre teintes de signal, un rôle chacune** : brun-encre = action principale et
note d'intérêt · ocre = le temporel (« nouveau », enrichissement en cours) ·
olive = accessibilité et candidaté · brique = erreur et écarté. Une teinte qui sert
à deux choses ne sert plus à rien.

⚠️ **Trois pièges qui ne se voient pas à l'œil**, détaillés dans `docs/DESIGN.md` :
`--border` (filet décoratif, sans exigence) n'est pas `--input` (bordure de champ,
3:1 obligatoire) · `--accent` chez shadcn est la surface de survol, pas une couleur
vive · l'ocre existe en deux valeurs (`--signal`, `--signal-fort`) parce qu'il doit
être clair sous un texte foncé et foncé dans une jauge.

⚠️ **shadcn pose des ombres par défaut** sur `Card`, `Popover` et les menus. Les
retirer : ce produit n'a **aucune ombre**, uniquement des filets. Conséquence, la
hiérarchie repose entièrement sur la typographie.

⚠️ **Le libellé devant chaque barre de note ne se retire jamais**, même pour gagner de
la place : sans lui l'information tient sur la seule couleur. Il s'écrit **en toutes
lettres — « Intérêt » et « Accessibilité »**, décidé le 26 août 2026 après mesure : les
abréviations `INT` / `ACC` sont abandonnées. ⚠️ **« intérêt », jamais « intéressement »** :
à côté d'un salaire, le second se lit comme une prime de participation aux bénéfices.

⚠️ **Le contenu de test est du contenu RÉEL, en base — à utiliser plutôt qu'à réinventer.**
Chiffres, formes de salaire et cas limites : `docs/PLAN.md` § Contenu de test, remesuré le
26 août 2026 sur 373 offres. **Deux faits à ne pas redécouvrir** : le vide est le cas normal
(36 % sans entreprise, 65 % sans salaire, mais le lieu toujours renseigné), et **l'intitulé
très long n'existe pas** — 94 caractères au maximum, médiane 40. Ne pas fabriquer un cas que
France Travail ne produira jamais, mais vérifier la mise en page à 375 px contre le plus long
*réellement observé*.

**Mise en page mesurée et figée le 26 août 2026** : `--largeur-page: 1000px`, ligne d'offre
de **91 px en bureau et 146 px sous 640 px** — ne jamais reprendre les 91 px pour dimensionner
un repli. Le seuil de 1000 px n'est pas un arrondi : en dessous, les offres **qui affichent un
salaire** cassent sur deux lignes.

⚠️ **Le vide à droite de la ligne est une réserve, pas un défaut** — il accueille les notes en
phase 2 puis le statut en phase 4. Ne pas le combler.

**Cinq valeurs restent des hypothèses**, chacune avec son échéance (phases 3, 4 et 6), dont
une **arithmétiquement incompatible** avec les 1000 px : `docs/DESIGN.md` § Mise en page, qui
porte aussi la méthode de mesure.

**Interdits sur ce projet** : Inter, Roboto, Poppins, Montserrat, Space Grotesk et
les autres polices sur-utilisées · Instrument Serif (un seul poids, le gras y est
synthétique) · dégradé violet · boutons en dégradé · trois colonnes d'icônes dans
des ronds colorés · tout centré · arrondis en bulle · `system-ui` en titrage.

**Plancher d'accessibilité, opposable** : texte 4,5:1 · interface 3:1 · focus
clavier toujours visible · mouvement coupé sous `prefers-reduced-motion` · jamais
l'information par la seule couleur. Un choix qui casse ça est un défaut, pas un
parti pris. **Recalculer les contrastes à chaque changement de couleur** —
`docs/design-preview.html` le fait dans la page.

**Détail et justifications** : `docs/DESIGN.md`

<!-- archi:start -->
## Architecture — Veille offres emploi IA

**Stack** : Python 3.11+ (`pipeline/`) · Next.js + shadcn/ui sur Vercel (`interface/`) ·
Supabase/Postgres dès le premier jour · GitHub Actions (cron nocturne + déclenchement des
agents) · mot de passe unique, ni comptes ni rôles · API France Travail v2 ·
**`claude-sonnet-5`** pour la notation (cache de prompt + Batches) · Claude Agent SDK pour
l'enrichissement.

⚠️ **Next 16 a renommé `middleware.ts` en `proxy.ts`** (et `config` en `proxyConfig`).
Plus largement, ses conventions ont bougé : **avant d'écrire du Next.js, s'appuyer sur la
skill `next-best-practices`** plutôt que sur des réflexes de Next 14.

**Frontend** : template `next` · moteur des composants **`radix`** · pas de monorepo ·
icônes lucide — **figés à l'installation**. ⚠️ Vercel doit être réglé sur
`Root Directory = interface`.

**Routes** : `/` le compte rendu de la nuit · `/offres` le poste de travail (filtre de
statut dans l'adresse) · `/offres/[identifiant]` la fiche · `/connexion` la porte.
L'identifiant est celui de France Travail, **validé avant d'atteindre la base**.

**Schéma, cible à terme** : `executions_veille` · `offres` · `enrichissements` · `etapes_enrichissement`. ⚠️ **Seules les deux premières existent** — voir § « Base de données », et `supabase/migrations/` pour ce qui est réellement en base.
Pas d'accents dans les noms. Une offre est rattachée à l'exécution qui l'a trouvée ; elle a
**au plus un** enrichissement (une relance remplace la fiche). Deux compteurs de tokens sur
l'offre : `tokens_cumules` et `tokens_conversation`.
**La colonne qui dit à qui la donnée appartient : aucune, délibérément** — un seul
utilisateur, une seule porte ; une telle colonne porterait la même valeur partout et
donnerait l'illusion d'un contrôle.

**Autorisation, opposable** : RLS activé sur toutes les tables, **aucune politique** ; le
navigateur ne parle jamais à Supabase. Un **`proxy.ts`** unique protège **tout par défaut**,
avec trois exceptions en liste blanche — énumérer les adresses à protéger laisserait toute
adresse ajoutée plus tard ouverte sans rien signaler. Une seule fonction fait le contrôle,
tous les accès passent par elle — recopier la vérification garantit qu'un accès finira par
être oublié. **Un écran qui masque un bouton ne protège rien : le contrôle qui compte est
côté serveur** (le double clic sur « Enrichir » se bloque en base, pas sur le bouton).

**Enrichissement** : **exclusivement manuel** — rien ne s'enrichit sans un clic, et
l'automatique nocturne est en Évolutions prévues, pas au hors périmètre. Une **enveloppe
quotidienne de 300 000 tokens** borne la dépense : fichier de configuration versionné,
**vérifiée côté serveur**, calculée en sommant les traces du jour et non dans un compteur
qui divergerait. **La notation nocturne n'y entre pas** — la borner ferait rater des offres
un matin de forte collecte.

**Secrets** : `.env` local non versionné · secrets GitHub Actions pour le pipeline ·
variables Vercel pour le site · **rien dans le navigateur, et aucune variable
`NEXT_PUBLIC_` sur ce projet** — ce préfixe publie la valeur dans le code source de la page
sans le moindre message d'erreur. Le site ne détient aucune clé de modèle. Un secret
commité reste dans l'historique git après suppression du fichier : le **révoquer**, pas
seulement le supprimer.

**Plan, contenu de test et parcours à repasser** : `docs/PLAN.md` — à rouvrir avant de
démarrer une phase et avant toute mise en ligne.
<!-- archi:end -->
<!-- design:end -->
