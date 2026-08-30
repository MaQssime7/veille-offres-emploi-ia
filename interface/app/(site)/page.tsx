/**
 * `/` — l'écran du matin, le compte rendu de la nuit.
 *
 * ⚠️ **Il ne montre QUE la dernière collecte réussie**, et seulement les offres
 * à traiter qui atteignent le seuil d'intérêt. Décision produit du 16 août
 * 2026, qui amende le PRD : la page porte la date de la collecte en tête, et y
 * mêler des offres de la semaine précédente ferait mentir cet entête. Le
 * travail de fond se fait dans `/offres` ; ici on rend compte. La ligne de
 * passage en bas empêche que le reste de la base disparaisse de vue.
 *
 * ⚠️ **`exigerSession()` reste la première ligne.** C'est la seule chose que
 * cette page conserve de la page de contrôle qu'elle remplace : `proxy.ts` a
 * déjà écarté le visiteur sans cookie, et cette ligne-ci protège les offres au
 * plus près de ce qui les affiche.
 *
 * ⚠️ **Six écrans possibles, tous atteignables** : la liste, quatre façons de
 * n'avoir rien à montrer, et la base injoignable. Ce qui distingue un compte
 * rendu d'un écran vide, c'est précisément de dire **laquelle** — voir
 * `_composants/etats-matin.tsx`.
 */

import type { Metadata } from "next";

import { exigerSession } from "@/lib/acces";
import { accorder } from "@/lib/francais";
import {
  type AffichageMatin,
  choisirAffichage,
  lireCompteRenduDuMatin,
} from "@/lib/matin";
import type { OffreEnListe } from "@/lib/offres";
import type { GroupeOffres } from "@/lib/regroupement";
import { lireEtatVeille } from "@/lib/veille";

import { CadrePage } from "./_composants/cadre-page";
import { EnTetePage } from "./_composants/en-tete-page";
import { LigneEtatVeille } from "./_composants/etat-veille";
import { BaseInjoignable } from "./_composants/etats";
import {
  AucuneCollecte,
  CollecteVide,
  PasEncoreNotees,
  SousLeSeuil,
  ToutTraite,
  VideSansDetail,
} from "./_composants/etats-matin";
import { LigneOffre } from "./_composants/ligne-offre";
import { PassagePlanTravail } from "./_composants/passage-plan-travail";
import { VerrouTri } from "./_composants/verrou-tri";

/**
 * ⚠️ **L'onglet nomme l'écran, le `h1` salue — et les deux divergent
 * volontairement**, comme sur `/offres` depuis le 29 août 2026. « Bonjour
 * Maxime » ne désigne rien qu'on puisse mettre en favori ni reconnaître entre
 * deux onglets ouverts ; « Ce matin » le fait.
 */
export const metadata: Metadata = {
  title: "Ce matin — Veille offres emploi IA",
};

export default async function Accueil() {
  // ⚠️ Première ligne, sans exception.
  await exigerSession();

  // Une seule heure de référence pour toute la page : sinon la manchette et un
  // panneau rendus à cheval sur minuit ne dateraient pas du même jour.
  const maintenant = new Date();

  // ⚠️ Les deux lectures partent ENSEMBLE : aucune ne dépend de l'autre, et
  // enchaînées elles doubleraient l'attente avant le premier pixel.
  const [resultat, etatVeille] = await Promise.all([
    lireCompteRenduDuMatin(),
    lireEtatVeille(maintenant),
  ]);

  // ⚠️ **La manchette est rendue dans les DEUX branches ci-dessous**, base
  // injoignable comprise : un écran vide dont la veille date de trois jours
  // s'explique tout seul, le même écran sans indicateur ressemble à une panne.
  const manchette = (
    <LigneEtatVeille etat={etatVeille} maintenant={maintenant} />
  );

  if (!resultat.ok) {
    return (
      <CadrePage>
        <EnTetePage manchette={manchette} />
        <BaseInjoignable
          motif={resultat.motif}
          explication={resultat.explication}
        />
      </CadrePage>
    );
  }

  const affichage = choisirAffichage(
    resultat.groupes,
    resultat.resume,
    resultat.collecte,
  );

  return (
    <CadrePage>
      <EnTetePage
        manchette={manchette}
        // ⚠️ **La date de la collecte n'est PAS répétée ici, et c'est un
        // défaut VU à l'écran le 30 août 2026.** Le sous-titre la portait — la
        // même lecture que les offres, argument de justesse — et le rendu
        // montrait « Hier, 11:11 » deux fois à 90 px d'écart, la manchette
        // l'affichant déjà. Elle reste donc à la manchette, qui est là pour ça
        // et visible en permanence ; le sous-titre ne dit que ce qu'elle ne dit
        // pas : combien d'offres ont passé le seuil.
        //
        // ⚠️ **Ce que ça coûte, dit franchement** : la manchette et la liste
        // sont deux lectures distinctes de la dernière collecte réussie. Si une
        // collecte se termine entre les deux, la date affichée peut désigner une
        // autre exécution que les offres du dessous. Fenêtre de quelques
        // millisecondes, une fois par jour, pour un écart d'affichage — contre
        // une redondance visible tous les matins.
        sousTitre={
          affichage.sorte === "liste" && (
            <p className="font-mono text-xs text-muted-foreground">
              <CompteRetenu
                postes={resultat.groupes.length}
                collectees={
                  resultat.resume?.complet ? resultat.resume.total : null
                }
              />
            </p>
          )
        }
      />

      <Contenu
        affichage={affichage}
        groupes={resultat.groupes}
        maintenant={maintenant}
      />

      {/* ⚠️ **Sous la liste ET sous chaque écran vide.** C'est sous un écran
          vide qu'elle sert le plus : le matin où la nuit n'a rien rapporté, il
          reste des centaines d'offres à trier ailleurs. `null` veut dire « on
          n'a pas pu compter » : la carte disparaît plutôt que d'annoncer un
          chiffre faux, et `0` la fait disparaître aussi — « 0 offre plus
          ancienne attend » n'apprend rien. */}
      {resultat.enAttenteAilleurs !== null && resultat.enAttenteAilleurs > 0 && (
        <PassagePlanTravail enAttente={resultat.enAttenteAilleurs} />
      )}
    </CadrePage>
  );
}

