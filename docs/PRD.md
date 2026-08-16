# PRD — Veille offres emploi IA

Ce que le produit doit faire, et ce qu'il refuse explicitement de faire.
Rédigé en session de cadrage le 16 août 2026.

Répartition des rôles entre documents : `CLAUDE.md` porte les règles de travail,
`docs/DECISIONS.md` le *pourquoi* des décisions de cadrage, ce fichier le *quoi*,
et `docs/PLAN.md` l'ordre de construction.

**Ce document fait autorité sur le périmètre.** Une demande qui tombe dans le
hors périmètre se signale avant d'être satisfaite ; elle ne se glisse pas dans
une phase de construction.

---

## Problème

Chercher un poste dans l'IA en Île-de-France impose de relire chaque jour
plusieurs dizaines d'annonces sur France Travail, dont l'immense majorité est
hors sujet : du machine learning de recherche, du développement full-stack
déguisé en poste d'IA parce que l'entreprise en fait, des postes de séniorité
inaccessible. Le tri à la main est long, répétitif, et démotivant à force de
répétition.

Il rate surtout des offres pertinentes, et il les rate silencieusement : les
intitulés France Travail sont bruités, une offre réellement centrée sur les
agents peut s'appeler « Ingénieur études et développement (H/F) » avec la partie
intéressante enterrée au milieu de la description. Aucun filtre par mots-clés ne
la fait remonter.

Une fois une offre repérée, il reste le pire du travail : comprendre à qui on a
affaire. Une annonce ne dit presque jamais si l'entreprise construit vraiment des
systèmes à base de modèles de langage ou si elle branche un agent conversationnel
sur une base de connaissances, ni si elle a dix salariés ou trois mille, ni si le
poste existe chez l'employeur ou chez un intermédiaire. Vérifier tout cela à la
main prend un quart d'heure par offre.

Enfin, la même personne doit démontrer sa compétence technique en entretien.
Décrire des projets d'agents faits ailleurs convainc moins qu'en montrer un qui
tourne.

## Solution

Un site personnel, protégé par mot de passe, que Maxime ouvre le matin. Il y
trouve les offres du jour déjà collectées et jugées, classées, chacune avec deux
notes séparées et la phrase qui explique chaque note. Les deux offres les plus
accessibles parmi celles qui l'intéressent ont déjà reçu, pendant la nuit, une
fiche d'enrichissement sur l'entreprise : taille, âge, ce qu'elle vend et à qui, ce
qu'elle fait réellement en IA, la technique attendue sur ce poste, et les sources
consultées.

Sur n'importe quelle autre offre, il peut déclencher le même enrichissement d'un clic et
regarder l'agent travailler étape par étape.

Chaque offre porte un statut qu'il change à la lecture — à traiter, candidaté,
écarté — et un champ de notes personnelles. La liste du matin ne montre que ce
qui reste à traiter et dépasse le seuil d'intérêt ; tout le reste, y compris les
offres écartées par le système, reste consultable pour vérifier ce que le filtre
a jeté et corriger les critères.

## Utilisateur cible

Un utilisateur unique : Maxime, jeune diplômé Bac+5 d'école d'ingénieur (ENSEA),
six mois d'expérience professionnelle en cabinet de conseil en stratégie data et
IA au pôle research — développement de preuves de concept agentiques, animation
d'ateliers, études de marché, vulgarisation.

Il cherche activement un poste en Île-de-France sur les agents IA,
l'orchestration de modèles de langage et l'automatisation intelligente. Il refuse
le machine learning de recherche et les postes de développement où l'IA n'est
qu'un décor. Il est fermé sur les intitulés de séniorité, mais candidate
volontiers là où deux ans d'expérience sont demandés.

Contexte d'usage : le matin, chez lui, sur ordinateur ou sur téléphone, dix à
quinze minutes. Il n'a aucune envie d'administrer un outil — il veut lire une
liste et décider.

Deuxième contexte, plus rare mais déterminant : en entretien d'embauche, il ouvre
le site devant un interlocuteur technique pour montrer ce qu'il sait construire.

## User Stories

### Consultation quotidienne

1. **US-1** — En tant que Maxime, je veux ouvrir le site et voir les offres du
   jour classées par intérêt décroissant, afin de commencer par les plus
   prometteuses sans rien trier moi-même.
