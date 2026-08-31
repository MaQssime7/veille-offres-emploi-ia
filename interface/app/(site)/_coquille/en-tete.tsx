import { deconnecter } from "./actions";
import { BasculeTheme } from "./bascule-theme";
import { FormulaireDeconnexion } from "./formulaire-deconnexion";
import { LiensNavigation } from "./liens-navigation";

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
 * Composant serveur, délibérément : le bouton de déconnexion est un vrai
 * `<form>` qui poste l'action. Il fonctionne donc même si le JavaScript n'a pas
 * fini de charger.
 *
 * ⚠️ **Seuls les ONGLETS sont passés côté client** (`liens-navigation.tsx`),
 * parce que `usePathname()` n'a pas d'équivalent serveur et qu'un layout ne
 * reçoit pas l'adresse de la page qu'il enveloppe. C'est le plus petit
 * découpage possible : basculer l'en-tête entière aurait emporté la
 * déconnexion avec elle.
 */
export function EnTete() {
  return (
    /* ⚠️ **La barre FLOTTE sur le fond lavande, elle ne le borde plus** —
       demande de Maxime, 31 août 2026, d'après le gabarit 1st-Pouf. L'ancienne
       version était un rectangle blanc collé en haut avec un filet dessous ;
       celle-ci est une pilule blanche posée sur le fond, avec le relief
       « coussin » du système. Le `px-4 pt-4` est ce qui laisse voir le lavande
       tout autour — le retirer recollerait la barre aux bords et annulerait
       l'effet. */
    <header className="px-4 pt-4">
      {/* ⚠️ **`<div>` et non `<nav>`, et c'est un correctif d'accessibilité du
          31 août 2026.** Une première version promouvait la balise au conteneur
          entier : la bascule de thème et le formulaire de déconnexion se
          retrouvaient dans le repère « Navigation principale », c'est-à-dire
          deux commandes qui ne mènent nulle part, listées comme des
          destinations. Le `<nav>` est redescendu autour des seuls onglets, dans
          `liens-navigation.tsx`. */}
      <div
        // ⚠️ **`w-fit` et non `w-full` : la barre épouse son contenu, puis se
        // centre** — décision de Maxime, 31 août 2026, après l'avoir vue à
        // l'écran. Étendue sur toute la largeur de page, elle ouvrait un vide
        // de plusieurs centaines de pixels entre les deux onglets et les deux
        // actions ; le gabarit d'origine remplissait ce vide avec un
        // mot-symbole et quatre liens que ce produit n'a pas.
        // ⚠️ **`max-w-full` n'est pas décoratif** : sans lui, `w-fit` laisse le
        // contenu déborder de l'écran au lieu de le contraindre. À 375 px la
        // barre touche presque les bords, et c'est le libellé « Se
        // déconnecter » — masqué sous 640 px — qui lui rend la place.
        className="mx-auto flex h-16 w-fit max-w-full items-center gap-2 rounded-full bg-card px-3 cushion-card sm:gap-4 sm:px-4"
      >
        {/* ⚠️ **Aucun logo, aucun nom de marque** — décision de Maxime : le
            produit n'a pas de nom, et le gabarit d'origine plaçait là une
            pastille d'icône plus un mot-symbole. Un nom inventé pour remplir un
            emplacement aurait été le pire des deux. L'accueil est donc un
            onglet comme un autre, ce qui a l'avantage de rendre visible où l'on
            se trouve — ce que le titre cliquable d'avant ne faisait pas. */}
        <LiensNavigation />

        {/* ⚠️ **Le bouton de thème est à GAUCHE de la déconnexion, pas à
            droite** : le geste le plus lourd de la barre reste au bout, là où
            on le cherche. Intercaler un réglage entre lui et le bord ferait
            viser « Déconnexion » et cliquer « thème ». */}
        {/* ⚠️ Plus de `ml-auto` depuis que la barre est en `w-fit` : il n'y a
            plus d'espace libre à pousser, et le garder n'aurait rien fait. */}
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
