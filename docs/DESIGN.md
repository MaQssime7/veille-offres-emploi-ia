# Système de design — Veille offres emploi IA

> Cible : **shadcn/ui + Tailwind**, pas encore installé (aucun `components.json` à ce jour).
> Une fois `/installe` passé, **la vérité est dans `app/globals.css`**. Ce document
> explique *pourquoi*, il ne remplace pas le fichier.

Écrit le 16 août 2026 en session `/design`. Toutes les valeurs de contraste ci-dessous
ont été **calculées dans un navigateur** sur les couleurs réellement résolues, en mode
clair et en mode sombre. L'aperçu qui les recalcule en direct est
`docs/design-preview.html`.

---

## Contexte produit

- **Quoi** : un instrument de veille personnel — liste d'offres France Travail classées
  par intérêt, deux notes séparées par offre, fiche d'enrichissement produite par un
  agent dont on voit les étapes défiler.
- **Pour qui** : un utilisateur unique. Dix minutes le matin, sur ordinateur ou
  téléphone. Second contexte, plus rare et déterminant : l'écran est montré en partage
  d'écran pendant un entretien d'embauche, Maxime aux commandes.
- **Espace** : outils de veille et de suivi de candidature. Concurrents observés : Teal,
  Enhancv, et le fond de Dribbble sur le sujet.
- **Type** : application web. **Une seule surface** — pas de site vitrine, donc pas de
  second registre.
- **Ce qu'on retient** : *un instrument de décision, pas un tableau de bord. On voit tout
  de suite quoi lire en premier, et pourquoi.*

### Où la convention de la catégorie est fausse pour ce produit

Trois réflexes du secteur ont été écartés délibérément. Ils sont notés ici pour qu'ils ne
reviennent pas par la fenêtre à la première phase de construction.

| Réflexe du secteur | Pourquoi il est faux ici |
|---|---|
| **Kanban de statuts** | Suppose qu'on pilote des dizaines de candidatures en parallèle. L'usage réel est une décision de *lecture*, pas de gestion. Une liste ordonnée par intérêt répond à « qu'est-ce que je lis en premier », le kanban jamais |
| **Un score unique de correspondance** | Le produit repose sur le refus explicite de fusionner intérêt et accessibilité. Les afficher comme un seul « 87 % de match » détruirait sa raison d'être |
| **Un bandeau de quatre chiffres clés** | C'est de l'analyse de marché déguisée, explicitement hors périmètre au PRD. Le seul indicateur global légitime est **la dernière veille réussie**, parce qu'il répond à « le système tourne-t-il » |

Et une règle positive qui en découle : **la phrase de justification sous chaque note se lit
à plat dans la liste**, jamais derrière une infobulle ni un dépliage. Ce n'est pas un
ornement — c'est le seul mécanisme qui révèle une notation mal étalonnée.

---

## Direction esthétique

- **Direction** : **éditorial technique** — la matière d'un imprimé, la précision d'un
  instrument.
- **Décoration** : **intentionnelle**. Aucune ombre, aucune texture. Des filets et une
  grille assumés comme éléments visuels.
- **Ambiance** : un objet qu'on lit le matin, pas un logiciel qu'on administre. Chaud dans
  la matière, froid dans la précision.

**Pourquoi cette direction et pas une autre.** Le produit a deux publics contradictoires :
Maxime qui veut lire vite et décider, ce qui pousse vers un instrument dense ; et un lead
technique en entretien, à qui un tableau de bord gris ne fait aucun effet. Le serif et le
beige apportent la chaleur d'un objet de lecture ; la densité, la chasse fixe et la grille
apportent la rigueur d'un objet qui mesure. Aucun des deux publics n'est sacrifié.

**Pourquoi aucune ombre.** Sur une palette chaude, une ombre grise salit. Et la profondeur
par l'ombre est le vocabulaire du logiciel générique. Le filet est celui de l'imprimé,
c'est-à-dire le registre exact de la palette. Contrepartie assumée : **la hiérarchie repose
entièrement sur la typographie**. Si elle est molle, l'écran devient plat et aucune ombre
ne rattrapera le coup.

⚠️ **shadcn pose des ombres par défaut** sur `Card`, `Popover` et les menus déroulants.
Elles sont à retirer à l'installation. Ce n'est ni une couleur ni une police : c'est une
règle qui traverse une demi-douzaine de composants, et personne ne la devinera.

---

## Typographie

Une seule fonderie : **Google Fonts**. Trois polices, trois rôles, aucun recouvrement.

- **Titrage** : **Fraunces**, graisse 700 — Google Fonts. Serif variable montant à 900.
  Garde la direction éditoriale tout en étant massif.
  ⚠️ *Instrument Serif avait été envisagé et écarté* : elle n'existe qu'en un seul poids,
  et la mettre en gras produit un faux gras synthétique, où le navigateur épaissit les
  traits lui-même. Ne pas y revenir.
- **Texte courant et interface** : **Geist** — Google Fonts. Grotesque suisse lisible à
  13 px, chiffres tabulaires.
- **Données, libellés, métadonnées** : **Geist Mono** — Google Fonts. Même squelette et
  mêmes métriques que Geist : un chiffre en chasse fixe s'aligne avec le texte autour sans
  réglage.
- **Code** : **Geist Mono**.

**Icônes** : **lucide**. Les notions du produit ont été listées avant de trancher —
statuts à traiter / candidaté / écarté, deux axes de notation, enrichissement en cours et
ses étapes, sources consultées, vérifié contre déduit, lien externe, alerte de veille,
note personnelle, entreprise, lieu, contrat, salaire, filtre, verrou, dialogue — et lucide
les couvre toutes.

⚠️ **Le jeu d'icônes est figé à l'installation.** `shadcn apply --only` accepte `theme` et
`font`, jamais `icon`. Un second jeu mettrait deux épaisseurs de trait sur le même écran.
**Ne jamais en ajouter un deuxième.**

