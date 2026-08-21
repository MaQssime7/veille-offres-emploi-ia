/**
 * La session du site : fabriquer le cookie, le relire, vérifier le mot de passe.
 *
 * Ce module est volontairement **sans dépendance à Next.js**. Il est importé
 * par `proxy.ts` (qui s'exécute avant le rendu et n'a pas accès à
 * `next/headers`) autant que par les pages et les actions serveur. Un seul
 * endroit décide ce qu'est une session valide ; recopier cette logique
 * garantirait qu'une des copies finisse par diverger.
 *
 * ⚠️ Ce fichier ne s'exécute QUE sur le serveur, et l'import ci-dessous en fait
 * une règle plutôt qu'une intention : si un composant `"use client"` importe ce
 * module — ne serait-ce que pour `destinationSure`, qui est un utilitaire pur —
 * la compilation échoue avec un message explicite. Sans ce garde-fou, tout le
 * module et `node:crypto` partiraient dans le graphe du navigateur et la panne
 * serait incompréhensible.
 */

import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Un seul utilisateur, une seule porte, un seul cookie. */
export const NOM_COOKIE_SESSION = "veille_session";

/** Trente jours — critère d'acceptation de la phase 1. */
export const DUREE_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * En dessous de ce reste-à-vivre, le proxy réémet le cookie.
 *
 * Le critère dit « expire après 30 jours **d'inactivité** » : sans
 * prolongation, les 30 jours compteraient depuis la connexion, et une session
 * utilisée tous les matins expirerait quand même au trentième jour. On réémet
 * dès que le cookie a plus d'un jour, pas à chaque requête : inutile de coller
 * un `Set-Cookie` sur chaque navigation.
 */
export const SEUIL_PROLONGATION_MS = DUREE_SESSION_MS - 24 * 60 * 60 * 1000;

/**
 * Plancher de longueur des deux secrets.
 *
 * Sans ce contrôle, une variable d'environnement oubliée chez Vercel vaudrait
 * la chaîne vide, et la porte s'ouvrirait sur un champ vide **sans le moindre
 * message d'erreur**. On préfère refuser bruyamment.
 */
const LONGUEUR_MINIMALE_SECRET = 16;

/** Levée quand un secret manque : la porte doit se fermer, pas s'entrouvrir. */
export class ConfigurationManquante extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationManquante";
  }
}

function secretDeSignature(): string {
  const valeur = process.env.SECRET_SESSION;
  if (!valeur || valeur.length < LONGUEUR_MINIMALE_SECRET) {
    throw new ConfigurationManquante(
      "SECRET_SESSION est absent ou trop court : impossible de signer une session.",
    );
  }
  return valeur;
}

function signer(charge: string): string {
  return createHmac("sha256", secretDeSignature()).update(charge).digest("hex");
}

/**
 * Compare deux chaînes sans que la durée de la comparaison renseigne sur le
 * nombre de caractères justes. `timingSafeEqual` refuse deux tampons de
 * longueurs différentes : on écarte ce cas avant, et la longueur elle-même
 * n'est pas un secret ici (la signature est toujours de 64 caractères).
 */
function egalesEnTempsConstant(recue: string, attendue: string): boolean {
  const tamponRecu = Buffer.from(recue, "utf8");
  const tamponAttendu = Buffer.from(attendue, "utf8");
  if (tamponRecu.length !== tamponAttendu.length) return false;
  return timingSafeEqual(tamponRecu, tamponAttendu);
}

/**
 * Fabrique le contenu du cookie : « échéance.signature ».
 *
 * Rien d'autre à y mettre — il n'y a qu'un utilisateur, donc aucune identité à
 * transporter. L'échéance voyage en clair ; la signature est ce qui empêche de
 * la modifier, puisqu'elle exige le secret du serveur pour être recalculée.
 */
export function fabriquerJeton(maintenant: number = Date.now()): string {
  const echeance = (maintenant + DUREE_SESSION_MS).toString(36);
  return `${echeance}.${signer(echeance)}`;
}

/**
 * Relit un cookie et renvoie son échéance en millisecondes, ou `null` si le
 * jeton est absent, malformé, mal signé ou périmé.
 *
 * Renvoyer l'échéance plutôt qu'un booléen permet au proxy de décider s'il
 * faut prolonger la session sans refaire le travail de vérification.
 */
