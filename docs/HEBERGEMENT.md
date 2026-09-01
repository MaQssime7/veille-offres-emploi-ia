# Hébergement — Vercel, Supabase, GitHub Actions

Tout ce qui concerne la mise en ligne et l'outillage d'infrastructure. Sorti du
`CLAUDE.md` le 26 août 2026 : c'est de la **procédure**, pas une règle qui change
mon comportement sur n'importe quelle tâche.

**Ce qui reste dans le `CLAUDE.md`** : les règles opposables — les 6 variables et
pas une de plus, `interface/.env.local` détient l'unique copie, un aperçu parle à
la vraie base. Le *comment faire* est ici.

---

## Vercel

Projet : https://veille-offres-emploi-ia.vercel.app · `Root Directory = interface`
· fonctions en région Paris. Le CLI est lié depuis `interface/` (`.vercel/`, ignoré
par git).

### Les cinq variables, et pas une de plus

`SUPABASE_URL` · `SUPABASE_SECRET_KEY` · `MOT_DE_PASSE_SITE` · `SECRET_SESSION` ·
**`JETON_GITHUB`**, toutes marquées *Sensitive*, sur **Production et Preview**.

`ANTHROPIC_API_KEY`, `FT_CLIENT_ID` et `FT_CLIENT_SECRET` y avaient été posées le
17 août et **retirées le 21** : le pipeline Python tourne chez GitHub Actions,
aucune ligne du site ne les lit, et les garder offrait la clé Anthropic — qui est
facturée — à qui entrerait dans le compte Vercel.

#### ⚠️ `JETON_GITHUB` — ajoutée le 30 août 2026, POSÉE chez Vercel le 31 au soir

✅ **État au 31 août 2026** : posée en **Production**, marquée *Sensitive*, et le
site redéployé — une variable ne s'applique qu'aux déploiements suivants (piège 1
ci-dessous). Jeton vérifié avant la pose : valide, voit le dépôt, voit
`enrichissement.yml`. **Expiration : 19 janvier 2027.**

⚠️ **PAS posée en Preview, contrairement à ce que la commande ci-dessous
prescrit.** Conséquence : sur un déploiement d'aperçu, « Enrichir » répondra
« jeton non configuré » ; rien d'autre ne casse. **Décision à trancher**, et
l'argument n'est pas seulement l'hygiène des secrets : un aperçu Vercel parle à
la **même base** que la production, donc un enrichissement lancé depuis un aperçu
consommerait l'enveloppe réelle et serait facturé pour de vrai. L'absence du
jeton en Preview ferme cette porte.

C'est elle qui permet à l'interface de lancer le workflow `enrichissement.yml` au
clic sur « Enrichir » (`interface/lib/github.ts`). **Sans elle, le bouton répond
« Le jeton GitHub n'est pas configuré » et rien d'autre ne casse** — le reste du
site fonctionne normalement, ce qui rend l'oubli d'autant plus facile.

**Portée exigée, et elle n'est pas négociable :**

| | |
|---|---|
| Type | **Fine-grained personal access token**, jamais un jeton classique |
| Dépôt | **`MaQssime7/veille-offres-emploi-ia` uniquement** — « Only select repositories » |
| Permission | **`Actions` : Read and write**, et rien d'autre |
| Expiration | à choisir ; **la noter quelque part**, voir le piège ci-dessous |

Un jeton classique donnerait, à qui le récupérerait, le droit de **pousser du
code** sur un dépôt public qui sert de pièce à conviction en entretien. Et même
restreint, s'il fuitait, il permettrait de lancer en boucle le workflow qui
détient la clé Anthropic — donc de faire monter une facture.

⚠️ **Son expiration est une panne parfaitement silencieuse.** Le site marche, la
veille tourne, les écrans s'affichent : seul « Enrichir » cesse d'agir. C'est
pourquoi `lib/github.ts` distingue le 401 du reste et affiche « GitHub a refusé
le jeton : il est expiré, révoqué, ou n'a plus le droit de lancer ce workflow »
plutôt qu'un « réessayez plus tard » qui ferait chercher au mauvais endroit.

⚠️ **GitHub répond `404`, et non `403`, quand un jeton à portée fine n'a pas
accès au dépôt** — exprès, pour ne pas révéler l'existence des dépôts privés. Un
404 sur ce chemin ne veut donc pas dire « le workflow n'existe pas » mais, le
plus souvent, « le jeton n'a pas ce dépôt dans sa portée ».

```bash
# Poser la variable sans jamais la faire passer par la conversation :
# la copier dans le presse-papiers, puis la coller à l'invite du CLI.
cd interface && npx vercel@59.3.0 env add JETON_GITHUB production
cd interface && npx vercel@59.3.0 env add JETON_GITHUB preview
```

⚠️ **En local, elle vit dans `interface/.env.local`**, comme les deux secrets du
site — jamais dans le `.env` de la racine, qui est celui du pipeline Python.

### ⚠️ Quatre pièges, tous rencontrés en vrai

**1. Poser une variable ne suffit pas : il faut redéployer.** Elles ne s'appliquent
qu'aux déploiements *suivants*, jamais à celui déjà en ligne.

```bash
npx vercel@59.3.0 redeploy <url-du-dernier-déploiement>   # sans --yes : l'option n'existe pas ici
```

**2. Un code non poussé n'est pas en ligne, même si les variables y sont.** Le
21 août, les 3 commits portant la porte étaient restés en local pendant que les
variables étaient posées : le site public répondait 200 sur `/`, sans mot de passe,
et `/connexion` renvoyait 404. **Vérifier `git log origin/main..main`**, pas
seulement le tableau de bord de l'hébergeur.

