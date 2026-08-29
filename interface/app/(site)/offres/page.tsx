/**
 * `/offres` — le poste de travail.
 *
 * ⚠️ **Ce n'est plus « tout ce que la collecte a ramené » depuis la phase 4** :
 * l'écran est devenu un **plan de travail** et n'affiche par défaut que les
 * offres « à traiter ». Les trois autres filtres sont à un clic, dans l'adresse.
 *
 * Cinq états, tous atteignables : base vide, **filtre vide**, chargement, base
 * injoignable, et la liste. ⚠️ Les deux premiers sont distincts et le rester
 * est important — « la base est vide » est l'écran du tout premier matin,
 * « ce filtre est vide » celui d'un matin où tout a été trié. Les confondre
 * ferait croire à une panne de collecte un jour où le travail est fini.
 *
 * Depuis la phase 2, la liste est classée par **intérêt décroissant** et chaque
 * offre porte ses deux notes avec leur justification.
 *
 * ⚠️ Pas de `robots: noindex` déclaré ici : il l'est une fois pour toutes dans
 * le layout du groupe `(site)`, donc pour toute page présente ou future
 * derrière la porte. Le déclarer page par page en ferait une option qu'on
 * oublie — le même raisonnement que le refus d'un `matcher` dans `proxy.ts`.
 */

import type { Metadata } from "next";

import { exigerSession } from "@/lib/acces";
import { accorder } from "@/lib/francais";
import { FILTRE_PAR_DEFAUT, type FiltreListe, listerOffres } from "@/lib/offres";
import { LIBELLES_STATUT, estStatut } from "@/lib/statuts";
import { lireEtatVeille } from "@/lib/veille";

import { LigneEtatVeille } from "../_composants/etat-veille";
import { CadrePage, EnTetePage } from "./_composants/en-tete-page";
import {
  AucuneOffre,
  AucuneOffreDansCeFiltre,
  BaseInjoignable,
} from "./_composants/etats";
import { FiltresStatut } from "./_composants/filtres-statut";
import { LigneOffre } from "./_composants/ligne-offre";
import { VerrouTri } from "./_composants/verrou-tri";

/**
 * ⚠️ **Le titre d'onglet suit le `h1`, et le lien de navigation ne le suit
 * pas** — c'est délibéré, pas un oubli. Relevé en revue le 29 août 2026 : après
 * le passage du titre à « Plan de travail », l'écran portait trois noms
 * différents (onglet, lien de nav, titre de page), ce qui se voit dès qu'on a
 * deux onglets ouverts.
 *
 * L'onglet et le `h1` nomment **la page**, ils doivent donc coïncider. Le lien
 * de la barre du haut nomme **une destination** dans une liste d'autres
 * destinations : « Offres » y est plus juste et plus court que « Plan de
 * travail », de la même façon qu'on clique « Mail » pour arriver sur « Boîte de
 * réception ».
 */
export const metadata: Metadata = {
  title: "Plan de travail — Veille offres emploi IA",
};

/**
 * Quel filtre l'adresse demande.
 *
 * Entre : la valeur brute de `?statut=`, écrite par n'importe qui dans la barre
 * d'adresse.
 * Sort : un filtre sûr. **Tout ce qui n'est pas reconnu retombe sur le défaut**
 * — jamais une page d'erreur.
 *
 * ⚠️ **Retomber sur le défaut plutôt que refuser, et c'est un choix.** Une
 * adresse mal tapée (`?statut=candidat`, `?statut=ecartés`) ou un vieux favori
 * doit ouvrir une liste utilisable, pas un mur. Le contraire se défendrait sur
 * une fiche — `/offres/XXX` renvoie bien « introuvable » — parce qu'une fiche
 * DÉSIGNE une chose précise qui existe ou non. Un filtre ne désigne rien : il
 * restreint, et « je n'ai pas compris ta restriction » se répare en ne
 * restreignant rien de particulier.
 *
 * ⚠️ **`"toutes"` est accepté ici mais n'est pas un statut** — il ne doit donc
 * pas passer par `estStatut()`, qui refuserait à raison une valeur qu'aucune
 * offre ne peut porter en base.
 */
function filtreDemande(valeur: string | string[] | undefined): FiltreListe {
  // ⚠️ Un tableau arrive dès que l'adresse répète le paramètre
  // (`?statut=a&statut=b`) : sans ce cas, `estStatut` recevrait un tableau et
  // renverrait `false`, ce qui marche par accident. On le traite explicitement.
  const brut = Array.isArray(valeur) ? valeur[0] : valeur;

  if (brut === "toutes") return "toutes";
  if (estStatut(brut)) return brut;
  return FILTRE_PAR_DEFAUT;
}

