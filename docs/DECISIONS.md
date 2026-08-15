# Décisions de cadrage

Ce fichier consigne les décisions prises en session de cadrage **et leur
justification**. Le `CLAUDE.md` renvoie ici au lieu de tout absorber, pour rester
court et lisible à chaque session.

Répartition des rôles entre documents :

| Fichier | Ce qu'il dit |
|---|---|
| `CLAUDE.md` | Les règles de travail et les pièges techniques établis |
| `docs/DECISIONS.md` (ce fichier) | Ce qui a été décidé, et **pourquoi** plutôt qu'autrement |
| `docs/PRD.md` (`/cadre`) | Ce que le produit doit faire |
| `docs/PLAN.md` (`/planifie`) | Dans quel ordre le construire |

Toute décision inscrite ici est acquise : ne pas la rouvrir à chaque session.
Ce qui reste ouvert est regroupé en fin de fichier.

---

## 1. Ce que Maxime cherche — session du 16 août 2026

| Axe | Décision |
|---|---|
| Sujet | Agents IA, orchestration LLM, automatisation intelligente |
| Zone | Île-de-France |
| Exclusion ferme (sujet) | ML/DL portant sur les modèles : entraînement, fine-tuning, recherche |
| Exclusion ferme (sujet) | Développement classique où l'IA n'est qu'un décor — un poste full-stack dans une entreprise d'IA n'est pas un poste d'IA |
| Exclusion ferme (séniorité) | Intitulés *senior, confirmé, lead, staff, principal, architecte, head of, manager* |
| Expérience chiffrée | **Pénalise, ne bannit jamais** : 0-1 an neutre · 2 ans légère pénalité · 3 ans forte · 4 ans et plus, score plancher |
| Salaire | **Hors critères de notation.** Affiché sur la fiche quand l'offre l'indique, sans effet sur la note |

**Profil à opposer à chaque offre** — c'est le contexte que le modèle utilise
pour juger l'accessibilité :

> Bac+5, école d'ingénieur ENSEA. Six mois d'expérience professionnelle chez
> AI Builders, cabinet de conseil en stratégie data et IA, au pôle research :
> développement de POC agentiques, animation d'ateliers agentiques pour projeter
> consultants et clients vers une mise en production, études de marché et
> benchmarks, vulgarisation.

### Pourquoi le sujet et non la quantité de code

Le premier réflexe était d'exclure les postes « trop développement ». C'est faux :
Maxime accepte un poste d'AI Engineer avec du Python quotidien, parce qu'il
travaille avec Claude Code et s'en tire. Ce qu'il refuse, c'est un poste où l'IA
n'est pas le métier. Le discriminant est donc **le sujet du poste**, pas le
volume de code.

### Pourquoi on ne bannit pas à 2 ans d'expérience

Trois raisons, contre l'intuition de départ :

1. « 2 ans » est le plus souvent un réflexe RH recopié d'une fiche précédente,
   pas un mur. Un profil ENSEA avec des POC agentiques livrés en cabinet passe
   ce filtre régulièrement, surtout sur un sujet où les candidats sont rares.
   Ce qui est réellement fermé, ce sont les 5 ans et les intitulés de séniorité.
2. **Le coût de l'erreur est asymétrique.** Une offre bannie est invisible et
   irrécupérable. Une offre notée 30/100 apparaît en bas de liste et coûte trois
   secondes de lecture. Sur quelques dizaines d'offres par jour, il n'y a aucune
   raison de payer le coût de l'invisibilité.
3. La distribution réelle des exigences d'expérience sur ce marché n'est pas
   connue. Elle le sera après deux semaines de veille — les seuils se règlent
   alors sur des données, pas sur une intuition.

### Pourquoi le salaire n'est jamais un filtre de collecte

Le champ salaire de France Travail est du texte libre très irrégulier :
« Annuel de 38000,00 Euros sur 12 mois », « Mensuel de 3500 Euros »,
« Selon profil », « À négocier ». Deux pièges :

- La majorité des offres n'affichent rien. Filtrer côté API jetterait d'un coup
  la plus grande part du gisement.
- Un code naïf cherchant « un nombre ≥ 40000 » rate « Mensuel de 3500 Euros »,
  qui vaut pourtant 42 k annuels.

Le salaire est donc lu et normalisé par le modèle à l'étape de notation, puis
affiché. Il n'entre pas dans le calcul de la note.

---

## 2. Comment le système décide

