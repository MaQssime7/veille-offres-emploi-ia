# CLAUDE.md — Veille offres emploi IA

Lu à chaque session de Claude Code dans ce dépôt. Complète le `CLAUDE.md` global
de Maxime (`~/.claude/CLAUDE.md`), il ne le remplace pas.

## Où trouver quoi

| Sujet | Où |
|---|---|
| **Pourquoi** une décision de cadrage est ce qu'elle est · questions ouvertes | `docs/DECISIONS.md` |
| **Schéma de la base** : tables, colonnes, contraintes, et le *pourquoi* de chacune | `supabase/migrations/` — **seule source de vérité, jamais recopiée ailleurs** |
| API France Travail : authentification, pagination, quota, cas limites | `docs/API_FRANCE_TRAVAIL.md` |
| **Mise en ligne** : variables Vercel, migrations Supabase, secrets GitHub Actions | `docs/HEBERGEMENT.md` |
| API Anthropic : modèles, paramètres, sortie structurée, cache, batches | référence `/claude-api` |
| Claude Agent SDK : surface d'API | `code.claude.com/docs/en/agent-sdk` |
| Ce que le produit doit faire · ce qu'il refuse de faire | `docs/PRD.md` |
| Identité visuelle : jetons, contrastes vérifiés, composants | `docs/DESIGN.md` |
| Dans quel ordre construire · contenu de test · parcours à repasser | `docs/PLAN.md` |
| Ce qui s'est passé et pourquoi, dans l'ordre | `docs/JOURNAL.md` |
| **Comment le modèle note** : profil, postes visés, barèmes | `pipeline/criteres_pertinence.txt` — **c'est une donnée, pas du code**. ⚠️ `//` = commentaire retiré avant l'envoi, `##` = titre envoyé au modèle |
| **Ce que vaut chaque critère de collecte**, mesuré terme par terme | `pipeline/mots_cles.txt` et `pipeline/codes_rome.txt` (vide, et porte la mesure qui l'a vidé) — voir § Collecte |
| Conventions Next.js 16 : fichiers, frontières RSC, données, métadonnées | skill `next-best-practices` |
| **Comment le site est protégé** : cookie, mot de passe, adresses libres | `interface/lib/session.ts` et `interface/lib/acces.ts`, abondamment commentés |
| **Comment l'interface ÉCRIT en base** : garde-fous, idempotence | `ecrireDansBase()` dans `interface/lib/supabase.ts` |
| Statuts, note personnelle, **accords et dates en français**, filtres et classement de la liste, thème, **quel nom d'employeur afficher**, **coup de cœur** : constantes et fonctions pures partagées serveur/navigateur | `interface/lib/statuts.ts`, `interface/lib/notes.ts`, `interface/lib/francais.ts`, `interface/lib/filtres.ts`, `interface/lib/tri.ts`, `interface/lib/theme.ts`, `interface/lib/employeur.ts`, `interface/lib/coup-de-coeur.ts`, `interface/lib/enrichissement.ts` — ⚠️ **les neuf seuls modules de `lib/` sans `server-only`**, et c'est délibéré (§ règle 3) |
| **Ce que la liste montre et dans quel ordre** : les six filtres (dont « Nouveau » et « Coup de cœur »), les trois classements, et la table de chaînes SQL qu'aucune valeur d'adresse n'atteint | `interface/lib/filtres.ts` et `interface/lib/tri.ts` pour les constantes · `interface/lib/offres.ts` pour `CLASSEMENTS`, qui **ne descend jamais** dans les deux premiers |
| **Pourquoi le coup de cœur n'est pas un statut**, et ce que cette forme protège | `interface/lib/coup-de-coeur.ts` · migration 9 · `docs/JOURNAL.md` § 30 août |
| **Ce que l'écran du matin montre** : le seuil de 35, les six écrans vides et l'ORDRE qui les départage | `interface/lib/matin.ts` — lecture et calcul séparés, `choisirAffichage()` est une fonction pure, éprouvée par `matin.test.ts` |
| **L'état de santé de la veille** : les cinq états, le seuil d'alerte de 36 h, celui des 60 min qui démasque une collecte tuée | `interface/lib/veille.ts` — lecture et calcul séparés, `calculerEtat()` est une fonction pure. ⚠️ Les **dateurs** sont dans `francais.ts`, pas ici : purs, ils ne doivent pas être enfermés derrière `server-only` |

**Règle de tenue de ce fichier.** Il ne contient que ce qui change mon
comportement sur *n'importe quelle* tâche du projet. Toute référence propre à un
module — paramètres d'API, schémas, procédures, mesures de critères — part dans
`docs/` ou dans le fichier de données concerné, avec un pointeur impératif ici.
Une section qui dépasse une vingtaine de lignes de détail technique doit sortir.
Sans cette règle, ce fichier fait 800 lignes dans un mois et personne ne le lit
plus — c'est arrivé, il en faisait 955 le 29 août 2026.

## Le projet

Agent de veille quotidienne sur les offres d'emploi dans l'IA. Le pipeline :
récupérer les offres via l'API France Travail → les évaluer contre des critères
de pertinence → présenter un classement dans une interface web.

**Deux usages, pas un seul.** Le projet sert à Maxime pour sa recherche d'emploi
*et* de vitrine technique en entretien — le dépôt est public
(https://github.com/MaQssime7/veille-offres-emploi-ia). Conséquences :

- Le code sera lu par un recruteur ou un lead technique. Nommage explicite,
  fonctions courtes, pas de fichier fourre-tout.
- L'historique Git compte autant que le code. Commits atomiques, messages en
  français qui expliquent le *pourquoi*.
- Le README est la première chose lue. Il doit rester à jour.

## Produit

**Le problème** : trier à la main des dizaines d'annonces France Travail chaque
matin pour en garder deux ou trois, rater silencieusement celles dont l'intitulé
est banal, puis passer un quart d'heure par offre à comprendre à qui on a affaire.

**Pour qui** : un utilisateur unique — Maxime, jeune diplômé ENSEA, six mois en
cabinet de conseil IA, en recherche active en Île-de-France, qui consulte dix
minutes le matin et ouvre parfois le site en entretien.

**Hors périmètre, opposable** : mail et notifications · lettre de motivation ·
candidature automatique · toute source autre que France Travail · toute zone hors
Île-de-France · comptes utilisateurs et rôles · suivi de candidature avancé
(calendrier, relances, CV) · réglage des critères depuis l'interface ·
modification manuelle des notes du modèle · **enrichissement automatique, sous toute forme** · analyse du marché de l'emploi
(tendances, salaires, graphiques) · application mobile installable · démo
publique à données fictives · traduction et offres hors France · import de CV.

Le PRD fait autorité : ce qui figure ici ne se construit pas, même si ça semble
une bonne idée sur le moment. Une demande qui tombe dedans se signale **avant**
d'être satisfaite, elle ne se glisse pas dans une phase.

**Évolutions prévues — ni v1, ni refusées.** Chacune **contraint la v1 dès
maintenant** : ne pas construire l'écran n'excuse pas de ne pas capturer sa
matière.

| Évolution | Ce que ça impose dès la v1 |
|---|---|
| Écran de suivi d'exploitation (exécutions, réussite, durée, coût) | Tracer chaque exécution et chaque enrichissement dès le premier jour, en **compteurs bruts** jamais en euros. Un historique ne se reconstitue pas |
| Conversation avec l'agent **sur une offre enrichie** | Fiche stockée en **champs séparés**, pas en texte rédigé · identifiant d'offre stable · enveloppe par offre en **tokens cumulés** |

⚠️ **Quatre règles de vocabulaire et de périmètre, qui ne se déduisent d'aucun
fichier :**

1. **Ne jamais nommer l'écran de suivi « analytics ».** Le mot recouvre à la fois
   celui qui est prévu et l'analyse du marché de l'emploi, qui est **refusée** —
   c'est par ce glissement qu'un graphe de salaires finit par entrer « tant qu'on
   y est ». Il ne parle que du système : exécutions, réussite, durée, volumes,
   consommation. Jamais du marché.
2. **La conversation porte sur *une* offre, jamais sur toute la base.** L'agent
   global en page d'accueil a été explicitement refusé le 16 août 2026 : son
   contexte et son coût ne sont pas bornables. Ne pas le réintroduire.
3. **La borne de conversation se compte en tokens cumulés, jamais en nombre de
   messages** : le contexte est renvoyé au modèle à chaque tour, la consommation
   croît quadratiquement. À 100 %, la saisie se bloque définitivement sur cette
   offre — pas de réinitialisation, sinon ce n'est plus une borne.
4. **Vocabulaire figé : « enrichissement », jamais « enquête ».** Le terme couvre
   l'étape du pipeline, l'action dans l'interface et la fiche produite. Deux mots
   pour la même chose finissent en deux tables et deux fonctions.

**Cadrage complet** : `docs/PRD.md` — 37 user stories, 13 critères de succès.

## État au 30 août 2026

**Phases 1 à 5 CLOSES.** ⚠️ **La PHASE 6 — l'enrichissement à la demande — est le
prochain chantier.**
Le site est en ligne derrière son mot de passe, collecte et notation tournent sur
le cron. `/` est le **compte rendu de la nuit**, `/offres` le **plan de travail**.
**L'interface écrit en base** — statuts et note personnelle. **580 offres,
146 notées, 576 à traiter / 0 candidaté / 4 écarté.**

### ⚠️ Ce que la phase 5 a livré — huit faits opposables

`/` affiche les offres de la **dernière collecte réussie** encore à traiter qui
dépassent le seuil d'intérêt, sous la même manchette que `/offres`, plus une carte
de passage vers le plan de travail. Récit dans `docs/JOURNAL.md`, barèmes et
mesures dans `interface/lib/matin.ts` et `regroupement.ts`.

1. ⚠️ **`/` REGROUPE les annonces d'un même poste, `/offres` NON.** France Travail
   publie le même poste en « f/h » et en « (H/F) » — deux identifiants, donc deux
   lignes que la déduplication du pipeline ne voit pas : **29 en trop sur 574**.
   ⚠️ **Ne PAS étendre le regroupement à `/offres`** : c'est l'archive, plafonnée à
   200 sur 576, et deux jumelles peuvent être l'une dedans et l'autre dehors.
2. ⚠️ **L'employeur SÉPARE, il ne rapproche jamais.** La clé est l'intitulé
   normalisé + le lieu ; un groupe n'éclate que s'il réunit deux employeurs
   différents — `entreprise_nom` **ou** `entreprise_identifiee`, voir
   `nomSeparateur()`. Mettre l'entreprise dans la clé a été essayé et **ne
   regroupait rien** : 39 % des offres n'ont pas d'employeur nommé, dont les quatre
   annonces MBDA qui ont motivé le module.
3. ⚠️ **Le clic de statut traite le POSTE ENTIER** (décision de Maxime) :
   `definirStatut` prend une **liste** d'identifiants, bornée à 8. Sans ça, écarter
   l'annonce affichée laisserait sa jumelle « à traiter ».
4. ⚠️ **LE SEUIL EST À 35 — décision de Maxime, pas la valeur du plan** (qui
   écrivait 50, et laissait l'écran vide quatre matins sur six). Descendre à 25
   n'ajouterait que 7 offres et rapprocherait `/` d'un second plan de travail.
5. ⚠️ **SIX écrans vides, pas trois**, dont « la notation n'a pas tourné » qui
   n'était pas au plan. ⚠️ **L'ORDRE des tests de `choisirAffichage()` EST la
   logique** — « aucune n'atteint le seuil » n'est vrai que si la collecte a ramené
   quelque chose *et* que ce quelque chose a été noté.
6. ⚠️ **Deux annonces du même poste sont parfois notées TRÈS différemment** : 68 et
   45 sur la paire mesurée le 30 août. **Les doublons sont un banc d'essai gratuit
   de la notation.** Constat noté, non traité.
7. ⚠️ **`(site)/_composants/` est le dossier des briques PARTAGÉES**, `actions.ts`
   compris : `definirStatut` n'appartient plus à `/offres`. Il **revalide `/` EN
   PLUS de `/offres`**, sans quoi le bouton retour ramène une offre déjà classée.
8. ⚠️ **La date de collecte n'est PAS répétée sous le salut** (la manchette
   l'affiche 90 px plus haut), et **le squelette de `/` imite UNE ligne** : un
   squelette s'aligne sur ce que SA page affiche le plus souvent.

### ⚠️ Refonte du système de design — 29 août 2026, branche `refonte-design-pouf`

**Le système est passé de l'éditorial technique (beige, Fraunces, aucune ombre) à
[1st-Pouf](https://1st-pouf.worksonmy.dev)** — pastel, arrondi, volumétrique.
Décision de Maxime, validée devant l'écran. Voir § Design et `docs/DESIGN.md`.

⚠️ **Ce que la refonte a légué, et qui vaut toujours :**

- **La donnée n'a pas bougé**, c'était la contrainte : un relevé des champs
  affichés a été figé avant la refonte et vérifié après.
- **`globals.css` est un dictionnaire shadcn → pouf.** On continue d'écrire
  `bg-card`, `text-muted-foreground` : un écran neuf n'a aucun vocabulaire à
  apprendre.
- ⚠️ **Le compte « M notées » a été RETIRÉ de `/offres`** — à terme toute offre
  arrive notée. Ne pas le réintroduire sans rouvrir la question.
- ⚠️ **Le focus clavier passe par `outline` et jamais par `ring`** sur tout
  élément portant un `cushion-*`. C'est un défaut d'accessibilité réel, trouvé en
  mesurant : l'anneau était dans la classe et absent du style calculé.
  ✅ Revérifié le 30 août sur la carte de passage de `/` : `outline` de 2 px
  présent malgré le coussin, contraste 10,32:1.

### ⚠️ Le coup de cœur — 30 août 2026, et ce N'EST PAS un statut

Demandé par Maxime. Colonne `coup_de_coeur_a` (migration 9), sixième filtre.
Récit et mesures dans `docs/JOURNAL.md`, forme dans `docs/DESIGN.md`.

1. ⚠️ **MARQUEUR TRANSVERSE, jamais une quatrième valeur de `statut`** — décision
   de Maxime, prise après lui avoir montré les deux formes. Un statut est
   exclusif : une offre likée aurait quitté l'écran du matin, et **candidater
   aurait effacé le cœur**. Ne pas l'ajouter à `STATUTS` : `coup-de-coeur.test.ts`
   échouera, et c'est fait pour.
2. ⚠️ **Son compte NE S'ADDITIONNE PAS** avec ceux des trois statuts, comme
   « Nouveau » : chaque offre likée porte aussi un statut.
3. ⚠️ **Le filtre SQL ne passe PAS par `options.egal`**, qui ne sait produire que
   `=eq.` : la condition est une **constante** du code, collée ou non par un
   **booléen** — jamais par une chaîne reçue.
4. ⚠️ **Le cœur PREND le verrou de tri conditionnellement, et le RESPECTE
   toujours** — les deux ne vont pas ensemble. Il ne le prend que dans l'onglet
   « Coup de cœur », seul endroit où délier fait sortir la ligne ; le prendre
   partout gelait les 200 lignes pour rien pendant ~900 ms.
   ⚠️ **Et le clic ne touche QU'UNE annonce**, contrairement au statut : propager
   aux jumelles ne protégeait de rien et mettait quatre lignes pour un poste dans
   un onglet qui ne regroupe pas. Les deux corrigés en revue le 30 août.
5. ⚠️ **Le pêche est le SIXIÈME et DERNIER accent**, à **1,05:1 du rose
   d'« Écarté »**, son voisin dans la ligne : c'est la **forme** qui les sépare.
   ⚠️ **Pas d'icône de cœur sur la pilule de filtre** — ici, *le chiffre contre
   l'icône* est ce qui distingue une pilule d'un bouton qui écrit en base.

### ✅ Filtres colorés, classement et thème — 29 août 2026

Demandé par Maxime devant l'écran. Récit complet
dans `docs/JOURNAL.md`, décisions visuelles dans `docs/DESIGN.md`.

- **Cinq pilules de filtre**, chacune à la teinte de ce qu'elle montre : à traiter
  (violet) · **Nouveau** (jaune) · candidaté (menthe) · écarté (rose) · toutes
  (sans teinte). ⚠️ **Six depuis le 30 août** — « Coup de cœur » (pêche) s'est
  glissé en troisième position.
  ⚠️ **C'est un REVIREMENT** : la règle précédente interdisait de
  teinter un onglet avec une couleur de signal, parce qu'une pilule menthe
  ressemble au bouton « Candidaté », qui lui **écrit en base**. Ce qui les sépare
  désormais est **le chiffre contre l'icône** — ne retirer ni l'un ni l'autre.
- ⚠️ **« Nouveau » n'est PAS un statut** : il montre les offres de la dernière
  collecte réussie, **tous statuts confondus**, et son compte ne s'additionne donc
  pas avec les trois autres. Il voyage quand même dans `?statut=`, comme « toutes »,
  pour ne pas casser les favoris existants.
- **Menu « Trier »** à droite : intérêt (défaut) · accessibilité · plus récentes.
  ⚠️ **Le classement change ce que l'écran MONTRE, pas seulement l'ordre** : avec le
  plafond de 200 lignes, trier par date fait remonter des offres non notées et sort
  de l'écran des offres mieux notées mais plus anciennes.
- **Bouton de thème à trois états** — système → clair → sombre. Le choix vit dans
  le navigateur, relu avant la peinture par le script du `<head>`, qui est la
  **seule** copie de la règle « quel choix donne quel mode ».
- ⚠️ **Une opacité se remesure sur la surface qui est VRAIMENT derrière**, et un
  contrôle de contraste qui lit du `rgb()` là où Tailwind rend de l'`oklab()`
  produit des chiffres faux. Les deux pièges ont mordu le 29 août ; **mesures et
  méthode dans `docs/DESIGN.md` § Contrastes.**

### ✅ La manchette d'état — partagée par les deux écrans depuis le 30 août 2026

Composant unique, `app/(site)/_composants/etat-veille.tsx`, importé par `/` et
`/offres` et jamais recopié. Détail des seuils dans `interface/lib/veille.ts`.

- ⚠️ **Cinq états, et le `switch` est exhaustif** : à jour · en retard (> 36 h) ·
  dernier passage raté · aucune veille · état indisponible. Les deux derniers sont
  distincts à dessein — « aucune veille » est une base neuve, « indisponible » une
  lecture ratée ; les confondre annoncerait une panne un jour où seule la base est
  injoignable.
- ⚠️ **Une collecte TUÉE en plein vol compte comme un ratage, et c'est un seuil de
  TEMPS qui la démasque.** Une exécution tuée laisse `issue = 'en_cours'` que le
  pipeline ne referme qu'à son démarrage suivant : sans seuil, le bandeau affichait
  « à jour » pendant 24 h sur une nuit morte. Au-delà de **60 minutes** — le double
  du `timeout-minutes` du workflow — un `en_cours` est un ratage. Le libellé
  distingue « en échec » (un motif existe) d'« interrompue » (aucun motif à
  chercher).
- ⚠️ **Les deux `h1` disent « Bonjour Maxime », les titres d'ONGLET diffèrent**
  (« Ce matin », « Plan de travail ») — décision de Maxime. La règle qui liait `h1`
  et onglet valait tant que les deux *nommaient* l'écran ; un salut ne nomme rien.
  ⚠️ **Le salut ne varie PAS avec l'heure** : le rendu est serveur, et deviner le
  fuseau du visiteur est la classe de bug que `verifie` traque en rejouant en UTC.
- ⚠️ **`EnTetePage` prend quatre propriétés NOMMÉES** (`manchette`, `sousTitre`,
  `filtres`, `tri`) au lieu d'un `children` fourre-tout : c'est ce qui rend
  l'égalité de hauteur avec les `loading.tsx` vérifiable dans le code.

| Brique | État |
|---|---|
| `interface/` | Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui moteur `radix`. La porte, **`/` le compte rendu de la nuit**, `/offres` (six filtres, trois classements, statuts, **coup de cœur**), la fiche `/offres/[identifiant]` (statuts, note personnelle, coup de cœur), **bouton de thème à trois états** (système / clair / sombre) |
| Supabase | Région Paris. `executions_veille` et `offres`. RLS activé, droits vérifiés |
| Migrations | **9**, toutes appliquées. La 6ᵉ ajoute les statuts et la note personnelle ; la 7ᵉ corrige une contrainte de la 6ᵉ prise en défaut par son propre test ; la 8ᵉ ajoute `entreprise_identifiee` et `entreprise_intermediaire` ; la 9ᵉ ajoute `coup_de_coeur_a` |
| Vercel | https://veille-offres-emploi-ia.vercel.app · `Root Directory = interface` · région Paris |
| `pipeline/` | Collecte **et** notation sur le cron GitHub Actions à 02:23 UTC. ⚠️ **Seul le CDI est collecté** (`TYPE_CONTRAT` dans `config.py`) |
| Modules | `collecte.py` · `notation.py` · `salaire.py` · `employeur.py` · `criteres_pertinence.txt` |
| `.venv/` | À la racine, `requirements.txt` versionné |

### ✅ L'employeur réel, lu dans le texte de l'annonce — 30 août 2026

**`entreprise_nom` de France Travail ne vaut pas ce qu'on croit**, mesuré sur les
580 offres : **absent sur 39 %** (47 % des notées), intermédiaire dans **36 %**
des cas, et **parfois faux** — `6426819` l'annonce à « NEW NET 3D » quand sa
description dit « L'entreprise Wavestone recherche des profils ». Le modèle
extrait donc l'employeur **dans l'appel de notation qui existe déjà**. Migration 8 :
`entreprise_identifiee`, `entreprise_intermediaire`. Détail et mesures dans
`pipeline/employeur.py`, `interface/lib/employeur.ts` et `docs/JOURNAL.md`.

⚠️ **Cinq faits qui ne se déduisent d'aucun fichier :**

1. **`entreprise_nom` n'est JAMAIS écrasé** — la déduction vient à côté. Un nom
   absent se voit, un nom faux se croit.
2. **Le garde-fou est DÉTERMINISTE** : `verifier()` cherche le nom rendu dans le
   texte envoyé, sinon le jette. Une consigne se contourne, pas une comparaison de
   chaînes. **Ce qui se vérifie ne se croit pas.**
3. **ESN ≠ cabinet de recrutement.** Le cabinet recrute *pour* un tiers → rendre le
   tiers ; l'ESN embauche *elle-même* → rendre l'ESN, jamais son client. La
   première consigne confondait les deux et rendait `null` sur les ESN.
4. **Le rattrapage se filtre sur le DRAPEAU, jamais sur le nom** — le modèle répond
   `null` sur ~1 offre sur 6, et filtrer sur le nom les refacturait à chaque
   relance.
5. **Le nom identifié SÉPARE au regroupement, sans jamais rapprocher.** Sans ça, un
   clic de statut écrivait sur une offre jamais vue.

⚠️ **`entreprise_intermediaire` VARIE d'un appel à l'autre sur la même offre** —
observé sur `6426819`. Ne rien bâtir de structurant dessus.

**Premier rattrapage (18 offres ≥ 35)** : 15 identifiées, 0 échec — 4 comblées,
3 corrigées, 6 confirmées, 2 abrégées (rattrapées à l'affichage). ~16 centimes.

### Ce qui reste ouvert

| Sujet | État |
|---|---|
| ⚠️ **La note d'apprentissage de la phase 5 reste à écrire** | Obligation du `CLAUDE.md` global — une note de diagnostic par phase dans `~/Documents/Coffre Obsidian/Maxime M/Apprentissage/`, dans le sous-dossier du sujet. Matière disponible : le regroupement en fonction pure, l'action serveur qui écrit plusieurs lignes et dit son échec partiel, et la leçon du calage de squelette (mesurer le bas du contenu, pas la hauteur d'un conteneur `flex-1`) |
| ⚠️ **La rustine `gh workflow run` EFFACE le compte rendu de la nuit** | Trouvé en revue le 30 août. La collecte écrit en `ignore-duplicates` : une offre déjà connue reste rattachée à l'exécution qui l'a vue **en premier**. Donc la collecte relancée à la main le matin réussit avec **zéro offre nouvelle**, devient « la dernière collecte réussie », et `/` remplace les offres de la nuit par « la collecte n'a rien rapporté ». ⚠️ **Non corrigé délibérément** : le plan dit « c'est la dernière réussie qui fait foi », et préférer « la dernière non vide » empêcherait d'afficher une vraie nuit blanche. Le **texte** a été corrigé pour ne plus mentir, et les offres restent atteignables par la carte de passage. **La question appartient à Maxime**, et elle disparaîtra d'elle-même avec le déclencheur externe de la phase 6 |
| ⚠️ **L'indicateur de veille ne vieillit pas dans un onglet resté ouvert** | Il est calculé au rendu serveur : un onglet laissé ouvert toute la journée affiche encore « Aujourd'hui, 11:11 » le lendemain matin, et ne passera jamais en alerte tout seul. Le corriger demanderait une horloge dans le navigateur, donc un composant client, pour une information qui change une fois par jour. **Signalé, non corrigé** — écrit dans `etat-veille.tsx` pour ne pas passer pour un oubli |
| ⚠️ **Le plafond de 200 lignes — desserré, pas résolu** | La liste montre les 200 meilleures de tous les temps : le jour où plus de 200 offres portent une note, celles de la nuit disparaissent. Le filtre de la phase 4 desserre (une offre triée libère sa place) mais ne résout pas : tant que rien n'est trié, les 576 restent « à traiter ». **L'échéance est un compte, pas une date.** Aggravé par le refus d'effacer : les annonces dépubliées mais bien notées squattent le haut. ⚠️ **Ne pas forcer en payant** (~40 centimes pour noter 60 offres de plus) : c'est un raisonnement, pas une économie — 200 est aussi le seuil où l'écran casse. Simulation dans `docs/PLAN.md` § Phase 2 |
| ⚠️ **`intelligence artificielle` : le seul critère non arbitré** | 127 offres nettes/mois pour une moyenne de 8/100 et un maximum de 15 sur 27 notées — le profil exact qui a fait tomber les codes ROME. Et on ne perdrait rien : les 9 offres ≥ 25 sont toutes rattrapées par `IA` ou `AI`, vérifié une par une. Maxime l'a **gardé** le 28 août. ⚠️ **Ne pas le retirer seul** |
| Qualité d'`automatisation` | 11 offres nettes/mois, **aucune notée** : sa qualité est **inconnue**, ce qui n'est pas la même chose que « bonne » |
| Bug pipeline **dormant** : `--renoter` perd la trace d'un échec | Inatteignable depuis le 26 août — le bug ne se déclenche que sur une offre déjà notée. L'analyse et le correctif vivent en commentaire dans `pipeline/notation.py` au-dessus de `apercevoir()`, **au point d'usage** : celui qui ressortira `--renoter` tombera dessus |
| Clés Supabase *legacy* | `anon` / `service_role` toujours actives en parallèle des nouvelles — à désactiver (`docs/HEBERGEMENT.md`) |
| `PGRST303` | « JWT issued at future » au premier appel après recompilation, **en développement seulement**. Symptôme trompeur : « base injoignable » alors que la base va bien |
| ⚠️ **Deux onglets sur la même fiche** | Le dernier qui tape écrase la note de l'autre, sans avertissement. Un seul utilisateur : signalé, non corrigé. Le corriger demanderait un horodatage de version comparé avant écriture |

⚠️ **DEUX défauts de la fiche d'offre, MESURÉS le 29 août et volontairement
LAISSÉS.** Décision de Maxime. **Ne pas les remesurer.** Fiche muette sur les 434
offres non notées (**se résorbe seul** à mesure que la base se note) · les cinq
titres de section ont le même poids.
✅ **Le troisième — les barres de notes restées à la largeur de la liste — a été
CORRIGÉ le soir même**, Maxime l'ayant rouvert : sur la fiche la jauge est
désormais élargie (208 px, contre 88) et son chiffre passe à 14 px. ⚠️ **En liste elle
garde ses 88 px fixes, et ce n'est pas négociable** : c'est cette largeur qui
aligne les barres d'une ligne à l'autre, donc qui permet de comparer 200 offres
sans lire les chiffres. ⚠️ **La refonte du design ne les a PAS corrigés** — elle a changé les
formes et les couleurs, pas la hiérarchie de l'information.
✅ **Deux AUTRES ont été corrigés le 29 août.** (1) La fiche était trop dense :
marge des cartes portée de 16 à **24 px** (le rayon en fait 32), écarts internes
desserrés. (2) Elle portait **quatre tailles de texte suivi** (16/15/14/13 px)
pour des paragraphes qui se lisent tous pareil — ramenées à **16 px en encre**,
résumé et justifications compris, parce que les deux disent ce que le modèle a
compris de l'offre. (3) Toute l'échelle de la fiche a suivi, sinon le reste
paraissait rapetissé. ⚠️ **Une taille ne se juge jamais seule** — l'intitulé
revient à la valeur jugée « écrasante » la veille, parce que ce qui l'entoure a
grandi. **Échelle complète dans `docs/DESIGN.md` § L'échelle des textes.** ⚠️ **La liste n'a PAS suivi, et ne doit pas suivre** :
`ContenuNotes` porte une propriété `aere` — on balaye une liste, on lit une fiche.
Détail et mesures dans `docs/DESIGN.md` §§ Échelle des textes et Densité.
⚠️ **Une leçon de méthode en est sortie, qui vaut au-delà** : pour caler un
squelette, **une médiane ne s'additionne pas** — la somme des médianes des six
sections se trompait de 55 px sur le total. La moyenne, si.

⚠️ **Un défaut connu, laissé faute de correctif propre** : l'écriture des offres
se fait par lots de 50 et **n'est pas atomique** — l'API REST n'expose pas de
transaction. Si un lot échoue, les précédents sont écrits et rattachés à une
exécution `echec` ; `recoller_offres_orphelines` les récupère la nuit suivante.

### ⚠️ Le cron ne part jamais à l'heure — comportement établi, pas incident

Trois nuits observées, deux déclenchements planifiés, **aucun à l'heure** :
+10 h 32, puis +12 h 02. C'est un comportement **documenté** de GitHub Actions,
plus fréquent sur dépôt public gratuit. La minute non ronde (23) était déjà une
parade ; elle n'a pas suffi.

✅ **Les données sont robustes à ça, par conception** : la fenêtre de collecte part
de la **dernière collecte réussie**, jamais de « hier ». Une nuit sautée est
rattrapée par la suivante, qui collecte 48 h d'un coup. ⚠️ **Ce que ça coûte,
c'est l'usage** : un cron qui tourne l'après-midi livre un écran vide le matin.

⚠️ **À surveiller** : plusieurs nuits sautées d'affilée font grossir le volume, et
la **limite de 60** du workflow finirait par mordre — vers 4 ou 5 nuits. Quand
elle mord, `notation.py` avertit, et **les offres laissées ne repassent pas** en
mode `--derniere-collecte`.

⚠️ **La parade n'est PAS un second cron** : il serait retardé pareil, c'est la
file d'attente qui décale. C'est un **déclencheur externe appelant l'API GitHub**
avec un jeton restreint au seul droit de lancer un workflow — soit exactement le
mécanisme prévu en **phase 6** pour le bouton « Enrichir ». Le construire avant,
c'est le construire deux fois. ✅ **Rustine** : `gh workflow run` le matin.
Récit de l'enquête : `docs/JOURNAL.md` § 27 août.

## ⚠️ Neuf règles opposables, qui ne se déduisent d'aucun fichier

1. ✅ **La page de contrôle de `/installe` a été REMPLACÉE le 30 août 2026** par
   l'écran du matin. `app/(site)/page.tsx` garde sa première ligne — `exigerSession()`,
   la serrure au plus près de ce qui affiche les offres.
   ⚠️ **`(site)/loading.tsx` couvre TOUTE route enfant sans squelette propre.**
   `/offres` et la fiche ont le leur ; une route ajoutée sous `(site)` sans le sien
   afficherait le compte rendu du matin en attendant tout autre chose.
   ⚠️ **Le groupe `(site)` n'est pas de l'organisation, c'est une serrure.**
   `/connexion` est délibérément *hors* du groupe. Ne jamais l'y déplacer.
2. **Un aperçu Vercel parle à la *même* base que la production.** Vercel isole le
   code, jamais les données : une branche qui migre ou supprime touche les vraies
   données.
3. ⚠️ **`interface/lib/statuts.ts`, `interface/lib/notes.ts`,
   `interface/lib/francais.ts`, `interface/lib/filtres.ts`, `interface/lib/tri.ts`
   `interface/lib/theme.ts`, `interface/lib/employeur.ts` et
   `interface/lib/coup-de-coeur.ts` et `interface/lib/enrichissement.ts` sont
   les neuf seuls modules de `lib/` sans
   `import "server-only"`** — `utils.ts` mis à part, qui ne porte que le `cn()` de
   shadcn. C'est leur raison d'être : les composants clients ont besoin des mêmes
   constantes que le serveur (libellés de statut, borne de longueur de la note,
   accord du pluriel) ; s'ils allaient les chercher dans `lib/offres.ts`, ils
   tireraient `lib/supabase.ts` — donc la clé secrète — dans le graphe du
   navigateur. **Y mettre des constantes et des fonctions pures, jamais du code qui
   lit un secret.** Tout futur module partagé suit le même moule.
   ⚠️ **Ce que `tri.ts` ne contient PAS est aussi important que ce qu'il contient** :
   la chaîne de classement SQL reste dans `lib/offres.ts`. Le `?tri=` de l'adresse
   est validé par `estTri()` puis sert de **clé** dans une table de trois chaînes
   constantes — ses lettres n'atteignent jamais le `&order=` de la requête. Un
   `order` est un endroit du chemin, pas une valeur qu'`options.egal` pourrait
   encoder.
   ⚠️ **`lib/filtres.ts` est né d'une revue, et le défaut qu'il répare était
   DORMANT** : `adresse.ts`, une fonction pure posée à côté de composants clients,
   importait `FILTRE_PAR_DEFAUT` depuis `lib/offres.ts` — donc `server-only`, donc
   la clé Supabase. Rien ne cassait tant qu'aucun composant client ne l'importait.
   **Une constante qu'un composant client pourrait un jour vouloir n'a rien à faire
   dans un module qui lit un secret**, même si personne ne l'y cherche encore.
   ⚠️ **`lib/veille.ts` ne suit PAS ce moule et porte bien `server-only`** : il lit
   la base. Sa partie pure — `calculerEtat()`, `daterPassage()` — reste dans le même
   fichier parce qu'aucun composant client n'en a besoin ; le jour où l'un en aurait
   besoin, c'est elle qui déménagerait, pas le `server-only` qui sauterait.
4. ⚠️ **Ne jamais passer l'objet `offre` entier à un composant client.**
   La propriété « tout en composants serveur » est **tombée le 29 août 2026** : les
   boutons de statut et le champ de note sont des composants clients. Ce qui la
   remplace est une **discipline de props** — on passe `identifiant`, `statut`,
   `noteInitiale`, un par un.
   ⚠️ **Ce qui rend la règle fragile** : `<BoutonsStatut offre={offre} />` ou
   `<NotePersonnelle offre={offre} />` compileraient sans la moindre erreur et
   enverraient **toutes les colonnes** dans la page — message d'erreur technique,
   `contact_nom`, note personnelle. ⚠️ **Ne pas y écrire de nombre** : il périme à
   chaque migration, et trois fichiers en annonçaient trois différents le 30 août. **Refaire la mesure après chaque nouveau
   composant client**, c'est le seul garde-fou qui reste. ✅ Refaite une seconde
   fois le 29 août après `MenuTri` et `BasculeTheme` : douze colonnes cherchées sur
   deux vues de la liste, zéro trouvée, témoin positif. ✅ Première passe du 29 août :
   douze noms de colonnes cherchés sur trois écrans, plus le **contenu** d'une note
   cherché dans `/offres` et dans la fiche d'une autre offre — aucun, témoin positif.
5. ⚠️ **`options.egal` est la SEULE façon de faire entrer une valeur extérieure dans
   une requête** (`interface/lib/supabase.ts`). Elle encode ; le `chemin` ne doit
   porter que des constantes du code. **Mesuré le 28 août** : sans encodage,
   `identifiant=eq.X&select=*` placé *avant* le `select` légitime rend **44 colonnes
   dont `charge_brute`** — PostgREST retient le **premier** `select` mais le
   **dernier** `limit`. Une protection par l'ordre des paramètres existe donc, et
   c'est une **coïncidence**, pas une garantie.
6. ⚠️ **L'écriture depuis l'interface est IDEMPOTENTE, et c'est une propriété de ce
   que l'appelant écrit, pas de `ecrireDansBase()`.** On pose des valeurs absolues,
   jamais un incrément — c'est ce qui rend la reprise réseau sûre. Le jour où
   quelqu'un incrémentera un compteur par ce chemin, la reprise le comptera deux
   fois et rien ne l'avertira.
   ⚠️ Trois différences non cosmétiques avec `interrogerBase()` : le nom de table ne
   peut porter aucune valeur extérieure · les valeurs partent dans le **corps JSON**
   · **le filtre est obligatoire**, un `PATCH` sans filtre réécrivant toute la table
   sans que PostgREST bronche.
7. ⚠️ **`useOptimistic` est le bon patron pour un STATUT et le mauvais pour un
   TEXTE.** Il retombe sur la valeur du serveur en fin de transition : parfait pour
   ramener un statut à la vérité de la base après un échec, destructeur pour un
   paragraphe en cours de frappe, qu'il effacerait sous les doigts. **Le bon patron
   dépend de qui détient la vérité.**
8. ⚠️ **Une écriture depuis l'interface exige `revalidatePath`, même quand rien
   d'autre à l'écran n'en dépend.** Le raisonnement inverse a été tenu, mesuré, et
   il était faux : revenir sur la fiche par un **lien** montrait bien la note,
   revenir par le **bouton retour** rendait le champ vide. `"page"` suffit pour la
   note (elle ne sort pas de sa fiche) ; `"layout"` reste nécessaire pour le statut,
   qui change la liste. Le chemin est le **motif de route**
   (`/offres/[identifiant]`), pas l'adresse concrète — sinon la fiche ouverte avec
   un identifiant en minuscules reste en cache périmé.
9. ⚠️ **Le vide d'un champ à enregistrement automatique est `"   \n"`, pas `""`.**
   `normaliserNote()` (`interface/lib/notes.ts`) le ramène à `NULL` avant d'écrire,
   sinon la contrainte `note_personnelle_non_vide` rend 400 sur le geste le plus
   banal — effacer. ⚠️ Corollaire : **le contrôle du code est plus strict que celui
   de la base dans les deux sens** (`trim()` > `~ '[^[:space:]]'`, et
   `String.length` en UTF-16 ≥ `length()` en points de code). C'est le seul sens qui
   évite un 400 que rien n'annoncerait.

## ⚠️ Cinq pièges de MÉTHODE, qui valent au-delà de leur cas

1. **Un maximum observé n'est pas une borne, c'est un échantillon** — et il ne peut
   que monter. Quatre mesures concordantes ont fait écrire que « l'intitulé très
   long n'existe pas » (94 caractères au maximum) ; la cinquième en a trouvé un de
   **223**. Ne jamais écrire qu'un cas « n'existe pas » sur la foi d'un maximum ;
   écrire ce qu'on a vu, avec la taille de l'échantillon et la date.
2. **Un test qui re-résout son sélecteur à chaque clic ne teste pas un double
   clic** — il attend sagement que l'interface se stabilise, c'est-à-dire exactement
   ce que l'utilisateur ne fait pas. **Pour éprouver une cible mouvante, cliquer à
   des coordonnées fixes** (`page.mouse.click(x, y)`).
3. **La fin d'une action serveur n'est PAS la fin du re-rendu.** Mesuré : réponse à
   +80 ms, réorganisation de la liste à +900 ms. Un verrou relâché dans un `finally`
   tient donc **30 ms pour un défaut qui survient à 900**. La bonne borne est
   `enCours` de `useTransition`, vrai jusqu'à ce que le rendu soit **appliqué au
   DOM**.
4. **« J'ai mesuré » ne vaut rien si on ne dit pas QUEL chemin on a mesuré.** Revenir
   sur une fiche par un lien et y revenir par le bouton retour sont deux gestes que
   l'utilisateur ne distingue pas et deux mécanismes différents : le premier montrait
   la note, le second rendait le champ vide. J'avais conclu « pas besoin de
   `revalidatePath` » sur la foi du premier ; `/code-review` a maintenu le constat et
   la seconde mesure lui a donné raison.
5. **Une section ajoutée à un écran doit être ajoutée à son squelette dans le même
   geste.** `loading.tsx` n'a aucun lien mécanique avec la page qu'il double : rien
   ne signale l'oubli, et le défaut est **invisible en développement**, où le serveur
   répond en 80 ms et où le squelette ne s'affiche jamais assez longtemps pour être
   vu. Trois sauts déjà — 297 px, 93 px, 222 px. Le calage se vérifie **par le
   calcul** (les hauteurs y sont fixes) contre la section réelle mesurée au DOM.

## Collecte — cinq faits mesurés, opposables

Mesurés contre l'API réelle, remesurés et corrigés le 26 puis le 28 août 2026.
Méthode et détail dans `docs/API_FRANCE_TRAVAIL.md`. **Ne pas les redécouvrir, ne
pas les contredire de mémoire.**

1. ⚠️ **Le moteur ne fait PAS de correspondance textuelle, il élargit au
   domaine.** Sur 40 offres rendues par `intelligence artificielle`, **26 ne
   contiennent le terme nulle part** — ni dans l'intitulé, ni dans la description,
   ni ailleurs dans la charge brute. Et il n'est pas compositionnel :
   `intelligence artificielle` rend 168 offres, `intelligence` 64, `artificielle`
   43, leur union **64**.
   **Trois conséquences** : un terme ramène des offres qui ne le contiennent pas ·
   chercher `X Y` ne se prédit pas en mesurant `X` et `Y` · donc **un critère se
   mesure, jamais ne se déduit** — parce que l'index est *opaque*, pas parce qu'il
   est étroit.
   ⚠️ **Corollaire coûteux** : un terme générique ratisse un domaine entier —
   `agents` rend **2 718 offres/mois** (agent d'accueil, agent de sécurité). Et une
   offre au titre banal peut échapper à toute liste de mots-clés.
2. ⚠️ **Le vocabulaire n'est ni fermé ni français.** `AI` en anglais ramène 28
   offres nettes par mois qu'aucun autre critère ne trouvait. Ce qui reste vrai :
   les expressions à plusieurs mots sont dangereuses — `avant-vente` ramène 299
   postes de vendeur, le moteur ayant matché « vente ».
3. ⚠️ **Les codes ROME ne rattrapent PAS ce que le lexique rate.** Le raisonnement
   était juste, la mesure l'a démenti : 445 offres nettes par mois pour **zéro
   offre au-dessus de 30 sur 50 notées au hasard**. Tous retirés. Le fichier reste
   **vide et valide**, avec la mesure qui l'a vidé.
   ⚠️ Corollaire non évident : **un code ROME dont le libellé contient un mot déjà
   cherché n'apporte rien** — `M1889` « Ingénieur en Intelligence Artificielle » a
   la meilleure qualité mesurée de tous les codes et un apport net de **zéro**.
4. ⚠️ **Un critère ne s'ajoute jamais sans mesurer ce qu'il ramène.** Mesurer veut
   dire **deux choses** : le volume *net* (ce que les autres critères ne trouvent
   pas déjà) **et** la qualité, en notant un échantillon **tiré au hasard**
   (`--au-hasard`). Prendre les N plus récentes n'est pas un échantillon : elles
   viennent d'une seule journée.
5. ⚠️ **SEUL LE CDI EST COLLECTÉ depuis le 28 août 2026** — `TYPE_CONTRAT` dans
   `pipeline/config.py`, filtré **côté serveur**. Écarte 22 % du volume. Décidé par
   Maxime, **qui a vu et accepté le coût** : 11 des 20 meilleures offres notées
   auraient été écartées. Ne pas rouvrir.
   ⚠️ **Ce filtre est IRRÉVERSIBLE POUR LE PASSÉ, et sa perte est silencieuse.**
   France Travail dépublie : le remettre à `None` rouvre l'avenir, jamais les
   semaines écoulées, et **rien en base ne témoigne de ce qui n'a pas été
   collecté**.
   ⚠️ **`typeContrat` est la SEULE métadonnée sûre à filtrer** : renseignée sur
   560 offres sur 560. `qualification` est vide sur 86 des 123 offres notées, et 11
   des 20 meilleures sont dans ce trou. Avec `experience_libelle` (faux une fois
   sur deux), c'est **l'argument central du projet : les métadonnées France Travail
   sont trop lacunaires pour trier, d'où un modèle qui lit le texte.**

⚠️ **Les critères eux-mêmes sont des DONNÉES, et leurs mesures vivent avec eux** —
`pipeline/mots_cles.txt` (7 termes) et `pipeline/codes_rome.txt` (vide). **Ne jamais
les éditer sans relire leurs commentaires** : ils portent, terme par terme, ce qui a
été mesuré et écarté, et le piège qui compte le plus — **l'apport net n'est pas une
propriété du terme, mais du couple (terme, configuration)**, donc tout retrait de la
liste périme les mesures précédentes.
⚠️ **Un TROISIÈME critère existe et n'est pas un `.txt` : `TYPE_CONTRAT` dans
`pipeline/config.py`.** Chercher les critères dans les seuls fichiers texte fait
manquer celui qui coupe le plus.

**Les postes visés** sont ceux qui *branchent* un modèle chez un client — Forward
Deployed Engineer, AI Solutions Engineer, consultant IA, ingénieur d'intégration.
**Pas** les postes de modélisation (`machine learning`, `data scientist`, `deep
learning`) : autre métier, autres entreprises. Corrigé par Maxime le 21 août.

✅ **Question CLOSE le 26 août : c'est Sonnet 5, et Opus 5 ne sera pas testé.**
Retenir le motif plutôt que la conclusion : le prompt est calibré, les notations
produites sont conformes, et l'écart de coût (~2,30 $/mois) ne justifie pas de
repayer 97 offres pour arbitrer un doute que personne n'a. **Une question ouverte
peut être fermée en constatant qu'elle ne décide plus rien.** Ne pas la rouvrir.

## Base de données

**Source de vérité du schéma : `supabase/migrations/`**, abondamment commenté.
**Ne jamais recopier le schéma ailleurs** : deux descriptions du même schéma
divergent toujours.

⚠️ **Une migration déjà appliquée ne se modifie jamais.** Elle est dans la base :
la réécrire ne défait rien et fait diverger git de la réalité. On corrige par une
migration suivante. C'est arrivé le 20 août.

⚠️ **Syntaxe valide ne veut pas dire « ça marche ».** Le 20 août, une migration
irréprochable a créé deux tables que le serveur ne pouvait pas lire. **Après chaque
migration : tenter de lire, d'écrire, et de violer chaque contrainte.** Procédure
complète dans `docs/HEBERGEMENT.md`.

**Deux tables sur quatre existent** : `executions_veille`, `offres`.
`enrichissements` et `etapes_enrichissement` sont **reportées à la phase 6** —
entorse assumée, validée en séance : leur forme dépend de ce que l'agent produira,
et rien ne les alimente d'ici là.

**Huit règles opposables, toutes déjà appliquées :**

1. **`timestamptz` partout, jamais `timestamp`.** GitHub Actions tourne en UTC, le
   navigateur est à Paris : sans fuseau, une collecte de 4 h s'affiche « 02:00 ».
2. **Ce qui se calcule ne se stocke pas.** Pas de colonne `duree`, pas de date de
   collecte sur l'offre (le lien vers l'exécution la porte).
3. **`NULL` ≠ `false`.** `NULL` = « non renseigné », `false` = « renseigné à non ».
   Un `default false` sur un champ souvent absent fabrique de la donnée qui n'existe
   pas.
4. **La ligne d'`executions_veille` s'écrit au démarrage** (`issue = 'en_cours'`),
   se complète à la fin. Une ligne restée `en_cours` est une exécution tuée net : le
   pipeline les referme en `echec` à son démarrage suivant, et **un `en_cours` ne
   compte jamais comme une réussite** côté interface.
5. **`offres.charge_brute` est une archive, jamais lue pour afficher.** Elle existe
   parce que France Travail dépublie. Les colonnes extraites sont les seules valeurs
   de travail.
6. **`contact_nom` et `contact_url_postulation` sont en colonnes nommées**, jamais
   dans `charge_brute` — pour rester repérables et supprimables. Tout le reste du
   champ `contact` est **écarté à la collecte**, avant écriture.
7. ⚠️ **`executions_veille.etape` n'est pas du rangement, c'est un correctif de
   bug.** Sans le filtre `etape = 'collecte'`, une notation réussie à 14 h ferait
   repartir la collecte de la nuit suivante de 14 h au lieu de la veille : **les
   offres publiées entre les deux seraient perdues, sans la moindre erreur** — ni
   exception, ni job rouge.
8. **`NULL` sur une note veut dire « pas encore notée », jamais « zéro ».** Trois
   contraintes rendent physiquement impossible d'écrire une note sans sa
   justification — le plancher d'accessibilité interdit qu'une information tienne
   sur la seule couleur, et une règle gravée dans le moteur vaut mieux qu'une
   discipline de code. `notation_tentatives` borne la facturation : sans compteur,
   une offre qui fait systématiquement échouer l'appel serait retentée chaque nuit,
   payante à chaque fois.

**Autorisation — deux verrous indépendants, vérifiés** : RLS activé sans aucune
politique, *et* tous droits retirés à `anon` et `authenticated`. Une politique
ajoutée par erreur n'ouvrirait donc toujours rien. Seul `service_role` (la clé
`sb_secret_…`) a des droits.
**La colonne qui dit à qui la donnée appartient : aucune, délibérément** — un seul
utilisateur, une seule porte ; une telle colonne porterait la même valeur partout et
donnerait l'illusion d'un contrôle.

## Stack

Tranchée le 16 août 2026. Justifications dans `docs/DECISIONS.md` § 3.

- **Python 3.11+** pour le pipeline, environnement virtuel dédié.
- **Supabase** (Postgres hébergé). **Pas SQLite** : une interface hébergée ne peut
  pas lire un fichier posé sur le Mac de Maxime.
- **Next.js 16 + shadcn/ui sur Vercel** pour l'interface. ⚠️ Next 16 a renommé
  `middleware.ts` en `proxy.ts` (et `config` en `proxyConfig`) : **avant d'écrire du
  Next.js, s'appuyer sur la skill `next-best-practices`** plutôt que sur des
  réflexes de Next 14.
- **GitHub Actions** (cron) pour le déclenchement quotidien — 6 h par exécution
  contre 300 s chez Vercel, gratuit sur dépôt public, et le workflow est versionné
  donc visible d'un recruteur.
  ⚠️ **Ne pas justifier ce choix par « Vercel ne fait pas de Python » : c'est
  faux.** Vercel exécute du Python et propose des sandboxes conçus pour les agents.
  Ce qu'on laisse sur la table, c'est la latence au clic sur « Enrichir » — un
  arbitrage assumé, pas une impossibilité technique.
- **API France Travail** Offres d'emploi v2 · **`claude-sonnet-5`** pour la notation
  (cache de prompt + Batches) · **Claude Agent SDK** pour l'enrichissement.

**Routes** : `/` le compte rendu de la nuit · `/offres` le poste de travail (filtre
de statut dans l'adresse) · `/offres/[identifiant]` la fiche · `/connexion` la
porte. L'identifiant est celui de France Travail, **validé avant d'atteindre la
base**.

**Enrichissement** : **exclusivement manuel** — rien ne s'enrichit sans un clic.
⚠️ **REFUSÉ et non « reporté » depuis le 30 août 2026** : l'enrichissement
automatique était en évolution prévue avec une condition de retour qui se
remplissait d'elle-même (seuils calibrés + coût mesuré, deux chiffres que la v1
produit). Maxime l'a fait passer en **hors périmètre opposable**, condition
supprimée. Ni « la meilleure offre chaque jour », ni « deux par nuit », ni aucune
règle de sélection : **le déclencheur est la lecture d'une offre qui accroche, et
ça ne se devine pas.** ⚠️ La colonne `declenchement` reste quand même sur la
trace — elle sert à l'écran de suivi, pas à préparer un retour.
Une **enveloppe quotidienne de 300 000 tokens** borne la dépense : fichier de
configuration versionné, **vérifiée côté serveur**, calculée en sommant les traces
du jour et non dans un compteur qui divergerait. **La notation nocturne n'y entre
pas** — la borner ferait rater des offres un matin de forte collecte.

## Commandes

Le `python3` par défaut de cette machine est celui d'Anaconda (`/opt/anaconda3`).
**Ne pas installer les dépendances du projet dedans.**

```bash
python3 -m venv .venv          # une seule fois
source .venv/bin/activate      # à chaque nouvelle session de terminal
pip install -r requirements.txt
which python                   # doit afficher .../veille-offres-emploi-ia/.venv/bin/python
```

```bash
# Interface — depuis interface/
npm run verifie      # lint + typecheck + les 93 tests, DANS LES DEUX FUSEAUX
```

⚠️ **`verifie` lance la suite deux fois, et la seconde est celle qui compte** :
`TZ=UTC` reproduit le fuseau de Vercel. Un calcul de date faux en production passe
sans broncher sur un Mac à l'heure de Paris — c'est arrivé le 29 août 2026. **Ne
jamais retirer le second passage** en le prenant pour un doublon.

```bash
python -m pipeline.collecte                   # fenêtre automatique depuis la dernière réussite
python -m pipeline.collecte --sans-ecrire     # tout sauf l'écriture
python -m pipeline.collecte --depuis-jours 7  # remplissage manuel

python -m pipeline.notation --sans-appeler --limite 1   # GRATUIT : affiche le prompt, compte les tokens
python -m pipeline.notation --derniere-collecte         # LE MODE DU CRON
python -m pipeline.notation --lot                       # via l'API Batches : moitié prix
python -m pipeline.notation --sans-ecrire --limite 1    # appelle le modèle, n'écrit rien
```

Code de sortie **0** = réussite, **1** = échec — c'est lui qui fait rougir le job
GitHub Actions. La trace part en base dans `executions_veille`, dans les deux cas.

⚠️ **Tout ce qui n'est pas `--sans-appeler` est FACTURÉ. Prévenir Maxime avant,
toujours**, avec le nombre d'appels et l'ordre de grandeur (~0,6 centime par offre,
cache chaud). `models.list()` et `count_tokens()` sont gratuits.

**Trois drapeaux portent une leçon** — liste complète dans `--help` :

- ⚠️ **`--au-hasard`** tire l'échantillon au sort au lieu de prendre les plus
  récentes. Sans lui, une « mesure » porte sur une seule journée de collecte.
- ⚠️ **`--derniere-collecte`** restreint la notation aux offres de la dernière
  collecte réussie : c'est lui qui borne la dépense à ce qui vient d'arriver. Il
  résout l'identifiant **par la base**, jamais par un canal GitHub Actions, donc les
  deux étapes restent lançables séparément et dans n'importe quel ordre.
- ⚠️ **`--renoter` est MIS DE CÔTÉ depuis le 26 août** : il a servi à régler
  `criteres_pertinence.txt` en itérant sur les mêmes offres, ce travail est fait, et
  une offre n'est désormais notée **qu'une seule fois**. Il porte un bug connu, dont
  l'analyse est en commentaire dans `pipeline/notation.py` au-dessus de
  `apercevoir()` — c'est-à-dire là où on tombera dessus.

**La recette de mesure d'un critère**, celle qui a fait tomber les codes ROME :
volume brut contre l'API (gratuit) → **volume NET** (ce que les autres critères ne
trouvent pas déjà ; un critère à fort volume et apport net nul est inutile) →
collecte, puis `--au-hasard` sur un échantillon, puis lecture des notes. **Le volume
ne dit rien de la qualité.**

## Sécurité — non négociable

Les clés de ce projet donnent accès à un compte facturé et à une base de données.

1. **Aucune clé en clair dans le code, jamais.** Les secrets vivent dans `.env`, lu
   via `os.environ`, exclu par le `.gitignore` — vérifier `git status` avant chaque
   commit ; si `.env` y apparaît, s'arrêter.
2. **Aucune clé dans la conversation, les logs ou un message d'erreur.**
   ⚠️ **Y compris par la sélection dans l'éditeur.** Quand un fichier est ouvert
   dans l'IDE, **le texte sélectionné m'est transmis automatiquement** ; le 21 août,
   une sélection dans `interface/.env.local` a fait entrer `MOT_DE_PASSE_SITE` dans
   la conversation. Ce n'est pas une inattention, c'est le fonctionnement normal de
   l'intégration — donc la parade est une habitude : **ne jamais demander à Maxime
   d'ouvrir un fichier de secrets, ni de recopier une valeur.** Quand il lui en faut
   une, la déposer dans son presse-papiers
   (`grep '^NOM=' fichier | cut -d= -f2- | tr -d '\n' | pbcopy`).
3. **Le dépôt est public.** Des robots scannent GitHub en continu et exploitent les
   clés commitées en minutes. Une clé poussée par erreur reste dans l'historique Git
   après suppression du fichier : la **révoquer**, pas seulement la supprimer.
4. **La clé secrète Supabase (`sb_secret_…`) contourne *toutes* les règles de
   sécurité** — jamais dans une variable `NEXT_PUBLIC_*`, jamais dans un composant
   client, jamais commitée. **Le navigateur ne parle jamais directement à Supabase.**
5. ⚠️ **Aucune variable `NEXT_PUBLIC_` sur ce projet** : ce préfixe publie la valeur
   dans le code source de la page sans le moindre message d'erreur.
6. **Chez Vercel, exactement 5 variables** : `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
   `MOT_DE_PASSE_SITE`, `SECRET_SESSION`, et **`JETON_GITHUB` depuis le 30 août
   2026**. Ni la clé Anthropic ni les identifiants France Travail — le pipeline
   tourne chez GitHub Actions, et les garder offrirait une clé facturée à qui
   entrerait dans le compte.
   ⚠️ **`JETON_GITHUB` sert à lancer le workflow d'enrichissement** au clic
   (`interface/lib/github.ts`). Il doit être **à portée fine (*fine-grained*),
   limité à ce seul dépôt, avec la seule permission « Actions : write »** — un
   jeton classique donnerait le droit de pousser du code sur un dépôt public qui
   sert de pièce à conviction en entretien. S'il fuitait, on pourrait lancer en
   boucle le workflow qui détient la clé Anthropic.
   ⚠️ **Son expiration est une panne parfaitement silencieuse** : le site
   marche, la veille tourne, et seul le bouton « Enrichir » cesse d'agir. C'est
   pourquoi l'échec est distingué par son code HTTP et remonté en clair à
   l'écran — 401 dit « le jeton n'est plus valide », pas « réessayez ».
7. **`interface/.env.local` détient l'unique copie des deux secrets du site**, non
   versionné, nulle part ailleurs. ⚠️ **Un agent de revue qui lance l'app écrit dans
   ce fichier** — c'est arrivé le 21 août, les secrets ont dû être régénérés.
8. ⚠️ **Pour regarder l'app sans jamais lire le mot de passe réel** : relancer le
   serveur avec `MOT_DE_PASSE_SITE='une-valeur-de-test' npm run dev`. Next.js ne
   remplace **jamais** une variable déjà présente dans l'environnement, donc la
   valeur de test l'emporte sur `.env.local` **sans y toucher** — vérifié par
   empreinte MD5 avant et après.

**Quatre règles d'accès, posées le 21 août :**

- **Toute page et toute action serveur appelle `exigerSession()`
  (`interface/lib/acces.ts`) en première ligne** — seule exception, `connecter()`
  qui *est* la porte. Le proxy est la commodité, `exigerSession()` est la serrure.
  ⚠️ **La raison la plus concrète n'est pas la CVE-2025-29927** : une action serveur
  s'invoque par un `POST` avec en-tête `Next-Action` sur une route, et `/connexion`
  est la seule que le proxy laisse passer sans cookie. Une action déclarée là
  s'exécuterait sans session, **sans rien contourner**.
- **Ne jamais ajouter de `matcher` à `proxy.ts`.** Il protège *tout* par défaut ;
  les trois exceptions sont dans le code. Un matcher rouvrirait la question à chaque
  adresse ajoutée.
- **Un `POST` d'action serveur ne se redirige jamais** : le proxy lui répond
  **401**. Redirigé, le navigateur suit jusqu'à `/connexion`, reçoit un corps vide,
  et le bouton cliqué ne fait *rien du tout* — sans erreur ni renvoi vers la porte.
  Cas réel : session expirée la nuit, onglet resté ouvert.
- **`import "server-only"` en tête de tout module qui lit un secret.** Sans lui, un
  composant client peut l'importer et tirer `node:crypto` dans le graphe du
  navigateur ; la panne est alors incompréhensible.

**Données personnelles : périmètre restreint et explicite.** Les offres sont
publiques ; les coordonnées qu'elles contiennent parfois ne le sont pas au sens du
RGPD. **Deux champs seulement sont conservés**, parce qu'ils servent directement à
candidater : `contact.nom` et `contact.urlPostulation`. Adresses postales,
courriels et tout autre élément d'identification sont **écartés à la collecte, avant
écriture** — jamais filtrés à l'affichage : filtré à l'affichage, un champ est quand
même en base et dans les journaux.
⚠️ **Tranché sur mesure, pas sur intuition** : sur 235 offres réelles,
`contact.courriel` ne contient **aucune adresse**, `contact.nom` est présent sur 9 %
des offres et ne nomme une personne que dans 3 % des cas.
⚠️ **Ils s'affichent sur la fiche depuis le 28 août** — décision de Maxime : le site
est derrière son mot de passe et n'a qu'un utilisateur. **Le reste tient** : jamais
dans un journal — ceux de GitHub Actions sont **publics** — ni dans un export, ni
dans la liste `/offres`. **Les notes personnelles de Maxime relèvent de la même
règle.**

Si un secret a déjà été commité : le révoquer côté France Travail / Anthropic /
Supabase **avant** de nettoyer l'historique. Le nettoyage seul ne protège rien.

## La partie IA — la frontière est la décision centrale

**Décision de Maxime (15 août 2026) : le Claude Agent SDK est retenu, et l'objectif
d'apprentissage prime.** Ne pas rouvrir.

Les deux outils coexistent, et les confondre est l'erreur à ne pas commettre :

| | Ce que c'est | Ce qu'il fait ici |
|---|---|---|
| `claude-agent-sdk` | Claude Code en bibliothèque : boucle d'agent, outils, MCP, sous-agents, permissions | L'enrichissement : une tâche ouverte et multi-étapes |
| `anthropic` (API Messages) | Un appel, une réponse structurée | La notation en volume : une offre → deux notes |

**Le placement de cette frontière est l'argument d'entretien le plus fort du
projet.** Un agent posé sur une classification — une entrée, une sortie, aucune
exploration — est plus lent, plus cher et non déterministe pour aucun gain, et un
lead technique qui connaît le SDK le verra. Un agent posé sur une tâche ouverte —
chercher l'entreprise, lire son site, croiser, rédiger une fiche — est exactement ce
pour quoi le SDK existe.

⚠️ **Avant d'écrire du code Agent SDK, lire la documentation officielle**
(`code.claude.com/docs/en/agent-sdk`). La référence `/claude-api` couvre l'API
Messages et les Managed Agents — **pas** le Agent SDK.
⚠️ **Avant d'écrire du code appelant l'API Anthropic, charger `/claude-api`.** Les
identifiants de modèles changent ; un identifiant inventé renvoie une 404.
⚠️ **Mesure à retenir sur les Batches** : `cache_lecture` = 7 430 sur un lot de 3
offres, contre **zéro** sur un lot d'une seule — les Batches ne sont rentables qu'à
plusieurs, sinon on paie l'écriture du cache sans jamais le relire.

## Design

⚠️ **REFONDU le 29 août 2026 : le système est désormais
[1st-Pouf](https://1st-pouf.worksonmy.dev), pastel et volumétrique.** L'ancien
système éditorial (beige papier, Fraunces, Geist, aucune ombre) n'existe plus.
Validé par Maxime devant l'écran, après construction réelle de `/offres`.

**Ce qu'on retient** : un instrument de décision, pas un tableau de bord. On voit
tout de suite quoi lire en premier, et pourquoi. **Direction** : pastel
volumétrique — surfaces blanches arrondies sur fond lavande, relief « coussin »,
six accents pastel qui portent **toujours de l'encre foncée, jamais du blanc**.

**Polices** : titrage **Fredoka 700** (les `h1` seulement) · texte et interface
**Nunito** · données et étiquettes **Geist Mono**. Les trois par `next/font`.
⚠️ **Fredoka n'est PAS livrée par le registre** — sans chargement explicite les
titres retombent sur Nunito, sans erreur. ⚠️ **Geist Mono survit à la refonte** :
sans chasse fixe, la colonne des salaires ondule sur 200 lignes.
**Icônes** : **lucide**, figé à l'installation. **Ne jamais en mélanger un
second.** ⚠️ Le composant `Icon` du registre tire `@tabler/icons-react` : ne pas
l'installer.
**Jetons** : `interface/app/globals.css` est la source de vérité. Jamais de couleur
en dur, toujours les jetons sémantiques.

⚠️ **`globals.css` est un DICTIONNAIRE, et c'est la décision d'architecture à
comprendre avant d'y toucher.** Le système vient de `components/pouf/pouf.css`,
mais l'application continue de parler shadcn (`bg-card`, `text-muted-foreground`).
Un jeton nomme un **rôle**, jamais une couleur : `bg-card` ne veut plus dire
« beige papier » mais « la surface du système en cours ».

**Six teintes de signal, un rôle chacune** : bleu = note d'intérêt · menthe =
accessibilité et candidaté · rose pastel = écarté · jaune/ocre = le temporel
(« nouveau », état de la veille) · **pêche = coup de cœur** · rose foncé =
erreur. **Une teinte qui sert à deux choses ne sert plus à rien.**
⚠️ **Depuis le 30 août 2026 il ne reste AUCUN accent libre** : un septième signal
devra réutiliser une teinte en la distinguant par la forme, ou rouvrir la palette
— décision de système, pas détail d'écran.
⚠️ **Les pilules de filtre de `/offres` reprennent ces teintes**, chacune pour ce
qu'elle filtre — c'est le revirement du 29 août, § État. Le déclencheur « Trier »
prend le bleu parce que le classement par défaut EST l'intérêt : ce n'est pas un
sixième rôle, c'est un contrôle.
⚠️ **`--ecarte` (rose pastel) et `--destructive` (rose foncé) ne sont PAS un
doublon** : le second est du texte d'erreur, donc 4,5:1 obligatoire ; le premier
est un fond de bouton sous de l'encre foncée.

⚠️ **L'état ENGAGÉ passe par des jetons `--*-engage`, en mode CLAIR seulement.**
Corrigé le 30 août 2026 : la saturation seule ne distinguait rien — écart de
clarté de **0,8 sur le jaune et 1,5 sur la menthe**, là où il en faut ~10.
⚠️ **Et atténuer davantage le repos ne pouvait PAS marcher** : sur fond clair
atténuer *éclaircit*, et ces deux pastels sont déjà presque blancs. La seule
direction libre est vers le bas. ⚠️⚠️ **En sombre, `--*-engage` vaut le pastel
nu — ne pas « nettoyer » ces cinq lignes** : l'écart y était déjà de 12-15 points
et les teintes assombries le ramèneraient sous 1.
⚠️ **Et l'option NON RETENUE d'une offre décidée se décolore** — mais **seulement
si une décision existe** : sans cette condition, la liste « À traiter » (576 sur
580) perdait toute couleur.
⚠️ **La teinte assombrie n'a pas suffi : l'engagée porte AUSSI un contour**, seul
signal de la rangée qui ne dépende d'aucune couleur — un écart de clarté est
*relatif*, et six teintes différentes obligent à comparer. ⚠️ **`border-current`
et jamais `border-foreground`** : l'encre de page est claire en sombre et tombait
à **1,52:1** sur un pastel clair. ⚠️ **Bordure de 2 px sur les SIX pilules**
(transparente au repos) **et sur le menu « Trier »**, sinon la rangée se décale ou
se désaligne.

⚠️ **Trois pièges MESURÉS, qui ne se voient dans aucune erreur** (détail dans
`docs/DESIGN.md`) :

1. **`--muted` veut dire deux choses opposées** — surface chez shadcn, couleur de
   texte chez pouf. L'écraser rendait les cartouches **vides** et les
   justifications illisibles. La surface s'appelle `--surface-muted`.
2. ⚠️ **`ring` et `cushion` sont incompatibles** : les `cushion-*` posent un
   `box-shadow` brut, les `ring-*` de Tailwind passent par la même propriété. Le
   coussin gagne et **l'anneau de focus disparaît du style calculé**. **Sur tout
   élément à coussin, le focus passe par `outline`** — et jamais `outline-none`,
   qui neutralise le repli global de `pouf.css`.
3. **Les pastels sont invisibles comme objets graphiques en mode clair** :
   1,06 à 1,99:1 contre 3:1 requis. D'où **deux jetons par note** — la variante
   nue pour les fonds de pastille, la variante `-barre` (assombrie) pour les
   jauges. En mode sombre ils passent nus, le problème est propre au clair.

⚠️ **`components/pouf/pouf.css` est ADAPTÉ**, donc non remplaçable par un
`shadcn add` qui l'écraserait. Quatre adaptations signalées sur place par
« ADAPTÉ (projet) ».

⚠️ **Le libellé devant chaque barre de note ne se retire jamais**, même pour gagner
de la place : sans lui l'information tient sur la seule couleur. En toutes lettres —
**« Intérêt » et « Accessibilité »**. ⚠️ « intérêt », jamais « intéressement » : à
côté d'un salaire, le second se lit comme une prime de participation.

**Interdits** : Inter, Roboto, Poppins, Montserrat, Space Grotesk · dégradés ·
trois colonnes d'icônes dans des ronds colorés · tout centré · `system-ui` en
titrage · **du texte blanc sur un accent pastel** (le système impose l'encre
foncée, et le blanc y échoue à 1,25:1).

**Plancher d'accessibilité, opposable** : texte 4,5:1 · interface 3:1 · focus
clavier toujours visible · mouvement coupé sous `prefers-reduced-motion` · jamais
l'information par la seule couleur. Un choix qui casse ça est un défaut, pas un
parti pris. **Recalculer les contrastes à chaque changement de couleur.**

**Mise en page figée le 26 août** : `--largeur-page: 1000px`. Le seuil n'est pas un
arrondi : en dessous, les offres **qui affichent un salaire** cassent sur deux
lignes.
⚠️ **La fiche est en COLONNE UNIQUE, et la question se rouvre en phase 6.** Le
`DESIGN.md` prévoyait deux colonnes, la droite portant l'enrichissement — qui
n'existe pas avant la phase 6. Ne pas y repasser tant qu'il n'y a rien à mettre à
droite.

⚠️ **Le contenu de test est du contenu RÉEL, en base — à utiliser plutôt qu'à
réinventer** : `docs/PLAN.md` § Contenu de test. **Un fait à ne pas redécouvrir** :
le vide est le cas normal (36 % sans entreprise, 65 % sans salaire, mais le lieu
toujours renseigné).

**Détail et justifications** : `docs/DESIGN.md`.

## Convention de travail

- Français partout : messages de commit, docstrings, noms de variables métier
  (`offres_pertinentes`, pas `relevant_offers`).
- Un module = une responsabilité. Pas de `main.py` de 400 lignes.
- Toute fonction qui appelle le réseau gère explicitement l'échec. Pas de
  `try/except` nu qui avale l'erreur.

### Capitaliser les notions apprises

Quand Maxime demande de noter une notion comprise en séance, elle va dans
**`~/Documents/Coffre Obsidian/Maxime M/Apprentissage/`**, **dans le sous-dossier du
sujet** (lister le dossier avant d'écrire). Pas dans `docs/` : `docs/` porte le
projet, ce dossier porte le savoir transférable.

**Une notion = un fichier.** Ne jamais grouper deux sujets parce qu'ils sont tombés
dans la même conversation : ils ne se relisent pas au même moment. **Concises**, il
en aura beaucoup. Frontmatter `title` / `tags` / `aliases` · un callout
`> [!tip] En une phrase` en tête · tableaux et blocs de code plutôt que des
paragraphes · un `> [!danger] Le piège` à la fin · wikilinks vers les autres notes.
**Les tags portent ce que les dossiers ne peuvent pas** — la sécurité traverse la
base, le serveur et le navigateur.

La version *projet* de la même notion reste dans `docs/DECISIONS.md`.

### Répartition du travail — tranché le 20 août 2026

Maxime **n'écrit pas le code**, et c'est une position argumentée : écrire est
dévalué puisque l'IA écrit, ce qui compte est de savoir **que ça existe, à quoi ça
sert et comment ça casse**, pour localiser une panne et savoir quoi demander.

Ce que ça m'impose, et qui n'est pas négociable :

1. **Une note de diagnostic à la fin de chaque phase**, dans `Apprentissage/`. Pas
   une explication ligne par ligne — il ne la rouvrirait jamais. Les quelques
   **formes** de code que le projet utilise vraiment · **la phrase française** que
   chacune dit · **comment chacune casse** · **le symptôme à l'écran**.
2. **Trois questions à la fin de chaque module.** S'il bloque sur une, la lecture
   manque là, et il faut le savoir avant l'entretien.
3. ⚠️ **Écrire est dévalué, lire ne l'est pas** — c'est *plus* important qu'avant,
   puisqu'il produit dix fois plus de code. Une lecture d'un module à voix haute par
   phase.
4. ⚠️ **Ne jamais annoncer qu'une chose marche sans l'avoir lancée.** Son seul
   garde-fou est de pouvoir demander « tu l'as lancé, ou tu l'as juste relu ? ». Le
   20 août, une migration validée par l'analyseur officiel de PostgreSQL a créé deux
   tables illisibles par le serveur : le défaut n'est apparu qu'en essayant d'écrire.
