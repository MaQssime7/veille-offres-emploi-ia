"use client";

/**
 * Le verrou qui empêche un clic de tri d'atteindre la mauvaise offre.
 *
 * Entre : la liste d'offres, en enfants.
 * Sort : les mêmes enfants, plus un contexte que les boutons de statut lisent.
 * Casse : rien. Hors de ce fournisseur — sur la fiche, par exemple — le contexte
 * vaut son défaut et aucun verrou ne s'applique, ce qui est exactement ce qu'il
 * faut là où il n'y a qu'une offre.
 *
 * ⚠️ **LE DÉFAUT QU'IL CORRIGE, découvert le 29 août 2026 en testant autre
 * chose.** Trier une offre la retire du filtre « à traiter » : toutes les lignes
 * suivantes remontent alors d'un cran. Un second clic au même endroit de l'écran
 * atteint donc **une autre offre**, qui se trouve triée sans que personne ne
 * l'ait voulu. Mesuré : quatre clics rapides au même pixel ont candidaté
 * **quatre offres différentes**.
 *
 * ⚠️ **Ce n'est PAS le problème du double clic, qui lui était déjà réglé** —
 * trois clics simultanés sur une même offre n'envoient qu'un seul `POST`, et
 * l'écriture est de toute façon idempotente. Désactiver le bouton cliqué ne
 * protège que lui ; ici le danger vient de **ses voisins**, qui glissent sous le
 * curseur pendant qu'il est occupé.
 *
 * ⚠️ **Deux fenêtres de temps distinctes, et le verrou couvre les deux.** Si le
 * second clic arrive *avant* la réorganisation, il retombe sur la même offre —
 * sans dommage, par idempotence. S'il arrive *après*, il trie la suivante. Comme
 * on ne peut pas savoir laquelle des deux se produira, on ferme toute la liste
 * pendant l'écriture au lieu de parier sur le timing.
 *
 * ⚠️ **Le verrou porte sur la LISTE entière, pas sur la ligne.** C'est le point
 * central : le bouton dangereux n'est pas celui qu'on vient de cliquer, c'est
 * celui qui prendra sa place. On ne sait pas lequel c'est — donc on les ferme
 * tous.
 *
 * ⚠️ **Ce que ça coûte, honnêtement** : trier dix offres à la suite impose
 * d'attendre entre chaque, le temps d'un aller-retour vers Supabase à Paris
 * (~200 à 400 ms). C'est le prix d'un tri qui atteint toujours l'offre visée, et
 * c'est le bon arbitrage sur un écran où une erreur envoie l'offre dans un autre
 * filtre sans le signaler.
 */

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type EtatVerrou = {
  /** Vrai pendant qu'une écriture de statut est en cours quelque part. */
  verrouille: boolean;
  /**
   * Signale le début et la fin d'une écriture. Rend une fonction de
   * relâchement, pour que l'appelant ne puisse pas oublier de refermer — un
   * verrou qui reste posé fige la liste jusqu'au rechargement.
   */
  prendre: () => () => void;
};

const ContexteVerrou = createContext<EtatVerrou>({
  // ⚠️ **Le défaut ne verrouille RIEN, et c'est voulu.** Un composant hors
  // liste — la fiche — ne doit pas hériter d'un verrou qui n'a aucun sens chez
  // lui : rien n'y bouge sous le curseur.
  verrouille: false,
  prendre: () => () => {},
});

export function useVerrouTri(): EtatVerrou {
  return useContext(ContexteVerrou);
}

export function VerrouTri({ children }: { children: React.ReactNode }) {
  // ⚠️ **Un COMPTEUR et non un booléen.** Deux écritures peuvent se chevaucher
  // si l'utilisateur clique dans deux lignes avant la fin de la première : avec
  // un booléen, la première à se terminer rouvrirait la liste alors que la
  // seconde est encore en vol. Le compteur ne rouvre qu'à zéro.
  const [enVol, setEnVol] = useState(0);

  const prendre = useCallback(() => {
    setEnVol((n) => n + 1);
    // ⚠️ Un garde-fou de relâchement unique : appeler deux fois la fonction
    // rendue décrémenterait deux fois pour une seule prise, et le compteur
    // passerait sous zéro — la liste resterait alors déverrouillée pendant une
    // écriture réelle.
    let relache = false;
    return () => {
      if (relache) return;
      relache = true;
      setEnVol((n) => Math.max(0, n - 1));
    };
  }, []);

  const valeur = useMemo(
    () => ({ verrouille: enVol > 0, prendre }),
    [enVol, prendre],
  );

  return (
    <ContexteVerrou.Provider value={valeur}>{children}</ContexteVerrou.Provider>
  );
}