export default async function PageOffres({
  searchParams,
}: PageProps<"/offres">) {
  // ⚠️ Première ligne, sans exception. `proxy.ts` a déjà écarté le visiteur
  // sans cookie ; c'est cette ligne-ci qui protège les offres, au plus près de
  // ce qui les affiche.
  await exigerSession();

  // ⚠️ `searchParams` est une **promesse** depuis Next 15 : l'oublier donnerait
  // un objet toujours vide, donc un filtre qui ne s'applique jamais — sans
  // erreur pour le signaler.
  const parametres = await searchParams;
  const filtre = filtreDemande(parametres.statut);

  // Une seule heure de référence pour toute la page : sinon deux lignes rendues
  // à cheval sur minuit ne dateraient pas du même jour, et la manchette pourrait
  // dire « aujourd'hui » là où une ligne dit « hier ».
  const maintenant = new Date();

  // ⚠️ Les deux lectures partent ENSEMBLE. Enchaînées, l'état de la veille
  // ajouterait son aller-retour à celui de la liste avant le premier pixel,
  // alors qu'aucune des deux ne dépend de l'autre.
  const [resultat, etatVeille] = await Promise.all([
    listerOffres(filtre),
    lireEtatVeille(maintenant),
  ]);

  return (
    <CadrePage>
      <EnTetePage
        // ⚠️ La manchette s'affiche dans TOUS les cas, y compris base
        // injoignable et liste vide — c'est justement là qu'elle est la plus
        // utile : un écran vide dont la veille date de trois jours s'explique
        // tout seul, le même écran sans indicateur ressemble à une panne.
        manchette={<LigneEtatVeille etat={etatVeille} maintenant={maintenant} />}
        compte={
          resultat.ok &&
          resultat.offres.length > 0 && (
            <p className="font-mono text-xs text-muted-foreground">
              <CompteAffiche
                affichees={resultat.offres.length}
                total={resultat.total}
                notees={resultat.notees}
                filtre={filtre}
              />
            </p>
          )
        }
        // ⚠️ **La barre reste affichée même quand le filtre est vide**, et
        // c'est ce qui évite l'impasse : sans elle, un filtre sans résultat
        // n'offrirait aucun moyen d'en sortir. Elle est en revanche masquée si
        // la base est injoignable — filtrer ce qu'on n'a pas pu lire n'a aucun
        // sens, et les compteurs seraient tous à `null`.
        filtres={
          resultat.ok && (
            <FiltresStatut
              actif={filtre}
              comptes={resultat.comptes}
              total={totalBase(resultat.comptes)}
            />
          )
        }
      />

      {!resultat.ok ? (
        <BaseInjoignable
          motif={resultat.motif}
          explication={resultat.explication}
        />
      ) : resultat.offres.length === 0 ? (
        // ⚠️ **Deux états vides, jamais un seul.** « La base est vide » est
        // l'écran du tout premier matin ; « ce filtre est vide » est celui d'un
        // matin où tout a été trié. Les confondre ferait croire à une panne de
        // collecte un jour où le travail est simplement fini.
        totalBase(resultat.comptes) === 0 ? (
          <AucuneOffre />
        ) : (
          <AucuneOffreDansCeFiltre
            libelle={filtre === "toutes" ? "Toutes" : LIBELLES_STATUT[filtre]}
            totalBase={totalBase(resultat.comptes)}
          />
        )
      ) : (
        // ⚠️ **`VerrouTri` est un composant CLIENT qui enveloppe des enfants
        // SERVEUR, et c'est un motif à connaître.** Les 200 `LigneOffre` restent
        // rendues sur le serveur : elles arrivent ici en `children` déjà
        // fabriqués, le fournisseur ne fait que les traverser. Rien ne bascule
        // dans le navigateur hormis le contexte lui-même — la mesure de
        // non-fuite des colonnes reste donc valable.
        //
        // ⚠️ **Il enveloppe la liste ENTIÈRE, et c'est le fond du correctif** :
        // le clic dangereux n'est pas celui qu'on vient de faire, c'est le
        // suivant, sur la ligne qui aura pris la place. Un verrou par ligne ne
        // protégerait de rien.
        <VerrouTri>
          <div className="border border-border bg-card">
            {resultat.offres.map((offre) => (
              <LigneOffre
                key={offre.identifiant}
                offre={offre}
                // `derniereExecution` vaut `null` si on n'a pas pu la lire : on
                // marque alors zéro offre plutôt que de marquer au hasard.
                nouvelle={
                  resultat.derniereExecution !== null &&
                  offre.execution_id === resultat.derniereExecution
                }
                maintenant={maintenant}
              />
            ))}
          </div>
        </VerrouTri>
      )}
    </CadrePage>
  );
}

