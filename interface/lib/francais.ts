/**
 * La mise en français : accords et dates. **Fonctions pures, partagées serveur
 * et navigateur.**
 *
 * ⚠️ **Ce module n'a pas `import "server-only"`, comme `statuts.ts` et
 * `notes.ts`, et pour la même raison** : il ne contient que des fonctions
 * pures, aucune ne lit de secret ni ne touche au réseau. Un composant client
 * qui écrirait un pluriel ou une date doit pouvoir l'importer sans tirer
 * `lib/supabase.ts` — donc la clé secrète — dans le graphe du navigateur.
 *
 * ⚠️ **Les trois dateurs ci-dessous vivaient d'abord dans `lib/veille.ts`, qui
 * porte `server-only` — et c'était un piège armé.** Relevé en revue le 29 août
 * 2026 : `etat-veille.tsx` envisage déjà, par écrit, le composant client qui
 * ferait vieillir l'indicateur sans rechargement. Le jour où quelqu'un l'écrit,
 * il importe `daterPassage`, tire `lib/supabase.ts` dans le navigateur, et
 * tombe sur l'erreur `server-only` — incompréhensible, parce que le fichier
 * qu'il importait ne lisait aucun secret. **Une fonction pure enfermée derrière
 * `server-only` est une mine, pas une protection.**
 *
 * **Y mettre des fonctions pures, jamais du code qui lit un secret.**
 */

/**
 * Le pluriel français, qui se déclenche à partir de deux.
 *
 * Entre : un nombre et un mot au singulier.
 * Sort : le mot accordé.
 * Casse : rien.
 *
 * ⚠️ **Zéro reste au SINGULIER en français** — « 0 offre collectée » —
 * contrairement à l'anglais. C'est la faute qu'un `nombre > 1 ? "s" : ""`
 * recopié dans chaque interpolation finit toujours par commettre une fois sur
 * deux dans la même phrase.
 */
export function accorder(nombre: number, mot: string): string {
  return nombre >= 2 ? `${mot}s` : mot;
}

/**
 * ⚠️ **Le fuseau est forcé à Paris, et l'omettre serait un bug de production
 * invisible en développement.** Vercel exécute en UTC : sans ce réglage, une
 * collecte de 00 h 30 heure de Paris s'afficherait « hier, 22:30 ». Le Mac de
 * Maxime étant déjà à Paris, rien ne le signalerait en local.
 *
 * C'est la règle n° 1 de la base de données — `timestamptz` partout — tenue
 * jusqu'à l'écran, où elle se perdrait sans ça.
 */
const FUSEAU = "Europe/Paris";

/** Le jour civil à Paris, en `AAAA-MM-JJ` — comparable par simple égalité. */
function jourParisien(date: Date): string {
  return date.toLocaleDateString("fr-CA", { timeZone: FUSEAU });
}

/**
 * La veille d'un jour civil parisien, en `AAAA-MM-JJ`.
 *
 * ⚠️ **Le calcul passe par la DATE CIVILE, jamais par `setDate()` sur
 * l'instant** — et c'est un correctif, pas une préférence. `hier.setDate(
 * hier.getDate() - 1)` retranche un jour dans le fuseau du *serveur* (UTC sur
 * Vercel), puis le résultat était comparé à un jour *parisien*. Les deux ne
 * coïncident pas la nuit du passage à l'heure d'été, où la journée parisienne
 * ne fait que 23 heures : le 30 mars 2026 à 00 h 30 à Paris, la soustraction
 * atterrissait sur le **28** mars, et une collecte du 29 s'affichait
 * « Dimanche 29 mars » au lieu de « Hier ». Relevé en revue le 29 août 2026.
 *
 * Ici on part de la chaîne `AAAA-MM-JJ`, on la lit à **midi UTC** — heure à
 * laquelle aucun décalage de fuseau ne fait changer de jour civil — et on
 * retranche 24 heures. Le résultat ne dépend plus de l'endroit où tourne le
 * serveur.
 */
function veilleDe(jour: string): string {
  const midi = new Date(`${jour}T12:00:00Z`);
  midi.setUTCDate(midi.getUTCDate() - 1);
  return midi.toISOString().slice(0, 10);
}

/**
 * « Aujourd'hui, 11:11 » · « Hier, 14:25 » · « Mercredi 27 août, 14:55 ».
 *
 * Entre : un horodatage ISO et l'heure de référence.
 * Sort : la date en français, heure de Paris.
 * Casse : une chaîne illisible rend « date inconnue » plutôt qu'un `NaN` qui
 * s'afficherait tel quel.
 *
 * ⚠️ **« Aujourd'hui » se calcule sur le jour CIVIL, pas sur un écart de
 * 24 heures.** Une collecte de 23 h 50 consultée à 00 h 10 s'est bien produite
 * « hier », même si elle date de vingt minutes. L'inverse — comparer des durées
 * — dirait « aujourd'hui » pour une collecte de la veille au soir.
 *
 * ⚠️ **Aucun « ce matin » nulle part.** Mesuré le 29 août 2026 : les cinq
 * dernières collectes sont parties à 11:11, 14:25 et 12:55 heure de Paris. Le
 * cron de GitHub Actions ne part jamais à l'heure prévue, donc un libellé qui
 * promet un moment de la journée finirait par mentir un jour sur deux.
 */
