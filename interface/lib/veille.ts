import "server-only";

import { interrogerBase } from "./supabase";

/**
 * L'état de santé de la veille : a-t-elle tourné, quand, et bien ?
 *
 * Entre : rien, sinon l'heure de référence.
 * Sort : un état parmi cinq, exhaustifs et distincts.
 * Casse : ne lève jamais. Une base injoignable rend `inconnu`, ce qui s'affiche
 * autrement que « aucune veille » — confondre les deux ferait annoncer une
 * panne de collecte un jour où c'est la lecture qui a échoué.
 *
 * ⚠️ **Ce module est séparé de `offres.ts` à dessein.** Il parle du *système*,
 * pas des offres : l'écran du matin (phase 5) devra dater sa veille sans
 * forcément lister quoi que ce soit. Les mêmes lignes d'`executions_veille`
 * servent les deux, mais pour deux questions différentes.
 *
 * ⚠️ **Le doublon de requête avec `lireDerniereExecution()` de `offres.ts` est
 * assumé.** Celle-ci répond à « quelle exécution marque les offres nouvelles »,
 * celle-là à « la machine a-t-elle tourné ». Les fusionner obligerait chaque
 * appelant à porter le besoin de l'autre. Le coût réel est une requête sur une
 * table de 55 lignes, servie par l'index partiel
 * `executions_veille_derniere_reussite`.
 *
 * ⚠️ **Les dateurs ne sont PAS ici, ils sont dans `lib/francais.ts`.** Ce sont
 * des fonctions pures ; les laisser derrière le `server-only` de ce module
 * armait un piège pour le premier composant client qui voudrait les utiliser.
 */

/**
 * Au-delà de ce délai sans collecte réussie, l'indicateur passe en alerte.
 *
 * ⚠️ **36 heures, et le chiffre vient du critère de succès n° 2**, pas d'une
 * intuition. Il est plus large que 24 h exprès : le cron de GitHub Actions ne
 * part jamais à l'heure — retards de +10 h 32 et +12 h 02 observés — et une
 * alerte à 24 h serait donc allumée la moitié du temps sans qu'il y ait la
 * moindre panne. Une alerte qui crie tous les jours n'est plus lue.
 */
export const SEUIL_ALERTE_HEURES = 36;

/**
 * Au-delà de ce délai, une exécution encore `en_cours` est forcément morte.
 *
 * ⚠️ **Sans ce seuil, une collecte tuée en plein vol passait pour une nuit
 * saine pendant près de 24 heures.** Relevé en revue le 29 août 2026. Le
 * mécanisme : une exécution tuée laisse sa ligne en `en_cours`, et
 * `pipeline/stockage.py` ne la referme en `echec` qu'au **démarrage suivant**,
 * soit la nuit d'après. Entre les deux, le bandeau lisait la dernière
 * *réussite* — celle de la veille — et affichait « Dernière veille — Hier,
 * 14:25 » en ocre, sans un mot sur la collecte morte cette nuit. L'alerte
 * n'arrivait qu'au franchissement des 36 h, le lendemain.
 *
 * **60 minutes, parce que le workflow se tue lui-même à 30** (`timeout-minutes`
 * dans `.github/workflows/collecte-nocturne.yml`). Le double laisse la marge
 * des horloges et d'un démarrage lent, tout en restant très en dessous des
 * 6 heures qu'attend le pipeline pour refermer les orphelines.
 *
 * ⚠️ **En dessous de ce seuil, `en_cours` n'est PAS un échec** : c'est une
 * collecte qui tourne à cet instant. La traiter comme un échec ferait clignoter
 * une alerte pendant chaque collecte.
 */
const DUREE_MAX_COLLECTE_MINUTES = 60;

/** Une exécution de collecte, telle qu'elle sert à dater le bandeau. */
export type PassageVeille = {
  /** Horodatage ISO avec fuseau — `timestamptz` côté base. */
  demarreeA: string;
  /** `null` si la colonne n'a pas été renseignée, jamais confondu avec zéro. */
  offresNouvelles: number | null;
};

/**
 * Les cinq états possibles. **Exhaustifs et mutuellement exclusifs** : c'est ce
 * qui permet à l'affichage d'être un simple aiguillage, sans cas par défaut qui
 * masquerait un trou.
 */