2. **US-2** — En tant que Maxime, je veux distinguer d'un coup d'œil les offres
   arrivées depuis ma dernière visite de celles que j'ai déjà vues, afin de ne
   pas relire deux fois la même chose.
3. **US-3** — En tant que Maxime, je veux voir sur chaque offre la note d'intérêt
   et la note d'accessibilité présentées séparément, afin de décider en
   connaissant à la fois l'envie et la chance.
4. **US-4** — En tant que Maxime, je veux lire une phrase de justification sous
   chaque note, afin de comprendre le raisonnement et de repérer quand mes
   critères sont mal réglés.
5. **US-5** — En tant que Maxime, je veux ouvrir la fiche d'une offre et y
   trouver l'intitulé, l'entreprise, le lieu, le type de contrat, la date de
   publication et le salaire, afin d'avoir l'essentiel sans naviguer ailleurs.
6. **US-6** — En tant que Maxime, je veux déplier la description intégrale de
   l'annonce sur le site, afin de juger sur le texte réel sans quitter l'outil.
7. **US-7** — En tant que Maxime, je veux un lien vers l'annonce d'origine, afin
   de postuler par le canal officiel.
8. **US-8** — En tant que Maxime, je veux consulter le site depuis mon téléphone,
   afin de lire la veille du matin sans allumer l'ordinateur.

### Suivi de mes candidatures

9. **US-9** — En tant que Maxime, je veux passer une offre en « candidaté » ou
   « écarté » d'un clic, afin qu'elle disparaisse de la liste du matin.
10. **US-10** — En tant que Maxime, je veux retrouver la liste de tout ce à quoi
    j'ai candidaté, afin de savoir où j'en suis dans ma recherche.
11. **US-11** — En tant que Maxime, je veux écrire une note libre sur une offre,
    afin de garder une impression, un nom de contact ou une date de relance.
12. **US-12** — En tant que Maxime, je veux que ma note soit conservée sans que
    j'aie à cliquer sur « enregistrer », afin de ne jamais perdre ce que j'ai
    tapé.
13. **US-13** — En tant que Maxime, je veux voir clairement si ma note n'a pas pu
    être enregistrée, afin de ne pas croire à tort qu'elle est sauvegardée.

### Enrichissement de l'entreprise

14. **US-14** — En tant que Maxime, je veux trouver le matin une fiche d'enrichissement
    déjà complète sur les deux offres les plus accessibles parmi celles qui
    m'intéressent, afin de pouvoir postuler immédiatement.
15. **US-15** — En tant que Maxime, je veux déclencher l'enrichissement moi-même sur
    n'importe quelle autre offre, afin de creuser celles que le tri automatique
    n'a pas retenues.
16. **US-16** — En tant que Maxime, je veux voir les étapes de l'enrichissement défiler
    pendant qu'il tourne, afin de savoir que ça avance et de pouvoir le montrer
    en entretien.
17. **US-17** — En tant que Maxime, je veux lire dans la fiche la taille de
    l'entreprise, sa date de création, son site officiel, ce qu'elle vend et à
    quel type de clients, afin de savoir à qui j'ai affaire.
18. **US-18** — En tant que Maxime, je veux savoir ce que l'entreprise fait
    réellement en IA, afin de vérifier que le poste correspond à ce que je sais
    faire et non à une étiquette.
19. **US-19** — En tant que Maxime, je veux connaître la technique attendue sur
    le poste quand elle est mentionnable, afin de préparer l'entretien et
    d'évaluer l'écart avec mon expérience.
20. **US-20** — En tant que Maxime, je veux voir le chiffre d'affaires quand il
    est public, afin de situer la solidité de l'entreprise.
21. **US-21** — En tant que Maxime, je veux voir les sources consultées par
    l'enrichissement et ce qui est déduit plutôt que vérifié, afin de ne pas prendre une
    supposition pour un fait en entretien.

### Régler mes critères

22. **US-22** — En tant que Maxime, je veux accéder à toutes les offres
    collectées, y compris celles écartées par le filtre, avec leurs notes et
    leurs justifications, afin de vérifier ce qui a été jeté à tort.
23. **US-23** — En tant que Maxime, je veux que rien ne soit jamais supprimé,
    afin de pouvoir régler mes seuils sur deux semaines de données réelles plutôt
    que sur une intuition.

### Confiance dans l'outil

