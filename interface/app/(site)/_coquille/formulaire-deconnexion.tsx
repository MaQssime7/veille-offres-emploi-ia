"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LogOut } from "lucide-react";

/**
 * Le formulaire de déconnexion, côté navigateur.
 *
 * ⚠️ **Il est client pour une raison précise, apprise en le cassant** : quand la
 * session est tombée, `proxy.ts` répond **401** au `POST` de l'action serveur
 * — délibérément, parce qu'une redirection ferait suivre le navigateur jusqu'à
 * `/connexion` et le bouton ne ferait *rien du tout*. Mais personne ne
 * traitait ce 401 : le routeur de Next levait « An unexpected response was
 * received from the server » et remplaçait la page par son écran de secours,
 * **en anglais et sans issue**, sur un produit entièrement français.
 *
 * ⚠️ **Un `error.tsx` ne rattrape pas ce cas** — vérifié le 21 août 2026 : cet
 * échec-là n'est pas une erreur de rendu React, il est traité par le routeur
 * au-dessus des frontières d'erreur, qui n'est donc jamais consultée. Le seul
 * endroit où le cas peut être traité est ici, autour de l'appel.
 *
 * Le scénario n'a rien de théorique : onglet resté ouvert, session expirée
 * pendant la nuit, clic le lendemain matin.
 *
 * `useTransition` sert le second usage : tant que l'action est en vol, le
 * bouton est désactivé. Sans ça, un double clic sur connexion lente enverrait
 * une seconde action qui arriverait *après* la suppression du cookie — donc
 * dans le cas 401 ci-dessus, pour rien.
 *
 * Contrepartie assumée : la déconnexion ne fonctionne plus sans JavaScript. Sur
 * un site qui est déjà une application React derrière un mot de passe, l'échange
 * est bon — un écran mort en anglais coûte plus cher.
 */
export function FormulaireDeconnexion({
  deconnecter,
}: {
  deconnecter: () => Promise<void>;
}) {
  const [enCours, demarrer] = useTransition();
  const routeur = useRouter();

  function envoyer() {
    demarrer(async () => {
      try {
        await deconnecter();
      } catch {
        // Session déjà tombée : le proxy a répondu 401 avant même que l'action
        // s'exécute. Le cookie est mort de toute façon — l'utilisateur veut
        // sortir, on l'emmène à la porte, ce qu'il demandait au fond.
        routeur.push("/connexion");
        routeur.refresh();
      }
    });
  }

  return (
    <form action={envoyer}>
      {/* ⚠️ **Une ICÔNE SEULE, à toutes les largeurs** — décision de Maxime,
          31 août 2026, après avoir vu la barre : « SE DÉCONNECTER » en mono
          majuscules pesait plus lourd que les deux onglets réunis et donnait à
          la sortie le poids visuel d'une destination.

          ⚠️ **Le libellé n'est pas perdu, il change de canal** : `aria-label` le
          dit aux lecteurs d'écran, `title` l'affiche au survol. Une icône seule
          sans l'un des deux serait une commande muette — et celle-ci fait sortir
          du site.

          ⚠️ **Même habit rond que le bouton de thème**, et ce n'est pas
          cosmétique : deux boutons voisins de formes différentes se lisent comme
          deux natures différentes. `<Button>` de shadcn est abandonné ici pour
          cette raison — sa variante `ghost` est rectangulaire et son `size="sm"`
          impose une hauteur qui ne cadre pas avec le rond de 36 px d'à côté. */}
      <button
        type="submit"
        disabled={enCours}
        aria-label={enCours ? "Déconnexion en cours" : "Se déconnecter"}
        title="Se déconnecter"
        className="cushion-control inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-card p-2 text-foreground transition-colors hover:bg-accent focus-produit disabled:opacity-60"
      >
        <LogOut className="size-4" aria-hidden="true" />
      </button>
    </form>
  );
}