export type EtatVeille =
  /** Une collecte a réussi il y a moins de `SEUIL_ALERTE_HEURES`. */
  | { sorte: "a_jour"; reussite: PassageVeille }
  /** La dernière réussite dépasse le seuil. */
  | { sorte: "en_retard"; reussite: PassageVeille; heures: number }
  /**
   * La dernière tentative n'a pas abouti — la machine a tourné, elle a raté.
   *
   * ⚠️ **Cet état PRIME sur `en_retard`, et ce n'est pas arbitraire.** Les deux
   * peuvent être vrais en même temps ; l'échec est le plus actionnable des
   * deux, parce qu'il porte un motif et désigne une cause. « Ça date » est une
   * conséquence, « ça a raté » est le fait.
   *
   * `interrompue` distingue les deux façons de ne pas aboutir : le pipeline a
   * écrit `echec` lui-même, ou il a été tué avant d'avoir pu écrire quoi que ce
   * soit. Le second cas ne laisse aucun motif en base — le dire « en échec »
   * enverrait chercher une explication qui n'existe pas.
   */
  | {
      sorte: "echec";
      echecA: string;
      interrompue: boolean;
      reussite: PassageVeille | null;
    }
  /** Aucune collecte n'a jamais réussi : le tout premier matin. */
  | { sorte: "jamais" }
  /** La base n'a pas répondu. On ne sait pas, et on le dit. */
  | { sorte: "inconnu" };

type LigneExecution = {
  demarree_a: string;
  offres_nouvelles: number | null;
  issue: string;
};

/**
 * ⚠️ **On ne sélectionne que ce qu'on lit.** `id` et `terminee_a` figuraient
 * ici et n'étaient jamais utilisés — relevé en revue le 29 août 2026. `id`
 * surtout : le garder laissait croire que ce bandeau et le marqueur « Nouveau »
 * de la liste sont indexés sur la même ligne, alors que ce sont deux requêtes
 * indépendantes.
 */
const COLONNES = "demarree_a,offres_nouvelles,issue";

/**
 * Le filtre commun aux deux requêtes.
 *
 * ⚠️ **`etape=eq.collecte` est indispensable, et l'oublier serait invisible.**
 * Les notations écrivent leurs propres lignes dans la même table : sans ce
 * filtre, une notation réussie à 14 h ferait dire au bandeau que la veille est
 * à jour alors qu'aucune offre n'a été collectée depuis trois jours. Le même
 * piège qui a imposé la colonne `etape` au pipeline, à l'autre bout de la
 * chaîne.
 */
const COLLECTES = "executions_veille?etape=eq.collecte";

/**
 * La dernière collecte **réussie**, celle qui date le bandeau.
 *
 * ⚠️ Tri sur `demarree_a` et non `terminee_a` : c'est la colonne que couvre
 * l'index partiel `executions_veille_derniere_reussite`, et `terminee_a` est
 * *nullable* — une ligne à moitié écrite se classerait en dernier et changerait
 * silencieusement quelle exécution fait foi.
 */
async function lireDerniereReussite(): Promise<PassageVeille | null | "erreur"> {
  const resultat = await interrogerBase<LigneExecution>(
    `${COLLECTES}&select=${COLONNES}&issue=eq.reussite` +
      "&order=demarree_a.desc&limit=1",
  );

  if (!resultat.ok) return "erreur";

  const ligne = resultat.lignes[0];
  if (!ligne) return null;

  return {
    demarreeA: ligne.demarree_a,
    offresNouvelles: ligne.offres_nouvelles,
  };
}

/**
 * Le dernier passage de collecte, **quelle que soit son issue**.
 *
 * C'est lui qui révèle l'échec : sans cette seconde lecture, une collecte
 * plantée cette nuit serait indiscernable d'une nuit où le cron n'est jamais
 * parti — l'écran afficherait la réussite d'avant-hier sans jamais dire que la
 * machine a essayé et raté.
 */
async function lireDernierPassage(): Promise<
  { issue: string; demarreeA: string } | null | "erreur"
> {
  const resultat = await interrogerBase<LigneExecution>(
    `${COLLECTES}&select=${COLONNES}&order=demarree_a.desc&limit=1`,
  );

  if (!resultat.ok) return "erreur";

  const ligne = resultat.lignes[0];
  return ligne ? { issue: ligne.issue, demarreeA: ligne.demarree_a } : null;
}