24. **US-24** — En tant que Maxime, je veux savoir quand la dernière veille a
    réussi, afin de distinguer « rien de neuf ce matin » de « le système est en
    panne depuis dix jours ».
25. **US-25** — En tant que Maxime, je veux être averti quand aucune veille n'a
    abouti depuis plus d'une journée, afin de réparer avant d'avoir raté une
    semaine d'offres.
26. **US-26** — En tant que Maxime, je veux entrer un mot de passe pour accéder
    au site, afin que mes notes personnelles et les notes d'accessibilité restent
    privées et que personne ne puisse déclencher d'enrichissement à mes frais.

### États vides, erreurs et cas limites

27. **US-27** — En tant que Maxime, je veux un message explicite quand aucune
    offre nouvelle ne dépasse le seuil, afin de comprendre que la journée est
    simplement calme.
28. **US-28** — En tant que Maxime, je veux que le système n'enrichisse rien les
    jours où aucune offre n'atteint le seuil, afin de ne pas payer un enrichissement
    sur une offre qui ne m'intéresse pas.
29. **US-29** — En tant que Maxime, je veux voir un message clair quand un
    enrichissement échoue, et pouvoir le relancer, afin de ne pas rester devant une
    fiche vide sans explication.
30. **US-30** — En tant que Maxime, je veux que l'enrichissement me dise « employeur
    final non identifié » quand l'annonce vient d'un intermédiaire, afin de ne
    pas lire une fiche sur un cabinet de recrutement en croyant que c'est
    l'employeur.
31. **US-31** — En tant que Maxime, je veux que l'enrichissement signale son doute quand
    elle n'a pas pu identifier l'entreprise avec certitude, afin de ne pas me
    fier à une fiche construite sur une homonyme.
32. **US-32** — En tant que Maxime, je veux que l'offre s'affiche correctement
    quand le salaire est absent ou écrit en texte libre, afin que la fiche reste
    lisible dans tous les cas.
33. **US-33** — En tant que Maxime, je veux garder accès à la description
    complète même si l'annonce a disparu du site d'origine, afin de pouvoir la
    relire après sa dépublication.
34. **US-34** — En tant que Maxime, je veux qu'une offre déjà collectée hier ne
    réapparaisse pas comme nouvelle et ne soit pas notée une seconde fois, afin
    d'éviter les doublons et les dépenses inutiles.
35. **US-35** — En tant que Maxime, je veux qu'un double clic sur « enrichir » ne
    lance qu'un seul enrichissement, afin de ne pas payer deux fois la même chose.
36. **US-36** — En tant que Maxime, je veux que l'enrichissement s'arrête de lui-même au
    bout d'un temps borné, afin qu'un agent parti trop loin ne fasse pas exploser
    la facture.

### Mesure de l'exploitation

37. **US-37** — En tant que Maxime, je veux que chaque exécution de la veille et
    chaque enrichissement laissent une trace enregistrée — horodatage, durée, volumes
    traités, issue, consommation — afin de pouvoir construire plus tard un écran
    de suivi sans avoir perdu l'historique des semaines précédentes.

## Critères de succès

1. Le site affiche, chaque jour avant 8 h, les offres collectées dans la nuit,
   chacune portant deux notes chiffrées et deux justifications non vides.
2. Le site affiche en permanence la date et l'heure de la dernière veille
   réussie, et signale visuellement toute veille datant de plus de 36 heures.
3. Au plus deux enrichissements automatiques sont lancés par nuit ; zéro les jours où
   aucune offre n'atteint 50 en intérêt **et** 50 en accessibilité — vérifiable
   en comptant les fiches produites contre les notes du jour.
4. Un enrichissement déclenché manuellement affiche sa première étape en moins de dix
   secondes et se conclut — fiche produite ou échec signalé — en moins de cinq
   minutes.
5. Sans le mot de passe, aucune page du site et aucune adresse servant des
   données ne renvoie d'offre : la vérification se fait en appelant l'adresse de
   données directement, en dehors du navigateur.
6. Une note personnelle saisie puis la page rechargée : la note est toujours là.
   Réseau coupé pendant la saisie : un message d'échec apparaît et le texte n'est
   pas perdu.
7. Un statut modifié persiste après rechargement de la page et après fermeture du
   navigateur.
8. Toutes les offres collectées depuis le premier jour restent consultables,
   écartées comprises, avec leurs notes et leurs justifications.
