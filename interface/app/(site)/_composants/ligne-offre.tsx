import Link from "next/link";

import type { OffreEnListe } from "@/lib/offres";

import { BoutonsStatut } from "./boutons-statut";
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
  jumelles = [],
  nouvelle,
  maintenant,
}: {
  offre: OffreEnListe;
  /**
   * Les identifiants des autres annonces du même poste.
   *
   * ⚠️ **Renseigné sur `/` seulement**, où l'écran du matin regroupe. Il fait
   * deux choses : il apparaît en clair dans un cartouche « 2 annonces », et il
   * descend jusqu'aux boutons de statut, qui traitent alors le poste entier.
   * Sur `/offres`, où chaque ligne est une annonce, il reste vide et rien ne
   * change.
   */
  jumelles?: string[];
  nouvelle: boolean;
  maintenant: Date;
}) {
  const datePubliee = formaterDate(offre.publiee_a, maintenant);
  const salaire = choisirSalaire(offre);
  const notation = etatNotation(offre);

  return (
    // `relative` ancre le lien étendu ci-dessous ; `has-[a:focus-visible]`
    // remonte le focus du lien jusqu'à la ligne entière, sinon l'anneau de
    // focus n'entourerait que les quelques mots de l'intitulé et la navigation
    // au clavier deviendrait illisible sur une liste de 200 lignes.
    // ⚠️ **`hover:cushion-row-hover` et non un changement de fond.** Depuis la
    // refonte, la ligne est une carte posée sur la page : la survoler doit la
    // faire monter, pas la teinter. Un `hover:bg-accent` sur une carte blanche
    // la ferait virer au lavande, c'est-à-dire se confondre avec le fond de
    // page qu'elle est censée surplomber.
    <article
      // ⚠️ **Le focus de la ligne passe par `outline`, jamais par `ring`.**
      // La carte porte un `cushion-row` — un `box-shadow` brut — et les
      // `ring-*` de Tailwind passent par cette même propriété : l'anneau était
      // purement et simplement écrasé. C'est le pire endroit où perdre le
      // focus, puisque c'est ici qu'on parcourt deux cents lignes au clavier.
      className={`relative transition-shadow hover:cushion-row-hover has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-foreground ${RYTHME_LIGNE.article}`}
    >
      <div
        className={`${RYTHME_LIGNE.rangeeEntete} ${RYTHME_LIGNE.margeEntreprise}`}
      >
        {offre.entreprise_nom ? (
          <p className="nom-entreprise">
            {offre.entreprise_nom}
          </p>
        ) : (
          // ⚠️ Pas de modificateur d'opacité ici : `/70` mesurait 3,32:1 en
          // mode clair, sous le plancher opposable de 4,5:1 — et 36 % des
          // offres réelles ne nomment pas leur entreprise. C'est l'italique
          // qui met en retrait, pas une couleur affaiblie.
          <p className="nom-entreprise italic text-muted-foreground">
            Entreprise non communiquée
          </p>
        )}

        {/* Ocre = le temporel, un rôle et un seul dans tout le produit.
            Le mot porte l'information, la couleur ne fait que la renforcer :
            retiré, il ne resterait qu'une pastille indéchiffrable. */}
        {nouvelle && (
          <span className="rounded-full bg-signal px-2 py-0.5 font-mono text-[0.625rem] font-bold uppercase tracking-widest text-signal-foreground">
            Nouveau
          </span>
        )}

        {/* ⚠️ **`ml-auto` occupe la RÉSERVE de droite, celle que `DESIGN.md`
            demandait de ne pas combler** : « le vide à droite de la ligne n'est
            pas un défaut, c'est une réserve — il accueille les notes en phase 2,
            puis le statut en phase 4 ». C'est ce rendez-vous-là.

            ⚠️ **En haut et non en bas de la ligne**, parce que c'est la seule
            rangée dont la hauteur ne dépend pas du contenu : les cartouches
            passent à la ligne quand le salaire est long, les justifications font
            deux ou quatre lignes. Ici les boutons tombent au même endroit sur
            les 200 lignes, ce qui permet de trier une matinée sans viser.

            ⚠️ **`compact` réduit au pictogramme sous 640 px** — le libellé passe
            en `sr-only`, il ne disparaît pas. */}
        <div className="ml-auto">
          <BoutonsStatut
            identifiant={offre.identifiant}
            jumelles={jumelles}
            statut={offre.statut}
            compact
          />
        </div>
      </div>

      {/* ⚠️ **Nunito et non Fredoka, alors que le même intitulé est en Fredoka
          sur sa fiche — et ce n'est pas une incohérence.** Fredoka habille les
          `h1`, c'est-à-dire le titre de LA page : sur la fiche, l'intitulé est
          ce titre ; ici, il est un élément parmi deux cents. Le passer en
          Fredoka donnerait deux cents gros titres arrondis empilés, et la
          hiérarchie de la liste disparaîtrait.

          ⚠️ `h2` et non `h3` : le seul titre au-dessus est le `h1` « Plan de
          travail » de la page. Sauter le niveau 2 casse le plan de titres, sur
          lequel un lecteur d'écran navigue pour parcourir la liste. */}
      <h2 className={`text-[0.9375rem] font-semibold leading-snug text-foreground ${RYTHME_LIGNE.margeIntitule}`}>
        {/* ⚠️ **Un SEUL lien par ligne, posé sur l'intitulé et étendu à la
            carte par `after:absolute after:inset-0`.** Envelopper la ligne
            entière dans une balise `<a>` serait plus court et bien pire : le
            lecteur d'écran annoncerait comme libellé du lien la totalité du
            contenu — entreprise, cartouches, et les ~300 caractères des deux
            justifications. Ici il annonce l'intitulé, qui est ce qu'on suit.

            ⚠️ **Conséquence assumée : le texte des justifications ne se
            sélectionne plus à la souris**, la surface du lien passant par
            dessus. C'est le compromis habituel des listes de cartes. Il est
            acceptable ici parce que le texte reste sélectionnable sur la fiche,
            où il est de toute façon plus lisible — et l'alternative, une ligne
            cliquable seulement sur son titre, offrirait une cible minuscule sur
            une ligne de 195 px de haut.

            `focus:outline-none` : l'anneau de focus est porté par l'article
            entier (voir plus haut), pas par les trois mots du titre. */}
        <Link
          href={`/offres/${offre.identifiant}`}
          className="outline-none after:absolute after:inset-0 after:content-['']"
        >
          {offre.intitule}
        </Link>
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
        {/* ⚠️ **« 2 annonces » est le seul endroit qui dit que l'écran a fondu
            des lignes**, et il ne se retire jamais. Sans lui, deux annonces
            réelles deviendraient une ligne sans que rien ne l'indique : Maxime
            croirait que France Travail a publié une fois ce qu'il a publié
            deux, et un clic écarterait silencieusement une offre qu'il n'a pas
            vue. Le chiffre est en toutes lettres, pas une pastille.

            ⚠️ **Neutre et non teinté** : les teintes du système portent chacune
            un rôle (`docs/DESIGN.md`), et une information de comptage n'en est
            aucun. */}
        {jumelles.length > 0 && (
          <Cartouche>
            {jumelles.length + 1} annonces
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
