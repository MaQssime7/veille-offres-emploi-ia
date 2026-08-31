"use client";

import { Trash2, Undo2 } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import {
  DUREE_ANNULATION_MS,
  LIBELLE_ANNULER,
  LIBELLE_RESTAURER,
  LIBELLE_SUPPRIMER,
  MESSAGE_RETRAIT,
} from "@/lib/suppression";
import { cn } from "@/lib/utils";

/**
 * La corbeille : le bouton qui retire une offre de l'affichage, et la barre qui
 * permet d'annuler.
 *
 * Entre : l'identifiant de l'offre, et l'action serveur — jamais l'objet offre.
 * Sort : un bouton, et une barre d'annulation posée en bas de l'écran.
 * Casse : un échec d'écriture remet la ligne et affiche le motif ; rien n'est
 * perdu, puisque rien n'est effacé.
 *
 * ---------------------------------------------------------------------------
 *
 * ⚠️ **Le bouton et la barre sont SÉPARÉS, et ce n'est pas un choix de
 * rangement.** Cliquer la corbeille fait disparaître la ligne — donc le bouton
 * avec elle. Une barre d'annulation rendue *par* le bouton serait démontée à
 * l'instant même où elle devient utile. Elle vit donc au-dessus, dans un
 * fournisseur posé par le layout, et lui survit.
 *
 * ⚠️ **Le contexte ne transporte que des chaînes** — un identifiant, un
 * intitulé. Règle 4 du `CLAUDE.md` : on ne passe jamais l'objet `offre` entier
 * à un composant client, sous peine d'envoyer `contact_nom`, la note
 * personnelle et la charge brute dans le graphe du navigateur.
 */

type EtatBarre = {
  identifiant: string;
  /** L'intitulé, pour que la barre dise DE QUOI elle parle. */
  intitule: string;
};

type Corbeille = {
  retirer: (identifiant: string, intitule: string) => void;
  /**
   * Une écriture est-elle en vol ?
   *
   * ⚠️ **Exposé pour que les boutons se DÉSACTIVENT, et c'est un correctif de
   * revue du 31 août 2026.** Sans lui, deux clics rapprochés sur deux lignes
   * différentes écrasaient la barre du premier : l'offre A partait à la
   * corbeille sans annulation possible, et rien à l'écran ne le disait. La
   * fenêtre n'est pas théorique — le `CLAUDE.md` a mesuré que la ligne met
   * ~900 ms à quitter le DOM après la fin de l'action serveur.
   */
  enCours: boolean;
};

const ContexteCorbeille = createContext<Corbeille | null>(null);

/**
 * Le fournisseur, posé une seule fois par le layout du groupe `(site)`.
 *
 * ⚠️ **Il enveloppe des enfants SERVEUR sans les faire basculer côté client** —
 * même motif que `VerrouTri` : les pages arrivent en `children` déjà
 * fabriquées, le fournisseur ne fait que les traverser.
 */
