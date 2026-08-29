/**
 * La porte : la seule page du site atteignable sans cookie de session.
 *
 * Le formulaire est isolé dans un composant client ; cette page-ci reste sur
 * le serveur, où elle refait le contrôle que `proxy.ts` a déjà fait. Le
 * doublon est voulu : le proxy est la commodité qui redirige, la vérification
 * dans la page est la serrure.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";

import { sessionOuverte } from "@/lib/acces";
import { destinationSure } from "@/lib/session";

import { FormulaireConnexion } from "./formulaire";

export const metadata: Metadata = {
  title: "Connexion — Veille offres emploi IA",
  // Rien à indexer derrière une porte.
  robots: { index: false, follow: false },
};

export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  if (await sessionOuverte()) {
    redirect("/");
  }

  const { suite } = await searchParams;

  return (
    <main className="flex min-h-svh w-full items-center justify-center px-4 py-10">
      {/* La carte de la porte prend le rayon des cartes de la liste, mais le
          coussin le plus marqué du système (`cushion-card`) : elle est seule au
          milieu de l'écran, rien ne l'entoure pour lui donner un plan. */}
      <div className="w-full max-w-sm rounded-2xl bg-card cushion-card p-6">
        <header className="mb-6 flex flex-col gap-3 border-b border-border pb-5">
          <p className="flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-widest text-muted-foreground">
            <LockKeyhole className="size-3.5" aria-hidden="true" />
            Accès privé
          </p>
          <h1 className="font-display text-3xl font-bold leading-tight text-foreground">
            Veille offres emploi IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Ce site est réservé. Entre le mot de passe pour accéder aux offres.
          </p>
        </header>

        <FormulaireConnexion suite={destinationSure(suite)} />
      </div>
    </main>
  );
}
