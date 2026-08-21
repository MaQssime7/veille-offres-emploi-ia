"use server";

/**
 * L'action qui referme la porte.
 *
 * Entre : rien — le cookie de session suffit.
 * Sort : le cookie effacé et un renvoi vers `/connexion`.
 * Casse : si la session est déjà tombée, `exigerSession()` renvoie vers la
 * porte, ce qui est exactement le résultat attendu.
 *
 * ⚠️ Effacer le cookie côté navigateur ne « déconnecte » rien en soi : le
 * jeton reste valide jusqu'à son échéance, et quiconque en aurait gardé une
 * copie pourrait le reposer. C'est acceptable ici parce que le cookie est
 * `httpOnly` — le JavaScript de la page ne peut pas le lire, donc il n'en
 * circule aucune copie. Sur un site à plusieurs comptes, il faudrait tenir en
 * base une liste de jetons révoqués et la consulter à chaque requête.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { exigerSession } from "@/lib/acces";
import { NOM_COOKIE_SESSION } from "@/lib/session";

export async function deconnecter(): Promise<void> {
  // La règle du projet est sans exception : toute action serveur commence par
  // là. Ici elle ne protège pas une donnée, elle évite qu'un `POST` anonyme
  // vienne remuer les cookies de la réponse.
  await exigerSession();

  const cookiesEnCours = await cookies();
  cookiesEnCours.delete({ name: NOM_COOKIE_SESSION, path: "/" });

  // ⚠️ Hors de tout try/catch : `redirect` lève une exception que Next.js
  // intercepte. Attrapée, elle annulerait la redirection.
  redirect("/connexion");
}