### Chargement

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..900&family=Geist:wght@100..900&family=Geist+Mono:wght@100..900&display=swap" rel="stylesheet">
```

*(En Next.js, préférer `next/font/google` pour ces trois familles — même résultat, sans
requête bloquante vers un tiers.)*

### Échelle

10 / 11 / 12,5 / 13,5 / 15 / 16 / 20 / 26 / 30 / 44 px

**Règle de bascule** : le serif de titrage ne descend **pas sous 20 px**. En dessous, on
repasse en Geist — un serif à fort contraste perd ses déliés en petit corps, et la liste du
matin se lit à 13 px.

**Réglage de Geist** : `font-feature-settings: "cv01", "ss03"` activé globalement, pour un
dessin plus géométrique.

---

## Couleur

Approche : **sobre**. Beige papier, encre brun-noir, et quatre teintes de signal. Chacune a
un rôle et un seul.

| Teinte | Rôle unique | Ne sert jamais à |
|---|---|---|
| **Brun-encre** | action principale · texte | un statut · ⚠️ **plus la note d'intérêt depuis le 28 août 2026** |
| **Bleu-encre** *(nouveau, 28 août 2026)* | la note d'**intérêt**, et rien d'autre | un statut · une action · du texte courant |
| **Brun-terre** *(nouveau, 28 août 2026)* | le nom de l'**entreprise**, et rien d'autre | un intitulé · une mesure |
| **Ocre** | le temporel : « nouveau », enrichissement en cours | une mesure |
| **Olive** | note d'accessibilité · statut candidaté | une alerte |
| **Brique** | erreur · statut écarté | un état normal |

**Collision connue et acceptée** : l'olive sert à la fois à la note d'accessibilité et au
statut « candidaté ».

⚠️ **CORRIGÉ LE 29 AOÛT 2026 — la justification de cette collision était FAUSSE, et la
collision reste acceptée pour une AUTRE raison.** Cette ligne disait : « les deux ne se
croisent jamais dans la même ligne, puisqu'une offre candidatée quitte la liste du matin ».
C'est démenti par la phase 4 elle-même : `/offres?statut=candidate` — la US-10, « retrouver
la liste de tout ce à quoi j'ai candidaté » — affiche précisément des lignes candidatées
**avec** leur note d'accessibilité en olive juste à côté. Les deux se croisent, et sur
l'écran fait pour ça.

✅ **Ce qui la rend malgré tout acceptable, et qui se vérifie à l'œil** : les deux formes
n'ont rien en commun. La note est une **jauge horizontale de 88 px précédée du mot
« ACCESSIBILITÉ »** ; le statut est un **bouton carré à coche**. Aucune confusion possible,
et l'information de chacun est portée par du texte et une icône, jamais par la teinte seule.

⚠️ **La leçon vaut plus que le cas : une collision de teintes justifiée par « ces deux
choses ne se rencontrent jamais » se périme dès qu'un écran les réunit — et c'est
exactement ce que fait un filtre.** Une justification qui repose sur ce que le produit
n'affiche pas encore n'est pas une justification, c'est une échéance. Ce qui tient
réellement ici, c'est la différence de **forme**.

**Pourquoi « écarter » n'est pas orange.** Un orange franc se confondrait avec l'ocre du
marqueur « nouveau ». Une même teinte ne peut pas vouloir dire « regarde ça » et « jette
ça » dans la même liste. C'est la brique qui prend ce rôle.

### Palette

| Rôle | Clair | Sombre | Usage |
|---|---|---|---|
| Fond de page | `#F9F4EB` | `#16100C` | la page |
| Texte | `#2B1D14` | `#EDE7DC` | texte courant |
| Carte | `#FDFBF6` | `#1F1914` | panneaux, cartes |
| Texte atténué | `#67574C` | `#B1A89A` | métadonnées, justifications |
| Principal | `#4B3123` | `#E2D2B7` | action principale, barre d'intérêt |
| Secondaire | `#ECE5D9` | `#2F271F` | cartouches, bouton secondaire |
| Filet | `#C3B9AB` | `#3E362E` | séparateurs — **décoratif** |
| Bordure de champ | `#857666` | `#76695C` | champs, boutons à contour |
| Focus | `#935927` | `#C08D50` | anneau clavier |
| Ocre | `#BA7404` | `#E4A249` | « nouveau », en cours |
| Ocre foncé | `#8D5210` | `#E4A249` | remplissage de jauge |
| Olive | `#48683D` | `#80AC77` | accessibilité, candidaté |
| Brique | `#AB3724` | `#D8644F` | erreur, écarté |

⚠️ **`--border` et `--input` ne sont pas interchangeables.** `--border` est un filet
décoratif, sans exigence WCAG. `--input` dessine la bordure des champs de saisie et des
boutons à contour — c'est un composant d'interface, il **doit** tenir 3:1. Les confondre
est l'erreur classique sur un thème shadcn, et c'est invisible à l'œil.

⚠️ **`--signal` existe en deux valeurs, et ce n'est pas une erreur.** Sur la pastille
« nouveau » l'ocre porte du texte foncé, donc il doit être clair. Dans une jauge il doit se
détacher d'un fond clair, donc être foncé. Deux contraintes opposées, deux variables :
`--signal` et `--signal-fort`. Avec une seule valeur, la jauge tombait à **1,94:1** — le
remplissage devenait invisible.

⚠️ **`--accent` n'est pas une couleur vive.** Chez shadcn c'est la surface de survol. Y
mettre l'ocre casserait tous les composants. Le signal a sa propre variable.

### Contrastes vérifiés

Calculés dans le navigateur, sur les couleurs résolues, dans les deux modes.
**46 / 46 paires conformes.**

| Paire | Exigé | Clair | Sombre |
|---|---|---|---|
| Texte courant sur la page | 4,5:1 | 14,88:1 | 15,32:1 |
| Texte atténué sur la page | 4,5:1 | 6,30:1 | 8,03:1 |
| Texte sur une carte | 4,5:1 | 15,76:1 | 14,13:1 |
| Texte atténué sur une carte | 4,5:1 | 6,67:1 | 7,40:1 |
| Texte du bouton principal | 4,5:1 | 11,07:1 | 11,68:1 |
| Texte d'un cartouche | 4,5:1 | 10,98:1 | 11,93:1 |
| Texte sur surface de survol | 4,5:1 | 11,00:1 | 11,44:1 |
| Texte du bouton « écarter » | 4,5:1 | 6,00:1 | 5,26:1 |
| Texte du bouton « candidaté » | 4,5:1 | 5,97:1 | 7,20:1 |
| Texte d'erreur sur la page | 4,5:1 | 5,80:1 | 5,26:1 |
| Texte de succès sur la page | 4,5:1 | 5,77:1 | 7,26:1 |
| Texte de la pastille « nouveau » | 4,5:1 | 4,80:1 | 8,29:1 |
| Texte « 86 % » de la jauge | 4,5:1 | 5,73:1 | 8,59:1 |
| Bordure de champ sur la page | 3:1 | 4,01:1 | 3,54:1 |
| Bordure de champ sur une carte | 3:1 | 4,25:1 | 3,27:1 |
| Focus clavier sur la page | 3:1 | 5,18:1 | 6,44:1 |
| Focus clavier sur une carte | 3:1 | 5,49:1 | 5,94:1 |
| Pastille ocre comme élément d'interface | 3:1 | 3,43:1 | 8,59:1 |
| Barre de la note d'intérêt | 3:1 | 9,94:1 | 10,43:1 |
| Barre de la note d'accessibilité | 3:1 | 5,27:1 | 5,96:1 |
| Jauge de budget — confortable | 3:1 | 3,56:1 | 5,04:1 |
| Jauge de budget — bientôt épuisé | 3:1 | 3,24:1 | 5,40:1 |
| Jauge de budget — épuisé | 3:1 | 3,28:1 | 3,30:1 |

