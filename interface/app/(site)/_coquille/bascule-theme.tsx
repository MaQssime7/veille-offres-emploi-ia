"use client";

/**
 * Le bouton de thème de la barre du haut : système → clair → sombre → système.
 *
 * Entre : rien. Il lit le choix courant sur le `<html>`, où le script du
 * `<head>` vient de l'écrire.
 * Sort : un bouton qui écrit le choix suivant et l'applique aussitôt.
 * Casse : si `localStorage` refuse d'écrire, le thème change quand même pour la
 * session — il ne sera simplement pas retenu au prochain chargement. ⚠️ Ce n'était
 * PAS vrai avant la revue du 29 août 2026 : le bouton était alors inerte, voir
 * plus bas.
 *
 * ⚠️ **Il n'implémente PAS la règle « quel choix donne quel mode ».** Elle vit
 * dans le script inline de `app/layout.tsx`, qui l'expose sous
 * `window.__poserTheme`. Ce bouton écrit une préférence et demande à ce
 * script de relire — donc une seule copie de la logique, appliquée au
 * chargement comme au clic. La recopier ici aurait produit un écart invisible :
 * il ne se serait vu qu'après un rechargement.
 *
 * ⚠️ **Le premier rendu affiche « Système », toujours.** Le serveur ne peut pas
 * connaître le stockage du navigateur ; l'icône se corrige à l'hydratation, en
 * une fraction de seconde. C'est un défaut assumé, borné à l'icône du bouton :
 * **la page, elle, ne clignote pas**, puisque son thème est posé avant la
 * peinture. L'éviter demanderait d'afficher les trois icônes et d'en masquer
 * deux par CSS — plus de code, et un libellé accessible qui ne pourrait plus
 * suivre.
 *
 * ⚠️ **`useSyncExternalStore` et non `useState` + `useEffect`, et ce n'est pas
 * un raffinement — c'est le bon outil et le linter l'a imposé.** La vérité du
 * thème n'est pas dans React : elle est sur le `<html>`, posée par un script
 * qui s'exécute avant que React n'existe. Lire cette vérité dans un effet et
 * la recopier dans un état, c'est fabriquer une seconde source qu'il faut
 * ensuite tenir d'accord avec la première — plus un rendu en cascade à chaque
 * montage, que `react-hooks/set-state-in-effect` refuse. Ce hook lit
 * directement la source, avec un instantané SERVEUR distinct : c'est lui qui
 * évite l'erreur d'hydratation sans `suppressHydrationWarning`.
 */

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import {
  CHOIX_THEME,
  CHOIX_THEME_PAR_DEFAUT,
  CLE_THEME,
  LIBELLES_THEME,
  type ChoixTheme,
  estChoixTheme,
} from "@/lib/theme";

const ICONES: Record<ChoixTheme, typeof Monitor> = {
  systeme: Monitor,
  clair: Sun,
  sombre: Moon,
};

/**
 * Les abonnés au changement de thème — c'est-à-dire ce bouton, et lui seul.
 *
 * ⚠️ **Un `Set` au niveau du module et non un état React** : `useSyncExternalStore`
 * demande une source *extérieure* à React. Le composant s'y abonne au montage et
 * s'en retire au démontage.
 */
const abonnes = new Set<() => void>();

function sabonner(prevenir: () => void) {
  abonnes.add(prevenir);

  // ⚠️ **`storage` ne se déclenche que dans les AUTRES onglets**, jamais dans
  // celui qui écrit — c'est la définition de l'événement. C'est exactement ce
  // qu'on veut : le second onglet ouvert sur le site suit le choix fait dans le
  // premier, icône comprise. Le script du `<head>` écoute le même événement
  // pour reposer la classe ; sans lui, l'autre onglet changerait d'icône sans
  // changer de couleurs.
  window.addEventListener("storage", prevenir);

  return () => {
    abonnes.delete(prevenir);
    window.removeEventListener("storage", prevenir);
  };
}

