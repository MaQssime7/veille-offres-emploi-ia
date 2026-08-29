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
| **Ce que vaut chaque critère de collecte**, mesuré | `pipeline/codes_rome.txt` (vide, et porte la mesure qui l'a vidé) et `pipeline/mots_cles.txt` — ⚠️ **ne jamais éditer sans relire ces commentaires** : ils listent les termes déjà mesurés et écartés.<br>⚠️ **Un TROISIÈME critère existe et n'est pas un `.txt` : `TYPE_CONTRAT` dans `pipeline/config.py`**, qui écarte 22 % du volume. C'est une entorse assumée à la règle « les critères sont des données » — il tient en une valeur, et sa liste blanche doit rester collée au référentiel de l'API. Mais **chercher les critères dans les seuls fichiers texte fait manquer celui qui coupe le plus** |
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

## État actuel — 28 août 2026

**Phases 1, 2 et 3 CLOSES. La phase 4 — statuts et notes personnelles — est démarrable immédiatement.**
Le site est en ligne derrière son mot de passe, la collecte et la notation sont toutes deux sur
le cron, et `/offres` affiche **les deux notes avec leurs justifications à plat, classées par
intérêt décroissant**. La **fiche `/offres/[identifiant]`** est livrée.
**567 offres, 133 notées** au 28 août 2026 au soir.

⚠️ **La phase 2 est close à 14 critères sur 15, et le quinzième est REPORTÉ, pas oublié** —
l'état de l'écran à 200 offres notées, vérifié en simulation seulement. Reporté par décision de
Maxime le 28 août, pour un motif qui n'est pas l'économie : voir le tableau plus bas. **Ne pas
rouvrir la phase 2 pour ça, et ne pas le traiter comme une dette bloquante.**
Les critères de collecte ont été refondus le 26 août, **remesurés à fond le 28** (50 termes),
et **seul le CDI est collecté depuis le 28**.

⚠️ **Le cron ne part jamais à l'heure** — +10 h 32 puis +12 h 02 sur les deux déclenchements
planifiés observés. Les données n'en souffrent pas, l'usage si. Détail, parade et rustine :
§ « Le cron ne part jamais à l'heure » plus bas.

| Brique | État |
|---|---|
| `interface/` | Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui moteur `radix`. La porte (`/connexion`, `proxy.ts`, session signée), l'écran `/offres` **avec les deux notes**, la **fiche `/offres/[identifiant]`**, mode sombre sur la préférence système |
| Supabase | Région Paris. `executions_veille` et `offres` créées et alimentées. RLS activé, droits vérifiés |
| Migrations | **5**, toutes appliquées — `supabase/migrations/`. La 5ᵉ ajoute la notation (deux notes, justifications, salaire annualisé, compteurs de tokens, colonne `etape`) |
| Vercel | https://veille-offres-emploi-ia.vercel.app · `Root Directory = interface` · région Paris |
| `pipeline/` | Collecte **et notation** livrées, **toutes deux sur le cron** GitHub Actions à 02:23 UTC (4 h 23 à Paris l'été) — deux jobs enchaînés, la notation ne tournant que si la collecte a réussi. ✅ **Chaîne complète prouvée le 27 août** par le cron (`33074159137`) : 25 offres collectées, 25 notées. Critères dans `mots_cles.txt` (**7 termes** — `RPA` et `deploiement` retirés le 28, `chatbot` ajouté) et `codes_rome.txt` (**vide depuis le 26 août, délibérément**). ⚠️ **Seul le CDI est collecté** depuis le 28 (`TYPE_CONTRAT`) |
| Modules | `collecte.py` · `notation.py` (`--limite`, `--modele`, `--effort`, `--lot`, `--rome`, `--collecte`, **`--derniere-collecte`**, `--au-hasard`, `--renoter`, `--sans-ecrire`, `--sans-appeler`) · `salaire.py` · `criteres_pertinence.txt` |
| `.venv/` | À la racine, `requirements.txt` versionné |

**Le seul reliquat de la phase 2, reporté volontairement** — les deux autres ont été fermées les
27 et 28 août (récit dans `docs/JOURNAL.md`). Celui-ci attend le temps, pas de l'argent.

| Ce qui reste | Comment le fermer | Coût |
|---|---|---|
| ⚠️ **L'état « 200 offres notées » à l'écran** | Vérifié **en simulation** le 26 août (98 dupliquées jusqu'à 200) : 39 567 px de haut, 5 699 nœuds, 153 Ko transférés, 70 ms de recalcul, aucun débordement. Sur données réelles il manque **67 offres** (133 notées au 28 août au soir).<br>⚠️ **NE PAS forcer en payant, et c'est un raisonnement, pas une économie.** 200 est aussi le seuil où l'écran casse : au-delà, les 200 lignes affichées sont les 200 meilleures de tous les temps et **les offres du matin disparaissent**. Payer pour l'atteindre revient à payer pour déclencher un défaut connu dont le remède est en phase 4. Au rythme actuel (~7 notées/nuit) il tombe seul vers le **8 septembre**.<br>⚠️ Si on force quand même : sur les 434 offres non notées, **82 ne sont pas des CDI** — les noter au hasard paierait des offres que Maxime ne regardera pas, `notation.py` n'ayant pas de filtre de contrat | ~44 centimes, **déconseillé** |

⚠️ **Les deux premières ont été fermées les 27 et 28 août.** La troisième n'est pas refusée non
plus : elle est **volontairement laissée au temps**, pour la raison donnée dans le tableau.
Toute dépense se redemande avant d'être lancée.

### ⚠️ Le cron ne part jamais à l'heure — comportement établi, pas incident

**Trois nuits observées, deux déclenchements planifiés, aucun à l'heure.**

| Nuit | Heure prévue | Heure réelle | Retard |
|---|---|---|---|
| 26 → 27 août | 02:23 UTC | 12 h 54 | **+10 h 32** |
| 27 → 28 août | 02:23 UTC | 14 h 25 | **+12 h 02** |

C'est un comportement **documenté** de GitHub Actions : les workflows planifiés
ne sont pas garantis, et le retard est plus fréquent sur dépôt public gratuit.
La minute non ronde (23) était déjà une parade ; elle n'a pas suffi.

✅ **Les données sont robustes à ça, par conception.** La fenêtre de collecte part
de la **dernière collecte réussie**, jamais de « hier » : une nuit sautée est
rattrapée par la suivante, qui collecte 48 h d'un coup. Aucune offre n'est perdue.
⚠️ **Ce que ça coûte, c'est l'usage** : un cron qui tourne l'après-midi livre un
écran vide au moment où Maxime le consulte, le matin.

⚠️ **Ce qu'il faut surveiller** : plusieurs nuits sautées d'affilée font grossir
le volume, et la **limite de 60** du workflow finirait par mordre — vers 4 ou
5 nuits consécutives. Quand elle mord, `notation.py` avertit, et **les offres
laissées ne repassent pas** en mode `--derniere-collecte`.

⚠️ **La parade n'est PAS un second cron** : il serait retardé pareil, c'est la
file d'attente qui décale, pas l'horaire. C'est un **déclencheur externe appelant
l'API GitHub**, avec un jeton restreint au seul droit de lancer un workflow —
soit exactement le mécanisme prévu au critère d'acceptation de la **phase 6**
pour le bouton « Enrichir ». Le construire avant, c'est le construire deux fois.
✅ **Rustine en attendant** : `gh workflow run` à la main le matin.

**Le récit complet de l'enquête** — ce qui a été vérifié le 27 août, et pourquoi
on a d'abord cru à un cron sauté : `docs/JOURNAL.md` § 27 août 2026.

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
| Volume collecté | 294 offres/mois | 707 |
| Moyenne d'intérêt | **16,2** | 7,7 |
| Médiane | **10** | 5 |
| Offres au-dessus de 50 | **7 %** | 1 % |
| Coût de notation | ~1,75 $/mois | ~4,20 $ |

⚠️ **CE TABLEAU EST PÉRIMÉ — il décrit la configuration du 26 août.** Depuis, `deploiement` et
`RPA` sont sortis, `chatbot` est entré, et seul le CDI est collecté. **Chiffres au 28 août, à
utiliser à la place** : **208 offres/mois** (266 sans le filtre de contrat, qui en écarte 22 %),
soit **~1,25 $/mois** de notation. Les colonnes de qualité (moyenne, médiane, % au-dessus de 50)
n'ont **pas** été remesurées depuis : elles restent celles du 26 août, sur 15 offres.

✅ **CHANTIER MESURÉ LE 28 AOÛT 2026. Le rappel est saturé : le problème n'est pas ce que la
collecte rate, c'est ce qu'elle ramène en trop.** 50 termes balayés sur 30 jours.

1. ✅ **Tout le lexique IA spécialisé a un apport net de ZÉRO** — il ne trouve pas une seule
   offre que les mots-clés actuels ne trouvent déjà : `consultant IA`, `IA générative`,
   `générative`, `intégration IA`, `copilot`, `RAG`, `prompt`, `multi-agents`, `MLOps`,
   `low-code`, `no-code`, `agentic`. **Ne pas les re-tester** sans avoir d'abord changé la
   liste (voir le piège de méthode plus bas).
2. ✅ **Le vocabulaire anglais pointu N'EXISTE PAS** — volume brut nul : `LLM`, `GPT`,
   `OpenAI`, `LangChain`, `Hugging Face`, `embeddings`, `NLP`, `computer vision`,
   `deep learning`, `Azure AI`, `n8n`, `Zapier`, `forward deployed`, `customer engineer`.
   ⚠️ **Ceci DÉMENT la note du 26 août** qui voyait « le vocabulaire s'ouvrir » (LLM 1,
   copilot 2, RAG 1). Deux jours après : LLM 0, copilot 1. **Ces valeurs à 1 ou 2 sont du
   bruit statistique, pas une tendance** — ne pas remesurer tous les quatre matins.
3. ✅ **`IA` → `IPR-IA` : quantifié, et c'est marginal.** 3 offres/mois, notées 2, 2 et 3.
   Le match vient de l'**appellation** `Inspecteur(trice) pédago rég, inspect académie
   (IPR-IA)`, ROME K2117 — pas de l'intitulé, d'où l'échec des recherches précédentes.
   Le corriger supposerait de retirer `IA`, qui ramène l'offre à 85. **Défaut à connaître,
   pas à corriger.**
4. ✅ **`deploiement` mesuré : 30 offres nettes/mois, homonymie télécom/BTP** — « Conducteur
   d'engins », « Câbleur Électronique », « CHEF D'ÉQUIPE FTTH », « PMO Déploiement SAP ».
   **`automatisation`** : 11 nettes, QA/tests et DevOps CI/CD, aucune notée. **`RPA`** :
   3 nettes, « Développeur RPA UiPath ».
5. ✅ **Un seul terme retenu sur 50 : `chatbot`** (+1 offre/mois, « Ingénieur front office
   chatbot »), ajouté le 28 août.

⚠️ **LE PIÈGE DE MÉTHODE, qui vaut plus que ces listes : l'apport net n'est pas une propriété
du TERME, mais du couple (terme, configuration).** Vérifié — en retirant `intelligence
artificielle`, `low-code` et `no-code` passent de 0 à 1. **Tout retrait de la liste périme
les mesures ci-dessus.**

⚠️ **RESTE À TRANCHER — la seule recommandation non appliquée au 28 août.** `intelligence
artificielle` ramène **127 offres nettes/mois pour une moyenne de 8/100 et un maximum de 15**
sur 27 notées, zéro au-dessus de 30 : c'est le profil exact qui a fait tomber les codes ROME.
Et **on ne perdrait rien** — les 9 offres notées ≥25 sont toutes rattrapées par `IA` ou `AI`,
vérifié une par une. Avec `deploiement`, le retrait ferait passer le volume de **296 à 141
offres/mois**.
⚠️ **Partiellement arbitré le 28 août** : Maxime a retiré `deploiement` (et `RPA`) à la main,
mais **a gardé `intelligence artificielle`**. C'est donc la seule question encore ouverte, et
la projection 296 → 141 ci-dessus ne se réalisera jamais telle quelle. **Ne pas le retirer seul.**

✅ **Question CLOSE le 26 août 2026 : c'est Sonnet 5, et Opus 5 ne sera pas testé.** Décision
de Maxime. Le motif est bon et il faut le retenir plutôt que la conclusion : le prompt est
calibré, les 97 notations produites sont conformes et lisibles, et l'écart de coût (~2,30 $/mois)
ne justifie pas de repayer 97 offres pour arbitrer un doute que personne n'a. **Une question
ouverte n'a pas à être fermée par une mesure — elle peut l'être en constatant qu'elle ne
décide plus rien.** Ne pas la rouvrir « pour voir ».

### Ce qui reste ouvert

| | |
|---|---|
| ~~Tri par note : piège `NULLS FIRST`~~ | ✅ **Traité le 26 août** — `note_interet.desc.nullslast` dans `interface/lib/offres.ts`, avec départage complet jusqu'à `identifiant` pour que deux chargements classent les ex æquo pareil |
| ~~API Batches : rattachement par `custom_id`~~ | ✅ **CLOS le 28 août 2026.** Lot de 3 offres (`msgbatch_016Vf4…`), 5 min 06, 0 échec, appariement vérifié sur le contenu des justifications. ⚠️ **Mesure à retenir** : `cache_lecture` = 7 430 sur ce lot de 3, contre **zéro** sur le lot d'une offre — les Batches ne sont rentables qu'à plusieurs, sinon on paie l'écriture du cache sans jamais le relire |
| ~~Critères de collecte non finis~~ | ✅ **Mesurés et clos le 28 août** (50 termes balayés). `deploiement` et `RPA` retirés, `chatbot` ajouté, `IA`/`IPR-IA` quantifié à 3 offres/mois et jugé non corrigeable. ⚠️ **Seul `intelligence artificielle` reste en suspens** — voir § État actuel. ⚠️ Et la qualité d'`automatisation` (11 nettes/mois) est toujours **inconnue**, faute d'une seule offre notée |
| ⚠️ **Le plafond de 200 tuera l'affichage des offres du jour** | Relevé en revue le 26 août. Depuis le tri par intérêt, les 200 lignes affichées sont **les 200 meilleures de tous les temps**. Au 28 août, **126** offres sont notées, donc **74** places reviennent aux plus récentes et les offres de la nuit s'affichent. **Le jour où plus de 200 offres portent une note, elles disparaissent** — d'intérêt médian 10, elles ne rentrent plus — et le marqueur « Nouveau » devient du code que rien n'atteint. Aggravé par le refus d'effacer : les annonces dépubliées mais bien notées squattent le haut sans jamais céder leur place. ⚠️ **L'échéance est un compte, pas une date : elle tombe quand `notees` dépasse 200.** À trancher en phase 4 avec les filtres — le remède change ce que cet écran *est*, et le PRD confie déjà le compte rendu de la nuit à `/` |
| Bug pipeline **dormant** : `--renoter` perd la trace d'un échec | ⚠️ **Devenu inatteignable le 26 août** : le bug ne se déclenche que sur une offre **déjà notée**, donc uniquement en `--renoter` — outil désormais mis de côté, une offre n'étant notée qu'une fois. Il n'est donc **pas urgent**, et ne pas le présenter comme tel. L'analyse et le correctif à faire vivent en commentaire dans `pipeline/notation.py` au-dessus de `apercevoir()`, **au point d'usage** : celui qui ressortira `--renoter` tombera dessus, ce qu'une ligne dans ce tableau ne garantit pas |
| Clés Supabase *legacy* | `anon` / `service_role` toujours actives en parallèle des nouvelles — à désactiver (`docs/HEBERGEMENT.md`) |
| `PGRST303` | « JWT issued at future » au premier appel après recompilation, **en développement seulement**. Symptôme : « base injoignable » alors que la base va bien |
| Largeur contre barre latérale | Les 1000 px figés ne laissent pas la place aux 208 px de filtres prévus en phase 4 — à trancher là-bas (`docs/DESIGN.md`) |
| En-tête de `/offres` | Ne plaît pas à Maxime. Reporté **après la phase 4**, quand les filtres y auront pris place |

⚠️ **Huit règles opposables, qui ne se déduisent d'aucun fichier :**

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
5. ⚠️ **Pour regarder l'app sans jamais lire le mot de passe réel** : relancer le serveur avec
   `MOT_DE_PASSE_SITE='une-valeur-de-test' npm run dev`. Next.js ne remplace **jamais** une
   variable déjà présente dans l'environnement, donc la valeur de test l'emporte sur
   `.env.local` **sans y toucher** — vérifié par empreinte MD5 avant et après, le 26 août 2026.
   C'est la parade concrète à la règle « ne jamais faire entrer un secret dans la
   conversation » : la passe visuelle n'a plus besoin de connaître le vrai mot de passe.
6. ⚠️ **Ne jamais passer l'objet `offre` entier à un composant client.** Aujourd'hui toute la
   chaîne de `/offres` **et de `/offres/[identifiant]`** est en composants serveur : leurs props
   ne traversent pas la frontière, et c'est **mesuré** — `notation_motif_echec`, `execution_id` et `salaire_annuel_min`
   apparaissent **0 fois** dans le document reçu par le navigateur, contre 194 fois pour un
   texte réellement affiché. **La phase 4 casse cette propriété** en posant des boutons de
   statut, donc des composants clients. Leur passer `offre` enverrait **toutes** les colonnes
   lues dans le navigateur — le message d'erreur technique, et surtout la note personnelle le
   jour où elle existera. Leur passer les champs dont ils ont besoin, un par un.

7. ⚠️ **`options.egal` est la SEULE façon de faire entrer une valeur extérieure dans une
   requête** (`interface/lib/supabase.ts`). Elle encode ; le `chemin`, lui, ne doit porter que
   des constantes du code. **Mesuré le 28 août** : sans encodage, `identifiant=eq.X&select=*`
   placé *avant* le `select` légitime rend **44 colonnes dont `charge_brute`** — PostgREST
   retient le **premier** `select` mais le **dernier** `limit`. Une protection par l'ordre des
   paramètres existe donc, et elle est une **coïncidence**, pas une garantie.
8. ⚠️ **La fiche d'offre est en COLONNE UNIQUE, et la question se rouvre en phase 6.** Le
   `DESIGN.md` prévoyait deux colonnes, la droite portant l'enrichissement — qui n'existe pas
   avant la phase 6. Mesuré le 28 août : le résumé fait **122 caractères en médiane** (et non
   trois lignes) et il est **absent des 434 offres non notées**. Ne pas repasser en deux
   colonnes tant qu'il n'y a rien à mettre à droite.

⚠️ **Un défaut connu, laissé ouvert faute de correctif propre** : l'écriture des offres se fait
par lots de 50 et **n'est pas atomique** — l'API REST n'expose pas de transaction. Si un lot
échoue, les précédents sont écrits et rattachés à une exécution marquée `echec`. Le recollage
(`recoller_offres_orphelines`) les récupère la nuit suivante. À rouvrir si le cas se produit.

**Les décisions de cadrage, de design et de plan sont acquises — ne pas les rouvrir.** Elles
sont dans `docs/DECISIONS.md`, `docs/DESIGN.md` et `docs/PLAN.md` ; leur histoire est dans
**`docs/JOURNAL.md`**.

## Collecte — cinq faits mesurés, opposables

Mesurés contre l'API réelle le 21 août 2026, **remesurés et corrigés le 26 puis le
28 août** — les points 1 et 5 datent du 28 et sont les plus structurants. Détail et méthode dans `docs/API_FRANCE_TRAVAIL.md`. **Ne pas les
redécouvrir, ne pas les contredire de mémoire.**

1. ⚠️ **CORRIGÉ LE 28 AOÛT — le moteur ne fait PAS de correspondance textuelle, il
   élargit au domaine.** Ce point énumérait les champs indexés (« l'intitulé, le
   libellé ROME, l'appellation et le champ `competences` ») ; l'énumération donnait
   l'illusion d'un contrat qui n'existe pas. Mesuré : sur 40 offres rendues par
   `intelligence artificielle` en propre, **26 ne contiennent le terme nulle part** —
   ni dans ces quatre champs, ni dans la description, ni ailleurs dans la charge
   brute. Et le moteur n'est pas compositionnel : `intelligence artificielle` rend
   168 offres, `intelligence` 64, `artificielle` 43, leur union **64** — donc 125
   des 168 ne viennent d'aucun des deux mots seuls.
   **Trois conséquences opposables** : un terme ramène des offres qui ne le
   contiennent pas · chercher `X Y` ne se prédit pas en mesurant `X` et `Y` · donc
   **un critère se mesure, jamais ne se déduit** — même règle qu'avant, mais parce
   que l'index est *opaque*, pas parce qu'il est étroit.
   ⚠️ **Corollaire coûteux** : un terme générique ratisse un domaine entier.
   `agents` rend **2 718 offres/mois** (agent d'accueil, agent de sécurité).
   Reste vrai : une offre au titre banal peut échapper à toute liste de mots-clés.
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
5. ⚠️ **SEUL LE CDI EST COLLECTÉ depuis le 28 août 2026** — `TYPE_CONTRAT` dans
   `pipeline/config.py`, filtré **côté serveur** par le paramètre `typeContrat`. Écarte
   22 % du volume : 39 CDD par mois (dont 27 alternances), 16 intérims, 3 professions
   libérales. Décidé par Maxime, **qui a vu et accepté le coût** : 11 des 20 meilleures
   offres notées auraient été écartées, dont un CDD Institut Curie à 75. Ne pas rouvrir.
   ⚠️ **Ce filtre est IRRÉVERSIBLE POUR LE PASSÉ, et sa perte est silencieuse.** France
   Travail dépublie : le remettre à `None` rouvre l'avenir, jamais les semaines écoulées,
   et **rien en base ne témoigne de ce qui n'a pas été collecté**. Même logique que « la
   base ne s'efface pas », en pire — ici on ne voit pas le trou.
   ⚠️ **`typeContrat` est la SEULE métadonnée sûre à filtrer** : renseignée sur 560 offres
   sur 560. `qualification` est vide sur 86 des 123 offres notées, et 11 des 20 meilleures
   sont dans ce trou — filtrer sur « Cadre » perdrait 70 % des bonnes offres. Avec
   `experience_libelle` (faux une fois sur deux), c'est l'argument central du projet :
   **les métadonnées France Travail sont trop lacunaires pour trier, d'où un modèle qui
   lit le texte.**

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
python -m pipeline.notation --derniere-collecte         # LE MODE DU CRON : que les offres de la dernière collecte
python -m pipeline.notation --lot                       # via l'API Batches : moitié prix, jusqu'à 1 h annoncée
python -m pipeline.notation --sans-ecrire --limite 1    # appelle le modèle, n'écrit rien en base
```

⚠️ **Tout ce qui n'est pas `--sans-appeler` est FACTURÉ. Prévenir Maxime avant, toujours**,
avec le nombre d'appels et l'ordre de grandeur (~0,6 centime par offre, cache chaud).
`models.list()` et `count_tokens()` sont gratuits — s'en servir librement.

**Les drapeaux de mesure** — liste complète dans `--help`, deux portent une leçon :

- ⚠️ **`--au-hasard`** tire l'échantillon au sort au lieu de prendre les plus récentes. Sans
  lui, une « mesure » porte sur une seule journée de collecte et ne dit rien du gisement.
- ⚠️ **`--renoter`** reprend les offres **déjà notées**, et il est **MIS DE CÔTÉ depuis le
  26 août 2026** : il a servi à régler `criteres_pertinence.txt` en itérant sur les mêmes
  offres, ce travail est fait, et une offre n'est désormais notée **qu'une seule fois**. Le
  drapeau reste en place pour le jour où un barème changera vraiment.
  ⚠️ **Il porte un bug connu, à corriger avant de le ressortir** — l'analyse complète est en
  commentaire dans `pipeline/notation.py`, juste au-dessus de `apercevoir()`, c'est-à-dire là
  où on tombera dessus. Résumé : un échec de renotation viole `echec_sans_note` (400), et le
  correctif n'est **pas** d'effacer la note existante mais de n'écrire aucun motif.

- ⚠️ **`--derniere-collecte`** restreint la notation aux offres de la **dernière collecte
  réussie** — c'est le mode du cron nocturne, et c'est lui qui borne la dépense à ce qui vient
  d'arriver. Il résout l'identifiant **par la base**, jamais par un canal GitHub Actions : les
  deux étapes restent lançables séparément et dans n'importe quel ordre.
  ⚠️ Il s'exclut de `--collecte` et de `--renoter`, et le CLI refuse les combinaisons plutôt
  que d'en privilégier une en silence.
- ⚠️ **`--sans-appeler` reçoit les mêmes filtres que la notation réelle depuis le 26 août.**
  Avant, `--sans-appeler --rome H1206` affichait le prompt d'une offre **quelconque** sans
  rien signaler : un aperçu qui ne montre pas l'offre qu'on s'apprête à envoyer est pire que
  pas d'aperçu.

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
   le bloc voyage. ⚠️ **Ils s'affichent sur la fiche d'une offre depuis le 28 août
   2026** — décision de Maxime : le site est derrière son mot de passe et n'a
   qu'un utilisateur, et ces champs n'existent que pour candidater. **Le reste
   de la règle tient** : jamais dans un journal — ceux de GitHub Actions sont
   **publics** — ni dans un export, ni sur une page publique, ni dans la liste
   `/offres`, qui ne les lit pas. Les notes personnelles ajoutées par Maxime sur une offre relèvent de
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
Chiffres, formes de salaire et cas limites : `docs/PLAN.md` § Contenu de test. **Un fait à ne
pas redécouvrir** : le vide est le cas normal (36 % sans entreprise, 65 % sans salaire, mais
le lieu toujours renseigné).

⚠️ **CORRIGÉ LE 26 AOÛT AU SOIR — « l'intitulé très long n'existe pas » était FAUX.** Cette
ligne affirmait « 94 caractères au maximum, médiane 40 », mesuré sur 373 offres. Remesuré sur
**535** : **223 caractères au maximum**, médiane 43, et 3 offres au-dessus de 94. Le record est
un « Stage de fin d'études / Alternance - Sujet de stage : Accompagner les transformations
majeures… » qui se déroule sur **6 lignes à 375 px** (vérifié, rien ne casse).

**La leçon vaut plus que le chiffre : une mesure de cas limite se périme à chaque recollecte.**
Un maximum observé n'est pas une borne, c'est un échantillon — et il ne peut que monter. Ne
jamais écrire qu'un cas « n'existe pas » sur la foi d'un maximum ; écrire ce qu'on a vu, avec
la taille de l'échantillon et la date.

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