/**
 * Le corps de l'écran : la liste, ou lequel des cinq panneaux.
 *
 * ⚠️ **Le `switch` est exhaustif et le reste** : `AffichageMatin` est une union
 * fermée, donc l'ajout d'une septième sorte fera échouer la compilation ici
 * plutôt que de tomber dans un cas par défaut. C'est le garde-fou qui survit à
 * une modification faite dans six mois — le même que celui de `etat-veille.tsx`.
 *
 * ⚠️ **La date vient de l'`affichage`, pas d'une propriété à part.** Les cinq
 * panneaux datés la lisent sur la variante qui les concerne : il devient
 * impossible d'en rendre un sans sa date, et le compilateur le vérifie.
 */
function Contenu({
  affichage,
  groupes,
  maintenant,
}: {
  affichage: AffichageMatin;
  groupes: GroupeOffres<OffreEnListe>[];
  maintenant: Date;
}) {
  switch (affichage.sorte) {
    case "sans_collecte":
      return <AucuneCollecte />;

    case "liste":
      return (
        // ⚠️ **`VerrouTri` enveloppe la liste ENTIÈRE, et c'est le fond du
        // correctif de la phase 4.** Le clic dangereux n'est pas celui qu'on
        // vient de faire, c'est le suivant, sur la ligne qui aura pris la place
        // — ici une offre passée en « candidaté » quitte la liste, donc tout ce
        // qui est en dessous remonte. Un verrou par ligne ne protégerait de rien.
        <VerrouTri>
          <div className="flex flex-col gap-2">
            {groupes.map(({ principale, jumelles }) => (
              <LigneOffre
                key={principale.identifiant}
                offre={principale}
                // ⚠️ **Les jumelles descendent jusqu'aux boutons de statut**,
                // qui traitent alors le poste entier. Sans elles, écarter
                // l'annonce affichée laisserait sa jumelle « à traiter » et le
                // poste reviendrait au chargement suivant.
                jumelles={jumelles}
                // ⚠️ **Toujours vrai sur cet écran, et c'est exact plutôt que
                // redondant** : toutes ces offres viennent, par construction, de
                // la dernière collecte réussie. C'est la même définition que sur
                // `/offres`, où elle distingue. Décision de Maxime le 30 août
                // 2026 : la garder ici, pour que la bulle veuille dire la même
                // chose sur les deux écrans.
                nouvelle
                maintenant={maintenant}
              />
            ))}
          </div>
        </VerrouTri>
      );

    case "collecte_vide":
      return (
        <CollecteVide
          collecteA={affichage.collecteA}
          maintenant={maintenant}
        />
      );

    case "pas_encore_notees":
      return (
        <PasEncoreNotees
          combien={affichage.combien}
          dejaTentees={affichage.dejaTentees}
          collecteA={affichage.collecteA}
          maintenant={maintenant}
        />
      );

    case "sous_le_seuil":
      return (
        <SousLeSeuil
          total={affichage.total}
          nonNotees={affichage.nonNotees}
          collecteA={affichage.collecteA}
          maintenant={maintenant}
        />
      );

    case "tout_traite":
      return (
        <ToutTraite
          auSeuil={affichage.auSeuil}
          collecteA={affichage.collecteA}
          maintenant={maintenant}
        />
      );

    case "vide_sans_detail":
      return (
        <VideSansDetail
          collecteA={affichage.collecteA}
          maintenant={maintenant}
        />
      );
  }
}

/**
 * « 2 postes retenus sur 7 offres collectées », ou « 2 postes retenus » quand on
 * ne sait pas combien la collecte contenait.
 *
 * ⚠️ **« postes » et non « offres », et le mot est le correctif d'un défaut vu à
 * l'écran le 30 août 2026.** L'écran regroupe les annonces d'un même poste :
 * écrire « 2 offres retenues sur 7 collectées » ferait croire que cinq offres
 * ont été jugées inintéressantes, alors que deux d'entre elles sont les jumelles
 * des deux affichées. Les deux nombres ne comptent pas la même chose — le
 * premier des postes, le second des lignes en base — et le vocabulaire est ce
 * qui le dit.
 *
 * ⚠️ **Le mot « retenus » est le seul endroit où le seuil se voit.** L'écran
 * cache les offres sous le seuil d'intérêt : sans lui, la liste passerait pour
 * la totalité de la nuit.
 *
 * ⚠️ **`null` ne s'écrit pas « sur 0 ».** Un résumé illisible ou tronqué ne
 * permet pas de dire combien la collecte contenait : le segment disparaît
 * plutôt que d'annoncer un total inventé.
 */
function CompteRetenu({
  postes,
  collectees,
}: {
  postes: number;
  collectees: number | null;
}) {
  const debut = `${postes} ${accorder(postes, "poste")} ${accorder(postes, "retenu")}`;

  if (collectees === null) return <>{debut}</>;

  return (
    <>{`${debut} sur ${collectees} ${accorder(collectees, "offre")} ${accorder(collectees, "collectée")}`}</>
  );
}