export function lireJeton(
  jeton: string | undefined,
  maintenant: number = Date.now(),
): number | null {
  if (!jeton) return null;

  const separateur = jeton.indexOf(".");
  if (separateur <= 0) return null;

  const charge = jeton.slice(0, separateur);
  const signature = jeton.slice(separateur + 1);
  if (!egalesEnTempsConstant(signature, signer(charge))) return null;

  const echeance = Number.parseInt(charge, 36);
  if (!Number.isFinite(echeance) || echeance <= maintenant) return null;

  return echeance;
}

/**
 * Vérifie le mot de passe saisi contre celui de l'environnement.
 *
 * La comparaison porte sur les empreintes SHA-256 et non sur les chaînes :
 * les deux empreintes font toujours 32 octets, donc ni la longueur du mot de
 * passe ni le rang du premier caractère faux ne transparaissent dans le temps
 * de réponse.
 *
 * Lève `ConfigurationManquante` si le mot de passe du site n'est pas
 * configuré — la porte refuse alors tout le monde, y compris un champ vide.
 */
export function motDePasseCorrect(saisi: string): boolean {
  const attendu = process.env.MOT_DE_PASSE_SITE;
  if (!attendu || attendu.length < LONGUEUR_MINIMALE_SECRET) {
    throw new ConfigurationManquante(
      "MOT_DE_PASSE_SITE est absent ou trop court : la porte refuse tout le monde.",
    );
  }
  const empreinte = (valeur: string) =>
    createHash("sha256").update(valeur, "utf8").digest();
  return timingSafeEqual(empreinte(saisi), empreinte(attendu));
}

/**
 * Vérifie que les deux secrets sont là, **avant** toute comparaison de mot de
 * passe. Lève `ConfigurationManquante` en nommant celui qui manque.
 *
 * Sans cet appel, une variable `SECRET_SESSION` oubliée chez Vercel produisait
 * l'enchaînement le plus déroutant possible : le bon mot de passe était
 * *accepté*, puis la fabrication du cookie échouait et l'utilisateur recevait
 * une erreur 500 opaque. La porte se fermait bien, mais au pire moment et sans
 * rien d'exploitable pour comprendre.
 */
export function verifierConfiguration(): void {
  const manquants: string[] = [];
  if (!process.env.MOT_DE_PASSE_SITE
      || process.env.MOT_DE_PASSE_SITE.length < LONGUEUR_MINIMALE_SECRET) {
    manquants.push("MOT_DE_PASSE_SITE");
  }
  if (!process.env.SECRET_SESSION
      || process.env.SECRET_SESSION.length < LONGUEUR_MINIMALE_SECRET) {
    manquants.push("SECRET_SESSION");
  }
  if (manquants.length > 0) {
    // Le nom de la variable, jamais sa valeur.
    throw new ConfigurationManquante(
      `Variable(s) d'environnement absente(s) ou trop courte(s) : ${manquants.join(", ")}.`,
    );
  }
}

/** Les attributs du cookie de session, au même endroit pour tous ceux qui le posent. */
export function optionsCookie() {
  return {
    // Invisible au JavaScript de la page : un script injecté ne peut pas le lire.
    httpOnly: true,
    // Refusé sur une connexion non chiffrée — sauf en développement, où le
    // serveur local est en http et où le cookie ne serait jamais posé.
    secure: process.env.NODE_ENV === "production",
    // Le cookie n'accompagne pas les requêtes déclenchées depuis un autre site.
    sameSite: "lax" as const,
    // Sans ce chemin explicite, un cookie posé depuis /connexion ne vaudrait
    // que pour /connexion et l'utilisateur resterait dehors partout ailleurs.
    path: "/",
    maxAge: Math.floor(DUREE_SESSION_MS / 1000),
  };
}

/**
 * Nettoie l'adresse de retour passée dans `?suite=`.
 *
 * Sans ce filtre, un lien `/connexion?suite=https://ailleurs.example` renverrait
 * l'utilisateur sur un site tiers **juste après** avoir tapé son mot de passe —
 * la manœuvre classique pour lui en faire retaper un sur une fausse page. On
 * n'accepte qu'un chemin interne : un seul « / » en tête, et ni « // » ni « /\ »
 * derrière, que les navigateurs lisent comme des adresses externes.
 */
export function destinationSure(valeur: unknown): string {
  if (typeof valeur !== "string") return "/";
  if (!/^\/(?![/\\])[^\s]*$/.test(valeur)) return "/";
  // Repartir sur la porte après l'avoir franchie tournerait en rond.
  if (valeur === "/connexion" || valeur.startsWith("/connexion?")) return "/";
  return valeur;
}
