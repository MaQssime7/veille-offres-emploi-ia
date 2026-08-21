/**
 * La porte, au niveau du réseau.
 *
 * ⚠️ **Aucun `matcher` n'est déclaré, et c'est délibéré.** Le proxy s'exécute
 * donc sur *toutes* les requêtes, et c'est le code ci-dessous qui écarte les
 * quelques exceptions. Deux raisons :
 *
 * 1. Énumérer les adresses à protéger laisserait toute adresse ajoutée plus
 *    tard ouverte, sans le moindre avertissement.
 * 2. La documentation Next.js 16 montre `export const config` là où d'autres
 *    sources annoncent `proxyConfig`. Sans matcher, se tromper de nom n'a
 *    aucune conséquence — le proxy tourne partout. Avec une liste blanche
 *    d'adresses protégées, la même erreur aurait ouvert le site en silence.
 *
 * Ce fichier tourne en runtime Node.js : depuis Next 16, le proxy n'accepte
 * plus l'Edge et ce n'est pas configurable. `node:crypto` y est donc utilisable.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  NOM_COOKIE_SESSION,
  SEUIL_PROLONGATION_MS,
  fabriquerJeton,
  lireJeton,
  optionsCookie,
} from "@/lib/session";

/** La porte elle-même : c'est la seule page atteignable sans cookie. */
const ADRESSE_CONNEXION = "/connexion";

/**
 * Les ressources que le navigateur réclame pour afficher la porte : sans
 * elles, la page de connexion arriverait sans style ni police.
 *
 * `/_next/static/` ne sert que des fichiers de compilation — jamais de données
 * d'offres, qui transitent par le rendu serveur des pages.
 */
function estRessourceDeChargement(chemin: string): boolean {
  return (
    chemin.startsWith("/_next/") ||
    chemin === "/favicon.ico" ||
    chemin === "/robots.txt"
  );
}

export function proxy(requete: NextRequest) {
  const chemin = requete.nextUrl.pathname;

  if (estRessourceDeChargement(chemin)) {
    return NextResponse.next();
  }

  const echeance = lireJeton(requete.cookies.get(NOM_COOKIE_SESSION)?.value);
  const sessionOuverte = echeance !== null;

  if (chemin === ADRESSE_CONNEXION) {
    // Déjà entré : inutile de remontrer la porte.
    return sessionOuverte
      ? NextResponse.redirect(new URL("/", requete.url))
      : NextResponse.next();
  }

  if (!sessionOuverte) {
    // ⚠️ Une action serveur ne se redirige pas. Elle s'invoque par un `POST`
    // portant l'en-tête `Next-Action` ; un 307 ferait suivre le navigateur
    // jusqu'à `/connexion`, qui répondrait `200` avec un corps vide — et le
    // bouton cliqué ne ferait **rien du tout**, sans erreur ni renvoi vers la
    // porte. Le cas arrive pour de vrai : session expirée pendant la nuit,
    // onglet resté ouvert, clic le lendemain matin.
    //
    // Un 401 explicite laisse au contraire l'appelant traiter l'échec.
    if (requete.headers.get("next-action")) {
      const reponse = NextResponse.json(
        { erreur: "session_absente" },
        { status: 401 },
      );
      reponse.cookies.delete({ name: NOM_COOKIE_SESSION, path: "/" });
      return reponse;
    }

    const porte = new URL(ADRESSE_CONNEXION, requete.url);
    // On mémorise où l'utilisateur voulait aller. `destinationSure` relira
    // cette valeur avant de s'en servir : elle transite par la barre
    // d'adresse, donc elle est écrite par l'extérieur.
    porte.searchParams.set("suite", chemin + requete.nextUrl.search);

    const reponse = NextResponse.redirect(porte);
    // Un cookie périmé ou trafiqué traînerait à chaque requête suivante.
    reponse.cookies.delete({ name: NOM_COOKIE_SESSION, path: "/" });
    return reponse;
  }

  const reponse = NextResponse.next();

  // Session glissante : on repousse l'échéance quand le cookie a plus d'un
  // jour. Sinon « 30 jours d'inactivité » deviendrait « 30 jours tout court ».
  if (echeance - Date.now() < SEUIL_PROLONGATION_MS) {
    reponse.cookies.set(NOM_COOKIE_SESSION, fabriquerJeton(), optionsCookie());
  }

  return reponse;
}
