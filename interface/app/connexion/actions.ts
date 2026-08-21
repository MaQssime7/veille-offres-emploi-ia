"use server";

/**
 * L'action qui ouvre la porte.
 *
 * Entre : le mot de passe saisi et l'adresse où l'utilisateur voulait aller.
 * Sort : soit un message d'erreur affiché sous le champ, soit un cookie de
 * session posé et une redirection.
 *
 * Si ce fichier tombe, personne n'entre — c'est le sens de marche voulu.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { EtatConnexion } from "./etat";
import {
  ConfigurationManquante,
  NOM_COOKIE_SESSION,
  destinationSure,
  fabriquerJeton,
  motDePasseCorrect,
  optionsCookie,
  verifierConfiguration,
} from "@/lib/session";

/**
 * Une seconde de délai sur chaque tentative ratée.
 *
 * Ce n'est pas ce qui protège le site — un mot de passe de 24 caractères tirés
 * au hasard est hors de portée d'un forçage brut même sans aucun délai. C'est
 * ce qui rend le forçage inintéressant à tenter et qui noie les mesures de
 * temps. Un compteur de tentatives a été écarté : en mémoire il ne survivrait
 * pas à l'hébergement sans état de Vercel, et en base il coûterait une table
 * pour un seul utilisateur.
 */
const DELAI_TENTATIVE_RATEE_MS = 1000;

function patienter(millisecondes: number): Promise<void> {
  return new Promise((resoudre) => setTimeout(resoudre, millisecondes));
}

export async function connecter(
  _precedent: EtatConnexion,
  donnees: FormData,
): Promise<EtatConnexion> {
  const saisi = donnees.get("mot_de_passe");
  const destination = destinationSure(donnees.get("suite"));

  // Les deux secrets d'abord : il ne sert à rien d'accepter un mot de passe
  // qu'on ne saura pas transformer en session. Le message nomme la variable
  // absente — jamais sa valeur — parce que le seul utilisateur du site est
  // aussi celui qui pose les variables chez Vercel.
  try {
    verifierConfiguration();
  } catch (erreur) {
    if (erreur instanceof ConfigurationManquante) {
      return { erreur: `Le site n'est pas configuré. ${erreur.message}` };
    }
    throw erreur;
  }

  const correct = typeof saisi === "string" && saisi.length > 0
    ? motDePasseCorrect(saisi)
    : false;

  if (!correct) {
    await patienter(DELAI_TENTATIVE_RATEE_MS);
    // Message volontairement muet : il ne dit ni si le mot de passe existe,
    // ni s'il était presque bon.
    return { erreur: "Mot de passe incorrect." };
  }

  const cookiesEnCours = await cookies();
  cookiesEnCours.set(NOM_COOKIE_SESSION, fabriquerJeton(), optionsCookie());

  // ⚠️ Hors de tout try/catch : `redirect` lève une exception que Next.js
  // intercepte. Attrapée ici, elle annulerait la redirection.
  redirect(destination);
}
