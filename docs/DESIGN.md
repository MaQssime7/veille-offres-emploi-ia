# Système de design — Veille offres emploi IA

> **Refondu le 29 août 2026.** Le système « éditorial technique » (beige papier,
> Fraunces, Geist, aucune ombre) a été **remplacé** par le système
> [1st-Pouf](https://1st-pouf.worksonmy.dev), adapté. Décision de Maxime, prise
> devant l'écran après construction de `/offres` dans les deux systèmes.
>
> ⚠️ **Ce document décrit le système EN VIGUEUR.** Les traces de l'ancien ne sont
> conservées que là où elles expliquent une décision qui tient encore — le reste
> a été élagué, parce qu'un document qui empile ses strates cesse d'être lu.

---

## Contexte produit

- **Quoi** : un instrument de veille personnel — liste d'offres France Travail
  classées par intérêt, deux notes séparées par offre, fiche d'enrichissement
  produite par un agent en phase 6.
- **Pour qui** : un utilisateur unique. Dix minutes le matin, sur ordinateur ou
  téléphone. Second contexte, plus rare et déterminant : l'écran est montré en
  partage d'écran pendant un entretien d'embauche, Maxime aux commandes.
- **Type** : application web. **Une seule surface** — pas de site vitrine, donc
  pas de second registre.
- **Ce qu'on retient** : *un instrument de décision, pas un tableau de bord. On
  voit tout de suite quoi lire en premier, et pourquoi.*

### Où la convention de la catégorie est fausse pour ce produit

Trois réflexes du secteur, écartés délibérément. Notés ici pour qu'ils ne
reviennent pas par la fenêtre.

| Réflexe du secteur | Pourquoi il est faux ici |
|---|---|
| **Kanban de statuts** | Suppose qu'on pilote des dizaines de candidatures en parallèle. L'usage réel est une décision de *lecture*, pas de gestion |
| **Un score unique de correspondance** | Le produit repose sur le refus explicite de fusionner intérêt et accessibilité. Un « 87 % de match » détruirait sa raison d'être |
| **Un bandeau de quatre chiffres clés** | C'est de l'analyse de marché déguisée, hors périmètre au PRD. Le seul indicateur global légitime est **la dernière veille réussie** |

Et une règle positive qui en découle : **la phrase de justification sous chaque
note se lit à plat dans la liste**, jamais derrière une infobulle ni un dépliage.
C'est le seul mécanisme qui révèle une notation mal étalonnée.

---

## Direction esthétique

**Pastel volumétrique.** Des surfaces blanches arrondies posées sur un fond
lavande, chacune portant un relief « coussin » — une ombre interne en haut, un
rebord interne en bas, une ombre portée douce. Les accents sont six pastels
saturés qui ne portent jamais de texte clair : **toujours de l'encre foncée sur
le pastel, jamais du blanc.**

**Ce que la refonte a conservé de l'ancien système, et pourquoi :**

- **La densité.** La liste reste compacte : 235 px par ligne contre 228 avant,
  soit +7 %. Un système aussi généreux se paie en défilement sur deux cents
  lignes ; l'écart a été mesuré, pas supposé.
- **Une seule teinte neutre pour les cartouches.** Six pastels également
  disponibles, c'est six fois plus d'occasions de colorier une donnée pour rien.
- **Un rôle unique par teinte de signal.** Voir le tableau plus bas.

---

## Typographie

| Rôle | Police | Où |
|---|---|---|
| **Titrage** | **Fredoka** 700 | Les `h1` seulement — le titre de page, l'intitulé sur sa fiche |
| **Texte et interface** | **Nunito** 500–700 | Tout le reste du texte |
| **Données et étiquettes** | **Geist Mono** 500–700 | Cartouches, libellés de notes, chiffres, dates, titres de section |

⚠️ **Fredoka n'est PAS livrée par le registre 1st-Pouf**, contrairement à ce que
sa vitrine laisse croire : `pouf.css` ne déclare que Nunito, et Fredoka n'habille
que le site de documentation. Sans un chargement explicite, les titres retombent
sur Nunito et l'interface perd son trait distinctif — **sans le moindre message
d'erreur**.

⚠️ **Geist Mono a survécu à la refonte, et c'est une décision.** 1st-Pouf n'a
aucune police à chasse fixe. Or les salaires, dates et notes s'alignent en
colonne d'une ligne à l'autre : sans chasse fixe, « 34-36 k€ » et « 45-55 k€ »
n'ont plus la même largeur et la colonne ondule sur deux cents lignes.

**Chargement** : les trois par `next/font/google`, jamais par
`@fontsource-variable/*` que la documentation du registre recommande —
`next/font` héberge la police avec l'application, la précharge, supprime le
décalage à l'arrivée, et évite une dépendance npm.

⚠️ **Le corps de texte est à 500, pas à 700.** 1st-Pouf met tout le texte en gras
par défaut ; ça tient sur une page vitrine, pas sur un écran dont le contenu
principal est fait de justifications de trois lignes répétées deux cents fois.
L'adaptation est signalée dans `components/pouf/pouf.css`.

---

## Couleur

### La palette source, telle que le registre la livre

| Jeton pouf | Clair | Sombre | Rôle |
|---|---|---|---|
| `--color-bg` | `#f0e9ff` | `#12111a` | Fond de page |
| `--color-surface` | `#ffffff` | `#211f2b` | Cartes |
| `--color-ink` | `#3a2e5c` | `#f7f3ff` | Texte |
| `--color-muted` | `#71609b` | `#b8afcb` | Texte atténué |
| `--color-purple` | `#c9a8ff` | *inchangé* | Action principale |
| `--color-pink` | `#ffb3d1` | *inchangé* | — |
| `--color-blue` | `#9ec8ff` | *inchangé* | — |
| `--color-mint` | `#a8f0d0` | *inchangé* | — |
| `--color-yellow` | `#ffe58a` | *inchangé* | — |
| `--color-orange` | `#ffb38a` | *inchangé* | — |

⚠️ **Les pastels ne changent pas en mode sombre**, par conception du registre :
ce sont eux la marque, et ils portent toujours de l'encre foncée.

### Les cinq rôles de signal du produit

**Une teinte qui sert à deux choses ne sert plus à rien.** C'est la règle qui a
survécu intacte à la refonte.

| Rôle | Teinte | Jetons |
|---|---|---|
| **Intérêt** (note) | bleu | `--interet` · `--interet-barre` · `--interet-texte` |
| **Accessibilité** (note) et **candidaté** | menthe | `--success` · `--success-barre` · `--success-texte` |
| **Écarté** | rose pastel | `--ecarte` · `--ecarte-foreground` |
| **Temporel** (« Nouveau », état de la veille) | jaune / ocre | `--signal` · `--signal-fort` |
| **Erreur** | rose foncé | `--destructive` |

⚠️ **`--ecarte` et `--destructive` sont tous deux roses et ne sont PAS un
doublon.** `--destructive` est une **erreur**, donc du texte, donc 4,5:1 — d'où
sa valeur très foncée. `--ecarte` est une **décision de Maxime**, portée par un
bouton plein sur lequel se pose de l'encre foncée : le pastel convient. Les
fusionner donnerait soit un bouton criard, soit un message d'erreur illisible.

### ⚠️ Le défaut central que la refonte a dû corriger

**Les pastels de 1st-Pouf sont faits pour porter du texte, pas pour être vus
seuls.** Mesurés sur le fond de page en mode clair, comme objets graphiques :

| Accent | sur le fond de page | requis (WCAG 1.4.11) |
|---|---|---|
| jaune | **1,06:1** | 3:1 |
| menthe | **1,11:1** | 3:1 |
| rose | **1,41:1** | 3:1 |
| bleu | **1,46:1** | 3:1 |
| orange | **1,48:1** | 3:1 |
| violet | **1,99:1** | 3:1 |

Une barre de note en menthe pastel est **invisible** : on ne voit plus où elle
s'arrête, c'est-à-dire qu'on ne lit plus la note. D'où la règle :

> **Chaque note a deux jetons.** La variante nue sert de fond de pastille, où le
> texte posé dessus porte l'information. La variante `-barre` est la même teinte
> assombrie juste ce qu'il faut, et c'est la seule qui a le droit de dessiner une
> jauge.

⚠️ **Ce problème est spécifique au mode CLAIR.** Sur le fond sombre, les mêmes
pastels tiennent de 9,39:1 à 15,01:1 — ils y sont donc utilisés nus.

### Contrastes vérifiés — 29 août 2026

Calculés, pas estimés. Référence : le fond de page, qui est le cas le plus
exigeant.

**Texte, seuil 4,5:1**

| Paire | Clair | Sombre |
|---|---|---|
| encre sur fond de page | 10,32:1 | 17,15:1 |
| encre sur carte | 12,17:1 | 14,83:1 |
| texte atténué **sur une pilule** | 4,51:1 | 7,74:1 |
| texte atténué sur fond de page | 5,00:1 | 8,95:1 |
| encre sur violet (bouton principal) | 6,10:1 | 7,51:1 |
| encre sur menthe | 9,30:1 | 11,44:1 |
| encre sur rose | 7,32:1 | 9,00:1 |
| encre sur bleu | 7,05:1 | 8,67:1 |
| encre sur jaune | 9,75:1 | 12,00:1 |
| encre sur orange | 6,99:1 | 8,61:1 |
| libellé « Intérêt » `#0063e6` | 4,53:1 | pastel, 10,85:1 |
| libellé « Accessibilité » `#157a4d` | 4,54:1 | pastel, 14,31:1 |
| nom d'entreprise `#8337ff` | 4,53:1 | pastel, 9,39:1 |
| erreur `#ca0050` **sur son panneau** | 4,51:1 | pastel, 11,26:1 |
| ocre en texte `#856700` | 4,53:1 | pastel, 15,01:1 |

**Objets graphiques et interface, seuil 3:1**

| Élément | Clair | Sombre |
|---|---|---|
| jauge d'intérêt `#0e76ff` | 3,52:1 | 10,85:1 |
| jauge d'accessibilité `#198e5a` | 3,52:1 | 14,31:1 |
| bordure de champ `--input` | 3,80:1 | 8,13:1 |
| piste de jauge, intérêt | 1,73:1 ⚠️ | 2,02:1 |
| piste de jauge, accessibilité | 1,31:1 ⚠️ | 2,02:1 |

⚠️ **Les deux pistes sont sous le seuil de 3:1, et c'est un arbitrage assumé,
demandé par Maxime le 29 août 2026.** Elles portaient un filet violet qui les
délimitait ; il cernait la barre d'une teinte étrangère aux deux notes. La piste
prend désormais le **pastel de sa propre note** — la barre est entièrement bleue
ou entièrement verte, pastel pour le vide et franc pour le plein.

L'arbitrage tient **parce que le chiffre est écrit juste à côté de la barre** :
l'information n'a jamais reposé sur la jauge seule, qui porte d'ailleurs
`aria-hidden`. ⚠️ **Le jour où ce chiffre disparaîtrait de la ligne, ce choix
redeviendrait un défaut.**

⚠️ **En mode sombre la piste ne peut PAS prendre le pastel de sa note** : le
pastel y est déjà le remplissage, et une piste de la même couleur rendrait la
barre uniformément pleine. Elle y reste une surface neutre éclaircie.
| focus clavier (encre) | 10,32:1 | 17,15:1 |

**Boutons de statut** — le libellé sur son fond. En clair : menthe pleine
9,30:1 · menthe à 55 % 10,48:1 · rose plein 7,32:1 · rose à 55 % 9,22:1.
En sombre : pleines 11,44 et 9,00:1 · **atténuées à 70 %** 6,21 et 5,07:1.

⚠️ **L'opacité du repos diffère entre les deux modes, et c'est un correctif.**
« Atténuer éclaircit le fond, donc le repos n'est jamais le moins lisible des
deux » est vrai en clair et **faux en sombre**, où le pastel se mélange vers la
carte sombre : atténuer y assombrit. À 55 % dans les deux modes, le sombre
tombait à 4,34 et 3,61:1, sous le plancher.

⚠️ **Une couleur composée par transparence n'est PAS dans la palette**, donc
elle échappe à la vérification des paires de jetons. Toute opacité posée sur une
teinte se mesure à part, dans les deux modes.

**Pilules de filtre** — mêmes teintes, **autres opacités**, et c'est le même
piège qui a resservi le 29 août 2026. Ces pilules sont posées sur le **fond de
page**, pas sur une carte : en mode sombre le pastel se mélange vers `#12111a` au
lieu de `#211f2b`, donc il assombrit bien plus. À 70 %, le violet de « À
traiter » tombait à **4,11:1**, sous le plancher.

| Pilule au repos | Clair (55 %) | Sombre (80 %) |
|---|---|---|
| À traiter — violet | 7,79:1 | 5,09:1 |
| Nouveau — jaune | 9,95:1 | 7,88:1 |
| Candidaté — menthe | 9,68:1 | 7,46:1 |
| Écarté — rose | 8,51:1 | 6,03:1 |
| Toutes — sans teinte | 5,00:1 | 8,95:1 |
| Déclencheur « Trier » — bleu plein | 7,05:1 | 8,67:1 |

⚠️ **Ces chiffres sont mesurés au pixel, pas seulement calculés** — composition
sur un canvas dans le navigateur, parce que Tailwind rend ses couleurs opacifiées
en `oklab()` et qu'un parseur qui y lit du `rgb()` sort des valeurs fausses (une
première mesure annonçait 2,26:1 sur des pilules à 9,68:1).

