# Journal de bord

Ce qui s'est passé, dans l'ordre, avec les décisions prises en chemin. Le
`CLAUDE.md` ne garde que l'état courant et ce qui commande le comportement :
tout l'historique est ici.

---

## 31 août 2026 (nuit, suite) — L'en-tête flottante et la corbeille

Deux demandes de Maxime dans le même message : reprendre l'en-tête sur le gabarit
1st-Pouf, et pouvoir retirer une offre de l'affichage.

### L'installation du gabarit a failli coûter cher

`npx shadcn add …/landing.json` fait trois choses qu'il ne fallait pas laisser passer :

1. **Il propose d'écraser `components/pouf/pouf.css`**, qui porte **cinq adaptations**
   marquées « ADAPTÉ (projet) ». Le `CLAUDE.md` l'annonçait ; répondu **non**, fichier
   vérifié intact après coup.
2. **Il installe `@tabler/icons-react`** — que le `CLAUDE.md` interdit en toutes
   lettres : le projet est en **lucide**, et « ne jamais mélanger un second jeu ».
3. **Il installe `@fontsource-variable/nunito`**, doublon de `next/font`.

Les douze fichiers installés ont été retirés et les deux dépendances désinstallées ;
seule `navbar.tsx` a servi de **référence de style**, recopiée dans le langage du
projet — jetons shadcn (`bg-card`, `text-foreground`) plutôt que jetons pouf bruts,
`next/link` plutôt que `<a href>`, lucide plutôt que tabler.

### L'en-tête, en trois passes devant l'écran

Barre blanche arrondie flottant sur le lavande, sans logo — le produit n'a pas de nom,
et le gabarit d'origine mettait là un mot-symbole. « Veille offres emploi IA » devient
**« Accueil »**, un onglet comme un autre : au passage, on voit enfin où l'on est, ce
que le titre cliquable ne disait pas.

Trois corrections après l'avoir regardée :

- **« Se déconnecter » débordait du coussin à 375 px**, texte coupé net par l'arrondi.
  Le libellé est d'abord passé en `hidden sm:inline`. ⚠️ **Puis Maxime l'a fait retirer
  partout, y compris en bureau** : en mono majuscules, il pesait plus lourd que les deux
  onglets réunis et donnait à la sortie le poids visuel d'une destination. Le bouton
  devient une **icône ronde jumelle de celle du thème** — mesuré, les deux font
  exactement 34 × 34 px — et le mot passe dans `aria-label` + `title`. La barre tombe de
  ~410 px à **278 px**.
  ⚠️ **`<Button>` de shadcn a été abandonné ici** : sa variante `ghost` est
  rectangulaire et son `size="sm"` impose une hauteur qui ne cadre pas avec le rond
  voisin. Deux boutons de formes différentes côte à côte se lisent comme deux natures
  différentes.
  ⚠️ **Le cycle complet a été rejoué après ce changement de balise** — déconnexion,
  arrivée sur `/connexion`, reconnexion : un `<button type="submit">` natif soumet bien
  le `<form action={…}>`, et la propriété « ça marche sans JavaScript » est préservée.
- **L'onglet actif a d'abord reçu un contour**, sur le patron des pilules de `/offres`,
  parce que le lavande nu pèse **1,99:1** contre la barre blanche. ⚠️ **Maxime l'a fait
  retirer après l'avoir vu** : deux onglets ne se comparent pas comme six pilules. Ce
  que ça coûte est mesuré et assumé — **2,62:1** pour la pastille, sous les 3:1 d'un
  élément d'interface ; le texte passe (4,64 clair, 7,51 sombre) et `aria-current`
  porte l'information.
- **La barre était trop large** : `w-fit` puis `mx-auto`. Elle épouse son contenu et se
  centre.

### La corbeille : ce que « supprimer » veut dire

⚠️ **La question à poser avant de coder n'était pas « comment », c'était « en quoi
est-ce différent d'Écarté ? »** Le bouton croix existait déjà et retire l'offre du plan
de travail. Maxime a tranché : « Écarté » = *regardé, pas pour moi*, l'offre reste dans
son onglet ; la corbeille = *ne me la remontre jamais*, l'offre quitte **tous** les
écrans — y compris « Coup de cœur » et « Candidaté », que le seuil épargne pourtant.

**Marqueur transverse, jamais un statut** (migration 12, `offres.supprime_a`), pour la
raison déjà gravée dans la migration du coup de cœur : un statut est exclusif, donc
supprimer une offre candidatée effacerait la trace de la candidature. **Vérifié contre
la base réelle** — après écriture de `supprime_a`, `statut` valait toujours `a_traiter`.

⚠️ **Rien n'est effacé, et pas seulement par prudence** : France Travail dépublie, et
`enrichissements.offre_identifiant` référence l'offre — un `DELETE` échouerait sur
toute offre enrichie, soit une sur six aujourd'hui.

**Annulation immédiate** (8 s), choisie par Maxime contre un onglet « Corbeille » : la
rangée de pilules est pleine à six et il ne reste aucune teinte d'accent libre.
⚠️ **La barre vit dans le LAYOUT, pas dans le bouton** — cliquer la corbeille fait
disparaître la ligne, donc son bouton : une barre rendue par lui serait démontée à
l'instant où elle devient utile.
⚠️ **Et la fiche reste le chemin de secours** : c'est la seule lecture qui n'applique
pas `CONDITION_NON_SUPPRIMEE`. Sans elle, une offre retirée après l'expiration de la
barre serait **irrécupérable**.

### Le défaut que seul l'essai réel pouvait montrer

⚠️ **Le bouton ne se cliquait pas.** La ligne de `/offres` est un *lien-carte* : un
`<a>` étendu par `after:absolute after:inset-0` couvre toute la surface, et il avalait
le clic. Playwright l'a dit en toutes lettres — « subtree intercepts pointer events » ;
à la souris, on aurait **ouvert la fiche en croyant avoir supprimé**, sans la moindre
erreur. `relative z-10` corrige, exactement comme le bouton du coup de cœur, qui portait
déjà la parade.

### ⚠️ Une suppression que je n'avais pas demandée — et ce qu'elle prouve

Pendant les essais, une **seconde** offre s'est retrouvée à la corbeille sans que je
l'aie visée : `6348733`, « Tech Lead Python/IA F/H », notée 40. Trouvée en relisant la
base après un test qui portait sur une autre offre.

Le journal du serveur de développement porte la trace, sans ambiguïté :
`ƒ definirSuppression("6348733", true)` — l'action a bien été appelée, avec une session
valide, depuis `/offres`. Aucune annulation derrière.

**Hypothèse écartée par la mesure** : un rejeu d'action au rechargement à chaud. Testé
en forçant une recompilation, `/offres` ouverte, trente requêtes derrière — **aucun
`POST`, aucune action serveur, base inchangée**.

**Ce qui reste, et qui est la bonne explication** : c'est le défaut n° 3 de la revue,
observé en vrai avant d'être corrigé. Le `CLAUDE.md` porte les deux mesures qui
l'expliquent — « la fin d'une action serveur n'est PAS la fin du re-rendu : réponse à
+80 ms, réorganisation de la liste à **+900 ms** », et « un test qui re-résout son
sélecteur à chaque clic ne teste pas une cible mouvante ». Pendant ces 900 ms, la liste
se réorganise sous le curseur et **le bouton corbeille restait actif sur la ligne qui
prenait la place**. Une seule barre d'annulation existait : la seconde suppression a
écrasé la première sans un mot.

⚠️ **Le correctif est celui que la revue demandait** : `BoutonCorbeille` est désormais
désactivé tant qu'une écriture est en vol (`corbeille.enCours`), et la barre ne se ferme
plus qu'après un succès. **L'incident vaut plus que le correctif** : il montre que ce
défaut n'était pas théorique — il s'est produit dès la première demi-heure d'usage, sur
un geste qui, lui, n'est pas réversible passé huit secondes.

⚠️ **L'offre a été restaurée**, base revérifiée à zéro offre en corbeille.

### Ce qui a été vérifié, et ce qui ne l'a pas été

- **Migration éprouvée en six temps** contre la vraie base : lire · écrire · vérifier
  que le statut ne bouge pas · compter (579 visibles / 1 retirée) · restaurer · base
  rendue à l'identique.
- **Le geste complet à l'écran** : clic → l'offre quitte la liste, « À traiter » passe
  de 12 à 11, « Toutes » de 16 à 15, le sous-titre de 574 à 573, la barre d'annulation
  s'affiche → retour par la fiche → **base rendue à l'identique**, `supprime_a` à `NULL`
  et statut intact.
- **375 px et bureau, clair et sombre**, console propre, aucun débordement.
- **Mesure de non-fuite des colonnes REFAITE** (règle 4 du `CLAUDE.md`, exigée après
  chaque nouveau composant client — et deux sont apparus). Vingt noms de colonnes
  cherchés dans le HTML **réellement servi** de `/`, `/offres`, « Toutes » et « Coup de
  cœur » : **aucune fuite**. `charge_brute`, `contact_url_postulation`, la description
  d'annonce, `note_personnelle`, `tokens_cumules`, `supprime_a` — tous absents des
  écrans qui ne doivent pas les porter. ⚠️ **Avec témoin positif** : la même mesure
  trouve bien l'intitulé dans la liste et la description sur SA fiche, donc elle
  détecte quand il y a quelque chose à détecter.
- ⚠️ **NON VÉRIFIÉ À L'ŒIL : le bouton sur l'écran du matin.** `/` rend le même
  composant `LigneOffre` — c'est mécanique et lisible dans le code — mais la collecte
  du jour n'a rapporté aucune offre, donc l'écran est en état « collecte vide » et
  n'affiche aucune ligne. **Le dire plutôt que de laisser croire que je l'ai vu.**

### Mise en ligne, le soir même

Deux commits et non trois, et le motif vaut d'être noté : le seuil et la corbeille se
croisent dans les mêmes fichiers (`lib/offres.ts`, `offres/page.tsx`, `etats.tsx`,
`stockage.py`). Séparés, **aucun des deux ne compilerait** — trois commits dont deux
cassés valent moins qu'un commit honnête. L'en-tête, elle, était réellement autonome.

Contrôle avant de pousser : aucun fichier de secret dans le diff, aucune valeur
ressemblant à une clé Supabase, Anthropic ou un jeton GitHub.

✅ **`JETON_GITHUB` posée chez Vercel** par Maxime, en Production, *Sensitive*. Vérifié
avant la pose, sans jamais afficher la valeur : jeton valide, voit le dépôt, voit
`enrichissement.yml`, **expire le 19 janvier 2027**. Redéploiement lancé au CLI —
`Ready` en 47 s, aliasé sur le domaine.

Vérifié en production, et c'est le contrôle qui compte après un déploiement touchant le
layout : `/`, `/offres` et une fiche renvoient toutes **307 vers `/connexion`**, et
**zéro donnée d'offre** dans le HTML servi sans session.

⚠️ **Ce que je ne peux pas vérifier, et c'est volontaire** : les pages protégées en
ligne. Il faudrait le vrai mot de passe du site, que je ne lis ni ne demande jamais —
même pour vérifier mon propre travail. Tout ce qui est décrit plus haut a été vu en
local, avec un mot de passe de test.

⚠️ **Le jeton n'est PAS en Preview**, contrairement à ce que prescrivait
`HEBERGEMENT.md`. Laissé tel quel en attendant l'arbitrage de Maxime, avec un argument
pour ne pas l'ajouter : un aperçu Vercel parle à la **même base** que la production,
donc un enrichissement lancé depuis un aperçu consommerait l'enveloppe réelle et serait
facturé. L'absence du jeton ferme cette porte.

---

## 31 août 2026 (nuit) — Le seuil d'intérêt passe à 40 et devient global

Demande de Maxime : « nettoyer l'affichage, il y a beaucoup trop d'offres ». Le
diagnostic était juste, la cause à mesurer avant de coder.

### Ce que la base disait

580 offres, **146 notées, 434 jamais notées** — l'arriéré d'avant la mise en place
du cron, que la notation ne reprendra jamais puisqu'elle ne tourne que sur la
dernière collecte. Les 146 notées se répartissent en **deux paquets séparés par un
vide** :

| Intérêt | Offres | | Seuil | Reste à l'écran |
|---|---|---|---|---|
| 0-19 | **115** | | ≥ 30 | 26 |
| 20-29 | 5 | | ≥ 35 | 22 |
| 30-34 | 4 | | **≥ 40** | **16** |
| 35-39 | 6 | | ≥ 50 | 12 |
| 40-100 | **16** | | ≥ 60 | 11 |

Maxime hésitait entre 40 et 50. Les chiffres ont tranché : la coupure naturelle est
le trou entre 20 et 40, et passer à 50 ne retire que **4** annonces, toutes dans la
bande 40-49 — on couperait dans ce qui reste, plus dans le bruit. **40 retenu.**

### Trois décisions, prises avant d'écrire

1. **Cacher, jamais supprimer.** France Travail dépublie : une ligne effacée ne
   revient pas. Baisser le seuil rend les offres immédiatement, sans recollecte et
   sans repayer une notation.
2. **Un seul seuil pour les deux écrans.** `SEUIL_INTERET_MATIN = 35` ne bornait que
   `/`. Deux seuils, c'était deux populations : une offre à 37 s'affichait le matin
   puis restait introuvable dans le plan de travail où on serait allé la rechercher
   l'après-midi.
3. **Le seuil filtre ce que le MODÈLE propose, jamais ce que Maxime a désigné.**
   « Coup de cœur » et « Candidaté » y échappent — sinon une offre notée 30 qu'il a
   likée quitterait ses coups de cœur, et sans le moindre message, puisqu'une offre
   cachée ne laisse aucune trace à l'écran. Mesuré avant de décider : aujourd'hui
   **0 coup de cœur et 0 candidature** passent sous 40, donc l'exception ne change
   rien — elle protège un geste futur.

⚠️ **« Écarté » est soumis au seuil, et c'est le cas qui se discute** : écarter est
aussi un clic. Mais c'est la corbeille — l'exempter ferait de la seule liste qu'on
n'ouvre jamais celle qui contient tout le bruit.

### Où le seuil vit

Dans `lib/filtres.ts`, pas dans `matin.ts`. La raison est **mécanique** :
`matin.ts` importe déjà `offres.ts`, donc y laisser la constante partagée aurait
fait un cycle d'import.

⚠️ **Une seconde raison a été avancée, puis retirée le 31 août 2026 parce
qu'elle était fausse** : « le nombre s'écrit dans un écran vide, donc côté
navigateur ». Vérifié en revue — les trois consommateurs (`etats.tsx`,
`etats-matin.tsx`, `offres/page.tsx`) sont des composants **serveur**, sans
`"use client"`. La constante n'entre donc jamais dans le graphe du navigateur, et
`server-only` ne l'aurait pas gênée. Le garder aurait fait croire à une garantie
déjà acquise le jour où un vrai composant client voudrait ce nombre.

`regimeDuSeuil(filtre)` décide, et **la liste comme les compteurs traversent la
même fonction** — c'est elle, et non une discipline, qui empêche une pilule
d'annoncer 562 en face de trois lignes.

### Deux défauts trouvés en chemin, dont un vu à l'écran

⚠️ **La pilule « Toutes » était une SOMME, et le seuil l'a rendue fausse.** Elle
valait « à traiter » + « candidaté » + « écarté ». Depuis que « Candidaté » échappe
au seuil, cette addition compte les candidatures sous 40 que la liste ne montre pas.
Elle serait restée juste jusqu'au jour où Maxime candidate à une offre notée 30 —
c'est-à-dire un usage normal du produit, pas un cas limite. Remplacée par un vrai
comptage (`compterVisibles()`).

⚠️ **La carte de passage de `/` annonçait 574 offres et menait à un écran qui en
montrait 12** — vu à l'écran pendant la passe visuelle, pas trouvé en relisant le
code. `compterATraiter()` ignorait le seuil. Un lien qui ment sur sa destination,
sans la moindre erreur pour le signaler.

### Un troisième état vide, parce que zéro ligne veut dire trois choses

« La base est vide », « rien n'atteint 40/100 » et « ce filtre est vide » montrent
tous les trois une page sans offres. Le premier message envoie chercher une panne de
collecte un matin où la collecte a parfaitement fonctionné. D'où
`AucuneOffreAuSeuil`, qui dit **les deux causes** — note basse **ou pas de note du
tout**, puisque `NULL >= 40` n'est pas satisfait — et qui rappelle que rien n'est
supprimé. L'ordre des tests est la logique, comme dans `choisirAffichage()`.

⚠️ **Le test a d'abord porté sur « le seuil s'applique-t-il ? », et c'était le
défaut** — voir la section suivante : la revue l'a fait passer sur « a-t-il
réellement caché quelque chose ? », c'est-à-dire sur un comptage.

### Ce qui a été vérifié, et comment

- **127 tests** au vert dans les deux fuseaux (`npm run verifie`), dont 6 nouveaux
  sur le seuil — dont un qui parcourt le `FILTRES` réel et exige que **chaque**
  filtre dise s'il est soumis, et un qui exige qu'il reste au moins un filtre de
  chaque côté.
