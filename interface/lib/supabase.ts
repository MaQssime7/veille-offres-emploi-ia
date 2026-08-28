import "server-only";

/**
 * Le lien vers la base, côté serveur uniquement.
 *
 * ⚠️ `import "server-only"` en première ligne n'est pas décoratif : ce module
 * lit la clé secrète de Supabase, celle qui contourne *toutes* les règles de
 * sécurité de la base. Sans cette ligne, un composant client pourrait l'importer
 * par inadvertance et la clé partirait dans le code source de la page.
 *
 * On passe par l'**API REST** (PostgREST) en HTTP, exactement comme
 * `pipeline/stockage.py`. Pas de bibliothèque Supabase : la lecture tient en une
 * requête `GET`, et un client de plus dans le paquet serveur n'apporterait ici
 * qu'une couche à maintenir.
 *
 * Ce module ne lève jamais d'exception sur une panne de base. Il renvoie un
 * résultat explicite, que l'appelant est obligé de regarder — c'est ce qui rend
 * l'état « base injoignable » affichable au lieu de produire une page blanche.
 */

/**
 * Pourquoi la lecture a échoué. Deux motifs seulement, parce que l'écran n'a
 * que deux choses à dire :
 *
 * - `configuration` : les variables d'environnement manquent. C'est réparable
 *   par Maxime, et lui seul voit ce site — le message peut donc nommer la
 *   variable absente (jamais sa valeur).
 * - `injoignable` : la base n'a pas répondu, ou a répondu autre chose qu'un
 *   succès. Le détail part au journal du serveur, jamais à l'écran.
 */
export type MotifEchec = "configuration" | "injoignable";

export type ResultatBase<T> =
  | { ok: true; lignes: T[]; total: number | null }
  | { ok: false; motif: MotifEchec; explication: string };

/**
 * Au-delà, on renonce.
 *
 * Sans délai, une base injoignable ferait patienter la page jusqu'à ce que
 * l'hébergeur coupe la fonction — l'utilisateur verrait une erreur de
 * plateforme illisible au lieu de notre écran « base injoignable ». Huit
 * secondes laissent la marge d'une requête lente tout en restant sous le
 * plafond d'exécution de Vercel.
 */
const DELAI_MS = 8000;

class ConfigurationBaseManquante extends Error {}

/** Les deux valeurs sans lesquelles il n'y a rien à interroger. */
function lireConfiguration(): { url: string; cle: string } {
  const url = process.env.SUPABASE_URL;
  const cle = process.env.SUPABASE_SECRET_KEY;

  if (!url) {
    throw new ConfigurationBaseManquante("SUPABASE_URL");
  }
  if (!cle) {
    throw new ConfigurationBaseManquante("SUPABASE_SECRET_KEY");
  }

  return { url: url.replace(/\/+$/, ""), cle };
}

/**
 * Ce qu'on accepte de recopier dans le journal du serveur : le **code** et le
 * **message court** d'une erreur PostgREST, et rien d'autre.
 *
 * ⚠️ Même règle que `_erreur_assainie` dans `pipeline/stockage.py`, et pour la
 * même raison exactement : les champs `details` et `hint` de PostgREST
 * contiennent régulièrement **la ligne refusée**, donc potentiellement
 * `contact_nom` — une donnée personnelle. Les journaux de fonctions de Vercel
 * se relisent, se transfèrent et finissent en capture d'écran : on n'y verse
 * jamais le corps complet.
 *
 * Un corps qui n'est pas du JSON PostgREST est tronqué à 200 caractères.
 */
function assainir(texte: string): string {
  try {
    const objet = JSON.parse(texte) as {
      code?: string;
      message?: string;
    };
    if (objet && (objet.code || objet.message)) {
      // `details` et `hint` sont volontairement laissés de côté.
      return [objet.code, objet.message].filter(Boolean).join(" — ");
    }
  } catch {
    // Pas du JSON : on retombe sur la troncature brutale ci-dessous.
  }
  const propre = texte.replace(/\s+/g, " ").trim();
  return propre.length > 200 ? `${propre.slice(0, 200)}…` : propre;
}

/**
 * Le nombre total de lignes, lu dans l'en-tête `Content-Range` que PostgREST
 * renvoie quand on lui demande `count=exact`.
 *
 * Format : `0-24/189`, ou `* /0` sur un ensemble vide. On ne lit jamais ce
 * nombre depuis le corps de la réponse : le corps est tronqué par la limite,
 * l'en-tête ne l'est pas — même piège que la pagination France Travail.
 */
function totalDepuisEntete(contentRange: string | null): number | null {
  if (!contentRange) return null;
  const apresBarre = contentRange.split("/")[1];
  if (!apresBarre || apresBarre === "*") return null;
  const total = Number.parseInt(apresBarre, 10);
  return Number.isFinite(total) ? total : null;
}