⚠️ **La pilule elle-même ne pèse que 1,04 à 1,69:1 contre le fond en mode
clair**, très en dessous des 3:1 d'un objet d'interface. Elle est délimitée par le
**coussin** — lèvre foncée et ombre portée — et non par sa couleur, exactement
comme les boutons de statut. La remplacer par une bordure teintée ferait cinq
contours de cinq couleurs dans 40 px de haut.

---

## L'architecture des jetons — la décision à comprendre avant de toucher au CSS

Le système visuel vient de `components/pouf/pouf.css`, mais **l'application
continue de parler le vocabulaire de shadcn** — `bg-card`, `text-muted-
foreground`, `border-border`. `app/globals.css` est le **dictionnaire** entre les
deux.

**Pourquoi ne pas avoir réécrit les écrans avec le vocabulaire de pouf ?** Parce
que la refonte serait devenue un remplacement massif : ~3 900 lignes de TSX à
reprendre d'un coup, sans rien pouvoir regarder avant la fin, et un écran oublié
ne se signale par **aucune erreur** — il s'affiche simplement en couleurs par
défaut. Avec le dictionnaire, chaque écran fonctionne dès la première seconde et
se raffine ensuite, un par un.

**La conséquence à connaître** : `bg-card` ne veut plus dire « beige papier », il
veut dire « la surface du système en cours ». Un jeton nomme un **rôle**, jamais
une couleur — c'est ce qui rend un changement de système possible. Le jour où un
troisième système remplacerait pouf, c'est encore ce fichier seul qui changerait.

