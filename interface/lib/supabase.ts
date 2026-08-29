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

/**
 * Une seule reprise, et seulement sur une panne réseau.
 *
 * ⚠️ **Ce n'est pas une protection contre un bug, c'est l'admission qu'il n'y en
 * a pas.** Enquête du 28 août 2026 : une requête a échoué en `TypeError` sur
 * ~430 rendus — 0,2 %. Cinq scénarios de reproduction (concurrence, connexions
 * refroidies, coupure client, recompilation, rafales) et 232 rendus
 * instrumentés n'ont jamais rejoué le cas. Un aléa réseau isolé vers un service
 * distant n'est pas un défaut de code : il n'y a rien à empêcher, seulement
 * quelque chose à rattraper.
 *
 * Ce qu'il coûtait sans reprise : les trois requêtes de `/offres` partent
 * ensemble, et celle qui lit `executions_veille` porte le marqueur
 * « Nouveau ». Une coupure de vingt millisecondes le faisait disparaître de
 * **toute la page**, en silence, jusqu'au prochain rechargement.
 *
 * ⚠️ **On ne reprend JAMAIS sur un dépassement de délai**, et c'est le point le
 * moins évident. Une reprise après 8 s d'attente en ferait 16 : au-delà du
 * plafond d'exécution d'une fonction Vercel, l'utilisateur récolterait une
 * erreur de plateforme illisible au lieu de notre écran « base injoignable ».
 * Mesuré pendant l'enquête : sous rafale de douze rendus simultanés, six
 * requêtes ont réellement dépassé les 8 s. Le cas n'est pas théorique.
 *
 * ⚠️ **On ne reprend pas non plus sur une réponse HTTP en erreur** : une clé
 * refusée le restera, et une contrainte violée aussi. Rejouer ne ferait que
 * doubler la facture d'une erreur certaine.
 */
const REPRISES = 1;

/**
 * Le temps laissé avant de réessayer.
 *
 * Assez pour que Node ouvre une connexion neuve plutôt que de réutiliser celle
 * qui vient de casser ; négligeable devant les ~1,5 s que prend déjà le rendu
 * de la liste.
 */
const PAUSE_REPRISE_MS = 150;

const patienter = (ms: number) =>
  new Promise<void>((resoudre) => setTimeout(resoudre, ms));

/**
 * Décrit une panne réseau en une ligne lisible dans un journal.
 *
 * ⚠️ **`erreur.name` ne suffit pas, et c'est ce qui a coûté une enquête
 * entière.** Chez Node, `TypeError: fetch failed` n'est pas une cause : c'est
 * l'enveloppe de **toute** panne réseau — connexion coupée, nom introuvable,
 * port fermé. La cause réelle est rangée dans `erreur.cause.code`
 * (`ECONNRESET`, `ENOTFOUND`, `EAI_AGAIN`…). Sans elle, le journal dit
 * « TypeError » et n'oriente vers rien.
 *
 * La durée écoulée est jointe parce qu'elle sépare d'un coup d'œil deux pannes
 * qui n'ont rien à voir : une rupture de connexion tombe en quelques
 * millisecondes, un dépassement de délai à 8 000.
 *
 * ⚠️ **Rien d'autre n'entre ici.** Ni en-têtes — ils portent la clé secrète —
 * ni URL complète.
 */
