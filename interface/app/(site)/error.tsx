"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Le filet de sécurité des pages derrière la porte.
 *
 * Sans ce fichier, une erreur non rattrapée pendant le **rendu** de `/` ou
 * `/offres` affiche l'écran générique de Next.js — en anglais, sans issue, sur
 * un produit entièrement en français.
 *
 * ⚠️ **Ce filet ne couvre pas tout, et il faut savoir ce qu'il laisse passer.**
 * Vérifié le 21 août 2026 : l'échec d'une *action serveur* au transport (le
 * 401 que `proxy.ts` renvoie quand la session est tombée) ne passe **pas** par
 * ici — le routeur de Next le traite au-dessus des frontières d'erreur, qui ne
 * sont jamais consultées. Ce cas-là se traite autour de l'appel, dans
 * `_coquille/formulaire-deconnexion.tsx`.
 *
 * ⚠️ **Le message de l'erreur n'est jamais affiché.** Il peut porter du détail
 * de serveur ; l'écran dit ce qui est actionnable, et rien d'autre. Les deux
 * issues proposées couvrent les deux causes réelles : une panne passagère (on
 * réessaie) et une session tombée (on repasse la porte).
 *
 * ⚠️ Une frontière d'erreur est forcément un composant client — c'est React qui
 * l'exige, elle doit pouvoir réagir à un clic.
 */
export default function ErreurSite({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-(--largeur-page) flex-1 px-4 py-10 sm:px-6">
      <div className="flex max-w-prose flex-col items-start gap-4 border border-destructive/40 bg-destructive/5 px-5 py-8 sm:px-8 sm:py-10">
        <span className="text-destructive">
          <TriangleAlert className="size-6" aria-hidden="true" />
        </span>
        <h1 className="font-display text-xl font-bold leading-tight text-foreground">
          Cette page n’a pas pu s’afficher
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Rien n’est perdu&nbsp;: les offres sont en base. Il s’agit soit d’une
          panne passagère, soit d’une session expirée — c’est le cas si l’onglet
          est resté ouvert depuis longtemps.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={reset} size="sm">
            Réessayer
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/connexion">Retourner à la connexion</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