export function daterPassage(iso: string, maintenant: Date): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "date inconnue";

  const heure = date.toLocaleTimeString("fr-FR", {
    timeZone: FUSEAU,
    hour: "2-digit",
    minute: "2-digit",
  });

  const jour = jourParisien(date);
  const aujourdhui = jourParisien(maintenant);

  if (jour === aujourdhui) return `Aujourd'hui, ${heure}`;
  if (jour === veilleDe(aujourdhui)) return `Hier, ${heure}`;

  const libelle = date.toLocaleDateString("fr-FR", {
    timeZone: FUSEAU,
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return `${majuscule(libelle)}, ${heure}`;
}

/**
 * Une durée seule : « 3 jours », « 40 heures », « 1 heure ».
 *
 * ⚠️ **Elle rend la durée NUE, sans « il y a » ni « depuis ».** La première
 * version rendait « il y a 3 jours » et l'appelant retirait le préfixe par un
 * `replace("il y a ", "")` pour écrire « Aucune veille depuis 3 jours ». Ce
 * couplage par chaîne de caractères casse en silence : reformuler ici en
 * « voici 3 jours » laisserait le `replace` sans effet et l'écran afficherait
 * « Aucune veille depuis il y a 3 jours », sans la moindre erreur pour le
 * signaler. **La fonction rend la matière, l'appelant fait la phrase.**
 *
 * ⚠️ **Arrondi à l'unité INFÉRIEURE, jamais au plus proche.** « 2 jours » pour
 * 47 heures est vrai ; « 2 jours » pour 37 heures ne l'est pas. Sur un
 * indicateur d'alerte, exagérer le retard décrédibilise l'alerte entière.
 *
 * ⚠️ **Le seuil de bascule est à 48 h, pas à 24 h**, pour la même raison : entre
 * 24 et 48 heures, « 1 jour » perdrait la moitié de ce que « 40 heures » dit.
 *
 * ⚠️ **L'accord passe par `accorder()`, y compris sur un cas aujourd'hui
 * inatteignable.** L'alerte ne se déclenche qu'au-delà de 36 heures, donc
 * « 1 heure » ne peut pas s'afficher — mais la fonction est exportée, et la
 * phase 5 prévoit de réutiliser cette formulation dans ses états vides. Un
 * « 1 heures » attend le premier appelant qui sortira de ce contexte.
 */
export function duree(heures: number): string {
  const jours = Math.floor(heures / 24);
  if (jours >= 2) return `${jours} ${accorder(jours, "jour")}`;

  const entieres = Math.floor(heures);
  return `${entieres} ${accorder(entieres, "heure")}`;
}

function majuscule(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/**
 * De combien Paris est en avance sur UTC à cet instant, en minutes (60 ou 120).
 *
 * ⚠️ **Jamais une constante.** Écrire « Paris = UTC+1 » donnerait une heure
 * fausse la moitié de l'année, et écrire « UTC+2 » l'autre moitié. Le décalage
 * se demande au moteur de dates du navigateur, pour l'instant précis considéré.
 *
 * La ruse : `sv-SE` formate en `AAAA-MM-JJ HH:MM:SS`, le seul format de la
 * bibliothèque standard qui se relise directement. On relit l'heure parisienne
 * *comme si* elle était en UTC, et l'écart avec l'instant réel EST le décalage.
 */
function decalageParisMinutes(instant: Date): number {
  const commeSiUtc = new Date(
    `${instant.toLocaleString("sv-SE", { timeZone: FUSEAU }).replace(" ", "T")}Z`,
  );
  return (commeSiUtc.getTime() - instant.getTime()) / 60000;
}

/**
 * Minuit, heure de Paris, du jour en cours — rendu comme instant.
 *
 * Entre : l'heure de référence.
 * Sort : l'instant exact où la journée parisienne a commencé.
 * Casse : ne lève pas ; une date invalide donnerait un instant invalide, que
 * l'appelant verrait immédiatement en le sérialisant.
 *
 * ⚠️ **C'est la borne de l'enveloppe quotidienne d'enrichissement.** Le critère
 * du plan dit « le compte repart de zéro le lendemain, à minuit heure de
 * Paris ». Sur Vercel, le serveur tourne en UTC : un « début de journée »
 * calculé naïvement ferait repartir l'enveloppe à 02:00 du matin en été, et une
 * série de clics à 00 h 30 serait imputée à la veille.
 *
 * ⚠️ **Le décalage est mesuré à minuit UTC du jour, pas à l'heure courante** —
 * et ce n'est pas équivalent. Les deux changements d'heure français ont lieu à
 * 01:00 UTC, donc minuit UTC tombe toujours du même côté de la bascule que le
 * minuit parisien qu'on cherche. Mesurer à l'heure courante donnerait un
 * décalage postérieur à la bascule un dimanche de mars, et minuit parisien
 * serait situé une heure trop tôt.
 *
 * Vérifié sur les deux nuits de bascule de 2026 dans `francais.test.ts`.
 */
export function debutDuJourParisien(maintenant: Date): Date {
  const jour = jourParisien(maintenant);
  const minuitUtc = new Date(`${jour}T00:00:00Z`);
  return new Date(minuitUtc.getTime() - decalageParisMinutes(minuitUtc) * 60000);
}
