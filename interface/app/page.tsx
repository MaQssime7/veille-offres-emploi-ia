/**
 * L'accueil.
 *
 * Pour l'instant, la page de contrôle posée par `/installe` — elle sera
 * remplacée par le compte rendu de la nuit. Ce qui compte ici et qui, lui,
 * restera : la première ligne referme la porte.
 *
 * `proxy.ts` a déjà écarté le visiteur sans cookie. On revérifie quand même,
 * au plus près de ce qui s'affiche : c'est cette ligne-là qui protégera la
 * page quand elle lira des offres.
 */

import { exigerSession } from "@/lib/acces";

import { PageDeControle } from "./_controle/page-de-controle";

export default async function Accueil() {
  await exigerSession();

  return <PageDeControle />;
}
