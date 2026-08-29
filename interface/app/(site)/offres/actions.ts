"use server";

/**
 * Les actions d'écriture sur une offre.
 *
 * ⚠️ **`"use server"` marque ces fonctions comme atteignables depuis le
 * navigateur.** Ce n'est pas une annotation d'organisation : Next publie pour
 * chacune un point d'entrée HTTP, invoqué par un `POST` portant un en-tête
 * `Next-Action`. Rien n'oblige ce `POST` à venir de notre page, ni ses
 * arguments à ressembler à ce que nos boutons envoient. **Tout ce qui arrive
 * ici est une donnée étrangère**, y compris l'identifiant d'offre — qui, dans
 * l'écran, vient pourtant de notre propre base.
 *
 * D'où l'ordre, qui ne se réarrange pas :
 *
 * 1. `exigerSession()` — la serrure, en première ligne, sans exception.
 * 2. Valider la valeur contre la liste blanche `estStatut()`.
 * 3. Valider l'identifiant (fait par `changerStatut`, qui applique la même
 *    expression régulière que la lecture).
 * 4. Écrire, et laisser la contrainte de la base trancher en dernier ressort.
 */

import { revalidatePath } from "next/cache";

import { exigerSession } from "@/lib/acces";
import { changerStatut } from "@/lib/offres";
import { estStatut } from "@/lib/statuts";

/**
 * Ce que l'action rend au navigateur.
 *
 * ⚠️ **Un message écrit pour un humain, jamais le détail technique.** La cause
 * exacte (contrainte violée, code HTTP, message de Postgres) part au journal du
 * serveur par `lib/supabase.ts`. La renvoyer au navigateur la rendrait visible
 * dans l'onglet réseau et, tôt ou tard, dans une capture d'écran.
 */
export type ResultatAction = { ok: true } | { ok: false; message: string };

/**
 * Poser le statut d'une offre.
 *
 * Entre : un identifiant et un statut, tous deux venus du navigateur.
 * Sort : `{ ok: true }`, ou un message affichable.
 * Casse : ne lève jamais pour une panne de base — mais `exigerSession()` peut
 * lever pour rediriger, et c'est voulu (voir plus bas).
 *
 * ⚠️ **Le paramètre est typé `string`, pas `Statut`, et c'est délibéré.** Typer
 * `Statut` donnerait l'illusion d'une garantie : TypeScript disparaît à la
 * compilation, et l'appelant réel est un `POST` HTTP qui peut envoyer
 * `"supprime_tout"`. Le type large force à écrire la validation, au lieu de
 * croire qu'elle a déjà eu lieu.
 *
 * ⚠️ **Session expirée pendant que l'onglet dormait** : le `POST` n'atteint même
 * pas cette fonction — `proxy.ts` lui répond **401** sans rediriger, parce
 * qu'un `POST` redirigé ferait suivre le navigateur jusqu'à `/connexion`, d'où
 * il reviendrait avec un corps vide et un bouton qui n'aurait « rien fait ».
 * Le composant client traite ce 401 comme un échec et l'affiche. C'est un cas
 * réel : un onglet laissé ouvert toute la nuit.
 */
export async function definirStatut(
  identifiant: string,
  statut: string,
): Promise<ResultatAction> {
  // ⚠️ Première ligne, sans exception. Hors de tout try/catch : `redirect()`
  // lève une exception que Next intercepte, l'attraper annulerait le renvoi.
  await exigerSession();

  if (!estStatut(statut)) {
    // ⚠️ **Le journal ne recopie pas la valeur reçue.** Elle vient de
    // l'extérieur : la journaliser telle quelle laisserait un inconnu écrire ce
    // qu'il veut dans les journaux du serveur — de quoi les rendre illisibles,
    // ou y glisser de fausses lignes d'erreur.
    console.error("[statut] valeur refusée — hors de la liste des statuts connus");
    return { ok: false, message: "Ce statut n’existe pas." };
  }

  const resultat = await changerStatut(identifiant, statut);

  if (!resultat.ok) {
    // Les quatre motifs se distinguent à l'écran, parce qu'ils n'appellent pas
    // la même réaction : réessayer, prévenir Maxime, ou recharger la page.
    const message =
      resultat.motif === "introuvable"
        ? "Cette offre n’existe plus."
        : resultat.motif === "refusee"
          ? "La base a refusé ce changement."
          : resultat.motif === "configuration"
            ? "Le site n’est pas correctement configuré."
            : "Enregistrement impossible : la base n’a pas répondu.";
    return { ok: false, message };
  }

  // ⚠️ **`revalidatePath` n'invalide PAS un cache de données — il n'y en a
  // pas.** Toutes nos requêtes partent en `cache: "no-store"`. Ce qu'il vide,
  // c'est le cache de navigation du routeur, côté navigateur : sans lui, le
  // bouton « retour » ramènerait la liste telle qu'elle était **avant** le
  // clic, avec l'offre encore « à traiter ». L'écran mentirait, et il faudrait
  // recharger à la main pour voir la vérité.
  //
  // `"layout"` et non `"page"` : il faut couvrir `/offres` **et**
  // `/offres/[identifiant]`, puisqu'on peut trier depuis les deux écrans.
  revalidatePath("/offres", "layout");

  return { ok: true };
}
