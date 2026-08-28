import type { OffreEnFiche } from "@/lib/offres";

import { Cartouche, CartoucheAbsent } from "../../_composants/cartouche";
import {
  formaterDate,
  formaterSalaire,
  formaterSalaireAnnuel,
} from "../../_composants/formats";
import { CartoucheEnAttente, etatNotation } from "../../_composants/notes";

/**
 * Le haut de la fiche : entreprise, intitulé, rangée de métadonnées.
 *
 * Entre : l'offre lue en base et l'heure de rendu.
 * Sort : trois étages, dans l'ordre où on les lit.
 * Casse : aucun champ n'est supposé présent hormis l'intitulé. Sur les
 * 560 offres réelles, 36 % ne nomment pas l'entreprise et 65 % n'indiquent
 * aucun salaire — le vide est le cas courant, pas le cas limite.
 *
 * ⚠️ **L'intitulé est le `h1` de la page, et le seul.** Le titre « Offres » de
 * la liste n'existe pas ici : sur une fiche, le sujet de la page EST l'offre.
 * Un lecteur d'écran qui saute de titre en titre doit tomber dessus en premier.
 */
export function EnTeteOffre({
  offre,
  maintenant,
}: {
  offre: OffreEnFiche;
  maintenant: Date;
}) {
  const datePubliee = formaterDate(offre.publiee_a, maintenant);
  const salaire = choisirSalaire(offre);
  const nature = natureUtile(offre.nature_contrat, offre.type_contrat_libelle);

  return (
    <header className="mb-6 border-b border-border pb-6">
      {offre.entreprise_nom ? (
        <p className="libelle-mono mb-2 text-muted-foreground">
          {offre.entreprise_nom}
        </p>
      ) : (
        // Même traitement qu'en liste : l'italique met en retrait, jamais une
        // couleur affaiblie — mesurée à 3,32:1, sous le plancher de 4,5:1.
        <p className="libelle-mono mb-2 italic text-muted-foreground">
          Entreprise non communiquée
        </p>
      )}

      {/* Fraunces, la police de titrage : elle ne descend jamais sous 20 px, ce
          qui l'interdisait en liste (intitulé à 15 px) et l'autorise ici. */}
      <h1 className="font-display text-2xl font-bold leading-tight text-foreground sm:text-3xl">
        {offre.intitule}
      </h1>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {offre.lieu_libelle && <Cartouche>{offre.lieu_libelle}</Cartouche>}
        {offre.type_contrat_libelle && (
          <Cartouche>{offre.type_contrat_libelle}</Cartouche>
        )}
        {/* Accentué comme le salaire : quand cette nature s'affiche, c'est
            qu'elle contredit le contrat annoncé, et c'est l'information la plus
            décisive de la rangée. */}
        {nature && <Cartouche accentue>{nature}</Cartouche>}
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
        {etatNotation(offre) === "en-attente" && <CartoucheEnAttente />}
      </div>
    </header>
  );
}

/**
 * La nature du contrat, affichée **seulement quand elle apprend quelque chose**.
 *
 * Entre : `nature_contrat` et `type_contrat_libelle`.
 * Sort : le libellé à afficher, ou `null` s'il ferait doublon.
 *
 * ⚠️ **C'est le champ le plus utile de la fiche, et le plus facile à confondre
 * avec son voisin.** `type_contrat_libelle` dit « CDI » ; `nature_contrat` dit
 * « Contrat apprentissage ». Mesuré le 28 août 2026 : **7 des 20 meilleures
 * offres sont des alternances**, dont « Alternant Ingénieur IA Agentique »,
 * notée 85 d'intérêt et 15 d'accessibilité. Sans ce champ, un écart pareil ne
 * s'explique qu'en lisant la justification.
 *
 * ⚠️ **« Contrat travail » est masqué**, et c'est le seul cas masqué. Cette
 * valeur porte 519 offres sur 560 : à côté de « CDI », elle n'ajoute rien et
 * mettrait un cartouche de bruit sur 93 % des fiches. Les autres valeurs
 * observées — « Contrat apprentissage », « Cont. professionnalisation »,
 * « CDI de chantier ou d'opération », « Emploi non salarié », « Contrat
 * d'usage » — disent toutes quelque chose que le type de contrat tait.
 *
 * ⚠️ **On masque une valeur nommée, jamais « tout sauf une liste blanche ».**
 * Une valeur inconnue apparue demain doit s'afficher, pas disparaître : c'est
 * exactement ce que le projet a appris sur les périodes de salaire.
 */
function natureUtile(
  nature: string | null,
  typeContrat: string | null,
): string | null {
  if (!nature) return null;
  if (nature === "Contrat travail") return null;
  if (nature === typeContrat) return null;
  return nature;
}

/**
 * Quel salaire afficher — même arbitrage qu'en liste, et pour la même raison.
 *
 * L'annualisation est calculée pendant la **notation** : une offre pas encore
 * notée n'a aucune valeur annuelle, quelle que soit la qualité de son libellé.
 * Le repli sur le texte de France Travail est donc le cas majoritaire, pas un
 * cas dégradé.
 *
 * ⚠️ Deux offres réelles ont un libellé chiffré et **aucune** valeur annuelle,
 * volontairement — « Mensuel de 45000 Euros sur 12 mois », « Annuel de
 * 35.0 Euros ». `pipeline/salaire.py` a renoncé plutôt que deviné ; on
 * réaffiche le libellé d'origine tel quel au lieu de le corriger ici.
 */
function choisirSalaire(offre: OffreEnFiche): string | null {
  const annuel = formaterSalaireAnnuel(
    offre.salaire_annuel_min,
    offre.salaire_annuel_max,
  );
  if (annuel) return annuel;
  return offre.salaire_libelle ? formaterSalaire(offre.salaire_libelle) : null;
}
