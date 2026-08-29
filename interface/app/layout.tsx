import type { Metadata } from "next";
import { Fredoka, Geist_Mono, Nunito } from "next/font/google";
import "./globals.css";

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
 * Le mode sombre suit la préférence du système, sans bascule manuelle : le PRD
 * n'en demande pas.
 *
 * Ce script s'exécute avant la peinture de la page, sinon l'écran clignoterait
 * en clair une fraction de seconde avant de basculer. Il pose la classe que
 * `globals.css` attend (`@custom-variant dark (&:is(.dark *))`) et reste à
 * l'écoute : basculer le réglage de macOS change la page sans la recharger.
 */
const SCRIPT_MODE_SOMBRE = `
(function () {
  try {
    var media = window.matchMedia("(prefers-color-scheme: dark)");
    var appliquer = function (sombre) {
      document.documentElement.classList.toggle("dark", sombre);
    };
    appliquer(media.matches);
    media.addEventListener("change", function (evenement) {
      appliquer(evenement.matches);
    });
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
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_MODE_SOMBRE }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
