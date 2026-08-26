import type { OffreEnListe } from "@/lib/offres";

import { Cartouche, CartoucheAbsent } from "./cartouche";
import { BlocNotes, CartoucheEnAttente, etatNotation } from "./notes";
import { RYTHME_LIGNE } from "./rythme";
import { formaterDate, formaterSalaire, formaterSalaireAnnuel } from "./formats";

/**
 * Une offre en liste.
 *
 * Entre : la ligne lue en base, un drapeau « collectée cette nuit », et l'heure
 * de rendu (passée par la page, pour que toutes les lignes datent du même
 * instant).
 * Sort : trois étages — entreprise, intitulé, métadonnées — puis, **quand
 * l'offre a été notée**, le bloc des deux notes séparé par un filet. Une offre
 * en attente de note reste à trois étages : son cartouche suffit.
 * Casse : aucun champ n'est supposé présent hormis l'intitulé. Sur les données
 * réelles (373 offres, mesuré le 26 août 2026), 36 % des offres ne nomment pas
 * l'entreprise et 65 % n'indiquent aucun salaire : le vide est le cas courant,
 * il a donc son propre affichage.
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
  const salaire = choisirSalaire(offre);
  const notation = etatNotation(offre);

  return (
    <article
      className={`border-b border-border last:border-b-0 ${RYTHME_LIGNE.article}`}
    >
      <div
        className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${RYTHME_LIGNE.margeEntreprise}`}
      >
        {offre.entreprise_nom ? (
          <p className="libelle-mono text-muted-foreground">
            {offre.entreprise_nom}
          </p>
        ) : (
          // ⚠️ Pas de modificateur d'opacité ici : `/70` mesurait 3,32:1 en
          // mode clair, sous le plancher opposable de 4,5:1 — et 36 % des
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
      <h2 className={`text-[0.9375rem] font-semibold leading-snug text-foreground ${RYTHME_LIGNE.margeIntitule}`}>
        {offre.intitule}
      </h2>

      <div className="flex flex-wrap items-center gap-1.5">
        {offre.lieu_libelle && <Cartouche>{offre.lieu_libelle}</Cartouche>}
        {offre.type_contrat_libelle && (
          <Cartouche>{offre.type_contrat_libelle}</Cartouche>
        )}
        {salaire ? (
          <Cartouche accentue>{salaire}</Cartouche>
        ) : (
          <CartoucheAbsent>Salaire non précisé</CartoucheAbsent>
        )}
        {datePubliee && (
          <Cartouche>
            <time dateTime={offre.publiee_a}>{datePubliee}</time>
          </Cartouche>
        )}
        {/* L'attente de note se dit ICI, dans la rangée des métadonnées, et pas
            en bloc séparé sous un filet : mesuré le 26 août 2026, le bloc
            coûtait 42 px de hauteur pour une seule phrase, sur la moitié des
            lignes affichées. */}
        {notation === "en-attente" && <CartoucheEnAttente />}
      </div>

      {/* L'échec, lui, garde son bloc : il est rare, il doit se voir, et il
          porte une icône que la rangée de cartouches ne sait pas accueillir. */}
      {notation !== "en-attente" && <BlocNotes offre={offre} />}
    </article>
  );
}

/**
 * Quel salaire afficher : l'annualisé quand il existe, le libellé d'origine
 * sinon, rien du tout si l'annonce est muette.
 *
 * ⚠️ **Le repli sur le libellé brut n'est pas un cas dégradé, c'est le cas
 * MAJORITAIRE.** L'annualisation est calculée par `pipeline/salaire.py`
 * pendant la notation : une offre pas encore notée n'a donc aucune valeur
 * annuelle, quel que soit le sérieux de son libellé. Au 26 août 2026,
 * 31 offres sur 535 affichent « 45–60 k€ » et toutes les autres affichent la
 * phrase de France Travail.
 *
 * ⚠️ **Deux offres réelles ont un libellé chiffré mais AUCUNE valeur annuelle,
 * volontairement** — « Mensuel de 45000 Euros sur 12 mois » (× 12 donnerait
 * 540 000 €/an) et « Annuel de 35.0 Euros ». `salaire.py` a **renoncé plutôt
 * que deviné**, et ce refus doit rester visible : on réaffiche le libellé
 * d'origine tel quel plutôt que de le corriger à l'affichage. Requalifier ici
 * ce que le pipeline a refusé de requalifier, c'est remettre l'invention là où
 * elle avait été retirée.
 */
function choisirSalaire(offre: OffreEnListe): string | null {
  const annuel = formaterSalaireAnnuel(
    offre.salaire_annuel_min,
    offre.salaire_annuel_max,
  );
  if (annuel) return annuel;

  return offre.salaire_libelle ? formaterSalaire(offre.salaire_libelle) : null;
}