9. Une même offre collectée deux jours de suite n'apparaît qu'une fois et n'est
   notée qu'une fois — vérifiable en comparant le nombre d'offres reçues et le
   nombre de notations effectuées.
10. À 375 pixels de large, la liste et la fiche s'affichent sans défilement
    horizontal, et la console du navigateur ne produit aucune erreur.
11. Le code source de la page envoyé au navigateur ne contient aucune clé d'accès
    à la base ni aucune clé d'API — vérifiable en cherchant les préfixes de clés
    dans la source de la page publiée.
12. Sur une fiche d'enrichissement produite à partir d'une annonce d'intermédiaire, la
    fiche indique explicitement que l'employeur final n'est pas identifié plutôt
    que de décrire l'intermédiaire.
13. Chaque exécution de la veille et chaque enrichissement laissent une trace
    consultable comportant au minimum : horodatage de début et de fin, durée,
    nombre d'éléments traités, issue (réussite ou échec avec son motif), et
    compteurs de consommation bruts. Vérifiable en comptant les traces
    enregistrées sur une semaine contre le nombre d'exécutions attendues.

## Hors périmètre

Refusé explicitement. Ce qui figure ici ne se construit pas, même si l'idée
paraît bonne sur le moment.

- **Envoi de mail, notification push, alerte téléphone.** Le site est le seul
  point d'entrée.
- **Génération de lettre de motivation ou d'argumentaire de candidature.** C'est
  un autre produit, et il tirerait la veille vers l'assistant de candidature.
- **Candidature automatique ou semi-automatique.** Le produit informe, il ne
  postule pas.
- **Toute source d'offres autre que France Travail.** Pas de LinkedIn, pas
  d'APEC, pas de Welcome to the Jungle, pas de collecte sur les sites
  d'entreprises.
- **Toute zone géographique hors Île-de-France.**
- **Comptes utilisateurs, inscription, rôles, partage.** Un seul utilisateur, une
  seule porte.
- **Suivi de candidature avancé** : calendrier d'entretiens, relances
  automatiques, pièces jointes, gestion de CV, historique d'échanges.
- **Réglage des critères de pertinence depuis l'interface.** Les critères vivent
  dans un fichier versionné, modifié à la main.
- **Modification manuelle des notes produites par le modèle.** Corriger une note
  à la main masquerait le mauvais réglage des critères au lieu de le révéler.
- **Analyse du marché de l'emploi** : tendances des technologies demandées,
  évolution des salaires, comparaison entre entreprises, graphiques sectoriels.
  Le produit trie des offres, il ne fait pas d'étude de marché. *(À ne pas
  confondre avec l'écran de suivi d'exploitation, qui est une évolution prévue —
  voir Notes complémentaires.)*
- **Application mobile installable.** Le site consulté depuis le navigateur du
  téléphone suffit.
- **Version publique à données fictives** pour la démonstration. Le mot de passe
  couvre le besoin.
- **Traduction, offres à l'étranger, offres en anglais hors France.**
- **Import de CV et appariement automatique de compétences.**

## Évolutions prévues

Ni dans la v1, ni refusées. Ce qui compte ici n'est pas la liste — c'est la
**troisième colonne** : ce que chaque évolution impose dès la première version.
Une fonctionnalité repoussée ne coûte rien ; une donnée jamais capturée ou une
structure mal choisie ne se rattrapent pas.

Rien n'entre dans cette section sans conséquence identifiée sur la v1. Sinon,
c'est du hors périmètre — ou une idée qui attendra d'être demandée.

| Évolution | Pourquoi pas maintenant | Ce que ça impose **dès la v1** |
|---|---|---|
| **Écran de suivi d'exploitation** — nombre d'exécutions, taux de réussite, durée moyenne, volumes traités, coût cumulé | Aucune valeur tant qu'il n'y a pas plusieurs semaines d'exécutions à comparer | Écrire une trace à chaque exécution et à chaque enrichissement dès le premier jour, avec les **compteurs de consommation bruts** et jamais un montant en euros seul. Un historique ne se reconstitue pas après coup, et un prix mal calculé fige une erreur définitive |
| **Conversation avec le contenu de la base** — poser des questions en langage naturel sur les offres collectées, leurs notes, leurs statuts | Une conversation sur une base vide ne démontre rien, et le tri automatique répond déjà à 90 % des besoins de fouille quotidiens | Trois choses. **1.** Stocker la fiche d'enrichissement en **champs séparés** (taille, date de création, chiffre d'affaires, secteur, technique attendue) et pas seulement en texte rédigé : un paragraphe ne se compte pas, et il faudrait relancer tous les enrichissements pour rattraper. **2.** Conserver un identifiant d'offre stable, jamais renuméroté. **3.** Garder les dates et les notes en champs typés, pas en texte libre |

