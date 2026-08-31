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
notes séparées et la phrase qui explique chaque note.

Sur une offre qui l'accroche, il déclenche d'un clic un enrichissement sur
l'entreprise et regarde l'agent travailler étape par étape : taille, âge, ce
qu'elle vend et à qui, ce qu'elle fait réellement en IA, la technique attendue sur
ce poste, et les sources consultées. **Rien ne s'enrichit sans ce clic** —
l'enrichissement automatique nocturne a été retiré de la v1 le 16 août 2026, parce
qu'il aurait produit une soixantaine de fiches par mois, lues ou non, sur une
sélection reposant sur des seuils encore non calibrés. Une enveloppe quotidienne de
tokens borne ce que ces enrichissements peuvent coûter en une journée.

Chaque offre porte un statut qu'il change à la lecture — à traiter, candidaté,
écarté — et un champ de notes personnelles. L'écran d'accueil est un **compte
rendu** : il ne montre que ce que la collecte de la nuit a ramené au-dessus du
seuil d'intérêt. Le tri quotidien se fait dans une **vue d'ensemble**, où tout ce
qui reste à traiter s'accumule, les offres fraîches étiquetées « nouveau » — et
où les offres candidatées comme celles écartées par le système restent
consultables, pour vérifier ce que le filtre a jeté et corriger les critères.

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
2. **US-2** — En tant que Maxime, je veux distinguer d'un coup d'œil, dans la vue
   d'ensemble, les offres ramenées par la dernière collecte de celles qui
   traînent depuis plusieurs jours, afin de ne pas relire deux fois la même
   chose.
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

14. ~~**US-14** — trouver le matin une fiche d'enrichissement déjà complète sur les
    deux offres les plus accessibles.~~ **Retirée de la v1 le 16 août 2026** —
    l'enrichissement devient exclusivement manuel, voir Évolutions prévues. Le
    numéro est conservé : `docs/PLAN.md` référence les user stories par numéro.
15. **US-15** — En tant que Maxime, je veux déclencher l'enrichissement moi-même sur
    n'importe quelle offre, afin de creuser celles que je juge dignes d'attention.
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
    ⚠️ **Écartée de l'ENRICHISSEMENT le 31 août 2026, et non abandonnée.** Elle
    parle du POSTE, alors que toute la fiche d'enrichissement parle de
    l'ENTREPRISE — et la technique attendue est déjà dans le texte de l'annonce,
    affiché sur la même fiche. L'y chercher par agent aurait payé la
    reformulation d'un texte déjà à l'écran. Sa destination naturelle est la
    NOTATION, qui lit l'annonce entière et rend déjà une note d'accessibilité.
    ⚠️ Ne pas la réintroduire dans la section « Business » : c'est la décision
    qu'on vient de prendre, pas une omission.
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
28. ~~**US-28** — que le système n'enrichisse rien les jours où aucune offre
    n'atteint le seuil.~~ **Sans objet depuis le 16 août 2026** — plus rien ne
    s'enrichit sans action explicite, donc il n'y a plus de dépense automatique à
    éviter. Remplacée par US-38. Numéro conservé.
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

### Maîtrise de la dépense

38. **US-38** — En tant que Maxime, je veux qu'une enveloppe quotidienne de tokens
    borne ce que mes enrichissements peuvent consommer dans une journée, afin qu'un
    bug de relance en boucle ou une série de clics ne puisse pas produire une
    facture que je découvrirais à la fin du mois.

### Coups de cœur

*Ajoutées le 30 août 2026, à la demande de Maxime. ⚠️ **Numérotées 40 et 41 et
non 14-15** : les numéros d'US ne se réutilisent jamais dans ce document, même
quand la story arrive thématiquement au milieu — un numéro recyclé rendrait
illisibles les renvois des commits et du journal.*

40. **US-40** — En tant que Maxime, je veux marquer une offre d'un « coup de
    cœur » d'un clic, afin de mettre de côté celles qui m'accrochent vraiment
    sans avoir à décider tout de suite si je candidate.