### ⚠️ Trois pièges mesurés, qui ne se voient dans aucune erreur

**1. `--muted` veut dire deux choses opposées selon le système.** Chez shadcn
c'est une **surface** atténuée ; chez 1st-Pouf c'est une **couleur de texte**
(`#71609b`). Définir `--muted` dans le dictionnaire écrasait le gris de texte de
pouf par un lavande très clair : les cartouches s'affichaient **vides** et les
justifications devenaient illisibles. Ni erreur de compilation, ni avertissement.
La surface s'appelle donc `--surface-muted`, et `--muted-foreground` porte sa
valeur **en dur** — s'y référer par `var(--color-muted)` la rendrait circulaire.

**2. `ring` et `cushion` sont incompatibles.** Les utilitaires `cushion-*` de
pouf posent un `box-shadow` brut ; les `ring-*` de Tailwind passent par cette
**même propriété**. Le dernier appliqué gagne, et c'est le coussin. Mesuré au
DOM : l'anneau de focus était présent dans la classe et **totalement absent du
style calculé** (`outline-style: none`), sur les boutons de statut, les onglets
de filtre **et les cartes de la liste**. La feuille de pouf l'annonce
elle-même — elle a choisi le `box-shadow` brut pour ne pas dépendre de la pile de
variables de Tailwind.

> **Règle qui en découle : sur tout élément portant un `cushion-*`, le focus
> passe par `outline`, jamais par `ring`.** Un `outline` n'entre pas en conflit
> avec un `box-shadow`. Corollaire : ne jamais poser `outline-none` sur ces
> éléments — c'est ce qui neutralisait le repli global de `pouf.css`.

**3. `pouf.css` est adapté, donc non remplaçable par une réinstallation.**
Quatre adaptations, toutes signalées sur place par « ADAPTÉ (projet) » : l'import
Tailwind et le `@source` retirés (ils vivent dans `globals.css`), les
« compensations de preflight » neutralisées, et la graisse du corps ramenée de
700 à 500. Les compensations méritent un mot : elles rendaient aux `svg` un
`display: inline` qui **décalait toutes les icônes lucide** de deux ou trois
pixels dans chaque bouton, et aux champs un `appearance: auto` qui leur rendait
leur habillage natif macOS.

### Défaut connu, mesuré et laissé : le poids de `pouf.css`

`components/pouf/pouf.css` embarque **116 familles de classes `.pouf-*`** —
dialogues, menus, tableaux, accordéons, infobulles — dont **aucune n'est
utilisée** aujourd'hui : l'application ne consomme que les jetons `@theme` et les
recettes `@utility cushion-*`. Mesuré sur le bundle de production : **19,5 Ko sur
66,6 Ko de CSS minifié, soit 29 %**. Contrairement aux utilitaires Tailwind, un
`@layer components` importé n'est pas élagué à la compilation.