/**
 * Le total de la base, reconstitué en additionnant les trois statuts.
 *
 * ⚠️ **Additionner est exact ici, et ne le serait pas ailleurs.** `statut` est
 * `not null` et sa contrainte n'admet que trois valeurs : toute offre est
 * comptée une fois et une seule. Le jour où un quatrième statut apparaîtrait
 * sans être ajouté à `STATUTS`, cette somme deviendrait fausse en silence —
 * c'est pourquoi la liste est unique et partagée, et que la base la refuserait
 * de toute façon.
 *
 * ⚠️ **Un seul comptage à `null` rend le total inconnu**, pas partiel : annoncer
 * « 400 offres » quand on n'a pas pu en compter une catégorie serait pire que
 * de se taire.
 */
function totalBase(comptes: Record<string, number | null>): number | null {
  const valeurs = Object.values(comptes);
  if (valeurs.some((v) => v === null)) return null;
  return valeurs.reduce((somme: number, v) => somme + (v as number), 0);
}

/**
 * La ligne de compte, sous le titre : ce qui existe, ce qui est jugé, ce qui
 * est à l'écran — dans cet ordre.
 *
 * ⚠️ Elle annonce **le nombre de lignes réellement rendues**, jamais la
 * constante du plafond : les deux ne coïncident que tant que la base renvoie
 * exactement 200 offres. Dès que la phase 4 ajoutera un filtre, la page
 * afficherait « 200 offres affichées » en en montrant 150.
 *
 * ⚠️ **Le compte des offres notées n'est pas une statistique décorative, et ce
 * n'est pas non plus le « bandeau de quatre chiffres clés » que le DESIGN.md
 * refuse** — celui-là parle du marché de l'emploi, celui-ci parle de l'état de
 * la liste qu'on est en train de lire. Sans lui, le classement mentirait : la
 * page est triée par intérêt décroissant, donc les offres non notées se posent
 * **sous** la plus mauvaise note. Une offre jamais examinée se lirait alors
 * comme une offre jugée sans intérêt. Au 26 août 2026, c'est le cas de 438
 * offres sur 535.
 *
 * ⚠️ Le libellé ne dit jamais « les plus récentes » : depuis la phase 2 le tri
 * est sur la note, plus sur la date. Une formule laissée en place aurait
 * décrit un classement qui n'existe plus, sans que rien ne le signale.
 */
function CompteAffiche({
  affichees,
  total,
  notees,
  filtre,
}: {
  affichees: number;
  total: number | null;
  notees: number | null;
  filtre: FiltreListe;
}) {
  const segments: string[] = [];

  if (total === null) {
    // On ne connaît pas le total : on ne parle que de ce qu'on montre.
    segments.push(`${affichees} ${accorder(affichees, "offre")} ${accorder(affichees, "affichée")}`);
  } else {
    // ⚠️ **« collectées » ne vaut plus que sans filtre.** Ce total est celui du
    // filtre depuis la phase 4 : écrire « 42 offres collectées » sur l'onglet
    // « Candidaté » affirmerait que la collecte n'a ramené que 42 offres. Le
    // mot change avec ce qu'il compte réellement.
    segments.push(
      filtre === "toutes"
        ? `${total} ${accorder(total, "offre")} ${accorder(total, "collectée")}`
        : `${total} ${accorder(total, "offre")}`,
    );
  }

  if (notees !== null) {
    segments.push(
      notees === 0 ? "aucune notée" : `${notees} ${accorder(notees, "notée")}`,
    );
  }

  // Le troisième segment ne s'écrit que si la liste est vraiment tronquée :
  // « 97 offres collectées · 97 affichées » n'apprendrait rien à personne.
  if (total !== null && total > affichees) {
    segments.push(`${affichees} ${accorder(affichees, "affichée")}`);
  }

  return <>{segments.join(" · ")}</>;
}
