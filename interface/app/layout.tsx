import type { Metadata } from "next";
import { Fredoka, Geist_Mono, Nunito } from "next/font/google";
import "./globals.css";

import { CLE_THEME } from "@/lib/theme";

/**
 * Titrage. Fredoka est la police des titres du système 1st-Pouf.
 *
 * ⚠️ **Elle n'est PAS livrée par le registre**, contrairement à ce que sa
 * vitrine laisse croire : `pouf.css` ne déclare que Nunito, et Fredoka n'est
 * utilisée que par le site de documentation. Sans cette ligne, les titres
 * retombent sur Nunito et l'interface perd le trait qui la distingue — sans le
 * moindre message d'erreur pour le signaler.
 */
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

/**
 * Texte courant et interface — la police du système 1st-Pouf.
 *
 * ⚠️ **Chargée par `next/font` et non par `@fontsource-variable/nunito`**, que
 * la documentation du registre recommande. `next/font` héberge la police avec
 * l'application au lieu de la faire venir d'ailleurs, la précharge, et supprime
 * le décalage de mise en page quand elle arrive. C'est aussi une dépendance npm
 * de moins.
 */
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

/**
 * Données, libellés, métadonnées.
 *
 * ⚠️ **Geist Mono survit à la refonte, et c'est une décision.** 1st-Pouf n'a
 * aucune police à chasse fixe. Or les salaires, les dates et les notes
 * s'alignent en colonne d'une ligne à l'autre : sans chasse fixe, « 34-36 k€ »
 * et « 45-55 k€ » n'ont plus la même largeur et la colonne ondule sur deux
 * cents lignes.
 */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Le thème : trois choix, une seule logique, exécutée avant la peinture.
 *
 * ⚠️ **Ce script est la SEULE copie de la règle « quel choix donne quel
 * mode », et c'est délibéré.** Le bouton de bascule (`bascule-theme.tsx`) ne la
 * réimplémente pas : il écrit le choix et appelle `window.__poserTheme`, posée
 * ici. Deux copies auraient divergé au premier ajustement — celle du bouton
 * s'applique au clic, celle-ci au chargement, et un écart entre les deux ne se
 * verrait qu'après un rechargement, c'est-à-dire jamais pendant qu'on teste.
 *
 * ⚠️ **Il s'exécute avant la peinture, sinon l'écran clignoterait en clair** une
 * fraction de seconde avant de basculer. C'est aussi pour ça qu'il ne peut pas
 * être un module importé : il doit être inline dans le `<head>`.
 *
 * ⚠️ **`data-choix-theme` et non `data-theme`** : `pouf.css` réagit déjà à
 * `[data-theme='dark']` et `[data-theme='light']`. Y écrire nos valeurs
 * françaises ne casserait rien aujourd'hui — « sombre » n'est pas « dark » —
 * mais poserait un attribut que la feuille du système surveille, et le jour où
 * l'un de nos mots coïnciderait, le style s'appliquerait sans qu'on comprenne
 * d'où il vient.
 *
 * ⚠️ **`localStorage` est enveloppé dans son propre `try`** : il lève dans
 * Safari en navigation privée sur les vieilles versions, et sur un navigateur
 * qui refuse le stockage. On retombe alors sur « suit le système », qui est le
 * comportement d'avant ce bouton.
 *
 * ⚠️ **`appliquer` prend un choix FORCÉ, et c'est un correctif de revue du
 * 29 août 2026.** Sans lui, elle relisait toujours le stockage : quand
 * l'écriture du bouton échouait (stockage refusé), elle retrouvait l'ancienne
 * valeur et **ne changeait rien** — ni la classe, ni l'attribut, ni donc
 * l'icône. Le bouton devenait totalement inerte, sans message, ce qui est
 * exactement ce que le composant dit vouloir éviter. Le clic passe désormais sa
 * valeur en mémoire ; le stockage n'est qu'une mémoire pour le prochain
 * chargement.
 *
 * ⚠️ **`dernierChoix` est la SECONDE moitié de ce correctif, et la première ne
 * suffisait pas — trouvé par une deuxième revue le même jour.** Le clic
 * s'appliquait bien, mais l'écouteur de `matchMedia`, lui, appelle `appliquer()`
 * **sans argument** : il relisait donc le stockage, n'y trouvait rien (l'écriture
 * ayant échoué) et retombait sur « systeme ». Scénario réel : navigation privée,
 * choix « clair » forcé, macOS bascule en sombre au coucher du soleil — la page
 * vire au sombre et l'icône revient au moniteur, sans que rien n'ait été cliqué.
 * Le choix de la session vit désormais dans cette variable de fermeture.
 *
 * ⚠️ **L'écoute du système reste active en permanence**, et c'est ce qui rend
 * le choix « Système » vivant : basculer le réglage de macOS change la page
 * sans la recharger. Quand le choix est « clair » ou « sombre », `appliquer`
 * relit le stockage et ignore le système — l'écouteur ne fait rien de mal.
 *
 * ⚠️ **`storage` synchronise les onglets, et l'oublier ici aurait produit un
 * défaut bancal plutôt qu'une absence de fonctionnalité.** Le bouton écoute le
 * même événement pour rafraîchir son icône : sans cette ligne, un second onglet
 * afficherait la lune sur une page restée claire. Cet événement ne se déclenche
 * jamais dans l'onglet qui a écrit — c'est le clic qui s'en charge là-bas.
 */
const SCRIPT_THEME = `
(function () {
  try {
    var media = window.matchMedia("(prefers-color-scheme: dark)");
    /* Le dernier choix appliqué, gardé en mémoire. C'est le repli quand le
       stockage n'a pas pu être écrit : sans lui, un navigateur qui refuse
       localStorage perdait le choix de la session au premier changement de
       thème du système. */
    var dernierChoix = null;
    var lire = function () {
      try {
        var valeur = window.localStorage.getItem(${JSON.stringify(CLE_THEME)});
        if (valeur === "clair" || valeur === "sombre") return valeur;
      } catch (erreur) {
        /* Stockage refusé : on se rabat sur la mémoire de la session. */
      }
      return dernierChoix || "systeme";
    };
    var appliquer = function (force) {
      var choix =
        force === "clair" || force === "sombre" || force === "systeme"
          ? force
          : lire();
      dernierChoix = choix;
      var sombre = choix === "sombre" || (choix === "systeme" && media.matches);
      document.documentElement.classList.toggle("dark", sombre);
      document.documentElement.setAttribute("data-choix-theme", choix);
    };
    window.__poserTheme = appliquer;
    appliquer();
    /* Enveloppés : ces deux écouteurs passent un ÉVÉNEMENT en premier
       argument. Branchés directement, cet objet arriverait dans le paramètre
       "force" — il serait rejeté par le contrôle ci-dessus, mais compter
       là-dessus est une coïncidence, pas une intention.
       (Pas d'accent grave dans ce script : il est écrit dans une chaîne
       template, et un accent grave la refermerait au milieu du JavaScript.) */
    media.addEventListener("change", function () { appliquer(); });
    window.addEventListener("storage", function () { appliquer(); });
  } catch (erreur) {
    /* Navigateur sans matchMedia : on reste en clair, qui est le mode par défaut. */
  }
})();
`;

export const metadata: Metadata = {
  title: "Veille offres emploi IA",
  description:
    "Veille quotidienne sur les offres d'emploi dans l'IA en Île-de-France.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      // Le script ci-dessous ajoute une classe au <html> avant l'hydratation :
      // sans cette annonce, React signalerait une différence serveur/navigateur.
      suppressHydrationWarning
      className={`${fredoka.variable} ${nunito.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_THEME }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
