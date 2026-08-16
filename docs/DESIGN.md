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
| **Brun-encre** | action principale · note d'intérêt · texte | un statut |
| **Ocre** | le temporel : « nouveau », enrichissement en cours | une mesure |
| **Olive** | note d'accessibilité · statut candidaté | une alerte |
| **Brique** | erreur · statut écarté | un état normal |

**Collision connue et acceptée** : l'olive sert à la fois à la note d'accessibilité et au
statut « candidaté ». Les deux ne se croisent jamais dans la même ligne, puisqu'une offre
candidatée quitte la liste du matin.

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

⚠️ **Le libellé `INT` / `ACC` devant chaque barre n'est pas décoratif.** Sans lui, la
distinction ne tiendrait que sur la teinte : perdue pour un daltonien, perdue sur un
partage d'écran compressé — et le partage d'écran est un usage réel de ce produit. Le
libellé porte l'information, la couleur la renforce. **Ne jamais le retirer pour gagner de
la place.**

Largeur fixe en liste (88 px) : c'est l'alignement d'une offre à l'autre qui permet de
comparer d'un coup d'œil. En fiche, barres larges ; sous 560 px elles deviennent fluides,
sinon le chiffre sort du cadre et disparaît.

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

> **Statut : hypothèse jusqu'à la première tranche livrée.** Ces valeurs ont été posées
> avant qu'aucun écran n'existe, contre du contenu inventé. À remesurer contre du contenu
> réel — l'intitulé le plus long, la description France Travail la plus fournie, la fiche
> la plus étoffée — dès la première tranche, puis à figer. **Tout le reste de ce document
> est opposable dès maintenant.**

- **Approche** : grille stricte.
- **Liste du matin** : barre latérale 208 px · liste fluide · panneau d'enrichissement
  316 px. Sous 1000 px, la barre latérale devient horizontale et le panneau descend.
- **Fiche d'offre** : colonne principale fluide · colonne d'enrichissement 404 px.
- **Largeur maximale de contenu** : 1180 px.
- **Arrondi** : `--radius: 0.25rem`. **Un seul.** Les autres en dérivent.

### Défaut connu, non corrigé

**La colonne gauche de la fiche est creuse** tant que la description n'est pas dépliée :
le résumé fait trois lignes, la fiche d'enrichissement en fait quarante. La correction
dépend de la longueur réelle des contenus — à trancher sur de vraies offres, en phase 1.

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
| 16 août 2026 | Borne de conversation en tokens, pas en messages | Le contexte est renvoyé à chaque tour : la consommation croît quadratiquement. Décidé par Maxime |
| 16 août 2026 | Blocage définitif à 100 % du budget | Une borne réinitialisable d'un clic n'est plus une borne. Décidé par Maxime |
