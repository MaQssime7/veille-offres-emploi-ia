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
import {
  FILTRE_PAR_DEFAUT,
  LIBELLES_FILTRE,
  type FiltreListe,
  SEUIL_INTERET,
  estFiltre,
  leSeuilRetireQuelqueChose,
  regimeDuSeuil,
} from "@/lib/filtres";
import { listerOffres } from "@/lib/offres";
import { TRIS, TRI_PAR_DEFAUT, type Tri, estTri } from "@/lib/tri";
import { lireEtatVeille } from "@/lib/veille";

import { LigneEtatVeille } from "../_composants/etat-veille";
import { adresseListe } from "../_composants/adresse";
import { CadrePage } from "../_composants/cadre-page";
import { EnTetePage } from "../_composants/en-tete-page";
import {
  AucuneOffre,
  AucuneOffreAuSeuil,
  AucuneOffreDansCeFiltre,
  BaseInjoignable,
  NouveautesInconnues,
} from "../_composants/etats";
import { MenuTri } from "./_composants/menu-tri";
import { FiltresStatut } from "./_composants/filtres-statut";
import { LigneOffre } from "../_composants/ligne-offre";
import { VerrouTri } from "../_composants/verrou-tri";

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
 *
 * ⚠️ **Le `h1` est passé à « Bonjour Maxime » le 29 août 2026, et l'onglet ne
 * l'a PAS suivi — c'est voulu, pas un oubli.** La règle ci-dessus vaut tant que
 * les deux *nomment* l'écran. Un salut ne nomme rien : il s'adresse à quelqu'un.
 * Un onglet « Bonjour Maxime » ne dirait plus de quelle page il s'agit dans
 * l'historique, dans un favori, ni entre deux onglets ouverts — précisément les
 * trois endroits pour lesquels ce titre existe.
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

  // ⚠️ **`estFiltre` et non `estStatut`** : « toutes » et « nouvelles » ne sont
  // pas des statuts, et `estStatut` les refuserait à raison — aucune offre ne
  // peut porter ces valeurs en base. Les deux validations gardent deux
  // frontières différentes, celle de l'écran et celle de la table.
  return estFiltre(brut) ? brut : FILTRE_PAR_DEFAUT;
}

/**
 * Quel classement l'adresse demande.
 *
 * Entre : la valeur brute de `?tri=`.
 * Sort : un classement sûr, choisi dans une liste fermée.
 * Casse : rien — tout ce qui n'est pas reconnu retombe sur l'intérêt.
 *
 * ⚠️ **La même clémence que pour le filtre, et pour la même raison** : un
 * classement ne désigne rien, il réordonne. « Je n'ai pas compris ton ordre »
 * se répare en rendant l'ordre par défaut, jamais par une page d'erreur.
 *
 * ⚠️ **C'est ici que la valeur de l'adresse s'arrête.** Ce qui continue est un
 * membre du type `Tri`, qui servira de CLÉ dans la table de classements de
 * `lib/offres.ts` — les lettres tapées dans la barre d'adresse n'atteignent
 * jamais la requête.
 */
