import "server-only";

/**
 * Lancer le workflow d'enrichissement chez GitHub Actions.
 *
 * ⚠️ **`import "server-only"` en première ligne** : ce module lit un jeton qui
 * autorise à déclencher un workflow détenant la clé Anthropic. Parti dans le
 * navigateur, il offrirait à qui ouvre les outils de développement le droit de
 * lancer des exécutions facturées en boucle.
 *
 * ---------------------------------------------------------------------------
 * Pourquoi un appel d'API et pas un cron
 * ---------------------------------------------------------------------------
 *
 * Un cron GitHub ne descend pas sous cinq minutes, et **ce dépôt a mesuré des
 * retards de 10 h 32 et 12 h 02** sur ses déclenchements planifiés. Montrer
 * l'agent travailler en entretien est un objectif produit explicite : il ne
 * survivrait pas à une attente de dix minutes avant que quoi que ce soit ne
 * bouge.
 *
 * ⚠️ **Ce module ne remplace PAS la rustine `gh workflow run` du matin** — il
 * la rendra inutile, mais seulement le jour où la collecte passera par le même
 * chemin. Ici on ne déclenche que l'enrichissement.
 *
 * ---------------------------------------------------------------------------
 * Le jeton, et la panne parfaitement silencieuse qu'il prépare
 * ---------------------------------------------------------------------------
 *
 * ⚠️ **`JETON_GITHUB` doit être un jeton à portée fine (*fine-grained*), limité
 * à CE dépôt et à la seule permission « Actions : write ».** Un jeton classique
 * donnerait, à qui le récupérerait, le droit de pousser du code sur un dépôt
 * public qui sert de pièce à conviction en entretien.
 *
 * ⚠️ **Il EXPIRE, et son expiration ne ressemble à aucune panne.** Le site
 * marchera, la veille tournera, les écrans s'afficheront : seul le bouton
 * « Enrichir » cessera d'agir. C'est pourquoi l'échec est distingué ici par son
 * code HTTP et remonté en clair à l'écran — 401 dit « le jeton n'est plus
 * valide », pas « réessayez plus tard ».
 */

/**
 * Le dépôt et le workflow visés — constantes du code, jamais des variables.
 *
 * ⚠️ **Une valeur extérieure ne doit JAMAIS entrer dans ce chemin.** Il désigne
 * ce qu'on exécute : un nom de workflow reçu du navigateur permettrait de
 * lancer n'importe quel workflow du dépôt, avec les secrets qu'il détient.
 */
const DEPOT = "MaQssime7/veille-offres-emploi-ia";
const WORKFLOW = "enrichissement.yml";
const BRANCHE = "main";

/**
 * Cinq secondes, et pas les huit accordées à Supabase.
 *
 * Ce lancement se produit pendant que Maxime regarde l'écran après un clic. La
 * demande est déjà écrite en base à ce stade : si GitHub traîne, mieux vaut
 * rendre la main et refermer proprement que faire patienter devant un bouton
 * figé.
 */
const DELAI_MS = 5000;

export type LancementWorkflow =
  | { ok: true }
  | { ok: false; motif: "configuration" | "jeton" | "refus" | "injoignable"; explication: string };

/**
 * Demander à GitHub de lancer le workflow d'enrichissement.
 *
 * Entre : l'identifiant de la tentative, qui sera passé au script Python.
 * Sort : `{ ok: true }` si GitHub a accepté (il répond `204`, sans corps).
 * Casse : ne lève jamais. Jeton absent, jeton expiré, GitHub injoignable :
 * chaque cas revient avec son motif, parce qu'ils n'appellent pas la même
 * réaction — l'un se répare dans Vercel, l'autre en réessayant.
 *
 * ⚠️ **GitHub répondant `204` ne veut PAS dire que l'agent a démarré.** Il a
 * accepté la demande, c'est tout : l'exécution peut encore échouer à
 * l'allocation d'une machine, ou le workflow planter à l'installation des
 * dépendances. C'est la péremption de dix minutes qui rattrape ces cas, pas ce
 * code de retour.
 *
 * ⚠️ **L'identifiant part en `inputs`, et le script le résout PAR LA BASE.**
 * Rien d'autre ne transite par ce canal : ni la description de l'offre, ni un
 * secret. Les entrées d'un `workflow_dispatch` sont visibles dans l'interface
 * publique de GitHub Actions, sur un dépôt public.
 */
export async function lancerEnrichissement(id: number): Promise<LancementWorkflow> {
  const jeton = process.env.JETON_GITHUB;
  if (!jeton) {
    console.error("[github] JETON_GITHUB absent de l'environnement");
    return {
      ok: false,
      motif: "configuration",
      explication: "Le jeton GitHub n'est pas configuré.",
    };
  }

  let reponse: Response;
  try {
    reponse = await fetch(
      `https://api.github.com/repos/${DEPOT}/actions/workflows/${WORKFLOW}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jeton}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: BRANCHE,
          // ⚠️ Les entrées d'un workflow_dispatch sont des CHAÎNES chez GitHub.
          // Envoyer un nombre fait répondre 422 avec un message peu explicite.
          inputs: { enrichissement_id: String(id) },
        }),
        signal: AbortSignal.timeout(DELAI_MS),
        cache: "no-store",
      },
    );
  } catch (erreur) {
    // ⚠️ Le journal ne porte jamais l'en-tête d'autorisation ni le jeton — on
    // ne recopie que le nom de l'erreur.
    const nom = (erreur as { name?: string })?.name ?? "erreur";
    console.error(`[github] lancement impossible — ${nom}`);
    return {
      ok: false,
      motif: "injoignable",
      explication: "GitHub n'a pas répondu.",
    };
  }

  if (reponse.status === 204) return { ok: true };

  console.error(`[github] lancement refusé — HTTP ${reponse.status}`);

  // 401 : jeton invalide ou expiré. 404 : GitHub répond 404 — et non 403 — quand
  // un jeton à portée fine n'a pas accès au dépôt, exprès pour ne pas révéler
  // l'existence des dépôts privés. Les deux se réparent au même endroit.
  if (reponse.status === 401 || reponse.status === 403 || reponse.status === 404) {
    return {
      ok: false,
      motif: "jeton",
      explication:
        "GitHub a refusé le jeton : il est expiré, révoqué, ou n'a plus le droit de lancer ce workflow.",
    };
  }

  if (reponse.status === 422) {
    return {
      ok: false,
      motif: "refus",
      explication: "GitHub a refusé la demande (branche ou paramètre invalide).",
    };
  }

  return {
    ok: false,
    motif: "injoignable",
    explication: `GitHub a répondu ${reponse.status}.`,
  };
}
