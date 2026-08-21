import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Titrage. Fraunces est variable : on charge la plage de graisses,
// le DESIGN.md n'en utilise que 700.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

// Texte courant et interface.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Données, libellés, métadonnées, code.
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
      className={`${fraunces.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_MODE_SOMBRE }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
