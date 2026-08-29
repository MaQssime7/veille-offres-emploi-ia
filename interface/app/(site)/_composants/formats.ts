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

const JOUR_MOIS_HEURE = new Intl.DateTimeFormat("fr-FR", {
  timeZone: FUSEAU,
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Le jour et l'heure d'un enregistrement.
 *
 * Entre : un horodatage ISO — celui que l'action serveur vient de renvoyer, ou
 * `note_modifiee_a` relu en base au chargement de la fiche.
 * Sort : « 29 août à 14:32 », ou `null` sur une date illisible : l'indicateur
 * dit alors « Enregistré » tout court plutôt qu'« Invalid Date ».
 * Casse : rien.
 *
 * ⚠️ **Le fuseau est explicite ICI AUSSI, et pour une raison de plus qu'en
 * liste.** Cette fonction est la seule de ce fichier appelée depuis un
 * composant **client** : il est rendu une première fois sur le serveur (en UTC)
 * puis hydraté dans le navigateur (à Paris). Sans fuseau figé, les deux rendus
 * produiraient deux textes différents et React signalerait une erreur
 * d'hydratation en console — que le plancher du projet interdit.
 *
 * ⚠️ **La date, pas seulement l'heure.** « Enregistré à 14:32 » sur une fiche
 * rouverte trois jours plus tard se lit comme « à l'instant ». C'est exactement
 * la confusion que l'US-13 veut empêcher : l'indicateur existe pour prouver ce
 * que la base détient, pas pour rassurer.
 */
export function formaterEnregistrement(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return JOUR_MOIS_HEURE.format(date);
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

/**
 * Le salaire ramené à l'année, tel qu'il s'affiche.
 *
 * Entre : les deux bornes annuelles calculées par `pipeline/salaire.py`.
 * Sort : « 45–60 k€ », « 30 k€ », « 22,8–32,8 k€ » — ou `null` quand il n'y a
 * rien à afficher, auquel cas l'appelant retombe sur le libellé d'origine.
 * Casse : rien. Une borne absente, nulle ou négative fait renvoyer `null` ;
 * jamais de « NaN k€ » en travers de la ligne.
 *
 * ⚠️ **Cette fonction ne calcule RIEN.** L'annualisation — les neuf familles de
 * forme, les périodes inconnues, le seuil de plausibilité qui a fait écarter
 * « Mensuel de 45000 Euros sur 12 mois » — vit dans `pipeline/salaire.py` et
 * **nulle part ailleurs**. Deux endroits qui convertissent des salaires
 * finissent toujours par diverger, et c'est celui qui est en base qui aurait
 * raison. Ici on met en forme deux entiers déjà calculés, point.
 *
 * ⚠️ **Le tiret est un demi-cadratin (–), pas un trait d'union.** Sur
 * « 45-60 », le trait d'union se lit comme une soustraction ou une césure ; le
 * demi-cadratin est le signe typographique de l'intervalle.
 *
 * ⚠️ **Une décimale, jamais zéro.** Les vraies valeurs en base comptent des
 * montants comme 22 750 ou 38 400 € : arrondir au millier afficherait « 23 k€ »
 * pour 22 750, et comme le libellé d'origine disparaît de la liste dès qu'on
 * l'a remplacé, plus rien ne permettrait de retrouver le chiffre exact. Une
 * décimale conserve la valeur à 100 € près ; les « ,0 » sont retirés pour que
 * le cas courant reste « 45–60 k€ » et non « 45,0–60,0 k€ ».
 */
export function formaterSalaireAnnuel(
  min: number | null,
  max: number | null,
): string | null {
  const bas = estAffichable(min) ? min : null;
  const haut = estAffichable(max) ? max : null;

  if (bas === null && haut === null) return null;

  // Les deux bornes égales décrivent un salaire fixe, pas un intervalle de
  // largeur nulle : « 28 k€ », jamais « 28–28 k€ ». Cinq offres réelles sont
  // dans ce cas au 26 août 2026.
  if (bas !== null && haut !== null) {
    return bas === haut
      ? `${enMilliers(bas)} k€`
      : `${enMilliers(bas)}–${enMilliers(haut)} k€`;
  }

  // Une seule borne. Aucune offre réelle n'est dans ce cas au 26 août 2026,
  // mais la base l'autorise (les deux colonnes sont indépendamment nullables)
  // et un affichage muet vaudrait mieux qu'un intervalle inventé.
  return bas !== null
    ? `à partir de ${enMilliers(bas)} k€`
    : `jusqu'à ${enMilliers(haut as number)} k€`;
}

/**
 * Un montant est affichable s'il est fini et **au moins égal à 50 €**.
 *
 * ⚠️ Le `> 0` seul ne suffisait pas, et le défaut était invisible : la base
 * n'interdit qu'un montant nul ou négatif (contrainte `salaire_annuel_positif`),
 * donc un salaire annuel de 35 € y entre légalement. `enMilliers(35)` arrondit à
 * **0**, et la ligne affichait « 0 k€ » — un salaire de zéro euro énoncé comme
 * un fait, sans le moindre signal. Ce n'est pas théorique : « Annuel de 35.0
 * Euros » est un libellé réellement observé dans les données.
 *
 * ⚠️ **Ce n'est PAS le seuil de plausibilité des salaires**, lequel vit dans
 * `pipeline/salaire.py` et nulle part ailleurs — c'est lui qui décide ce qui est
 * un vrai salaire. Ici on ne juge rien : on refuse seulement de **rendre** une
 * valeur que l'arrondi transformerait en mensonge. L'appelant retombe alors sur
 * le libellé d'origine, où le lecteur voit le chiffre brut et juge lui-même.
 *
 * ⚠️ `0` étant faux en JavaScript, un test raccourci en `min ? … : …`
 * traiterait silencieusement zéro comme « absent » — vrai par accident, pas par
 * intention. D'où le test explicite.
 */
const PLANCHER_AFFICHAGE_EUROS = 50;

function estAffichable(montant: number | null): montant is number {
  return (
    montant !== null &&
    Number.isFinite(montant) &&
    montant >= PLANCHER_AFFICHAGE_EUROS
  );
}

/**
 * 45000 → « 45 » · 22750 → « 22,8 » · 30012 → « 30 ».
 *
 * ⚠️ La virgule décimale est française et posée à la main, pas par
 * `toLocaleString`. Cette fonction est appelée pendant le rendu **serveur**,
 * lequel tourne chez Vercel avec une locale par défaut qui n'est pas garantie :
 * un `toLocaleString()` sans argument y produirait « 22.8 ». Le même piège que
 * le fuseau horaire ci-dessus, et il ne se voit pas davantage.
 */
function enMilliers(montant: number): string {
  const milliers = Math.round(montant / 100) / 10;
  return Number.isInteger(milliers)
    ? String(milliers)
    : String(milliers).replace(".", ",");
}

/**
 * La description de l'annonce, préparée pour un rendu en texte brut.
 *
 * Entre : le texte tel que France Travail l'a écrit.
 * Sort : le même texte, débarrassé de deux bruits de machine.
 * Casse : rien — aucune interprétation, aucune reformulation.
 *
 * ⚠️ **On ne « nettoie » que ce qui n'est pas du contenu**, et c'est une règle,
 * pas une préférence. Mesuré sur les 560 descriptions en base le 28 août 2026 :
 *
 * | Motif | Offres | Traitement |
 * |---|---|---|
 * | HTML, entités (`&nbsp;`) | **0** | rien à faire |
 * | `#!#`, séparateur de section | **1** (34 occurrences) | retiré |
 * | 3 sauts de ligne ou plus | **199 (36 %)** | ramenés à 2 |
 * | `**gras**` façon markdown | 39 (7 %) | **laissé tel quel** |
 *
 * ⚠️ **Les `**` sont laissés VISIBLES, et c'est délibéré.** Les interpréter
 * demanderait un rendu markdown sur un texte qui n'en est pas : une astérisque
 * isolée — il y en a — retournerait le reste du paragraphe en emphase. Les
 * supprimer effacerait une intention de l'annonceur. Entre afficher un texte
 * un peu brut et le réécrire au jugé, ce projet a déjà tranché : on renonce
 * plutôt que de deviner. À rouvrir si Maxime les trouve gênants à l'usage.
 */
export function preparerDescription(texte: string): string {
  return texte
    .replace(/#!#/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Une exigence linguistique, telle qu'elle s'écrit.
 *
 * Entre : une entrée du champ `langues` de France Travail.
 * Sort : « Anglais exigé », « Anglais souhaité », ou le libellé seul.
 * Casse : renvoie `null` si l'entrée n'a pas de libellé — on n'affiche pas un
 * cartouche vide.
 *
 * ⚠️ **Un code d'exigence inconnu ne devient JAMAIS une supposition.** Deux
 * valeurs sont observées, `E` et `S` ; France Travail peut en ajouter demain.
 * Une troisième valeur fait afficher le libellé seul — « Anglais » — plutôt
 * que de le ranger d'office dans « exigé » ou « souhaité ». Même règle que les
 * périodes de salaire inconnues dans `pipeline/salaire.py`.
 */
export function formaterLangue(langue: {
  libelle?: string | null;
  exigence?: string | null;
}): string | null {
  if (!langue.libelle) return null;
  if (langue.exigence === "E") return `${langue.libelle} exigé`;
  if (langue.exigence === "S") return `${langue.libelle} souhaité`;
  return langue.libelle;
}
