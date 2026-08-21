/**
 * La serrure, côté pages et actions serveur.
 *
 * `proxy.ts` redirige joliment le visiteur sans cookie, mais il ne suffit pas.
 * Deux raisons, dont la seconde est la plus concrète :
 *
 * 1. Un middleware Next.js a déjà été contournable par un simple en-tête HTTP
 *    (CVE-2025-29927, corrigée depuis).
 * 2. ⚠️ **Une action serveur ne s'invoque pas par son adresse à elle**, mais
 *    par un `POST` portant un en-tête `Next-Action` sur une route de
 *    l'application. Or `/connexion` est la seule route que le proxy laisse
 *    passer sans cookie : une action déclarée là s'exécuterait **sans session
 *    et sans que rien ne soit contourné**.
 *
 *    Mesuré le 21 août 2026 : Next 16 refuse d'exécuter, sur `/connexion`, une
 *    action déclarée dans une *autre* route — chaque route porte son propre
 *    manifeste d'actions. La surface est donc plus étroite qu'on ne le craint
 *    d'abord. ⚠️ Mais elle se rouvre dès qu'un composant partagé rendu par
 *    `/connexion` (un en-tête commun, demain) importera une action sensible :
 *    elle entrera alors dans le manifeste de `/connexion`. Et ce cloisonnement
 *    est un détail d'implémentation, pas un contrat de sécurité documenté.
 *
 * D'où la règle, sans exception : **toute page et toute action serveur appelle
 * `exigerSession()` en première ligne**, sauf `connecter()` qui *est* la porte.
 * Ce module et `session.ts` sont les deux seuls endroits où cette décision se
 * prend.
 */

import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { NOM_COOKIE_SESSION, lireJeton } from "@/lib/session";

/** Vrai si la requête courante porte un cookie de session valide et non périmé. */
export async function sessionOuverte(): Promise<boolean> {
  const cookiesRecus = await cookies();
  return lireJeton(cookiesRecus.get(NOM_COOKIE_SESSION)?.value) !== null;
}

/**
 * Ferme la porte : renvoie vers `/connexion` si la session n'est pas ouverte.
 *
 * ⚠️ `redirect()` fonctionne en levant une exception que Next.js intercepte.
 * Ne jamais entourer un appel à cette fonction d'un `try/catch` qui avale
 * l'erreur : la redirection serait annulée et la page s'afficherait quand même.
 */
export async function exigerSession(): Promise<void> {
  if (!(await sessionOuverte())) {
    redirect("/connexion");
  }
}