### Deux notes séparées, jamais fusionnées

Chaque offre reçoit **deux notes distinctes de 0 à 100** :

| Note | Question posée |
|---|---|
| **Intérêt** | Le sujet correspond-il à ce que je cherche ? |
| **Accessibilité** | Ai-je une chance réelle d'être retenu ? |

Pourquoi ne pas les fusionner : un poste passionnant chez un éditeur exigeant
6 ans d'expérience et un poste tiède mais accessible donneraient le même score
moyen, alors que la décision n'est pas la même. Les offres *intérêt élevé /
accessibilité faible* ont en outre une valeur propre — elles indiquent ce que le
marché demande et sur quoi se muscler.

### Rien n'est supprimé

Toutes les offres collectées sont conservées en base, y compris les écartées,
**avec leurs deux notes et le motif d'écartement**. Coût : quelques milliers de
lignes. Bénéfice : au bout de deux semaines, on regarde ce que le filtre a jeté
et on ajuste les seuils sur des données réelles. Un filtre qui supprime est
figé le premier jour.

### Les critères vivent dans un fichier, pas dans le code

Les critères de la section 1 sont écrits en français dans un fichier texte
versionné, injecté en préfixe du prompt de notation (avec `cache_control`, les
critères étant identiques d'une offre à l'autre).

1. Ces critères **ne sont pas exprimables en booléens**. « Le sujet doit être
   l'IA » est une nuance de degré ; un `if "développeur" in titre` écarterait de
   bonnes offres et en laisserait passer de mauvaises. Lire une description
   complète et juger, c'est la seule vraie plus-value du modèle ici.
2. Les critères vont bouger après quelques semaines d'usage. Un fichier texte se
   corrige en trente secondes ; du code de filtrage se re-teste.
3. Argument d'entretien : « les critères métier sont des données, pas du code ».

### Aucun filtre par mots-clés sur le titre de l'offre

Les intitulés France Travail sont bruités : une offre pertinente peut s'appeler
« Ingénieur études et développement (H/F) » avec la partie IA enterrée dans la
description. Un filtre serré sur le titre la rate **silencieusement**. La requête
API reste donc large mais bornée (mots-clés + zone géographique), et le tri est
fait par le modèle.

---

## 3. Architecture retenue

```
GitHub Actions (cron quotidien)  →  pipeline Python  →  Supabase (Postgres)
                                                              ↑
                                    Vercel + Next.js + shadcn/ui (lecture serveur)
```

| Brique | Choix | Raison |
|---|---|---|
| Base de données | **Supabase** (Postgres hébergé) | Une interface hébergée ne peut pas lire un SQLite posé sur le Mac de Maxime |
| Interface | **Next.js + shadcn/ui sur Vercel** | Décidé pour l'apprentissage (intégrer un agent dans une interface) et pour la vitrine d'entretien |
| Pipeline | **Python**, déclenché par **GitHub Actions** | Vercel est un environnement JavaScript ; le cron GitHub est gratuit sur dépôt public, gère les secrets, et le workflow se voit dans le dépôt |

### Notation : deux réglages dictés par l'usage, pas par principe

Ces deux choix d'implémentation de l'étape de notation découlent de la nature de
ce projet précis. Les paramètres généraux de l'API Messages relèvent de la
référence `/claude-api`, pas d'ici.

- **Mise en cache du prompt (`cache_control`)** : les critères de pertinence sont
  rigoureusement identiques d'une offre à l'autre. Les placer en préfixe stable
  et les marquer divise leur coût par dix sur les appels suivants du même lot.
- **API Batches** : la veille est quotidienne et non urgente. Rien n'exige une
  réponse dans la seconde, et un traitement par lot coûte moitié moins cher qu'un
  appel par offre.

### L'enrichissement par agent est découplé de l'interface

Une fonction serverless Vercel a une durée maximale de l'ordre de la minute
(limite non revérifiée récemment — elle change souvent). Un agent qui explore le
site d'une entreprise dépasse facilement. Plutôt que de contourner la limite, on
l'évite :

1. Le clic sur « enrichir » fait écrire au serveur Next.js une ligne « à traiter »
   dans Supabase, et rend la main **immédiatement**.
2. Le processus Python voit la demande, lance l'agent, et écrit chaque étape dans
   une table au fur et à mesure.
3. L'interface s'abonne à cette table via **Supabase Realtime** et affiche les
   étapes au fil de l'eau.