/**
 * Interroge une table en lecture seule.
 *
 * Entre : un chemin PostgREST déjà construit (`offres?select=…&order=…`).
 *
 * ⚠️ **`chemin` est recopié tel quel dans l'adresse appelée**, et il ne doit donc
 * jamais porter autre chose que des constantes du code.
 *
 * ✅ **Le moment annoncé est arrivé — phase 3, le 28 août 2026.** Ce commentaire
 * disait « quand une valeur venue de la barre d'adresse entrera ici, le garde-fou
 * se pose à ce point de passage unique ». C'est l'identifiant de `/offres/[identifiant]`
 * qui est arrivé le premier, avant le filtre de statut de la phase 4. Le garde-fou
 * est `options.egal` : **la seule façon d'injecter une valeur extérieure dans une
 * requête**, et ses valeurs passent toutes par `encodeURIComponent`.
 *
 * ⚠️ **Ce que ça empêche — mesuré contre PostgREST le 28 août 2026, et le
 * mécanisme n'est PAS celui qu'on suppose.** Sur un paramètre dupliqué,
 * PostgREST n'applique pas une règle unique : c'est le **premier `select`** qui
 * gagne, mais le **dernier `limit`**. Vérifié sur la base réelle :
 *
 * | Requête envoyée | Ce qui revient |
 * |---|---|
 * | `select=…&identifiant=eq.X&select=*` | 2 colonnes — l'injection ne fait rien |
 * | `identifiant=eq.X&select=*&select=…` | **44 colonnes, `charge_brute` compris** |
 * | `limit=1&limit=5` | 5 lignes |
 * | `identifiant=eq.X%26select%3D%2A` (encodé) | **0 ligne** |
 *
 * Autrement dit : une protection par l'ordre des paramètres **existe**, mais
 * elle tient à l'endroit où l'appelant a écrit son `select` — une propriété
 * qu'aucun appelant ne sait devoir respecter, qui n'est documentée nulle part,
 * et qui ne vaut **déjà plus** pour `limit`. Se reposer dessus, c'est confier sa
 * sécurité à un comportement qu'on n'a pas choisi.
 *
 * **L'encodage, lui, ne dépend de rien** : `eq.X&select=*` devient
 * `eq.X%26select%3D%2A`, c'est-à-dire un identifiant qui n'existe pas. La
 * requête rend zéro ligne, et `charge_brute`, `contact_nom` et
 * `contact_url_postulation` restent en base.
 *
 * ⚠️ **Ce n'est pas la seule protection, et c'est voulu.** `lireOffre()` refuse
 * déjà tout ce qui n'est pas sept caractères alphanumériques, *avant* d'appeler
 * la base. Deux verrous indépendants : celui-ci tient encore le jour où un
 * appelant oubliera de valider.
 *
 * Sort : les lignes, et le total quand on l'a demandé.
 * Casse : renvoie `{ ok: false }` — réseau coupé, délai dépassé, clé refusée,
 * table absente. Ne lève jamais.
 */
export async function interrogerBase<T>(
  chemin: string,
  options: { compter?: boolean; egal?: Record<string, string> } = {},
): Promise<ResultatBase<T>> {
  let configuration;
  try {
    configuration = lireConfiguration();
  } catch (erreur) {
    if (erreur instanceof ConfigurationBaseManquante) {
      return {
        ok: false,
        motif: "configuration",
        explication: `Variable d'environnement absente : ${erreur.message}.`,
      };
    }
    throw erreur;
  }

  const enTetes: Record<string, string> = {
    apikey: configuration.cle,
    Authorization: `Bearer ${configuration.cle}`,
    Accept: "application/json",
  };
  if (options.compter) {
    enTetes.Prefer = "count=exact";
  }

  // Les **noms** de colonnes viennent toujours du code — jamais de l'extérieur —
  // et l'opérateur `eq.` est écrit ici, pas par l'appelant : seule la **valeur**
  // est étrangère, et c'est elle qu'on encode.
  const filtres = Object.entries(options.egal ?? {})
    .map(([colonne, valeur]) => `&${colonne}=eq.${encodeURIComponent(valeur)}`)
    .join("");

  let reponse: Response;
  try {
    reponse = await fetch(`${configuration.url}/rest/v1/${chemin}${filtres}`, {
      headers: enTetes,
      signal: AbortSignal.timeout(DELAI_MS),
      // Les offres changent une fois par nuit, mais la page est derrière un mot
      // de passe : rien ici ne doit atterrir dans un cache partagé.
      cache: "no-store",
    });
  } catch (erreur) {
    const cause = erreur instanceof Error ? erreur.name : "inconnue";
    console.error(`[base] requête impossible (${cause}) sur ${chemin}`);
    return {
      ok: false,
      motif: "injoignable",
      explication: "La base n'a pas répondu.",
    };
  }

  if (!reponse.ok) {
    // Le corps peut contenir le détail de ce que Postgres a refusé : on le
    // tronque, et il ne sort pas du serveur.
    const corps = assainir(await reponse.text().catch(() => ""));
    console.error(`[base] HTTP ${reponse.status} sur ${chemin} — ${corps}`);
    return {
      ok: false,
      motif: "injoignable",
      explication: `La base a répondu ${reponse.status}.`,
    };
  }

  let lignes: T[];
  try {
    lignes = (await reponse.json()) as T[];
  } catch {
    console.error(`[base] réponse illisible sur ${chemin}`);
    return {
      ok: false,
      motif: "injoignable",
      explication: "La base a renvoyé une réponse illisible.",
    };
  }

  return {
    ok: true,
    lignes,
    total: totalDepuisEntete(reponse.headers.get("content-range")),
  };
}