41. **US-41** — En tant que Maxime, je veux retrouver mes coups de cœur dans une
    liste dédiée **quel que soit leur statut**, afin de savoir où j'en suis sur
    celles qui comptent — y compris celles auxquelles j'ai déjà candidaté.

## Critères de succès

1. Le site affiche, chaque jour avant 8 h, les offres collectées dans la nuit,
   chacune portant deux notes chiffrées et deux justifications non vides.
2. Le site affiche en permanence la date et l'heure de la dernière veille
   réussie, et signale visuellement toute veille datant de plus de 36 heures.
3. **Aucun enrichissement n'est jamais déclenché sans action explicite de Maxime**,
   et la consommation quotidienne des enrichissements reste sous l'enveloppe fixée
   dans le fichier de configuration — vérifiable de deux façons : les traces
   portant un déclenchement automatique doivent être à zéro, et la somme des tokens
   des enrichissements d'une même journée ne doit jamais dépasser l'enveloppe.
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
- **Conversation globale sur l'ensemble de la base.** Un agent en page d'accueil
  qui interroge toutes les offres collectées. Figurait en évolution prévue jusqu'au
  16 août 2026, remplacé par la conversation *par offre* — dont le contexte et le
  coût sont bornés, ce qu'une conversation sur toute la base n'est pas.