**Ajoutées le 26 août 2026 avec le composant réel des deux notes.** Recalculées dans le
navigateur sur les couleurs résolues — ⚠️ **en passant par un canvas 1 × 1**, parce que
`getComputedStyle` rend désormais de l'OKLCH : un calcul qui lit `oklch(0.988 0.007 84)`
comme un triplet RVB sort des ratios proches de 1:1 sans lever la moindre erreur. Première
tentative faite exactement comme ça, et tous les résultats étaient faux.

| Paire | Exigé | Clair | Sombre |
|---|---|---|---|
| Remplissage d'intérêt sur la piste | 3:1 | 9,52:1 | 9,88:1 |
| Remplissage d'accessibilité sur la piste | 3:1 | 5,05:1 | 5,65:1 |
| Remplissage d'intérêt sur le filet de piste | 3:1 | 6,15:1 | 7,98:1 |
| Remplissage d'accessibilité sur le filet de piste | 3:1 | 3,26:1 | 4,56:1 |
| Remplissage d'intérêt sur la carte | 3:1 | 11,52:1 | 11,71:1 |
| Remplissage d'accessibilité sur la carte | 3:1 | 6,11:1 | 6,70:1 |
| Libellé « Intérêt » / « Accessibilité » | 4,5:1 | 6,67:1 | 7,40:1 |
| Chiffre de la note | 4,5:1 | 15,76:1 | 14,13:1 |
| Phrase de justification | 4,5:1 | 6,67:1 | 7,40:1 |
| Message « Notation impossible » | 4,5:1 | 6,15:1 | 4,85:1 |
| Cartouche « Pas encore notée » | 4,5:1 | 6,67:1 | 7,40:1 |

**Hors exigence, noté pour éviter un faux débat.** Le filet de la piste ne contraste qu'à
**1,87:1** (clair) et **1,47:1** (sombre) avec la carte. C'est la valeur de `--border`, que
ce document classe explicitement comme **filet décoratif sans exigence WCAG** — la même que
les séparateurs entre les lignes d'offres. Il ne porte aucune information : il rend visible
la longueur de l'échelle, que le chiffre énonce déjà.

**Mesure hors exigence, notée pour éviter un faux débat.** L'écart de luminance entre les
deux barres de notes est de **1,89:1** en clair et 1,75:1 en sombre. Ce n'est **pas** un
défaut : aucun critère WCAG n'impose un contraste entre deux indicateurs distincts et non
adjacents. Elles sont empilées, séparées par du fond, et chacune porte son libellé. Elles
se distinguent par la **teinte** — brun chaud contre vert froid — pas par la clarté.

### À coller dans `app/globals.css`

