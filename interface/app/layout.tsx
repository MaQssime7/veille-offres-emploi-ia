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

export const metadata: Metadata = {
  title: "Veille offres emploi IA",
  description:
    "Veille quotidienne sur les offres d'emploi dans l'IA en Île-de-France.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${fraunces.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
