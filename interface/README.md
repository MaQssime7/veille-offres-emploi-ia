# interface — le site

L'interface web du projet **Veille offres emploi IA**. Next.js 16 + shadcn/ui,
hébergée sur Vercel. Vue d'ensemble du projet : [`../README.md`](../README.md).

Elle ne calcule rien : le pipeline Python écrit dans Supabase pendant la nuit,
l'interface y lit. Les deux ne se parlent jamais directement.

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # vérifie les types — à passer avant tout déploiement
```

## Où se trouve quoi

| Chemin | Contenu |
|---|---|
| `app/` | Les pages **et** le code serveur — le chemin du fichier est l'adresse |
| `app/globals.css` | **La source de vérité des jetons de couleur.** Jamais de couleur en dur ailleurs |
| `components/ui/` | Les composants shadcn, moteur `radix` |
| `lib/utils.ts` | `cn()`, la fusion de classes Tailwind |

## La frontière serveur / navigateur

**Tout fichier de `app/` s'exécute sur le serveur par défaut.** La directive
`"use client"` en première ligne l'envoie dans le navigateur de l'utilisateur —
c'est nécessaire dès qu'il y a un état, un événement ou une API du navigateur.

⚠️ **C'est le point où les secrets fuient.** Une clé placée dans un fichier
`"use client"` part dans le code source de la page, lisible par n'importe qui,
**sans aucun message d'erreur**. Le préfixe `NEXT_PUBLIC_` fait la même chose
délibérément : il est **interdit sur ce projet**. L'interface lit Supabase
uniquement côté serveur, avec une clé qui ne quitte jamais Vercel.

## Design

Le système est fixé dans [`../docs/DESIGN.md`](../docs/DESIGN.md) et opposable.

- **Trois polices, trois rôles** : Fraunces 700 en titrage (jamais sous 20 px),
  Geist en texte et interface, Geist Mono pour les données et les libellés.
- **Icônes : lucide uniquement.** Le jeu est figé depuis l'installation —
  `shadcn apply --only` accepte `theme` et `font`, jamais `icon`.
- **Aucune ombre.** shadcn en pose par défaut sur `Card`, `Popover` et les
  menus : les retirer. La hiérarchie repose sur la typographie et les filets.
- **Toujours les jetons sémantiques** (`bg-primary`, `text-muted-foreground`),
  jamais une couleur en dur.
- **Le libellé devant chaque barre de note ne se retire jamais**, et il s'écrit **en toutes lettres** — « Intérêt », « Accessibilité » (les abréviations `INT` / `ACC` sont abandonnées depuis le 26 août 2026) :
  sans lui, l'information ne tiendrait que sur la couleur.

## Déploiement

⚠️ **Vercel doit être réglé sur `Root Directory = interface`.** Sans ce réglage,
il cherche un `package.json` à la racine du dépôt, n'en trouve pas, et échoue.