function triDemande(valeur: string | string[] | undefined): Tri {
  const brut = Array.isArray(valeur) ? valeur[0] : valeur;
  return estTri(brut) ? brut : TRI_PAR_DEFAUT;
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
  const tri = triDemande(parametres.tri);

  // Une seule heure de référence pour toute la page : sinon deux lignes rendues
  // à cheval sur minuit ne dateraient pas du même jour, et la manchette pourrait
  // dire « aujourd'hui » là où une ligne dit « hier ».
  const maintenant = new Date();

  // ⚠️ Les deux lectures partent ENSEMBLE. Enchaînées, l'état de la veille
  // ajouterait son aller-retour à celui de la liste avant le premier pixel,
  // alors qu'aucune des deux ne dépend de l'autre.
  const [resultat, etatVeille] = await Promise.all([
    listerOffres(filtre, tri),
    lireEtatVeille(maintenant),
  ]);

  /**
   * L'adresse de chacun des trois classements, **filtre courant conservé**.
   *
   * ⚠️ **Calculée ici, sur le serveur, et passée au menu déjà faite.** La raison
   * n'est plus celle qu'on croit : `FILTRE_PAR_DEFAUT` a quitté `lib/offres.ts`
   * pour `lib/filtres.ts` dans ce même diff, donc un composant client pourrait
   * techniquement le lire. Ce qui tient, c'est que **l'adresse d'une vue se
   * calcule à un seul endroit** — ici — pour que les liens du menu et ceux des
   * filtres ne puissent pas diverger.
   */
  const adressesTri = Object.fromEntries(
    TRIS.map((valeur) => [valeur, adresseListe(filtre, valeur)]),
  ) as Record<Tri, string>;

  return (
    <CadrePage>
      <EnTetePage
        // ⚠️ La manchette s'affiche dans TOUS les cas, y compris base
        // injoignable et liste vide — c'est justement là qu'elle est la plus
        // utile : un écran vide dont la veille date de trois jours s'explique
        // tout seul, le même écran sans indicateur ressemble à une panne.
        manchette={<LigneEtatVeille etat={etatVeille} maintenant={maintenant} />}
        sousTitre={
          resultat.ok &&
          resultat.offres.length > 0 && (
            <p className="font-mono text-xs text-muted-foreground">
              <CompteAffiche
                affichees={resultat.offres.length}
                total={resultat.total}
                sansSeuil={resultat.totalFiltreSansSeuil}
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
              tri={tri}
              // ⚠️ **Les six comptes sont réunis ICI, et aucun ne s'obtient en
              // additionnant les autres.** « Nouveau », « Coup de cœur » et
              // « Toutes » comptent les mêmes offres sous un autre angle : les
              // additionner donnerait un total supérieur à la base.
              //
              // ⚠️ **« Toutes » était une SOMME jusqu'au 31 août 2026, et le
              // seuil l'a rendue fausse.** Elle valait « à traiter » +
              // « candidaté » + « écarté » ; depuis que « Candidaté » échappe
              // au seuil (`regimeDuSeuil`), cette addition compte les
              // candidatures sous 40 que la liste « Toutes » ne montre pas.
              // Elle serait restée juste jusqu'au jour où Maxime candidate à
              // une offre notée 30 — c'est-à-dire un usage normal du produit,
              // pas un cas limite. `totalAuSeuil` interroge la base au lieu de
              // déduire.
              comptes={{
                ...resultat.comptes,
                nouvelles: resultat.nouvelles,
                coup_de_coeur: resultat.coupsDeCoeur,
                toutes: resultat.totalAuSeuil,
              }}
            />
          )
        }
        // ⚠️ **Masqué avec les filtres quand la base est injoignable, et pour la
        // même raison** : reclasser ce qu'on n'a pas pu lire ne mène nulle part,
        // et le menu prétendrait qu'un classement s'applique à une liste
        // absente.
        tri={resultat.ok && <MenuTri actif={tri} adresses={adressesTri} />}
      />

      {!resultat.ok ? (
        <BaseInjoignable
          motif={resultat.motif}
          explication={resultat.explication}
        />
      ) : filtre === "nouvelles" && resultat.derniereExecution === null ? (
        // ⚠️ **Ce cas passe AVANT le test de liste vide, et l'ordre compte.**
        // Sans dernière collecte connue, `listerOffres` rend zéro offre : la
        // condition suivante afficherait « aucune offre nouvelle », c'est-à-dire
        // une affirmation sur la nuit passée alors qu'on n'a rien pu lire.
        <NouveautesInconnues />
      ) : resultat.offres.length === 0 ? (
        // ⚠️ **TROIS états vides, jamais un seul, et l'ORDRE des tests EST la
        // logique** — même construction que `choisirAffichage()` sur `/`.
        //
        // 1. La base est vide : l'écran du tout premier matin.
        // 2. Le seuil a tout écarté : la base est pleine, rien n'atteint 40.
        // 3. Le filtre est vide : des offres passent le seuil, aucune ici.
        //
        // Les confondre ferait croire à une panne de collecte un matin où le
        // produit fonctionne. Le deuxième cas est arrivé avec le seuil du
        // 31 août 2026 : sans lui, une base de 580 offres dont aucune n'atteint
        // le seuil affichait « la collecte tourne chaque nuit, les premières
        // annonces apparaîtront au prochain passage ».
        resultat.totalCollecte === 0 ? (
          <AucuneOffre />
        ) : resultat.totalFiltreSansSeuil !== null &&
          resultat.totalFiltreSansSeuil > 0 ? (
          // ⚠️ **Le test porte sur ce que le seuil a RÉELLEMENT caché, pas sur
          // le fait qu'il s'applique** — correctif de revue du 31 août 2026. La
          // première version incriminait le seuil dès qu'il était actif : sur
          // « Nouveau », une nuit qui n'a rien ramené affichait « aucune offre
          // "Nouveau" au-dessus de 40/100 » alors que le seuil n'avait rien
          // caché du tout. Ça arrive à **chaque** nuit blanche, donc souvent —
          // et c'était visible à l'écran le jour même. On ne l'accuse
          // maintenant que si des offres existent bel et bien sous lui.
          <AucuneOffreAuSeuil
            libelle={LIBELLES_FILTRE[filtre]}
            ecartees={resultat.totalFiltreSansSeuil}
          />
        ) : (
          <AucuneOffreDansCeFiltre
            libelle={LIBELLES_FILTRE[filtre]}
            totalBase={resultat.totalCollecte}
            // ⚠️ **Ni « Nouveau » ni « Coup de cœur » ne sont des statuts** :
            // la phrase par défaut affirmerait qu'une colonne `statut` les
            // porte en base, alors que le premier se lit sur `execution_id` et
            // le second sur `coup_de_coeur_a`.
            //
            // ⚠️ **« Nouveau » repasse bien ici**, et c'est le sens du
            // correctif ci-dessus : quand la nuit n'a rien ramené, le seuil n'y
            // est pour rien et c'est cette phrase-ci qui est vraie.
            raison={
              filtre === "nouvelles"
                ? "mais aucune ne vient de la dernière collecte"
                : filtre === "coup_de_coeur"
                  ? "mais aucune ne porte de coup de cœur"
                  : undefined
            }
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
          {/* ⚠️ **Une pile de cartes espacées, plus un bloc unique cloisonné
              par des filets.** C'est le changement de forme le plus coûteux de
              la refonte : chaque ligne gagne l'écart qui la sépare de la
              suivante. L'écart est volontairement serré (8 px) — la liste peut
              compter deux cents lignes qu'on balaye le matin, et la respiration
              généreuse d'un tableau de bord à six tuiles s'y paierait en
              défilement. */}
          <div className="flex flex-col gap-2">
            {resultat.offres.map((offre) => (
              <LigneOffre
                key={offre.identifiant}
                offre={offre}
                // `derniereExecution` vaut `null` si on n'a pas pu la lire : on
                // marque alors zéro offre plutôt que de marquer au hasard.
                // ⚠️ **Le badge répond au MÊME critère que la pilule
                // « Nouveau », seuil compris** — correctif de revue du 31 août
                // 2026. Le compteur de la pilule passe par
                // `conditionDuRegime("nouvelles")`, donc par le seuil ; le badge
                // ne regardait que l'exécution. Sur « Candidaté » ou « Coup de
                // cœur », qui n'appliquent aucun seuil, une offre de cette nuit
                // notée 25 portait donc sa pastille « Nouveau » pendant que la
                // pilule juste au-dessus annonçait 0 et menait à un écran vide :
                // trois informations contradictoires sur le même fait, aucune
                // erreur nulle part. C'est la règle que les compteurs ont reçue
                // le même jour, appliquée au marqueur qu'on avait oublié.
                nouvelle={
                  resultat.derniereExecution !== null &&
                  offre.execution_id === resultat.derniereExecution &&
                  offre.note_interet !== null &&
                  offre.note_interet >= SEUIL_INTERET
                }
                // ⚠️ **Le SEUL onglet où retirer un cœur fait sortir la ligne**,
                // donc le seul où le cœur doit prendre le verrou de tri. Partout
                // ailleurs, liker ne réorganise rien et geler les 200 lignes
                // rendrait les boutons de statut inopérants pour rien pendant
                // près d'une seconde.
                coupDeCoeurSortDeLaListe={filtre === "coup_de_coeur"}
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
 * La ligne de compte, sous le titre : ce qui existe, ce qui est jugé, ce qui
 * est à l'écran — dans cet ordre.
 *
 * ⚠️ Elle annonce **le nombre de lignes réellement rendues**, jamais la
 * constante du plafond : les deux ne coïncident que tant que la base renvoie
 * exactement 200 offres. Dès que la phase 4 ajoutera un filtre, la page
 * afficherait « 200 offres affichées » en en montrant 150.
 *
 * ⚠️ **Le compte des offres notées a été RETIRÉ le 29 août 2026, sur décision
 * de Maxime. Ne pas le réintroduire sans rouvrir la question avec lui.**
 *
 * Il existait pour une raison réelle : la page est triée par intérêt
 * décroissant, donc une offre pas encore notée se pose **sous** la plus
 * mauvaise note, et se lit comme une offre jugée sans intérêt. Annoncer
 * « 137 notées » sur 571 avertissait de ce piège.
 *
 * L'argument qui l'emporte est que **ce déséquilibre est transitoire par
 * construction** : la notation tourne chaque nuit sur la collecte de la nuit,
 * donc à terme toute offre arrive notée, et le compte afficherait deux nombres
 * égaux à longueur d'année. Un indicateur qui ne varie plus n'informe plus.
 * ⚠️ **Ce que ça coûte aujourd'hui, en connaissance de cause** : 434 offres
 * restent non notées — l'arriéré d'avant la mise en place du cron — et plus
 * rien à l'écran ne les distingue d'offres mal notées. Le cartouche « Pas
 * encore notée », lui, reste sur chaque ligne concernée : l'information n'est
 * pas perdue, elle est seulement passée du résumé au détail.
 *
 * ⚠️ Le libellé ne dit jamais « les plus récentes » : depuis la phase 2 le tri
 * est sur la note, plus sur la date. Une formule laissée en place aurait
 * décrit un classement qui n'existe plus, sans que rien ne le signale.
 */
function CompteAffiche({
  affichees,
  total,
  sansSeuil,
  filtre,
}: {
  affichees: number;
  total: number | null;
  /**
   * Combien d'offres ce filtre contiendrait sans le seuil. `null` quand le
   * seuil ne retire rien, ou quand le comptage a échoué.
   */
  sansSeuil: number | null;
  filtre: FiltreListe;
}) {
  const segments: string[] = [];
  const avecSeuil = leSeuilRetireQuelqueChose(filtre);

  if (total === null) {
    // On ne connaît pas le total : on ne parle que de ce qu'on montre.
    segments.push(`${affichees} ${accorder(affichees, "offre")} ${accorder(affichees, "affichée")}`);
  } else {
    // ⚠️ **« collectées » a été RETIRÉ le 31 août 2026, et le mot était devenu
    // faux.** L'onglet « Toutes » affichait « 580 offres collectées » ; depuis
    // le seuil, il ne montre que celles qui l'atteignent — écrire « 16 offres
    // collectées » affirmerait que la collecte n'en a ramené que seize.
    // « Retenues » dit ce qui s'est réellement passé : une sélection.
    // ⚠️ **« sur N » est ce qui rend le masquage VISIBLE quand la liste n'est
    // pas vide**, et c'est un correctif de revue du 31 août 2026. Sans lui,
    // l'écart ne se voyait que sur un écran entièrement vide : le jour où la
    // notation échoue mais où l'onglet contient encore les offres notées
    // d'hier, les trente nouvelles disparaissaient **sans un mot** — la pilule
    // « Nouveau » à 0, et la manchette de veille « à jour » puisqu'elle ne
    // regarde que la collecte. « 12 offres retenues sur 42 » le dit.
    const ecartExiste = sansSeuil !== null && sansSeuil > total;
    segments.push(
      avecSeuil
        ? `${total} ${accorder(total, "offre")} ${accorder(total, "retenue")}` +
            (ecartExiste ? ` sur ${sansSeuil}` : "")
        : `${total} ${accorder(total, "offre")}`,
    );
  }

  // Le second segment ne s'écrit que si la liste est vraiment tronquée :
  // « 97 offres retenues · 97 affichées » n'apprendrait rien à personne.
  if (total !== null && total > affichees) {
    segments.push(`${affichees} ${accorder(affichees, "affichée")}`);
  }

  // ⚠️ **Le seuil s'écrit en toutes lettres, et c'est le SEUL endroit de la
  // liste où il se voit** tant qu'elle n'est pas vide. Sans lui, une page qui
  // montre 16 lignes sur une base de 580 n'explique rien : on cherche la panne.
  // ⚠️ **« intérêt » est dit** — le produit porte deux notes, et « ≥ 40/100 »
  // seul laisserait croire que l'accessibilité filtre elle aussi.
  // ⚠️ **Seulement en régime `"seuil"`, jamais sur « Toutes ».** Cet onglet-là
  // montre aussi les offres marquées restées sous le seuil : y annoncer
  // « intérêt ≥ 40/100 » décrirait une liste plus étroite que celle affichée.
  if (regimeDuSeuil(filtre) === "seuil") {
    segments.push(`intérêt ≥ ${SEUIL_INTERET}/100`);
  }

  return <>{segments.join(" · ")}</>;
}