- **L'échappatoire éprouvée pour de vrai** : coup de cœur posé sur une offre notée
  **38** depuis sa fiche → elle apparaît bien dans « Coup de cœur » (2 offres, sans
  le segment de seuil dans le sous-titre) → cœur retiré, **base rendue à l'identique**
  (un seul coup de cœur, `6426819`, date d'origine intacte).
- **Contrastes mesurés au canvas** sur le nouveau panneau : clair 12,17 / 5,9 / 5,9 ·
  sombre 14,83 / 7,74 / 7,74 (titre / paragraphe / icône). Le segment « intérêt ≥
  40/100 » du sous-titre mesure **8,95:1 en sombre**.
- **375 px et bureau**, clair et sombre, aucun débordement horizontal, **console
  propre** (0 erreur, 0 avertissement).

### Ce que `/code-review` a trouvé, et qui a changé la forme du travail

La revue a rendu quatorze points. **Quatre touchaient ce que l'écran AFFIRME**, et
ce sont les plus coûteux — aucun ne lève d'erreur, aucun ne fait rougir un job.

1. ⚠️ **L'écran vide accusait le seuil d'un vide dont il n'était pas
   responsable.** Sur « Nouveau », une nuit qui n'a rien ramené affichait
   « Aucune offre "Nouveau" au-dessus de 40/100 » — alors que le seuil n'avait
   rien caché du tout. Ça arrive à **chaque nuit blanche**, donc souvent : c'était
   même l'écran que j'avais sous les yeux pendant la passe visuelle sans le
   remettre en question. Le test portait sur « le seuil s'applique-t-il ? » au
   lieu de « a-t-il réellement caché quelque chose ? ». Correctif :
   `compterFiltreSansSeuil()`, demandé **uniquement** quand la liste est vide.
2. ⚠️ **« Toutes » n'était plus un sur-ensemble des autres onglets.** Une offre
   likée sous 40 s'affiche dans « Coup de cœur » puis disparaissait en cliquant
   « Toutes », et la pilule « Toutes » pouvait afficher **moins** que la pilule
   « Candidaté » juste à côté. C'est ce qui a fait passer le booléen
   `leSeuilSApplique` (devenu `regimeDuSeuil`) à **trois régimes** — `"seuil"`, `"aucun"`, `"visible"`.
   Vérifié à l'écran en montant le seuil à 999 : « À traiter 0 · Candidaté 0 ·
   Coup de cœur 1 · **Toutes 1** », et la liste « Toutes » montre bien l'offre.
3. ⚠️ **Le message renvoyait vers un indicateur incapable de répondre.** Il
   disait « l'état de la veille en haut de page dit où en est la notation » — or
   `lib/veille.ts` ne lit que les exécutions d'`etape = 'collecte'` : une notation
   tombée y laisse la veille « à jour ». Renvoyer vers un indicateur muet est pire
   que se taire, on en conclut que tout va bien.
4. ⚠️ **« Journée calme » promettait « tout est en base et reste
   consultable ».** Vrai tant que `/offres` montrait tout ; faux le jour même où
   le seuil a été étendu. Une nuit entière sous le seuil n'est affichée par
   **aucune** page — la phrase envoyait chercher une liste inexistante.

**Deux requêtes inutiles sur le chemin chaud**, aussi : `compterCollectees()`
partait à chaque rendu pour un message qui ne s'affiche que sur écran vide. Les
deux comptages de diagnostic ne sont plus demandés qu'après avoir constaté zéro
ligne — un écran vide n'a aucun contenu à faire attendre.

**Trois commentaires devenus faux**, redressés : le docstring de `compterAilleurs`
décrivait comme un bug corrigé un comportement que le seuil rétablit
légitimement · la justification du mot « autres » sur la carte de passage ·
et un commentaire de ma main qui annonçait « la seule duplication de cette
chaîne » alors qu'elle est écrite **trois** fois, dont deux dans le fichier même
où je l'écrivais.

⚠️ **Un test que j'avais écrit ne pouvait pas échouer.** « Chaque filtre répond
quelque chose » : le `switch` est exhaustif sans `default`, donc `tsc` le prouvait
déjà avant que le test ne tourne. Remplacé par un gel de la **partition** des
trois régimes, construite depuis `FILTRES` réel — ce qu'aucun type ne protège,
c'est le *contenu* de la décision.

⚠️ **Le pipeline a suivi** : `--note-minimale` valait 35 « le seuil de l'écran du
matin ». Payer l'identification d'un employeur sur une offre devenue invisible est
une dépense pure. Passé à 40, avec le commentaire qui porte le lien — Python et
TypeScript ne peuvent pas partager la constante.

### Effet de bord, et ce qui reste

✅ **Le plafond de 200 lignes ne mord plus** : 16 offres passent le filtre. Le sujet
reste ouvert sur le principe, mais son échéance recule d'autant.

⚠️ **Constat non traité, remonté à Maxime** : **5 des 16 offres retenues sont des
alternances**. Il est jeune diplômé et cherche un CDI — le modèle les note haut
alors qu'elles sont hors cible. C'est un défaut de **notation**, pas de filtre, et
la base porte déjà une colonne `alternance`.

---

## 31 août 2026 (soir) — L'agent tourne pour de vrai, et dit ce qu'on ne lui demandait pas

Tranche 7.2. Un seul enrichissement facturé, sur Wavestone. Il devait servir deux fois —
prouver la chaîne et donner le chiffre — et il a servi trois fois.

### Un run pour rien, et ce qu'il a quand même appris

Le premier clic a produit une fiche à UNE rubrique et zéro source. Cause : **le workflow
fait un `checkout` du dépôt distant**, et les dix-neuf fichiers de la 7.1 étaient restés
en local, non commités. GitHub a exécuté le code de la veille.

C'est une erreur de ma part — j'ai dit « lance-le » sans avoir poussé, alors que j'avais
lu la mécanique du déclencheur le matin même.

Le run n'est pas perdu pour autant : il **ferme une question ouverte du projet**. Le
`CLAUDE.md` notait que « le coût de la fiche RÉDUITE n'est pas mesuré en Sonnet » — les
11,7 centimes du 30 août portaient sur la fiche complète et un cas dégradé, et le seul
essai depuis était en Haiku. On a désormais le chiffre : **46 257 tokens, 5 tours, 29 s**.

⚠️ **Et il prouve autre chose, gratuitement** : l'ancien code a tourné contre une base
déjà migrée sans broncher. C'est exactement ce qu'une migration additive doit faire, et
c'est plus convaincant qu'un test.

### Le vrai run : 55 198 tokens, 5 tours, 35 secondes

Après le push, le second clic a produit les quatre rubriques. **0,086 $** au tarif
introductif de Sonnet 5, **0,129 $** au tarif plein — soit **dix fois sous l'estimation
du PRD**, et sous la borne basse de son estimation en tokens.

Détail qui vaut d'être vu dans la facture : **écrire le cache a coûté cinq fois plus
cher que le lire**, sur 2,4 fois moins de tokens (1,25× le prix d'entrée contre 0,1×).
C'est la même mécanique qui rend les Batches inutiles à une seule offre.

### Le re-réglage de l'enveloppe : ne rien changer, et c'est un résultat

Trois mesures en Sonnet 5 : **118 254** (cas dégradé, prompt complet), **46 257**
(favorable, prompt réduit), **55 198** (favorable, quatre rubriques).

`COUT_PRESUME_TOKENS` vaut 150 000, soit près de trois fois le coût courant — la
tentation est de le baisser. **C'est l'erreur.** Une réserve ne se dimensionne pas sur
la moyenne mais sur le **pire cas** : 150 000 couvre les 118 254 du cas dégradé avec
27 % de marge. Et l'enveloppe ne se dimensionne pas sur un run mais sur le **scénario
d'usage** que Maxime a fixé — un enrichissement plus sa relance si le premier rate, soit
2 × 118 254 = 236 508, qui passe sous 300 000.

**Les deux valeurs tiennent. Ne rien changer est la conclusion, pas une abstention.**

### La question de Maxime : « tu ne peux pas remettre l'enveloppe à zéro ? »

Non, et le motif vaut au-delà du cas. L'enveloppe n'est pas un compteur qu'on
décrémente : c'est la **somme des traces réelles** du jour. La remettre à zéro
signifierait supprimer les lignes des enrichissements déjà faits — effacer la mesure de
ce qu'on a dépensé, donc perdre l'historique dont vit l'écran de suivi prévu, et faire
d'une borne quelque chose qu'on contourne quand elle gêne.

Ce qui existe à la place : **relever le plafond**, qui est une constante versionnée. La
différence est entre **changer la règle** — visible, tracé, relisible dans six mois — et
**effacer la mesure**, invisible.

### ⚠️ Le constat non programmé : l'agent n'explore pas

Le prompt dit « trois à cinq pages suffisent ». **L'agent en a lu une**, l'accueil. Les
quatre rubriques citent pourtant `CTO.ai`, `Copilot`, `CAC 40`, `MLOps` — tous absents
de cette page.

Vérifié plutôt que supposé : **tous sont dans le texte de l'annonce**, retrouvés par
comptage. ✅ Rien n'est halluciné et le marqueur `deduit` est exact.

⚠️ **Mais deux conséquences que le critère d'acceptation n'attrapait pas.** « Sources
consultées » ne montre qu'une ligne alors que la matière vient surtout de l'annonce, qui
n'est pas une page web et n'y figure donc pas. Et une annonce décrit **un poste**, pas le
business complet : `clients` et `offre_commerciale` héritent de ce biais.

**Mesuré, non corrigé.** Faire lire cinq pages coûterait davantage pour un gain non
démontré, et la fiche obtenue est bonne. À rouvrir avec une mesure, jamais avec une
intuition.

### Deux critères non atteints, et la différence compte

- ⚠️ **La borne desserrée n'a pas été mise à l'épreuve** : 5 tours et 35 s sur 45 et 300
  disponibles. Le desserrage de la 7.1 n'a pas servi. Le critère n'est pas *vérifié*, il
  est *non atteint* — et confondre les deux ferait croire à une validation.
- ⚠️ **Le site injoignable avec le nouveau prompt n'est pas vérifié.** Le seul cas
  dégradé mesuré date du 30 août, avec l'ancien prompt.

### Passe de documentation

Trois incohérences trouvées en croisant la doc avec la base et le code :

1. « 4 enrichies » alors qu'il y en a 6.
2. ⚠️ **Le `CLAUDE.md` se contredisait sur le nombre de tests** — 122 dans le tableau des
   briques, 93 dans le bloc de commandes. Le nombre est retiré du bloc de commandes :
   un compteur écrit à deux endroits diverge toujours.
3. La question ouverte « le coût de la fiche réduite n'est pas mesuré en Sonnet » était
   résolue et traînait encore dans le tableau.

⚠️ **Et un faux positif instructif**, qui a failli devenir une quatrième « incohérence » :
un `grep server-only` sur `lib/` compte **à l'envers**, parce que six des dix modules
concernés *mentionnent* la chaîne dans leur en-tête pour expliquer pourquoi ils ne
l'importent pas. Le seul critère est une ligne qui COMMENCE par `import "server-only";`.
Recompté ainsi : huit protégés, onze sans, soit dix hors `utils.ts` — le `CLAUDE.md`
avait raison. **La règle « recompter plutôt que recopier » ne suffit pas ; encore
faut-il recompter juste.**

---

## 31 août 2026 (après-midi) — La phase 7 construit « Business », les sources, et la jauge

Tranche 7.1. Tout est bâti **avant** le premier appel facturé : l'agent réel de la
7.2 servira deux fois — il prouvera la chaîne et donnera le chiffre qui re-règle
l'enveloppe. Un seul enrichissement payé pour deux besoins.

### La question ouverte de la phase, tranchée en ouverture

« La technique attendue sur ce poste » (US-19) **n'entre pas** dans la fiche. Le
motif tient en une phrase et vaut au-delà du cas : **ce n'est pas la même
matière.** Les quatre autres rubriques parlent de l'ENTREPRISE et exigent d'aller
lire son site ; celle-ci parle du POSTE et se trouve dans le texte de l'annonce,
affiché deux sections plus haut sur la même fiche. On aurait payé un agent pour
reformuler ce qui est déjà à l'écran.

### LinkedIn : mesuré, puis refusé — et l'intuition de Maxime était juste

Maxime a demandé si l'agent pouvait lire LinkedIn pour l'effectif et l'activité IA,
« qui sont à jour ». **Il avait raison sur le fond** : la page publique d'OCTO rend,
dans ses données structurées, `numberOfEmployees: 842` — un effectif précis et
récent, là où le registre INSEE ne donne qu'une tranche parfois vieille de huit ans.

Trois obstacles, mesurés plutôt que supposés :

1. **Le `robots.txt` de LinkedIn l'interdit en toutes lettres**, dès sa première
   ligne : « The use of robots or other automated means to access LinkedIn without
   the express permission of LinkedIn is strictly prohibited », puis
   `User-agent: * → Disallow: /`.
2. **Le dépôt est public et sert de pièce à conviction en entretien.** Un module qui
   aspire LinkedIn n'y passe pas pour une astuce.
3. ⚠️ **Le test venait d'une adresse résidentielle, l'agent tourne sur GitHub
   Actions.** Un centre de données, dont LinkedIn bloque les adresses en priorité —
   le même piège que le registre public, déjà documenté. On aurait construit quelque
   chose qui marche sur le Mac et échoue en production.

⚠️ **Et récupérer des OFFRES ailleurs que chez France Travail est au hors périmètre
opposable du PRD** — ce n'est pas un arbitrage technique, c'est le cadrage.

### Migration 11 : deux besoins, une migration

`rubrique_connue` passe de trois à six valeurs. ⚠️ `groupe` et `effectif_annonce`
**restent dans la liste** bien que l'agent ne les produise plus : trois fiches en
portent, et retirer un mot d'une contrainte casserait toute écriture future sur ces
lignes-là. **Une liste fermée s'étend ; elle ne se nettoie pas.**

Et une colonne `url` sur `etapes_enrichissement`. ⚠️ **Pourquoi une colonne et non
une quatrième table `sources_enrichissement`** : une étape de lecture EST une
source. Deux tables porteraient la même information sous deux formes, et la règle
« ce qui se calcule ne se stocke pas » s'applique telle quelle — la liste des
sources est l'ensemble des étapes qui portent une `url`.

⚠️ **L'adresse était déjà à moitié là, et c'est le piège :** depuis le 30 août, une
étape s'intitule « Lecture de octo.com/nos-clients ». Ce libellé est du texte MIS
EN FORME — protocole retiré, `www.` retiré, chemin tronqué à 60 caractères pour
tenir dans `libelle_borne`. **Reconstruire un lien à partir de lui donnerait une
adresse fausse une fois sur trois, et un lien faux vers une source est pire
qu'aucun lien : il fait croire qu'on peut vérifier.**

**Éprouvée par 19 essais**, tous conformes : `activite_IA` (casse majuscule) refusé,
`offre` refusé, `javascript:`, `data:`, `file://`, url avec espace, avec chevron,
vide, de 2001 caractères — tous refusés. Base rendue à l'identique.

### Trois épaisseurs contre un lien exécutable

L'adresse d'une source vient d'un modèle qui a lu des pages que personne ne
contrôle, et l'écran en fait un `<a href>`. Un `javascript:` glissé par une page
hostile s'exécuterait dans la session déjà authentifiée de Maxime.

La parade est **volontairement redondante** : contrôle Python à l'écriture (l'étape
garde son libellé, l'adresse douteuse est jetée), contrainte `url_est_une_adresse_web`
en base, et revérification au rendu. Les deux premières ne servent pas la même
chose — l'une évite de perdre une étape, l'autre garantit qu'une adresse
dangereuse n'entre jamais. La troisième ne protège rien aujourd'hui : elle protège
le jour où quelqu'un ajoutera un chemin d'écriture qui contourne les deux autres.

### ⚠️ Un défaut DORMANT trouvé en mesurant : le lien du site officiel était illisible

En mesurant le contraste des nouveaux liens de sources : **1,99:1 contre 4,5
exigés**. Et le lien « Site officiel », posé en tranche 6.4, portait **exactement le
même défaut depuis sa création** — jamais mesuré, parce qu'un lien ne ressemble pas
à un cas limite.

La cause est le piège central du système, pris à l'envers : `--primary` vaut
`#c9a8ff`, un lavande **fait pour être un fond sous de l'encre foncée**. Employé
comme couleur de texte, il disparaît.

Correction : un jeton `--primary-texte` (`#7c3aed`, **5,70:1 mesuré**), même patron
que `--interet-texte` et `--success-texte` — une famille, deux jetons. ⚠️ **En
sombre il vaut le pastel nu** : le problème est propre au mode clair, où assombrir
est la seule direction libre. Les deux liens passent à **5,70:1 en clair, 8,13:1 en
sombre**. ⚠️ Le `variant="link"` du `Button`, **utilisé nulle part**, portait le même
défaut : corrigé avant d'avoir servi.

### La jauge d'enveloppe, et pourquoi la réserve est hachurée

Remontée dans la phase à la demande de Maxime. Les deux pièges annoncés dans le
plan ont été tranchés en construisant :

**La réserve.** Un enrichissement en vol immobilise 150 000 tokens dès le clic —
c'est ce qui bouche le trou de concurrence du 30 août. Une jauge nourrie du seul
total **bondirait de 0 à 50 % avant qu'un token soit dépensé**. `detaillerConsommation()`
sépare donc `reels` et `reserves`, et `calculerConsommation()` n'en garde que le
total : **la même règle vue de deux façons, jamais deux règles** — sinon la jauge et
la garde pourraient un jour raconter deux histoires différentes sans qu'aucune
erreur ne soit levée. Un test garde exactement cette propriété.

⚠️ **La réserve se distingue par une TEXTURE, pas par une teinte — et c'est une
correction mesurée.** Le premier jet la peignait en encre atténuée sur une piste
atténuée : **1,64:1 entre les deux en mode sombre**, indiscernable du rail vide.
Trois densités d'une même encre sur une barre de 8 px ne peuvent pas s'écarter
assez ; le problème est structurel, pas un mauvais réglage. Des hachures d'encre
pleine se distinguent du plein par leur trame et du vide par leur encre, **sans
dépendre d'aucun rapport de clarté**.

**Le décompte avant minuit : abandonné, et c'est la bonne réponse.** La page est
rendue côté serveur ; un compte à rebours y serait figé à l'heure du chargement.
« Remise à zéro à minuit » est vrai sans horloge.

⚠️ **Décision de système : la jauge est en teintes NEUTRES.** Les six accents sont
pris et portent chacun un rôle ; la peindre en bleu l'aurait rattachée à la note
d'intérêt, qui n'a rien à voir. **Une consommation est une quantité, pas un signal
catégoriel** — elle ne consomme donc aucun accent.

### Le squelette, encore — quatrième saut évité

La jauge allonge la section d'enrichissement de **34 px** (186 contre 152 réservés).
`loading.tsx` recalé à 11,625 rem, **écart 0 px** vérifié par substitution dans le
DOM. ⚠️ La mesure porte sur « pas encore enrichie ET rien en vol », le cas de 576
offres sur 580 : un enrichissement en vol ajoute la ligne de réserve et porte la
carte à 209 px, mais ce cas dure quelques minutes par jour et ne doit pas commander
le squelette.

### Une supposition remplacée par un chronomètre

Le commentaire du `timeout` de 8 minutes justifiait sa valeur par le poids des
dépendances — « ~190 Mo, le SDK embarque son binaire ». **Mesuré sur deux exécutions
réelles : l'installation prend 8 à 11 secondes**, et tout ce qui n'est pas l'agent
tient en ~15 s. Le chiffre de 8 minutes était bon, sa justification était fausse —
et une justification fausse fait mal raisonner le suivant. **Le poids d'un
téléchargement ne dit rien de sa durée sur le réseau d'un centre de données.**

### `/code-review` : quatre défauts réels, deux points que la mesure contredit

**1. La jauge restait figée après la conclusion — le plus visible, et le plus
juste.** Ses nombres venaient du rendu serveur, et `suivreEnrichissement`
n'appelle **délibérément pas** `revalidatePath` (l'y ajouter ferait rejouer tout
le rendu de la fiche toutes les 1,5 s : 89 112 octets contre 323). L'écran
annonçait donc « Enrichissement terminé » au-dessus d'une barre affirmant encore
« dont 150 000 réservés », avec un total ignorant la dépense réelle — jusqu'à un
rechargement manuel. **Le sondage renvoie maintenant l'enveloppe à la
conclusion**, et à ce moment seulement : une lecture de plus, au moment précis où
le nombre change. ✅ **Prouvé sans rechargement** : 226 244 dont 150 000 réservés
→ **107 644**, la ligne de réserve disparue.

**2. Le filtre d'URL Python n'était pas le jumeau de la contrainte SQL.**
`re.IGNORECASE` acceptait `HTTPS://…` que Postgres refuse, et le `$` de Python
tolère un saut de ligne final que POSIX refuse. **Ce qui passe le filtre et que
la base rejette fait échouer la ligne entière — donc le libellé part avec
l'adresse**, l'inverse exact de ce que le code promet. `fullmatch` sans
indicateur ferme les deux ; huit cas éprouvés.

**3. « Sources consultées » listait les pages DEMANDÉES, pas lues.** L'étape
s'écrit quand l'agent réclame une page, plusieurs secondes avant qu'on sache si
elle a répondu — c'est voulu, l'écran doit avancer. Mais un 403 ou un délai
dépassé laissait une adresse sous « Sources consultées » que l'agent n'a jamais
lue. ⚠️ **Le cas n'a rien de théorique : le premier enrichissement réel du projet
s'est fait sur un site injoignable.** La boucle écoute désormais les
`ToolResultBlock` en erreur et `lecture_ratee()` retire l'adresse — **le libellé
reste**, la tentative a eu lieu et explique le temps passé.

**4. `entreprise_site` se rendait sans revérification**, alors que les sources en
avaient une. Une règle qui ne vaut que pour la moitié des cas n'est pas une
règle : `estAdresseWeb()` couvre maintenant les deux liens. ⚠️ Et le préambule de
la migration laissait croire à une contrainte de format sur `entreprise_site` —
**il n'y en a aucune**, sa seule garde amont est `_valider_fiche()`.

**Deux commentaires faux, corrigés** — et c'est le genre de défaut que ce projet
traite comme un bug, parce qu'un commentaire faux fait mal raisonner le suivant :

- « L'ORDRE DE CE TUPLE EST L'ORDRE D'AFFICHAGE » était faux. L'écran parcourt
  `TITRES_RUBRIQUES` et retrouve chaque rubrique par son NOM ; le `rang` stocké
  n'est jamais lu. **Quelqu'un voulant déplacer « clients » aurait édité le
  fichier Python, relancé un enrichissement FACTURÉ, et constaté que rien n'a
  bougé.**
- La justification du `?? null` invoquait un `undefined` que PostgREST rendrait
  pour les étapes antérieures à la migration. Impossible : soit la colonne
  existe et les vieilles lignes valent `null`, soit elle n'existe pas et toute la
  requête échoue.

**Deux points rejetés, mesure à l'appui :**

- La revue jugeait risqué de passer à 300 s sous un `timeout` de 8 min, en
  estimant l'installation à « 1 à 2,5 min ». ⚠️ **Elle citait le commentaire du
  workflow, pas le chronomètre.** Mesuré sur deux exécutions réelles :
  **8 à 11 secondes**, ~15 s pour tout ce qui n'est pas l'agent. Marge réelle :
  près de 3 minutes. Le commentaire fautif a été corrigé — c'est lui qui avait
  induit la revue en erreur, ce qui illustre le coût d'une justification fausse.
- Elle supposait la migration 11 non appliquée. Elle l'était, et éprouvée par
  19 essais.

### Vérifications

- **Migration** : 19 essais, 19 conformes, base rendue à l'identique.
- **122 tests** (6 nouveaux sur `detaillerConsommation`), dans les deux fuseaux.
- **Trois états regardés**, posés à la main en base : fiche complète à texte long,
  fiche partielle (site injoignable), fiche entièrement « non disponible ».
- **Contrastes mesurés au canvas** : liens 5,70:1 (clair) et 8,13:1 (sombre) ·
  barre pleine sur piste 9,32:1 et 13,08:1 · libellé 14,83:1.
- **375 px et bureau**, clair et sombre : **0 élément débordant**, aucun défilement
  horizontal, une URL de 58 caractères passée proprement sur deux lignes.
- **Console : 0 erreur, 0 avertissement.**
- **Focus clavier** sur les liens de sources : `outline solid 2px`, offset 2 px,
  aucune `box-shadow` — la règle « jamais `ring` » tient.
- **Concordance vérifiée** entre `RUBRIQUES_REDIGEES`, le schéma de `rendre_fiche` et
  le prompt : aucun champ absent, aucun marqueur absent.
- ⚠️ **La jauge se corrige seule à la conclusion, SANS rechargement** — le
  parcours qui prouve le correctif n° 1 de la revue : 226 244 dont 150 000
  réservés → 107 644, ligne de réserve disparue, écran passé à « terminé ».
- **Aucune colonne sensible dans le document** : vingt noms cherchés (dont
  `charge_brute`, `contact_nom`, `note_personnelle`, `sb_secret`, `JETON_GITHUB`)
  dans 136 Ko, flux RSC compris — **zéro trouvé**, témoin positif valide. Règle
  n° 4 du `CLAUDE.md`, refaite parce que les props du bloc ont changé.
- **`_valider_fiche` éprouvée** sur trois cas : quatre rubriques acceptées avec leurs
  rangs stables · une rubrique omise reste ABSENTE (jamais vide) · un marqueur
  invalide est reproché au modèle sans perdre la fiche.

⚠️ **Non vérifié, et c'est la tranche 7.2** : aucun agent réel n'a encore tourné avec
ce prompt. Le coût, la tenue des bornes desserrées et la qualité des trois nouvelles
rubriques restent inconnus.

---

## 31 août 2026 — La 6.4 sort de l'écran, et « Business » est tranché sans être construit

Séance d'interface, entièrement conduite par Maxime devant le rendu. Sept demandes, toutes
formulées après avoir regardé — aucune sur croquis.

### La fiche d'enrichissement s'ouvre en fenêtre

La section ne montre plus qu'un bouton « Enrichissement par IA ». Pendant le travail, il
passe en attente avec un tourniquet ; conclu, il reprend sa forme et un second bouton
« Voir l'enrichissement » ouvre la fiche par-dessus la page.

**Le tourniquet a été repris À LA MAIN du registre 1st-Pouf, pas installé.**
`shadcn add button.json` aurait remplacé le `Button` du projet par un composant à l'API
différente, effaçant les trois adaptations du 29 août — dont le focus passé de `ring` à
`outline` parce que les `cushion-*` écrasent les `ring-*`. **Tous les boutons du site
seraient devenus inutilisables au clavier, sans erreur ni avertissement.** L'animation
`pouf-spin` existait déjà dans le CSS : il ne manquait que quinze lignes.

**La fenêtre est posée sur Radix, et `pouf.css` l'attendait.** Le registre n'expose aucun
`dialog`, mais le CSS portait déjà `.pouf-overlay`, `.pouf-dialog`, `.pouf-dialog__head` et
`.pouf-dialog__body`, **écrits pour les `data-state` de Radix**. Le style attendait son
composant. Ce que Radix apporte et qu'une `<div>` ne donnerait pas : focus piégé, `Échap`
qui ferme, reste de la page en `aria-hidden`, et sortie animée.

### Trois défauts trouvés en regardant, et un commentaire faux corrigé

- **La catégorie INSEE s'affichait en code nu** — « GE » sur une société de 100 à 199
  salariés. Lu en entretien, ça aurait fait dire qu'Expertime est une grande entreprise.
- **« L'enveloppe est consommée » s'affichait sous « Enrichissement en cours »** : deux
  messages qui se contredisent. Ces avertissements disent pourquoi on ne peut PAS lancer ;
  ils n'ont rien à dire quand quelque chose est déjà parti.
- **« non disponible » en `muted-foreground`**, qui échoue le plancher en mode sombre —
  j'étendais un défaut connu à l'endroit précis où une fiche pauvre en affiche le plus. La
  règle du projet existait déjà pour « Entreprise non communiquée » : l'italique met en
  retrait, jamais une couleur affaiblie.
- ⚠️ **Un commentaire que j'avais écrit affirmait le contraire de ce qui se voit.** À
  propos du prénom surligné, j'avais noté que les deux usages du jaune « ne se rencontrent
  sur aucun écran ». Sur `/offres`, le prénom, la pilule « Nouveau » et le badge
  « Nouveau » sont visibles ensemble. **Un commentaire faux est pire que pas de
  commentaire** : celui-ci aurait servi d'argument pour ajouter un troisième jaune.

### La typographie gagne du terrain, mesure par mesure

Quatre amendements au système, tous demandés sur pièce : le nom d'employeur, les titres de
section de la fiche et les étiquettes des deux notes passent en **Fredoka** ; les titres de
section montent de 11 à 16 px.

⚠️ **Le rapport était inversé** : 11 px de titre pour 16 px de texte, un titre qui pesait
moins que ce qu'il annonce.

⚠️ **Trois pièges, tous liés au même mécanisme.**
1. **Le squelette décalait de 38 px** — un titre fait 22,4 px de haut au lieu de 15,4, et
   `loading.tsx` en réservait 16. C'est le piège de méthode n° 5 avec une variante à
   retenir : **il ne se déclenche pas qu'en AJOUTANT une section, mais aussi en changeant
   une taille de police.**
2. **Une supposition démentie par la mesure** : j'avais élargi le couloir des étiquettes en
   croyant Fredoka plus large que le mono. Mesuré, « ACCESSIBILITÉ » fait **86,4 px** en
   Fredoka pour 108 px réservés — **c'est le mono qui était le plus large**, sa chasse fixe
   donnant au « I » la largeur du « M ». Élargir aurait creusé un blanc et forcé à recaler
   un second squelette, pour rien.
3. ⚠️ **FREDOKA N'A PAS D'ITALIQUE.** Changer `nom-entreprise` touchait aussi les deux
   « Entreprise non communiquée » : le navigateur en aurait synthétisé une oblique
   mécanique. Elles gardent Nunito — et ce n'est pas qu'une question de rendu, **une
   absence n'est pas un nom**, et 39 % des offres sont dans ce cas.

⚠️ **La parade au conflit de classes est devenue une règle** : `libelle-accent` ne déclare
**aucune** `font-size`, ce qui lui permet d'en porter deux — 13 px sur la fiche, 11 en
liste. **Un utilitaire qui ne déclare pas une propriété ne peut pas se la disputer.** Le
projet avait déjà payé ce conflit trois fois (`nom-entreprise`, `accentue`,
`libelle-mono`) : à spécificité égale, c'est l'ordre dans la feuille compilée qui tranche,
pas le code qu'on lit. Ça « marche » sur un écran, puis se retourne sans rien signaler.

### La fiche a maigri, et le retrait porte sur ce que l'agent CHERCHE

Maxime a retiré la catégorie INSEE (« l'effectif me suffit »), la rubrique groupe
(« l'information est dure à trouver et je m'en fiche ») et l'effectif annoncé (« celui que
tu as trouvé au-dessus me suffit, même s'il date »).

⚠️ **Ces trois retraits ont quitté le prompt et le schéma de l'outil, pas seulement
l'écran.** `groupe` et `effectif_annonce` n'existaient que sur le site de l'entreprise :
les demander coûtait des tours d'exploration pour du texte que personne ne lirait.
**Masquer sans cesser de chercher aurait payé le travail deux fois.** Le prompt perd
280 caractères, le schéma passe de seize à treize champs.

L'avertissement sur la catégorie calculée au niveau du groupe part avec elle, mais **la
mesure qui le fondait reste dans `pipeline/registre.py`** — c'est le bon endroit : elle
sert au raisonnement de l'agent, pas à l'affichage.

### « Business » : tranché, documenté, NON construit

Maxime a décrit une troisième section — modèle économique, clients, offre commerciale, ce
que l'entreprise fait en IA — puis a lui-même refermé la porte : « on a dit que c'était en
phase sept. Ce qu'on peut faire, c'est qu'on peut construire ça en phase sept, mais juste
on met à jour la documentation sur ce qu'on vient de trancher ».

**C'est exactement le bon geste, et il vaut d'être noté** : une idée mûre n'est pas une
idée à construire tout de suite. La frontière 6/7 tient, et la phase 7 n'aura plus à
redécider sa forme — elle est écrite dans `docs/PLAN.md`.

⚠️ **Un piège de vocabulaire évité en écrivant** : la rubrique s'appellera
`offre_commerciale` et **jamais `offre`**. Dans ce projet « offre » veut dire *offre
d'emploi* — table `offres`, routes `/offres`, `offre_identifiant`. C'est la règle du
vocabulaire figé prise à l'envers : un seul mot pour deux choses, au lieu de deux mots pour
la même.

⚠️ **« La technique attendue sur ce poste » (US-19) n'a pas été reprise** dans
l'énumération : à trancher en début de phase 7, pas à supposer.

---

## 30 août 2026 (nuit) — 6.3 : l'agent travaille pour de vrai

La tranche 6.2 prouvait le tuyau avec des étapes de démonstration. Celle-ci met l'agent
au travail. Trois décisions commandent la forme du module, et ce sont elles qu'il faut
retenir plutôt que le code.

**Les étapes affichées sont DÉRIVÉES du travail, jamais racontées par le modèle.** On
aurait pu lui donner un outil « écris une étape » et le laisser commenter sa progression.
Deux raisons de ne pas le faire. Une étape racontée peut mentir — rien n'empêche un
modèle d'écrire « SIREN confirmé » sans avoir rien confirmé — alors qu'une étape dérivée
d'un appel d'outil est la trace d'un travail qui a eu lieu, donc vraie par construction.
Et chaque étape racontée coûterait un tour, donc des tokens d'entrée répétés à tous les
tours suivants, pour de la prose que personne ne relit. Nos outils écrivent la leur avec
leur résultat réel ; les outils intégrés sont observés dans le flux de messages.

**L'agent rend sa fiche par un OUTIL, pas en texte libre.** L'outil valide et rend ses
reproches au modèle, qui corrige et rappelle. L'alternative — écrire tel quel et laisser
la base refuser — perdrait tout un enrichissement déjà payé pour une année manquante. Il
est rappelable, la dernière version gagne : c'est ce qui donne un sens à « au-delà de la
borne, il s'arrête et rend ce qu'il a trouvé », qui sinon ne rendrait rien du tout.

**La borne de durée est INTERNE ; le `timeout` du workflow n'est qu'un filet.** Un job
tué par GitHub ne conclut rien : la ligne reste `en_cours`, l'écran pulse jusqu'à la
péremption, et les tokens brûlés sont perdus pour l'enveloppe. Le filet est passé de 5 à
8 minutes, l'installation du SDK pesant 190 Mo.

### `registre.py` est une frontière avant d'être un client HTTP

Sa vraie responsabilité n'est pas d'appeler une API, c'est de décider **ce que le modèle a
le droit de voir**. Le registre rend les dirigeants nommés avec leur date de naissance, et
l'adresse de voie du siège — qui est le domicile du dirigeant pour une entreprise
individuelle. La liste est donc blanche et non noire : un champ personnel ajouté demain
par l'API restera invisible tant que personne ne l'aura explicitement demandé. C'est le
même geste que la collecte, qui écarte les coordonnées **avant** écriture ; la différence
est qu'ici aucune colonne ne viendrait l'arrêter en aval.

### Trois enrichissements réels, dix-huit champs confrontés, zéro invention

C'est le contrôle qui comptait le plus, et il a été fait à chaque fois : reprendre chaque
colonne typée écrite par l'agent et la confronter au registre.

| Offre | Modèle | Tours | Tokens | Durée | Appariement |
|---|---|---|---|---|---|
| `212JMCR` BnF | Haiku 4.5 | 7 | 71 479 | 40 s | `verifie` |
| `6240618` Atos derrière NEW NET 3D | Haiku 4.5 | 6 | 63 127 | 52 s | `verifie` |
| `6323372` Expertime — **en production** | **Sonnet 5** | 13 | **118 254** | 86 s | `probable` |

Date de création, catégorie, tranche d'effectif, millésimes, chiffre d'affaires, SIREN :
**identiques à la lettre, dix-huit fois sur dix-huit.** Le modèle recopie, il ne paraphrase
pas. Et il omet plutôt que de deviner — la BnF n'a reçu que deux rubriques sur trois.

**Le cas Expertime est le plus instructif, et c'est un échec qui se passe bien.** Le site
officiel était inaccessible (erreur de certificat). L'agent est allé chercher ailleurs —
recherche web, puis une source tierce — a trouvé un SIREN, l'a **confirmé au registre
officiel**, et a conclu `probable` et non `verifie`, en écrivant pourquoi : *« le site
officiel était techniquement inaccessible, donc pas de confirmation par mentions légales ;
mais une source tierce corrobore le SIREN avec des agences cohérentes avec l'annonce »*.
Il n'a écrit ni site officiel, ni groupe, ni effectif annoncé. C'est exactement la fiche
qui déclare son doute plutôt que de le combler. ⚠️ **Et l'architecture y est pour
quelque chose** : peu importe où le SIREN est trouvé, la confirmation passe toujours par
le registre. La source tierce sert d'indice, jamais de preuve.

### Deux défauts trouvés en REGARDANT, pas en relisant

**Le libellé des lectures web n'affichait que le domaine.** Le premier enrichissement réel
a produit trois « Lecture du site bnf.fr » à la suite, rigoureusement identiques, alors
que l'agent lisait trois pages différentes dont les mentions légales. À l'écran, ça se lit
comme une boucle bloquée. Mon propre commentaire dans le code affirmait que « le domaine
suffit, l'adresse complète n'apprend rien de plus » — la première mesure l'a démenti.

**Les libellés de catégorie INSEE contredisaient la tranche d'effectif de la même fiche.**
OCTO ressort « GE » avec 500 à 999 salariés : un libellé nu (« grande entreprise, 5 000
salariés et plus ») aurait fait écrire au modèle qu'elle en compte 5 000. L'INSEE calcule
la catégorie au niveau du **groupe**. ⚠️ **La piste n° 6 du `CLAUDE.md`, marquée « mesurée
sur un seul cas », en a maintenant trois** : OCTO (GE / 500-999) et Expertime (GE /
100-199) trahissent une filiale, Atos France (GE / 5 000-9 999) est cohérente. La
contradiction est désormais **dite au modèle comme un indice**, pas tue.

### La revue de code : dix constats, dix corrigés

Quatre méritent d'être retenus.

**La conclusion n'était pas protégée.** `_requete()` ne réessaie jamais : un hoquet réseau
sur le `PATCH` final laissait la ligne `en_cours`, l'index interdisait toute relance, et
l'offre était bloquée dix minutes — agent déjà payé. Aggravant : le filet censé l'empêcher
était **déjà mort**, `_faire_travailler` attrapant tout en amont. Un `try` qui a l'air
prudent et ne se déclenche jamais est pire que pas de `try` : il fait croire que le cas
est traité.

**`entreprise_site` acceptait n'importe quoi.** C'est le seul champ de la fiche qui
deviendra un lien cliquable, et il vient de pages web que personne ne contrôle. Une page
hostile poussant le modèle à écrire `javascript:…` produisait un lien exécutable dès la
6.4. La seule parade était une consigne dans le prompt — or une consigne se contourne, un
contrôle non.

**`2024-02-31` passait.** Format valide, date inexistante, colonne `date` : 400 sur la
conclusion et enrichissement entier perdu pour un 31 février.

**Les codes INSEE n'étaient pas validés, et le défaut aurait été SILENCIEUX.**
`entreprise_tranche_effectif` acceptait « 500 à 999 salariés » au lieu du code `41`.
Aucune contrainte ne l'aurait refusé, et l'écran de la 6.4 aurait cherché un code dans sa
table de traduction, n'aurait rien trouvé, et n'aurait rien affiché — sans erreur nulle
part. ⚠️ **Le piège venait du prompt lui-même** : on donne au modèle le libellé en toutes
lettres pour qu'il le compare à l'effectif du site, donc c'est celui-là qu'il a sous les
yeux au moment de remplir la fiche. Recopier le mauvais des deux est l'erreur la plus
naturelle du monde.

### Une vérification croisée qui recommandait ce qu'on faisait déjà — et qui a servi

Maxime a demandé à une autre IA s'il existait mieux que le registre. Réponse : utiliser
`recherche-entreprises.api.gouv.fr`, c'est-à-dire exactement ce qui venait d'être écrit.
Elle vantait au passage les **dirigeants** que l'API renvoie — précisément ce qu'on filtre
— et recommandait LinkedIn pour l'effectif réel, qui n'a pas d'API gratuite et dont la
récupération contreviendrait à ses conditions d'utilisation.

⚠️ **Mais aller vérifier son chiffre de « 7 requêtes par seconde » a fait lire la
documentation en entier, et trouver deux vrais défauts.** Il existe une **seconde limite,
30 requêtes par seconde et par ASN**, avec cet avertissement mot pour mot : *« il est donc
probable de faire face à cette limite sur les cloud publics »*. GitHub Actions **est** un
cloud public : nos requêtes y partagent leur ASN avec tous les autres runners. Un
enrichissement payé pouvait échouer sur la seconde d'activité d'un inconnu. D'où un
réessai, et un seul, réservé au 429. La documentation recommandait par ailleurs un
`User-Agent` explicite, qu'on n'envoyait pas.

**La leçon dépasse le cas** : le conseil pointait le bon service, mais le goulot n'était ni
le nombre d'appels ni le choix de l'API — il était dans ce qui arrive quand une dépendance
gratuite refuse de répondre pour une raison qui ne vous concerne pas. On ne se pose cette
question qu'en lisant les conditions d'exploitation de ce dont on dépend.

### Le coût réel, enfin mesuré : 11,7 centimes

**0,1166 $ pour l'enrichissement d'Expertime** — 118 254 tokens, 13 tours, en Sonnet 5,
sur un cas dégradé (site officiel inaccessible, recherche de secours). C'est le chiffre que
le plan attendait depuis le cadrage, et il tranche deux estimations d'un coup :

| Estimation | Valeur | Verdict |
|---|---|---|
| PRD, août 2026 | 0,20 € à 1 € | **Dix fois trop haut** |
| `CLAUDE.md`, révisée le 30 août | 7 à 20 centimes | **Juste** — 11,7 c |
| `COUT_PRESUME_TOKENS` | 150 000 tokens | Un peu haut, mais du bon ordre (118 254) |

⚠️ **Et l'usage réel change la lecture de l'enveloppe.** Maxime l'a précisé le soir même :
il ne fera **qu'un seul enrichissement par jour, et seulement en démo devant un
recruteur**. L'enveloppe de 300 000 tokens n'est donc pas trop serrée — ce sont les trois
enrichissements de cette séance de test qui l'ont épuisée, ce qui n'arrivera jamais en
usage normal. À un par jour, elle laisse un facteur deux et demi de marge.

⚠️ **Ce qui la remettra en cause, c'est la PHASE 7, pas le débit.** Elle ajoute quatre
rubriques — ce que l'entreprise vend, à quels clients, ce qu'elle fait en IA, la technique
attendue — donc davantage d'exploration et de pages lues. Si le coût double, un seul
enrichissement consommera 250 000 des 300 000 tokens.

⚠️ **Et alors un scénario très concret casse : l'échec suivi d'une relance, en pleine
démo.** C'est le pire moment pour lire « plafond du jour atteint ». Aujourd'hui deux
tentatives passent (2 × 118 k = 236 k) ; en phase 7 elles ne passeraient plus.
**L'enveloppe doit donc permettre au moins DEUX enrichissements, pas un** — c'est un
critère d'usage, pas un calcul de budget, et il est plus contraignant que le nombre
d'enrichissements par jour.

⚠️ **Non re-réglée pour autant, et délibérément.** Trois points de mesure ne font pas une
distribution, et le seul en Sonnet portait sur un cas dégradé : c'est plutôt un **haut** de
fourchette qu'une moyenne. Le plan place ce re-réglage en phase 7, quand la mesure portera
sur la fiche complète. Le piège de méthode n° 1 s'applique mot pour mot : un point de
mesure n'est pas une borne.

### La liste d'étapes devient UNE LIGNE — revirement demandé devant l'écran

Maxime a regardé un enrichissement réel défiler et a tranché : pas de liste verticale,
**une seule ligne**, celle de l'étape en cours, remplacée par la suivante.

Il a raison, et la version précédente est instructive sur la manière de rater une
correction. Elle empilait les étapes dans un cadre défilant de 320 px, avec un compteur et
un suivi automatique de la dernière arrivée — tout cela ajouté le 30 août pour répondre à
un vrai défaut : à 40 étapes, la neuvième était tranchée à mi-hauteur sans rien pour dire
qu'il y en avait trente et une autres. **La correction répondait à côté.** Le problème
n'était pas que la liste fût mal coupée, c'est qu'une liste n'était pas le bon objet : ce
qu'on regarde pendant qu'un agent travaille, c'est **où il en est**, pas par où il est
passé.

L'historique n'a pas disparu pour autant — il part dans un dépliant fermé, et seulement
une fois le travail fini. Il garde une valeur, mais une autre : montrer en entretien le
chemin qu'a suivi l'agent, ce qui est l'argument même du projet.

**Trois défauts trouvés en regardant la nouvelle version**, dont un que j'introduisais
moi-même :

- **Le plancher de hauteur ne doit s'appliquer que pendant l'exécution.** Il empêche le
  bouton de sauter quand le libellé passe d'une à deux lignes — mais posé en permanence, il
  laissait un vide sous la ligne une fois l'enrichissement conclu, c'est-à-dire dans l'état
  qu'on regarde le plus longtemps et le seul qui n'en avait aucun besoin.
- **Le nombre d'étapes était affiché deux fois**, dans l'en-tête de section et dans le
  résumé du dépliant, à trois centimètres l'un de l'autre.
- ⚠️ **J'allais étendre un défaut d'accessibilité connu.** Les libellés du dépliant étaient
  en `text-muted-foreground`, qui échoue le plancher en mode sombre (2,75:1 contre 4,5).
  Ce défaut est signalé et laissé sur les libellés qui existaient déjà — ce n'est pas une
  raison pour en ajouter. La hiérarchie passe par la taille et par le repli.

⚠️ **`aria-live` est posé sur le conteneur, jamais sur la ligne qui change.** Une région
vivante que React remplace à chaque étape serait retirée puis réinsérée, et les lecteurs
d'écran n'annoncent pas le contenu d'une région qui vient d'apparaître — ils annoncent ce
qui change **dans** une région déjà présente.

---

## 30 août 2026 (soir) — La phase 6 s'ouvre : les tables, puis le tuyau

Maxime demande à entamer la phase 6. Avant de proposer quoi que ce soit, deux
vérifications, parce que le plan reposait sur des estimations de cadrage jamais
confrontées au réel.

**Le registre public rend plus que prévu, et moins que promis.** Interrogé sur cinq
sociétés réelles, `recherche-entreprises.api.gouv.fr` donne bien le nom officiel, la date
de création, la catégorie, la tranche d'effectif — et le chiffre d'affaires, que le PRD
donnait pour largement absent. Mais il ne rend qu'**un seul exercice, le dernier
déposé** : Capgemini 2024, Wavestone 2023, Dataiku 2018, OCTO 2016, Mirakl rien. Un CA
sans son année n'est pas une imprécision, c'est un mensonge. Et la moitié de la fiche que
Maxime décrit — site officiel, appartenance à un groupe, modèle économique — n'y figure
pas du tout : le code NAF range Capgemini, Sopra Steria et OCTO dans la même case
`62.02A`. Le rapprochement par nom, lui, est un pari : « Orion » rend 4 382 entreprises.

Ces trois mesures ont commandé le schéma. L'ancrage vérifiable part en **colonnes
typées** — une date est une `date`, un CA un `bigint`, et `chiffre_affaires_toujours_date`
rend le couple montant/année indissociable. Les rubriques rédigées partent dans **leur
propre table**, chacune avec son marqueur *vérifié* / *déduit*. Les deux formes coexistent
parce que ce sont deux natures de données ; les mélanger aurait transformé une date en
texte, ou un paragraphe en colonne.

**Maxime a tranché deux choses que la mesure ne pouvait pas trancher.** L'évolution de
l'effectif sur deux-trois ans n'existe nulle part gratuitement : elle sera approchée par
deux points, la tranche INSEE vérifiée contre l'effectif annoncé sur le site, marqué
déduit. Et la section « business » qu'il décrivait — clients, offre — reste en phase 7 :
la coupure du plan tient.

### La garde qui compte est un index, pas du code

`enrichissements_un_seul_en_vol` interdit physiquement deux lignes `demande` ou
`en_cours` sur la même offre. Deux requêtes à la même milliseconde : la seconde est
refusée par Postgres avant d'atteindre la moindre ligne de TypeScript. Une vérification
en code laisse toujours une fenêtre entre la lecture et l'écriture — et ici cette fenêtre
coûte une facture, pas un doublon d'affichage. L'index est **partiel** : une fois
l'enrichissement conclu, la ligne en sort et relancer redevient possible.

Migration appliquée puis **éprouvée : 36 contrôles**, en passant par l'API REST avec la
clé secrète — le chemin réel, pas psql en superutilisateur. Seize refus attendus, tous
prononcés par le moteur, et les trois tables fermées à la clé publiable.

### Le tuyau, prouvé pour zéro centime

La tranche 6.2 livre tout le mécanisme sans appeler le modèle une seule fois : le clic
ouvre une demande, l'interface appelle l'API GitHub, le workflow part, le script écrit des
étapes de démonstration, et l'écran les voit arriver par sondage. Mesuré sur un vrai
clic après déploiement : **agent démarré en 16 secondes, enrichissement conclu en 24**,
là où le plan en alloue 300.

Le sondage passe par une **action serveur** et non une route `/api`, pour une raison de
sécurité : le proxy répond 401 à un POST d'action, là où il redirigerait un GET vers
`/connexion` — le navigateur suivrait, recevrait du HTML, et le sondage échouerait sur une
erreur de syntaxe JSON incompréhensible.

### Trois défauts trouvés en regardant, pas en relisant

**Une offre pouvait se bloquer pour toujours.** Le premier clic sans jeton GitHub
affichait bien son message d'erreur, mais la ligne restait ouverte et l'index refusait
toute nouvelle demande. La cause n'était pas celle qu'on devine : **Supabase est en avance
de 184 ms sur la machine de développement**. `demande_a` venait de l'horloge de la base,
`termine_a` de celle du serveur Next, et comme l'échec de lancement survient en quelques
millisecondes, la fin tombait avant le début — la contrainte refusait la clôture, à juste
titre. La leçon dépasse le cas : **deux horodatages comparés par une contrainte doivent
venir de la même horloge.**

**La liste d'étapes se lisait comme un texte tronqué.** À 375 px avec 40 étapes, la
neuvième était tranchée à mi-hauteur sans rien pour dire qu'il y en avait trente et une
autres — et pendant qu'un enrichissement tourne, on regardait le début d'une liste dont
l'intérêt est la fin. Corrigé par un compte d'étapes et un suivi de la dernière arrivée.

**Le lint a refusé une ref lue pendant le rendu**, à juste titre : la valeur peut changer
sans déclencher de rendu, et l'affichage se met alors à dépendre d'une donnée que React ne
suit pas. Un `useState` à initialiseur paresseux fait le même travail sans le défaut.

### La revue a trouvé le trou qui comptait

`/code-review` a rendu neuf points. Le plus grave : **l'enveloppe quotidienne, seule borne
de dépense du système, avait un trou béant.** Les compteurs de tokens sont `NULL` tant
qu'un enrichissement n'a pas conclu, donc la somme du jour comptait **zéro pour tout ce
qui tournait** — et l'index unique ne sérialise que *par offre*. Rien n'empêchait de
lancer dix enrichissements sur dix offres dans la même minute, tous lisant « 0 consommé ».
À l'estimation du PRD : 1 à 1,5 million de tokens contre une enveloppe de 300 000.

La correction : un enrichissement en vol **réserve** son coût présumé. Le calcul est sorti
en fonction pure et couvert par huit tests, dont celui du trou — c'était le seul code qui
protège d'une facture emballée, et il n'était éprouvé par rien. Vérifié ensuite comme le
plan l'exige : requête d'action capturée, enveloppe remplie, requête **rejouée hors de
tout composant React**. Réponse du serveur : « Plafond du jour atteint », aucune ligne
créée.

Les autres : `_tronquer` rendait 2006 caractères pour une limite de 2000 (bug dormant tant
que rien ne bornait ces colonnes) · les tokens écrits `0` au lieu de `NULL` sur le chemin
d'échec, ce qui faisait disparaître de l'enveloppe les échecs les plus coûteux · la
clôture non conditionnelle, qui pouvait écraser une réussite par un « interrompu » ·
l'enveloppe illisible affichée comme « plafond atteint », explication catégorique et
inventée sur un aléa réseau de 20 ms · `text-accessibilite-barre`, un jeton qui n'existe
dans aucun fichier de style, si bien que la coche de l'état « terminé » n'avait aucune
couleur, sans erreur de compilation · et **PostgREST qui rend 409 pour deux violations
opposées**, ce qui faisait répondre « déjà en cours » à une offre inexistante.

Un point de la revue a été **infirmé par la mesure** : elle soupçonnait le sondage de
rejouer tout le rendu de la fiche à chaque tour. Mesuré à 323 octets par tour contre
89 112 pour le document — l'action de suivi n'appelle pas `revalidatePath`, donc Next n'a
aucune route à réémettre.

### Un défaut d'accessibilité signalé, pas corrigé

En mode sombre, `text-muted-foreground` tombe à **2,75:1** sur les cartes et **3,18:1**
sur le fond de page, contre 4,5 exigés par le plancher que le projet déclare opposable.
Ce n'est pas le nouveau composant : « APPELLATION », « Pas encore notée » et « Entreprise
non communiquée » sont dans le même cas et existaient avant. En clair, les mêmes textes
sont à 5,9 — le défaut est propre au sombre. Non corrigé : éclaircir ce jeton touche tous
les écrans, et corriger un seul élément aurait fabriqué une incohérence.

### Ce que la conversation a appris sur le produit

Maxime, voyant passer « 0,20 € à 1 € par enrichissement », a dit ce qui n'était écrit
nulle part : **le projet est une pièce de démonstration, pas un outil qu'il utilisera.**
L'enrichissement sert à montrer en entretien qu'il a branché un agent. Deux conséquences
pour la suite : les libellés d'étapes doivent raconter le raisonnement plutôt que
numéroter des phases, et une fiche qui déclare honnêtement son doute vaut mieux qu'une
fiche complète obtenue en devinant — c'est précisément le point technique qu'il expliquera.

Le chiffre, lui, était faux : une estimation de cadrage jamais vérifiée. Aux tarifs réels,
un enrichissement coûte **7 à 20 centimes**, pas un euro. Il reste une estimation — le
premier enrichissement réel donnera le chiffre, et re-réglera deux valeurs posées à
l'aveugle : l'enveloppe de 300 000 tokens et la réservation de 150 000, probablement trois
fois trop haute.

---

## 30 août 2026 — Le coup de cœur, un marqueur et non un quatrième statut

Maxime demande « un bouton à côté de à traiter et écarté, qui serait liké », pour
retrouver ses offres coup de cœur. La demande est claire ; **la forme qu'elle
suggère ne l'est pas**, et c'est là que la séance s'est jouée.

### La question posée avant d'écrire une ligne

Le geste décrit — un bouton dans la même rangée que les deux autres — porte
implicitement une décision d'architecture : un **quatrième statut**. Deux
conséquences en découlent mécaniquement, et aucune n'est souhaitable :

1. Un statut est **exclusif**. Une offre likée aurait cessé d'être « à traiter »,
   donc aurait **quitté l'écran du matin**, qui ne montre que `a_traiter`.
2. **Candidater aurait effacé le cœur.** La liste des coups de cœur se serait
   vidée à mesure que Maxime avance — l'inverse exact de ce qu'on lui demande.

L'alternative — un marqueur **transverse** au statut — n'était pas une invention :
l'onglet « Nouveau », posé le 29 août, a déjà cette forme. Une offre y figure quel
que soit son statut, et son compte ne s'additionne pas avec les trois autres. Il y
avait donc un précédent à suivre plutôt qu'une forme à inventer.

Les deux options ont été montrées côte à côte, avec leur conséquence concrète.
**Maxime a choisi le marqueur.**

### Ce que la base a reçu — migration 9

Une seule colonne, `coup_de_coeur_a`, de type `timestamptz`. `NULL` = pas de coup
de cœur, une date = coup de cœur posé à cette date.

⚠️ **Le couple booléen + date était le réflexe, et il ouvrait un état incohérent**
qu'aucune contrainte simple ne ferme : `true` sans date. Le projet a déjà payé cet
écart en phase 4, d'où la contrainte `statut_touche_est_date`. Ici, une seule
colonne rend l'incohérence **inexprimable** — ce qui vaut toujours mieux qu'une
règle à faire respecter. Aucune contrainte `check` n'a donc été ajoutée : il n'y a
pas de valeur fausse à interdire.

Vérifiée contre la vraie base après application : lecture, écriture (fuseau
conservé, `+00:00`), effacement, deux valeurs invalides refusées par le moteur
(`22007`), et la clé publiable toujours à **401**.

### Trois défauts trouvés en MESURANT, invisibles à l'œil

Aucun des trois ne se serait vu sur une capture d'écran.

1. ⚠️ **La rangée d'en-tête de chaque ligne est passée de 27 à 30 px.** Le cœur
   n'a pas de libellé visible : avec le `p-2` des boutons de statut compacts, il
   ne contenait qu'une icône de 14 px et mesurait 30 px, contre 24,5 px pour
   « Candidaté » et « Écarté », qui portent du texte. **Les 200 lignes
   grandissaient de 3 px**, et `squelette-ligne.tsx` ne l'aurait jamais su.
   Corrigé par `sm:p-[0.3125rem]` — 24 px, sous le `min-h` de la rangée.
2. ⚠️ **Au survol, le cœur tombait à 2,80:1**, sous le plancher de 3:1. Le
   `hover:bg-accent` ajouté par réflexe glissait un fond lavande `#e7dcff` sous
   lui. C'est le piège du 29 août resservi une **troisième** fois : *une couleur
   se mesure sur la surface qui est vraiment derrière*. Ici la surface changeait
   avec l'état. Le fond a été retiré ; le cœur reste sur la carte (3,66:1 en
   clair, 9,31:1 en sombre) et le survol reste lisible — il passe du violet
   atténué au pêche foncé.
3. ⚠️ **Le squelette de la fiche annonçait deux boutons sur une ligne**, et ses
   deux largeurs (120 et 100 px) avaient été laissées derrière par
   l'agrandissement d'échelle du 29 août. Remesurées : **155,41 · 130,05 ·
   104,70 px**. Surtout, la structure imbriquée compte : `BoutonsStatut` rend ses
   deux boutons dans un conteneur **indivisible**, donc à 375 px la rangée se
   coupe entre le cœur et ce groupe — trois blocs frères se seraient repliés
   autrement, et le squelette aurait menti de 39,5 px.

**Calage vérifié après correction, par remplacement du bloc réel par le bloc du
squelette dans le DOM** — même parent, même largeur disponible : écart **0 px**
à 375 px comme en bureau, sur la liste comme sur la fiche.

⚠️ **Deux tentatives de mesure fausses ont précédé la bonne**, et elles valent
d'être notées : insérer le bloc du squelette *à côté* du bloc réel lui fait voler
sa largeur (le squelette se repliait sur 2 lignes contre 1), et reconstruire à la
main un conteneur qu'on n'a pas lu donne un écart de 12 px qui n'existe pas.
**Un bloc de mesure se substitue à l'original, il ne se pose pas à côté.**

### La couleur : le sixième et dernier accent

Le pêche `--color-orange` (#ffb38a) était le seul des six accents de 1st-Pouf à
n'avoir aucun rôle. Il l'a désormais. **Il n'en reste aucun de libre.**

⚠️ **Le pêche et le rose d'« Écarté » sont à 1,05:1 l'un de l'autre** — la même
clarté exacte. Ils ne se distinguent que par la teinte, donc **pas du tout** pour
un œil protanope ou deutéranope. C'est acceptable ici parce que l'information ne
tient jamais sur la couleur : un cœur contre une croix, un libellé « Coup de
cœur » contre « Écarté ». Le jour où l'un des deux perdrait sa forme ou son mot,
il faudrait changer la couleur, pas discuter le contraste.

Deux jetons, comme pour les notes : le pastel nu ne pèse que **1,74:1** sur la
carte blanche, d'où `--coup-de-coeur-icone` (#eb5200) pour le cœur en tant que
forme. En sombre, le pastel passe nu (9,31:1) — le problème est propre au clair.

⚠️ **La pilule de filtre n'a PAS d'icône de cœur**, alors que la maquette montrée
à Maxime en portait une. Ce qui distingue une pilule d'un bouton de statut dans ce
projet, c'est *le chiffre contre l'icône* : une pilule pêche frappée d'un cœur
aurait été le sosie du bouton de la ligne — sauf que l'une filtre et que l'autre
écrit en base.

### Deux défauts corrigés APRÈS la revue

⚠️ **La revue a relevé un commentaire qui disait le contraire de la vérité**, et
c'est le genre d'erreur qu'on ne voit qu'à froid. Le cœur propageait aux jumelles
du poste, par symétrie avec le clic de statut, et le commentaire le justifiait
ainsi : *« sans ça, le poste apparaîtrait deux fois dans l'onglet Coup de cœur,
une fois avec cœur, une fois sans »*. **C'est impossible** — le filtre est
`coup_de_coeur_a=not.is.null`, une annonce sans cœur n'y figure pas.

Le raisonnement du statut ne se transpose pas : le statut propage parce qu'une
jumelle laissée « à traiter » **ramènerait le poste** dans l'écran du matin le
lendemain, donc du travail à refaire. Le cœur n'a pas cette propriété. Propager
ne protégeait de rien et **fabriquait du bruit** : un poste republié quatre fois
— le cas MBDA, mesuré sur cette base — occupait quatre lignes dans l'onglet après
un seul clic, et la pilule annonçait « 4 » pour un seul poste. L'action ne prend
plus qu'un identifiant, ce qui a au passage supprimé la borne, le dédoublonnage
et le chemin d'échec partiel.

⚠️ **Second défaut : le cœur prenait le verrou de tri GLOBAL à chaque clic**,
gelant les 200 lignes — boutons de statut compris — pendant les ~900 ms du
re-rendu. C'était justifié dans l'onglet « Coup de cœur », où délier fait sortir
la ligne, et inutile dans les **cinq autres**, où liker ne réorganise rien : un
clic sur un cœur rendait le clic « Écarté » suivant inopérant pendant près d'une
seconde. Le verrou est désormais **pris** conditionnellement et **respecté**
toujours — les deux ne vont pas ensemble.

Mesuré après correction : **0 bouton de statut gelé sur 400** hors de l'onglet,
**15 sur 15** dedans.

### Puis Maxime a regardé l'écran, et a vu un défaut plus ancien

⚠️ **« Il garde tout sa même couleur »** — dans une liste filtrée, il ne
distinguait pas l'onglet où il se trouvait, ni le bouton engagé de son voisin.
Le défaut n'est pas né du coup de cœur : il datait du 29 août, et l'ajout d'une
sixième pilule l'a rendu visible.

**Son constat était juste, sa solution ne pouvait pas marcher** — il proposait
d'atténuer davantage les éléments au repos. La mesure a donné la cause :

| écart de clarté engagé/repos | violet | pêche | rose | menthe | jaune |
|---|---|---|---|---|---|
| avant | 8,4 | 6,0 | 5,4 | **1,5** | **0,8** |
| après | 17,2 | 18,3 | 18,4 | 18,0 | 18,1 |

Il faut ~10 points pour qu'une différence se voie sans comparer. Or **atténuer sur
fond clair éclaircit**, et le jaune (L\*91) comme la menthe (L\*89) sont déjà
presque blancs : à 35 % d'opacité, le jaune ne gagnait que 1,3 point. **La seule
direction libre était vers le bas** — assombrir l'engagé, pas éclaircir le repos.

Quatre options ont été construites pour de vrai et soumises à Maxime, qui a
composé la sienne : **teinte foncée pour l'onglet où l'on est, éclairci pour les
autres**, et **décoloration de l'option non retenue** dans les lignes.

⚠️ **Deux garde-fous ont dû être posés par-dessus sa demande :**

1. **Le violet de l'option choisie tombait à 4,44:1**, sous le plancher. Éclairci
   à 4,64:1 ; l'écart passe de 18 à 17,2 points, ce qui ne se voit pas.
2. ⚠️ **Sa règle de décoloration vidait l'écran principal.** « L'option non
   retenue perd sa couleur » marche dans la liste « Écarté », mais dans « À
   traiter » — **576 offres sur 580** — aucun bouton n'est actif : les deux se
   décoloraient. Les deux rendus ont été construits côte à côte et Maxime a
   tranché devant eux : la décoloration ne joue **que lorsqu'une décision
   existe**.

⚠️⚠️ **Et un troisième, qu'aucune demande ne pouvait anticiper : les teintes
assombries ne s'appliquent qu'en mode CLAIR.** En sombre, l'engagé est le pastel
plein — le plus clair — et le repos s'atténue vers le fond : l'écart y valait déjà
12 à 15 points. Les y poser l'aurait ramené à **0,3 sur le rose, 0,7 sur le
pêche** : elles auraient reproduit en sombre le défaut exact qu'elles corrigent en
clair. Une phrase résume la cause : *atténuer éclaircit sur fond clair et
assombrit sur fond sombre.*

⚠️ **Une mesure fausse a précédé la bonne, et c'est le piège du 29 août qui
remord.** Le premier relevé annonçait « 67,7 points d'écart » partout — un chiffre
absurde qui aurait dû alerter tout de suite. Cause : Tailwind rend les fonds
atténués en `oklab()`, et lire les nombres de la chaîne CSS revient à prendre
`(0.79, 0.06, -0.10)` pour du RGB, donc du quasi-noir. **Le seul convertisseur
fiable est un canvas 1×1** : on y peint la couleur sur son fond réel et on relit
les octets. C'est aussi lui qui règle l'alpha, qu'aucune lecture de chaîne ne
compose.

### Ce qui a été éprouvé

- Le clic écrit bien en base, et le compteur de l'onglet suit (4 → 5).
- ⚠️ **Le double clic à coordonnées fixes** (`page.mouse.click(x, y)`, deux fois
  au même pixel à 120 ms d'intervalle) dans l'onglet « Coup de cœur », où retirer
  un cœur fait disparaître la ligne : **une seule offre retirée**. Le verrou de
  tri, qui semblait inutile pour un like, est indispensable ici — c'est le seul
  onglet où le coup de cœur est aussi un critère de sortie.
- La transversalité, sur données réelles : une offre **écartée ET coup de cœur**
  figure bien dans l'onglet. C'est précisément ce qu'un quatrième statut aurait
  rendu impossible.
- **Mesure de sécurité refaite** (règle n° 4) : douze noms de colonnes cherchés
  dans le document complet — flux RSC compris — sur quatre écrans. **Zéro
  trouvée**, témoin positif valide.
- Console propre sur les cinq routes, `verifie` au vert (93 tests, deux fuseaux).

---

## 30 août 2026 — L'enrichissement automatique passe de « reporté » à REFUSÉ

Maxime demande de vérifier qu'aucun document ne prévoit d'enrichir « la meilleure
offre automatiquement chaque jour », et de l'enlever le cas échéant. Vérification
faite : **c'était déjà retiré de la v1** depuis le 16 août, et les quatre documents
qui font autorité le disaient — PRD, PLAN, DECISIONS, CLAUDE.md.

**Mais la porte était entrouverte, et elle s'ouvrait toute seule.** La phase
figurait en *Évolutions prévues* du PRD avec une condition de retour écrite noir
sur blanc : *« quand les seuils auront été calibrés sur des données réelles et que
le coût par enrichissement aura été mesuré »*. Or ces deux chiffres, la v1 venait
de les produire — 149 offres notées, et le coût du pipeline mesuré au token près le
matin même. Un relecteur de bonne foi, dans six mois, aurait trouvé la condition
remplie et proposé la fonctionnalité.

**Décision de Maxime : la ligne passe en Hors périmètre, la condition disparaît.**
Ni « la meilleure offre chaque jour », ni « au plus deux par nuit », ni aucune
règle de sélection automatique. Le motif a changé de nature en chemin : en août
c'était le coût et des seuils non calibrés — deux objections que le temps règle —
maintenant c'est le **déclencheur**. Enrichir se décide en lisant une offre qui
accroche, et cela ne se devine pas. Cette objection-là ne se périme pas.

⚠️ **Ce qui ne change pas** : la colonne `declenchement` reste prévue sur la trace
d'enrichissement, même si elle ne portera jamais que « manuel ». Elle sert à
l'écran de suivi d'exploitation. La retirer serait confondre « on ne fera pas
d'automatique » avec « on ne tracera pas ce qu'on fait ».

**La leçon de méthode** : une évolution « reportée sous condition » n'est pas un
refus, c'est un compte à rebours. Quand la condition est un chiffre que le produit
lui-même fabrique, elle finit forcément par se remplir — et personne ne revient
demander si l'intention initiale tenait toujours.

## 30 août 2026 — L'employeur réel, lu dans le texte de l'annonce

**Le constat vient de Maxime, devant l'écran du matin** : une offre affichait
« NEW NET 3D », et le clic vers France Travail montrait un cabinet recrutant pour
Wavestone. Son œil ne s'est pas trompé sur le problème — mais l'objet qu'il
désignait n'en était pas la cause. NEW NET 3D n'est ni l'employeur, ni même
l'intermédiaire : la description dit « En tant qu'organisateur de forums de
recrutement, **Talents Handicap** accompagne […] L'entreprise **Wavestone**
recherche actuellement des profils ». Trois entités, et le champ officiel en
nommait une quatrième.

**Mesure avant décision**, sur les 580 offres : `entreprise_nom` est absent sur
**229 (39 %)**, 47 % des offres notées ; **206 descriptions (36 %)** portent un
motif d'intermédiaire, dont 185 pour le seul « notre client ». Le nom réel, lui,
est presque toujours dans le texte.

### Ce qui a été construit

Migration 8, purement additive : `entreprise_identifiee` et
`entreprise_intermediaire`. L'extraction entre **dans l'appel de notation qui
existe déjà** — deux champs de plus en sortie coûtent ~0,03 centime l'offre, un
second appel dix fois ça pour relire le même texte. *On ne paie pas deux fois la
lecture d'un document qui n'a pas changé.*

**Le cœur du module est le garde-fou déterministe.** Demander « quelle est
l'entreprise ? » à un modèle finit par en produire une, même quand l'annonce
n'en nomme aucune. `verifier()` cherche donc le nom rendu **dans le texte
envoyé** et le jette s'il n'y est pas. Éprouvé sur les vraies annonces :
« Capgemini » rejeté, « Groupe Wavestone » rejeté — le modèle avait enjolivé.

### Quatre défauts trouvés en les cherchant

1. **La consigne confondait ESN et cabinet de recrutement.** « L'entreprise chez
   qui la personne travaillerait » est ambigu : chez une ESN on est *employé par*
   l'ESN et on *travaille chez* son client. Le modèle rendait `null` sur LORDS IT,
   et aurait pu afficher le nom d'un client final chez qui Maxime n'aurait pas été
   salarié. Corrigé en distinguant explicitement les deux cas.
2. **Le rattrapage refacturait les offres sans employeur trouvable** (revue de
   code). Le filtre portait sur le nom ; quand le modèle répond `null` — 3 offres
   sur 18 — la colonne restait vide et l'offre ressortait à chaque relance. Le
   filtre porte désormais sur le drapeau, qui dit « déjà regardée ».
3. **Le regroupement de `/` était aveugle au nouveau nom** (revue de code). Deux
   annonces anonymes de même intitulé mais d'employeurs identifiés différents
   restaient groupées : un clic sur « Écarté » aurait classé une offre jamais vue.
4. **La vérification acceptait un fragment de mot** (revue de code). `verifier("IA")`
   passait, et comme le nom identifié l'emporte, il aurait remplacé un nom correct
   par deux lettres. Bornes 3–120 caractères et frontières de mot ajoutées.

### Deux leçons de méthode

⚠️ **Un contraste mesuré juste après un changement de thème en JavaScript est
faux.** Poser `data-theme="dark"` puis lire les styles dans la même foulée donne
un état intermédiaire : le fond était recalculé, la couleur du texte pas encore.
Mesure annoncée à 3,18:1, réelle à **8,95:1** après rechargement. Variante du
piège déjà connu sur `oklab()` — **un thème se mesure sur une page rechargée.**

⚠️ **Le modèle rend la forme COURTE quand c'est elle qui figure dans le texte** —
« IPPON » là où France Travail disait « IPPON Technologies ». La règle
« l'identifié l'emporte » remplaçait donc un nom complet par son abréviation.
Ce n'est pas une correction : c'est le même employeur, écrit moins bien.

### Résultat du premier rattrapage

18 offres à traiter au-dessus de 35, **15 identifiées, 0 échec** : 4 comblées
(France Travail muet), 3 corrigées (Wavestone ×2, Atos), 6 confirmées, 2 abrégées
et rattrapées à l'affichage. ~16 centimes, essais compris.

⚠️ **Constat non traité** : `entreprise_intermediaire` varie d'un appel à l'autre
sur la même offre — `6426819` marquée `true` puis `false` à quelques minutes
d'écart. Le champ n'alimente que la phrase de provenance ; ne rien bâtir de
structurant dessus sans l'éprouver.

## 16 août 2026 — Cadrage, design, plan

**`/cadre`** : critères de recherche, notation à deux axes, forme du livrable,
stack et règles de sécurité tranchés dans `docs/DECISIONS.md` ; périmètre produit
dans `docs/PRD.md` (37 user stories, 13 critères de succès).

**`/design`** : la tension entre les deux publics — Maxime qui veut lire vite le
matin, le lead technique en entretien à qui un tableau de bord gris ne fait aucun
effet — est tranchée par la direction **éditorial technique** : chaud dans la
matière, froid dans la précision. Détail dans `docs/DESIGN.md`.

**`/planifie`** : découpage en **sept** tranches verticales. Deux amendements
consignés — l'écran du matin n'affiche que la collecte de la nuit (et non plus
tout ce qui reste à traiter), et l'enrichissement **manuel se construit avant
l'automatique**. La huitième phase, l'enrichissement automatique nocturne, est
retirée : elle dépensait sans supervision sur des seuils non calibrés.

## 17 août 2026 — Installation de la stack

**`/installe`**, sur la branche `installation-stack`, fusionnée dans `main`.

Le preset `nova` avait écrasé plusieurs décisions du `DESIGN.md` — palette grise à
la place de la palette chaude, Fraunces absente, `--font-heading` pointé vers la
police sans-serif, `--radius` à 0.625rem. Toutes rétablies et vérifiées par
commande.

Corrections annexes : `lang="fr"` au lieu de `"en"` (un lecteur d'écran prononçait
le français avec une phonétique anglaise), `font-feature-settings` et le bloc
`prefers-reduced-motion` ajoutés.

Vérifié à l'écran : bureau et 375 px, mode clair et sombre, console vide,
`npm run build` passant.

## 17 août 2026 — Mise en service des hébergements

**Supabase** : projet `veille-offres-emploi-ia` créé en région **Paris**. Réglages
retenus à la création — **RLS automatique activé**, **exposition automatique des
nouvelles tables désactivée**. Deux verrous indépendants, pour qu'un oubli ne
suffise pas à ouvrir une table au monde. Connexion vérifiée en HTTP 200 avec la
clé secrète.

**Vercel** : déployé sur https://veille-offres-emploi-ia.vercel.app, avec
`Root Directory = interface` et les fonctions en région **cdg1 (Paris)**. Fluid
Compute activé.

Comportement des déploiements : chaque `push` sur `main` met le site à jour ; une
branche poussée obtient une adresse d'aperçu séparée ; une compilation qui échoue
ne remplace pas la version en ligne ; `Deployments → Promote to Production` sur un
déploiement antérieur rétablit le site en quelques secondes.

**Nommage des clés Supabase** : `anon` / `service_role` sont l'ancienne
génération, dépréciée fin 2026. Le projet utilise `sb_publishable_` /
`sb_secret_`, révocables une par une là où les anciennes se révoquaient en bloc.
`SUPABASE_SERVICE_ROLE_KEY` est renommée `SUPABASE_SECRET_KEY` partout.

**Décision Git** : après avoir fait le geste complet une fois (brancher,
développer, demander la fusion, fusionner), on **travaille directement sur
`main`**. Seul sur le dépôt, une demande de fusion qu'on s'adresse à soi-même
n'apporte aucune relecture et ralentit sans rien protéger.

## 20 août 2026 — Outillage

Skill **`next-best-practices`** (vercel-labs) installée dans `.agents/skills/`.
Elle a immédiatement révélé un piège : en **Next 16, `middleware.ts` devient
`proxy.ts`** et `config` devient `proxyConfig`. La documentation du projet parlait
encore de middleware — corrigé.

**Correction d'une justification fausse** : « Vercel est un environnement
JavaScript, il n'héberge pas un processus Python » était erroné. Vercel exécute du
Python et propose des sandboxes conçus pour les agents, démarrant en
millisecondes. Le vrai argument en faveur de GitHub Actions est la durée (6 h
contre 300 s en offre gratuite), la gratuité sur dépôt public et un workflow
versionné donc visible d'un recruteur. Ce qu'on laisse sur la table — la latence
au clic sur « Enrichir » — est un arbitrage assumé, pas une impossibilité.

## 20 août 2026 — Phase 1, collecte à blanc contre l'API France Travail

Avant de figer le schéma, un script jetable (hors dépôt) a interrogé l'API sur
**50 offres réelles**, sans rien écrire nulle part. Concevoir les tables avec la
matière sous les yeux plutôt que d'après la documentation. Détail complet dans
`docs/API_FRANCE_TRAVAIL.md`, qui ne porte plus aucune mention « non vérifié ».

**Ce qui était ouvert et qui est tranché :**

- **`experienceExige` existe bien en champ structuré** — `D` (débutant accepté,
  26/50) et `E` (exigée, 24/50), doublé de `experienceLibelle` en clair
  (`Débutant accepté`, `2 An(s)`…). `S` (souhaitée) attendu mais non observé : le
  code doit tolérer une valeur inconnue. L'échelle de pénalité par années
  d'expérience du `DECISIONS.md` § 1 se branche dessus **sans faire lire le
  modèle**.

**Ce qui invalide une hypothèse écrite ailleurs :**

- **La description est plafonnée à 5 000 caractères** — 5 offres sur 50 sont
  coupées à 5 000 pile, en plein mot. `GET /offres/{id}` renvoie **le même texte
  tronqué et aucun champ supplémentaire** : il n'existe pas de version longue.
  Donc **pas d'appel de détail par offre**, `/search` suffit — un appel économisé
  par offre. Le contenu de test du `PLAN.md` visait 20 000 caractères : corrigé à
  5 000.
- **44 % des offres ne nomment pas l'entreprise** (28/50 seulement), et **54 %
  n'indiquent aucun salaire** (23/50). Ce sont les cas normaux, pas les cas
  limites. Aucun repli disponible : quand `entreprise.nom` manque, `contact.nom`
  manque aussi. Le `DESIGN.md` place l'entreprise en tête de ligne d'offre — cet
  emplacement sera vide une fois sur deux, il lui faut un traitement propre.
  Annonce aussi la difficulté de la phase 6 : identifier l'employeur sans son nom.

**Ce qui touche la sécurité :**

- ⛔ **Le champ `contact` porte des données personnelles au sens du RGPD** —
  nom de personne physique, adresse postale, courriel, URL de postulation
  nominative — sur 50 offres sur 50. **Écarté à la collecte, pas à l'affichage** :
  filtré seulement à l'affichage, il serait quand même écrit en base et dans les
  journaux d'exécution.

**Trois pièges d'appel, vérifiés :**

- **Zéro résultat = HTTP 204, corps entièrement vide**, `Content-Range: */0`. Un
  `.json()` dessus lève une exception. C'est le jour calme, pas une panne.
- **`departement` est plafonné à 5 valeurs**, l'Île-de-France en compte 8 →
  `region=11` est la seule voie.
- **`minCreationDate` et `maxCreationDate` sont indissociables** ; l'un sans
  l'autre renvoie une HTTP 400.

**Volume réel** : 6 offres créées en 24 h sur « intelligence artificielle » en
Île-de-France (246 au total, toutes dates confondues). Le régime quotidien se
compte en unités — le plafond de pagination de 1 150 ne sera jamais approché.

### Schéma — décisions prises en séance avec Maxime

- **`offres.identifiant` = l'identifiant France Travail en clé primaire.** Le
  risque d'adopter une clé produite par un tiers est écarté par une décision
  produit déjà écrite : « toute source d'offres autre que France Travail » est au
  hors périmètre opposable du PRD. En échange, la déduplication de US-34 est
  garantie par le moteur (`on conflict do nothing`) et non par du code Python.
  Contrainte de forme `^[0-9A-Z]{7}$` — la valeur arrivera un jour de la barre
  d'adresse.
- **La ligne d'`executions_veille` s'écrit au démarrage, se complète à la fin.**
  Écrire à la fin obligerait à tout garder en mémoire (la clé étrangère exige que
  l'exécution existe avant la première offre) et **un plantage ne laisserait
  aucune trace** — la panne deviendrait indistinguable d'une nuit calme, contre
  US-24, US-25 et US-37. Conséquence : `terminee_a`, le motif et les compteurs
  doivent tolérer le vide.
- **Contrepartie assumée** : un processus tué net laisse une ligne bloquée en
  `en_cours`. Traitée à deux endroits — le pipeline referme au démarrage les
  `en_cours` trop vieilles en `echec`, et l'interface ne compte jamais un
  `en_cours` comme une réussite.
- **Pas de colonne `duree`**, contrairement à ce qu'annonçait le `PLAN.md` : elle
  se calcule (`terminee_a - demarree_a`). Une valeur dérivée stockée est un
  endroit où la vérité peut diverger.
- **Pas de colonnes de tokens ni de modèle en phase 1.** Rien ne les alimente
  avant la phase 2, et ajouter une colonne qui tolère le vide est instantané, sans
  verrou et sans effet sur le code existant. La règle « un historique ne se
  reconstitue pas » du PRD porte sur les **données**, pas sur les colonnes.
- **`echec_toujours_motive`** : contrainte `check` interdisant un `echec` sans
  motif. US-25 gravée dans le moteur plutôt que confiée à la discipline.
- **`timestamptz` partout, jamais `timestamp`.** GitHub Actions tourne en UTC et
  le navigateur est à Paris : une collecte de 4 h s'afficherait « 02:00 » en été.

## 20 août 2026 — Le schéma est en base

Deux migrations versionnées, appliquées sur le projet Supabase de production.
`executions_veille` et `offres` existent. `enrichissements` et
`etapes_enrichissement` sont **reportées à la phase 6** — entorse assumée au
critère d'acceptation du `PLAN.md`, validée en séance : leur forme dépend de ce
que l'agent produira réellement, rien ne les alimente d'ici là, et la collecte à
blanc venait justement de montrer que France Travail fournit déjà gratuitement
plusieurs informations que l'enrichissement devait aller chercher.

**Outillage** : CLI Supabase via `npx supabase@2.115.0`. Homebrew a refusé de
l'installer — les Command Line Tools de la machine datent de 2023. `npx` évite la
mise à jour et épingle la version dans le dépôt plutôt que de la laisser flotter.

### La migration corrective — le vrai enseignement de la séance

La migration initiale a été poussée avec succès… et **le serveur ne pouvait
lire ni écrire dans aucune des deux tables**. `service_role`, le rôle porté par
`SUPABASE_SECRET_KEY`, n'avait aucun droit dessus.

Cause : le projet a été créé avec **« exposition automatique des nouvelles
tables » désactivée** (voir l'entrée du 18 août). Aucune permission n'est donc
accordée par défaut sur une table neuve — à personne, `service_role` compris. Le
réglage était noté dans ce journal ; sa conséquence, non.

**Ce qui l'a trouvé** : essayer d'écrire dans la base. Pas relire le SQL, qui
était syntaxiquement irréprochable et validé par `libpg_query`. Sans cette
vérification, la panne serait apparue à la première exécution du pipeline, sous
la forme d'un `permission denied` que rien n'aurait relié à une case cochée des
semaines plus tôt.

**Corrigé par une migration suivante, jamais en modifiant la première.** Une
migration appliquée est déjà dans la base : la réécrire ne défait rien et fait
diverger git de la réalité.

### Vérification — 18 contrôles, tous au vert

Le schéma n'a pas été relu, il a été **attaqué** :

| Ce qu'on a tenté | Réponse de la base |
|---|---|
| Lire `offres` avec la clé publiable | **HTTP 401** — critère d'acceptation n° 1 satisfait |
| Écrire dans les deux tables avec la clé publiable | **HTTP 401** |
| Enregistrer un `echec` sans motif | Refusé — `echec_toujours_motive` |
| Écrire une issue inventée (`succes`) | Refusé — `issue_connue` |
| Terminer une exécution avant de l'avoir commencée | Refusé |
| Identifiant mal formé (`test99`) | Refusé — `identifiant_bien_forme` |
| Rattacher une offre à une exécution inexistante | **HTTP 409** — clé étrangère |
| Écrire une offre sans son archive `charge_brute` | Refusé |
| Insérer deux fois la même offre | Une seule ligne — déduplication US-34 garantie par le moteur |
| Supprimer une exécution portant des offres | **HTTP 409** — `on delete restrict` |

Base laissée vide après nettoyage.

**Deux verrous indépendants sur l'autorisation**, et c'est délibéré : RLS activé
sans aucune politique, *et* tous droits retirés à `anon` et `authenticated`. Un
seul suffirait en théorie. Deux font qu'une politique ajoutée par erreur un jour
n'ouvre toujours rien, parce qu'il n'y a aucun droit dessous.

## 20 août 2026 — Méthode : capitaliser les notions, et qui écrit quoi

**Un dossier `Apprentissage/` est ouvert dans le coffre Obsidian de Maxime**, avec un
sous-dossier par sujet. Les notions techniques comprises en séance y vont, une par fichier,
courtes. Quatre notes déposées : clés primaires et étrangères · migrations · CLI et MCP ·
accès aux données serveur ou navigateur.

Distinct de `docs/`, et les deux se complètent : `docs/DECISIONS.md` dit pourquoi **ce**
projet a tranché ainsi, `Apprentissage/` dit **comment ça marche en général**. Motif : il ne
relit ni le code ni les `.md` du dépôt, mais il rouvre son coffre quand il a un doute ou
qu'il prépare un entretien.

**Erreur corrigée en séance** : la première note groupait « CLI, MCP et migrations ».
Maxime a fait remarquer qu'une migration est une notion de base de données et n'a rien à
voir avec CLI/MCP. Découpée en deux. La règle en découle — **une notion, un fichier** ; ne
jamais grouper deux sujets parce qu'ils sont tombés dans la même conversation, ils ne se
relisent pas au même moment.

### Qui écrit le code — position de Maxime, et ce qu'elle impose

**Il n'écrira pas les requêtes.** Argument : écrire du code est dévalué puisque l'IA écrit ;
ce qui compte est de savoir que la chose existe, à quoi elle sert et comment elle casse,
pour localiser une panne et savoir quoi demander.

**L'argument tient — à une substitution près, qui a été posée explicitement : écrire est
dévalué, lire ne l'est pas.** Localiser une panne demande d'ouvrir le fichier et de suivre
le fil. Savoir que « la pagination existe » ne dit pas qu'une ligne teste `== 200` au lieu
de `in (200, 206)` et rate une page sur deux, silencieusement.

**Deuxième compétence, non nommée par lui et ajoutée au marché** : reconnaître une vraie
preuve. La migration du jour était validée par l'analyseur officiel de PostgreSQL et
créait pourtant des tables illisibles par le serveur. Son seul garde-fou est de pouvoir
demander « tu l'as lancé, ou tu l'as juste relu ? ».

**Signalé une fois, sans y revenir** : beaucoup d'entretiens techniques comportent encore un
exercice en direct. On peut avoir raison sur l'évolution du métier et échouer au filtre.
C'est son arbitrage.

**Accord retenu** : j'écris les requêtes · une note de diagnostic en fin de phase (les
formes de code du projet, ce que chacune dit en français, comment elle casse, le symptôme à
l'écran) · trois questions à la fin de chaque module · une lecture de module à voix haute
par phase.


## 21 août 2026 — Le pipeline de collecte, et ce que l'API cachait

**Étape 2 sur 6 de la phase 1 livrée.** `pipeline/` existe, tourne contre les
vraies API, et 43 offres réelles sont en base.

### La mesure qui a tout réorienté

Maxime a posé une question de fond avant qu'on code : *si on oublie un mot-clé,
on rate des offres — pourquoi ne pas tout faire lire par le modèle ?* La réponse
demandait des chiffres, pas un avis. Quatre séries de mesures contre l'API réelle
plus tard, trois découvertes, dont une qui invalidait une décision écrite.

**1. `motsCles` n'indexe pas la description.** Test : prendre un mot dans le corps
d'une annonce et le chercher. L'annonce ne remonte pas — 4 fois sur 4.
« polytechnique », présent noir sur blanc, renvoie zéro offre. La recherche porte
sur l'intitulé, le libellé ROME et un champ `competences` qu'on ne connaissait
pas.

Conséquence : `docs/DECISIONS.md` affirmait « la requête API reste large mais
bornée, et le tri est fait par le modèle ». **Faux tel quel** — le modèle ne peut
trier que ce que la requête a ramené, et la requête est aveugle au texte. Corrigé
dans le document, avec la mesure à l'appui.

**2. Le vocabulaire de France Travail est fermé, et français.** Les termes que
Maxime proposait — `IA générative`, `IA agentique`, `agent IA`, `POC IA`,
`intégration IA`, `LLM` — renvoient **tous zéro offre**. `chatbot`, `GenAI`,
`MLOps`, `OpenAI`, `ChatGPT`, `copilot` aussi. Seuls des termes courts et
courants répondent.

**3. `avant-vente` est un piège.** 299 offres — des postes de *Conseiller de
vente*, *Vendeur en animalerie*, *Réceptionnaire Après-Vente Automobile*. Le
moteur coupe le terme et matche « vente ». **Un mot-clé ne s'ajoute jamais sans
mesurer ce qu'il ramène.**

### Correction de cadrage de Maxime

Ma première proposition de mots-clés — `machine learning`, `deep learning`,
`data scientist`, `NLP`, `MLOps` — désignait des postes de **modélisation**. Il
vise les postes qui **branchent un modèle existant chez un client** : Forward
Deployed Engineer, AI Solutions Engineer, consultant IA, ingénieur
d'intégration. Ce n'est pas le même métier ni les mêmes entreprises. Liste
refaite.

### La décision, chiffrée

Trois largeurs de collecte, mesurées sur 7 jours réels :

| | Offres/jour | Notation | Ce qu'on rate |
|---|---|---|---|
| A — mots-clés seuls | 9 | ~0,80 $/mois | Les intitulés banals |
| **B — + familles ROME** (retenu) | ~28 | ~3 $/mois | Ce qui sort des familles informatiques |
| C — tout l'Île-de-France | 1 925 | **~173 $/mois** | Rien |

**B retenu.** Le code ROME est un filtre *structurel* : il attrape « Ingénieur
études et développement » sans dépendre des mots de l'annonce, et le modèle lit
ensuite la description — le travail que la recherche ne sait pas faire.

⚠️ **Honnêteté sur la mesure** : sur la semaine testée, B n'aurait trouvé aucune
offre IA que A ratait. C'est une assurance à 2 $, pas un gain démontré. À
réévaluer quand la veille aura deux semaines d'historique.

### Ce qui a été construit

Cinq modules, un métier chacun : `config.py` (trousseau de clés, échoue au
démarrage jamais au milieu) · `client_france_travail.py` (le seul qui téléphone
à France Travail) · `normalisation.py` (le seul qui jette les données
personnelles) · `stockage.py` (le seul qui écrit en base) · `collecte.py` (le
chef d'orchestre). Plus deux fichiers de critères versionnés et éditables sans
toucher au code.

**Accès à Supabase par l'API REST, pas par connexion Postgres directe** : le
pipeline tournera chez GitHub, et l'accès direct réclamerait en plus le mot de
passe du schéma. Un secret de moins en circulation.

**Fenêtre de collecte auto-cicatrisante** : elle repart de la dernière exécution
*réussie* moins une heure de recouvrement, plafonnée à 30 jours. Trois jours de
panne se rattrapent au lieu de se perdre.

### Une fuite de donnée personnelle trouvée et fermée

Quand Postgres refuse une ligne, PostgREST recopie **la ligne entière** dans le
champ `details` de son erreur :

```
"Failing row contains (mauvais, 7, X, …, Mme Caroline COQUET, https://…, …)"
```

Le journal de GitHub Actions est **public** sur ce dépôt. Une erreur d'insertion
journalisée telle quelle y publierait le nom d'une personne. `stockage.py` ne
garde que le `code` et le `message` ; jamais `details` ni `hint`. **Vérifié en
provoquant la violation** : le message rendu ne contient rien de personnel.

### Migration `competences`

Colonne ajoutée par une migration suivante — la première n'a pas été retouchée.
⚠️ Le champ n'est rempli que sur **6 %** des offres (3 sur 43). Utile quand il
est là, jamais une valeur sur laquelle compter. Il justifie surtout une chose :
il explique *pourquoi* la recherche se comporte comme elle se comporte.

### Vérifié comment

Pas relu — **attaqué**, méthode du 20 août :

| Ce qu'on a tenté | Réponse |
|---|---|
| Collecte réelle contre les deux API | 43 offres reçues, 43 écrites |
| La relancer immédiatement | 0 nouvelle — déduplication par le moteur |
| Identifiant mal formé, description vide, date absente | Écartés à la normalisation, la nuit continue |
| Clé étrangère inexistante | HTTP 409, message sans donnée personnelle |
| `echec` sans motif · issue inventée | Refusés |
| Identifiants France Travail faussés | `echec` motivé, code 1, aucun `en_cours` |
| Exécution laissée `en_cours` | Refermée au démarrage suivant |
| Lecture des offres avec la clé publiable | **HTTP 401** |
| `contact` dans une archive `charge_brute` | **0 sur 43** — ni courriel, ni adresse, ni téléphone |

**Non vérifié en conditions réelles, et dit comme tel** : le renouvellement de
jeton en milieu de pagination (le jeton dure 25 min, aucune collecte n'y arrive)
et le HTTP 429 (la temporisation de 0,25 s l'empêche). Les deux sont écrits et
relus, pas déclenchés.

### `/code-review` — 15 défauts, dont un que je venais d'introduire

Le module a été relu par un agent de revue. **Rien n'a été annoncé avant.**
Sept défauts touchaient la correction ou la sécurité :

| Défaut | Ce qui serait arrivé |
|---|---|
| **Journal d'une offre brute** (que je venais d'ajouter en « corrigeant » autre chose) | Une offre sans identifiant faisait journaliser le dict brut — `contact` non encore retiré. **Nom et courriel publiés dans un journal GitHub Actions public.** Remplacé par un compteur |
| **HTTP 204 en milieu de pagination** | Page 1 rend 150 offres, page 2 rend 204 (offres dépubliées entre deux appels) → `return []` jetait les 150. Le journal disait « aucune offre », indistinguable d'une nuit calme |
| **`--sans-ecrire` écrivait** | Il appelait `refermer_executions_orphelines`, un PATCH. Lancé pendant la collecte nocturne, il marquait l'exécution vivante en `echec` — puis concluait « Rien n'a été écrit » |
| **Plafond de pagination testé sur le mauvais compteur** | Le plafond porte sur l'index demandé, pas sur les offres reçues. Dès qu'une page rendait moins de 150 résultats, un `range` au-delà de 1149 partait → HTTP 400 → **toute l'exécution en échec**, les 10 autres critères perdus |
| **Refermage des orphelines sans seuil d'âge** | Un lancement manuel pendant le cron déclarait `echec` une exécution vivante, avec un motif mensonger. Seuil posé à 6 h |
| **`_erreur_assainie` plantait sur un corps non-objet** | Un 502 dont le corps est `["gateway error"]` levait une `AttributeError` **depuis le gestionnaire d'erreur**, effaçant la panne d'origine |
| **`fermer_execution` ne vérifiait rien** | Un PATCH qui ne touche aucune ligne renvoie 204 — succès apparent. Job GitHub au vert, aucune trace en base |

Quatre autres corrigés : HTTP 429 sans réessai (un 429 sur le 9ᵉ critère jetait
les 8 déjà collectés) · `Content-Range` absent qui tronquait en silence ·
`--depuis-jours` négatif ou nul non validé · horloge murale au lieu de
monotone dans la temporisation.

Deux relevaient de la conception, corrigés aussi : le garde-fou `NEXT_PUBLIC_`
était posé dans le pipeline, qui ne rend aucune page — il ne protégeait rien et
pouvait annuler la collecte pour une variable étrangère au projet ; les délais
réseau et la région étaient dupliqués entre modules.

**Une migration en plus** : `offres_rejetees`. Les motifs de rejet étaient
calculés puis jetés (`lignes, _ = normaliser_lot(...)`). Une nuit à 12 rejets
sur 40 enregistrait un écart indistinguable de 12 doublons. Le commentaire de
`offres_recues` a été précisé au passage : ce sont les offres **distinctes**,
après union des critères.

**Un défaut reste, sans correctif propre** : l'écriture par lots de 50 n'est pas
atomique, et l'API REST n'expose pas de transaction. Si le lot 3 échoue, les
lots 1 et 2 sont écrits et rattachés à une exécution marquée `echec` — ces
offres ne seront jamais « nouvelles » sur aucun écran. Le compte partiel est
désormais remonté dans le motif d'échec, faute de mieux. À rouvrir si le cas se
produit.

**Corriger a introduit un bug de plus, trouvé en exécutant** : le `+` de
`+00:00` dans une chaîne de requête est interprété comme une espace, et Postgres
refusait la date du seuil d'ancienneté. Invisible à la relecture. Et mon premier
correctif du plafond de pagination était lui-même faux — il demandait encore
l'index 1199. Vérifié sur trois tailles de page avant d'être déclaré bon.

**État final** : 67 offres réelles en base, 4 exécutions tracées, compteurs
justes.

### Le recollage des offres orphelines — et un bug d'horloge trouvé en le testant

**Décidé avec Maxime le 21 août 2026.** Le défaut « écriture par lots non
atomique » laissé sans correctif est refermé.

**Le problème, reformulé.** Une nuit écrit 100 offres puis échoue. Les 100 sont
en base, rattachées à une exécution `echec`. Or « Nouveau » se définit par
l'appartenance à la dernière exécution *réussie* : ces offres n'apparaissent sur
aucun écran du matin, et la nuit suivante ne les réécrit pas
(`on conflict do nothing`). **Invisibles pour toujours.**

**La piste écartée, proposée par Maxime** : définir « Nouveau » par une date
plutôt que par le lien. Écartée pour les raisons déjà écrites au `PLAN.md` —
deux exécutions le même jour mélangeraient une collecte ratée avec une réussie,
et une offre cesserait d'être nouvelle toute seule au bout de 24 h, même jamais
regardée. L'offre ne porte d'ailleurs aucune date de collecte : c'est le lien
vers l'exécution qui la porte.

**Le correctif retenu** : `recoller_offres_orphelines()`. Au terme d'une
collecte aboutie, les offres pointant vers une exécution `echec` sont rattachées
à l'exécution en cours. Elles apparaissent le lendemain, avec un jour de retard.
Idempotent — une fois recollées, elles pointent vers une réussite et ne sont
plus reprises.

⚠️ **Contrepartie assumée** : on réécrit l'histoire. L'offre a été *trouvée* par
l'exécution ratée, on note qu'elle l'a été par la suivante. Le lien sert à
décider ce qui s'affiche le matin, pas à établir une chronologie ; l'archive
`charge_brute` garde la réponse d'origine.

**Les deux mécanismes se composent** : une exécution tuée net reste `en_cours`,
`refermer_executions_orphelines` la passe en `echec` au bout de 6 h, et le
recollage la ramasse la nuit d'après.

#### Le bug d'horloge, trouvé en écrivant le test

Le test du recollage a fait sauter la contrainte `terminee_apres_demarree`.
Cause : `demarree_a` a pour valeur par défaut le `now()` de **Postgres**, et
`terminee_a` était posé avec `datetime.now()` de **la machine locale**. Mesure du
21 août : cette machine est **186 ms derrière** le serveur Supabase.

Conséquence en production, pas seulement en test : **toute exécution bouclée en
moins de 186 ms** — une nuit calme sans nouvelles offres — voyait sa fin
précéder son début et se faisait refuser. La collecte partait en échec pour une
nuit parfaitement normale.

Corrigé en confiant les deux horodatages au serveur : la chaîne `'now'` est une
valeur spéciale que Postgres résout lui-même à l'heure de la transaction.

**Leçon transférable** : comparer deux horodatages venus de deux horloges
différentes est un bug, même quand les deux horloges sont « à l'heure ».
Invisible à la relecture, invisible en développement quand la collecte dure
plusieurs secondes, et il ne se serait manifesté qu'une nuit sans offres — la
nuit où on aurait justement conclu « rien n'est arrivé ».

### Remplissage manuel sur 7 jours, et un cas de test retiré

**189 offres réelles en base** après `--depuis-jours 7`. Maxime a préféré 7 jours à 30,
pour deux raisons dont une seule tient à la mesure.

*Son argument sur les offres périmées n'est pas confirmé* : l'API ne renvoie que les
offres encore actives, et les annonces de six jours reviennent en nombre (35, autant
qu'aujourd'hui). Trente jours auraient donné ~800 offres, toutes vivantes.

*Son argument de coût tient, mais il est petit* : noter 189 offres coûtera ~0,60 $ contre
~2,40 $ pour 800. Le vrai bénéfice est ailleurs — **relire 189 notes pour juger si le
modèle note juste, c'est quatre fois plus rapide que 800.**

**Un cas du contenu de test retiré, sur décision de Maxime** : « l'intitulé le plus long
que France Travail puisse renvoyer, environ 150 caractères ». Il n'existe pas. Maximum
mesuré : **99 caractères** sur 235 offres le 20 août, **79** sur 189 le 21 août. Ne pas
fabriquer un cas que la source ne produira jamais. Ce qui reste dû : vérifier la mise en
page à 375 px contre l'intitulé le plus long *réellement observé*.

**Contenu de test acquis, mesuré, à ne pas rechercher** : 5 descriptions à exactement
5 000 caractères (le plafond de l'API) · la plus courte à 419 · 6 formes de salaire plus
l'absence · **34 % des offres sans nom d'entreprise, 69 % sans salaire** — le vide est le
cas normal · CDI 149, CDD 10, intérim 18.

### Où en est le projet à ce moment de la journée

**Fait** : le schéma (2 tables, 4 migrations), le pipeline de collecte (5 modules,
1 166 lignes), 189 offres réelles en base, 8 exécutions tracées.

**Prochaine étape** : la porte — `/connexion`, `proxy.ts`, session. Étape 3 sur 6 de la
phase 1. C'est la première brique dont un défaut laisse le site ouvert.

*(Le travail ci-dessus était encore sur disque à cet instant. Il a été commité dans la
foulée — voir l'entrée suivante, écrite le même jour.)*

---

## 21 août 2026 — La porte

Étape 3 sur 6 de la phase 1. Première brique de l'interface dont un défaut
laisse le site ouvert : le site est en ligne depuis le 17 août, et la base
contient désormais 189 offres réelles.

### Ce qui a été construit

| Fichier | Métier |
|---|---|
| `interface/lib/session.ts` | Fabriquer le cookie, le relire, vérifier le mot de passe. **Sans aucune dépendance à Next.js**, pour être importable par le proxy comme par les pages |
| `interface/lib/acces.ts` | `sessionOuverte()` et `exigerSession()` — la serrure, côté page |
| `interface/proxy.ts` | La porte au niveau du réseau |
| `interface/app/connexion/` | L'écran, son action serveur, son état |

### Une session sans base de données

Le cookie contient sa propre échéance et une signature HMAC-SHA256 calculée
avec un secret serveur : `échéance.signature`. Le serveur ne stocke rien — il
recalcule la signature et refuse si elle ne colle pas.

L'alternative, un jeton en base, aurait coûté une table et une requête à chaque
page pour un seul utilisateur qu'on n'a jamais besoin de déconnecter à
distance. Rien d'autre ne voyage dans le cookie : il n'y a pas d'identité à
transporter.

**Session glissante** : le critère dit « 30 jours **d'inactivité** ». Le proxy
réémet le cookie dès qu'il a plus d'un jour. Sans ça, les 30 jours auraient
compté depuis la connexion, et une session utilisée tous les matins aurait
quand même expiré au trentième jour.

### Deux décisions prises contre la documentation

**1. Aucun `matcher` dans `proxy.ts`.** La documentation officielle de Next 16
montre `export const config` dans `proxy.ts`, là où notre `CLAUDE.md` et la
skill `next-best-practices` annoncent `proxyConfig`. Impossible de trancher
sans essayer — alors on n'a pas parié : sans matcher, le proxy s'exécute sur
*toutes* les requêtes et c'est le code qui écarte les exceptions.

Se tromper de nom de constante devient alors sans conséquence. Avec une liste
blanche d'adresses protégées, la même erreur aurait ouvert le site en silence.
Bénéfice observé immédiatement : `curl` sur `/api/enrichissements/190MTLR/etapes`,
une adresse qui **n'existe pas encore**, renvoie déjà 307 vers la porte.

**2. `node:crypto` et non Web Crypto.** Le proxy de Next 16 tourne en runtime
Node.js et **cela n'est pas configurable** — c'est `middleware.ts` qui tournait
en Edge. Le plan de séance annonçait Web Crypto par prudence ; vérification
faite dans la documentation, c'était inutile.

### La serrure n'est pas dans le proxy

`proxy.ts` redirige joliment, mais un middleware Next.js a déjà été
contournable par un simple en-tête HTTP (CVE-2025-29927, corrigée depuis). La
vérification qui compte est donc `exigerSession()`, appelée **dans** la page,
au plus près de ce qui s'affiche. `app/page.tsx` a été rebasculée en composant
serveur pour pouvoir l'appeler ; la page de contrôle de `/installe` est
descendue dans `app/_controle/`, un dossier privé hors routage.

### Le vrai vecteur d'attaque, et il n'est pas celui qu'on croit

En relisant, la justification « le proxy peut être contourné par un en-tête »
(CVE-2025-29927) est vraie mais faible : la faille est corrigée. La raison
concrète est ailleurs, et elle est structurelle.

**Une action serveur ne s'invoque pas par son adresse à elle**, mais par un
`POST` portant un en-tête `Next-Action` sur une route. Or `/connexion` est la
seule route que le proxy laisse passer sans cookie.

**Mesuré plutôt que supposé** — j'avais d'abord écrit que n'importe quelle
action serait appelable depuis n'importe quelle route. Le test dit autre chose :

| Requête | Résultat |
|---|---|
| Action de `/zztest` postée sur `/zztest`, sans session | **307** — le proxy bloque |
| Action de `/zztest` postée sur **`/connexion`**, sans session | **200, action non exécutée** |
| Action de `/zztest` postée sur `/`, sans session | **307** |
| Action de `/zztest` postée sur `/zztest`, **avec** session | 200, action exécutée |

Next 16 porte un **manifeste d'actions par route** : une action déclarée
ailleurs ne s'exécute pas sur `/connexion`. La surface est plus étroite que
craint.

⚠️ **Elle se rouvre dans deux cas**, et c'est pour ça que la règle tient quand
même : dès qu'un composant partagé rendu par `/connexion` — un en-tête commun,
demain — importera une action sensible, celle-ci entrera dans le manifeste de
`/connexion` · et ce cloisonnement est un détail d'implémentation de Next, pas
un contrat de sécurité documenté sur lequel s'appuyer.

Aucune action sensible n'existe encore — `connecter()` *est* la porte. Mais le
jour où « Enrichir cette offre » sera écrit, une action sans `exigerSession()`
en première ligne sera **déclenchable par un robot, aux frais de Maxime**.
Règle inscrite dans `CLAUDE.md` et dans l'en-tête de `lib/acces.ts`.

### Le bug que seule une capture d'écran a révélé

Le champ de mot de passe s'affichait **encadré de rouge dès le chargement**,
sans qu'aucune erreur ne soit survenue.

Cause : `app/connexion/actions.ts` porte la directive `"use server"`, qui
transforme **tout** ce que le fichier exporte en référence appelable à
distance — y compris une constante. `ETAT_CONNEXION_INITIAL` n'arrivait donc
pas au navigateur avec sa valeur, `etat.erreur` valait `undefined` au lieu de
`null`, et l'attribut `aria-invalid` était émis.

**Ni TypeScript ni `next build` ne l'ont signalé.** Correction : le type et la
constante vivent maintenant dans `app/connexion/etat.ts`, un fichier ordinaire.

Second piège dans la même ligne : le variant `aria-invalid:` de Tailwind réagit
à la **présence** de l'attribut, pas à sa valeur. `aria-invalid={false}` aurait
donc quand même déclenché le style d'erreur — d'où le `|| undefined`.

**Leçon transférable** : une directive de frontière (`"use server"`,
`"use client"`) change la nature de *tout* ce que le fichier exporte, pas
seulement des fonctions qu'on avait en tête en l'écrivant.

### Vérifié comment

**Cryptographie du cookie** — 7 cas, script Python qui forge des jetons avec le
vrai secret :

| Cas | Résultat |
|---|---|
| Jeton légitime | HTTP 200 |
| Un caractère changé dans la signature | 307 |
| Échéance repoussée à 10 ans, signature d'origine | 307 |
| Jeton bien signé mais expiré hier | 307 |
| Cookie vide · sans séparateur · échéance non numérique | 307 |

**Parcours au navigateur**, joué en développement **et** sur le build de
production (`next start`) :

- `/offres?statut=candidate` sans cookie → `/connexion?suite=%2Foffres%3Fstatut%3Dcandidate`
- Mauvais mot de passe → message affiché, **aucun cookie posé**, champ vidé
- Cinq tentatives ratées : 1362 / 1367 / 1376 / 1387 / 1384 ms
- Bon mot de passe → atterrissage sur `/offres?statut=candidate`, la destination mémorisée
- Cookie : `httpOnly` · `SameSite=Lax` · `path=/` · **`secure=true` en production**, `false` en développement · échéance à 30 jours · **invisible au JavaScript de la page** (vérifié via `document.cookie`)
- `?suite=https://exemple-pirate.test/vol` → atterrit sur `/`, la redirection ouverte est neutralisée
- Session glissante : cookie de 12 h non renouvelé, de 2 jours et de 25 jours renouvelés

**Trois moments de clic**, parce qu'un formulaire ne se soumet pas de la même
façon selon l'état du JavaScript :

| Moment | Résultat |
|---|---|
| **JavaScript désactivé** (repli progressif de React) | Message affiché, **aucun cookie posé** — la porte tient |
| Clic **avant** l'hydratation | `POST 200`, message affiché, aucun cookie |
| Clic après hydratation | Message affiché sans rechargement de page |

⚠️ Une première mesure de ce cas a donné un faux négatif : le navigateur avait
atterri sur un **second serveur Next du même projet**, laissé ouvert sur le port
3999 par une autre session. Vérifier l'hôte *et* le port d'une URL de test avant
de conclure à un défaut.

**Secrets manquants** (le cas « variable oubliée chez Vercel ») — serveur de
production relancé avec `.env.local` mis de côté : `/` renvoie toujours 307. La
porte se ferme, elle ne s'entrouvre pas. En isolation, `motDePasseCorrect()`
lève `ConfigurationManquante` sur un mot de passe absent, vide, ou de moins de
16 caractères — sans ce plancher, une variable oubliée aurait ouvert le site
**sur un champ vide**.

**Accessibilité et rendu**, à 375 px et en 1280 px, mode clair et mode sombre :

- Aucun débordement horizontal (`scrollWidth` = `innerWidth` = 375)
- Contrastes recalculés dans la page, sur canvas parce que les couleurs
  calculées sortent en `oklab` : message d'erreur **6,15:1** en clair et
  **4,85:1** en sombre · libellé 15,76 / 14,13 · texte d'aide 6,67 / 7,40 ·
  bordure de champ 6,15 / 4,83 (exigé 3:1) · bouton 11,07 / 11,67
- Focus clavier visible sur le champ et sur le bouton
- État de chargement : bouton désactivé, « Vérification… », champ figé sans
  perdre la saisie
- Console : **aucune erreur** sur `/connexion` ni sur `/`. La seule erreur
  observée est un 404 sur `/offres`, qui n'existe pas encore

### Deux à-côtés, tranchés en passant

**Le mode sombre n'avait aucun mécanisme** : la palette existait sous une classe
`.dark` que rien ne posait. Il suit désormais la préférence du système, par un
script de six lignes exécuté avant la peinture — sans lui, l'écran clignoterait
en clair avant de basculer. Pas de bascule manuelle : le PRD n'en demande pas.

**Un champ d'identifiant masqué** a été ajouté au formulaire. Chrome se
plaignait en console, et sans lui les gestionnaires de mots de passe
enregistrent une fiche bancale.

### `/code-review` — quatre défauts, tous corrigés

**1. Le focus clavier retombait sur `<body>` après une tentative ratée.** Le
champ portait `disabled={enAttente}` : React vide le formulaire, le champ
désactivé perd le focus, et plus rien n'est sélectionné. Il fallait re-cliquer
pour réessayer — et sur téléphone le clavier se referme. Corrigé : `readOnly`
au lieu de `disabled` (le champ reste dans l'ordre de tabulation, le bouton
désactivé suffit à empêcher une double soumission) et un effet qui ramène le
focus dans le champ. Vérifié : focus dans le champ pendant *et* après la
vérification, et la frappe reprend sans re-cliquer.

**2. Un `POST` d'action serveur sans session était redirigé en 307 — donc perdu.**
Le navigateur suivait la redirection jusqu'à `/connexion`, qui répondait `200`
avec un corps vide : le bouton cliqué ne faisait **rien du tout**, sans erreur
ni renvoi vers la porte. Le cas est réel : session expirée pendant la nuit,
onglet resté ouvert, clic le lendemain matin. Corrigé : le proxy répond
désormais **401** aux requêtes portant `Next-Action`, et ne redirige que les
navigations. Vérifié : `POST` avec `Next-Action` → `401 {"erreur":"session_absente"}`,
`GET` → toujours `307` vers la porte.

**3. `SECRET_SESSION` oublié = le bon mot de passe accepté, puis un 500 opaque.**
`lireJeton` ne lève pas quand il n'y a pas de cookie, donc la porte s'affichait
normalement et le mot de passe était validé — c'est `fabriquerJeton()` qui
échouait ensuite. La porte se fermait, mais au pire moment et sans rien
d'exploitable, **juste avant l'étape 5 qui consiste précisément à poser ces
variables chez Vercel**. Corrigé par `verifierConfiguration()` appelée en tête
de `connecter()`. Vérifié en lançant la production avec `SECRET_SESSION` vide :
message « Le site n'est pas configuré. Variable(s) d'environnement absente(s)
ou trop courte(s) : SECRET_SESSION. », aucun cookie posé.

**4. « Ce fichier ne s'exécute que sur le serveur » n'était qu'un commentaire.**
`destinationSure` est un utilitaire pur qu'un futur composant client aurait pu
importer, tirant tout le module et `node:crypto` dans le graphe du navigateur.
Corrigé par `import "server-only"` en tête de `session.ts` et `acces.ts`.
Vérifié en fabriquant exprès un composant client qui importe le module : le
build échoue avec *« 'server-only' cannot be imported from a Client Component
module »*.

⚠️ **La revue a écrasé `interface/.env.local`** avec ses propres valeurs de test
pour pouvoir lancer le site. Les deux secrets ont été **régénérés** ; aucune
conséquence en production, rien n'étant déployé. Enseignement pour les
prochaines revues : un agent qui a besoin de lancer l'app écrira dans les
fichiers de configuration locaux — ne pas y laisser une valeur qu'on n'a notée
nulle part ailleurs.

### Ce qui n'est pas fait, et pourquoi

**Pas de déconnexion** : il n'existe aucun en-tête de page où loger le bouton.
Elle viendra avec la coquille de l'étape 4.

**Pas de compteur de tentatives**, seulement le délai d'une seconde. En mémoire
il ne survivrait pas à l'hébergement sans état de Vercel ; en base il coûterait
une table pour un seul utilisateur. Ce qui protège réellement est la longueur
du mot de passe : 24 caractères tirés au hasard sont hors de portée d'un
forçage brut même sans aucun délai.

**Les deux secrets ne sont pas encore chez Vercel** — c'est l'étape 5.
`MOT_DE_PASSE_SITE` et `SECRET_SESSION` vivent dans `interface/.env.local`, que
Next lit et que git ignore. ⚠️ Ce fichier est distinct du `.env` de la racine,
qui appartient au pipeline Python : deux périmètres de secrets, deux fichiers.

### Où en est le projet à la fin de la séance du 21 août

| | État |
|---|---|
| Schéma | 2 tables sur 4, 4 migrations appliquées. `enrichissements` et `etapes_enrichissement` reportées en phase 6 |
| Pipeline | Collecte livrée, 189 offres réelles, 8 exécutions tracées. **Ne tourne encore qu'à la main** |
| Interface | La porte (`/connexion`, `proxy.ts`, session signée) + la page de contrôle de `/installe`, désormais protégée. **Aucun écran qui lit les offres** |
| En ligne | Vercel déploie, mais **sans aucune variable d'environnement** — le site public n'a donc toujours pas de mot de passe |

**Phase 1, étapes 1 à 3 sur 6 terminées.** Prochaine : l'écran `/offres` et ses quatre
états — le premier qui lit vraiment la base. La coquille qu'il pose devra porter le
bouton de déconnexion.

⚠️ **Trois choses à ne pas redécouvrir en ouvrant la prochaine séance :**

1. **Rien ne doit lire `offres` tant que les variables ne sont pas chez Vercel.** Le code
   de la porte existe, il n'est pas en service. Il en faut quatre : `SUPABASE_URL`,
   `SUPABASE_SECRET_KEY`, `MOT_DE_PASSE_SITE`, `SECRET_SESSION`.
2. **`interface/.env.local` détient l'unique copie des deux secrets du site.** Non
   versionné, nulle part ailleurs.
3. **`ANTHROPIC_API_KEY` est toujours un texte d'exemple** — bloquant pour la phase 2.

---

## 26 août 2026 — Le cron, et six jours de veille perdus

Le pipeline marchait depuis le 21 août. Il ne tournait pas.

En ouvrant la séance, la dernière exécution en base datait du 20 août à 23 h 52.
**Six jours sans collecte** — six jours d'offres que France Travail ne rendra
jamais, sa fenêtre de recherche ne remontant pas indéfiniment. C'est exactement
le risque que le plan avait anticipé en écrivant « allumer le cron dès le premier
jour » ; il a suffi que l'étape 5 s'arrête à moitié pour qu'il se réalise.

Le rattrapage l'a chiffré : **182 offres nouvelles** en une exécution. La base est
passée de 189 à 373.

### Ce qui a été posé

`.github/workflows/collecte-nocturne.yml`, 4 secrets chez GitHub
(`FT_CLIENT_ID`, `FT_CLIENT_SECRET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`),
poussés par un tube depuis le `.env` — jamais en argument de commande, où ils
seraient apparus dans la liste des processus de la machine.

**Quatre décisions qui méritent leur ligne :**

**02:23 UTC, pas 02:00.** GitHub planifie en UTC et ignore l'heure d'été : cela
donne 4 h 23 à Paris en été, 3 h 23 en hiver. Un créneau entre 2 h et 5 h reste
correct dans les deux régimes, ce qu'une heure « fixée à Paris » ne permettrait
pas. Et la minute non ronde évite la file d'attente des crons planifiés à l'heure
pile, que GitHub retarde.

**`concurrency` sans annulation.** Deux collectes simultanées se marcheraient
dessus : chacune referme au démarrage les exécutions restées `en_cours`, et borne
sa fenêtre sur la dernière réussite en base. `cancel-in-progress: false` est
délibéré — annuler celle qui tourne laisserait une ligne orpheline jusqu'au
lendemain. On préfère faire la queue.

**L'entrée de rattrapage manuel passe par l'environnement**, jamais par une
interpolation `${{ }}` posée dans la commande. Interpolée, elle serait recopiée
telle quelle dans le script avant exécution : une valeur comme
`1; curl monsite/$SUPABASE_SECRET_KEY` s'exécuterait comme une commande. Par
l'environnement, le shell la traite comme une donnée. Seul le propriétaire du
dépôt peut déclencher ce workflow — mais un garde-fou qui dépend de qui appuie
n'est pas un garde-fou.

**`permissions: contents: read`.** Ce job lit du code et écrit en base. Il n'a
aucune raison de pouvoir pousser un commit ou ouvrir une issue.

### Ce qui a été vérifié, et comment

Deux exécutions réelles chez GitHub, pas une relecture :

| Chemin | Résultat |
|---|---|
| Fenêtre automatique | 20/08 22:52 → 26/08 12:12 (recouvrement d'1 h appliqué), **182 offres nouvelles**, 0 rejetée, exécution fermée `reussite` en 9,1 s |
| Rattrapage `--depuis-jours 1` | 67 offres présentées, **2 nouvelles** — les 65 autres déjà en base : la déduplication tient |
| Journaux publics | Les 4 secrets apparaissent en `***`. Aucune donnée personnelle : le pipeline ne trace que des comptes et des critères |
| Base | 373 offres, 182 rattachées à l'exécution #25, **0 ligne restée `en_cours`** |

⚠️ **Ce qui n'est PAS prouvé** : que le déclenchement *planifié* se produise. Un
`workflow_dispatch` qui réussit ne dit rien du réveil nocturne. Ça ne se vérifie
qu'au matin du 27 août, en regardant si une exécution est apparue toute seule.

### Un commentaire qui mentait

`pipeline/config.py` justifiait son seuil `AGE_EXECUTION_ORPHELINE_HEURES = 6`
par « le workflow GitHub Actions est lui-même plafonné à 6 h » — un workflow qui
n'existait pas encore, et dont le `timeout-minutes` vaut maintenant 30. Le seuil
reste à 6 h : il n'existe pas pour détecter vite, mais pour ne **jamais** déclarer
`echec` une collecte encore vivante. Seule sa justification a été corrigée.

C'est le genre de dette qu'un dépôt public paie cher : le commentaire était le
seul endroit où la valeur 6 était expliquée.

### Le contenu de test a doublé — remesuré, pas recopié

Les valeurs de `docs/DESIGN.md` avaient été posées contre du contenu inventé, et
les mesures du 21 août portaient sur 189 offres. Sur **373** :

| | 21 août (189) | 26 août (373) |
|---|---|---|
| Sans nom d'entreprise | 34 % | **36 %** |
| Sans salaire | 69 % | **65 %** |
| Sans lieu | — | **0 %** |
| Intitulé le plus long | 79 car. | **94 car.** (médiane 40) |

Les proportions tiennent quand le volume double : **le vide reste le cas normal**,
pas le cas limite. Le lieu, lui, est toujours renseigné — une information neuve,
et une hypothèse de moins à défendre dans la mise en page.

Trois types de contrat seulement (CDI 301, MIS 39, CDD 33), mais **76 formes de
salaire distinctes** en texte libre : la normalisation de la phase 2 aura du
travail.

### Où en est le projet

**Phase 1, étapes 1 à 5 sur 6 terminées.** Reste l'étape 6 : remesurer la mise en
page contre ces 373 offres — pas contre les 189 d'avant — puis `/cloture`.

⚠️ **La dette du 21 août reste ouverte** : `MOT_DE_PASSE_SITE` doit être régénéré.
Non bloquant pour le cron, qui ne touche pas au site ; impératif avant la phase 4.

---

## 26 août 2026 — Rotation des secrets du site

La dette du 21 août est fermée. `MOT_DE_PASSE_SITE` avait fuité dans une
conversation par une sélection dans l'éditeur ; il a été régénéré.

### Ce qui a élargi le geste, et pourquoi ça comptait

La dette demandait littéralement « régénérer le mot de passe ». Ç'aurait été une
**révocation à moitié**.

Un cookie de session est signé avec `SECRET_SESSION`, pas avec le mot de passe.
La porte vérifie le mot de passe **une fois**, à la connexion, puis pose un jeton
qui vaut 30 jours ; ensuite, plus personne ne redemande le mot de passe. Donc
quelqu'un qui aurait utilisé la valeur fuitée pour se connecter **aurait gardé
son accès un mois entier** après le changement de mot de passe — sa session ne
dépend plus de lui.

Les deux ont donc été régénérés. Coût : une reconnexion. Maxime a tranché en ce
sens.

C'est une distinction transférable en entretien : **changer le facteur
d'authentification ne révoque pas les sessions qu'il a déjà émises.** C'est aussi
pour ça qu'un vrai système d'authentification garde une liste de sessions
révocables — ici, avec un seul utilisateur et aucune table de sessions, tourner
le secret de signature *est* le bouton « déconnecter partout ».

### Comment les valeurs ont été produites

Module `secrets` de Python, pas `random` — le premier tire d'une source
cryptographique, le second est prévisible si on connaît son état.

| | Forme | Entropie |
|---|---|---|
| `MOT_DE_PASSE_SITE` | 24 caractères en 6 groupes de 4, alphabet de 32 symboles sans `I`/`O`/`0`/`1` | 120 bits |
| `SECRET_SESSION` | 32 octets en hexadécimal | 256 bits |

`session.ts` impose 16 caractères minimum sur les deux ; la marge est large.

L'écriture dans `interface/.env.local` a été ciblée ligne par ligne, avec
contrôle que le nombre de lignes ne bougeait pas — ce fichier détient l'unique
copie des secrets du site, et un agent de revue l'avait déjà écrasé le 21 août.

Chez Vercel : `vercel env add <nom> <cible> --sensitive --force --yes`, valeur
lue **sur l'entrée standard**. `--value` l'aurait exposée dans la liste des
processus de la machine, lisible par n'importe quel programme local.

### Deux pièges rencontrés

**`vercel env ls` ne prouve rien sur une rotation.** La colonne « created »
affichait encore « 5d ago » juste après l'écrasement : `--force` remplace la
valeur sans réinitialiser la date. Comme les variables *Sensitive* ne sont pas
relisibles, **le seul test possible reste une connexion réelle au site en ligne**
— ce qui prolonge exactement le piège déjà consigné le 21 août.

**La porte ne se teste pas en `curl`.** Le formulaire est un composant client :
Next n'émet aucun champ caché `$ACTION_ID_`, l'action s'invoque par un en-tête
`Next-Action` dont le corps suit un format React interne. Deux tentatives ont
rendu des HTTP 500 qui ne prouvaient rien — ni que le mot de passe était bon, ni
qu'il était mauvais. Un test qui échoue pour la mauvaise raison est pire qu'un
test absent : il ressemble à une preuve.

La sortie a été un script Playwright lancé hors du dépôt, **qui lit les valeurs
dans les fichiers**. C'était la contrainte structurante de toute l'opération :
taper le mot de passe dans un navigateur piloté l'aurait fait entrer dans la
conversation — c'est-à-dire recréer exactement la fuite qu'on réparait.

### Ce qui a été vérifié, sur le site en ligne

| Test | Résultat |
|---|---|
| `/` sans cookie | renvoie vers `/connexion` ✓ |
| **Ancien mot de passe** (le fuité) | **refusé, aucune session ouverte** ✓ |
| Mot de passe arbitraire | refusé ✓ |
| **Nouveau mot de passe** | ouvre, session posée ✓ |
| `/offres` avec la nouvelle session | 200 offres affichées, **console sans erreur** ✓ |

Les offres visibles portent la date du **26 août** : la chaîne complète est
prouvée de bout en bout — cron GitHub → Supabase → site en ligne.

Le plafond de 200 sur 373 offres en base est `PLAFOND_AFFICHAGE` dans
`lib/offres.ts`, une limite voulue et documentée, pas une troncature accidentelle.

Copies temporaires de l'ancien mot de passe : écrasées puis supprimées. Nouveau
mot de passe déposé dans le presse-papiers, jamais affiché.

---

## 26 août 2026 — Clôture de la phase 1

La phase 1 est close. Le site est en ligne derrière son mot de passe, la
collecte tourne toute seule, l'écran des offres lit la base, et les valeurs de
mise en page ne sont plus des suppositions.

### Ce que la clôture a attrapé, et que rien d'autre n'aurait vu

**Un défaut que je venais de créer.** Resserrer la ligne d'offre (`py-4` →
`py-2.5`) sans toucher au squelette de chargement faisait **sauter la page de
56 px** au moment où les offres arrivaient. Ni le compilateur ni le linter ne
bronchent : les deux fichiers étaient cohérents séparément. Le commentaire de
`loading.tsx` promettait pourtant exactement l'inverse — il expliquait que le
cadre était partagé « pour que le contenu réel ne fasse pas sauter la mise en
page ». La promesse valait pour l'en-tête ; la ligne, elle, était recopiée.

**Un défaut invisible au réglage par défaut.** Ma première correction posait les
hauteurs du squelette en pixels durs. Mesuré ensuite : avec une police par
défaut à 20 px — un réglage d'accessibilité courant — le saut revenait à **54 px**,
et à **105 px** à 24 px. Le texte grandissait, la barre grise restait figée.
Corrigé en `rem`. Personne n'aurait trouvé ça par hasard : au réglage standard,
tout allait bien.

**Une divergence documentaire en six endroits.** Décider que les libellés de
notes s'écrivent en toutes lettres a laissé derrière : un critère de la phase 2
qui imposait toujours `INT` / `ACC`, le README de l'interface, la page de
contrôle, et 26 occurrences dans l'aperçu de design — lequel affichait encore la
largeur de 1180 px abandonnée le matin même. Trois sources décrivaient le même
libellé, deux disaient le contraire de la décision.

### La leçon que je retiens

**Un test peut échouer — ou réussir — pour la mauvaise raison, et ça ressemble à
une preuve.** Trois fois aujourd'hui :

| Le test disait | La réalité |
|---|---|
| Contraste de l'intitulé : **1,44:1**, sous le plancher | Le calcul lisait les couleurs `lab()` du projet comme du RGB. Vraie valeur : **14,88:1** |
| Focus du bouton : « indicateur présent » | `box-shadow` n'était pas la chaîne `none`, mais toutes ses couleurs étaient transparentes. Tranché par **comparaison d'images** |
| Police agrandie : saut de **135 px** | Le test posait la police sur `DOMContentLoaded`, après le rendu du squelette. Vrai chiffre : **54 px** — le défaut existait, mon test en exagérait l'ampleur |

Le remède qui a marché à chaque fois : **ne pas croire le nombre, aller chercher
la preuve la plus bête possible.** Comparer deux captures d'écran octet par
octet a tranché la question du focus en une seconde, là où trois lectures de
propriétés CSS m'avaient égaré.

### Ce que la revue de code a apporté

Quinze constats, dont un seul faux — elle affirmait que le squelette sautait
aussi à 375 px, ce que la mesure a démenti (écart de **0 px** : le squelette se
replie exactement comme la ligne). Les quatorze autres tenaient, y compris ceux
que je n'aurais pas trouvés seul : la contradiction arithmétique entre la
largeur figée à 1000 px et la barre latérale de 208 px prévue en phase 4
(1000 − 48 − 208 = 744 px de liste, sous les 820 px où 34 lignes cassent).

**Elle raisonne bien et mesure peu.** C'est exactement l'inverse de ce que je
dois faire : prendre ses raisonnements au sérieux, et aller vérifier moi-même.

### Une décision de conception, prise à cause du défaut

Le rythme vertical de la ligne vit désormais dans `rythme.ts`, importé par la
ligne **et** par son squelette. L'alternative était un commentaire demandant
« pense à reporter la valeur » — c'est ce qui existait, et ça n'a pas tenu une
seule modification. Un garde-fou qui suppose qu'on l'ait lu n'est pas un
garde-fou.

⚠️ Les classes y sont écrites **en entier**, jamais assemblées : Tailwind lit le
code source pour savoir quelles classes produire, et une classe concaténée ne
serait jamais générée — le style disparaîtrait sans aucun message d'erreur.

### Ce qui reste ouvert

| | |
|---|---|
| **Le cron planifié** | Deux exécutions manuelles réussies, mais le réveil de 2 h 23 UTC ne se prouve qu'au matin du 27 août |
| **`PGRST303`** | Reproductible au premier appel après recompilation, **en développement seulement** — jamais observé en production. Symptôme : l'écran affiche « base injoignable » alors que la base va bien |
| **1000 px contre 208 px** | La largeur figée ne laisse pas la place à la barre latérale de filtres. À trancher en phase 4, pas à reconduire |
| **L'en-tête de `/offres`** | Maxime ne l'aime pas. Reporté **après la phase 4**, quand les filtres y auront pris place : le redessiner avant, c'est le redessiner deux fois |

---

## 26 août 2026 — Décisions de cadrage pour la phase 2

Séance de fin de journée, sans code. Trois questions posées par Maxime, trois
réponses chiffrées, et une décision que j'ai contestée avant qu'elle soit prise.

### Où intervient l'API Claude, et ce que ça coûte vraiment

Rappel demandé sur la frontière agent / appel d'API. Elle n'a pas bougé :
**API Messages pour la notation** (une offre entre, deux notes sortent — aucune
exploration), **Agent SDK pour l'enrichissement** en phase 6 (tâche ouverte,
nombre d'étapes inconnu). C'est l'argument d'entretien le plus solide du projet ;
inverser les deux est l'erreur qu'un lead technique repère immédiatement.

Coût mesuré avec les tarifs officiels — pas de mémoire, la référence
`/claude-api` a été chargée pour ça :

| | Brut | + Batches | + cache de prompt |
|---|---|---|---|
| Sonnet 5 (tarif normal) | 9,40 $ | 4,70 $ | **3,46 $/mois** |
| Opus 5 | 15,66 $ | 7,83 $ | 5,76 $/mois |

Sur 30 offres par jour, description médiane de 2 313 caractères. **Noter toute la
base coûte moins qu'un café par mois** — et un test unique sur les 373 offres
revient à **1,35 $**.

Conséquence que je n'attendais pas : **le choix Sonnet 5 contre Opus 5 ne se joue
plus sur le coût**, l'écart étant de 2,30 $ par mois. Il avait été tranché sans
chiffres au cadrage ; à ce niveau de dépense, la seule question qui compte est le
nombre de bonnes offres ratées. Question rouverte pour la phase 2, à décider en
faisant tourner les deux modèles sur les mêmes 50 offres.

### 80 % des offres collectées sont du bruit

Maxime a remarqué que la plupart des offres n'ont rien à voir avec ce qu'il
cherche. Mesuré : **298 offres sur 373 ne contiennent aucun mot du champ lexical
de l'IA**, ni dans l'intitulé ni dans la description.

Les codes ROME en sont la cause, et le plus gros est le pire : **`H1206` ramène
111 offres pour 6 pertinentes — 5 %**, à lui seul 30 % du volume. `M1403` en
ramène 7 pour zéro.

⚠️ **Le fichier `codes_rome.txt` affirmait que ce filet « n'a trouvé aucune offre
IA que les mots-clés rataient ». C'est faux — il en a rattrapé 18.** Mais en les
regardant : « Ingénieur système rf », « Chef de projet médical pharmaceutique »,
« Ingénieur brevets ». Le mot IA est quelque part dans leur description, leur
métier n'a rien à voir. **Le filet attrape, mais il attrape le mauvais poisson.**

**Décision : ne rien retirer maintenant.** La notation *est* le filtre — c'est
tout le propos de la phase 2. Retirer les codes ROME avant, c'est faire à la main
et au lexique ce que le modèle fera mieux ; et après, on disposera d'une mesure
autrement solide, la note d'intérêt réelle par code ROME. Le bruit coûte 2,77 $
par mois, donc l'argument économique ne tranche pas. Le vrai risque est ailleurs :
le **plafond de pagination** de France Travail, qu'un rattrapage de 30 jours
approcherait.

### Effacer la base : contesté, et abandonné

Maxime voulait tester la notation sur 50 offres seulement, « quitte à effacer la
base et n'en garder que 50 » — les offres d'août étant périmées pour quelqu'un qui
postule en octobre.

**Le raisonnement liait deux choses sans rapport** : noter peu et stocker peu. La
notation est incrémentale par construction — « une offre déjà notée n'est jamais
renotée » — donc limiter la notation ne demande aucune suppression.

Quatre raisons contre l'effacement, dans l'ordre où elles pèsent :

1. **France Travail dépublie ses annonces.** Une offre effacée ne se re-collecte
   **jamais**. C'est la raison d'être écrite de la colonne `charge_brute` :
   effacer, c'est détruire ce que cette colonne existe pour protéger.
2. **Ces 373 offres sont le jeu de test, et il venait d'être mesuré le matin
   même** — neuf familles de salaire, dont une (`Horaire …`) présente sur **une
   seule offre**. Ce sont exactement les cas qui feront tomber le normaliseur.
3. **L'écran de suivi d'exploitation** a besoin de l'historique, et un historique
   ne se reconstitue pas.
4. **Le problème se règle tout seul** : ~1 500 offres de plus d'ici octobre, tri
   par date décroissante. Les anciennes descendent d'elles-mêmes.

Et si des offres périmées gênent vraiment à l'écran, **c'est un filtre
d'affichage qu'il faut, pas une suppression**.

Maxime a répondu en réduisant l'échantillon à **5 offres** sans revenir sur
l'effacement — la base reste intacte.

### Ce que je retiens

**Chiffrer avant de discuter.** Les trois questions de la séance portaient sur le
coût, et dans les trois cas le chiffre a déplacé la conversation : le coût ne
justifiait pas de tester petit (mais la relecture, si), ne justifiait pas de
retirer les codes ROME, et ne justifiait plus le choix de Sonnet sur Opus. Une
intuition de prix vaut rarement une multiplication.

**Un commentaire de code peut mentir avec assurance.** `codes_rome.txt`
expliquait clairement pourquoi son filet ne servait à rien — et se trompait. Il
avait été écrit après une mesure honnête sur une semaine ; cinq jours de données
en plus l'ont démenti.

---

## 26 août 2026 — La notation tourne, et les critères de collecte s'effondrent

Séance longue. Elle devait livrer la phase 2 ; elle a livré la notation **et**
démoli la moitié de ce que le projet croyait savoir sur sa propre collecte.

### Ce qui a été construit

Quatre briques, quatre commits, ~60 centimes d'API dépensés sur 5 $.

**La migration 5** — deux notes, deux justifications, un résumé, un salaire
annualisé, la trace de consommation, et une colonne `etape` sur
`executions_veille`. 25 vérifications contre la vraie base : lecture, écriture
d'une notation complète, et violation une par une de chaque contrainte.

Une seule a échoué au premier essai, et c'était mon test qui était faux : j'avais
écrit une heure de fin en heure de Paris contre un début en UTC, et la contrainte
`terminee_apres_demarree` l'a attrapée. Le piège que `timestamptz` existe pour
rendre visible s'est refermé sur moi.

**`pipeline/salaire.py`** — annualisation des 9 formes réelles. Sur 373 offres :
129 montants retenus, 242 absents, **2 écartés comme invraisemblables**. Ces deux
sont faux à la source : « Mensuel de 45000 à 60000 Euros sur 12 mois » (× 12 =
540 000 à 720 000 €/an — et c'est une offre d'ingénieur IA) et « Annuel de 35.0
Euros ». Sans garde-fou, la première aurait été l'offre la mieux payée du site.

Trois comportements possibles, un seul acceptable : parser bêtement fait d'une
faute de frappe la meilleure offre ; requalifier le mensuel en annuel revient à
deviner l'intention de l'employeur, donc à fabriquer de la donnée ; **écarter avec
un motif** laisse le libellé d'origine visible et l'humain tranche. Sur une donnée
d'entrée qu'on ne contrôle pas, une valeur absente est récupérable, une valeur
fausse ne l'est pas — parce que rien en aval ne saura qu'elle est fausse.

**`pipeline/notation.py`** — critères dans un fichier versionné, sortie
structurée, cache de prompt, appels directs et Batches.

**Un bug attrapé avant le premier centime.** Le mode `--sans-appeler` affiche le
prompt exact et compte ses tokens gratuitement. Il a montré que mon filtre de
commentaires, qui retirait les lignes commençant par `#`, **emportait aussi tous
les titres Markdown** du fichier de critères. Le paragraphe définissant la note
d'intérêt arrivait au modèle amputé de son titre : « Elle mesure l'adéquation… »
— *elle* qui ? Prompt grammaticalement correct, notation livrée au hasard, aucune
erreur nulle part. Les commentaires sont passés en `//`.

### L'étalonnage : quand le modèle a raison contre son barème

Premier essai sur une offre, puis trois. Le modèle s'écartait systématiquement du
barème d'accessibilité, toujours vers le bas. Sur une annonce d'administration
réseau marquée « débutant accepté » mais exigeant Cisco, Aruba et Palo Alto, mon
barème commandait 90-100 ; le modèle a mis 40.

**C'était le barème qui avait tort.** Il classait l'expérience exigée en facteur
n°1 et les technologies en n°5. Un employeur qui accepte un débutant accepte un
débutant *de son domaine*. Deux facteurs dominent désormais à égalité — expérience
et adéquation technique — et les repères chiffrés ne valent que pour une pile
familière. Effet vérifié en renotant les mêmes trois offres : l'administration
réseau tombe de 40 à 5, l'ingénierie qualité médicale de 25 à 15, et le poste
Python/IA reste à 45. **Seules bougent les offres dont la pile est étrangère.**

### Le champ qui ment une fois sur deux

Le modèle a écrit « trois ans d'expérience sont exigés » sur une offre dont le
champ `experience_libelle` dit « Débutant accepté ». Vérification faite : le texte
de l'annonce dit « une première expérience, de 3 ans minimum ». Deuxième cas, une
autre offre : champ « 2 An(s) », texte « au moins 3 ans ».

**Sur trois offres vérifiées ligne à ligne, deux ont un champ structuré contredit
par leur propre texte.** Toute logique bâtie dessus — filtre, tri, seuil — sera
fausse une fois sur deux. Et c'est l'argument qui justifie de faire *lire* les
annonces à un modèle plutôt que de les filtrer sur leurs métadonnées : aucune
règle n'aurait attrapé ça, il fallait lire la phrase.

### Puis Maxime a posé la bonne question

« Le code ROME, c'est quand même assez large comme filtre. Il n'y a pas une autre
manière de les collecter ? »

La mesure a donné une réponse que je n'attendais pas, en trois temps.

**Un : les codes ROME collectés étaient les mauvais.** `H1206` = « Management et
ingénierie R&D **industriel** » est un domaine entier, pas un métier. 238 offres
par mois, et sur 17 tirées au hasard, **aucune au-dessus de 8 sur 100**. Il existe
`M1889` = « Ingénieur en Intelligence Artificielle (IA) », un code taillé pour le
projet — **jamais collecté**.

**Deux : ajouter les bons codes n'aurait rien apporté.** M1889 et M1861 ont la
meilleure qualité mesurée de tous les codes (moyennes 21,3 et 17,7 ; c'est de
M1861 que vient la seule offre à 75/100). Leur apport **net** est de zéro : leurs
47 offres mensuelles sont **déjà toutes** ramenées par les mots-clés. La recherche
texte indexe le libellé ROME et l'appellation — une offre classée « Ingénieur en
Intelligence Artificielle » est trouvée par le mot-clé « intelligence
artificielle ». **Un code ROME dont le libellé contient un mot déjà cherché ne
peut rien apporter.** Ce n'était écrit nulle part.

**Trois : le vrai trou était ailleurs, et il était béant.** Le projet cherchait
`IA` depuis dix jours **sans jamais chercher `AI`**. En anglais : 33 offres sur 30
jours, dont **28 qu'aucun autre critère ne trouvait** — *AI Engineer*, *Generative
AI & Agentic Engineer*, *AI Lead Engineer*, *Consultant Data et AI Engineer jeune
diplômé*. Le commentaire de `mots_cles.txt` affirmait que le vocabulaire est
« FERMÉ et FRANÇAIS ». La seconde moitié était fausse et coûtait cher.

Configuration finale : les six codes ROME retirés, `AI`, `GenAI` et `agentique`
ajoutés. Mesuré sur 15 offres tirées au hasard dans la collecte de
reconfiguration, contre les 82 notées sous l'ancienne :

| | Nouvelle config | Ancienne |
|---|---|---|
| Volume | 294 offres/mois | 707 |
| Moyenne d'intérêt | **16,2** | 7,7 |
| Au-dessus de 50 | **7 %** | 1 % |
| Coût de notation | ~1,75 $/mois | ~4,20 $ |

La meilleure offre de la soirée, **« Alternant Ingénieur IA Agentique » à 85/100**,
était invisible avant. Son accessibilité est de 15 — c'est une alternance,
passionnante et hors de portée. Première fois que les deux notes travaillent en
sens opposé : c'est le cas qui valide leur séparation.

### Ce que je retiens

**Deux de mes recommandations étaient fausses, et la mesure l'a dit.** J'ai
proposé d'ajouter M1889 et M1861 : apport net zéro. J'ai annoncé M1805 « le plus
prometteur » : 6,1 de moyenne. Les deux fois j'avais un raisonnement plausible.
Aucun des deux n'aurait été détecté sans mesurer — un raisonnement plausible sur
une API qu'on connaît mal produit des conclusions plausibles et fausses.

**Un échantillon pris par date n'est pas un échantillon.** Les 18 premières offres
notées venaient toutes de la même journée de collecte. Toute conclusion tirée de
là aurait porté sur cette journée, pas sur le gisement. `--au-hasard` est né de
cette gêne, et c'est lui qui rend les mesures de la soirée opposables.

**Une décision prise sans instrument de mesure doit être marquée provisoire.**
L'arbitrage du 21 août sur les deux filets était raisonnable et faux, et il ne
*pouvait pas* être tranché ce jour-là : la notation n'existait pas. Ce qui manquait
n'était pas de la rigueur, c'était l'instrument. Une décision dans cette situation
mérite une date de réouverture, pas seulement une justification.

**Savoir dire ce que la mesure ne dit pas.** Sur 17 offres H1206 sans succès, la
tentation était de conclure « le gisement est vide ». Le calcul dit autre chose :
si le gisement contenait 6 offres pertinentes sur 111, rater les 17 a 36 % de
chances d'arriver. La conclusion honnête était « au plus 15 sur 111, et je ne peux
pas exclure 6 » — ce qui suffisait à décider, sans prétendre à une preuve.

---

## 26 août 2026, dans la soirée — l'écran des deux notes

**Ce qui est livré** : `/offres` affiche les deux notes avec leurs justifications à
plat, classées par intérêt décroissant, et le salaire ramené à l'année quand il
peut l'être. C'est le dernier morceau visuel de la phase 2.

### La question posée avant de coder : dans quel ordre ?

Maxime demandait s'il fallait finir de mesurer les critères de collecte d'abord.
Réponse retenue : **l'écran d'abord, parce que c'est lui l'instrument de mesure.**
Jusqu'ici, juger un mot-clé voulait dire noter un échantillon puis lire les
justifications dans le terminal, une par une. Depuis ce soir, il suffit d'ouvrir la
page : « Conducteur d'engins Polyvalent » noté **0/100** avec sa justification se
voit en deux secondes. Construire les critères avant l'outil qui sert à les juger,
c'était travailler dans le mauvais sens.

Argument secondaire mais réel : mesurer un critère n'est pas gratuit non plus — la
qualité se mesure en notant un échantillon, soit ~9 centimes par terme testé.
Repousser l'écran ne repoussait pas la dépense, ça la déplaçait.

### Ce que la mesure a démenti, trois fois

**1. Les notes ne pouvaient pas aller dans la réserve de droite.** `docs/DESIGN.md`
l'affirmait, mesuré « le 26 août avec des barres simulées ». La mesure était juste
et la conclusion fausse : elle portait sur des **barres nues**. Une justification
fait 145 caractères en médiane — dans les 192 px de la réserve, cela donne dix
lignes. Le bloc est passé pleine largeur, en deux colonnes sous les cartouches.
**Une mesure faite sur une maquette incomplète mesure la maquette, pas la chose.**

**2. « L'intitulé très long n'existe pas » était faux.** Le `PLAN.md` le tenait pour
acquis depuis le 21 août, sur quatre mesures concordantes : 99 caractères au maximum
sur 235 offres, 79 sur 189, 94 sur 373. Sur les **535** d'aujourd'hui : **223
caractères**. Rien n'était erroné dans ces mesures — un maximum observé n'est pas une
borne, c'est un échantillon, et il ne peut que monter. Vérifié à l'écran : 6 lignes à
375 px, rien ne casse.

**3. Le salaire normalisé ne libère pas la largeur de page.** `DESIGN.md` pariait que
la phase 2 raccourcirait le libellé (« 50–60 k€ ») et permettrait de descendre sous
1000 px. Le code est livré et **31 offres sur 535** en bénéficient : l'annualisation
est calculée *pendant la notation*, donc une offre non notée n'a pas de valeur
annuelle, quelle que soit la qualité de son libellé. Le pari couplait deux choses qui
ne le sont pas — une mise en forme qui arrive d'un coup, et un calcul payant qui
arrive au goutte-à-goutte.

### Deux corrections nées de l'écran regardé, pas du code relu

**Le libellé est passé de 104 à 108 px.** « ACCESSIBILITÉ » mesure exactement
100,1 px en Geist Mono. À 104 px il restait 4 px de marge — assez tant que la police
web est chargée, plus rien si elle ne l'est pas encore. L'alignement des barres d'une
ligne à l'autre, qui est toute la raison d'être de cette largeur fixe, serait tombé
sans le moindre signal.

**La piste de la jauge a reçu un filet.** Elle ne contrastait qu'à **1,21:1** avec la
carte. Aucune exigence WCAG ne s'y applique — l'information est portée par le chiffre
— mais à 0, il ne restait littéralement rien à l'écran, et avec elle disparaissait la
longueur commune aux deux barres, celle qui permet de comparer deux offres d'un coup
d'œil.

**Et l'état vide a été dégonflé.** « Pas encore notée » en bloc séparé, avec son filet
et ses marges, coûtait **42 px pour une phrase d'excuse**, sur 103 des 200 lignes
affichées. Ramené en cartouche creux dans la rangée des métadonnées — le même
traitement que « Salaire non précisé » — la ligne non notée reste à 91 px.
**Un état vide ne doit jamais être plus encombrant que l'état plein.**

### Un piège attrapé au bon endroit

`ORDER BY note_interet DESC` place les `NULL` **en premier** en PostgreSQL. Sans
`nullslast`, les 438 offres non notées auraient occupé les 200 lignes affichées et
**aucune offre notée ne serait apparue**. Ni erreur, ni ligne vide : une liste d'allure
parfaitement normale qui n'aurait classé personne. Le piège était écrit dans le
`CLAUDE.md` depuis l'ouverture de la phase — c'est la seule raison pour laquelle il n'a
pas été découvert en production.

Même famille, plus discret : `lireDerniereExecution()` filtre désormais sur
`etape = 'collecte'`. Les notations écrivent leurs propres lignes dans
`executions_veille` ; sans ce filtre, la dernière notation réussie serait devenue « la
dernière exécution » et **plus aucune offre n'aurait porté le marqueur « Nouveau »**,
puisqu'une notation ne collecte rien. C'est le pendant, côté interface, du bug que la
colonne `etape` avait corrigé côté pipeline.

### Ce que je retiens

**Une hypothèse chiffrée marquée ⏳ dans un document n'est pas moins dangereuse qu'un
chiffre inventé — elle est juste mieux signalée.** Les trois démentis de la soirée
portaient tous sur des valeurs écrites, datées et sourcées. Ce qui les a rendues
fausses n'est jamais un défaut de rigueur : c'est que la chose mesurée n'était pas
encore la chose réelle. Le marqueur ⏳ a bien fait son travail — il a dit quand
remesurer.

**Le premier calcul de contraste était faux, et silencieusement.**
`getComputedStyle` rend désormais de l'OKLCH ; un parseur qui lit
`oklch(0.988 0.007 84)` comme un triplet RVB sort des ratios voisins de 1:1 sans lever
la moindre erreur. J'ai failli conclure que la moitié de la palette violait le
plancher d'accessibilité. La parade tient en une ligne : faire convertir la couleur
par le navigateur lui-même, en la peignant sur un canvas de 1 × 1 pixel.

---

## 26 août 2026, tard — la notation passe sur le cron

**Trois choses livrées** : le chemin d'échec exercé pour de vrai, l'API Batches
lancée pour la première fois, et la notation branchée sur GitHub Actions.

### Provoquer un échec sans dépenser un centime

Le critère demandait de vérifier qu'une notation ratée laisse l'offre en base
sans note, avec son motif. Il restait ouvert depuis l'écriture du module :
**0 échec sur 97 appels**, donc un chemin jamais parcouru.

La façon de le déclencher est presque triviale une fois trouvée : demander un
**modèle qui n'existe pas**. L'API répond 404 avant tout traitement, donc
`APIStatusError` est levée et **rien n'est facturé**. Vérifié en base : motif
tracé, note restée `NULL`, compteur de tentatives incrémenté, exécution fermée
en `echec`, code de sortie 1.

**La leçon est réutilisable** : pour exercer un chemin d'erreur d'une API
payante, chercher l'erreur que l'API rejette *avant* de facturer. Une clé
invalide, un modèle inconnu, un paramètre hors bornes — tous gratuits, tous
produisant la même exception que la vraie panne.

### L'API Batches a tourné, et le test ne prouve pas ce qu'il semble prouver

Premier lot déposé, `msgbatch_018yAG…`, une offre. Réussite en **2 min 33**,
là où la documentation annonce jusqu'à une heure. Dépôt, attente, récupération
des résultats, écriture en base, trace d'exécution : tout est validé.

⚠️ **Sauf le point qui compte.** Le module rattache les résultats par
`custom_id` parce que l'API les rend dans un ordre quelconque — apparier par
position donnerait à une offre les notes d'une autre, en silence. Or **sur une
seule offre, les deux méthodes donnent le même résultat**. Le test ne peut pas
distinguer un code correct d'un code faux : il ne prouve rien sur ce point.

**Un test qui ne peut pas échouer ne prouve rien**, et un cas limite de taille 1
est souvent de ceux-là. C'est écrit tel quel dans le `PLAN.md` plutôt que coché.

Mesuré au passage : sur un lot d'une offre, `cache_ecriture` vaut 3 715 et
`cache_lecture` **zéro**. On paie l'écriture du cache sans jamais le relire —
le lot n'est rentable qu'à partir de plusieurs offres.

Coïncidence utile : le lot a noté `212YRCR`, l'offre que l'échec volontaire
avait fait échouer deux fois vingt minutes plus tôt. Remise dans la file
(2 tentatives < 3), elle est repassée et a été notée. **Le cycle échec →
reprise → réussite a donc tourné en conditions réelles sans que personne ne
l'orchestre.**

### Le cron, et le garde-fou qui coûtait 90 centimes

Maxime a tranché : **on ne rattrape pas les 437 offres déjà en base**, on ne
note que ce qui vient d'arriver. D'où un nouveau drapeau `--derniere-collecte`,
qui restreint la notation aux offres de la dernière collecte réussie.

Il résout cet identifiant **par la base**, pas par un canal GitHub Actions. Le
workflow aurait pu faire remonter l'identifiant en sortie de job ; ce serait
coupler les deux étapes par un mécanisme qui n'existe que chez GitHub, donc
casser le lancement à la main. La base est déjà la source de vérité commune :
le producteur y dépose, le consommateur y lit, et chaque étape reste lançable
seule.

⚠️ **Le vrai piège était ailleurs, et il se chiffre.** « La dernière collecte
réussie » désigne une collecte *antérieure* si celle de la nuit échoue. Mesuré
ce soir : la dernière collecte réussie portait alors **146 offres non notées**,
soit environ **90 centimes** payés d'un coup — la nuit où la collecte plante,
c'est-à-dire exactement quand on ne veut pas de surprise.

La parade tient en deux mots de YAML : `needs: collecter` **sans**
`if: always()`. Si la collecte échoue, la notation ne tourne pas du tout. Un
échec réseau ne coûte plus rien au lieu de coûter de l'argent.

Un second plafond, `--limite 60`, borne le `workflow_dispatch` de rattrapage
manuel, qui peut ramener 300 offres d'un coup. Et quand cette limite mord, le
module émet désormais un **avertissement** : avec `--derniere-collecte`, les
offres laissées ne repasseront jamais toutes seules.

### Un défaut trouvé en passant

`--sans-appeler` ignorait **silencieusement** les filtres de sélection.
`--sans-appeler --rome H1206` affichait le prompt d'une offre quelconque, sans
rien signaler. Un aperçu qui ne montre pas l'offre qu'on s'apprête à envoyer
est pire que pas d'aperçu — on croit vérifier, et on ne vérifie rien. Corrigé :
`apercevoir()` reçoit exactement les mêmes filtres qu'`executer()`.

### Ce que je retiens

**Un garde-fou de facturation se conçoit en se demandant ce qui se passe quand
l'étape précédente échoue**, pas quand tout va bien. Le mode nocturne était
correct dans le cas nominal et coûtait 90 centimes dans le cas dégradé — et le
cas dégradé n'était ni rare ni tordu, juste une collecte ratée.

**Une clé d'API se pose dans un secret sans jamais s'afficher.** `printf '%s'
"$(grep '^CLE=' .env | cut -d= -f2-)" | gh secret set CLE` : la valeur passe de
fichier à secret sans transiter par un terminal, une capture d'écran ou une
conversation. Seuls sa longueur et son préfixe ont été montrés, et aucun des
deux n'identifie quoi que ce soit.

---

## 27 août 2026 — le cron n'a pas tourné, et ce n'est pas le code

Premier constat du matin : `gh run list` ne montre que des déclenchements
manuels. **Le cron de 02:23 UTC n'a produit aucune exécution**, neuf heures
après son heure.

### Établir avant d'expliquer

Quatre vérifications avant toute hypothèse :

| | |
|---|---|
| Workflow avec `schedule` sur `main` | depuis le 26/08 **12 h 11 UTC**, soit 14 h d'avance |
| Exécution manuelle à 12 h 12 UTC le 26 | verte — le workflow était bien enregistré |
| Exécutions `--event=schedule` | **aucune, jamais** |
| Dépôt archivé · désactivé · Actions coupées | non · non · non |

Conclusion : GitHub a sauté le passage. C'est **documenté** — les workflows
planifiés ne sont pas garantis, ils peuvent être retardés en période de charge
ou abandonnés purement, et c'est plus fréquent sur les dépôts publics gratuits.
La minute non ronde (23) était déjà une parade contre les files de l'heure
pile ; elle ne protège pas de ça.

### Ce qui a bien marché, et qui n'était pas un hasard

**Les données n'ont rien perdu**, parce que la fenêtre de collecte part de la
*dernière collecte réussie* et jamais de « hier ». Vérifié à blanc, gratuitement :
la fenêtre s'est ouverte toute seule sur seize heures, et seize offres attendent.
Une nuit sautée est rattrapée par la suivante, qui collecte quarante-huit heures
d'un coup ; la notation suivant la collecte, ces offres seront notées normalement.

C'est un choix de conception qui date du premier jour et qui paie aujourd'hui :
**le pipeline ne suppose jamais que son déclencheur est fiable.** Un cron qui
saute, un job tué, une machine éteinte — la borne est en base, pas dans
l'horloge.

⚠️ La limite reste à connaître : plusieurs nuits sautées d'affilée font grossir
le volume, et le plafond de 60 du workflow finirait par mordre vers quatre ou
cinq nuits consécutives. Les offres laissées ne repassent pas en mode
`--derniere-collecte`.

### Ne pas réparer sur un seul point

La tentation était d'ajouter tout de suite un second cron de secours. Décision :
**non.** Un saut ne fait pas une tendance, et la parade coûterait de la
complexité posée sur une supposition. On observe deux ou trois nuits ; si ça se
reproduit, on traite, et la parade sera simple.

### La doc mentait sur trois points, dont un dans la vitrine

Question de Maxime — « est-ce que la doc est à jour ? » — posée avant de repartir
sur une nouvelle conversation. La vérification a trouvé trois affirmations
fausses, et le fait de les avoir cherchées vaut plus que de les avoir corrigées :

- Le `CLAUDE.md` annonçait encore la clé Anthropic **absente des secrets
  GitHub**, alors qu'elle y est depuis la veille. Un script de mise à jour avait
  visé une chaîne qui n'existait pas et n'avait rien remplacé — **sans lever
  d'erreur**, puisqu'il réécrivait un texte inchangé. La parade tient en une
  ligne : `assert t != avant` avant chaque écriture.
- Il listait trois travaux « restant à faire » qui étaient tous terminés.
- Le **README** — la première chose qu'ouvre un recruteur — affirmait que « le
  vocabulaire de France Travail est fermé et français ». La mesure du 26 août
  l'avait démenti douze heures plus tôt : `AI` en anglais ramène 28 offres
  nettes par mois.

**Une documentation fausse est pire qu'une documentation absente**, et celle-ci
l'était à l'endroit le plus visible du projet. Le README porte désormais la
correction *avec* le raisonnement initial qui s'est trompé — c'est plus honnête,
et bien plus intéressant à lire, qu'une affirmation lissée.

---

## 28 août 2026 — Le rappel est saturé, le filtre passe sur le contrat

### Le cron finit par partir, avec 10 h 32 de retard

Le workflow planifié s'est déclenché le 27 à **12 h 54 UTC** au lieu de 02:23 —
premier et seul déclenchement `schedule` depuis son enregistrement. Il a réussi
de bout en bout : collecte 19 s (25 offres), notation 2 min 09 (25 notées, aucun
échec, 89 160 tokens lus en cache), ~15 centimes.

**Ça ferme la dernière vérification bloquante de la phase 2** : l'appel payant
depuis le runner GitHub n'avait jamais été exercé, le passage du 26 août étant
vert mais sans offre à noter.

La nuit du 27 au 28 n'a rien produit non plus à 08 h 11 UTC. **Décidé de ne rien
corriger avant une troisième nuit** — un cron de secours serait de la complexité
posée sur une supposition. Et le vrai coût du retard n'est pas dans les données,
qui se rattrapent seules, mais dans l'usage : un cron qui tourne à midi livre un
écran vide au moment de la consultation du matin.

### Le moteur de recherche ne fait pas ce que la documentation disait

En cherchant pourquoi `intelligence artificielle` ramenait « Développeur
Mulesoft » et « Comptable support logiciel », on a fini par chercher le terme
dans la **charge brute complète** de chaque offre : **26 sur 40 ne le
contiennent nulle part** — ni intitulé, ni libellé ROME, ni appellation, ni
compétences, ni description.

Puis ce test :

| Recherche (30 j, région 11) | Offres |
|---|---|
| `intelligence artificielle` | 168 |
| `intelligence` seul | 64 |
| `artificielle` seul | 43 |
| union des deux | **64** |

**125 des 168 ne viennent d'aucun des deux mots seuls.** Ni ET, ni OU :
l'expression déclenche un élargissement au *domaine*.

Le fait n°1 du projet — « la recherche porte sur l'intitulé, le libellé ROME,
l'appellation et les compétences » — décrivait une correspondance textuelle qui
n'existe pas. Corrigé dans `CLAUDE.md` et `docs/API_FRANCE_TRAVAIL.md`.

**La règle qui en sort ne change pas, mais son motif oui** : un critère se
mesure et ne se déduit jamais — non parce que l'index est étroit, mais parce
qu'il est **opaque**.

### 50 termes balayés : le rappel est saturé, un seul entre

Tout le lexique IA spécialisé a un apport net de **zéro** — `consultant IA`,
`IA générative`, `intégration IA`, `copilot`, `RAG`, `prompt`, `multi-agents`,
`MLOps`, `low-code`, `no-code`, `agentic`. Le vocabulaire anglais pointu n'existe
tout simplement pas : `LLM`, `GPT`, `OpenAI`, `LangChain`, `embeddings`, `NLP`,
`deep learning`, `n8n`, `forward deployed` — tous à zéro offre.

⚠️ **Ça dément la note du 26 août** qui voyait « le vocabulaire s'ouvrir » sur la
foi de LLM 1, copilot 2, RAG 1. Deux jours après, LLM est à 0. **Des valeurs à 1
ou 2 sont du bruit statistique, pas une tendance** — la leçon vaut plus que le
chiffre.

Faux amis relevés : `agents` rend **2 718 offres** (agent d'accueil, agent de
sécurité), `démonstrateur` des vendeurs en magasin, `Make` un maquilleur,
`ingénieur solutions` dix ingénieurs *commerciaux*.

**Un seul terme retenu : `chatbot`**, +1 offre nette par mois.

Et un piège de méthode noté au passage : **l'apport net n'est pas une propriété
du terme, mais du couple (terme, configuration)**. En retirant `intelligence
artificielle`, `low-code` et `no-code` passent de 0 à 1.

### Seul le CDI est collecté

Demandé par Maxime : les offres non-CDI sont notées puis jamais regardées, donc
c'est une dépense pure. Faisable côté serveur — `typeContrat=CDI` filtre avant
transfert.

**Le coût a été mesuré et montré avant d'agir** : le filtre écarte 11 des 20
meilleures offres notées. Sept sont des alternances, que Maxime ne regarde pas
et qui polluaient le classement. Mais quatre sont de vraies offres, dont un
**CDD Institut Curie « IA Générative et Systèmes Multi-Agents » noté 75**.

Deux options lui ont été posées, avec le fait qu'un filtre à la collecte est
**irréversible pour le passé** — France Travail dépublie, et rien en base ne
témoigne de ce qui n'a pas été collecté. Il a maintenu : **CDI strict, à la
collecte**. C'est sa recherche d'emploi, et il ne prend que du CDI.

Effet mesuré : 21 % du volume écarté (39 CDD dont 27 alternances, 16 intérims,
3 professions libérales), ~0,35 $/mois d'économie.

**Vérifié après codage, sans croire l'API sur parole** : les 208 offres rendues
sont toutes des CDI, le résultat filtré est un sous-ensemble strict du non
filtré, et **aucun CDI n'est écarté à tort**. Le champ `typeContrat` est par
ailleurs renseigné sur 560 offres sur 560 — donc aucune offre ne disparaît faute
de valeur, contrôlé avant d'écrire la première ligne.

### Aucun filtre structurel ne peut remplacer les mots-clés

Testé au passage, et c'est un argument transférable en entretien : la
`qualification` est vide sur **86 des 123 offres notées**, et 11 des 20
meilleures sont dans ce trou. Filtrer sur « Cadre » perdrait 70 % des bonnes
offres. Avec `experienceLibelle`, faux une fois sur deux, ça fait deux
métadonnées inexploitables — **c'est précisément pourquoi le projet fait lire
les annonces par un modèle plutôt que de les filtrer sur leurs champs.**

`typeContrat` est la seule exception, et seulement parce qu'elle a été vérifiée.

### Reste ouvert

`intelligence artificielle` ramène **127 offres nettes/mois pour une moyenne de
8/100 et un maximum de 15**, zéro au-dessus de 30 sur 27 notées — le profil
exact qui a fait tomber les codes ROME. Les 9 offres notées ≥25 sont **toutes**
rattrapées par `IA` ou `AI`, vérifié une par une : le retrait ne coûterait rien
et ferait passer le volume de 296 à 141 offres/mois. **Proposé, pas arbitré.**

### Maxime retire `deploiement` et `RPA` à la main

Dans la foulée de la mesure, et sans attendre l'arbitrage formel. **Il garde
`intelligence artificielle`** — la recommandation la plus forte de la journée
(127 offres nettes/mois pour un maximum de 15) reste donc en suspens, et la
projection « 296 → 141 offres/mois » ne se réalisera jamais telle quelle.

Configuration effective : **7 termes**, `chatbot` compris.

⚠️ **Effet secondaire noté au passage, et c'est le piège que le fichier annonçait
lui-même** : le balayage des 50 termes a été mesuré *avec* `RPA` et `deploiement`
dans la liste. Ces mesures décrivent donc une configuration qui n'existe plus.
Ce qu'elles garantissent encore — un terme mesuré à 0 ne peut que monter quand la
liste rétrécit, donc aucun terme n'a été écarté à tort. Ce qu'elles ne
garantissent plus — qu'un terme écarté soit toujours inutile. Consigné dans
`mots_cles.txt`, au point d'usage.

### La revue de code trouve 15 défauts, dont trois qui comptent

Lancée sur le filtre CDI. Aucun n'est un bug d'exécution — le code faisait ce
qu'il annonçait — mais trois portaient à conséquence :

1. **Un chiffre faux introduit dans un commentaire.** J'avais écrit que le filtre
   « écarte 31 % des offres » ; c'est 21 % sur la collecte, 31 % étant la part de
   non-CDI dans l'échantillon *noté*, un autre dénominateur. Deux chiffres pour
   le même filtre, dans quatre fichiers, dont un seul nommait sa base. Corrigé en
   nommant les deux dénominateurs côte à côte.
2. **`TYPE_CONTRAT` échappait à la règle du module.** `config.py` promet
   d'échouer au démarrage ; cette constante n'était validée nulle part. J'avais
   vérifié qu'une valeur invalide provoque un HTTP 400 — donc pas d'échec
   silencieux — mais l'erreur venait de France Travail après le premier appel, pas
   du projet avant. Ajout de `_valider_type_contrat()`, testé sur 11 valeurs.
   ⚠️ Il **refuse explicitement la chaîne vide**, qui est *falsy* : elle aurait
   désactivé le filtre **et** sauté la ligne de journal qui l'annonce.
3. **Le journal ne disait rien quand le filtre est éteint.** L'absence de ligne
   devenait le seul signal d'un changement de politique — une nuit sans filtre
   ressemblait trait pour trait à une nuit d'avant le 28 août. Journalisé
   désormais dans les deux sens.

Corrigé aussi : le commentaire créditait le filtre d'écarter les alternances
« (voulu) ». C'est **un accident** — les 34 alternances de la base sont toutes
typées CDD ou MIS aujourd'hui, mais un contrat de professionnalisation peut être
conclu en CDI. Le levier direct est la colonne `alternance`, déjà en base.

Et six incohérences de documentation, toutes réelles : « 8 termes » là où il y en
a 7, le chantier des critères décrit comme ouvert alors qu'il venait d'être clos
soixante lignes plus haut, le volume de 294 offres/mois périmé dans deux fichiers,
et surtout **deux affirmations opposées à quarante lignes d'écart dans le
README** — « `GenAI`, `LLM`, `copilot` ne renvoient plus zéro » juste au-dessus de
« le vocabulaire anglais pointu n'existe pas ». C'est la vitrine du projet.

**Reste proposé, non fait** : rien en base ne dit qu'une exécution a tourné avec
un filtre de contrat. Les nuits d'avant et d'après le 28 août sont donc
incomparables, et les journaux GitHub Actions expirent à 90 jours — après quoi
l'écran de suivi d'exploitation affichera une chute de 22 % sans explication
disponible nulle part. Une colonne sur `executions_veille`, écrite à
`ouvrir_execution()`, referme le trou pour une migration.

### L'API Batches est close — le lot de 3 offres prouve le `custom_id`

Lancé avec l'accord de Maxime, ~0,9 centime. Lot `msgbatch_016Vf4…`, **5 min 06**,
3 offres notées, 0 échec, exécution #51.

**Pourquoi trois et pas une.** Le lot du 26 août portait une seule offre : sur
une, apparier par identifiant et apparier par position donnent le même résultat,
donc le test ne pouvait pas échouer. Trois offres de métiers étrangers l'un à
l'autre ont été déposées à dessein :

| Offre | Note d'intérêt | Ce que la justification revenue dit |
|---|---|---|
| Ingénieur IVV Logiciel — satellite | 8 | « validation/test logiciel (IVV) pour systèmes embarqués spatiaux » |
| Formateurs en réseaux sociaux et IA | 10 | « mission de formation en réseaux sociaux » |
| Alternance DevOps Full stack + AI Agent | 75 | « full stack et agents IA/LLM avec RAG » |

Chaque justification parle du métier de **son** offre. Un appariement positionnel
aurait produit un décalage lisible à l'œil nu.

⚠️ **La vérification devait être sémantique, pas mécanique.** Contrôler que trois
notes ont bien été écrites — ce qu'un test automatique ferait spontanément —
serait passé à côté d'un appariement inversé : trois notes auraient été écrites
dans les deux cas. C'est le *contenu* qui prouve, pas le compte.

✅ **Mesure obtenue en prime, et elle tranche une question de coût** : sur ce lot
de 3, `cache_lecture` = **7 430**, soit exactement deux relectures du préfixe de
3 715. Sur le lot d'une seule offre du 26 août, `cache_lecture` valait **zéro** —
on payait l'écriture du cache sans jamais le relire. Les Batches ne sont donc
rentables qu'à partir de plusieurs offres, et c'est maintenant mesuré des deux
côtés plutôt que supposé.

**Défaut cosmétique corrigé au passage** : la fermeture d'une exécution annonçait
« None distinctes reçues, None nouvelles, None rejetées » sur une notation, qui
n'a ni offres reçues ni rejets. Le compte rendu suit désormais l'étape — un
compteur vide se lit comme un compteur cassé.

### Ce que le modèle a signalé, et qui confirme deux décisions

Sur l'offre satellite : « le texte exige 3 à 5 ans d'expérience alors que le champ
officiel indique 2 ans ». C'est exactement le défaut mesuré le 21 août —
`experienceLibelle` faux une fois sur deux — et les critères demandent de suivre
le texte **et** de signaler la contradiction. Le modèle le fait.

Sur l'alternance : « le contrat est une alternance, statut qui ne correspond plus
à celui du candidat déjà diplômé ». Vérifié sur l'ensemble : les 14 alternances
notées ont une accessibilité moyenne de **11,1**, et **aucune** ne dépasse 40.
Le barème les pénalisait donc déjà — mais l'écran classe par **intérêt**, où
elles sortent à 34,3 de moyenne contre 10,8 pour le reste. Elles remontaient en
tête malgré une accessibilité au plancher. Le filtre CDI règle ça à la source.

### Phase 2 : la dernière vérification est laissée au temps, délibérément

Il reste un seul point : l'état de l'écran à **200 offres notées**, vérifié en
simulation le 26 août mais jamais sur données réelles. Il manque 74 offres.

**Décidé de ne pas payer pour l'atteindre**, et le motif n'est pas l'économie :
200 est aussi le seuil où l'écran casse. Au-delà, les 200 lignes affichées sont
les 200 meilleures de tous les temps, et les offres du matin — intérêt médian 10
— n'y entrent plus. Payer 44 centimes reviendrait à payer pour déclencher un
défaut connu dont le remède est planifié en phase 4, avec les filtres. Au rythme
actuel (~7 offres notées par nuit), le seuil tombe seul vers le 8 septembre.

Phase 2 : **14 critères d'acceptation sur 15 pleinement vérifiés.**

---

## 28 août 2026 — Clôture de la phase 2

14 critères d'acceptation sur 15 vérifiés avec leur preuve. Le quinzième —
l'écran à 200 offres notées — reste vérifié en simulation, par choix : il manque
74 offres, et 200 est aussi le seuil où l'écran casse.

### Ce qui a été regardé, et comment

L'app lancée avec un **mot de passe de test passé par l'environnement**, jamais
écrit dans `interface/.env.local` — empreinte MD5 relevée avant et après la
session, identique. C'est la parade à la règle « aucun secret dans la
conversation », et elle a tenu.

Quatre combinaisons : 1280 px et 375 px, clair et sombre. Aucun débordement
horizontal, **0 cartouche sur deux lignes sur 200 offres**, console à 0 erreur et
0 avertissement, focus clavier visible.

Deux états déclenchés pour de vrai plutôt que forcés à l'écran : la **base
injoignable** (serveur relancé sur une URL Supabase morte) et le **mot de passe
incorrect**. Le premier affiche « La base est injoignable » en précisant que les
offres ne sont pas perdues ; le motif technique ne quitte pas le serveur.

⚠️ **Deux choses n'ont PAS pu être vues, et le rapport le dit** : le squelette de
chargement en vol — Turbopack répond en 332 ms, donc il n'apparaît jamais, et
seule la garantie structurelle est établie (même `RYTHME_LIGNE` partagé, en
`rem`, aucune hauteur en dur des deux côtés) ; et l'état « base vide », qui n'est
plus reproductible depuis que la base ne s'efface pas.

### La revue a trouvé un vrai bug, et deux défauts que j'avais introduits

⚠️ **`--sans-ecrire` écrivait en base.** Une passe à blanc de la notation ouvrait
*et* fermait une vraie ligne d'`executions_veille` annonçant « 3 offres notées »
alors qu'aucune note n'était écrite dans `offres`. Rien ne plantait, rien ne se
voyait : seul l'historique était faux — celui-là même que l'écran de suivi
d'exploitation lira et qui, par définition, ne se reconstitue pas. Défaut
préexistant, que le message de journal ajouté le matin même rendait plus
crédible.

**Prouvé sans rien écrire ni rien payer** : les méthodes d'écriture ont été
interceptées et un modèle inexistant a servi d'appel (404 avant facturation,
0 token). `collecte.py` portait pourtant la règle en toutes lettres depuis
toujours — « Tout sauf l'écriture doit vouloir dire tout sauf l'écriture ». La
notation ne la tenait pas.

⚠️ **Ma liste blanche des types de contrat était bâtie sur un échantillon.** J'y
avais mis les 4 codes observés dans 560 offres — `CDI`, `CDD`, `MIS`, `LIB`. Le
référentiel officiel en compte **12**. Conséquence : `TYPE_CONTRAT = "CDI,DIN"`
(CDI intérimaire, un élargissement naturel) aurait fait échouer la collecte au
démarrage, avec un message accusant faussement France Travail de renvoyer une
400. Vérifié : `typeContrat=DIN` et `SAI` répondent **HTTP 204**.

**La leçon vaut plus que le correctif : ce qu'un échantillon contient ne dit pas
ce qu'un système accepte.** Le référentiel est gratuit
(`/referentiel/typesContrats`), et c'est lui qui fait foi. C'est la même erreur
de forme que celle du 26 août sur les intitulés — quatre mesures concordantes
avaient produit la conclusion fausse que « l'intitulé très long n'existe pas ».

**Le filtre CDI ne s'appliquait qu'à la collecte.** Les 82 offres non-CDI
arrivées avant le 28 août étaient toujours dans la file de notation : un
`--limite 100` lancé à la main les aurait payées. Le cron était protégé par
`--derniere-collecte`, les lancements manuels ne l'étaient pas. Filtre ajouté sur
la **même constante** — deux réglages séparés divergeraient, et on repaierait un
jour ce qu'on croit exclure. File désormais à 354 offres, toutes CDI.

### Un raisonnement que j'avais écrit à l'envers

Dans `mots_cles.txt` j'avais conclu que les mesures d'apport net garantissent
qu'« aucun terme n'a été écarté à tort ». C'est le contraire. Un apport net ne
peut que **monter** quand la liste rétrécit : retirer `RPA` et `deploiement` a
donc pu rendre utiles des termes mesurés à 0 — ce qui est précisément vérifié
ailleurs dans le même fichier (`low-code` et `no-code` passent de 0 à 1 sans
« intelligence artificielle »).

Corrigé, avec la liste de ceux à remesurer en premier : ceux qui touchaient au
même gisement que les deux termes retirés.

### Le reste

L'étape est désormais **passée** à `fermer_execution` au lieu d'être devinée du
compteur renseigné : une collecte plantée et une notation plantée produisaient la
même ligne de journal, sur le chemin où l'on a le plus besoin de savoir.

Et une erreur d'arrondi propagée à trois endroits : 58 offres écartées sur 266
font **22 %**, pas 21.

### Ce qui reste ouvert après la phase 2

- **`intelligence artificielle`** — 127 offres nettes/mois pour un maximum de 15.
  Proposé, non arbitré.
- **La trace du filtre en base** — rien dans `executions_veille` ne dit qu'une
  exécution a tourné avec un filtre de contrat. Les nuits d'avant et d'après le
  28 août sont incomparables, et les journaux GitHub expirent à 90 jours. Une
  colonne, une migration.
- **Le plafond de 200** — à 126 notées il reste 74 places. Quand il mordra, les
  offres du matin disparaîtront de l'écran. À traiter en phase 4 avec les filtres.

---

## 28 août 2026, dans la journée — Ce que la fiche d'offre affichera, et ce qu'elle refuse d'afficher

Préparation de la phase 3. Aucune ligne de code encore : d'abord mesurer quelle
matière existe vraiment, sur les 560 offres en base. Trois décisions en sont
sorties, et deux d'entre elles vont **contre** ce qui était écrit avant.

### Les métadonnées : la présence globale ment, il faut la croiser avec les bonnes offres

La fiche s'ouvre surtout sur les offres bien notées. Un champ présent sur 38 %
de la base peut être présent sur 5 % du haut de classement, ou l'inverse. Mesuré
sur les 560, les 126 notées, et les 20 meilleures :

| Champ | Les 560 | Top 20 | Retenu |
|---|---|---|---|
| `nature_contrat` (+ `alternance`) | 100 % | 100 % | ✅ |
| `appellation_libelle` + `rome_libelle` | 100 % | 100 % | ✅ |
| `qualification_libelle` | 33 % | 45 % | ✅ quand présent |
| `langues` | 5 % | 5 % | ✅ quand présent, **sans cartouche d'absence** |
| `secteur_activite_libelle` / `code_naf` | 38 % | 30 % | ❌ |
| `tranche_effectif` | 28 % | 30 % | ❌ |
| `competences` | 18 % | 25 % | ❌ |
| `formations` | 7 % | 5 % | ❌ |
| `manque_candidats` | non renseigné sur 450 | 16/20 vides | ❌ |
| `experience_libelle` | 100 % | 100 % | ❌ **il ment une fois sur deux** |

**Pourquoi `nature_contrat` est le plus utile de la liste.** `type_contrat_libelle`
dit « CDI » ; `nature_contrat` dit « Contrat apprentissage ». Ce sont deux choses
différentes, et **7 des 20 meilleures offres sont des alternances**. Le cas
emblématique du projet en est une : « Alternant Ingénieur IA Agentique », 85
d'intérêt et 15 d'accessibilité. Sans ce champ, un tel écart ne s'explique qu'en
lisant la justification.

**Pourquoi l'appellation ROME entre.** Elle dit *pourquoi cette offre est là*.
Sur l'offre à 85, l'annonce titre « Alternant Ingénieur IA Agentique » et le
référentiel la classe « Spécialiste IA embarquée ». C'est ce champ que le moteur
France Travail indexe — c'est même par lui que le faux positif `IPR-IA` entrait
dans la collecte. La fiche prolonge ainsi ce que fait déjà la liste : rendre
visible ce que les critères ramènent.

**Pourquoi la taille d'entreprise et le secteur sont écartés bien qu'ils soient
là.** Ils sont la matière de la **phase 6** (US-17). Les afficher maintenant
prépare une contradiction qu'aucune règle n'arbitrerait : l'agent trouve « 250
salariés » en lisant le site, France Travail dit « 6 à 9 salariés », et les deux
s'affichent sur la même page. Accessoirement, la valeur la plus fréquente de
`tranche_effectif` est une phrase de 106 caractères qui ne rentre dans aucun
cartouche.

⚠️ **Le principe qui a servi à trancher, et qui resservira** : une rubrique dont
le champ manque une fois sur deux transforme la fiche en gruyère de « non
disponible ». Trois champs toujours présents valent mieux que huit à moitié
vides — **sauf** quand l'absence a été *conçue*, comme le cartouche « Salaire non
précisé », qui dit quelque chose au lieu de laisser un trou.

### L'anglais : le champ structuré rate 92 % des cas

Maxime a demandé les langues, pour une raison précise — il veut savoir si un bon
niveau d'anglais est exigé. Mesuré avant d'accepter :

| | |
|---|---|
| Offres dont le **texte** parle d'anglais | **127 sur 560** (23 %) |
| … que le champ `langues` capte | **10** |
| … que le champ **rate** | **117**, soit **92 % d'angle mort** |
| Champ rempli alors que le texte n'en parle pas | 20 |
| Sur le top 20 | 4 exigent l'anglais dans le texte, **1** a le champ |

Ce que le champ rate est exactement ce qui compte : « Anglais : professionnel
indispensable », « Bilingue anglais », « Anglais niveau C1 CECRL », « niveau
d'anglais courant indispensable » — champ vide sur les quatre.

⚠️ **Le danger n'est pas la rareté du champ, c'est qu'il mente par son absence.**
Une fiche sans rubrique Langues se lirait « pas d'anglais exigé » alors qu'elle
veut dire « France Travail n'a pas rempli la case ». C'est le `NULL` ≠ `false` de
la base remonté à l'écran, et le même piège que `experience_libelle`.

**Décision : le champ s'affiche quand il existe, et AUCUN cartouche d'absence
n'est posé.** Un « Langues : non précisé » affirmerait quelque chose de faux 117
fois sur 127.

**La vraie parade est ailleurs** : `criteres_pertinence.txt` ne dit rien des
langues — le niveau d'anglais de Maxime n'est nulle part dans son profil — et
**0 justification d'accessibilité sur 126** ne mentionne l'anglais. Le modèle lit
pourtant le texte intégral : il voit le « C1 CECRL », il ne le remonte pas parce
que personne ne lui a dit que ça comptait. Proposition faite, non encore
arbitrée : porter l'exigence linguistique dans le barème d'accessibilité.
⚠️ Elle ne repasserait **pas** sur les 126 offres déjà notées — la notation est
incrémentale et `--renoter` est mis de côté avec son bug connu.

### `contact_nom` s'affiche — décision de Maxime, et la règle est amendée, pas contournée

Le PRD interdisait à `contact_nom` et `contact_url_postulation` de « sortir de la
base : ni journal, ni export, ni page publique ». Maxime a tranché ce jour :
**les deux s'affichent sur la fiche**. Le motif est bon et vaut d'être retenu —
ces champs sont conservés *parce qu'ils servent à candidater* ; les garder sans
jamais les afficher, c'était porter le risque sans l'usage. Le site est derrière
son mot de passe, avec un seul utilisateur.

Remesuré avant d'appliquer, pour qu'il sache ce qu'il affiche : **39 offres sur
560 portent un contact (7 %), dont 21 nomment une personne réelle** (« TIM FRANCE
- Mme Isabelle BARBERET »), les 18 autres étant des agences France Travail. La
mesure du 20 août — 3 % des offres nomment une personne — est confirmée à
l'échelle de 560.

⚠️ **Ce qui n'est pas amendé, et qui est le plus dangereux** : jamais dans un
**journal d'exécution**. Ceux de GitHub Actions sont **publics**, le dépôt
l'étant, et une valeur imprimée une fois y reste. Ni export, ni page publique, ni
**liste `/offres`** — `contact_nom` reste hors des colonnes que la liste lit. Un
champ ne se lit que là où il s'affiche.

`docs/PRD.md` § Données personnelles et `CLAUDE.md` § Sécurité ont été corrigés
dans le même mouvement : une règle qu'on contourne en silence protège moins
qu'une règle précise qu'on respecte.

---

## 28 août 2026 — Clôture de la phase 3 : la fiche d'une offre

**12 critères sur 12, tous vérifiés en exécution.** L'écran `/offres/[identifiant]`
existe, les lignes de la liste y mènent, et la phase 4 est démarrable.

### Ce qui est livré

Un clic sur une offre ouvre sa fiche : entête complet, résumé, les deux notes avec
leurs justifications, le classement France Travail, la description intégrale
repliée derrière un bouton, et comment candidater — annonce d'origine, lien de
candidature directe et nom du contact quand ils existent.

### La décision de mise en page : colonne unique, et le défaut connu est clos

`docs/DESIGN.md` portait depuis le 16 août un « défaut connu, non corrigé » :
**la colonne gauche de la fiche est creuse**. Son échéance était cette phase.

Tranché : **colonne unique**, et le motif n'est pas esthétique. Deux mesures l'ont
décidé.

1. **Le défaut était pire que décrit.** Il annonçait « le résumé fait trois
   lignes » ; mesuré sur les 126 offres notées, le résumé fait **122 caractères en
   médiane** — une ligne et demie — et il est **absent sur les 434 offres pas
   encore notées**, puisqu'il est écrit par la notation.
2. **La colonne de droite n'a rien à porter avant la phase 6.** Elle était prévue
   pour la fiche d'enrichissement. Deux colonnes aujourd'hui, c'est 404 px de vide
   sur toute la hauteur.

⚠️ **La question se rouvre en phase 6**, quand il y aura de quoi remplir. Une
échéance qui se ferme sur « on a mesuré et voici pourquoi » n'est pas la même
chose qu'une échéance qui expire en silence.

### Aucun composant client, et c'est une décision de sécurité

Cette page lit `contact_nom` — le seul champ nominatif du projet. Tant que toute
la chaîne reste en composants serveur, **les props ne traversent pas** vers le
navigateur : seul le rendu traverse. Vérifié sur la page rendue : `charge_brute`,
`notation_motif_echec`, `execution_id`, `tokens_cumules` et `salaire_annuel_min`
apparaissent **0 fois**, contre 6 pour un texte réellement affiché.

C'est ce qui a fait écarter l'`Accordion` de shadcn pour déplier la description au
profit du **`<details>` natif** du navigateur. Le composant aurait été un composant
client, donc une frontière ouverte, pour un simple ouvert/fermé. Le natif marche
sans JavaScript, gère le focus clavier tout seul, et Ctrl+F ouvre le bloc.
**Une bibliothèque qui coûte une frontière de sécurité pour un comportement que le
navigateur sait déjà faire est un mauvais échange.**

### Le piège technique de la phase : l'injection de paramètre PostgREST

L'identifiant vient de la barre d'adresse. `lib/supabase.ts` portait depuis la
phase 1 un commentaire disant « quand une valeur venue de l'extérieur entrera ici,
le garde-fou se pose à ce point de passage unique ». Ce moment est arrivé — par la
fiche, pas par le filtre de statut de la phase 4 qu'on attendait.

**Mesuré contre la vraie base**, et le mécanisme n'est pas celui qu'on suppose :

| Requête | Ce qui revient |
|---|---|
| `select=…&identifiant=eq.X&select=*` | 2 colonnes — l'injection ne fait rien |
| `identifiant=eq.X&select=*&select=…` | **44 colonnes, `charge_brute` comprise** |
| `limit=1&limit=5` | 5 lignes |
| valeur encodée `eq.X%26select%3D%2A` | **0 ligne** |

Sur `select`, PostgREST retient le **premier**. Sur `limit`, le **dernier**. Une
protection par l'ordre existait donc, mais elle tenait à l'endroit où le `select`
était écrit dans la chaîne — un appelant plaçant son filtre en premier obtenait
la table entière.

⚠️ **La leçon dépasse PostgREST : se reposer sur un comportement qu'on n'a pas
choisi n'est pas une protection, c'est une coïncidence.** D'où deux verrous
indépendants — le format refusé avant la base, et la valeur encodée au point de
passage unique.

### L'enquête sur l'échec intermittent, et ce qu'elle a corrigé chez moi

Une ligne « `[base] requête impossible (TypeError) sur executions_veille` » avait
été relevée. Cinq scénarios de reproduction ont échoué — concurrence, connexions
refroidies, coupure client, recompilation, rafales — puis **232 rendus
instrumentés sans un seul échec**, avec un témoin pour prouver que l'instrument
fonctionnait.

⚠️ **Le taux annoncé au départ était faux** : « une fois sur sept » venait d'une
division par les seuls `GET /offres`, en oubliant les 25 `GET /offres/xxx` du même
journal. Le taux réel est **une fois sur ~430 rendus**.

Conclusion : **il n'y a pas de bug**. Un échec réseau isolé vers un service
distant est un événement normal. Restaient deux vrais défauts, corrigés :

- **Le diagnostic était aveugle.** Le journal ne disait que `erreur.name`, soit
  « TypeError » — qui chez Node n'est pas une cause mais l'enveloppe de *toute*
  panne réseau. La cause vit dans `erreur.cause.code`. C'est ce manque qui a coûté
  cinq scénarios de reproduction.
- **Aucune reprise n'était tentée.** Les trois requêtes de `/offres` partent
  ensemble et celle qui lit `executions_veille` porte le marqueur « Nouveau » :
  une coupure de vingt millisecondes le faisait disparaître de toute la page, en
  silence.

⚠️ **On ne reprend JAMAIS sur un délai dépassé** : 8 s + 8 s = 16 s, au-delà du
plafond d'exécution d'une fonction Vercel. Le cas n'est pas théorique — sous
rafale de douze rendus simultanés, **six requêtes ont réellement dépassé les 8 s**,
alors qu'un rendu de la liste prend déjà 1,5 s à vide.

### Ce que la revue de code a trouvé, et pourquoi les cinq constats méritaient d'être corrigés

Cinq constats, tous classés mineurs, tous fondés. Deux catégories :

**Deux écrans qui mentaient.** Le titre de l'onglet annonçait « Offre introuvable »
même quand la panne était « base injoignable » — or le titre survit dans
l'historique et les favoris. Et dans cette même branche, plus aucun `h1` : c'est
l'intitulé de l'offre qui le porte, et il n'a justement pas pu être lu.

**Deux pièges qui n'auraient rien signalé.** `offre.langues` est du `jsonb`
recopié verbatim — un objet au lieu d'une liste, et le `.map()` levait en plein
rendu alors que `lireOffre()` promet de ne jamais lever. Et `options.egal`
préfixait ses filtres d'un `&` en supposant un `?` déjà présent : le premier
appelant qui écrira `interrogerBase("offres", { egal: … })` aurait obtenu
`offres&identifiant=eq.X`, que PostgREST lit comme un **nom de table** — la table
entière rendue au lieu d'une ligne, sans erreur.

**Un champ qui voyageait pour rien** : `alternance`, lu mais jamais affiché.
L'information est portée par `nature_contrat`. C'est la règle que le fichier
énonce lui-même pour les champs de contact — un champ ne se lit que là où il
s'affiche.

### Les métadonnées : la présence globale ment

La fiche s'ouvre surtout sur les bonnes offres, pas sur les 560. Croiser les deux
taux change les décisions : `qualification_libelle` passe de 33 % à **45 %** sur
les vingt meilleures.

⚠️ **`experience_libelle` est écarté bien qu'il soit renseigné sur 560 offres sur
560** — il contredit le texte de l'annonce une fois sur deux. L'afficher au même
rang que le lieu, c'est poser un mensonge dans la colonne des faits. C'est aussi
l'argument central du projet : si ces métadonnées suffisaient, un modèle n'aurait
pas besoin de lire le texte.

⚠️ **`tranche_effectif` et le secteur sont écartés aussi, et pas pour la même
raison** : ils sont la matière de la phase 6. Les afficher maintenant préparerait
deux valeurs contradictoires sur la même page — « 250 salariés » trouvé par
l'agent, « 6 à 9 salariés » dit par France Travail — sans aucune règle d'arbitrage.

### Deux décisions de Maxime, prises en séance

**`contact_nom` s'affiche.** Le PRD l'interdisait ; la règle est **amendée, pas
contournée**. Motif retenu : ces champs sont conservés *parce qu'ils servent à
candidater*, et les garder sans jamais les afficher revenait à porter le risque
sans l'usage. ⚠️ Ce qui n'est pas amendé : jamais dans un journal — ceux de GitHub
Actions sont **publics** — ni dans un export, ni dans la liste.

**L'anglais entre dans le barème d'accessibilité**, avec deux garde-fous que
Maxime a posés lui-même : on ne pénalise que sur une mention explicite, et la
pénalité vaut **5 à 10 points, pas 15 à 25**. Simulé sur les 15 offres notées
concernées : à −20, dix passent sous 10 et la médiane du groupe tombe à **zéro** —
la note ne distinguerait plus « exige un anglais courant » de « poste de directeur
avec dix ans d'expérience ».

⚠️ **La leçon vaut au-delà de l'anglais : une pénalité se calibre sur la
distribution réelle des notes, jamais sur l'échelle nominale 0-100.** L'échelle
d'accessibilité a une médiane de 12 et un maximum de 65.

Exercé sur deux offres réelles : « Bilingue anglais » → accessibilité 8, avec
« anglais bilingue explicitement requis » dans la justification. « Anglais
technique apprécié » → aucun point retiré. ⚠️ Le modèle ne l'a pas mentionné dans
ce second cas, et il a probablement raison : la justification fait deux phrases,
et « pile technique totalement étrangère » était le vrai obstacle.

### Ce qui n'a pas pu être vérifié

- **Le test des deux comptes** est sans objet : le produit n'a ni comptes ni rôles.
  Remplacé par un contrôle de fuite de colonnes, avec témoin.
- **Les parcours du cron** (déclenchement, secret masqué dans les journaux
  publics) demandent un déclenchement GitHub Actions et une dépense d'API. Fermés
  le 27 août, non rejoués ce jour.

---

## 29 août 2026 — La fiche reçoit son cadre, puis la phase 4 s'ouvre : l'interface écrit

Séance en deux temps. D'abord une retouche de la fiche d'offre, volontairement
étroite. Ensuite l'ouverture de la phase 4, dont trois étapes sur quatre sont
livrées.

### Le résumé reçoit le cadre de ses voisins — et trois défauts sont mesurés puis laissés

Maxime voulait « finir de designer un peu la fiche ». Or `docs/DESIGN.md` porte
une décision de lui, du 28 août : **le rééquilibrage de la fiche est reporté après
la phase 6**, parce que les phases 4 et 6 vont y poser des boutons de statut, une
note personnelle et un bloc d'enrichissement de quarante lignes — régler
l'équilibre d'une page qui va gagner deux blocs majeurs, c'est le régler deux fois.
La même note laissait une porte : « sauf si l'usage quotidien révèle un défaut
précis ».

La séance a donc cherché des **défauts précis**, en regardant quatre offres réelles
couvrant les cas riche, creux et non noté, en bureau et à 375 px, dans les deux
modes. Rien n'était cassé : aucune erreur console, aucun débordement, focus visible.
Quatre défauts de conception, en revanche :

1. **Les barres de notes en fiche sont celles de la liste** — 88 px dans un bloc de
   952, soit 9 % de la largeur, y compris sur l'offre notée 85. C'est un **écart au
   `DESIGN.md`**, qui prescrit « en fiche, barres larges ». Les 88 px ont une raison
   — aligner 200 lignes pour comparer — et cette raison n'existe pas sur une page
   qui montre une seule offre.
2. **Sur une offre non notée, la fiche ne montre rien.** Vérifié sur `6141371` : ni
   résumé ni évaluation, et les 2 929 caractères de description repliés derrière un
   clic. La page tient en un demi-écran. **434 offres sur 567**, soit 76 % de la base.
3. **Le résumé était le seul des cinq blocs sans cadre**, et son paragraphe s'arrêtait
   à 690 px sur 952 — il se lisait comme un texte tronqué.
4. **Les cinq titres de section ont le même poids** : « ÉVALUATION », que le produit
   fabrique, se présente comme « CLASSEMENT FRANCE TRAVAIL », qui est du référentiel
   recopié.

**Arbitrage de Maxime : seul le n° 3 est corrigé**, et on passe à la phase 4. Les
trois autres sont consignés dans `docs/DESIGN.md` avec leurs mesures, pour ne pas
être remesurés. ⚠️ Le n° 2 **se résorbe tout seul** à mesure que la base se note.

Le cadre posé, `max-w-prose` est **conservé** : sans lui la ligne ferait ~150
caractères, au-delà du confort de lecture. Le vide à droite subsiste mais, dans un
cadre, il se lit comme une marge — c'est sans cadre qu'il coupait.

### Phase 4, étape 1 — le schéma, et un bug attrapé par son propre test

Conçu avec Maxime. Deux questions lui ont été posées, deux décisions prises :
**les deux colonnes de date sont conservées** (un historique ne se reconstitue pas ;
sans elles la liste des candidatures ne peut se classer que par note d'intérêt là
où « savoir où j'en suis » est chronologique), et **le filtre par défaut n'affiche
que « à traiter »**.

Migration 6 : `statut` (`not null default 'a_traiter'`), `statut_modifie_a`,
`note_personnelle`, `note_modifiee_a`.

⚠️ **Le `default 'a_traiter'` n'entorse pas la règle `NULL` ≠ `false`** : cette règle
interdit d'inventer une donnée absente, or « à traiter » est *réellement* l'état de
toute offre qui vient d'arriver. La valeur par défaut décrit la vérité au lieu de la
deviner. ⚠️ **Aucun `default now()` sur les dates**, en revanche : il aurait affirmé
que les 567 offres existantes ont été triées le matin de la migration.

**Le test d'acceptation a trouvé un bug dans la migration qu'il testait.** La
contrainte « une note vide doit être `NULL` » était écrite `btrim(note) <> ''`. Or
`btrim` à un seul argument **ne retire que les espaces** — ni saut de ligne, ni
tabulation. Une note réduite à `"   \n"` passait : **HTTP 204** là où les six autres
violations rendaient 400.

⚠️ **Le cas est loin d'être théorique** : un champ à enregistrement automatique — ce
que l'étape 4 va construire — produit exactement ça quand on efface son texte en
laissant un retour à la ligne. La note aurait été « vide à l'écran, renseignée en
base », et l'indicateur aurait dit « enregistré » pour du néant.

Migration 7, corrective — **la 6 n'est pas réécrite, elle est déjà dans la base**.
Reformulée en `~ '[^[:space:]]'`, « contient au moins un caractère non blanc », qui
n'a aucune liste de caractères à oublier. ⚠️ **La leçon** : formuler une contrainte
en « contient du contenu » plutôt qu'en « n'est pas vide après nettoyage ».

**26 contrôles contre la base réelle** : lecture des défauts sur les 567 lignes,
écriture des trois statuts, note de 5 000 caractères accentués, cinq formes de blancs
refusées, une note entourée de blancs acceptée, et chaque contrainte violée une par
une. Vérifié séparément qu'**une recollecte nocturne n'écrase ni le statut ni la
note** : la même offre représentée avec un intitulé différent → 0 ligne écrite,
statut intact. `resolution=ignore-duplicates` protégeait déjà, mais ça se prouve.

### Étape 2 — la première écriture de l'interface

Jusqu'ici, seul `pipeline/stockage.py` écrivait, seul et de nuit. `interrogerBase()`
n'avait ni méthode HTTP ni corps de requête.

`ecrireDansBase()` est sa sœur, avec **trois différences qui ne sont pas
cosmétiques** : le nom de table ne peut porter aucune valeur extérieure ; les valeurs
partent dans le corps JSON, donc sans encodage ni ordre de paramètres PostgREST dont
dépendrait la sécurité ; et **le filtre est obligatoire** — un `PATCH` sans filtre
réécrit toute la table, PostgREST l'accepte sans broncher, et les 567 offres
passeraient candidatées d'un coup sans erreur ni retour arrière.

⚠️ **`lib/statuts.ts` est le premier module de `lib/` SANS `import "server-only"`, et
c'est sa raison d'être.** Les composants clients ont besoin des mêmes trois valeurs
que le serveur ; s'ils importaient `lib/offres.ts` pour les obtenir, ils tireraient
`lib/supabase.ts` — donc la clé secrète — dans le graphe du navigateur. **Séparer les
constantes du code qui lit les secrets est ce qui rend la frontière tenable.**

⚠️ **Premiers composants clients du projet**, donc rupture de la propriété mesurée en
phase 2. Ce qui la remplace est une **discipline de props** : `identifiant` et
`statut`, jamais l'objet `offre`. Vérifié — dix colonnes interdites cherchées dans le
document reçu par le navigateur, sur les deux écrans, témoin positif : aucune.

⚠️ **Le double clic n'est pas bloqué sur le bouton, l'opération est idempotente** :
poser `statut = 'candidate'` deux fois donne le même état final. Un bouton désactivé
se contourne, la nature de l'opération non.

`useOptimistic` sert deux fois : le retour immédiat, **et le retour à la vérité en cas
d'échec** — il retombe seul sur la valeur de la prop quand la transition s'achève. Un
`useState` aurait gardé le mensonge à l'écran.

Vérifié en cliquant, pas en relisant : écriture confirmée en base depuis la fiche et
depuis la liste, bascule qui efface la date, clic en liste qui n'ouvre pas la fiche
malgré le lien étendu (`z-10`), et **session expirée simulée en vidant le cookie** —
message affiché, statut revenu à sa valeur réelle.

Cible tactile portée de **36×24 à 32×48 px** sous 640 px. ⚠️ L'extension est
**verticale seulement** : les boutons sont espacés de 6 px, une extension horizontale
ferait se chevaucher leurs zones et viser « Candidaté » écarterait l'offre une fois
sur deux. **Une cible trop grande est un pire défaut que la cible trop petite qu'elle
corrige.**

Trois sauts de mise en page mesurés et corrigés : rangée du haut de la liste (12 px,
**deux valeurs selon la largeur** — 27 px en bureau, 32 px sous 640 px où les boutons
deviennent carrés), entête de fiche (52 px), squelette du résumé resté sur une barre
nue après le cadre posé le matin même (93 px). **145 px de saut ramenés à ~1 px.**

### Étape 3 — le filtre vit dans l'adresse

`/offres` n'affiche plus que les offres « à traiter ». Trois autres filtres à un clic,
chacun avec son compte.

⚠️ **Des `<Link>` et non des boutons**, parce que c'est le critère d'acceptation
lui-même : « se met en favori et survit au bouton retour ». Des boutons à état React
donneraient le même écran et perdraient les deux. **L'adresse est le seul endroit
qu'un navigateur sait conserver.**

⚠️ **Le filtre par défaut n'écrit rien** — `/offres`, jamais `/offres?statut=a_traiter`.
Deux adresses pour un même écran fabriquent deux entrées d'historique et un paramètre
qui traîne dans tous les liens partagés.

⚠️ **Une valeur inconnue retombe sur le défaut**, alors qu'un identifiant d'offre
invalide rend « introuvable ». La distinction n'est pas arbitraire : une fiche
**désigne** une chose qui existe ou non, un filtre ne désigne rien — il restreint, et
une restriction incomprise se répare en ne restreignant rien de particulier.

⚠️ **Deux états vides désormais, et les confondre aurait été un vrai défaut** : « la
base est vide » est l'écran du premier matin, « ce filtre est vide » celui d'un matin
où tout a été trié. Servir le premier message au second cas ferait croire à une panne
de collecte un jour où le travail est simplement fini.

Un comptage échoué laisse son onglet **muet** plutôt qu'il n'affiche zéro. Vérifié
pour de vrai : le `PGRST303` du développement a fait tomber un comptage, l'onglet
s'est tu et « Toutes » aussi — un total partiel étant faux.

Éprouvé sur **huit formes d'adresse** : accentuée, inconnue, vide, répétée, injection
`%26select=*`, 500 caractères. Aucune ne casse, aucune ne fuit.

⚠️ **Aucun index sur `statut`, délibérément** : trois comptages par affichage sont des
parcours complets, mais sur 574 lignes Postgres les fait en microsecondes. Seuil à
surveiller ~50 000 lignes, soit une vingtaine d'années au rythme de 208 offres/mois.

### Le défaut de la cible mouvante, et l'erreur de mesure qui a suivi

**Découvert en testant autre chose.** Quatre clics rapides destinés à éprouver le
double clic ont candidaté **quatre offres différentes** : trier une offre la retire du
filtre, les suivantes remontent d'un cran, et le clic suivant atteint une autre offre.

Maxime a demandé de le corriger avant de continuer. `_composants/verrou-tri.tsx` :
pendant qu'une écriture est en vol, **tous** les boutons de la liste sont désactivés.
⚠️ **Le verrou porte sur la liste entière et non sur la ligne** — le bouton dangereux
n'est pas celui qu'on vient de cliquer, c'est celui qui prendra sa place, et on ne
sait pas lequel c'est. Un compteur et non un booléen : deux écritures peuvent se
chevaucher, et la première à revenir rouvrirait la liste alors que la seconde est en
vol.

⚠️ **PREMIÈRE VERSION FAUSSE, et l'erreur vaut d'être retenue.** Elle relâchait le
verrou dans un `finally`, dès le retour de l'appel serveur. Mesuré au DOM :

| Instant après le clic | État |
|---|---|
| +0 à +30 ms | tous les boutons verrouillés |
| **+80 ms** | **le `finally` a relâché — les voisins redeviennent cliquables** |
| +900 ms | la ligne disparaît, les suivantes remontent |

**Le verrou tenait 30 ms pour un défaut survenant à 900.** La bonne borne est
`enCours` de `useTransition`, qui reste vrai jusqu'à ce que le rendu soit **appliqué
au DOM** — l'instant exact du décalage. Le nettoyage de l'effet joue aussi au
démontage, ce qui n'est pas un détail : le composant disparaît avec sa ligne, et sans
ce retour de fonction son verrou ne serait jamais relâché — plus aucun bouton ne
répondrait jusqu'au rechargement.

⚠️ **PIÈGE DE MÉTHODE, qui a fait croire que le correctif ne marchait pas.** Le test
rejouait le geste avec un sélecteur (`première ligne, bouton "Candidaté"`). Or ce
sélecteur cesse de correspondre dès le premier clic — le titre du bouton devient
« Remettre… » — donc **Playwright attend patiemment que la liste se réorganise avant
de cliquer**, c'est-à-dire précisément ce que le correctif doit empêcher. **Pour
éprouver une cible mouvante, il faut cliquer à des coordonnées fixes**, comme une
souris qui ne bouge pas.

Mesures du correctif, même geste avant et après :

| Geste | Avant | Après |
|---|---|---|
| 4 clics au même pixel, sans pause | **4 offres triées** | **1** |
| Double clic humain (180 ms) | **2 offres triées** | **1** |
| 3 tris délibérés à 1,3 s d'écart | 3 | **3** — aucune régression |

⚠️ **Ce que ça coûte** : trier en rafale impose d'attendre un aller-retour entre chaque
(~200 à 400 ms). C'est le prix d'un clic qui atteint toujours l'offre visée.

### Une justification du DESIGN.md devenue fausse

La « collision connue et acceptée » de l'olive — note d'accessibilité *et* statut
candidaté — était excusée par : « les deux ne se croisent jamais dans la même ligne,
puisqu'une offre candidatée quitte la liste du matin ». **Le filtre de cette phase la
dément** : `/offres?statut=candidate` affiche précisément des lignes candidatées avec
leur note d'accessibilité en olive à côté.

La collision reste acceptée, mais **pour une autre raison** : une jauge horizontale de
88 px précédée du mot « ACCESSIBILITÉ » et un bouton carré à coche ne se confondent
pas. ⚠️ **La leçon vaut plus que le cas : une collision de teintes justifiée par
« ces deux choses ne se rencontrent jamais » se périme dès qu'un écran les réunit — et
c'est exactement ce que fait un filtre.**

### Ce qui reste, et l'état à la reprise

**Étape 4 seule restante** : la note personnelle, enregistrement sans bouton,
indicateur d'état visible. C'est là que se joue le **critère de succès n° 6** — réseau
coupé pendant la saisie, le texte ne doit pas être effacé et l'échec doit se voir.

**Base au 29 août 2026** : 574 offres, 140 notées, **574 à traiter / 0 candidaté /
0 écarté** — toutes les offres triées pendant les tests ont été remises à leur état
d'origine, vérifié par comptage.

Quatre commits : `3e3ee57` (cadre du résumé), `d6e04ef` (migrations 6 et 7),
`e185a1b` (la première écriture), `372210f` (le filtre dans l'adresse), `ed3fac5`
(le verrou de tri).

---

## 29 août 2026 — La note personnelle, et la clôture de la phase 4

### Ce qu'on a construit

Un champ libre par offre, sur la fiche, entre l'évaluation du modèle et le classement
France Travail. Il s'enregistre tout seul : 800 ms après la dernière frappe, et sans
attendre dès qu'on quitte le champ. Quatre états lisibles à l'écran — *Modification non
enregistrée*, *Enregistrement…*, *Enregistré le 29 août à 12:47*, *Note effacée*.

Cinq pièces : `lib/notes.ts` (la borne et la normalisation du vide, sans `server-only`),
`enregistrerNote()` dans `lib/offres.ts`, l'action serveur `definirNote()`, le composant
client `note-personnelle.tsx`, et deux colonnes ajoutées à `COLONNES_FICHE` — **jamais à
`COLONNES_LISTE`**.

### La décision qui structure tout le reste : pas d'état optimiste

Les boutons de statut utilisent `useOptimistic`, qui **retombe automatiquement sur la
valeur du serveur** à la fin de la transition. C'est exactement ce qu'il faut pour un
statut : si l'écriture échoue, l'affichage revient tout seul à la vérité de la base, sans
une ligne de code de plus.

Ici, ce serait le défaut à ne pas commettre : un enregistrement raté effacerait sous les
doigts de Maxime le paragraphe qu'il vient d'écrire. **Le texte à l'écran appartient à
celui qui tape, pas à la base.** D'où un `useState` ordinaire, et un `useRef` en double
pour que la fonction d'envoi différée lise la valeur courante et non celle figée au
moment où elle a été créée.

⚠️ **La leçon générale : le bon patron dépend de qui détient la vérité.** Pour un
statut, c'est la base — l'optimiste est correct. Pour un texte en cours de frappe, c'est
l'utilisateur — l'optimiste est un destructeur de données.

### Une seule écriture en vol, et pourquoi ce n'est pas de la frugalité

Deux `PATCH` lancés à 100 ms d'écart peuvent arriver dans le désordre chez Postgres : la
réponse de l'ancienne version arriverait en dernier, l'écran afficherait « Enregistré »
pour un texte que la base ne détient plus. Un drapeau `enVol` bloque le second envoi, un
drapeau `relancer` mémorise qu'une frappe est survenue pendant, et le `finally` repart
avec le texte le plus récent.

**Éprouvé en ralentissant le serveur à 1,5 s** par requête, puis en tapant trois fois à
900 ms d'intervalle : la base finit sur `AAA BBB CCC`, la dernière version, et
l'indicateur affiche « Enregistrement… » pendant tout ce temps. Sans ce mécanisme, la
mesure aurait été impossible à faire en local — l'aller-retour réel fait 80 ms et le
recouvrement ne se produit jamais.

### Le vide n'a qu'une représentation, et c'est le piège du 29 août

Un champ à enregistrement automatique envoie `"   \n"` dès qu'on efface son texte —
personne ne soumet un formulaire vide, mais tout le monde efface une note. La contrainte
`note_personnelle_non_vide` (migration 7) l'aurait refusé en 400, et l'indicateur aurait
affiché « échec » sur le geste le plus banal qui soit. `normaliserNote()` ramène tout
texte entièrement blanc à `NULL` **avant** d'écrire, et efface la date avec lui.

⚠️ **Le contrôle du code est volontairement plus strict que celui de la base, dans les
deux sens** : `trim()` en JavaScript est plus agressif que `~ '[^[:space:]]'` en SQL, et
`String.length` compte en UTF-16 là où `length()` compte des points de code — un emoji
pèse 2 d'un côté, 1 de l'autre. **On peut donc refuser ce que la base aurait accepté,
jamais l'inverse.** C'est le seul sens qui évite un 400 que rien n'annoncerait.

### La borne des 20 000 caractères est vérifiée trois fois

`maxLength` sur le champ (confort de frappe), l'action serveur (le contrôle qui compte),
la contrainte `note_personnelle_bornee` (le dernier mot). **Éprouvé en retirant
`maxlength` dans les outils du navigateur et en posant 20 100 caractères** : le serveur
refuse avec un message lisible, le texte reste à l'écran.

⚠️ **C'est l'argument transférable en entretien** : un attribut HTML ne protège rien. Une
action serveur s'invoque par un `POST` que rien n'oblige à partir de notre page — vérifié
aussi sans cookie de session, qui rend **401** et n'écrit rien.

### Ce que la revue de code a trouvé, et le raisonnement que j'avais faux

Six constats, cinq corrigés, un réfuté puis **confirmé après une meilleure mesure**.

| Constat | Ce que c'était |
|---|---|
| `loading.tsx` sans la section « Ma note » | La fiche est passée de 5 à 6 sections sans que son squelette bouge : **222 px de saut** à l'arrivée du contenu. Troisième saut de ce fichier après 297 px et 93 px |
| « N offres · M notées » désaccordés | `compterNotees()` ne portait pas le filtre : `?statut=candidate` affichait « 1 offre · 140 notées ». Le défaut est **né avec les filtres** — avant eux, les deux comptages coïncidaient |
| Pas de `revalidatePath` | Voir ci-dessous |
| L'effacement ne disait rien | Note effacée = plus de date = indicateur muet. Or **effacer est une écriture** : ajout d'un état « Note effacée » |
| L'échec survivait à l'annulation | Annuler sa frappe après une panne laissait « Enregistré » et « Enregistrement impossible » affichés ensemble |
| `identifiant` non revérifié comme chaîne | `FORMAT_IDENTIFIANT.test(1234567)` convertit et rend `true`, puis `.toUpperCase()` lève — la fonction promet de ne jamais lever |

⚠️ **Le troisième mérite son paragraphe, parce que je m'étais trompé et que la façon dont
je m'en suis aperçu compte plus que le correctif.** J'avais écrit qu'aucun
`revalidatePath` n'était nécessaire : rien d'autre à l'écran ne dépend de la note, et
revalider re-rendrait la fiche à chaque pause de frappe. J'avais même **mesuré** —
écriture, aller à la liste, retour : la note était là. La revue a maintenu le constat ; en
refaisant le test j'ai vu que mon chemin d'historique n'était pas le sien.

| Chemin | Résultat |
|---|---|
| Fiche → liste → **clic sur le lien de la ligne** | note présente ✅ |
| Fiche → liste → **bouton retour du navigateur** | **champ vide** ❌ |

Le second restaure une entrée d'historique **antérieure** à l'écriture, et Next sert son
payload en cache. La note est en base, l'écran affirme le contraire : le pire des deux
mondes pour un critère de succès qui porte précisément sur « ne pas croire à tort ».

⚠️ **La leçon de méthode : « j'ai mesuré » ne vaut que si on dit *quel* chemin on a
mesuré.** Deux gestes que l'utilisateur ne distingue pas — revenir par un lien, revenir
par le bouton retour — passent par deux mécanismes différents. Une mesure qui n'énonce
pas son chemin donne une fausse assurance, exactement comme un maximum observé donné pour
une borne (26 août) ou un sélecteur re-résolu donné pour un double clic (29 août au matin).

Le correctif est `revalidatePath("/offres/[identifiant]", "page")` : le **motif de route**
et non l'adresse concrète, pour couvrir aussi la fiche ouverte avec un identifiant en
minuscules ; et `"page"` et non `"layout"`, parce que la note ne change rien à la liste.

### Le champ grandit avec la note — trouvé en testant le critère, pas en le lisant

Le critère disait « une note de 5 000 caractères se réaffiche intégralement ». Elle se
réaffichait : la valeur était intacte. **Mais dans un champ de 148 px**, soit cinq lignes
visibles sur soixante, avec un ascenseur imbriqué dans la page. Techniquement conforme,
concrètement inutilisable.

Le champ ajuste désormais sa hauteur au contenu jusqu'à **60 vh** (540 px mesurés), puis
défile. ⚠️ Deux détails qui ne se devinent pas : `height = "auto"` **avant** de lire
`scrollHeight`, sans quoi le champ ne rétrécit jamais ; et `useLayoutEffect` plutôt que
`useEffect`, pour que la hauteur soit posée avant que le navigateur ne peigne.

### Ce qui a été vérifié, et comment

- **Critère de succès n° 6**, éprouvé deux fois : `POST` avorté en
  `ERR_INTERNET_DISCONNECTED`, et **cookie de session supprimé en pleine frappe** — le cas
  réel de l'onglet laissé ouvert la nuit. Message affiché, texte intact, rien en base.
- **Cloisonnement** : le contenu d'une note cherché dans le document reçu pour `/offres`,
  `?statut=toutes` et la fiche d'une **autre** offre — absent des trois, témoin positif.
  Douze noms de colonnes interdites cherchés sur trois écrans : aucun.
- **Accès** : `GET` sans session → 307 vers la porte avec `suite` préservé ; `POST`
  d'action serveur sans session → **401**, 28 octets, aucune écriture.
- **Passe visuelle** : 12 combinaisons (2 largeurs × 2 thèmes × 3 écrans), aucun
  débordement, console vide. Contrastes recalculés au canvas plutôt qu'estimés.
- **Base remise à son état d'origine** après chaque campagne de tests : 574 offres,
  574 à traiter, aucune note — vérifié par lecture directe, pas par déduction.

⚠️ **Ce que je n'ai PAS pu voir** : le squelette de chargement à l'écran. En local le
serveur répond en 80 ms et `loading.tsx` ne s'affiche jamais assez longtemps pour être
capté. Son calage est vérifié **par le calcul** — 223 px déclarés contre 222 px mesurés au
DOM pour la section réelle — et non à l'œil.

### Une limite connue, laissée ouverte

**Deux onglets ouverts sur la même fiche** : celui qui tape en dernier écrase la note de
l'autre, sans avertissement. Le produit n'a qu'un utilisateur et le cas demanderait un
horodatage de version à comparer avant d'écrire. Signalé, non corrigé.

---

## 29 août 2026, en fin de journée — Le bandeau de `/offres` devient une manchette

Point de départ : Maxime regarde l'écran et tranche. « Le bandeau au-dessus de la liste
d'offres, je trouve ça trop simple, pas très beau. Il y a juste écrit *Offres* en gros.
*Poste de travail*, on ne sait pas pourquoi. »

### La critique portait sur l'apparence, le vrai motif était ailleurs

Trois défauts, dont un seul se voyait :

1. Le sur-titre « Poste de travail » nommait **une catégorie sans sœur**. Un sur-titre
   sert à distinguer un écran d'autres écrans de la même famille ; ce produit a un seul
   utilisateur et trois écrans qui ne se confondent pas.
2. « Offres » **redisait ce que la liste montre déjà**. Un titre qui nomme le contenu
   visible n'ajoute rien.
3. ⚠️ **Le bandeau n'avait aucune place pour l'indicateur de dernière veille**, qui est
   un critère d'acceptation de la phase 5 — « visible en permanence, sur cet écran comme
   sur le poste de travail ». **C'est ce troisième point qui a commandé le calendrier** :
   `/` et `/offres` portent le même bandeau, le refondre après la phase 5 aurait été le
   refondre deux fois.

### Trois compositions construites pour de vrai, deux écartées sur mesure

Les variantes n'ont pas été décrites, elles ont été **construites** dans une page
d'aperçu temporaire — avec le vrai composant d'onglets — puis regardées à 1280 et
375 px, en clair et en sombre. Deux sont tombées sur des faits, pas sur des goûts :

- **Le chiffre en titre** (« 574 à traiter ») : séduisant au bureau, **cassé à 375 px**.
  Le bloc de veille se replie en restant aligné à droite et fabrique un texte en drapeau
  au milieu de la page. Défaut invisible tant qu'on ne réduit pas la fenêtre. Et le titre
  devient absurde en changeant de filtre — « 0 candidaté ».
- **Le cartouche encadré** : propre, mais il concurrence le titre et repousse les onglets
  vers le bas. Sur un écran dont le travail *est* la liste, chaque pixel de bandeau est
  pris à la liste.

Retenue : **la manchette** — ligne pleine largeur en chasse fixe, état de la veille à
gauche, horodatage à droite, filet, puis « Plan de travail » en Fraunces.

### Ce que la maquette a appris, et qui n'était pas du style

⚠️ **Le libellé « Veille de ce matin » aurait été un mensonge.** Vérification faite sur
les exécutions réelles : les cinq dernières collectes sont parties à **11:11, 14:25 et
12:55** heure de Paris. Le cron de GitHub Actions ne part jamais à l'heure prévue — c'est
déjà documenté — donc tout libellé qui promet un moment de la journée finit par mentir.
L'indicateur affiche un horodatage réel, et le mot « matin » n'apparaît nulle part.

⚠️ **Il fallait cinq états, pas deux.** La maquette n'en montrait que deux — frais et en
retard. Le critère de la phase 5 exige que l'indicateur « signale l'échec », qui est un
cas *différent* du retard : la machine a tourné et raté, ce qui porte une cause. S'y
ajoutent « aucune veille enregistrée » (base neuve) et « état indisponible » (lecture
ratée). **Les deux derniers sont distincts à dessein** : les confondre annoncerait une
panne de collecte un jour où seule la base est injoignable.

⚠️ **L'échec prime sur le retard** quand les deux sont vrais. Le retard est une
conséquence, l'échec est le fait — et c'est lui qui désigne quelque chose à regarder.

### Comment c'est fait

- **`lib/veille.ts`** — deux lectures (dernière collecte réussie, dernier passage quelle
  que soit son issue) et **le calcul séparé en fonction pure**, `calculerEtat()`. La
  séparation n'est pas de la coquetterie : elle rend les seuils éprouvables sans base ni
  réseau.
- **`app/(site)/_composants/etat-veille.tsx`** — posé au niveau du groupe `(site)` et
  **non dans `offres/_composants/`**, exprès pour que `/` le prenne tel quel en phase 5.
  Le `switch` sur les cinq états est exhaustif : ajouter un sixième cas fera échouer la
  compilation au lieu de tomber dans un défaut qui l'afficherait « à jour ».
- **`EnTetePage`** passe de `children` à trois propriétés **nommées** (`manchette`,
  `compte`, `filtres`). C'est ce qui rend l'égalité avec `loading.tsx` vérifiable dans le
  code : avec un `children` unique, la page en passait deux et le squelette trois, et
  l'écart était invisible.
- **`lib/francais.ts`** — `accorder()` sortie de `page.tsx`, où elle était privée, parce
  que la manchette en avait besoin. Troisième module de `lib/` sans `server-only`, et il
  suit le moule : fonctions pures, aucun secret.

### Ce qui a été vérifié, et comment

- **Les dix cas d'affichage**, rendus avec le composant réel et des états fabriqués en
  mémoire — ⚠️ **jamais en écrivant dans `executions_veille`**, qui est la base de
  production. Accords au singulier, bascule « Aujourd'hui » / « Hier », jours de la
  semaine, `offres_nouvelles` à `NULL` qui efface son segment au lieu d'écrire « 0 ».
- **Contrastes recalculés au canvas sur les éléments réellement rendus** : ocre 5,73:1
  clair / 8,59:1 sombre, brique 5,80:1 / 5,26:1, cartouche d'alerte 5,37:1 / 5,03:1.
  ⚠️ **Deux mesures fausses avant la bonne** : `getComputedStyle().color` rend de l'OKLCH
  dans Chrome, lu comme du RGB il donnait 1,44:1 pour du texte plein sur fond. La méthode
  qui tient retrouve à 0,01 près les chiffres déjà inscrits dans `DESIGN.md`, ce qui la
  valide.
- **Calage du squelette mesuré au DOM** — et c'est là que la revue a mordu, voir plus bas.
- **Cloisonnement** : douze termes interdits cherchés dans le **document reçu** (HTML et
  charge RSC) de trois écrans. Une seule occurrence, `description` — faux positif vérifié
  au contexte, c'est la balise `<meta>` du layout. Témoin positif validé.
- **Console** : 0 erreur, 0 avertissement. **Typecheck et lint** propres.
- **Quatre combinaisons regardées** : 1280 et 375 px, clair et sombre.

⚠️ **Ce que je n'ai PAS pu voir** : l'état « base injoignable » sur `/offres` en
conditions réelles — il a été rendu dans la page d'aperçu, pas atteint en coupant la
base. Et le squelette de chargement à l'écran, pour la raison habituelle : en local le
serveur répond trop vite pour qu'il s'affiche.

### Une limite connue, laissée ouverte

**L'indicateur ne vieillit pas dans un onglet resté ouvert.** Il est calculé au rendu
serveur : un onglet laissé ouvert toute la journée affichera encore « Aujourd'hui, 11:11 »
le lendemain, et ne passera jamais en alerte tout seul. Le corriger demanderait une
horloge dans le navigateur — donc un composant client — pour une information qui change
une fois par jour. Signalé dans le code et dans le `CLAUDE.md`, non corrigé.

### Ce que `/code-review` a trouvé, et ce que ça a coûté de le vérifier

Sept points, dont **trois vrais défauts** et un qui a demandé une mesure pour être
tranché. Aucun n'aurait produit d'erreur visible : c'est exactement le genre que
personne ne rattrape après coup.

**1. Une collecte tuée en plein vol passait pour une nuit saine — le plus grave.**
Une exécution tuée laisse `issue = 'en_cours'`, et `pipeline/stockage.py` ne la
referme en `echec` qu'au **démarrage suivant**, soit la nuit d'après. Entre les deux,
mon code lisait la dernière *réussite* et affichait « Dernière veille — Hier, 14:25 »
en ocre, sans un mot sur la collecte morte cette nuit. L'alerte ne serait arrivée
qu'au franchissement des 36 h, le lendemain. ⚠️ **Mon propre commentaire affirmait
que `en_cours` voulait dire « une collecte qui tourne en ce moment »** — vrai pendant
30 minutes, faux pendant les 23 heures suivantes.
**Correctif** : au-delà de 60 minutes — le double du `timeout-minutes` du workflow —
un `en_cours` est traité comme un ratage. Et le libellé distingue « en échec » (le
pipeline a écrit son échec, un motif existe) de « interrompue » (tuée avant d'avoir
rien pu écrire).

**2. « Hier » était calculé dans le fuseau du serveur, comparé en heure de Paris.**
`hier.setDate(hier.getDate() - 1)` retranche un jour dans le fuseau du *runtime* —
UTC sur Vercel — puis le résultat était comparé à un jour *parisien*. La nuit du
passage à l'heure d'été, la journée parisienne ne fait que 23 heures et les deux
divergent.
⚠️ **Ce bug était invisible sur le Mac de Maxime, qui est à Paris.** Il a fallu
relancer les tests avec `TZ=UTC` pour le voir : l'ancien calcul rend alors le **28**
mars là où il fallait le 29, et une collecte de la veille s'affichait « Dimanche
29 mars » au lieu de « Hier ». **Prouvé dans les deux sens** — ancien code en échec,
nouveau code au vert, dans la condition réelle de production.

**3. Deux formateurs purs étaient enfermés derrière `server-only`.** `daterPassage`
et `duree` ne lisent aucun secret, mais vivaient dans `lib/veille.ts`, qui en lit un.
Or `etat-veille.tsx` envisage déjà **par écrit** le composant client qui ferait
vieillir l'indicateur sans rechargement : le jour où quelqu'un l'écrit, il importe
`daterPassage`, tire `lib/supabase.ts` dans le navigateur, et tombe sur une erreur
`server-only` incompréhensible — le fichier qu'il importait ne lisant aucun secret.
**Une fonction pure enfermée derrière `server-only` est une mine, pas une
protection.** Les deux ont rejoint `accorder()` dans `lib/francais.ts`.

**4. Le squelette était juste à 375 et à 1280 px, et faux entre les deux.** Mes
barres valaient 176 + 208 px face à un contenu réel de 451,8 px. La revue l'a déduit
d'un modèle de largeur de caractères ; **je l'ai mesuré au DOM plutôt que de la
croire sur parole**, en balayant de 300 à 760 px par pas de 2 : la bande de
désaccord existait bien, **448 à 496 px**, avec les mêmes 19,40 px de saut que le
squelette existe pour empêcher — simplement déplacés là où personne n'avait
regardé. Les barres reprennent maintenant les largeurs mesurées du cas courant ; les
deux se replient désormais au même point, **452 px**.

⚠️ **La leçon de méthode** : vérifier un squelette à deux largeurs de référence ne
prouve rien entre les deux. Le repli est un **seuil**, et un seuil ne se contrôle
qu'en balayant. Deux points concordants m'avaient donné une fausse certitude — et je
l'avais écrite dans ce journal comme un « écart nul ».

**5. L'écran portait trois noms.** Le `h1` disait « Plan de travail », l'onglet du
navigateur « Offres », le lien de navigation « Offres ». L'onglet suit désormais le
titre ; le lien de nav reste « Offres », parce qu'il nomme **une destination** dans
une liste, comme on clique « Mail » pour arriver sur « Boîte de réception ».

**6. Deux colonnes étaient lues sans être utilisées** — `id` et `terminee_a`. `id`
surtout : le garder laissait croire que ce bandeau et le marqueur « Nouveau » de la
liste sont indexés sur la même ligne, alors que ce sont deux requêtes indépendantes.
Retirées de la requête comme du type.

### Les premiers tests automatisés du projet — décision de Maxime

Les fonctions pures sont désormais éprouvées hors du navigateur : **33 tests**, dans
`interface/lib/francais.test.ts` et `interface/lib/veille.test.ts`. C'est ce qui a
permis de *prouver* le correctif de fuseau au lieu de l'affirmer.

⚠️ **`npm run verifie` lance la suite DEUX fois — et c'est la seconde qui compte.**
La première tourne dans le fuseau de la machine, la seconde avec `TZ=UTC`, celui de
Vercel. Le bug de « Hier » passait parfaitement sur un Mac à l'heure de Paris : sans
ce second passage, la suite entière aurait été verte sur un code faux en production.

**Aucune dépendance ajoutée** : Node 24 exécute le TypeScript nativement
(`--experimental-strip-types`) et embarque son propre lanceur (`node:test`). Deux
obstacles ont demandé du travail, tous deux d'infrastructure et non de logique :

- **`server-only` refuse de se charger hors d'un composant serveur.** Résolu par
  `--conditions=react-server`, qui fait charger à ce paquet son `empty.js`.
  Sémantiquement juste : on éprouve du code serveur, on se déclare en contexte
  serveur.
- **Node ne connaît ni l'alias `@/` ni les imports sans extension.** Résolu par un
  hook de résolution maison, `scripts/resolveur-ts.mjs`.
  ⚠️ **L'alternative — recopier les modules à côté des tests — aurait été pire que
  de ne pas tester** : la copie prend du retard sur l'original au premier
  changement, et les tests continuent de passer sur du code qui n'est plus en
  production. Le contournement devait porter sur la *résolution*, jamais sur le
  contenu. (C'est exactement la copie que j'avais faite dans un dossier temporaire
  pour la vérification initiale — acceptable pour un contrôle jetable, inacceptable
  pour un test versionné.)

⚠️ **Une des assertions a d'abord échoué, et c'était le TEST qui avait tort** : j'y
comparais une collecte du 28 août à un « maintenant » du 30, soit deux jours d'écart
— « avant-hier » était donc la bonne réponse. Le cas symétrique a été ajouté, pour
que le test prouve les deux sens.

---

## 29 août 2026 — Le système de design est remplacé : 1st-Pouf

Branche `refonte-design-pouf`. Maxime avait repéré un registre shadcn tiers,
[1st-Pouf](https://1st-pouf.worksonmy.dev), et voulait sa direction artistique :
pastel, arrondie, colorée. Une contrainte, posée d'emblée : **la donnée ne change
pas**, seule l'apparence.

### Ce qu'on a vérifié avant d'accepter

Un registre tiers est du code téléchargé depuis un domaine qu'on ne contrôle pas.
Avant d'installer quoi que ce soit :

- **71 éléments** (40 composants, 28 blocs), hébergé sur Vercel, licence MIT,
  adapté de `novusgfx/retro-design-system`. Code très commenté, et l'auteur a
  corrigé un défaut d'accessibilité de sa source — du texte blanc sur pastel qui
  échouait à 1,25:1.
- **Son mode sombre s'active par la classe `.dark` sur `<html>`** — exactement ce
  que le projet posait déjà. Zéro adaptation.
- **Contrastes** : les 36 paires calculées avant d'écrire une ligne. Tout le texte
  passe, en clair comme en sombre. **Un seul échec, systématique** : les pastels
  comme objets graphiques en mode clair, de 1,06 à 1,99:1 contre 3:1 requis.
- **Dépendances** : le composant `Icon` tire `@tabler/icons-react`, que le projet
  interdit. L'auteur ayant centralisé la carte rôle → glyphe dans un seul fichier,
  le contourner était trivial. Aucune dépendance npm n'a été ajoutée.

### Deux surprises qu'il fallait mesurer pour trouver

**La vitrine ne livre pas ce qu'elle montre.** Le titrage arrondi de la page
d'accueil du registre est en **Fredoka**, or `pouf.css` ne déclare que **Nunito** :
Fredoka n'habille que le site de documentation. Sans un chargement explicite,
l'interface aurait perdu son trait le plus reconnaissable — sans aucune erreur.

**La densité, elle, ne s'est pas dégradée.** C'était le risque principal : une DA
à cartes coussin sur une liste de 200 lignes. Mesuré au DOM : **235 px par ligne
contre 228, soit +7 %**, là où on redoutait +50 %.

### La décision d'architecture : un dictionnaire, pas une réécriture

`app/globals.css` traduit le vocabulaire shadcn (`bg-card`,
`text-muted-foreground`) vers les couleurs de pouf. L'alternative — réécrire les
3 900 lignes de TSX avec le vocabulaire de pouf — n'a pas été retenue : un
remplacement massif ne se vérifie qu'à la fin, et **un écran oublié ne lève aucune
erreur, il s'affiche en couleurs par défaut**. Avec le dictionnaire, tous les
écrans ont fonctionné dès la première seconde et se sont raffinés un par un.

C'est aussi ce qui rend le prochain changement de système possible : un jeton nomme
un **rôle**, jamais une couleur.

### Trois défauts trouvés en mesurant, dont deux étaient de notre fait

**1. `--muted` veut dire deux choses opposées.** Surface atténuée chez shadcn,
couleur de texte chez pouf. La première version du dictionnaire a écrasé leur gris
de texte par un lavande très clair : **les cartouches se sont affichées vides et
les justifications sont devenues illisibles.** Aucune erreur de compilation, aucun
avertissement. Trouvé en regardant l'écran, pas autrement.

**2. `ring` et `cushion` sont incompatibles — et ça a coûté le focus clavier.**
Les utilitaires `cushion-*` posent un `box-shadow` brut ; les `ring-*` de Tailwind
passent par cette même propriété. Le coussin gagne. Mesuré au DOM : l'anneau de
focus était **présent dans la classe et absent du style calculé**
(`outline-style: none`) — sur les boutons de statut, les onglets de filtre **et les
cartes de la liste**, c'est-à-dire à l'endroit où l'on parcourt deux cents lignes
au clavier. Corrigé en passant tout le focus sur `outline`, qui n'entre pas en
conflit avec `box-shadow`. Vérifié par tabulation réelle : 2 px à 10,32:1.

Ce défaut a aussi tué le premier correctif tenté : cerner d'un anneau le bouton de
statut engagé. Écrit, mesuré, constaté absent, remplacé par une différence de
saturation.

**3. Les pastels sont invisibles comme jauges.** D'où **deux jetons par note** : la
variante nue pour les fonds de pastille, où le texte porte l'information ; la
variante `-barre`, assombrie et mesurée à 3,52:1, pour les jauges. Le problème est
propre au mode clair — en sombre, les mêmes pastels tiennent 9 à 15:1.

### Ce que Maxime a demandé en cours de route

- **Les boutons « Candidaté » et « Écarté » portent leur couleur en permanence**,
  y compris au repos, pour colorer la liste. Conséquence non demandée mais
  nécessaire : la couleur ne distinguant plus l'état engagé, trois autres signaux
  ont dû le porter — saturation (55 % / plein), relief (bombé / enfoncé), icône
  (coche / flèche de retour).
- **Le compte « M notées » retiré du haut de `/offres`** : à terme toute offre
  arrive notée, l'indicateur afficherait deux nombres égaux à longueur d'année. La
  requête de comptage a été supprimée avec l'affichage — laissée branchée, elle
  aurait continué de coûter un aller-retour à Supabase à chaque chargement.
- **Les blocs de la fiche arrondis** comme les cartes de la liste. Ils étaient
  restés à angles droits, y compris dans le squelette de chargement et la page
  « offre introuvable ».

### Vérifications

Relevé des champs affichés figé **avant** la refonte, revérifié après : la donnée
n'a pas bougé. Mesure anti-fuite refaite (douze noms de colonnes cherchés dans le
HTML de la liste et de la fiche, témoin positif) : rien. 375 px sans débordement.
Mode sombre sur les deux écrans. Console vide. `npm run verifie` au vert dans les
deux fuseaux.

**Non redessinée volontairement** : la page de contrôle `/`, que la phase 5
remplace — la repeindre aurait été du travail jeté. Seuls ses libellés de police
ont été corrigés, parce qu'ils annonçaient « Fraunces » et « Geist » en Fredoka et
Nunito.

## 29 août 2026 (suite) — Filtres colorés, classement, thème

Demande de Maxime, en regardant l'écran, juste avant d'ouvrir la phase 5 : donner
aux filtres la forme des pilules de 1st-Pouf, ajouter un filtre « Nouveau », un
menu de classement à droite, et un bouton de thème.

### Ce qui a été construit

| Ajout | Où il vit |
|---|---|
| Cinq pilules colorées, teinte du statut filtré | `_composants/filtres-statut.tsx` |
| Filtre **« Nouveau »** — les offres de la dernière collecte réussie | `?statut=nouvelles`, `lib/offres.ts` |
| Menu **« Trier »** : intérêt · accessibilité · plus récentes | `?tri=`, `_composants/menu-tri.tsx` |
| Bouton de thème à **trois** états : système → clair → sombre | `_coquille/bascule-theme.tsx` |

Deux modules partagés de plus, sur le moule de `statuts.ts` — constantes et
fonctions pures, **sans `server-only`**, parce qu'un composant client en a besoin :
`lib/tri.ts` et `lib/theme.ts`. La chaîne de classement SQL, elle, reste dans
`lib/offres.ts` : le `?tri=` de l'adresse est validé puis sert de **clé** dans une
table de trois chaînes constantes, il n'atteint jamais le `&order=`.

### Le revirement assumé sur la couleur des filtres

`filtres-statut.tsx` portait la règle inverse, écrite le matin même : « l'actif se
marque par le fond violet, **jamais** par une teinte de signal — colorer l'onglet
Candidaté en menthe le ferait ressembler à un bouton de statut alors qu'il n'en
change aucun ». Maxime a tranché pour la couleur ; le risque décrit reste réel, et
ce qui sépare les deux objets est désormais **le chiffre contre l'icône** : la
pilule de filtre porte un compte et pas d'icône, le bouton de statut une icône et
pas de compte. Les retirer « pour gagner de la place » les rendrait indiscernables.

### Trois défauts trouvés en mesurant

**1. Une opacité se remesure sur la surface qui est vraiment derrière.** Les
boutons de statut s'atténuent à 55 % / 70 % — mais ils sont posés sur une carte
blanche. Ces pilules-ci sont sur le fond de page, presque noir en mode sombre : à
70 %, le violet de « À traiter » tombait à **4,11:1**, sous le plancher. Porté à
**80 %** en sombre, les cinq repassent (5,09 à 7,88:1). La leçon avait déjà été
écrite une fois dans `boutons-statut.tsx` ; elle vient de resservir telle quelle.

**2. Une base entièrement morte s'annonçait comme une panne du seul journal des
collectes.** Sur `?statut=nouvelles`, `lireDerniereExecution()` rendait `null`
aussi bien quand la lecture échouait que quand aucune collecte n'avait jamais
abouti. L'écran affichait alors « la liste des offres répond, mais pas le journal
des collectes » — une affirmation **sur la liste, qui n'avait même pas été
interrogée**. Vu en coupant Supabase pour de bon. La lecture rend désormais un
résultat à deux branches : panne → « la base est injoignable », base vide →
« aucune collecte n'a encore abouti ».

**3. Le squelette annonçait des pilules de 29 px, elles en font 30,5.** Écart
préexistant depuis la phase 4, invisible en développement où le squelette ne
s'affiche jamais assez longtemps. Corrigé et vérifié en ralentissant la page
exprès : **écart de 0 px** entre l'en-tête du squelette et celui de la page réelle,
à 1280 px comme à 375 px.

### Deux défauts vus à l'écran, pas dans le code

À 375 px, le bouton « Trier » s'étirait sur toute la largeur (un réglage secondaire
prenait l'allure du bouton principal), et le menu ouvert dépassait de l'écran —
la coche du classement actif devenait invisible. Corrigés par `items-start` et une
largeur bornée. L'arrivée du bouton de thème avait aussi fait casser « Veille IA »
sur deux lignes dans la barre du haut.

### Ce qui a été vérifié

Cinq états de `/offres` traversés pour de vrai, dont deux en cassant l'accès à la
base et un contre un **faux PostgREST** répondant « aucune ligne » à tout.
Contrastes **mesurés au pixel** (composition sur canvas, parce que Tailwind rend
ses couleurs en `oklab` et qu'un parseur naïf les lit de travers) : de 5,00 à
12,17:1 en clair, de 6,03 à 14,83:1 en sombre — tous au-dessus du plancher.
Focus clavier vérifié par tabulation réelle : `outline` 2 px à la couleur d'encre,
là où un `ring` aurait été écrasé par le coussin. Cycle du thème éprouvé par cinq
clics à **coordonnées fixes**. Mesure anti-fuite refaite après deux nouveaux
composants clients : douze noms de colonnes cherchés, zéro trouvé, témoin positif.
Console vide. `npm run verifie` au vert — 39 tests, dans les deux fuseaux.

### Ce que `/code-review` a trouvé — quatre défauts, dont deux mesurés au DOM

**1. Le bouton de thème devenait inerte si le navigateur refusait le stockage.**
`basculer()` avalait l'échec d'écriture puis appelait `__poserTheme()`, **qui
relit `localStorage`** : elle y retrouvait l'ancienne valeur et ne changeait ni la
classe, ni l'attribut, ni l'icône. Rien ne se passait, sans message — exactement
ce que le commentaire du composant disait vouloir éviter. Le clic passe désormais
sa valeur en argument ; le stockage n'est plus qu'une mémoire pour le prochain
chargement. Vérifié en forçant `setItem` à lever : le thème bascule quand même.

**2. La bordure de l'onglet « Toutes » n'existait pas.** `border-transparent` en
classe de base et `border-input` dans l'habit sont **deux utilitaires de même
propriété et même spécificité** — c'est leur ordre dans la feuille compilée qui
tranche, et le transparent gagnait. Mesuré : `border-color: rgba(0, 0, 0, 0)`
dans les deux modes. Or c'est le seul onglet sans teinte : il ne restait que le
creux du coussin, à 1,13:1, pour dire où finit la cible cliquable. La couleur vient
maintenant de l'habit dans les cinq cas. Remesuré : **3,22:1 en clair, 9,39:1 en
sombre**, et les largeurs sont inchangées.

**3. `adresse.ts` se présentait comme pur et importait un module `server-only`.**
Il allait chercher la seule constante `FILTRE_PAR_DEFAUT` dans `lib/offres.ts`,
qui tire `lib/supabase.ts` — donc la clé secrète. Rien ne cassait tant qu'aucun
composant client ne l'importait ; le premier à le faire serait tombé sur une
erreur `server-only` incompréhensible. D'où **`lib/filtres.ts`**, cinquième module
partagé sans `server-only`, qui porte aussi les libellés — lesquels étaient
écrits deux fois, dans `page.tsx` et dans `filtres-statut.tsx`.

**4. `totalBase` acceptait n'importe quel objet.** Typé `Record<string, …>`, il
avalait sans broncher l'objet à cinq clés des onglets et aurait rendu
574 + 7 + 574 = **1 155 offres**. Typé `Record<Statut, …>`, le compilateur dit
maintenant ce que le commentaire exigeait déjà.

⚠️ **Le garde-fou « chaque statut a son onglet » est passé d'un `throw` au rendu à
un contrôle de TYPE**, dans `lib/filtres.ts`. Une vérification qui échoue à la
compilation vaut mieux qu'une qui attend qu'on ouvre la page.

### La fiche desserrée — même jour, sur constat devant l'écran

« La bulle notation et la bulle classement France Travail sont un peu trop
compactées, alors qu'il y a de la place. » Mesuré avant de toucher quoi que ce
soit : les cartes avaient **16 px de marge intérieure pour 32 px de rayon**, et
les trois lignes du classement étaient séparées de **8 px** pour un texte dont
l'interligne en fait 21.

Marge portée à 24 px sur **les six cartes** de la fiche — les deux visées et les
quatre autres, parce que deux respirations différentes sur des cartes empilées se
voient tout de suite. Écarts internes desserrés : 24/48 px entre les deux notes,
10 px sous chaque barre, 14 px entre les lignes du classement.

⚠️ **La liste, elle, n'a pas bougé — c'était la contrainte.** `ContenuNotes` sert
les deux écrans ; il porte désormais une propriété `aere` plutôt qu'une valeur
unique. Vérifié après coup : la liste garde ses 10/32 px et ses 4 px sous la
barre. Aérer 200 lignes qu'on balaye le matin aurait coûté un tiers d'écran par
ligne.

**Le squelette de la fiche a été entièrement remesuré**, et deux de ses hauteurs
étaient fausses avant même ce chantier : le bloc de candidature était dessiné
**26 px trop grand**. La cause est une méthode, pas une étourderie — les valeurs
avaient été calées sur **une** fiche, qui décrit cette fiche et pas la médiane.
Remesuré sur **14 offres réelles**, puis vérifié en ralentissant la page exprès :
écart **médian de −3,3 px** entre squelette et contenu, étendue −54 à +20, dix
fiches en dessous et quatre au-dessus. Un écart centré, ce qui est le mieux
atteignable tant que la hauteur dépend de la longueur d'un texte.

### « Le texte du résumé n'est pas le même que celui des justifications »

Constat de Maxime, le même jour. Vérifié au DOM avant de toucher quoi que ce
soit, et le défaut était plus large que le cas qu'il pointait : la fiche portait
**quatre tailles de texte suivi** — 16 px (résumé), 15 (annonce intégrale), 14
(classement), 13 (justifications) — plus deux couleurs. Chaque bloc était arrivé
avec la taille qui semblait juste au moment où on l'écrivait.

Ramené à **quatre rôles** : 16 px encre pour ce qui se lit, 14 px pour les
valeurs courtes du classement, 12 px atténué pour l'avertissement, 11 px mono
pour les étiquettes. Détail dans `docs/DESIGN.md`.

⚠️ **Ce qui décide, c'est que le résumé et les justifications ont le même
auteur et le même statut** — ce que le modèle a compris de l'offre, une fois en
synthèse et une fois par note. Deux niveaux typographiques annonçaient une
hiérarchie que le produit ne défend pas : les justifications *sont* l'argument
du projet. En liste, elles restent à 13 px atténuées, parce qu'on y survole au
lieu de lire.

### La médiane ne s'additionne pas — correction de méthode sur le squelette

En recalant le squelette de la fiche après ces deux chantiers, une erreur de
raisonnement est apparue, et elle valait plus que sa correction. Chaque section
était calée sur **sa médiane**, ce qui est juste prise isolément. Mais la somme
des six médianes donnait **1 325 px** là où la médiane du total mesuré est
**1 381** : 55 px d'erreur venue de nulle part.

La cause : les distributions sont asymétriques — trois sections ont une médiane
**égale à leur minimum**, parce qu'une minorité de fiches longues tire la queue.
Une médiane ne s'additionne pas ; une moyenne, si : `E[total] = Σ E[section]`. Et
c'est bien le **total** qui décide du saut de page.

Recalé sur les moyennes de **20 offres**, puis vérifié en ralentissant la page :
squelette **1 363 px** contre des fiches de 1 303 à 1 400, écart moyen **+2,4 px**,
médian −0,6. ⚠️ Deux valeurs du squelette étaient d'ailleurs fausses depuis le
départ — le bloc de candidature était dessiné **26 px trop grand** — parce
qu'elles avaient été calées sur **une** fiche, qui décrit cette fiche et pas la
population.

### Les jauges élargies — un défaut laissé le matin, rouvert le soir

« La jauge fait un peu petit par rapport au texte. » C'est exactement le premier
des trois défauts de la fiche **mesurés et volontairement laissés** plus tôt dans
la journée : « barres de notes restées à la largeur de la liste ». Maxime le
rouvre, et la mesure lui donne raison — 88 px de jauge sous une justification de
428 px, soit la moitié de la colonne vide à droite du chiffre.

⚠️ **Ce qui justifiait la largeur fixe ne vaut que pour la liste** : c'est elle
qui aligne les barres d'une offre à l'autre, et cet alignement permet de comparer
deux cents offres sans lire les chiffres. Sur une fiche, il n'y a qu'une offre.
La barre y devient donc flexible (290 px à 1440, 154 à 375) et son chiffre passe
de 12 à 14 px — sinon il devenait le plus petit élément d'une rangée dont il est
l'information principale.

✅ **Contrôle utile** : la piste faiblement contrastée se lit **mieux** en grand.
Sur une note à 5/100, 15 px de bleu franc sur 297 px de pastel — on voit
immédiatement que la jauge est presque vide. L'agrandissement rend l'arbitrage du
matin plus supportable, pas moins.

### Deuxième passe sur les jauges, et « Bonjour Maxime »

« Elles sont trop larges là… et entre la jauge bleue et "Intérêt", il y a quand
même un gros espace blanc. » Deux constats, deux causes distinctes :

1. **290 px, c'était trop.** Plafonnée à **208 px** au-delà de 640 px de large.
2. **Le blanc venait de la largeur fixe du libellé** — « INTÉRÊT » mesure 54 px
   dans une case de 108, d'où 48 px de vide avant la jauge. Sur la fiche, le
   libellé prend désormais sa largeur naturelle. **Conséquence assumée** : les
   deux jauges ne démarrent plus au même `x`, ce qui ne gêne pas puisqu'elles
   vivent dans deux colonnes distinctes.

✅ **Vérifié plutôt que supposé** : ces deux réglages n'ont **pas** bougé la
hauteur de la section — remesurée sur les mêmes 20 offres, 192,4 px avant comme
après. Une rangée est haute comme son chiffre, pas comme sa barre (10 px dans
22). Le squelette n'avait donc rien à reprendre.

**Le `h1` de `/offres` devient « Bonjour Maxime »**, et le titre d'onglet reste
« Plan de travail ». ⚠️ **Cette divergence casse une règle du projet, et c'est
voulu** : elle exigeait que les deux coïncident *parce que tous deux nommaient
l'écran*. Un salut ne nomme rien — un onglet « Bonjour Maxime » ne dirait plus de
quelle page il s'agit dans l'historique ou dans un favori. Le salut ne varie pas
avec l'heure : le rendu est serveur, et deviner le fuseau du visiteur est la
classe de bug que `verifie` traque en rejouant les tests en UTC.

### L'échelle de la fiche remontée — la seconde moitié du travail

« Les bulles candidater et écarter font un peu petites vu qu'on a augmenté la
police… on peut aussi augmenter l'intitulé et le nom de l'entreprise, pour que ce
soit harmonieux et que ça respecte la hiérarchie. »

Constat juste, et c'était la **conséquence non traitée** du passage du texte à
16 px : l'intitulé n'avait plus qu'un rapport de 1,5 avec le corps de texte, le
nom de l'entreprise était **plus petit** que lui (15 contre 16), et les pilules à
11 px étaient devenues les plus petits éléments d'une page qu'elles commandent.

| Élément | Avant | Après |
|---|---|---|
| Intitulé | 20 / 24 px | **24 / 30 px** |
| Nom de l'entreprise | 15 px | **18 px** |
| Valeurs du classement | 14 px | **16 px** |
| Cartouches et boutons de statut | 11 px | **13 px** |

⚠️ **L'intitulé revient exactement à la valeur abandonnée la veille** — « à 30 px,
l'intitulé écrasait tout le reste de la page ». Ce qui a changé n'est pas le
titre, c'est ce qu'il y a autour. **Une taille ne se juge jamais seule.**

⚠️ **Tout passe par des propriétés `aere`**, comme les notes : `Cartouche`,
`CartoucheAbsent` et `BoutonsStatut` servent les deux écrans. Vérifié après coup :
la liste garde ses cartouches à 11 px, ses boutons à 11 px et son nom d'entreprise
à 15 px.

⚠️ **Un piège de cascade rencontré au passage** : `text-lg` posé par-dessus
l'utilitaire `nom-entreprise`, qui fixe déjà `font-size`. Deux règles de même
spécificité, départagées par l'ordre dans la feuille compilée — le même piège que
`accentue` dans `cartouche.tsx`. Mesuré au DOM pour s'en assurer : 18 px.

Squelette de la fiche remesuré une troisième fois, entête comprise : **1 400,7 px**
pour une moyenne réelle de 1 402,2.

### Le décalage du classement — un écart de lignes de base, pas de boîtes

Dernier constat de Maxime sur la fiche : « un léger décalage entre les libellés
et la description que tu viens d'agrandir ». Mesuré avant de corriger, et le
diagnostic n'était pas celui qu'on croit : **les deux cellules commençaient
exactement au même pixel** — l'écart entre leurs boîtes était nul. Ce qui était
décalé, ce sont les **lignes de base** : 15,4 px de hauteur de ligne pour
l'étiquette contre 26 pour la valeur, soit **6,8 px** de décrochage. Le défaut
existait avant, il s'est creusé quand la valeur est passée de 14 à 16 px.

`items-baseline` sur la grille ramène l'écart à **0,3 px** (résidu de calcul).
⚠️ **`items-start` n'aurait rien changé** — c'est le comportement par défaut,
donc la cause. **`items-center` aurait cassé le cas à deux lignes** : l'étiquette
se serait centrée entre elles au lieu de désigner la première.

**Ce que ça généralise** : dès que deux tailles de texte se côtoient sur une même
ligne, ce que l'œil apparie est la ligne de base, jamais le bord des boîtes.

✅ La moyenne du bloc reste à **130 px** — l'alignement redistribue l'espace dans
la rangée sans changer sa hauteur. Le squelette n'avait rien à reprendre, et
c'est vérifié plutôt que supposé.

---

## 30 août 2026 — Phase 5 : l'écran du matin

`/` n'est plus la page de contrôle posée par `/installe`. C'est le compte rendu de
la nuit : les offres de la dernière collecte réussie qui restent à traiter et qui
dépassent 50 sur 100 en intérêt, classées par intérêt décroissant, sous la même
manchette d'état que le plan de travail.

### Ce qui a été construit

- **`lib/matin.ts`** — la lecture, séparée de `lib/offres.ts` parce qu'elle pose
  une autre question : « qu'est-ce que la nuit a apporté qui vaut d'être lu », et
  non « que contient la base ». Deux profondeurs de requête, pas quatre : la
  collecte se lit d'abord, les trois autres partent ensemble.
- **`choisirAffichage()`** — une fonction pure qui décide **lequel** des six écrans
  montrer, et onze tests qui l'éprouvent dans les deux fuseaux.
- **Six panneaux** dans `_composants/etats-matin.tsx`, chacun daté.
- **Une carte de passage** chiffrée vers le plan de travail.
- **`(site)/loading.tsx`** — le squelette, calé par la mesure (voir plus bas).

### La décision d'architecture : remonter d'un cran ce que deux écrans partagent

`ligne-offre.tsx`, `boutons-statut.tsx`, `cartouche.tsx`, `notes.tsx`, `etats.tsx`,
`verrou-tri.tsx`, `formats.ts`, `rythme.ts`, `adresse.ts` et `actions.ts` vivaient
dans `offres/_composants/`, c'est-à-dire dans le dossier privé d'une route qui
n'est plus la seule à les rendre. Ils sont remontés dans `(site)/_composants/`, à
côté de `etat-veille.tsx` qui y avait été posé la veille pour cette raison exacte.

**L'alternative écartée** : laisser `/` importer depuis `offres/_composants/`. Ça
compile, et ça installe un couplage qu'aucun lecteur ne comprendrait — le compte
rendu du matin allant chercher ses briques dans les affaires du plan de travail.

Le déplacement a été commité **seul**, sans une ligne de comportement, pour que le
diff de la phase se lise.

### Le trou dans les critères d'acceptation : la notation qui tombe

Le plan prévoyait trois écrans vides. Il en manquait un, et c'était le dangereux :
**la collecte réussit, la notation échoue**. Les offres sont alors en base avec
`note_interet` à `NULL`, donc aucune n'atteint le seuil, donc l'écran aurait
annoncé « aucune offre n'atteint le seuil » — c'est-à-dire *journée calme* — un
matin où rien n'a été jugé. Et la manchette ne rattrape pas : elle ne regarde que
l'étape `collecte`.

⚠️ **C'est la classe de défaut qui ne se voit jamais.** Une fausse alerte se
remarque tout de suite ; un « tout va bien » qui ment se croit, on ferme l'onglet,
et on découvre trois jours plus tard que la moitié de la semaine n'a pas été notée.
D'où l'ordre des tests dans `choisirAffichage()`, qui **est** la logique : « aucune
n'atteint le seuil » n'est vrai que si la collecte a ramené quelque chose *et* que
ce quelque chose a été noté.

### Ce que le seuil de 50 coûte vraiment — mesuré, et à arbitrer

Les six dernières collectes réelles, au moment de construire :

| Collecte | Offres | Notées | ≥ 50 | À lire sur `/` |
|---|---|---|---|---|
| 29 août 09:11 | 7 | 7 | 1 | **1** |
| 28 août 14:25 | 7 | 7 | 0 | **0** |
| 27 août 12:55 | 25 | 25 | 6 | **5** |
| 26 août 20:42 | 0 | 0 | 0 | **0** |
| 26 août 18:32 | 162 | 19 | 2 | **0** |
| 26 août 12:14 | 2 | 2 | 0 | **0** |

**Quatre matins sur six, l'écran du matin est vide.** Sur toute la base, 10 offres
sur 574 dépassent 50. Ce n'est pas un défaut du code — le seuil de 50 est un
critère d'acceptation du plan — mais c'est une donnée produit qui n'existait pas
quand il a été écrit, et qui appartient à Maxime.

### Le squelette : la mesure contredit l'analogie

Première version : trois barres, par ressemblance avec `/offres` qui en pose
quatre. Les hauteurs relevées au DOM disent l'inverse :

| | Bureau | 375 px |
|---|---|---|
| Une ligne d'offre | 222 px | 358 px |
| Un panneau vide | 230 px | 259 px |
| Trois lignes de squelette | 682 px | 1 090 px |

⚠️ **Un panneau vide fait presque exactement la hauteur d'une ligne** — 8 px
d'écart en bureau. Une barre unique cale donc à la fois le matin où il y a une
offre et le matin où il n'y en a aucune, soit cinq matins sur six. Trois barres se
seraient trompées de 450 px **dans les deux cas à la fois**.

⚠️ **La vérification de bout en bout a d'abord été FAUSSE, et c'est la meilleure
leçon de la journée.** Elle mesurait la hauteur du `<main>`, qui porte `flex-1` :
le conteneur est étiré à la hauteur de la fenêtre et rend **841 px des deux côtés
quel que soit son contenu**. J'en avais conclu « écart nul » avec assurance. Il
faut mesurer le **bas du dernier élément**. Refait correctement :

| | Bureau | 375 px |
|---|---|---|
| Le squelette | 496 px | 655 px |
| Écran vide (« Journée calme ») | 476 px | 528 px |
| Écran à une offre | 524 px | 778 px |

Le squelette tombe **entre les deux** — 20 px du vide, 28 px de la liste en
bureau. ⚠️ **Un chiffre identique des deux côtés doit éveiller le soupçon avant
de rassurer** : une mesure qui tombe pile est plus souvent un artefact qu'une
réussite.

**Ce que ça généralise** : un squelette ne s'aligne pas sur celui d'à côté, il
s'aligne sur ce que **sa** page affiche le plus souvent. Et ça se compte sur les
données réelles.

### Deux défauts vus à l'écran, pas dans le code

1. **La date était écrite deux fois à 90 px d'écart.** Le sous-titre la portait —
   avec un bon argument : elle sortait de la même lecture que les offres, donc elle
   ne pouvait pas désigner une autre exécution. Sauf que la manchette l'affiche
   déjà. Retirée du sous-titre, qui ne dit plus que ce que la manchette ne dit
   pas : « 1 offre retenue sur 7 collectées ». ⚠️ **Ce qu'on accepte en échange**,
   écrit dans le code : les deux lectures sont distinctes, donc une collecte qui se
   termine entre les deux ferait dater la liste avec l'heure d'une autre exécution.
   Quelques millisecondes par jour, contre une redondance tous les matins.
2. **« Les 1 offre retenue a été classée ».** L'accord mot par mot autour d'un
   « Les {n} » figé. ⚠️ **Au singulier, ce n'est pas l'article qui change, c'est la
   tournure** : on ne dit pas « la 1 offre », on dit « la seule ». Une phrase à
   trous ne sait pas faire ça — il faut deux phrases entières. Corrigé sur les
   quatre panneaux qui portent un nombre.

### Ce qui a été vérifié

- **`npm run verifie`** : lint, types, **52 tests** (11 nouveaux), dans les deux
  fuseaux.
- **L'écran, regardé** en 1280 px et 375 px, en clair et en sombre.
- **Les six écrans vides**, rendus et lus un par un sur une page d'aperçu
  temporaire, supprimée depuis.
- **Base injoignable** : serveur relancé vers une URL morte — « État de la veille
  indisponible » en manchette (et non « aucune veille »), panneau d'erreur, et
  **aucune trace technique dans le document** : ni l'URL, ni « supabase », ni la
  clé.
- **Action en cours** : les deux boutons passent à `disabled` pendant la
  transition, mesuré 40 ms après le clic.
- **Focus clavier** : `outline` de 2 px présent **malgré le coussin** — le piège du
  `ring` écrasé par `box-shadow` a été évité —, contraste **10,32:1**.
- **Contrastes des nouveaux éléments** : 12,17:1 et 5,90:1 en clair, 14,83:1 et
  7,74:1 en sombre. Mesurés en peignant chaque couleur sur un canvas, parce que
  `getComputedStyle` rend de l'`oklab()` qu'un parseur `rgb()` lit faux.
- **Non-fuite des colonnes** : douze noms cherchés dans le document de `/`, payload
  RSC compris. Zéro, avec trois témoins positifs.
- **Console** : 0 erreur sur les trois écrans, après cache Turbopack neuf.
  ⚠️ Une erreur `fraunces is not defined` apparaissait avant : un chunk périmé de
  la refonte de la veille, pas le code actuel. Vérifié en supprimant `.next`.
- **La base a été rendue à l'identique** après les tests d'écriture : 570 à traiter
  / 0 candidaté / 4 écarté, note `NULL` sur les deux colonnes.

### Ce que `/code-review` a trouvé — cinq constats, dont trois vrais défauts

La revue a tourné sur le diff complet, tests et compilation compris. Aucun défaut
de sécurité, et elle a re-vérifié sans rien trouver les points qui comptent : la
règle « jamais l'objet `offre` entier à un composant client », l'usage
d'`options.egal`, `exigerSession()` en première ligne, la portée du
`revalidatePath`, l'exhaustivité du `switch`.

**1. La promesse de reprise que le code ne pouvait pas tenir.** Le panneau de
notation tombée disait « les offres seront reprises à la prochaine notation ».
Or `lireResume()` ne lisait que la note et le statut : impossible de distinguer
« jamais tentée » de « abandonnée après trois échecs ». Une nuit où la notation
échoue définitivement aurait affiché cette phrase **tous les matins suivants**.
⚠️ C'est exactement le mensonge que `notation_tentatives` empêche déjà sur
`/offres`, et il revenait par une autre porte. **Corrigé** : le résumé lit
`notation_tentatives`, et le panneau ne promet la reprise que sur des offres
jamais tentées. ⚠️ **Le seuil du pipeline n'est pas recopié** — on distingue
seulement zéro tentative du reste, ce qui suffit à ne rien affirmer de faux.

**2. Le compteur qui perdait les offres de la nuit sous le seuil.** La carte de
passage retranchait *toutes* les offres à traiter de la collecte, seuil compris ou
non. Les offres de la nuit restées sous 50 étaient donc **à la fois cachées par
l'écran et absentes du compteur censé garantir que rien ne se perd**. Scénario :
une nuit ramène trente offres toutes sous le seuil, l'arriéré est vide — le
compteur tombe à zéro, la carte disparaît, et « Journée calme » ne laisse aucun
chemin vers trente offres jamais lues. **Corrigé** : on retranche ce qui est
**affiché**, pas ce qui vient de la collecte. Le libellé suit — « 569 autres
offres », et non plus « plus anciennes », qui serait devenu faux.

**3. ⚠️ La rustine du matin efface le compte rendu de la nuit.** Le meilleur
constat de la revue, parce qu'il porte sur le mode opératoire réel. La collecte
écrit en `ignore-duplicates` : une offre déjà connue **reste rattachée à
l'exécution qui l'a vue en premier**. Donc quand le cron part en retard et que la
rustine `gh workflow run` est lancée le matin, cette seconde collecte réussit avec
zéro offre nouvelle, **devient « la dernière collecte réussie »**, et remplace le
compte rendu des offres de la nuit par « la collecte n'a rien rapporté ».

**Non corrigé, délibérément** : le plan dit « c'est la dernière réussie qui fait
foi », et lui préférer « la dernière non vide » empêcherait d'afficher une vraie
nuit blanche. Ce qui est corrigé, c'est **le texte, qui mentait** : il affirmait
qu'aucune annonce ne correspondait aux critères, alors que le code ne sait rien de
tel. Il dit maintenant « aucune annonce **nouvelle** » et nomme les deux
explications possibles. Les offres, elles, restent accessibles par la carte de
passage. **La question de fond appartient à Maxime.**

**4. Le squelette portait un sous-titre que l'écran vide n'a pas.** Vrai, et
mesuré : 24 px. Mais le retirer rapprocherait le squelette du cas vide d'autant
qu'il l'éloignerait du cas liste. **Gardé, et écrit** — c'est ce qui l'équilibre
entre les deux.

**5. Une capture d'écran laissée à la racine du dépôt public.** Supprimée.

**Un défaut trouvé en relisant, hors revue** : sans aucune collecte réussie, la
carte de passage ne s'affichait pas — donc aucune sortie vers les offres qui
peuvent pourtant exister, l'écriture par lots n'étant pas atomique. Corrigé.

### Ce qui n'a pas été vérifié

⚠️ **Le volume « 40 offres d'un coup » du plan.** Éprouvé à **7** en abaissant le
seuil à 0, pas à 40 : aucune collecte réelle ne produit ce volume au-dessus du
seuil. Le rendu est la même pile de cartes que `/offres`, qui en affiche 200 — le
risque est faible, mais il n'est pas mesuré, et l'écrire vaut mieux que de cocher.

---

## 30 août 2026 (suite) — Le seuil abaissé, et les doublons de France Travail

### Le seuil d'intérêt passe de 50 à 35

Décision de Maxime devant l'écran : « sinon je ne verrai pas beaucoup d'offres ».
Le constat était juste. Mesuré avant d'appliquer, sur les six dernières
collectes, offres « à traiter » uniquement :

| Collecte | Offres | à 50 | **à 35** | à 25 |
|---|---|---|---|---|
| 29 août | 7 | 1 | **4** | 4 |
| 28 août | 7 | 0 | **2** | 2 |
| 27 août | 25 | 5 | **6** | 9 |
| 26 août 20:42 | 0 | 0 | **0** | 0 |
| 26 août 18:32 | 162 | 0 | **1** | 2 |
| 26 août 12:14 | 2 | 0 | **0** | 0 |

À 50, l'écran était vide quatre matins sur six ; à 35, deux fois — et les deux
sont des collectes réellement sans rien. ⚠️ **Descendre à 25 n'ajouterait que
7 offres sur toute la base** (20 → 27) : le gain s'aplatit, et chaque cran
rapproche `/` d'un second plan de travail. Un test fige la valeur.

⚠️ **Maxime a dit « seuil d'accessibilité ».** Le seuil porte sur l'intérêt, et
l'accessibilité ne filtre rien nulle part. Corrigé dans la réponse plutôt
qu'appliqué au mot : le sens était sans ambiguïté, le nom non.

### « C'est normal que j'aie quatre fois la même offre ? »

Non, et l'écran n'y était pour rien : **France Travail publie le même poste
plusieurs fois**, une version « f/h » et une version « (H/F) », avec deux
identifiants différents. La déduplication du pipeline porte sur l'identifiant :
elle ne peut pas les voir.

Mesuré sur les 574 offres : **29 annonces en trop, soit 5,1 %** — 24 postes
publiés deux fois, un trois fois, un quatre fois. Le 29 août, quatre des sept
offres collectées étaient deux postes en double, d'où l'effet à l'écran.

⚠️ **Ma première mesure annonçait 25,8 % et un écart de note de 63 points. Elle
était fausse.** Elle groupait sur les 200 premiers caractères de description — or
ces caractères sont le **préambule de présentation de l'entreprise**, identique
sur toutes les annonces d'un même employeur. Elle fusionnait donc des postes MBDA
sans rapport. Sur l'intitulé normalisé : 5,1 % et 23 points. **Un critère de
regroupement se vérifie sur ce qu'il regroupe, pas sur sa vraisemblance.**

### Ce que les doublons révèlent, et qui est plus gênant qu'eux

Deux annonces du même poste, notées **68 et 45**. Les deux justifications disent
la même chose — « rôle de coordination plutôt que développement technique ». Sur
les 7 paires comparables de la base : 4 ont exactement la même note, 2 diffèrent
de 2 points, une de 23. **Les doublons sont un banc d'essai gratuit de la
notation**, et ils disent qu'elle décroche parfois. Noté, non traité.

### Le regroupement — option retenue par Maxime, et ses deux choix

Trois options lui ont été posées : regrouper à l'affichage, dédupliquer à la
collecte, ne rien faire. Il a choisi **l'affichage**, qui n'efface rien (US-23) et
reste réversible. Puis deux questions de conception :

1. **Le clic traite le poste entier.** Sans ça, écarter l'annonce affichée
   laisserait sa jumelle « à traiter », qui reprendrait la place au chargement
   suivant : on trierait deux fois le même poste. L'action serveur accepte donc
   une **liste** d'identifiants — bornée à 8, revérifiée à l'exécution, doublons
   écartés, écritures en parallèle, et **l'échec partiel se dit** au lieu de se
   taire.
2. **`/offres` reste exhaustif.** C'est l'archive de travail (US-22), et sa liste
   est plafonnée à 200 sur 570 : deux jumelles peuvent être l'une dedans, l'autre
   dehors, et le compteur deviendrait trompeur.

### ⚠️ La règle du regroupement a été RETOURNÉE, après l'avoir vue échouer

Première version : l'entreprise entrait dans la clé, et les offres sans employeur
nommé ne se regroupaient qu'avec elles-mêmes — par prudence, 36 % des offres
n'en nomment aucun.

**Vu à l'écran : rien ne se regroupait.** Les quatre annonces MBDA affichent
toutes « Entreprise non communiquée ». La prudence protégeait parfaitement d'un
risque théorique, en ne servant jamais dans le cas réel qui avait motivé le
module.

Ce qui la remplace : **l'employeur SÉPARE, il ne rapproche pas.** La clé est
l'intitulé normalisé plus le lieu ; un groupe n'est éclaté que s'il réunit deux
employeurs **nommés** différents, et les anonymes forment alors leur propre
sous-groupe plutôt que d'être rattachés au hasard.

⚠️ **Ce que ça généralise** : une garde écrite pour un risque qu'on n'a pas
mesuré peut coûter la fonction entière. Ici elle ne se voyait ni à la
compilation, ni dans les tests — qui la vérifiaient consciencieusement — mais
seulement à l'écran, sur les données réelles.

### Vérifications

- **69 tests** (16 nouveaux sur le regroupement), dans les deux fuseaux.
- **Le clic groupé, prouvé en base** : un clic sur « Écarté » a fait passer
  `6414980` **et** `6414967` à `ecarte`, sans toucher au second poste. Les deux
  remises à `a_traiter` ensuite.
- **`/offres` non contaminé** : 200 lignes, « 570 offres · 200 affichées »,
  **zéro cartouche « annonces »**.
- **La fiche** : bascule candidaté puis annulation, l'action à un seul
  identifiant fonctionne toujours.
- **375 px et bureau**, mode sombre, **console propre**.
- **Base rendue à l'identique** : 570 à traiter / 0 candidaté / 4 écarté.