Résultat visuel identique au streaming direct — on voit l'agent travailler — sans
qu'aucune connexion doive tenir deux minutes. C'est un découplage
producteur/consommateur, plus solide et plus démontrable que le réflexe du
streaming synchrone.

### Le navigateur ne parle jamais directement à Supabase

Tout accès aux données passe par le serveur Next.js. Voir section 4.

Nuance connue : Supabase Realtime écoute normalement depuis le navigateur avec
la clé publique, ce qui suppose une politique de lecture sur la table concernée.
Le choix — ouvrir cette seule table en lecture (elle ne contient que des lignes
du type « je lis le site de X ») ou faire passer le flux par une route serveur —
se tranchera à la construction.

---

## 4. Sécurité — règles dures ajoutées par cette session

Elles complètent la section « Sécurité » du `CLAUDE.md`, elles ne la remplacent
pas.

**1. Les deux clés Supabase n'ont rien à voir.**

- La clé **anon** est conçue pour être publique : elle part dans le navigateur et
  est visible dans le code source de la page. C'est normal.
- La clé **service_role** contourne *toutes* les règles de sécurité de la base et
  donne un accès total en lecture et en écriture. Dans une variable
  `NEXT_PUBLIC_...`, dans un composant client, ou commitée sur ce dépôt public,
  elle permet à n'importe qui de lire et d'effacer la base entière. Des robots
  scannent GitHub pour ces clés en continu.

La `service_role` vit dans les variables d'environnement de Vercel et dans le
`.env` local. Nulle part ailleurs.

**2. RLS activé sur toutes les tables, aucune politique publique.** Le réflexe,
quand une requête échoue, est de désactiver la Row Level Security. À cet instant
la table devient lisible par quiconque possède la clé anon — qui est publique par
construction. Le projet n'a qu'un seul utilisateur : aucun besoin d'autorisation
fine, tout passe par le serveur avec la `service_role`.

**3. Aucun déclenchement d'agent accessible publiquement sans garde-fou.** Un
bouton en ligne qui lance un agent Claude sans protection est une facture
ouverte : n'importe qui, y compris un robot qui scanne les URL, peut l'actionner
en boucle aux frais de Maxime. À trancher avant la mise en ligne, pas après la
première facture. Trois sorties possibles : authentification, plafond d'appels
par visiteur, ou agent déclenché uniquement côté pipeline.

**4. Le rapport de PFE ne rentre pas dans ce dépôt.** Un rapport de fin d'études
en cabinet de conseil contient des noms de clients, des chiffres de mission et
des méthodes internes, souvent sous clause de confidentialité. Le dépôt est
public, et un fichier poussé reste dans l'historique Git même après suppression.
Seul un **résumé de compétences assumé public**, sans nom de client ni chiffre de
mission, alimente le prompt de notation.

---

## 5. Faits techniques établis en session

Ils sont consignés à leur place, dans `docs/API_FRANCE_TRAVAIL.md` : le plafond
de ~1150 offres par recherche n'est pas un problème en régime quotidien, et
l'expérience exigée serait disponible dans un champ structuré — à confirmer.

---

## 6. Ce qui reste ouvert

| Question | Où ça se tranche |
|---|---|
| Enrichissement nocturne automatique, bouton manuel dans l'interface, ou les deux — et dans quel ordre | `/planifie` |
| Développement en local d'abord puis bascule vers Supabase, ou Supabase dès le premier jour | `/planifie` |
| Ce que contient exactement une fiche d'offre à l'écran | `/cadre` |
| Heure de la veille, fréquence, comportement un jour sans offre | `/cadre` |
| Si l'interface est publique : comment éviter qu'un recruteur lise la note d'accessibilité de sa propre entreprise — mot de passe, masquage des noms, ou démo à données fictives | À revoir avec Maxime, point non tranché |
| Modèle utilisé pour la notation en volume | Non tranché. Arbitrage de Maxime, à poser dans la conversation avant d'écrire l'étape de notation |
| Serveur MCP maison pour exposer France Travail à l'agent | Après les trois étapes de base, comme prévu au `CLAUDE.md` |

**Recommandation en attente sur la première ligne** : construire l'enrichissement
nocturne automatique d'abord, le bouton manuel ensuite en réutilisant le même
code d'agent. Le bouton sans l'automatique donne une démo mais aucune veille ;
l'automatique sans le bouton donne une veille complète sans la démo. Dans cet
ordre, le bouton devient une phase courte posée sur du code déjà testé.