export function FournisseurCorbeille({
  definirSuppression,
  children,
}: {
  definirSuppression: (
    identifiant: string,
    supprime: boolean,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  children: ReactNode;
}) {
  const [barre, setBarre] = useState<EtatBarre | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  // ⚠️ **La minuterie est armée par un `useEffect` sur l'APPARITION de la
  // barre, pas au retour de l'action** — correctif de revue du 31 août 2026.
  // Armée dans le même tick que `setBarre`, elle démarrait avant que React ait
  // commité le rendu : sur ce projet, la mesure connue est de ~900 ms entre la
  // fin d'une action serveur et le DOM à jour, donc la barre restait visible
  // ~7,1 s pour une constante qui en annonce 8 — et l'écart grandit sur réseau
  // lent. La fenêtre d'annulation doit valoir ce qu'elle dit valoir.
  useEffect(() => {
    if (!barre) return;
    const minuterie = setTimeout(() => setBarre(null), DUREE_ANNULATION_MS);
    return () => clearTimeout(minuterie);
  }, [barre]);

  const retirer = useCallback(
    (identifiant: string, intitule: string) => {
      setErreur(null);
      demarrer(async () => {
        const resultat = await definirSuppression(identifiant, true);
        if (!resultat.ok) {
          setErreur(resultat.message);
          return;
        }
        setBarre({ identifiant, intitule });
      });
    },
    [definirSuppression],
  );

  function annuler() {
    if (!barre) return;
    const cible = barre;
    demarrer(async () => {
      const resultat = await definirSuppression(cible.identifiant, false);
      if (!resultat.ok) {
        // ⚠️ **La barre reste OUVERTE sur échec** — correctif de revue du
        // 31 août 2026. Elle était fermée avant même de savoir si la
        // restauration avait abouti : l'offre restait retirée, le seul
        // raccourci de retour disparaissait, et le message n'indiquait nulle
        // part que la fiche est l'autre chemin. On ne referme que sur succès.
        setErreur(resultat.message);
        return;
      }
      setBarre(null);
    });
  }

  return (
    <ContexteCorbeille.Provider value={{ retirer, enCours }}>
      {children}

      {/* ⚠️ **`aria-live="polite"` sur le CONTENEUR, jamais sur le texte qui
          change** — même règle que les étapes de l'enrichissement : un
          `aria-live` posé sur un élément qui apparaît n'annonce rien, parce
          qu'il n'était pas là pour être observé. Le conteneur, lui, est présent
          depuis le premier rendu. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-4"
      >
        {/* ⚠️ **L'erreur et la barre sont EMPILÉES, pas exclusives** —
            correctif de revue du 31 août 2026. Elles partageaient un emplacement
            et l'erreur gagnait : un échec sur l'offre B masquait la barre encore
            active de l'offre A, dont la minuterie continuait à courir invisible.
            Fermer l'erreur faisait réapparaître une barre en cours de décompte,
            ou rien du tout si le délai avait expiré — et l'annulation de A était
            perdue sans qu'on l'ait jamais vue partir. Deux états indépendants
            demandent deux emplacements. */}
        {erreur && (
          <div className="pointer-events-auto flex max-w-full items-center gap-3 rounded-2xl border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">
            <span className="min-w-0">{erreur}</span>
            <button
              type="button"
              onClick={() => setErreur(null)}
              className="shrink-0 rounded-full px-2 py-1 font-bold underline underline-offset-2 focus-produit"
            >
              Fermer
            </button>
          </div>
        )}

        {barre && (
          <div className="pointer-events-auto flex max-w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-sm text-foreground cushion-card">
            {/* L'intitulé est tronqué : un titre de 223 caractères existe en
                base (mesuré le 28 août 2026), il pousserait le bouton
                d'annulation hors de l'écran. */}
            <span className="min-w-0 truncate">
              {MESSAGE_RETRAIT}{" "}
              <span className="text-muted-foreground">{barre.intitule}</span>
            </span>
            <button
              type="button"
              onClick={annuler}
              disabled={enCours}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary-engage px-3 py-1.5 font-bold text-primary-foreground focus-produit disabled:opacity-60"
            >
              <Undo2 className="size-3.5" aria-hidden="true" />
              {LIBELLE_ANNULER}
            </button>
          </div>
        )}
      </div>
    </ContexteCorbeille.Provider>
  );
}

/**
 * Le bouton corbeille d'une ligne ou d'une fiche.
 *
 * ⚠️ **Il ne reçoit QUE deux chaînes** : l'identifiant et l'intitulé. Voir la
 * règle 4 du `CLAUDE.md` — `<BoutonCorbeille offre={offre} />` compilerait sans
 * la moindre erreur et enverrait toutes les colonnes dans la page.
 *
 * ⚠️ **Hors du fournisseur, il ne s'affiche pas plutôt que de planter.** Un
 * bouton mort qui ne dit rien vaut mieux qu'un écran blanc, et l'absence se
 * verra tout de suite en développement.
 */
export function BoutonCorbeille({
  identifiant,
  intitule,
  className,
}: {
  identifiant: string;
  intitule: string;
  className?: string;
}) {
  const corbeille = useContext(ContexteCorbeille);
  if (!corbeille) return null;

  return (
    <button
      type="button"
      onClick={() => corbeille.retirer(identifiant, intitule)}
      // ⚠️ **Désactivé pendant qu'une écriture est en vol** — correctif de revue
      // du 31 août 2026. Il n'y a qu'une barre d'annulation : deux clics
      // rapprochés sur deux lignes différentes faisaient écraser la première
      // sans un mot, et l'offre A partait sans retour possible. La fenêtre est
      // mesurée sur ce projet — ~900 ms entre la fin de l'action serveur et la
      // ligne réellement retirée du DOM — donc largement suffisante pour
      // cliquer une seconde fois.
      disabled={corbeille.enCours}
      // ⚠️ **Le libellé n'est jamais dessiné, seulement annoncé.** La rangée
      // porte déjà « Candidaté » et « Écarté » en toutes lettres ; un troisième
      // mot la ferait déborder à 375 px. L'icône seule est donc accompagnée
      // d'un `aria-label`, sans quoi le bouton serait muet.
      aria-label={`${LIBELLE_SUPPRIMER} — ${intitule}`}
      title={LIBELLE_SUPPRIMER}
      className={cn(
        // ⚠️ **`relative z-10` n'est PAS de la mise en forme : sans lui le
        // bouton ne se clique pas.** La ligne de `/offres` est un « lien-carte »
        // — un `<a>` étendu par `after:absolute after:inset-0` couvre toute la
        // surface pour qu'on puisse cliquer n'importe où. Il passe donc
        // par-dessus ce bouton et avale le clic. Playwright l'a refusé en
        // toutes lettres le 31 août 2026 (« subtree intercepts pointer
        // events ») ; à la souris, on aurait simplement ouvert la fiche en
        // croyant avoir supprimé. Le bouton du coup de cœur porte la même
        // parade, pour la même raison.
        "relative z-10",
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors",
        "hover:bg-ecarte hover:text-ecarte-foreground focus-produit",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
    >
      <Trash2 className="size-4" aria-hidden="true" />
    </button>
  );
}

/**
 * Le bouton de retour, sur la fiche d'une offre déjà retirée.
 *
 * ⚠️ **Il n'est pas dans le contexte** : il n'a pas de barre à ouvrir, et la
 * fiche est le seul écran qui puisse l'afficher — c'est le seul qui montre une
 * offre supprimée.
 */
export function BoutonRestaurer({
  identifiant,
  definirSuppression,
}: {
  identifiant: string;
  definirSuppression: (
    identifiant: string,
    supprime: boolean,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={enCours}
        onClick={() =>
          demarrer(async () => {
            const resultat = await definirSuppression(identifiant, false);
            setErreur(resultat.ok ? null : resultat.message);
          })
        }
        className="inline-flex items-center gap-2 rounded-full bg-primary-engage px-4 py-2 text-sm font-bold text-primary-foreground focus-produit disabled:opacity-60"
      >
        <Undo2 className="size-4" aria-hidden="true" />
        {enCours ? "Remise en cours…" : LIBELLE_RESTAURER}
      </button>
      {erreur && <span className="text-sm text-destructive">{erreur}</span>}
    </div>
  );
}