/**
 * ⚠️ **On lit l'attribut du `<html>`, pas `localStorage` directement.** Le
 * script du `<head>` a déjà fait la lecture et son repli sur « Système » ;
 * relire le stockage ici referait ce travail et pourrait en diverger.
 *
 * ⚠️ **Il doit rendre la MÊME chaîne tant que rien ne change** : React compare
 * l'instantané à chaque rendu et boucle indéfiniment si la valeur change sans
 * raison. Une chaîne se compare par valeur, donc c'est acquis ici ; ça ne le
 * serait pas si cette fonction rendait un objet fabriqué à chaque appel.
 */
function lireChoix(): ChoixTheme {
  const pose = document.documentElement.getAttribute("data-choix-theme");
  return estChoixTheme(pose) ? pose : CHOIX_THEME_PAR_DEFAUT;
}

/** Ce que le serveur rend, faute de navigateur où lire. */
function lireChoixServeur(): ChoixTheme {
  return CHOIX_THEME_PAR_DEFAUT;
}

export function BasculeTheme() {
  const choix = useSyncExternalStore(sabonner, lireChoix, lireChoixServeur);

  const suivant =
    CHOIX_THEME[(CHOIX_THEME.indexOf(choix) + 1) % CHOIX_THEME.length];

  function basculer() {
    try {
      window.localStorage.setItem(CLE_THEME, suivant);
    } catch {
      // Stockage refusé (navigation privée, réglage strict) : on continue.
      // Le thème changera pour cette page, il ne sera pas retenu.
    }

    // ⚠️ **Le choix part en ARGUMENT, il n'est pas relu du stockage** — c'est
    // un correctif de revue du 29 août 2026. `__poserTheme()` sans argument
    // relit `localStorage` : quand le `setItem` ci-dessus a échoué, elle y
    // retrouvait l'ancienne valeur et ne changeait donc **rien du tout** — ni
    // les couleurs, ni l'icône, ni le libellé. Le `try/catch` avalait l'échec
    // et le bouton devenait inerte en silence, ce que le commentaire d'à côté
    // dit précisément vouloir éviter.
    //
    // ⚠️ Le repli existe pour un cas réel : si le script du `<head>` n'a pas
    // pu s'installer, le bouton pose au moins la classe lui-même plutôt que de
    // ne rien faire du tout — un bouton inerte est le pire des deux.
    const poser = (window as unknown as { __poserTheme?: (force?: string) => void })
      .__poserTheme;

    if (poser) {
      poser(suivant);
    } else {
      document.documentElement.classList.toggle("dark", suivant === "sombre");
      document.documentElement.setAttribute("data-choix-theme", suivant);
    }

    // ⚠️ **Le re-rendu ne vient PAS du clic mais de cette notification**, et
    // l'ordre compte : l'attribut du `<html>` est déjà posé quand les abonnés
    // relisent. Prévenir avant l'aurait fait lire l'ancienne valeur, et l'icône
    // serait restée d'un cran en retard sur la page.
    for (const prevenir of abonnes) prevenir();
  }

  const Icone = ICONES[choix];

  return (
    <button
      type="button"
      onClick={basculer}
      // ⚠️ **Le libellé dit l'état ACTUEL et l'infobulle dit l'effet du clic.**
      // Un bouton qui cycle sur trois valeurs ne peut pas se nommer par son
      // effet seul — « Passer en clair » ne dirait pas où l'on est — ni par son
      // état seul, qui ne dirait pas ce qui va se passer. Les deux ensemble
      // rendent le cycle compréhensible sans l'essayer.
      aria-label={`${LIBELLES_THEME[choix]}. Cliquer pour : ${LIBELLES_THEME[suivant].toLowerCase()}`}
      title={`${LIBELLES_THEME[choix]} — cliquer pour ${LIBELLES_THEME[suivant].toLowerCase()}`}
      // ⚠️ **`p-2` et non une icône nue** : la surface visible fait 30 × 30 px,
      // au-dessus des 24 px minimum de WCAG 2.5.8, sans dépasser la hauteur de
      // la barre du haut.
      // ⚠️ Focus par `outline` (`focus-produit`) et jamais `ring` : le coussin
      // pose un `box-shadow` brut qui écraserait l'anneau de Tailwind.
      className="cushion-control inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-card p-2 text-foreground transition-colors hover:bg-accent focus-produit"
    >
      <Icone className="size-4" aria-hidden="true" />
    </button>
  );
}
