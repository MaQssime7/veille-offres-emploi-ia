import type { OffreEnListe } from "@/lib/offres";

import { Cartouche, CartoucheAbsent } from "./cartouche";
import { formaterDate, formaterSalaire } from "./formats";

/**
 * Une offre en liste.
 *
 * Entre : la ligne lue en base, un drapeau « collectée cette nuit », et l'heure
 * de rendu (passée par la page, pour que toutes les lignes datent du même
 * instant).
 * Sort : un bloc de trois étages — entreprise, intitulé, métadonnées.
 * Casse : aucun champ n'est supposé présent hormis l'intitulé. Sur les données
 * réelles, 34 % des offres ne nomment pas l'entreprise et 69 % n'indiquent
 * aucun salaire : le vide est le cas courant, il a donc son propre affichage.
 */
export function LigneOffre({
  offre,
  nouvelle,
  maintenant,
}: {
  offre: OffreEnListe;
  nouvelle: boolean;
  maintenant: Date;
}) {
  const datePubliee = formaterDate(offre.publiee_a, maintenant);

  return (
    <article className="border-b border-border px-4 py-4 last:border-b-0 sm:px-5">
      <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        {offre.entreprise_nom ? (
          <p className="libelle-mono text-muted-foreground">
            {offre.entreprise_nom}
          </p>
        ) : (
          // ⚠️ Pas de modificateur d'opacité ici : `/70` mesurait 3,32:1 en
          // mode clair, sous le plancher opposable de 4,5:1 — et 34 % des
          // offres réelles ne nomment pas leur entreprise. C'est l'italique
          // qui met en retrait, pas une couleur affaiblie.
          <p className="libelle-mono italic text-muted-foreground">
            Entreprise non communiquée
          </p>
        )}

        {/* Ocre = le temporel, un rôle et un seul dans tout le produit.
            Le mot porte l'information, la couleur ne fait que la renforcer :
            retiré, il ne resterait qu'une pastille indéchiffrable. */}
        {nouvelle && (
          <span className="bg-signal px-1.5 py-px font-mono text-[0.625rem] font-semibold uppercase tracking-widest text-signal-foreground">
            Nouveau
          </span>
        )}
      </div>

      {/* Geist et non Fraunces : le serif du DESIGN.md ne descend jamais sous
          20 px, et un intitulé de liste à 20 px casserait la densité compacte.

          ⚠️ `h2` et non `h3` : le seul titre au-dessus est le `h1` « Offres » de
          la page. Sauter le niveau 2 casse le plan de titres, sur lequel un
          lecteur d'écran navigue pour parcourir la liste. */}
      <h2 className="mb-2.5 text-[0.9375rem] font-semibold leading-snug text-foreground">
        {offre.intitule}
      </h2>

      <div className="flex flex-wrap items-center gap-1.5">
        {offre.lieu_libelle && <Cartouche>{offre.lieu_libelle}</Cartouche>}
        {offre.type_contrat_libelle && (
          <Cartouche>{offre.type_contrat_libelle}</Cartouche>
        )}
        {offre.salaire_libelle ? (
          <Cartouche accentue>{formaterSalaire(offre.salaire_libelle)}</Cartouche>
        ) : (
          <CartoucheAbsent>Salaire non précisé</CartoucheAbsent>
        )}
        {datePubliee && (
          <Cartouche>
            <time dateTime={offre.publiee_a}>{datePubliee}</time>
          </Cartouche>
        )}
      </div>
    </article>
  );
}
