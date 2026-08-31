import { aCoupDeCoeur } from "@/lib/coup-de-coeur";
import { lireEmployeur, provenanceEmployeur } from "@/lib/employeur";
import type { OffreEnFiche } from "@/lib/offres";

import { Cartouche, CartoucheAbsent } from "../../../_composants/cartouche";
import {
  formaterDate,
  formaterSalaire,
  formaterSalaireAnnuel,
} from "../../../_composants/formats";
import { BoutonCoupDeCoeur } from "../../../_composants/bouton-coup-de-coeur";
import { BoutonCorbeille } from "../../../_composants/corbeille";
import { BoutonsStatut } from "../../../_composants/boutons-statut";
import { CartoucheEnAttente, etatNotation } from "../../../_composants/notes";

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
  const employeur = lireEmployeur(offre);
  const provenance = provenanceEmployeur(employeur);

  return (
    <header className="mb-6 border-b border-border pb-6">
      {/* ⚠️ **`nom-entreprise` est ABANDONNÉ ICI le 30 août 2026 — pas
          surchargé.** Demande de Maxime : le nom doit prendre la police et la
          taille de l'intitulé, en gardant sa couleur. L'utilitaire déclare
          `font-family` ET `font-size` ; le surcharger par `font-display
          text-2xl` aurait remis en scène le piège que l'ancien commentaire de
          ce bloc décrivait — deux classes qui se disputent la même propriété à
          spécificité égale, dont l'issue dépend de l'ordre dans la feuille
          compilée et non du code qu'on lit. On écrit donc les trois propriétés
          en clair, et la couleur passe par `text-marque`, l'utilitaire que
          `--color-marque` fait générer.
          ⚠️ **`nom-entreprise` reste en usage dans la LISTE**, où sa taille de
          15 px est juste : ne pas le supprimer de `globals.css`.
          ⚠️ La ligne « Entreprise non communiquée », plus bas, garde
          délibérément sa petite taille : une absence n'a pas à occuper la place
          d'une présence, et 39 % des offres ne nomment pas leur employeur. */}
      {employeur.nom ? (
        <p
          className={`font-display text-2xl leading-tight font-bold text-marque sm:text-3xl ${
            provenance ? "" : "mb-2"
          }`}
        >
          {employeur.nom}
        </p>
      ) : (
        // Même traitement qu'en liste : l'italique met en retrait, jamais une
        // couleur affaiblie — mesurée à 3,32:1, sous le plancher de 4,5:1.
        // ⚠️ Même raison qu'en liste : Fredoka n'a pas d'italique, et une
        // absence n'est pas un nom.
        <p className="mb-2 font-sans text-lg leading-[1.3] font-bold text-muted-foreground italic">
          Entreprise non communiquée
        </p>
      )}

      {/* ⚠️ **La fiche dit d'où vient le nom qu'elle affiche, et c'est le point
          entier de cette ligne.** Sans elle, une déduction du modèle passerait
          pour une donnée de France Travail : Maxime candidaterait chez
          « Wavestone » sans savoir que le champ officiel dit « NEW NET 3D »,
          donc sans pouvoir juger si l'annonce le contredit.

          ⚠️ **Surtout PAS `libelle-mono`**, malgré l'envie : cette classe est
          celle des étiquettes courtes (« NOUVEAU », « INTÉRÊT »), et elle
          impose `text-transform: uppercase` avec 0,1 em d'interlettrage. Une
          phrase entière y devient « IDENTIFIÉ DANS L'ANNONCE · FRANCE TRAVAIL
          ANNONCE NEW NET 3D » — criard, plus long, et pénible à lire à 11 px.
          Le mono dit « donnée », pas « phrase ».

          ⚠️ **`text-muted-foreground` et non une opacité.** C'est le jeton dont
          le contraste est mesuré ; un `/70` improvisé retomberait à 3,32:1,
          sous le plancher opposable de 4,5:1 — le piège déjà rencontré deux
          fois sur le nom d'entreprise. */}
      {provenance && (
        <p className="mb-2 mt-1 text-sm text-muted-foreground">
          {provenance}
        </p>
      )}

      {/* 24 px en mobile, 30 px en bureau — **remonté le 29 août 2026 au soir**,
          après que le texte courant de la fiche est passé à 16 px. À 24 px,
          l'intitulé n'avait plus qu'un rapport de 1,5 avec le corps de texte :
          un titre se lit comme un titre parce qu'il domine, et il ne dominait
          plus rien. ⚠️ **C'est le retour exact de la valeur abandonnée le
          28 août** (« à 30 px, l'intitulé écrasait tout le reste ») — ce qui a
          changé entre-temps, c'est ce qu'il y a autour : le reste a grandi
          aussi. Une taille ne se juge jamais seule.
          ⚠️ **Le plancher des 20 px n'existe plus depuis la refonte du 29 août
          2026, et c'est la seule contrainte que le changement de police a
          levée.** Il tenait à Fraunces, un serif qui perdait le contraste de
          ses pleins et déliés en dessous de cette taille ; Fredoka est une
          sans-serif arrondie de graisse constante, qui reste lisible plus bas.
          Les tailles n'ont pas bougé pour autant — elles étaient bonnes. */}
      <h1 className="font-display text-2xl font-bold leading-tight text-foreground sm:text-3xl">
        {offre.intitule}
      </h1>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {offre.lieu_libelle && <Cartouche aere>{offre.lieu_libelle}</Cartouche>}
        {offre.type_contrat_libelle && (
          <Cartouche aere>{offre.type_contrat_libelle}</Cartouche>
        )}
        {/* ⚠️ **PAS accentué, et c'est une correction du 28 août 2026.** Il
            l'était : « quand cette nature s'affiche, c'est qu'elle contredit le
            contrat annoncé ». L'argument était bon et la conséquence mauvaise —
            le `DESIGN.md` réserve la graisse au salaire, « parce que c'est
            celui qu'on cherche en premier », et une distinction qui repose sur
            l'unicité cesse de fonctionner dès qu'un second élément la partage.
            Relevé par Maxime en regardant la page : « le salaire est en gras,
            je ne sais pas pourquoi le reste ne l'est pas ». La nature du
            contrat reste visible — elle a son cartouche — elle ne prend juste
            pas le repère d'un autre. */}
        {nature && <Cartouche aere>{nature}</Cartouche>}
        {salaire ? (
          <Cartouche accentue aere>{salaire}</Cartouche>
        ) : (
          <CartoucheAbsent aere>Salaire non précisé</CartoucheAbsent>
        )}
        {datePubliee && (
          <Cartouche aere>
            <time dateTime={offre.publiee_a}>{datePubliee}</time>
          </Cartouche>
        )}
        {etatNotation(offre) === "en-attente" && <CartoucheEnAttente />}
      </div>

      {/* ⚠️ **Le statut est une ACTION, pas une métadonnée** — d'où sa rangée
          propre, séparée des cartouches par une marge franche. Mêlé à eux, il
          se serait lu comme un fait de l'annonce (« CDI », « 75 - Paris »)
          alors qu'il dit ce que Maxime, lui, a décidé.

          ⚠️ **Deux mots voisins sur la même page, et ils ne veulent PAS dire la
          même chose** : « Candidaté » ici marque une décision ; « Candidater »
          en bas de page ouvre l'annonce chez France Travail. Les 700 px qui les
          séparent sont ce qui les distingue aujourd'hui — à revoir si l'un des
          deux déménage.

          ⚠️ **On passe `offre.identifiant` et `offre.statut`, jamais `offre`.**
          C'est le premier composant client de cette chaîne : lui donner l'objet
          entier enverrait **toutes ses colonnes** dans le document du
          navigateur, `contact_nom` et note personnelle compris. ⚠️ Ne pas y
          remettre de nombre : la fiche en lit 31 aujourd'hui, et ce compte
          bougera à la prochaine migration. Règle opposable n° 6 du `CLAUDE.md`. */}
      {/* ⚠️ **`aere` sur les deux, et le cœur porte ici son libellé en toutes
          lettres** — contrairement à la liste, où il est seul. Sur une fiche on
          lit, on ne balaye pas : un pictogramme sans mot y serait la seule
          commande muette de la page.

          ⚠️ **`flex-wrap`** : à 375 px, « Coup de cœur » + « Candidaté » +
          « Écarté » aérés ne tiennent pas sur une ligne. Sans lui, le troisième
          bouton déborderait de la carte. */}
      <div className="mt-5 flex flex-wrap items-start gap-2">
        <BoutonCoupDeCoeur
          identifiant={offre.identifiant}
          actif={aCoupDeCoeur(offre.coup_de_coeur_a)}
          aere
        />
        <BoutonsStatut
          identifiant={offre.identifiant}
          statut={offre.statut}
          aere
        />
        {/* ⚠️ **En dernier, et sans libellé même ici.** Les deux boutons
            au-dessus portent leur mot en toutes lettres parce qu'on lit une
            fiche ; celui-ci reste une icône seule, avec son `aria-label`, pour
            une raison de sens : dessiné au même poids que « Candidaté », il se
            lirait comme une décision de tri de plus, alors qu'il fait sortir
            l'offre de tous les écrans.
            ⚠️ **Absent quand l'offre est DÉJÀ retirée** — le panneau de retour
            prend alors sa place, plus haut dans la page. Deux commandes
            contraires dans la même rangée ne s'expliqueraient pas. */}
        {offre.supprime_a === null && (
          <BoutonCorbeille
            identifiant={offre.identifiant}
            intitule={offre.intitule}
            className="size-10"
          />
        )}
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