**3. Une variable listée n'est pas une variable qui marche.** Le 21 août,
`SUPABASE_URL` et `SUPABASE_SECRET_KEY` apparaissaient dans `vercel env ls` depuis
quatre jours — posées à la main dans l'interface — et le site répondait pourtant
« Variable d'environnement absente ». Les reposer depuis `interface/.env.local` via
le CLI a tout réglé.

**4. La colonne « created » ne bouge pas quand `--force` écrase une valeur.** Elle
affichait encore « 5d ago » juste après une rotation. Comme *Sensitive* interdit de
relire la valeur (`vercel env pull` rend `[REDACTED]`), **la liste ne prouve jamais
rien** : le seul test valable est de se connecter au site déployé.

### Poser ou remplacer un secret

Valeur lue sur **l'entrée standard**, jamais via `--value` qui l'exposerait dans la
liste des processus de la machine :

```bash
cd interface
for CIBLE in production preview; do
  grep '^NOM=' .env.local | cut -d= -f2- | tr -d '\r\n' \
    | npx vercel@59.3.0 env add NOM "$CIBLE" --sensitive --force --yes
done
npx vercel@59.3.0 redeploy <url-du-dernier-déploiement>
```

⚠️ **Puis se connecter au site en ligne.** C'est la seule preuve.

### Tester la porte après une rotation

**La porte ne se teste pas en `curl`.** Le formulaire est un composant client :
Next n'émet aucun champ caché `$ACTION_ID_`, l'action s'invoque par un en-tête
`Next-Action` dont le corps suit un format React interne. Deux tentatives ont rendu
des HTTP 500 qui ne prouvaient rien — ni que le mot de passe était bon, ni qu'il
était mauvais.

Passer par un vrai navigateur, avec un script Playwright lancé **hors du dépôt** qui
**lit la valeur dans le fichier** : la taper dans un navigateur piloté la ferait
entrer dans la conversation, c'est-à-dire recréer la fuite qu'on répare.

---

## Migrations Supabase

**Le CLI passe par `npx`, pas par Homebrew** — les Command Line Tools de la machine
datent de 2023 et Homebrew refuse de compiler. `npx` évite la mise à jour et épingle
la version dans le dépôt.

```bash
set -a; source .env; set +a          # charge SUPABASE_DB_PASSWORD et le reste
npx supabase@2.115.0 migration new <nom_en_francais>
npx supabase@2.115.0 db push --yes   # applique ce qui n'est pas encore appliqué
npx supabase@2.115.0 migration list  # ce qui est local vs ce qui est en base
```

⚠️ **Ne jamais passer le mot de passe en argument** (`--password …`) : il devient
visible dans la liste des processus. Le CLI lit `SUPABASE_DB_PASSWORD` depuis
l'environnement.

⚠️ **Sans `set -a; source .env`, la commande attend une saisie qui n'arrivera
jamais** et reste bloquée jusqu'au délai d'expiration.

### Valider une migration avant de la pousser

Avec le vrai analyseur de PostgreSQL :

```bash
.venv/bin/python -c "from pglast import parse_sql; import pathlib; \
  print(len(parse_sql(pathlib.Path('supabase/migrations/<fichier>.sql').read_text())), 'instructions')"
```

⚠️ **Syntaxe valide ne veut pas dire « ça marche ».** Le 20 août, une migration
syntaxiquement irréprochable a créé deux tables que le serveur ne pouvait pas lire.
**Après chaque migration : tenter de lire, d'écrire, et de violer chaque
contrainte.**

### Les clés Supabase

**Deux clés, deux rôles opposés.** La clé **publiable** (`sb_publishable_…`) est
publique par conception — **inutilisée ici**, le navigateur ne parlant jamais à la
base. La clé **secrète** (`sb_secret_…`, variable `SUPABASE_SECRET_KEY`) contourne
*toutes* les règles de sécurité.

⚠️ Les anciennes clés `anon` / `service_role` sont l'ancienne génération, **dépréciée
fin 2026**. Elles restent actives tant qu'on ne les désactive pas explicitement :
quatre accès valides pour deux utilisés. **À désactiver dans `Settings > API Keys`**
— toujours en attente au 26 août 2026.

---

## GitHub Actions

Workflow : `.github/workflows/collecte-nocturne.yml`. Quatre secrets posés
(`FT_CLIENT_ID`, `FT_CLIENT_SECRET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`), poussés
par un tube depuis le `.env` — jamais en argument de commande.

```bash
for NOM in FT_CLIENT_ID FT_CLIENT_SECRET SUPABASE_URL SUPABASE_SECRET_KEY; do
  grep "^${NOM}=" .env | head -1 | cut -d= -f2- | tr -d '\r\n' | gh secret set "$NOM"
done
gh workflow run collecte-nocturne.yml --ref main             # déclenchement manuel
gh workflow run collecte-nocturne.yml --ref main -f depuis_jours=7   # rattrapage
gh run list --workflow=collecte-nocturne.yml --limit 3
```

⚠️ **Les journaux d'un dépôt public sont publics.** Les secrets y apparaissent en
`***`, mais toute trace ajoutée au pipeline doit tenir la règle : ni donnée
personnelle, ni corps de réponse. `_erreur_assainie()` dans `pipeline/stockage.py`
existe pour ça — elle retire `details` et `hint` des erreurs PostgREST, qui portent
la ligne refusée donc potentiellement `contact_nom`.

⚠️ **GitHub désactive les crons d'un dépôt public resté 60 jours sans activité.**
Si le projet dort un été, la veille s'arrête en silence.

⚠️ **Ne jamais ajouter de workflow qui exécute du code venant d'une proposition de
fusion extérieure** (`pull_request_target`) : c'est le seul mécanisme qui exposerait
les secrets sur un dépôt public.
