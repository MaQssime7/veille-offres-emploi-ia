// ⚠️ **Les deux imports viennent de modules SANS `server-only`, et c'est la
// condition pour que ce fichier reste ce qu'il prétend être.** Il se présente
// comme une fonction pure et vit à côté de composants clients : le jour où l'un
// d'eux voudra construire un lien, il doit pouvoir l'importer sans tirer la clé
// Supabase dans le graphe du navigateur. `FILTRE_PAR_DEFAUT` venait de
// `lib/offres.ts` jusqu'à la revue du 29 août 2026 — voir `lib/filtres.ts`.
import { FILTRE_PAR_DEFAUT, type FiltreListe } from "@/lib/filtres";
import { TRI_PAR_DEFAUT, type Tri } from "@/lib/tri";

/**
 * L'adresse d'une vue de la liste : un filtre et un classement.
 *
 * Entre : le filtre et le tri voulus.
 * Sort : `/offres`, `/offres?statut=candidate`, `/offres?statut=candidate&tri=recentes`…
 * Casse : rien, c'est une fonction pure.
 *
 * ⚠️ **Elle existe parce que les deux contrôles doivent se PRÉSERVER l'un
 * l'autre.** Sans elle, chaque barre construirait ses liens dans son coin :
 * changer de filtre effacerait le classement choisi, et changer de classement
 * ramènerait au filtre par défaut. Le défaut serait invisible dans le code et
 * évident à l'usage — on reclique trois fois pour retrouver son écran.
 *
 * ⚠️ **Ce qui vaut le défaut ne s'écrit PAS dans l'adresse** — `/offres` et non
 * `/offres?statut=a_traiter&tri=interet`. Deux adresses pour un même écran
 * fabriquent deux entrées d'historique, deux favoris possibles, et des
 * paramètres qui traînent dans tous les liens. L'absence de paramètre *est* la
 * valeur par défaut.
 *
 * ⚠️ **L'ordre des paramètres est FIXE — `statut` puis `tri`.** Deux liens qui
 * mènent au même écran doivent produire la même chaîne, sinon le navigateur les
 * traite comme deux pages : deux entrées d'historique pour un aller-retour, et
 * un favori qui ne correspond jamais à l'onglet marqué courant.
 */
export function adresseListe(filtre: FiltreListe, tri: Tri): string {
  const parametres = new URLSearchParams();

  if (filtre !== FILTRE_PAR_DEFAUT) parametres.set("statut", filtre);
  if (tri !== TRI_PAR_DEFAUT) parametres.set("tri", tri);

  const requete = parametres.toString();
  return requete ? `/offres?${requete}` : "/offres";
}
