/**
 * Les mises en forme d'affichage. Aucune ne touche la base.
 */

/**
 * ⚠️ **Le fuseau est explicite, et c'est le piège n° 1 de tout ce projet.**
 *
 * Les dates sont stockées en `timestamptz` et rendues **par le serveur** —
 * lequel tourne en UTC chez Vercel comme chez GitHub Actions. Sans
 * `timeZone: "Europe/Paris"`, une offre publiée le 21 août à 00 h 55 heure de
 * Paris (soit 22 h 55 la veille en UTC) s'afficherait « 20 août ». Pas une
 * heure décalée : **le mauvais jour**, ce qui ne se remarque jamais à l'œil.
 */
const FUSEAU = "Europe/Paris";

const JOUR_ET_MOIS = new Intl.DateTimeFormat("fr-FR", {
  timeZone: FUSEAU,
  day: "numeric",
  month: "long",
});

const AVEC_ANNEE = new Intl.DateTimeFormat("fr-FR", {
  timeZone: FUSEAU,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const ANNEE_SEULE = new Intl.DateTimeFormat("fr-FR", {
  timeZone: FUSEAU,
  year: "numeric",
});

/**
 * Entre : un horodatage ISO venu de la base.
 * Sort : « 20 août », ou « 20 août 2025 » si ce n'est pas l'année en cours.
 * Casse : renvoie `null` sur une date illisible — l'appelant n'affiche alors
 * pas de cartouche plutôt qu'un « Invalid Date » en travers de la ligne.
 */
export function formaterDate(iso: string, maintenant: Date): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  // Comparaison d'années dans le fuseau de Paris, pas dans celui du serveur :
  // le 1er janvier à 00 h 30, les deux ne sont pas d'accord.
  return ANNEE_SEULE.format(date) === ANNEE_SEULE.format(maintenant)
    ? JOUR_ET_MOIS.format(date)
    : AVEC_ANNEE.format(date);
}

/**
 * Nettoyage **cosmétique** du libellé de salaire, et rien de plus.
 *
 * France Travail écrit « Annuel de 32000.0 Euros à 35000.0 Euros sur 12.0
 * mois ». On efface les décimales nulles, qui n'apportent rien et alourdissent
 * une ligne déjà longue.
 *
 * ⚠️ Ce n'est **pas** la normalisation du salaire : ramener toutes les formes à
 * un montant annuel comparable est le travail de la phase 2, qui écrira des
 * colonnes en base. Ici on ne fait que retirer des zéros à l'affichage — aucune
 * valeur n'est interprétée, donc rien ne pourra diverger avec la phase 2.
 */
export function formaterSalaire(libelle: string): string {
  return libelle.replace(/(\d)\.0(?!\d)/g, "$1");
}