**Laissé en place, et c'est un arbitrage :** la phase 6 (conversation sur une
offre) aura besoin du dialogue et du popover, qu'il faudrait alors réinstaller.
19,5 Ko minifiés pèsent ~4 Ko une fois compressés sur le réseau, pour un site à
un seul utilisateur. ⚠️ **À rouvrir si la phase 6 ne les utilise pas** : la coupe
est franche — supprimer le `@layer components` et les `@keyframes` qui le
servent, sans toucher aux jetons ni aux coussins.

---

## Formes et relief

| Élément | Rayon | Relief |
|---|---|---|
| Carte de contenu, bloc de section | `rounded-2xl` (32 px) | `cushion-row` |
| Carte isolée (la porte, un panneau d'état) | `rounded-2xl` | `cushion-card` |
| Bouton, onglet, pastille, cartouche | `rounded-full` | `cushion-control` |
| Bouton engagé | `rounded-full` | `cushion-control-active` (enfoncé) |
| Champ de saisie | `rounded-lg` (20 px) | `cushion-field`, `cushion-field-focus` |

⚠️ **Le rembourrage bas d'une carte est plus grand que le haut** (`pt-3 pb-4`).
Le coussin peint un rebord de 6 px **à l'intérieur** de la carte, en bas : un
rembourrage symétrique se lit donc comme trop serré. On biaise de la moitié du
rebord, ce que la feuille de pouf recommande explicitement.

⚠️ **Une erreur garde un FILET, jamais un coussin.** Les panneaux d'erreur sont
arrondis comme les cartes mais cernés d'un trait brique : une ombre douce les
ferait lire comme du contenu de plus.

---

## Composants propres au produit

### Les deux notes

Deux barres continues, deux couleurs, **chacune précédée de son libellé en
toutes lettres** — « Intérêt » et « Accessibilité ».

⚠️ **Le libellé ne se retire jamais**, même pour gagner de la place : sans lui,
l'information tient sur la seule couleur. ⚠️ « intérêt », jamais
« intéressement » : à côté d'un salaire, le second se lit comme une prime de
participation.

⚠️ **Largeur de libellé figée à 108 px — EN LISTE seulement** : « ACCESSIBILITÉ »
en Geist Mono mesure 104 px, soit zéro marge. C'est cette largeur qui aligne les
barres d'une offre à l'autre, et cet alignement est ce qui permet de comparer deux
offres d'un coup d'œil. **Sur la fiche le libellé reprend sa largeur naturelle** :
il n'y a qu'une offre, donc rien à aligner d'une ligne à l'autre — voir § Les
jauges de note.

⚠️ **La justification se lit à plat**, jamais repliée. Le 26 août, le barème
d'accessibilité a été corrigé précisément parce qu'on a pu **lire** pourquoi le
modèle mettait 40 là où le barème commandait 90.

### Cartouches de métadonnées

Lieu, contrat, salaire, date. **Une seule teinte neutre pour tous**, en pilule.
Ils ressortent par la **forme**, jamais par la couleur. Le salaire se distingue
par la graisse, parce que c'est celui qu'on cherche en premier. « Salaire non
précisé » a son propre traitement — pilule creuse, filet pointillé, italique —
parce que c'est **le cas majoritaire** : 65 % des offres réelles.

⚠️ **Deux tailles depuis le 29 août 2026 : 11 px en liste, 13 px sur la fiche**
(propriété `aere`, comme les notes). Le cartouche « absent » suit exactement le
même rembourrage que le plein — sa bordure entrant dans la boîte, un padding
différent le rendrait 2 px plus haut que ses voisins et décalerait la rangée.

⚠️ **Un cinquième cartouche depuis le 30 août 2026 : « 2 annonces », sur l'écran
du matin seulement.** Il dit que la ligne en fond plusieurs — France Travail
publie le même poste sous deux identifiants, et `/` n'en montre qu'un.
**Il ne se retire jamais** : sans lui, deux annonces réelles deviendraient une
ligne sans que rien ne l'indique, et un clic écarterait silencieusement une offre
que Maxime n'a pas vue. **Teinte neutre**, comme ses voisins : les cinq teintes de
signal portent chacune un rôle, et un comptage n'en est aucun.

### Filtres et classement de `/offres`

**Cinq pilules à gauche, un menu à droite**, sur une même rangée alignée sur les
bords de la liste. En dessous de 640 px elles s'empilent — `flex-col` et non
`flex-wrap`, sinon le menu se retrouverait collé à gauche sur sa propre ligne,
c'est-à-dire aligné sur rien.

| Pilule | Teinte | Ce qu'elle montre |
|---|---|---|
| À traiter | violet | le défaut — ce qui reste à faire |
| Nouveau | jaune | les offres de la dernière collecte réussie |
| Candidaté | menthe | le statut du même nom |
| Écarté | rose | le statut du même nom |
| Toutes | aucune | l'absence de filtre, marquée par un contour |

**Repos** : pastel atténué, coussin **bombé**. **Engagé** : pastel plein, coussin
**enfoncé**, graisse renforcée. C'est la grammaire des boutons de statut, reprise
telle quelle : la couleur seule ne distingue rien puisque repos et engagé la
partagent.

⚠️ **REVIREMENT du 29 août 2026, demandé par Maxime.** La règle précédente
interdisait de teinter un onglet avec une couleur de signal : une pilule menthe
ressemble à un bouton « Candidaté », qui lui **écrit en base**. Le risque est
réel ; ce qui sépare les deux objets est désormais **le chiffre contre l'icône** —
la pilule porte un compte et aucune icône, le bouton une icône et aucun compte.
⚠️ **Les retirer « pour gagner de la place » rendrait les deux indiscernables.**

⚠️ **Le compte d'une pilule ne porte PAS d'opacité.** Il en avait une (70 %) pour
se détacher du libellé : sur un pastel plein, l'encre atténuée tombait à
**3,43:1**. La distinction passe par la seule graisse, qui ne coûte rien.

**Le menu « Trier »** prend le bleu — la teinte de l'intérêt, qui est le
classement par défaut. Ce n'est pas un sixième signal : les cinq autres teintes
sont prises par les filtres d'à côté, en réutiliser une ferait croire à un filtre
de plus. Le critère en cours est **écrit sur le bouton** (« Trier · Intérêt ») :
sans lui, il faut ouvrir le menu pour savoir pourquoi une offre est en haut.

⚠️ **Trier par accessibilité ne fusionne pas les deux notes** — c'est ce qui rend
ce classement compatible avec le refus du score composite. On regarde une note
*ou* l'autre, jamais leur moyenne, et le bouton dit laquelle.

### Le titre de `/offres` : « Bonjour Maxime »

⚠️ **Le `h1` et le titre d'onglet ont DIVERGÉ le 29 août 2026, délibérément.**
La règle du projet voulait qu'ils coïncident — elle valait tant que tous deux
*nommaient* l'écran, ce qui était le cas de « Plan de travail ». Un salut ne
nomme rien : il s'adresse à quelqu'un. L'onglet garde donc « Plan de travail »,
qui reste ce qu'on lit dans l'historique, dans un favori et entre deux onglets
ouverts — les trois seuls endroits où ce titre sert.

⚠️ **Il ne varie pas avec l'heure**, et c'est une décision : « Bonsoir » à 19 h
supposerait de connaître le fuseau du visiteur au moment du rendu **serveur**,
c'est-à-dire la classe exacte de bug que `npm run verifie` traque en rejouant
toute la suite en UTC. Un salut faux à minuit coûterait plus que la variation
n'apporte, sur un écran consulté le matin.

### L'échelle des textes de la fiche — sept rôles, une seule progression

⚠️ **Relevé par Maxime le 29 août 2026 : « c'est bizarre que le texte du résumé
ne soit pas le même que celui des justifications ».** Il avait raison, et le
défaut était plus large que le cas qu'il pointait — la fiche portait **quatre
tailles de texte suivi** pour des paragraphes qui se lisent tous de la même
façon : 16 px pour le résumé, 15 pour l'annonce intégrale, 14 pour le classement,
13 pour les justifications. Ce n'était pas une échelle, c'était une accumulation :
chaque bloc était arrivé avec la taille qui semblait juste au moment où on
l'écrivait.

| Rôle | Taille | Ce qui en relève |
|---|---|---|
| **Intitulé de l'offre** | 24 / **30 px** | le `h1` |
| **Nom de l'entreprise** | **18 px** | juste au-dessus du titre |
| **Texte qui se lit** | **16 px** | résumé · justifications · annonce intégrale · note personnelle · **valeurs du classement** |
| **Chiffre d'une note** | 14 px mono | « 85 », « 55 » |
| **Pilule** | 13 px mono | cartouches · boutons Candidaté / Écarté |
| **Note de bas de page** | 12 px | l'avertissement sur la dépublication |
| **Étiquette** | 11 px mono | « APPELLATION », « MÉTIER ROME », « INTÉRÊT » |

⚠️ **L'échelle a été remontée en DEUX temps, et le second est la conséquence du
premier.** Passer le texte courant de 13 à 16 px a laissé tout le reste en place :
l'intitulé n'avait plus qu'un rapport de 1,5 avec le corps de texte, le nom de
l'entreprise était **plus petit** que lui (15 contre 16), et les pilules à 11 px
devenaient les plus petits éléments d'une page qu'elles commandent. Relevé par
Maxime : « ça fait un peu petit là quoi, vu qu'on a augmenté la police ».

⚠️ **Une taille ne se juge jamais seule.** L'intitulé revient exactement à la
valeur abandonnée le 28 août — 30 px, « à 30 px l'intitulé écrasait tout le reste
de la page ». Ce qui a changé, ce n'est pas le titre : c'est ce qu'il y a autour.

⚠️ **Les valeurs du classement quittent le rôle « donnée étiquetée » (14 px) pour
rejoindre le texte (16 px).** La distinction était juste sur le papier et
invisible à l'écran : Maxime les a repérées comme « encore l'ancienne police ».
Une catégorie qu'aucun lecteur ne perçoit n'est pas une catégorie.

⚠️ **Dès que deux tailles se côtoient sur une même ligne, c'est la LIGNE DE BASE
qui les apparie — pas le haut des boîtes.** Le classement le montre : ses deux
cellules commençaient au même pixel (écart de boîte nul) et paraissaient pourtant
décalées, parce que les hauteurs de ligne diffèrent — 15,4 px pour l'étiquette,
26 pour la valeur, soit **6,8 px** entre les deux lignes de base. Relevé à l'œil
par Maxime, confirmé au DOM. `items-baseline` ramène l'écart à zéro.
⚠️ **Ni `items-start` — c'est le défaut lui-même — ni `items-center`**, qui sur
une valeur de deux lignes centrerait l'étiquette entre les deux et cesserait de
désigner la première. **La règle vaut partout où une étiquette mono jouxte un
texte plus grand.**

⚠️ **Le résumé et les justifications sont le MÊME genre de texte, et c'est le
fond de l'affaire.** Les deux sont écrits par le modèle et disent ce qu'il a
compris de l'offre — une fois en synthèse, une fois par note. Les afficher à deux
niveaux annonçait une hiérarchie que le produit ne défend pas : **les
justifications sont l'argument central du projet**, pas une annotation sous une
barre.

⚠️ **En LISTE, la justification reste à 13 px atténuée**, et ce n'est pas une
incohérence : sur 200 lignes elle est un commentaire qu'on survole, pas un texte
qu'on lit. Le rôle change avec l'écran, la typographie suit — c'est la même
propriété `aere` qui porte les deux.

### Les jauges de note — fixes en liste, élargies sur la fiche

⚠️ **La largeur fixe de 88 px n'est pas un choix esthétique en liste : c'est ce
qui aligne les barres d'une offre à l'autre**, et cet alignement est ce qui permet
de comparer deux cents offres d'un coup d'œil sans lire les chiffres. Elle y
reste.

⚠️ **Sur la fiche, cet argument tombe — il n'y a qu'une offre.** La barre y passe
donc de 88 à **208 px** dans une colonne de 428 : avant, la moitié de la colonne
restait vide à droite du chiffre, sous une justification de pleine largeur.

| | Liste | Fiche |
|---|---|---|
| Largeur de la jauge | 88 px, fixe | flexible, **plafonnée à 208 px** |
| Largeur du libellé | 108 px, fixe | **naturelle** (54 px pour « Intérêt ») |
| Épaisseur | 8 px | 10 px |
| Chiffre | 11 px | **14 px** |

⚠️ **Deux réglages successifs, tous deux demandés en regardant l'écran.** La
jauge est d'abord passée en **pleine largeur, soit 290 px** : trop — « une barre
plus large que la moitié du texte qu'elle surmonte se lit comme un objet à part
entière plutôt que comme la mesure d'une note ». D'où le plafond de 13 rem, qui
la ramène à **208 px** : c'est cette valeur-là qui est en place.

⚠️ **Le libellé perd sa largeur fixe sur la fiche, et c'est le second défaut
qu'elle causait** : « INTÉRÊT » ne mesure que 54 px dans une case de 108, d'où
**48 px de blanc** entre le mot et sa jauge. En liste cette réserve aligne les
barres d'une ligne à l'autre ; sur une fiche il n'y a rien à aligner.
**Conséquence acceptée** : les deux jauges de la fiche ne commencent plus au même
`x` (62 px pour « Intérêt », 108 pour « Accessibilité »). Chaque bloc libellé +
jauge + chiffre se lit comme une unité, et les deux vivent dans deux colonnes
séparées.

⚠️ **Le chiffre grandit AVEC la barre, et c'est une conséquence, pas un ajout.**
À 12 px au bout d'une jauge de 208 px et sous un texte de 16, il devenait le plus
petit élément d'une rangée dont il est pourtant l'information principale — la
barre, elle, porte `aria-hidden`. Le **libellé** reste à 11 px : c'est une
étiquette, pas une donnée.

✅ **La piste faiblement contrastée (1,73:1 et 1,31:1) se lit MIEUX en grand qu'en
petit** — vérifié sur une note à 5/100 : 15 px de bleu franc sur 297 px de pastel,
on voit immédiatement que la jauge est presque vide. L'agrandissement ne dégrade
donc pas l'arbitrage du 29 août ; il le rend plus supportable.

### Densité : la liste et la fiche ne se lisent pas pareil

⚠️ **Deux densités, et les confondre était un défaut** — relevé par Maxime le
29 août 2026 devant l'écran : « c'est un peu trop compacté, alors qu'il y a de la
place ».

| | Liste | Fiche |
|---|---|---|
| Ce qu'on y fait | balayer 200 lignes | lire **une** offre |
| Ce que coûte l'air | du défilement, à chaque ligne | rien, la page est courte |
| Intitulé · entreprise | inchangés | 30 px · 18 px |
| Cartouches · boutons de statut | 11 px | **13 px** |
| Marge des cartes | conservée | **24 px** (était 16) |
| Écart entre les deux notes | 10 px vertical / 32 px horizontal | **24 / 48 px** |
| Sous la barre de note | 4 px | **10 px** |
| Lignes du classement | — | **14 px** (était 8) |

⚠️ **La marge de 24 px n'est pas un arrondi : elle se lit contre le RAYON.** Les
cartes du système ont 32 px de rayon ; à 16 px de marge, le texte passait plus
près du bord que la courbe ne s'en écarte, et venait donc buter visuellement dans
les coins. Une marge doit valoir au moins les trois quarts du rayon pour qu'un
angle arrondi se lise comme une marge et non comme un rognage.

⚠️ **L'écart sous une barre de note doit rester PLUS PETIT que l'interligne du
paragraphe** (21 px) : à 24 px, la justification se détacherait de la note
qu'elle explique et se lirait comme un texte indépendant. On perd alors le
couple, qui est toute l'information.

⚠️ **Les quatre autres cartes de la fiche ont suivi**, alors que seules deux
étaient visées. Deux respirations différentes sur des cartes empilées se voient
immédiatement — et c'est le genre d'écart qu'on ne sait plus justifier six mois
plus tard.

⚠️ **Ne pas unifier avec la liste** : ce serait lui rendre un air qu'elle n'a pas
les moyens de payer. `ContenuNotes` porte donc une propriété `aere`, et non deux
composants — les deux écrans doivent rester d'accord sur *ce qu'ils montrent*, ils
n'ont aucune raison de l'être sur *l'espace qu'ils y mettent*.

### Bouton de thème

**Trois états, pas deux** : système → clair → sombre, en cycle. Deux états
auraient supprimé le suivi automatique de macOS, qui était le comportement
antérieur et reste le défaut. L'icône dit l'état actuel (moniteur, soleil, lune),
l'infobulle dit l'effet du clic.

Le choix vit dans le **navigateur** (`localStorage`), relu par le script du
`<head>` avant la peinture — sinon la page clignoterait en clair avant de
basculer. Conséquence assumée : il ne suit pas d'un appareil à l'autre. Deux
onglets ouverts, en revanche, se synchronisent par l'événement `storage`.

⚠️ **`/connexion` respecte le choix mais n'offre pas le bouton** : il vit dans le
groupe `(site)`, qui est une serrure et pas un rangement.

### Boutons de statut

Les deux portent leur couleur **en permanence**, y compris au repos — décision de
Maxime du 29 août 2026, pour donner de la couleur à la liste.

Quand le repos et l'état engagé partagent la même teinte, la couleur ne
distingue plus rien. **Trois signaux portent donc la différence, et aucun n'est
décoratif :**

1. **La saturation** — 55 % au repos, plein engagé. Le plus lisible des trois.
2. **Le relief s'inverse** — bombé au repos, enfoncé engagé.
3. **L'icône change** — coche/croix au repos, flèche de retour engagé — et
   `aria-pressed` porte l'état pour un lecteur d'écran.

Le plancher interdit qu'une information tienne sur la seule couleur ; ici elle ne
tient sur **aucune** couleur, ce qui est plus robuste qu'avant.

⚠️ **11 px en liste, 13 px sur la fiche** — même propriété `aere` que les
cartouches. Sur la fiche ils sont le geste principal de l'écran, sous un intitulé
de 30 px : à 11 px ils en devenaient les plus petits éléments. En liste ils se
répètent deux cents fois, chaque pixel de hauteur s'y paie en défilement.
⚠️ **L'opacité du repos diffère entre les deux modes** — 55 % en clair, 70 % en
sombre : atténuer éclaircit sur une carte blanche et **assombrit** sur une carte
sombre. Voir § Contrastes.

### Ligne d'offre

L'**entreprise en tête**, au-dessus du titre, dans sa teinte propre — elle
partage police et taille avec l'intitulé, sans teinte rien ne les distinguerait.
Le marqueur « Nouveau » à côté d'elle. Les boutons de statut poussés à droite, en
haut, sur la seule rangée dont la hauteur ne dépend pas du contenu.

⚠️ **La survol fait MONTER la carte, il ne la teinte pas.** Un `hover:bg-accent`
sur une carte blanche la ferait virer au lavande, c'est-à-dire se confondre avec
le fond de page qu'elle est censée surplomber.

### La carte de passage — bas de l'écran du matin

Une carte pleine largeur, même surface et même coussin qu'une ligne d'offre, qui
mène au poste de travail : *« 566 autres offres attendent dans le plan de
travail »*, flèche à droite.

⚠️ **Le nombre est CHIFFRÉ et en gras, jamais un simple lien.** C'est lui qui rend
acceptable le parti pris de l'écran du matin — ne montrer qu'une nuit, et
seulement au-dessus du seuil. Sans ce chiffre, tout le reste de la base
disparaîtrait sans laisser de trace, et un matin calme ressemblerait à une base
vide.

⚠️ **Elle s'affiche aussi — et surtout — sous les écrans vides.** C'est là qu'elle
sert le plus.

⚠️ **Son focus passe par `outline`**, comme tout élément à coussin. Mesuré le
30 août 2026 : anneau de 2 px présent, contraste **10,32:1** contre le fond de
page.

---

## Mise en page

- **Largeur maximale de contenu** : **1000 px**, jeton `--largeur-page`. Figée
  le 26 août 2026 et ✅ **remesurée après la refonte** : sur les 200 lignes
  affichées, dont 84 avec salaire, **zéro rangée de cartouches ne casse sur deux
  lignes**.
- **Un seul point de bascule** : `sm:` (640 px). Vérifié à 375 px sur la liste et
  la fiche le 29 août 2026 : aucun débordement horizontal.
- **Densité de la ligne notée** : **235 px** en bureau, plus 8 px d'écart entre
  cartes. ⚠️ **C'est une médiane, pas une constante** — la hauteur dépend de la
  longueur des deux justifications. Aucun calcul ne doit supposer une ligne de
  hauteur fixe.
- **La fiche est en colonne unique**, et la question se rouvre en phase 6 quand
  l'enrichissement aura de quoi remplir une seconde colonne.

---

## Mouvement

- **Approche** : minimal fonctionnel, avec une exception — le flux d'étapes de
  l'enrichissement en phase 6, seul endroit où le mouvement porte une
  information.
- **Durées** : micro 50-100 ms · courte 150-250 ms · moyenne 250-400 ms.
- **Réduction du mouvement** : prise en charge. ⚠️ `pouf.css` porte sa propre
  règle `prefers-reduced-motion` mais elle **ne couvre pas `scroll-behavior`** ;
  celle de `globals.css` est plus complète et les deux se cumulent.

---

## Plancher d'accessibilité — opposable

Un choix qui casse une de ces règles est un défaut, pas un parti pris.

- Texte 4,5:1 · éléments d'interface et objets graphiques porteurs de sens 3:1.
- **Focus clavier toujours visible.** ⚠️ Par `outline` sur tout élément à
  coussin — voir le piège n° 2 plus haut. Mesuré à 10,32:1 en clair.
- Toute boucle et toute animation de plus de 200 ms coupées sous
  `prefers-reduced-motion`.
- **Jamais l'information par la seule couleur.** Chaque statut porte une icône ;
  chaque barre de note porte son libellé.
- **Recalculer les contrastes à chaque changement de couleur.**

---

## Vérifications effectuées le 29 août 2026

Faites dans un navigateur, pas déduites.

- Contrastes : les 36 paires de la palette calculées en clair et en sombre. Le
  seul échec — les pastels comme objets graphiques en clair — est corrigé par les
  variantes `-barre`.
- `/offres`, la fiche, `/connexion` et son état d'erreur, la page de contrôle :
  regardés en clair et en sombre.
- 375 px sur la liste et la fiche : **aucun débordement horizontal**, mesuré au
  DOM.
- Focus clavier : vérifié par tabulation réelle, `outline` 2 px à 10,32:1.
- Console : aucune erreur, aucun avertissement.
- Fuite de données : douze noms de colonnes cherchés dans le HTML de la liste et
  de la fiche — **aucun**, avec témoin positif.
- `npm run verifie` : lint, typecheck, 39 tests dans les deux fuseaux.

**Non vérifié** : le rendu sur un vrai téléphone — 375 px simulé dans un
navigateur de bureau ne reproduit ni l'écran haute densité, ni la barre du
navigateur mobile.

---

## Journal des décisions

Les décisions d'avant la refonte ne sont conservées que si elles tiennent encore.

| Date | Décision | Justification |
|------|----------|---------------|
| 16 août 2026 | Deux barres continues, deux couleurs, avec libellé | Demande de Maxime ; le libellé rend la solution conforme au plancher |
| 16 août 2026 | Cartouches d'une seule teinte | Une couleur par métadonnée donnerait 25 taches sur un écran de 5 offres |
| 16 août 2026 | Borne de conversation en tokens, pas en messages | Le contexte est renvoyé à chaque tour : la consommation croît quadratiquement |
| 26 août 2026 | Libellé de note porté à 108 px | « ACCESSIBILITÉ » mesure 104 px : zéro marge dès que la police web tarde |
| 26 août 2026 | L'offre en attente de note reste en cartouche | En bloc séparé, l'état vide coûtait 42 px sur la moitié des lignes |
| 29 août 2026 | Le bandeau de `/offres` passe en manchette, titre « Plan de travail » | Le sur-titre nommait une catégorie sans sœur, et le bandeau n'avait pas de place pour l'indicateur de veille |
| **29 août 2026** | **Le système passe à 1st-Pouf** | Décision de Maxime : l'ancien système était pauvre en couleur. Validé devant l'écran, après construction réelle de `/offres` |
| 29 août 2026 | Un dictionnaire shadcn → pouf plutôt qu'une réécriture des écrans | Un remplacement massif ne se vérifie qu'à la fin, et un écran oublié ne lève aucune erreur |
| 29 août 2026 | Geist Mono conservée | 1st-Pouf n'a pas de chasse fixe ; sans elle la colonne des salaires ondule |
| 29 août 2026 | Fredoka ajoutée explicitement | Le registre ne la livre pas, alors que sa vitrine l'affiche |
| 29 août 2026 | Deux jetons par note (`-barre`) | Les pastels tiennent 1,06 à 1,99:1 comme objets graphiques : une jauge pastel est invisible |
| 29 août 2026 | Le corps de texte à 500, pas au 700 du système | Le contenu principal est fait de justifications de trois lignes répétées 200 fois |
| 29 août 2026 | Focus par `outline`, jamais par `ring` | Les `cushion-*` sont des `box-shadow` et écrasent les `ring-*` : l'anneau était absent du style calculé |
| 29 août 2026 | Boutons de statut colorés au repos | Demande de Maxime. La distinction repos/engagé passe à la saturation, au relief et à l'icône |
| 29 août 2026 | Le compte « M notées » retiré de `/offres` | À terme toute offre arrive notée : l'indicateur afficherait deux nombres égaux à longueur d'année |
| 29 août 2026 | La piste des jauges est teintée, le filet retiré | Demande de Maxime : la barre ne porte plus qu'une seule couleur. Sous 3:1, acceptable tant que le chiffre reste écrit à côté |
| 29 août 2026 (soir) | Les cinq pilules de filtre prennent la teinte de ce qu'elles filtrent | Demande de Maxime. **Revirement** : la règle interdisait d'employer une teinte de signal sur un onglet. Chiffre contre icône sépare désormais la pilule du bouton de statut |
| 29 août 2026 (soir) | Menu « Trier » en bleu, à droite de la rangée | Le classement par défaut EST l'intérêt ; les cinq autres teintes sont prises par les filtres |
| 29 août 2026 (soir) | Bouton de thème à trois états, choix dans le navigateur | Deux états auraient supprimé le suivi de macOS, qui était le comportement antérieur |
| 29 août 2026 (soir) | Le `h1` de `/offres` devient « Bonjour Maxime », l'onglet reste « Plan de travail » | Demande de Maxime. Un salut ne nomme pas la page : l'onglet doit rester identifiable dans l'historique et les favoris |
| 29 août 2026 (soir) | Deux densités sur la fiche et la liste (propriété `aere`) | On balaye une liste, on lit une fiche. Marges 24 px, textes 16 px, pilules 13 px sur la seule fiche |
| 29 août 2026 (soir) | Résumé et justifications à la même typographie | Même auteur, même statut : deux niveaux annonçaient une hiérarchie que le produit ne défend pas |
| 29 août 2026 (soir) | Échelle de la fiche remontée (intitulé 30, entreprise 18) | Conséquence du texte passé à 16 px. **Une taille ne se juge jamais seule** |
| 29 août 2026 (soir) | `items-baseline` sur le classement France Travail | Les boîtes étaient alignées, les lignes de base décalées de 6,8 px. C'est la ligne de base que l'œil apparie |
| **30 août 2026** | **`/` et `/offres` portent le même `h1` « Bonjour Maxime »** | Demande de Maxime. Les titres d'onglet, eux, divergent — « Ce matin » et « Plan de travail » — parce que c'est l'onglet qu'on lit dans l'historique et les favoris |
| 30 août 2026 | La date de la collecte n'est PAS répétée sous le salut | Vue à l'écran : la manchette l'affiche déjà 90 px plus haut. Le sous-titre ne dit que ce qu'elle ne dit pas — « 2 postes retenus sur 7 offres collectées » |
| 30 août 2026 | Carte de passage chiffrée en bas de `/` | Sans elle, le reste de la base disparaît de vue et un matin calme ressemble à une base vide |
| 30 août 2026 | Cartouche « N annonces », teinte neutre | Sans lui, le regroupement ferait disparaître une offre sans que rien ne l'indique. Neutre parce qu'un comptage n'est pas un signal |
| 30 août 2026 | Le squelette de `/` imite **une** ligne, pas quatre | Mesuré : un panneau vide fait 230 px, une ligne 222. Une barre unique cale les deux cas ; trois se trompaient de 450 px dans les deux à la fois |
| 30 août 2026 | Six écrans vides sur `/`, dont « la notation n'a pas tourné » | Un message unique dirait la même chose une nuit calme et un matin où le système est à moitié en panne |
