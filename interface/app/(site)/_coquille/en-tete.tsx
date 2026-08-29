import Link from "next/link";

import { deconnecter } from "./actions";
import { BasculeTheme } from "./bascule-theme";
import { FormulaireDeconnexion } from "./formulaire-deconnexion";

/**
 * La barre du haut, commune à toutes les pages derrière la porte.
 *
 * ⚠️ **Elle vit dans le groupe `(site)` et pas dans `app/layout.tsx`, pour une
 * raison de sécurité.** Une action serveur ne s'invoque pas par une adresse à
 * elle, mais par un `POST` portant l'en-tête `Next-Action` sur une route de
 * l'application — et `/connexion` est la seule route que `proxy.ts` laisse
 * passer sans cookie. Si cet en-tête était rendu par la page de connexion,
 * `deconnecter()` entrerait dans le manifeste d'actions de `/connexion` et
 * deviendrait déclenchable sans session, **sans que rien ne soit contourné**.
 * Le groupe de routes ferme ça par construction : `/connexion` est en dehors,
 * donc elle ne rend jamais ce composant.
 *
 * Composant serveur, délibérément : le bouton est un vrai `<form>` qui poste
 * l'action. Il fonctionne donc même si le JavaScript n'a pas fini de charger.
 */
export function EnTete() {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex w-full max-w-(--largeur-page) items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/"
            // ⚠️ **`whitespace-nowrap`, et c'est un correctif vu à 375 px.**
            // L'arrivée du bouton de thème a resserré la barre : « Veille IA »
            // cassait sur deux lignes et faisait grandir la barre de 20 px sur
            // toutes les pages. Le libellé court n'a plus le droit de se plier.
            className="libelle-mono whitespace-nowrap font-medium text-foreground transition-colors hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            {/* Le nom complet ne tient pas à 375 px à côté du reste de la
                barre. `hidden` masque aussi aux lecteurs d'écran : un seul des
                deux libellés est lu. */}
            <span className="sm:hidden">Veille IA</span>
            <span className="hidden sm:inline">Veille offres emploi IA</span>
          </Link>

          <nav>
            <Link
              href="/offres"
              className="libelle-mono text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              Offres
            </Link>
          </nav>
        </div>

        {/* ⚠️ **Le bouton de thème est à GAUCHE de la déconnexion, pas à
            droite** : le geste le plus lourd de la barre reste au bout, là où
            on le cherche. Intercaler un réglage entre lui et le bord ferait
            viser « Déconnexion » et cliquer « thème ». */}
        <div className="flex shrink-0 items-center gap-2">
          <BasculeTheme />

          {/* L'action serveur est passée en propriété : c'est la seule chose
              qu'un composant serveur a le droit de confier à un composant
              client, et ça garde la décision d'accès (`exigerSession`) du côté
              serveur, où elle est vérifiable. */}
          <FormulaireDeconnexion deconnecter={deconnecter} />
        </div>
      </div>
    </header>
  );
}