/**
 * Le calcul des cinq états — **fonction pure**, séparée des deux lectures.
 *
 * Entre : ce que la base a rendu, et l'heure de référence.
 * Sort : l'état à afficher.
 * Casse : rien. Une date illisible est traitée comme une absence de date plutôt
 * que de produire un `NaN` qui s'afficherait tel quel à l'écran.
 *
 * La séparation lecture / calcul n'est pas de la coquetterie : c'est ce qui
 * rend les seuils éprouvables sans base de données ni réseau.
 */
export function calculerEtat(
  reussite: PassageVeille | null | "erreur",
  dernier: { issue: string; demarreeA: string } | null | "erreur",
  maintenant: Date,
): EtatVeille {
  // ⚠️ Une seule des deux lectures suffit à rendre l'état incertain : dater le
  // bandeau sur une moitié d'information afficherait « à jour » alors qu'un
  // échec est peut-être survenu depuis.
  if (reussite === "erreur" || dernier === "erreur") return { sorte: "inconnu" };

  const echec = dernierPassageRate(dernier, maintenant);

  if (
    echec !== null &&
    // Un échec ANTÉRIEUR à la dernière réussite est de l'histoire ancienne : la
    // collecte suivante a rattrapé, il n'y a rien à signaler.
    (reussite === null ||
      instant(echec.demarreeA) > instant(reussite.demarreeA))
  ) {
    return {
      sorte: "echec",
      echecA: echec.demarreeA,
      interrompue: echec.interrompue,
      reussite,
    };
  }

  if (reussite === null) return { sorte: "jamais" };

  const heures =
    (maintenant.getTime() - instant(reussite.demarreeA)) / 3_600_000;

  // ⚠️ `Number.isFinite` couvre la date illisible : `NaN` échoue à toutes les
  // comparaisons, donc sans ce garde-fou une date corrompue passerait pour
  // « à jour » — le plus rassurant des deux affichages, et le faux.
  if (!Number.isFinite(heures)) return { sorte: "inconnu" };

  return heures > SEUIL_ALERTE_HEURES
    ? { sorte: "en_retard", reussite, heures }
    : { sorte: "a_jour", reussite };
}

/**
 * Le dernier passage a-t-il raté, et de quelle façon ?
 *
 * Sort `null` si le passage a réussi, ou s'il tourne encore légitimement.
 *
 * ⚠️ **Les deux façons de rater ne se lisent pas dans la même colonne.** Un
 * `echec` a été écrit par le pipeline, qui a donc pu poser un motif. Un
 * `en_cours` vieux de plus d'une heure est une exécution **tuée** — plantage,
 * annulation, dépassement du `timeout-minutes` — et elle n'a rien pu écrire.
 */
function dernierPassageRate(
  dernier: { issue: string; demarreeA: string } | null,
  maintenant: Date,
): { demarreeA: string; interrompue: boolean } | null {
  if (dernier === null) return null;

  if (dernier.issue === "echec") {
    return { demarreeA: dernier.demarreeA, interrompue: false };
  }

  if (dernier.issue === "en_cours") {
    const minutes = (maintenant.getTime() - instant(dernier.demarreeA)) / 60_000;
    // ⚠️ `Number.isFinite` d'abord : sur une date illisible, `NaN > x` est faux
    // et l'exécution passerait pour « en train de tourner » indéfiniment.
    if (Number.isFinite(minutes) && minutes > DUREE_MAX_COLLECTE_MINUTES) {
      return { demarreeA: dernier.demarreeA, interrompue: true };
    }
  }

  return null;
}

/** Millisecondes depuis l'époque, ou `NaN` si la chaîne est illisible. */
function instant(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * L'état de la veille, lu en base.
 *
 * Les deux requêtes partent ensemble : enchaînées, elles doubleraient l'attente
 * avant le premier pixel pour aucune raison — la seconde ne dépend pas de la
 * première.
 */
export async function lireEtatVeille(maintenant: Date): Promise<EtatVeille> {
  const [reussite, dernier] = await Promise.all([
    lireDerniereReussite(),
    lireDernierPassage(),
  ]);

  return calculerEtat(reussite, dernier, maintenant);
}