- **Enrichissement automatique, sous quelque forme que ce soit.** Aucune offre ne
  s'enrichit sans un clic de Maxime : ni « la meilleure offre chaque jour », ni
  « au plus deux par nuit », ni aucune règle de sélection automatique. Retiré de
  la v1 le 16 août 2026 (il aurait produit ~60 fiches par mois, lues ou non, sur
  des seuils non calibrés), il y figurait encore en **évolution prévue** avec une
  condition de retour — *« quand les seuils auront été calibrés et le coût
  mesuré »*. **Décision de Maxime le 30 août 2026 : la condition disparaît et la
  ligne passe ici.** Le motif est plus fort que le coût : le bon déclencheur d'un
  enrichissement est la lecture d'une offre qui accroche, et cela ne se devine
  pas. ⚠️ **Ce qui NE change pas** : la colonne `declenchement` reste sur la trace
  d'enrichissement, même si elle ne portera jamais que « manuel ». Elle sert à
  l'écran de suivi d'exploitation, pas à préparer un retour.

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
| **Jauge de consommation du jour** — une barre horizontale montrant le pourcentage de l'enveloppe quotidienne déjà consommé, le chiffre **en tokens** à côté, et le moment de la remise à zéro | Demandé le 31 août 2026, après la clôture de la phase 6. Rien ne presse : à un enrichissement par jour, l'enveloppe n'est jamais approchée en usage normal — elle ne l'a été que par une séance de test. La jauge servira surtout **en démo**, pour montrer que la dépense est bornée | **Rien.** Tout existe déjà : `calculerConsommation()`, `ENVELOPPE_QUOTIDIENNE_TOKENS`, `debutDuJourParisien()` et le type `EtatEnveloppe` (`consommes`, `plafond`, `reste`). C'est de l'affichage pur, et c'est la seule évolution du tableau à ne rien imposer en amont |
| **Conversation avec l'agent sur une offre enrichie** — poser des questions et challenger la fiche d'enrichissement d'une offre précise, l'annonce et la fiche en contexte | La fiche d'enrichissement doit d'abord exister et être jugée utile. Discuter d'une fiche qu'on n'a jamais lue ne démontre rien | Trois choses. **1.** Stocker la fiche d'enrichissement en **champs séparés** (taille, date de création, chiffre d'affaires, secteur, technique attendue) et pas en texte rédigé — voir la justification renforcée ci-dessous. **2.** Conserver un identifiant d'offre stable, jamais renuméroté : la conversation s'y rattache. **3.** Décider **avant la première table** une enveloppe de consommation par offre, comptée en **tokens cumulés (entrée + sortie)** et affichée en pourcentage. Elle s'accompagnera d'une **enveloppe quotidienne de conversation, distincte de celle des enrichissements** — les deux ne doivent pas se voler leur budget, sans quoi une matinée d'enrichissement bloquerait toute discussion l'après-midi. Rien à prévoir dans le schéma : elle se calculera en sommant les traces du jour, comme celle des enrichissements |

**Pourquoi la fiche en champs séparés, même sans conversation globale.** Cette
contrainte figurait auparavant sous une autre évolution — un agent conversationnel
interrogeant *toute* la base — aujourd'hui abandonnée (voir Hors périmètre). Sa
justification d'origine, « un paragraphe ne se compte pas », a donc disparu. La
contrainte, elle, reste, pour deux raisons neuves qu'il faut écrire sous peine de la
voir relâchée un jour :

1. **L'affichage en dépend.** Chaque rubrique de la fiche porte son propre marqueur
   *vérifié* ou *déduit*. C'est impossible sur un pavé de texte unique.
2. **L'agent conversationnel reçoit un meilleur contexte.** Une fiche en champs se
   relit sélectivement ; un paragraphe se renvoie en entier à chaque tour — ce qui
   fait exactement gonfler le compteur de tokens qu'on cherche à borner.

**Pourquoi la borne se compte en tokens et non en messages.** Dans une conversation,
le contexte est renvoyé au modèle à chaque tour. La consommation croît donc
quadratiquement avec le nombre d'échanges, pas linéairement : dix messages peuvent
coûter plusieurs fois dix fois le premier. Un plafond en nombre de messages ne borne
rien. Trois règles qui en découlent :

- Compter l'entrée **et** la sortie, ce sont deux tarifs distincts.
- Poser aussi une borne par réponse, sinon une seule réponse peut vider l'enveloppe.
- **À 100 %, la saisie se bloque définitivement sur cette offre.** Aucun bouton de
  réinitialisation : une borne qu'on lève d'un clic n'est plus une borne. Le plafond
  se relève dans le fichier de configuration versionné, à la main.
- Le pourcentage mesure la **consommation**, pas la facture — le contexte mis en
  cache coûte une fraction du prix à la relecture. Cohérent avec la règle des
  compteurs bruts ci-dessus.

**Valeur de départ à re-régler** : 80 000 tokens par offre. Ce chiffre est une
estimation, pas une mesure — à confirmer après une vraie conversation.

**Deux frontières à tenir le jour où la conversation sera construite** : elle ne
doit pas devenir la porte de service par laquelle rentre ce que le hors périmètre
refuse. Interroger la fiche d'une offre est dans le périmètre ; produire une analyse
de tendances du marché de l'emploi ou rédiger un argumentaire de candidature ne
l'est pas, quel que soit le canal.

## Décisions d'implémentation

### Données personnelles — périmètre restreint et explicite

*Tranché le 20 août 2026, sur mesure et non sur intuition. Remplace la règle
absolue « pas de données personnelles en base ».*

Les offres sont publiques ; les coordonnées de contact qu'elles contiennent
parfois ne le sont pas au sens du RGPD. **Deux champs seulement sont conservés**,
parce qu'ils servent directement à candidater :

| Champ conservé | Présence réelle | Nature |
|---|---|---|
| `contact.nom` | 22/235 offres (9 %) — **remesuré le 28 août 2026 : 39/560 (7 %)** | Nomme une personne dans 8 cas sur 235 (3 %) — **remesuré : 21 des 39 contacts (3,8 % des offres)**, les 18 autres sont des agences France Travail |
| `contact.urlPostulation` | 16/235 offres (7 %) | Un lien de candidature — **aucune donnée personnelle** |

**Écartés à la collecte**, avant toute écriture : `coordonnees1/2/3` (adresses
postales, 14 %), `courriel`, et tout autre élément d'identification. ⚠️ Écartés à
la collecte, **jamais filtrés à l'affichage** : un champ filtré à l'affichage est
quand même en base, dans les sauvegardes et dans les journaux.

**Quatre garde-fous, opposables :**

1. **Colonnes nommées, jamais dans l'archive JSON brute.** Une colonne se
   cherche, s'exclut d'un export, se vide d'une requête. Noyée dans un bloc JSON,
   la donnée voyage partout où le bloc voyage — export, débogage, copier-coller.
2. **Ne sortent de la base que sur la fiche d'une offre** — page privée, servie
   derrière le mot de passe du site. *Amendé le 28 août 2026 par Maxime.* Les
   deux champs sont conservés **parce qu'ils servent à candidater** : les garder
   sans jamais les afficher revenait à porter le risque sans l'usage.
   ⚠️ **Les trois autres interdits tiennent, et le premier est le plus
   dangereux** : jamais dans un **journal d'exécution** — ceux de GitHub Actions
   sont **publics**, le dépôt l'étant, et une valeur imprimée une fois y reste ;
   jamais dans un **export** ; jamais sur une **page publique**.
   ⚠️ Et jamais dans la **liste** `/offres` : un champ ne se lit que là où il
   s'affiche. `contact_nom` reste hors des colonnes lues par la liste.
3. **Le site entier est derrière mot de passe**, donc ces champs ne sont
   accessibles qu'à l'utilisateur unique.
4. Les **notes personnelles** ajoutées par Maxime relèvent de la même règle.

**Pourquoi la règle absolue précédente était mauvaise** : elle interdisait aussi
`urlPostulation`, qui n'est pas une donnée personnelle et qui porte l'essentiel
de la valeur d'usage. Une règle absolue qu'on contourne en silence protège moins
qu'une règle précise qu'on respecte.

### Rythme et fraîcheur

- Une seule exécution par jour, tôt le matin, heure de Paris.
- Les offres non traitées des jours précédents restent dans la **vue
  d'ensemble** ; celles ramenées par la dernière collecte y portent un marqueur
  « nouveau ». *(Amendé au `/planifie` du 16 août 2026 : le marqueur se calcule
  par appartenance à la dernière exécution réussie, et non par comparaison à une
  date de dernière visite — une date de visite stockée viderait la liste sous les
  yeux de l'utilisateur au rechargement.)*
- Une offre déjà connue n'est ni recollectée comme nouvelle, ni notée une seconde
  fois. Si son annonce est modifiée à la source, la note initiale est conservée.
- Un indicateur de dernière veille réussie est visible en permanence. Au-delà de
  36 heures, il passe en alerte visuelle.

### Listes

Deux écrans distincts, aux rôles opposés — tranché au `/planifie` du 16 août 2026.

**L'écran d'accueil est un compte rendu.** Il affiche **uniquement les offres de
la dernière collecte réussie** dont le statut est « à traiter » et l'intérêt
atteint le seuil, classées par intérêt décroissant. Motif : la page porte la date
de la collecte en tête ; y mêler des offres de la semaine précédente ferait mentir
cet entête. Il porte une ligne de passage chiffrée vers la vue d'ensemble —
*« 566 autres offres attendent dans le plan de travail »* — sans laquelle une
offre non tranchée sortirait silencieusement du champ de vision.

⚠️ **Le seuil vaut 35 depuis le 30 août 2026, et non 50.** Décision de Maxime,
prise sur mesure : à 50, l'écran du matin était vide **quatre matins sur six** sur
les six dernières collectes réelles, et 10 offres seulement sur 574 dépassaient ce
score. À 35 : deux matins vides, et 20 offres. Descendre à 25 n'en ajouterait que
7 de plus — le gain s'aplatit, et chaque cran rapproche l'accueil d'un second
poste de travail. Barème complet dans `interface/lib/matin.ts`.

⚠️ **L'écran d'accueil regroupe les annonces d'un même poste, depuis le 30 août
2026.** France Travail publie le même poste plusieurs fois — une version « f/h »,
une version « (H/F) », deux identifiants — et la déduplication du pipeline, qui
porte sur l'identifiant, ne peut pas les voir : **29 annonces en trop sur 574,
soit 5,1 %**. Une seule ligne s'affiche par poste, la mieux notée, avec un
cartouche « 2 annonces », et **un clic de statut traite le poste entier**.
**Rien n'est effacé** — US-23 tient : toutes les annonces restent en base et
restent visibles une par une dans la vue d'ensemble, qui n'est pas regroupée.

**La vue d'ensemble est le poste de travail.** C'est là que se fait le tri
quotidien. Elle donne l'intégralité des offres collectées, écartées comprises,
avec leurs notes et justifications, et se filtre par statut. Le filtre par défaut
n'affiche que « à traiter » ; les offres de la dernière collecte y portent le
marqueur « nouveau ».

- L'accessibilité n'intervient jamais dans le filtre d'intérêt : une offre très
  intéressante mais peu accessible reste affichée.
- États vides de l'écran d'accueil : des messages **distincts**, chacun rappelant
  la date de la dernière veille réussie. Le cadrage en prévoyait trois — « la
  collecte de cette nuit n'a rien ramené », « aucune offre n'atteint le seuil »,
  « tout est traité ». ⚠️ **Six ont été livrés le 30 août 2026**, et le quatrième
  n'était pas prévu : **« la notation n'a pas tourné »**. Sans lui, une collecte
  réussie suivie d'une notation tombée s'affichait « journée calme » — c'est-à-dire
  que le système annonçait une bonne nouvelle un matin où il était à moitié en
  panne. Les deux derniers couvrent l'absence de toute collecte réussie et le cas
  où les comptages n'ont pas pu être faits.

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

⚠️ **Le coup de cœur N'EST PAS un quatrième statut** — décision de Maxime du
30 août 2026, prise après lui avoir montré ce que chaque forme impliquait. Un
statut est exclusif : une offre likée aurait cessé d'être « à traiter », donc
aurait quitté l'écran du matin, et **candidater aurait effacé le cœur**. La
liste des coups de cœur se serait vidée à mesure qu'il avance, ce qui est
l'inverse de ce qu'on lui demande.

- Le coup de cœur est donc **transverse aux statuts** : une offre peut être
  « candidaté + coup de cœur », ou même « écarté + coup de cœur ».
- Il se pose et se retire d'un clic, depuis la liste, l'écran du matin ou la
  fiche. ⚠️ **Le clic ne touche QU'UNE annonce**, contrairement aux boutons de
  statut qui traitent le poste entier sur l'écran du matin. Le statut propage
  parce qu'une jumelle laissée « à traiter » ramènerait le poste le lendemain ;
  le cœur n'a pas cette propriété, et propager remplirait la liste des coups de
  cœur de quatre lignes pour un seul poste — elle ne regroupe pas.
- Un sixième filtre le montre, et **son compte ne s'additionne pas** avec ceux
  des trois statuts : chaque offre likée en porte aussi un. Même forme que le
  filtre « Nouveau ».
- Aucune règle automatique ne pose de coup de cœur, jamais. C'est un geste de
  Maxime et rien d'autre.

### Enrichissement de l'entreprise

- **Exclusivement manuel.** Tranché le 16 août 2026 : rien ne s'enrichit sans un
  clic. ⚠️ **L'enrichissement automatique n'est plus « reporté » mais REFUSÉ**
  depuis le 30 août 2026 — il est passé en Hors périmètre, et sa condition de
  retour a été supprimée. Motif : il aurait produit une soixantaine de fiches par mois, lues ou
  non, sur une sélection reposant sur des seuils explicitement marqués « à
  re-régler après deux semaines de données réelles ». Le bon déclencheur est la
  lecture d'une offre qui accroche.
- Un bouton sur chaque offre non encore enrichie. Il se désactive dès le premier
  clic et pendant toute la durée de l'enrichissement — mais **la garde qui compte
  est côté serveur**, un bouton grisé ne protège de rien.
- **Une enveloppe quotidienne de tokens** borne ce que les enrichissements peuvent
  consommer dans une journée. Elle vit dans le fichier de configuration versionné,
  elle est vérifiée côté serveur, et elle se calcule en sommant les traces du jour
  — jamais dans un compteur séparé, qui divergerait à la première écriture ratée.
  Au-delà, le bouton indique que le plafond du jour est atteint ; le lendemain, le
  compte repart de zéro.
  - **Valeur de départ : 300 000 tokens par jour**, soit environ deux à trois
    enrichissements. Chiffre estimé, **à re-régler dès que le coût réel d'un
    enrichissement sera mesuré**.
  - ⚠️ **La notation nocturne n'entre pas dans cette enveloppe.** Son coût est
    faible et prévisible, et surtout : un matin où France Travail renvoie
    quatre cents offres, un plafond ferait **rater des offres**. La règle tient en
    une phrase — *l'enveloppe borne ce que Maxime déclenche, jamais ce que le
    système fait de lui-même chaque nuit.*
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
Île-de-France est inconnu. Le dimensionnement **retenu au cadrage** — seuil
d'affichage à 50, enveloppe quotidienne de 300 000 tokens d'enrichissement —
reposait sur une
estimation d'environ quarante offres collectées quotidiennement et d'environ
100 000 à 150 000 tokens par enrichissement.

✅ **Le seuil, lui, a été mesuré et re-réglé le 30 août 2026** — c'est le premier
de ces chiffres à sortir de l'estimation, et il est passé de 50 à **35** (voir
§ Listes). L'estimation de quarante offres par jour est également démentie : les
six dernières collectes ont ramené 7, 7, 25, 0, 162 et 2 offres.
⚠️ **L'enveloppe de tokens, elle, reste non mesurée** — aucun enrichissement n'a
encore tourné. Ils sont à re-régler après deux semaines de données réelles et après la
première mesure du coût d'un enrichissement.

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

**Coût — MESURÉ le 30 août 2026**, contre les compteurs de tokens que le pipeline
écrit dans `executions_veille` à chaque exécution. Remplace l'estimation « 5 à 8 $
par mois » du 16 août, qui était un ordre de grandeur non vérifié et se révèle
**trois fois trop haute**.

Par offre notée (notation + résumé + identification de l'employeur, un seul appel) :
5 383 tokens de cache lu, 1 423 d'entrée, 233 de sortie. Le préfixe n'est écrit
qu'une fois par nuit puis relu à 10 % du prix — vérifié sur la nuit du 30 : 4 273
tokens écrits, 21 365 lus pour 6 offres.

Au régime mesuré de **6 à 7 offres nouvelles par nuit** (~200/mois) :

| | Tarif d'introduction | Tarif normal, dès le 1ᵉʳ septembre 2026 |
|---|---|---|
| Notation seule | 1,39 $ | 2,09 $ |
| + identification de l'employeur | +0,23 $ | +0,34 $ |
| **Total** | **1,62 $/mois** | **2,43 $/mois** |

⚠️ **Le tarif d'introduction de Sonnet 5 expire le 31 août 2026** : l'entrée passe
de 2 à 3 $/M et la sortie de 10 à 15 $/M, soit **+50 % sans rien changer au code**.

⚠️ **Le volume est mesuré sur 3 nuits seulement**, les seules depuis le filtre CDI.
Les 189 et 346 offres des 20 et 26 août étaient des remplissages initiaux : les
inclure donnerait 1 582 offres/mois et un coût dix fois trop élevé. À 15 offres par
nuit, compter 4 à 5 $/mois.

L'enrichissement manuel reste estimé à 0,20 € à 1 € pièce, **non mesuré** — il
n'existe pas encore. L'enveloppe quotidienne de 300 000 tokens plafonne le pire cas
indépendamment de cette estimation.

**Évolutions prévues** — Voir la section dédiée plus haut. Deux items à ce jour :
l'écran de suivi d'exploitation et la conversation avec l'agent **sur une offre
enrichie**. Les deux imposent des contraintes à la v1, ce qui est la seule raison
pour laquelle ils figurent au PRD au lieu d'attendre d'être demandés.

**Identité visuelle** — Le système de design est fixé dans `docs/DESIGN.md` depuis le
16 août 2026, avec un aperçu vérifiable dans `docs/design-preview.html`. Les valeurs
de mise en page ont été **mesurées contre 373 offres réelles et figées le 26 août 2026** —
largeur de page et densité de la ligne. Cinq autres restent des hypothèses, chacune avec
son échéance : elles décrivent des écrans qui n'existent pas encore.