function decrireEchec(erreur: unknown, dureeMs: number): string {
  const e = erreur as {
    name?: string;
    cause?: { code?: string };
  };
  const code = e?.cause?.code;
  return `${e?.name ?? "inconnue"}${code ? ` (${code})` : ""} après ${dureeMs} ms`;
}

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
  //
  // ⚠️ **Le séparateur dépend du chemin, il n'est pas toujours `&`.** Tous les
  // appelants d'aujourd'hui passent un chemin qui contient déjà un `?`, mais
  // `options.egal` est une porte ouverte : le premier qui écrira
  // `interrogerBase("offres", { egal: … })` produirait
  // `…/rest/v1/offres&identifiant=eq.X`, que PostgREST lit comme un **nom de
  // table**, pas comme un filtre. Résultat : la table entière rendue au lieu
  // d'une ligne, sans la moindre erreur pour le signaler.
  const filtres = Object.entries(options.egal ?? {})
    .map(([colonne, valeur], rang) => {
      const separateur = rang === 0 && !chemin.includes("?") ? "?" : "&";
      return `${separateur}${colonne}=eq.${encodeURIComponent(valeur)}`;
    })
    .join("");

  // ⚠️ **`chemin` est sûr à journaliser par construction** : il ne porte que des
  // constantes du code. Les valeurs venues de l'extérieur passent par
  // `options.egal`, qui les encode et les concatène ici, hors du journal.
  const table = chemin.split("?")[0];

  let reponse: Response | undefined;

  for (let tentative = 0; tentative <= REPRISES; tentative += 1) {
    const debut = Date.now();
    try {
      reponse = await fetch(`${configuration.url}/rest/v1/${chemin}${filtres}`, {
        headers: enTetes,
        signal: AbortSignal.timeout(DELAI_MS),
        // Les offres changent une fois par nuit, mais la page est derrière un
        // mot de passe : rien ici ne doit atterrir dans un cache partagé.
        cache: "no-store",
      });
      break;
    } catch (erreur) {
      const description = decrireEchec(erreur, Date.now() - debut);
      const parDelaiDepasse = (erreur as { name?: string })?.name === "TimeoutError";

      // Une panne transitoire mérite un second essai ; un délai dépassé, non.
      if (tentative < REPRISES && !parDelaiDepasse) {
        // ⚠️ `warn` et non `error` : la requête n'a pas encore échoué. Mais la
        // ligne est écrite quand même — une reprise silencieuse masquerait une
        // panne qui deviendrait quotidienne sans que personne ne le voie.
        console.warn(`[base] ${description} sur ${table} — seconde tentative`);
        await patienter(PAUSE_REPRISE_MS);
        continue;
      }

      console.error(`[base] requête impossible — ${description} sur ${chemin}`);
      return {
        ok: false,
        motif: "injoignable",
        explication: "La base n'a pas répondu.",
      };
    }
  }

  // La boucle sort soit par `break` avec une réponse, soit par `return`.
  // TypeScript ne le déduit pas seul ; ce garde-fou ne se déclenche jamais.
  if (!reponse) {
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

/**
 * Ce que rend une écriture. Volontairement plus pauvre qu'une lecture : on ne
 * redemande pas les lignes modifiées.
 *
 * ⚠️ **`introuvable` n'est PAS une panne, et c'est pour ça qu'il est un motif à
 * part.** PostgREST répond `204` que le filtre ait touché une ligne ou zéro —
 * un `PATCH` sur un identifiant inexistant « réussit » sans rien écrire. Sans
 * ce motif, l'écran afficherait « enregistré » pour une offre qui n'existe pas.
 * On le distingue en demandant le compte des lignes touchées.
 */
export type ResultatEcriture =
  | { ok: true }
  | { ok: false; motif: MotifEchec | "introuvable" | "refusee"; explication: string };

/**
 * Écrire dans la base — un `PATCH` PostgREST sur des lignes désignées.
 *
 * Entre : le nom d'une table (constante du code), les valeurs à poser, et le
 * filtre qui désigne les lignes.
 * Sort : `{ ok: true }`, ou un motif d'échec que l'appelant est obligé de
 * regarder.
 * Casse : ne lève jamais. Réseau coupé, délai dépassé, contrainte violée,
 * identifiant inexistant — tout revient en `{ ok: false }`.
 *
 * ⚠️ **C'est la PREMIÈRE écriture de l'interface dans ce projet.** Tout ce qui
 * précède était écrit par `pipeline/stockage.py`, seul et de nuit. Trois
 * différences avec `interrogerBase`, et aucune n'est cosmétique :
 *
 * 1. **`table` ne peut porter aucune valeur extérieure.** Là où `interrogerBase`
 *    reçoit un chemin déjà construit, on n'accepte ici qu'un nom de table nu :
 *    tout le reste de l'adresse est fabriqué ici. Une écriture dont l'appelant
 *    contrôlerait le chemin pourrait viser d'autres lignes que les siennes.
 * 2. **`valeurs` part dans le CORPS, pas dans l'adresse.** C'est du JSON
 *    sérialisé : ni encodage à faire, ni paramètre à dupliquer, ni ordre de
 *    lecture PostgREST dont dépendrait la sécurité. Les **noms** de colonnes
 *    viennent du code de l'appelant ; leurs **valeurs** peuvent venir de
 *    l'extérieur sans danger.
 * 3. **`egal` est obligatoire et non vide.** Un `PATCH` sans filtre réécrit
 *    **toute la table** — PostgREST l'accepte sans broncher. Les 567 offres
 *    passeraient candidatées d'un coup, sans erreur et sans retour arrière.
 *    C'est le garde-fou le plus important de cette fonction.
 *
 * ⚠️ **La reprise réseau est sûre ICI parce que l'opération est idempotente.**
 * On pose des valeurs absolues (`statut = 'candidate'`), jamais un incrément :
 * rejouer la requête après un aléa réseau donne exactement le même état final.
 * ⚠️ **Cette propriété n'est pas une propriété de la fonction, c'est une
 * propriété de ce que l'appelant écrit.** Le jour où quelqu'un voudra
 * incrémenter un compteur par ce chemin, la reprise le comptera deux fois — et
 * rien ici ne l'en avertira.
 */
export async function ecrireDansBase(
  table: string,
  {
    valeurs,
    egal,
  }: {
    valeurs: Record<string, string | number | boolean | null>;
    egal: Record<string, string>;
  },
): Promise<ResultatEcriture> {
  // ⚠️ Le garde-fou du point 3. Un objet vide est une erreur de programmation,
  // pas une panne — mais il coûterait 567 lignes réécrites, donc il se refuse
  // ici plutôt que de se documenter ailleurs.
  const colonnesFiltre = Object.keys(egal);
  if (colonnesFiltre.length === 0) {
    console.error(`[base] écriture refusée sur ${table} — aucun filtre`);
    return {
      ok: false,
      motif: "refusee",
      explication: "Une écriture sans filtre réécrirait toute la table.",
    };
  }

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

  // Même construction que pour la lecture : l'opérateur `eq.` est écrit ici, le
  // nom de colonne vient du code, seule la valeur est étrangère — et c'est elle
  // qu'on encode.
  const filtres = colonnesFiltre
    .map((colonne, rang) => {
      const separateur = rang === 0 ? "?" : "&";
      return `${separateur}${colonne}=eq.${encodeURIComponent(egal[colonne])}`;
    })
    .join("");

  const enTetes: Record<string, string> = {
    apikey: configuration.cle,
    Authorization: `Bearer ${configuration.cle}`,
    "Content-Type": "application/json",
    // ⚠️ **`count=exact` est ce qui rend `introuvable` détectable.** Sans lui,
    // PostgREST répond `204` sans dire combien de lignes il a touchées, et une
    // écriture sur un identifiant inexistant serait indiscernable d'un succès.
    // `return=minimal` évite qu'il nous renvoie les lignes modifiées — dont
    // `charge_brute`, que personne ne veut voir remonter ici.
    Prefer: "return=minimal,count=exact",
  };

  const corps = JSON.stringify(valeurs);
  let reponse: Response | undefined;

  for (let tentative = 0; tentative <= REPRISES; tentative += 1) {
    const debut = Date.now();
    try {
      reponse = await fetch(`${configuration.url}/rest/v1/${table}${filtres}`, {
        method: "PATCH",
        headers: enTetes,
        body: corps,
        signal: AbortSignal.timeout(DELAI_MS),
        cache: "no-store",
      });
      break;
    } catch (erreur) {
      const description = decrireEchec(erreur, Date.now() - debut);
      const parDelaiDepasse = (erreur as { name?: string })?.name === "TimeoutError";

      if (tentative < REPRISES && !parDelaiDepasse) {
        console.warn(`[base] ${description} sur ${table} (écriture) — seconde tentative`);
        await patienter(PAUSE_REPRISE_MS);
        continue;
      }

      // ⚠️ **Le journal ne porte QUE le nom de la table.** Ni le filtre, ni le
      // corps : `valeurs` contiendra la note personnelle de Maxime dès l'étape
      // suivante, et les journaux d'un hébergeur ne sont pas un endroit où une
      // donnée personnelle a le droit d'être.
      console.error(`[base] écriture impossible — ${description} sur ${table}`);
      return {
        ok: false,
        motif: "injoignable",
        explication: "La base n'a pas répondu.",
      };
    }
  }

  if (!reponse) {
    return {
      ok: false,
      motif: "injoignable",
      explication: "La base n'a pas répondu.",
    };
  }

  if (!reponse.ok) {
    const detail = assainir(await reponse.text().catch(() => ""));
    console.error(`[base] HTTP ${reponse.status} sur ${table} (écriture) — ${detail}`);

    // ⚠️ **Un 400 est une contrainte violée, pas une base en panne.** Postgres
    // a répondu, vite et correctement : c'est notre requête qui était fausse.
    // Les confondre ferait afficher « base injoignable » alors que la base va
    // parfaitement bien — exactement le contresens que `PGRST303` produit déjà
    // en développement.
    if (reponse.status === 400 || reponse.status === 409) {
      return {
        ok: false,
        motif: "refusee",
        explication: "La base a refusé cette valeur.",
      };
    }

    return {
      ok: false,
      motif: "injoignable",
      explication: `La base a répondu ${reponse.status}.`,
    };
  }

  // `content-range` vaut `0-0/1` quand une ligne a été touchée, `*/0` sinon.
  const touchees = totalDepuisEntete(reponse.headers.get("content-range"));
  if (touchees === 0) {
    return {
      ok: false,
      motif: "introuvable",
      explication: "Aucune ligne ne correspond.",
    };
  }

  return { ok: true };
}