**Deux frontières à tenir le jour où la conversation sera construite** : elle ne
doit pas devenir la porte de service par laquelle rentre ce que le hors périmètre
refuse. Interroger le contenu de la base est dans le périmètre ; produire une
analyse de tendances du marché de l'emploi ou rédiger un argumentaire de
candidature ne l'est pas, quel que soit le canal.

## Décisions d'implémentation

### Rythme et fraîcheur

- Une seule exécution par jour, tôt le matin, heure de Paris.
- Les offres non traitées des jours précédents restent dans la liste ; seules
  celles arrivées depuis la dernière visite portent un marqueur « nouveau ».
- Une offre déjà connue n'est ni recollectée comme nouvelle, ni notée une seconde
  fois. Si son annonce est modifiée à la source, la note initiale est conservée.
- Un indicateur de dernière veille réussie est visible en permanence. Au-delà de
  36 heures, il passe en alerte visuelle.

### Liste

- La liste principale affiche les offres de statut « à traiter » dont l'intérêt
  atteint 50, classées par intérêt décroissant.
- L'accessibilité n'intervient jamais dans ce filtre : une offre très
  intéressante mais peu accessible reste affichée.
- Un accès séparé donne l'intégralité des offres collectées, écartées comprises,
  avec leurs notes et justifications.
- État vide de la liste : message explicite distinguant « aucune offre nouvelle
  aujourd'hui » de « aucune offre ne dépasse le seuil », et rappel de la date de
  la dernière veille réussie.

### Fiche d'offre

- Entête : intitulé, entreprise, lieu, type de contrat, date de publication,
  salaire, lien vers l'annonce d'origine.
- Les deux notes côte à côte, chacune avec une phrase de justification.
- Un résumé court de l'offre, puis la description intégrale repliée derrière un
  bouton.
- Le bloc d'enrichissement, vide et accompagné d'un bouton tant que l'enrichissement
  n'a pas été lancé.
- Le champ de notes personnelles en bas de fiche.
- Salaire : affiché tel que l'annonce l'exprime, ramené à un montant annuel quand
  c'est possible, et « non précisé » quand l'annonce est muette.
- La description complète reste consultable même après dépublication de
  l'annonce à la source ; le lien externe n'est pas présenté comme garanti.

### Statuts et notes personnelles

- Trois statuts : à traiter (par défaut), candidaté, écarté. Changement en un
  clic depuis la liste comme depuis la fiche.
- Le filtre par défaut n'affiche que « à traiter » ; les deux autres restent
  accessibles.
- La note personnelle s'enregistre seule, sans bouton, avec un indicateur d'état
  d'enregistrement. En cas d'échec, un message visible apparaît et le texte saisi
  n'est pas effacé.

### Enrichissement de l'entreprise

- **Automatique**, chaque nuit : au plus deux offres, choisies parmi celles de la
  collecte du jour dont l'intérêt **et** l'accessibilité atteignent 50, classées
  par accessibilité décroissante, l'intérêt départageant les ex æquo. Si une
  seule offre passe le seuil, une seule est enrichie. Si aucune, aucun enrichissement
  n'est lancée.
- **Manuelle** : un bouton sur chaque offre non encore enrichie. Le bouton se
  désactive dès le premier clic et pendant toute la durée de l'enrichissement.
- Les étapes de l'enrichissement s'affichent au fil de l'eau pendant qu'il tourne.
- L'enrichissement est borné en nombre d'étapes et en durée. Au-delà, elle s'arrête et
  rend ce qu'elle a trouvé.
- Contenu de la fiche produite :
  - identité — nom officiel, date de création, site officiel ;
  - taille — catégorie (startup, PME, ETI, grand groupe) et tranche d'effectif ;
  - chiffre d'affaires quand il est public ;
  - ce que l'entreprise vend et à quel type de clients ;
  - ce qu'elle fait réellement en IA ;
  - la technique attendue sur ce poste ;
  - les sources consultées.