```css
:root {
  --background:             oklch(0.968 0.013 84);
  --foreground:             oklch(0.245 0.028 52);
  --card:                   oklch(0.988 0.007 84);
  --card-foreground:        oklch(0.245 0.028 52);
  --popover:                oklch(0.988 0.007 84);
  --popover-foreground:     oklch(0.245 0.028 52);
  --primary:                oklch(0.340 0.045 48);
  --primary-foreground:     oklch(0.975 0.012 84);
  --secondary:              oklch(0.925 0.018 82);
  --secondary-foreground:   oklch(0.300 0.035 50);
  --muted:                  oklch(0.938 0.015 84);
  --muted-foreground:       oklch(0.470 0.028 58);
  --accent:                 oklch(0.925 0.022 78);
  --accent-foreground:      oklch(0.300 0.035 50);
  --destructive:            oklch(0.505 0.155 32);
  --destructive-foreground: oklch(0.980 0.010 84);
  --border:                 oklch(0.790 0.022 76);
  --input:                  oklch(0.575 0.030 70);
  --ring:                   oklch(0.520 0.100 58);

  /* Propres au produit — shadcn ne les fournit pas. */
  --signal:                 oklch(0.620 0.135 68);
  --signal-foreground:      oklch(0.205 0.040 60);
  --signal-fort:            oklch(0.498 0.108 62);
  --success:                oklch(0.480 0.075 138);
  --success-foreground:     oklch(0.980 0.010 84);

  --chart-1: oklch(0.620 0.135 68);
  --chart-2: oklch(0.505 0.155 32);
  --chart-3: oklch(0.480 0.075 138);
  --chart-4: oklch(0.400 0.045 48);
  --chart-5: oklch(0.720 0.055 82);

  --radius: 0.25rem;

  --font-display: "Fraunces", Georgia, "Times New Roman", serif;
  --font-sans: "Geist", ui-sans-serif, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;
}

.dark {
  --background:             oklch(0.180 0.012 62);
  --foreground:             oklch(0.930 0.016 84);
  --card:                   oklch(0.218 0.014 62);
  --card-foreground:        oklch(0.930 0.016 84);
  --popover:                oklch(0.218 0.014 62);
  --popover-foreground:     oklch(0.930 0.016 84);
  --primary:                oklch(0.870 0.040 82);
  --primary-foreground:     oklch(0.220 0.030 52);
  --secondary:              oklch(0.278 0.018 66);
  --secondary-foreground:   oklch(0.930 0.016 84);
  --muted:                  oklch(0.262 0.016 66);
  --muted-foreground:       oklch(0.735 0.022 80);
  --accent:                 oklch(0.290 0.022 70);
  --accent-foreground:      oklch(0.930 0.016 84);
  --destructive:            oklch(0.640 0.150 32);
  --destructive-foreground: oklch(0.180 0.030 40);
  --border:                 oklch(0.340 0.018 68);
  --input:                  oklch(0.530 0.026 70);
  --ring:                   oklch(0.680 0.100 70);

  --signal:                 oklch(0.760 0.130 72);
  --signal-foreground:      oklch(0.200 0.040 62);
  --signal-fort:            oklch(0.760 0.130 72);
  --success:                oklch(0.700 0.090 140);
  --success-foreground:     oklch(0.180 0.030 140);

  --chart-1: oklch(0.760 0.130 72);
  --chart-2: oklch(0.640 0.150 32);
  --chart-3: oklch(0.700 0.090 140);
  --chart-4: oklch(0.870 0.040 82);
  --chart-5: oklch(0.560 0.045 78);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## Espacement

- **Base** : 4 px.
- **Densité** : **compacte**. L'espace sépare les blocs, il n'aère pas chaque ligne.
- **Échelle** : 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64)

---

## Composants propres au produit

Ceux qu'aucune bibliothèque ne fournit et qui, sans décision écrite, seront improvisés
différemment sur chaque écran.

### Les deux notes

Deux barres **continues, de même longueur**, remplies proportionnellement, en deux
couleurs : brun-encre pour l'intérêt, olive pour l'accessibilité. Le chiffre en chasse fixe
à droite.

⚠️ **Le libellé devant chaque barre n'est pas décoratif.** Sans lui, la distinction ne
tiendrait que sur la teinte : perdue pour un daltonien, perdue sur un partage d'écran
compressé — et le partage d'écran est un usage réel de ce produit. Le libellé porte
l'information, la couleur la renforce. **Ne jamais le retirer pour gagner de la place.**

⚠️ **Les libellés s'écrivent EN TOUTES LETTRES : « Intérêt » et « Accessibilité »** —
décidé par Maxime le 26 août 2026, après vérification qu'ils tiennent en bureau *et* en
mobile. Les abréviations `INT` / `ACC` demandaient un décodage au premier regard, ce qui
est exactement le coût qu'un instrument de décision ne doit pas faire payer. Elles sont
abandonnées.

⚠️ **Vocabulaire : « intérêt », jamais « intéressement ».** Sur un écran d'offres d'emploi,
à côté d'un salaire, « intéressement » se lit comme une prime de participation aux
bénéfices. Le contresens est immédiat.

Largeur fixe de barre en liste (88 px) : c'est l'alignement d'une offre à l'autre qui permet
de comparer d'un coup d'œil. En fiche, barres larges ; sous 560 px elles deviennent fluides,
sinon le chiffre sort du cadre et disparaît.

✅ **Mesuré sur le composant réel le 26 août 2026, et l'hypothèse précédente était fausse.**

Elle disait : libellé sur 104 px aligné à droite, barres logées **dans la réserve de droite**
de la ligne, hauteur inchangée en bureau. Elle avait été relevée sur des **barres simulées,
sans les justifications** — et c'est ce qui l'a rendue fausse. Une justification fait
**145 caractères en médiane** (169 pour l'accessibilité, mesuré sur 97 offres notées) : dans
les ~192 px de la réserve de droite, cela ferait **dix lignes de texte**. La réserve ne peut
pas porter les notes dès lors que les justifications se lisent à plat, ce que le produit
exige.

**Ce qui est en place, mesuré au DOM :**

| | |
|---|---|
| Position | Bloc pleine largeur **sous les cartouches**, séparé par un filet |
| Disposition | **Deux colonnes** en bureau, empilées sous 640 px |
| Libellé | **108 px**, aligné à gauche, `whitespace-nowrap` |
| Barre | 88 px × 8 px, piste bordée d'un filet |
| Alignement | **Une seule position gauche sur 200 lignes**, dans les deux colonnes — vérifié |

⚠️ **108 px et non 104.** « ACCESSIBILITÉ » rendu en Geist Mono mesure **exactement
100,1 px**. À 104 px de boîte il restait 4 px ; le temps que la police web charge — ou si
elle ne charge pas — le repli système est plus large et pousse la barre. L'alignement d'une
ligne à l'autre, qui est **toute la raison d'être** de cette largeur fixe, tombait alors sans
que rien ne le signale.

⚠️ **Deux colonnes et non deux blocs empilés.** Empilés sur toute la largeur, la ligne notée
atteignait ~210 px ; en deux colonnes elle en fait 195. Sur une liste de 200 offres, la
différence est un tiers d'écran par ligne.

⚠️ **La piste de la jauge porte un filet.** Sans lui elle ne contraste qu'à **1,21:1** avec la
carte : aucune exigence WCAG ne s'y applique (l'information est portée par le chiffre), mais
une piste invisible fait disparaître la **longueur commune** aux deux barres — et c'est elle
qui permet de comparer deux offres d'un coup d'œil. À 0, sans filet, il ne restait rien à
l'écran.

✅ **QUESTION CLOSE — l'échelle des barres reste LINÉAIRE.** Tranchée par Maxime le
26 août 2026. Le `PLAN.md` l'avait signalée comme « une vraie question de conception, pas un
détail » : la distribution réelle est **écrasée en bas** (médiane d'intérêt 5, la plupart des
notes entre 0 et 10), donc sur une barre linéaire une offre à 3 et une offre à 8 sont
visuellement indistinguables.

**Décision : on ne corrige pas, et le motif est le bon.** Le chiffre exact est écrit à côté de
la barre, donc l'information n'est jamais perdue — la barre n'est qu'un renfort visuel.
Étaler le bas de l'échelle ferait paraître prometteuses des offres qui ne le sont pas :
**un instrument de décision doit dire la vérité, et si presque tout est mauvais, la barre doit
le montrer.** Ne pas rouvrir pour « améliorer la lisibilité ».

**Le prix de l'information, mesuré et accepté :**

| | Avant (phase 1) | Après (phase 2) |
|---|---|---|
| Ligne notée, bureau | 91 px | **174 à 218 px, médiane 195** |
| Ligne notée, 375 px | 146 px | **289 à 472 px, médiane 361** |
| Ligne **en attente de note** | 91 px | **91 px — inchangée** |

⚠️ **L'offre en attente de note ne prend PAS le bloc.** Son cas est porté par un cartouche
creux dans la rangée des métadonnées, exactement comme « Salaire non précisé ». En bloc
séparé avec son filet, « pas encore notée » coûtait **42 px pour une phrase d'excuse**, sur
103 des 200 lignes affichées. **Un état vide ne doit jamais être plus encombrant que l'état
plein.**

### Cartouches de métadonnées

Lieu, contrat, salaire, date de publication. **Une seule teinte neutre pour tous.**

⚠️ Ils ressortent par la **forme**, jamais par la couleur. Cinq offres × cinq informations
donneraient vingt-cinq taches colorées, et plus rien ne signalerait rien. Le salaire se
distingue par la graisse, parce que c'est celui qu'on cherche en premier. « Salaire non
précisé » a son propre traitement, en cartouche vide et italique.

### Ligne d'offre

L'**entreprise en tête**, au-dessus du titre, en capitales de chasse fixe. Le marqueur
« Nouveau » à côté d'elle — pas à droite, où il se cognait aux barres de notes.

### Bloc d'enrichissement — quatre états

1. **Pas encore lancé** : bloc vide, texte explicatif, bouton « Enrichir cette offre ».
   Le bouton se désactive dès le premier clic et pendant toute la durée.
2. **En cours** : les étapes apparaissent au fil de l'eau, chacune avec son détail.
3. **Terminé** : fiche en rubriques, chacune marquée *vérifié* ou *déduit*, puis les
   sources consultées.
4. **Échoué** : message avec le motif, bouton « Relancer ». Jamais une fiche vide sans
   explication.

⚠️ **Les rubriques doivent accepter plusieurs paragraphes.** Une rubrique dimensionnée
pour une ligne *invite* l'agent à répondre en une ligne, et la fiche devient creuse. La
richesse vient du prompt, mais le design l'autorise ou l'empêche.

### Conversation sur une offre

⚠️ **Hors périmètre v1 à la date d'écriture.** Dessinée pour que la fiche lui garde sa
place ; elle ne se construit pas sans passer par le PRD.

En **pleine largeur** sous les deux colonnes, pas dans la colonne de droite : une réponse
d'agent y tenait sur 45 caractères de ligne. Largeur de lecture bornée à 74 caractères.

Messages de l'utilisateur en cartouche à angles nets ; réponses de l'agent en liseré ocre.
**Pas de bulles de messagerie arrondies** — elles appartiennent à un autre registre.

### Jauge de budget de conversation

Bornée en **tokens cumulés (entrée + sortie)**, jamais en nombre de messages : le contexte
est renvoyé à chaque tour, donc la consommation croît quadratiquement avec le nombre
d'échanges.

Forme volontairement distincte des barres de notes — 3 px pleine largeur contre 8 px sur
largeur fixe — pour qu'on ne confonde pas une mesure de l'offre avec une mesure de la
consommation. Trois états : confortable (neutre), bientôt épuisé (ocre foncé), épuisé
(brique).

**À 100 %, la saisie se bloque définitivement sur cette offre.** Aucun bouton de
réinitialisation : une borne qu'on lève d'un clic n'est plus une borne. Le plafond se
relève dans le fichier de configuration versionné, à la main.

Le pourcentage mesure la **consommation**, pas la facture — avec le contexte mis en cache,
les tokens relus coûtent une fraction du prix. La base stocke les compteurs bruts et le
coût se calcule à l'affichage.

---

## Mise en page

> **Statut : partiellement mesuré le 26 août 2026.** Ce qui existe à l'écran a été mesuré
> contre les **373 offres réelles** et figé. Ce qui n'existe pas encore reste une hypothèse,
> avec une **échéance nommée** — un chiffre inventé ne devient pas une mesure parce qu'on
> l'a écrit deux fois.

| Valeur | Statut |
|---|---|
| Largeur maximale de contenu · **1000 px** | ✅ **mesurée et figée** — voir ci-dessous |
| Densité de la ligne **en attente de note** · **95 px en bureau** *(91 avant le 28 août)*, **146 px sous 640 px** | ✅ **mesurées et figées** — ⚠️ ne jamais reprendre les 91 px pour dimensionner un repli, une pagination ou une hauteur virtuelle : sur mobile la ligne fait 60 % de plus |
| Densité de la ligne **notée** · **199 px en bureau** *(195 avant le 28 août)*, **361 px sous 640 px** (médianes) | ✅ **remesurée le 28 août 2026** sur les 97 offres notées — ⚠️ **c'est une médiane, pas une constante** : la hauteur dépend de la longueur des deux justifications et va de 174 à 218 px en bureau, de 289 à 472 px en mobile. Aucun calcul ne doit supposer une ligne de hauteur fixe |
| Barre latérale de filtres · 208 px | ⏳ hypothèse — **à mesurer en phase 4**. ⚠️ **Arithmétiquement incompatible avec les 1000 px figés** : 1000 − 48 de gouttières − 208 laisse 744 px de liste, sous les 820 px où 34 lignes sur 200 cassent déjà. La mesure des 1000 px a été faite **en colonne unique**. La phase 4 devra soit élargir la page, soit poser les filtres autrement qu'en colonne — pas reconduire ce chiffre |
| Panneau d'enrichissement · 316 px | ⏳ hypothèse — **à mesurer en phase 6** |
| Fiche d'offre, colonne d'enrichissement · 404 px | ⏳ hypothèse — **à mesurer en phase 3** |
| Bascule « sous 1000 px » | ❌ **caduque, à re-dériver en phase 4.** Ce seuil datait de `--largeur-page: 1180px` : « sous 1000 px » désignait alors une zone intermédiaire réelle. La page valant désormais 1000 px, il signifierait « toute fenêtre plus étroite que le maximum », donc presque toutes. Aujourd'hui le code n'utilise que `sm:` (640 px), au-dessous duquel la ligne se replie |

- **Approche** : grille stricte.
- **Largeur maximale de contenu** : **1000 px**, jeton `--largeur-page`.
- **Arrondi** : `--radius: 0.25rem`. **Un seul.** Les autres en dérivent.

### Pourquoi 1000 px, et pas moins

Mesuré en comptant, à chaque largeur, les lignes dont les cartouches passent à la ligne
faute de place — sur les 200 offres affichées :

| Largeur | Avec `INT` / `ACC` | Libellés en toutes lettres |
|---|---|---|
| 820 px | 34 cassées | — |
| 900 px | 6 cassées | — |
| 960 px | 0 | **9 cassées** |
| **1000 px** | 0 | **0** |

⚠️ **30 des 34 lignes cassées à 820 px sont celles qui affichent un salaire.** Le libellé
de France Travail pousse les cartouches sur une seconde ligne. Autrement dit : une largeur trop
courte marche pour les 65 % d'offres sans salaire et casse exactement sur celles qui en ont un.

⚠️ **La chaîne qui casse est « Annuel de 50000 Euros à 60000 Euros », pas « 50000.0 ».**
`formaterSalaire()` (`formats.ts`) retire les « .0 » avant l'affichage : quatre caractères de
moins. La mesure en navigateur reste valable — elle a été faite sur le rendu — mais qui
voudra la rejouer en phase 2 doit partir de la chaîne **rendue**, pas de la brute.

⚠️ **Écrire les libellés de notes en toutes lettres déplace le seuil de 960 à 1000 px.**
C'est pourquoi le libellé devait être tranché *avant* la largeur : figer 960 px puis
allonger les libellés en phase 2 aurait cassé neuf lignes sans que rien ne le signale.
**Quand deux valeurs sont couplées, l'ordre dans lequel on les fige n'est pas neutre.**

⚠️ **ÉCHÉANCE ARRIVÉE, ET LE PARI EST FAUX — 26 août 2026.** Ce paragraphe disait : « la
phase 2 ramènera le libellé à 50–60 k€, la contrainte tombera et la largeur pourra être
rouverte à la baisse ». La normalisation est livrée et **la largeur ne peut pas baisser**.

La raison n'a rien à voir avec la mise en page : **l'annualisation est calculée pendant la
notation** (`pipeline/salaire.py` tourne dans `notation.py`). Une offre pas encore notée n'a
donc aucune valeur annuelle, quelle que soit la qualité de son libellé — et la notation est
incrémentale. Mesuré ce jour : **31 offres sur 535 affichent « 45–60 k€ », les 504 autres
affichent la phrase de France Travail**. Le libellé long reste donc le cas majoritaire, et
c'est lui qui dimensionne la page.

Vérifié après livraison, à 1000 px, sur les 200 lignes affichées — **cartouche « Pas encore
notée » compris, qui en ajoute un cinquième sur la moitié des lignes** : **0 ligne cassée**.

⚠️ **La leçon dépasse ce chiffre.** Le pari couplait deux choses qui ne le sont pas : la
mise en forme (immédiate, pour toutes les offres) et le calcul qui l'alimente (payant, offre
par offre, étalé sur des semaines). **Une échéance posée sur « la phase N fera X » doit
nommer ce qui, dans X, arrive d'un coup et ce qui arrive au goutte-à-goutte.** La largeur
pourra être rouverte le jour où *toute la base* sera notée — pas le jour où le code de
normalisation existera.

⚠️ **Le vide à droite de la ligne n'est pas un défaut, c'est une réserve.** Il accueille les
deux barres de notes en phase 2, puis le statut en phase 4. Le combler serait à refaire.
Vérifié le 26 août avec des barres simulées en place : elles s'y logent sans rien pousser.

✅ **Rendez-vous honoré le 29 août 2026.** Les deux boutons de statut occupent cette réserve,
poussés par `ml-auto` sur la rangée du haut. Mesuré au DOM sur les 20 premières lignes :
ils tombent **tous à x = 898**, ce qui est toute la raison de les mettre là — trier une
matinée sans avoir à viser. ⚠️ **En haut et non en bas**, parce que c'est la seule rangée
dont la hauteur ne dépend pas du contenu : les cartouches passent à la ligne sur un salaire
long, les justifications font deux ou quatre lignes.

⚠️ **La rangée du haut a gagné 12 px** (15 → 27 px en bureau, 32 px sous 640 px où les
boutons deviennent carrés) : c'est désormais le **bouton** qui commande sa hauteur, pas le
nom d'entreprise. Reporté dans `RYTHME_LIGNE.rangeeEntete`, partagé avec le squelette de
chargement — sans quoi la page aurait sauté de 12 px par ligne à l'arrivée des offres.

### ⏳ La fiche d'offre reste à retravailler — échéance ouverte

✅ **Le jeu de couleurs est VALIDÉ** (Maxime, 28 août 2026), et **la liste est
jugée bonne en l'état**. Ne pas y revenir sans raison.

⏳ **La FICHE, elle, n'est pas finie** — couleurs et surtout hiérarchie. Verdict
de Maxime après l'avoir regardée : « ce n'est pas encore ça ». Aucun défaut
précis n'a été nommé ; c'est l'équilibre d'ensemble qui ne convainc pas.

⚠️ **Cette échéance ne se traite PAS maintenant, et pour une raison qui n'est pas
le manque de temps** : la phase 4 va poser sur cette page des boutons de statut
et une note personnelle, la phase 6 un bloc d'enrichissement de quarante lignes.
Régler l'équilibre d'une page qui va gagner deux blocs majeurs, c'est le régler
deux fois. **Échéance : après la phase 6**, quand la fiche aura tout son
contenu — et pas avant, sauf si l'usage quotidien révèle un défaut précis.

⚠️ **Ce qui, en revanche, se décide MAINTENANT et pas après** : l'ordre des
blocs, parce que les phases 4 et 6 vont s'insérer dedans. Ordre actuel, jugé
correct par Maxime : entête → résumé → les deux notes → classement France
Travail → l'annonce repliée → candidater.

✅ **Un seul point traité, le 29 août 2026 : le résumé a reçu son cadre.** Il
était le **seul des cinq blocs sans `border border-border bg-card`**, et le
premier qu'on lit. Mesuré au DOM avant correction : son paragraphe s'arrêtait à
**690 px sur 952**, sans filet pour dire où le bloc finissait — il se lisait donc
comme un texte tronqué et non comme une colonne de lecture. `max-w-prose` est
**conservé** : sans lui la ligne ferait ~150 caractères, au-delà du confort de
lecture. Vérifié sur le résumé le plus long de la base (171 caractères), à
375 px et en mode sombre.

⚠️ **Trois autres défauts ont été MESURÉS le 29 août et volontairement LAISSÉS.**
Décision de Maxime : on passe à la phase 4. Ils sont écrits ici pour ne pas être
remesurés — pas pour être traités tout de suite.

| Défaut mesuré | Mesure | Pourquoi laissé |
|---|---|---|
| ⚠️ **Les barres de notes en fiche sont celles de la LISTE** | 88 px dans un bloc de 952, soit **9 % de la largeur** — y compris sur l'offre à 85, la meilleure de la base | **C'est un écart à ce document**, qui prescrit « en fiche, barres larges ». Les 88 px ont une raison — aligner 200 lignes pour comparer — et **cette raison n'existe pas sur une page qui montre une seule offre**. À reprendre quand la fiche se rééquilibrera |
| ⚠️ **Sur une offre non notée, la fiche ne montre rien** | Vérifié sur `6141371` : ni résumé ni évaluation, et les 2 929 caractères de description sont **repliés**. La page tient en un demi-écran. Concerne **434 offres sur 567**, soit 76 % de la base | Replier a du sens quand il y a autre chose à lire ; ici il n'y a rien d'autre. ⚠️ **Ce défaut se résorbe tout seul** à mesure que la base se note — d'où l'attente |
| Les cinq titres de section ont le même poids | « ÉVALUATION » se présente exactement comme « CLASSEMENT FRANCE TRAVAIL » | Raffinement visuel pur : ne change aucune information disponible |

### Deux teintes entrent dans la palette — 28 août 2026

Décision de Maxime, après avoir regardé les écrans remplis. La palette passe de
quatre teintes de signal à six, et **la règle « un rôle chacune » tient toujours**
— c'est même elle qui a dicté la forme de l'ajout.

| Jeton | Clair | Sombre | Contraste sur carte | Rôle |
|---|---|---|---|---|
| `--interet` | `oklch(0.480 0.110 250)` | `oklch(0.750 0.110 250)` | **6,30:1** / 7,88:1 | la note d'intérêt |
| `--marque` | `oklch(0.500 0.100 45)` | `oklch(0.780 0.055 62)` | **6,03:1** / 8,6:1 | le nom de l'entreprise |

⚠️ **Le brun-encre PERD la note d'intérêt, il ne la partage pas.** Il servait à
trois choses — texte, bouton principal, note d'intérêt — dans un système dont la
règle est justement qu'une teinte n'en sert qu'une. Le bleu ne prend pas une
place en plus : il en libère une.

⚠️ **Le bleu et l'olive contrastent au même niveau (6,30 et 6,13), et c'est
délibéré.** Une mesure deux fois plus contrastée que l'autre se lirait comme la
plus importante — or tout le produit repose sur le refus de hiérarchiser ou de
fusionner les deux notes. Deux axes, deux teintes, même poids.

⚠️ **`--marque` existe pour une raison structurelle, pas décorative** : depuis
que le nom d'entreprise est passé en Geist 15 px semi-gras, il partage **police
et taille** avec l'intitulé qu'il surplombe. Sans teinte propre, deux lignes
superposées seraient indiscernables. C'est la couleur qui porte la distinction —
mais elle ne porte aucune information seule : l'entreprise reste au-dessus, le
titre en dessous, dans cet ordre.

⚠️ **Ce que cet ajout ne règle PAS** : Maxime trouvait que le site manquait de
couleur *en général*. Deux teintes ciblées ne répondent pas à ça — la direction
« sobre » reste entière. Si la question revient, elle se traite avec `/design`
sur l'ensemble des écrans, jamais en ajoutant une teinte de plus.

### Le nom d'entreprise sort de la famille des libellés — 28 août 2026

⚠️ **Il portait `libelle-mono`, c'est-à-dire exactement l'habit des titres de
section et des libellés de notes.** Une donnée déguisée en étiquette : rien, dans
la ligne, ne distinguait « KAISCHOOL » de « ÉVALUATION ». Relevé par Maxime en
regardant la page, pas en lisant le code.

Il a désormais sa classe, `nom-entreprise` : **Geist 15 px semi-gras, casse
réelle**, là où les libellés restent en Geist Mono 11 px. Trois variantes ont été
construites et comparées sur les données réelles avant de trancher.

| | Mono 11 px *(avant)* | Mono 13 px | **Sans-serif 15 px** *(retenu)* |
|---|---|---|---|
| Famille | celle des titres | celle des titres | **la sienne** |
| Casse | forcée en capitales | forcée | **réelle** |
| Ligne notée / en attente | 195 / 91 px | 197 / 93 | **199 / 95** |
| Cartouches cassés à 1000 px | 0 | 0 | **0** |

⚠️ **La casse réelle n'est pas un détail** : sur 347 noms d'entreprise en base,
**115 sont en casse mixte** — « Institut Curie », « Mercato de l'emploi ». Le
`text-transform: uppercase` les écrasait tous.

⚠️ **Coût accepté : la ligne prend 4 px.** Sur 200 lignes, +800 px pour une page
qui en fait 39 000. Les deux chiffres du tableau § Mise en page ont été mis à
jour — une mesure figée qu'on déplace se réécrit, elle ne se laisse pas périmer.

### Les titres de section se distinguent enfin de leurs libellés — 28 août 2026

⚠️ **Même défaut, un cran plus bas** : « CLASSEMENT FRANCE TRAVAIL » et
« APPELLATION » portaient la même police, la même taille et le même gris. Rien ne
disait lequel commandait l'autre. La classe `titre-section` passe le titre en
**encre pleine et demi-gras** — de 6,64:1 à 15,77:1 sur le même fond.

⚠️ **Le renfort passe par le contraste, JAMAIS par une teinte de signal**, et
c'est la règle « une teinte, un rôle » qui l'impose. Un titre de section n'est ni
temporel, ni une mesure, ni une erreur.

**En revanche « Intérêt » prend le brun-encre et « Accessibilité » l'olive** —
celles de leurs jauges. Ce n'est pas une entorse, c'est l'application de la
table : elle attribue littéralement « note d'intérêt » au brun et
« accessibilité » à l'olive. Contrastes recalculés : **11,53:1 et 6,13:1** en
clair, **11,74:1 et 6,74:1** en sombre.

⚠️ **L'ocre a été essayé sur le nom d'entreprise, puis écarté sur pièce.** Il
donnait la couleur demandée, mais posé à côté du marqueur « Nouveau » — ocre lui
aussi — les deux se fondaient et le marqueur perdait sa force. Capture à l'appui.
**C'est la démonstration concrète de « une teinte qui sert à deux choses ne sert
plus à rien ».**

⚠️ **Question ouverte, plus large que ce champ** : Maxime trouve que le site
manque de couleur en général. Ce n'est pas un réglage, c'est la direction
« sobre » elle-même, choisie au cadrage avant qu'aucun écran ne soit rempli.
Elle se rouvre avec `/design`, quand tous les écrans existeront — pas en ajoutant
une teinte à la fois, ce qui produirait exactement les « vingt taches colorées »
que ce document refuse.

### L'intitulé de la fiche est au plancher du serif — 28 août 2026

Descendu de **24/30 px à 20/24 px** : à 30 px il écrasait le reste de la page.
⚠️ **20 px est un plancher, pas un choix** — « le serif ne descend jamais sous
20 px ». Le réduire encore imposerait de passer à Geist.

### ⚠️ Défaut découvert le 29 août 2026 — la liste se décale sous le curseur

**Trier une offre la retire du filtre « à traiter », et toutes les suivantes remontent d'un
cran.** Un second clic au même endroit de l'écran trie donc **une autre offre**, sans que
rien ne l'ait annoncé.

**Découvert en testant autre chose** : quatre clics rapides destinés à éprouver le double
clic ont candidaté **quatre offres différentes**. Le test visait « la première ligne », qui
n'était plus la même à chaque clic — exactement ce que vit un utilisateur qui clique deux
fois de suite.

⚠️ **Ce n'est PAS le défaut de double écriture**, qui lui est réglé : trois clics simultanés
sur la même offre n'envoient qu'un seul POST, et l'opération est de toute façon idempotente.
C'est un défaut de **cible mouvante**, et il ne se produit que dans un filtre d'où l'offre
sort — donc jamais sur la fiche, jamais dans l'onglet « Toutes ».

**Deux remèdes possibles, non tranchés :**

| Remède | Ce qu'il coûte |
|---|---|
| Garder la ligne triée à sa place, marquée, jusqu'au prochain chargement | La liste ne dit plus la vérité entre deux rafraîchissements ; il faut un état « je viens de trier ceci » dans un composant client |
| Laisser tel quel | Un mauvais clic reste réparable — l'offre est dans un autre filtre, et son bouton la ramène. Mais rien ne signale qu'il a eu lieu |

✅ **CORRIGÉ LE 29 AOÛT 2026, à la demande de Maxime** — `_composants/verrou-tri.tsx`.
Pendant qu'une écriture de statut est en vol, **tous** les boutons de la liste sont
désactivés, pas seulement ceux de la ligne cliquée : le bouton dangereux n'est pas celui
qu'on vient de cliquer, c'est celui qui prendra sa place, et on ne sait pas lequel c'est.

⚠️ **La borne du verrou est la fin de la TRANSITION React, pas la réponse du serveur — et la
première version se trompait de borne.** Elle relâchait dans un `finally`, dès le retour de
l'appel. Mesuré au DOM :

| Instant après le clic | État |
|---|---|
| +0 à +30 ms | tous les boutons verrouillés |
| **+80 ms** | **le `finally` avait relâché — les voisins redevenaient cliquables** |
| +900 ms | la ligne disparaît, les suivantes remontent |

Le verrou tenait **30 ms** pour un décalage survenant à **900 ms** : il ne protégeait de
rien, et le défaut se reproduisait à l'identique. `enCours` de `useTransition` reste vrai
jusqu'à ce que le rendu soit **appliqué au DOM**, ce qui est exactement l'instant du
décalage.

**Mesure du correctif**, en cliquant au même pixel — un sélecteur ne convient pas, Playwright
attend que l'élément redevienne résoluble et reproduit donc l'attente qu'on veut supprimer :

| Geste | Avant | Après |
|---|---|---|
| 4 clics au même pixel, sans pause | **4 offres triées** | **1** |
| Double clic humain (180 ms) | **2 offres triées** | **1** |
| 3 tris délibérés à 1,3 s d'écart | 3 | **3** — aucune régression |

⚠️ **Ce que ça coûte** : trier en rafale impose d'attendre un aller-retour entre chaque
(~200 à 400 ms). C'est le prix d'un tri qui atteint toujours l'offre visée.

⚠️ **La leçon de méthode, qui vaut au-delà de ce cas** : un test qui re-résout son sélecteur
à chaque clic ne teste pas un double clic — il attend sagement que l'interface se stabilise,
c'est-à-dire précisément ce que l'utilisateur ne fait pas. **Pour éprouver une cible mouvante,
il faut cliquer à des coordonnées fixes.** C'est ce qui a d'abord fait croire que le correctif
ne marchait pas.

### Défaut connu, non corrigé

**La colonne gauche de la fiche est creuse** tant que la description n'est pas dépliée :
le résumé fait trois lignes, la fiche d'enrichissement en fait quarante.

⚠️ **Échéance corrigée le 26 août 2026 : phase 3, et non phase 1.** Elle disait « à trancher
en phase 1 » — or la phase 1 se clôt sans que la fiche existe, puisqu'elle arrive en phase 3.
L'échéance allait donc expirer en silence, ce que le tableau du § Mise en page est justement
censé empêcher. **Une échéance qui nomme une phase antérieure à l'écran qu'elle concerne est
toujours une erreur.**

---

## Mouvement

- **Approche** : **minimal fonctionnel**, avec une exception.
- **L'exception** : le flux d'étapes de l'enrichissement. Chaque étape apparaît en
  fondu-glissé décalé de 130 ms. C'est le seul endroit où le mouvement porte une
  information — *ça avance* — et c'est aussi le moment vitrine.
- **Courbes** : entrée `ease-out` · sortie `ease-in` · déplacement `ease-in-out`.
- **Durées** : micro 50-100 ms · courte 150-250 ms · moyenne 250-400 ms.
- **Réduction du mouvement** : prise en charge, bloc CSS plus haut. La pulsation de
  l'indicateur « en cours » est une boucle : elle **doit** être coupée.

---

## Plancher d'accessibilité — opposable

Un choix qui casse une de ces règles est un défaut, pas un parti pris.

- Texte 4,5:1 · éléments d'interface et focus 3:1.
- Focus clavier toujours visible — jamais `outline: none` sans remplacement. Mesuré à
  5,18:1 en clair, 6,44:1 en sombre.
- Toute animation de plus de 200 ms et toute boucle coupées sous `prefers-reduced-motion`.
- **Jamais l'information par la seule couleur.** Chaque statut porte une icône ou un
  symbole ; chaque barre de note porte son libellé.
- **Recalculer les contrastes à chaque changement de couleur.** L'aperçu
  `docs/design-preview.html` le fait dans la page.

---

## Vérifications effectuées le 16 août 2026

Faites dans un navigateur, pas déduites.

- 46 / 46 paires de contraste conformes, clair et sombre.
- Console : aucune erreur, aucun avertissement.
- 375 px en clair et en sombre : aucun débordement horizontal, aucun élément coupé.
- Les trois polices se chargent réellement et sont appliquées.
- Focus clavier visible et conforme.
- Toutes les icônes référencées existent dans le jeu.

**Non vérifié** : le survol à la souris (les règles existent, le rendu n'a pas été
observé) · le rendu sur un vrai téléphone — 375 px simulé dans un navigateur de bureau ne
reproduit ni l'écran haute densité, ni la barre du navigateur mobile.

---

## Journal des décisions

| Date | Décision | Justification |
|------|----------|---------------|
| 16 août 2026 | Direction éditorial technique, palette beige / marron / blanc | Préférence explicite de Maxime, et la recherche 2026 confirme que le bleu par défaut est devenu le signal « je n'ai pas choisi » |
| 16 août 2026 | Aucune ombre, uniquement des filets | Sur une palette chaude l'ombre grise salit ; le filet est le registre de l'imprimé |
| 16 août 2026 | Deux barres continues, deux couleurs, avec libellé | Demande de Maxime ; le libellé rend la solution conforme au plancher d'accessibilité |
| 16 août 2026 | Cartouches d'une seule teinte | Une couleur par métadonnée donnerait 25 taches sur un écran de 5 offres |
| 16 août 2026 | « Écarter » en brique et non en orange | L'orange franc se confondrait avec l'ocre du marqueur « nouveau » |
| 16 août 2026 | Fraunces 700 en titrage | Instrument Serif n'a qu'un poids : le gras aurait été synthétique. Choix confirmé par Maxime contre Clash Grotesk |
| 16 août 2026 | `--signal-fort` ajouté | L'ocre a deux contraintes opposées ; avec une seule valeur la jauge tombait à 1,94:1 |
| 26 août 2026 | Les notes quittent la réserve de droite pour un bloc pleine largeur en deux colonnes | La mesure qui les y logeait portait sur des barres **sans justification** ; 145 caractères n'entrent pas dans 192 px |
| 26 août 2026 | Libellé de note porté de 104 à 108 px | « ACCESSIBILITÉ » mesure 100,1 px : 4 px de marge tombaient dès que la police web n'était pas encore chargée |
| 26 août 2026 | Filet autour de la piste de jauge | Sans lui la piste contraste à 1,21:1 et la longueur commune aux deux barres disparaît — à 0, il ne restait rien à l'écran |
| 26 août 2026 | L'offre en attente de note reste à 91 px, en cartouche | En bloc séparé, l'état vide coûtait 42 px sur la moitié des lignes affichées |
| 16 août 2026 | Borne de conversation en tokens, pas en messages | Le contexte est renvoyé à chaque tour : la consommation croît quadratiquement. Décidé par Maxime |
| 16 août 2026 | Blocage définitif à 100 % du budget | Une borne réinitialisable d'un clic n'est plus une borne. Décidé par Maxime |
