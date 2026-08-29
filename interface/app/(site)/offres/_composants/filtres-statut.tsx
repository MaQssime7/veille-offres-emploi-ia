import Link from "next/link";

import { FILTRE_PAR_DEFAUT, type FiltreListe } from "@/lib/offres";
import { LIBELLES_STATUT, STATUTS, type Statut } from "@/lib/statuts";

/**
 * La barre de filtres de `/offres` : à traiter, candidaté, écarté, toutes.
 *
 * Entre : le filtre actif et le compte de chaque statut.
 * Sort : quatre liens, dont un marqué comme la page courante.
 * Casse : un compte à `null` masque son chiffre — l'onglet reste cliquable.
 *
 * ⚠️ **Ce sont des LIENS, jamais des boutons, et c'est le critère
 * d'acceptation lui-même.** Le plan exige que « `/offres?statut=candidate` se
 * mette en favori et survive au bouton retour ». Des boutons avec un état React
 * donneraient le même écran et perdraient les deux : rien à mettre en favori,
 * et le retour arrière quitterait la page au lieu de revenir au filtre
 * précédent. Un `<Link>` écrit l'état dans l'adresse, qui est le seul endroit
 * qu'un navigateur sait conserver.
 *
 * ⚠️ **Le filtre par défaut n'écrit RIEN dans l'adresse** — `/offres` et non
 * `/offres?statut=a_traiter`. Deux adresses pour un même écran fabriquent deux
 * entrées d'historique, deux favoris possibles, et un `?statut=` qui traîne
 * dans tous les liens de partage. L'absence de paramètre *est* la valeur par
 * défaut.
 *
 * ⚠️ **`aria-current="page"` et non une simple classe CSS.** L'onglet actif se
 * distingue à l'œil par son fond ; sans cet attribut, rien ne le distingue pour
 * un lecteur d'écran, qui annoncerait quatre liens identiques. Le plancher du
 * projet interdit qu'une information tienne sur la seule apparence.
 */
export function FiltresStatut({
  actif,
  comptes,
  total,
}: {
  actif: FiltreListe;
  comptes: Record<Statut, number | null>;
  /** Le total de la base, pour l'onglet « Toutes ». `null` si inconnu. */
  total: number | null;
}) {
  const onglets: { filtre: FiltreListe; libelle: string; compte: number | null }[] = [
    ...STATUTS.map((statut) => ({
      filtre: statut as FiltreListe,
      libelle: LIBELLES_STATUT[statut],
      compte: comptes[statut],
    })),
    { filtre: "toutes", libelle: "Toutes", compte: total },
  ];

  return (
    // `nav` et non une simple `div` : un lecteur d'écran peut sauter
    // directement à un point de repère de navigation.
    <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-1.5">
      {onglets.map(({ filtre, libelle, compte }) => (
        <OngletFiltre
          key={filtre}
          filtre={filtre}
          libelle={libelle}
          compte={compte}
          actif={filtre === actif}
        />
      ))}
    </nav>
  );
}

function OngletFiltre({
  filtre,
  libelle,
  compte,
  actif,
}: {
  filtre: FiltreListe;
  libelle: string;
  compte: number | null;
  actif: boolean;
}) {
  const adresse =
    filtre === FILTRE_PAR_DEFAUT ? "/offres" : `/offres?statut=${filtre}`;

  return (
    <Link
      href={adresse}
      aria-current={actif ? "page" : undefined}
      // ⚠️ **L'actif se marque par le FOND et la graisse, jamais par une teinte
      // de signal.** Chaque teinte a un rôle unique — menthe à l'accessibilité
      // et au statut candidaté, rose à l'écarté. Colorer l'onglet « Candidaté »
      // en menthe le ferait ressembler à un bouton de statut alors qu'il n'en
      // change aucun : il filtre, il ne trie pas. Le violet est ici la couleur
      // d'ACTION du système, pas un des cinq rôles de signal du produit.
      //
      // ⚠️ **`cushion-control` sur l'actif seul.** L'ombre coussin est ce qui
      // fait « ressortir » un contrôle ; la poser sur les quatre onglets les
      // ferait tous ressortir, c'est-à-dire aucun.
      //
      // ⚠️ **`border border-transparent` sur l'actif, et ce n'est pas
      // décoratif — c'est un correctif de revue.** L'actif n'avait aucune
      // bordure là où les trois inactifs en portent une : en `border-box` à
      // largeur automatique, il était donc **2 px plus étroit**, et chaque
      // changement de filtre décalait horizontalement tous les onglets à sa
      // droite. Une bordure transparente occupe la place sans se voir.
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider transition-colors focus-produit ${
        actif
          ? "cushion-control border-transparent bg-primary font-bold text-primary-foreground"
          : "border-input font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {libelle}
      {/* ⚠️ **Un compte `null` n'affiche PAS zéro.** Le comptage a échoué : dire
          « 0 » affirmerait qu'il n'y a aucune offre dans ce filtre, ce qui est
          une information inventée. Le même `NULL` ≠ `0` que la base applique
          aux notes, tenu jusqu'à l'écran. */}
      {compte !== null && (
        <span className="tabular-nums font-normal opacity-70">{compte}</span>
      )}
    </Link>
  );
}