- Chaque élément est marqué comme vérifié ou déduit. Une rubrique sans
  information disponible affiche « non disponible » plutôt que d'être remplie par
  supposition.
- Quand l'annonce émane d'un intermédiaire sans employeur final nommé, la fiche
  l'indique et l'enrichissement ne se rabat pas sur l'intermédiaire.
- Quand l'entreprise ne peut pas être identifiée avec certitude, la fiche le
  signale explicitement au lieu de trancher.
- Un enrichissement échoué affiche son échec et peut être relancé.

### Accès

- Une porte unique protégée par mot de passe, vérifiée côté serveur, couvrant les
  pages comme les adresses servant des données.
- Ni comptes, ni inscription, ni rôles, ni récupération de mot de passe.

### Traçabilité de l'exploitation

- Chaque exécution de la veille enregistre une trace : horodatage de début et de
  fin, durée, nombre d'offres reçues, nombre de nouvelles offres retenues, nombre
  d'offres notées, issue et motif d'échec le cas échéant.
- Chaque enrichissement enregistre une trace : offre concernée, déclenchement
  automatique ou manuel, horodatage, durée, nombre d'étapes effectuées, issue,
  motif d'échec le cas échéant.
- Toute opération consommant le modèle enregistre ses **compteurs de consommation
  bruts**, jamais un montant en euros seul. Le coût se calcule à l'affichage à
  partir d'une grille tarifaire tenue à part et modifiable.
- Ces traces sont écrites dès la première exécution, sans écran associé dans la
  première version. Aucune n'est supprimée.

### Affichage

- Utilisable à 375 pixels de large comme sur écran d'ordinateur.
- Aucune donnée n'est jamais supprimée.

## Notes complémentaires

**Dépendances externes** — API France Travail (quota d'appels, plafond de
pagination, disponibilité). Compte facturé chez le fournisseur du modèle.
Registre public des entreprises pour la fiche d'enrichissement. Hébergement du site et
de la base sur des offres gratuites dont les conditions peuvent changer.

**Hypothèse non vérifiée** — Le volume réel d'offres pertinentes par jour en
Île-de-France est inconnu. Le dimensionnement retenu — deux enrichissements par nuit,
seuil à 50 — repose sur une estimation d'environ quarante offres collectées
quotidiennement. Ces chiffres sont à re-régler après deux semaines de données
réelles.

**Réserve sur le chiffre d'affaires** — Le registre public national fournit la
date de création, la tranche d'effectif et la catégorie d'entreprise, mais **pas**
le chiffre d'affaires. Celui-ci provient des comptes déposés au greffe, et une
large part des entreprises en demande la confidentialité. Le CA sera donc absent
la plupart du temps, particulièrement sur les jeunes sociétés du secteur.

**Risque d'appariement** — L'annonce ne fournit pas systématiquement
l'identifiant officiel de l'entreprise. Un rapprochement par nom ramène
facilement une homonyme, et produit une fiche fausse d'apparence rigoureuse.
D'où la règle du doute déclaré.

**Risque de calibrage** — Les notes peuvent être systématiquement mal étalonnées
au démarrage. C'est la raison d'être des justifications affichées et de la
conservation de toutes les offres.

**Risque d'exploitation** — Le déclencheur quotidien s'éteint après 60 jours sans
activité sur le dépôt, et une exécution ratée ne prévient personne. C'est ce que
couvre l'indicateur de dernière veille réussie.

**Risque de confidentialité** — Les notes personnelles et les notes
d'accessibilité sont visibles par quiconque détient le mot de passe. Le donner en
entretien expose l'appréciation portée sur l'entreprise de l'interlocuteur.

**Coût estimé** — Ordre de grandeur non vérifié : quelques centimes par jour pour
la notation, 0,20 € à 1 € par enrichissement, soit 12 € à 60 € par mois dans le pire
cas. À confirmer contre la tarification réelle avant la mise en service.

**Évolutions prévues** — Voir la section dédiée plus haut. Deux items à ce jour :
l'écran de suivi d'exploitation et la conversation avec le contenu de la base.
Les deux imposent des contraintes à la v1, ce qui est la seule raison pour
laquelle ils figurent au PRD au lieu d'attendre d'être demandés.
