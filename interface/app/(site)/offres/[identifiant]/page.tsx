/**
 * `/offres/[identifiant]` — la fiche d'une offre.
 *
 * Ce que l'écran montre, dans l'ordre où on le lit : l'entête, le résumé écrit
 * par le modèle, les deux notes avec leurs justifications, le classement France
 * Travail, la description intégrale repliée, et comment candidater.
 *
 * Quatre états, tous atteignables : la fiche, l'offre introuvable (identifiant
 * mal formé ou inexistant), la base injoignable, et le chargement
 * (`loading.tsx`).
 *
 * ⚠️ **La chaîne N'EST PLUS entièrement en composants serveur, et ce qui
 * protégeait la page est devenu une discipline.** Jusqu'à la phase 4, aucune
 * prop ne traversait vers le navigateur : seules les valeurs réellement rendues
 * le faisaient. Deux composants clients sont désormais posés ici — les boutons
 * de statut dans l'entête, et le champ de note — et cette page lit les deux
 * seules catégories de données personnelles du projet : `contact_nom`, et la
 * note que Maxime écrit lui-même.
 *
 * **La règle qui remplace la propriété perdue : on passe des champs, un par un,
 * jamais l'objet `offre`.** `<NotePersonnelle offre={offre} />` compilerait sans
 * la moindre erreur et enverrait les 22 colonnes dans le document. Le seul
 * garde-fou restant est la mesure — chercher les colonnes interdites dans le
 * document reçu par le navigateur, après chaque nouveau composant client.
 *
 * Le dépliage de la description reste en `<details>` natif : aucune raison d'en
 * faire un composant client de plus (voir `_composants/description.tsx`).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cache } from "react";

import { exigerSession } from "@/lib/acces";
import { lireOffre } from "@/lib/offres";

import { CadrePage } from "../../_composants/cadre-page";
import { BaseInjoignable } from "../../_composants/etats";
import { ContenuNotes, etatNotation } from "../../_composants/notes";
import { DescriptionOffre } from "./_composants/description";
import { EnTeteOffre } from "./_composants/entete";
import { NotePersonnelle } from "./_composants/note-personnelle";
import { Postuler } from "./_composants/postuler";
import { Renseignements } from "./_composants/renseignements";

/**
 * ⚠️ **`cache()` évite de lire l'offre DEUX fois.** Next appelle
 * `generateMetadata` puis le composant de page, dans deux passes distinctes :
 * sans mémorisation, chaque affichage produirait deux requêtes identiques vers
 * Supabase. La déduplication automatique de `fetch` ne s'applique pas ici — nos
 * requêtes partent en `cache: "no-store"`, ce qui la désactive. `cache()` de
 * React mémorise pour la durée d'un seul rendu, jamais entre deux visiteurs :
 * c'est bien un dédoublonnage, pas une mise en cache des données.
 */
const lireOffreUneFois = cache(lireOffre);

export async function generateMetadata(
  { params }: PageProps<"/offres/[identifiant]">,
): Promise<Metadata> {
  // ⚠️ **Oui, la serrure aussi ici.** `generateMetadata` s'exécute
  // indépendamment du composant de page : sans cet appel, une requête sans
  // session déclencherait quand même la lecture en base — le proxy l'arrête
  // aujourd'hui, mais la doctrine du projet est que le proxy est la commodité
  // et `exigerSession()` la serrure. Une serrure qu'on pose « sauf ici » n'en
  // est plus une.
  await exigerSession();

  const { identifiant } = await params;
  const resultat = await lireOffreUneFois(identifiant);

  if (!resultat.ok) {
    // ⚠️ **Le titre distingue les deux pannes, et ce n'est pas un détail.**
    // `ResultatFiche` sépare « il n'y a rien à cette adresse » de « la base n'a
    // pas répondu » ; confondre les deux dans le titre ferait mentir l'onglet —
    // et le titre est ce qui survit dans l'historique et dans un favori, bien
    // après que la page a disparu de l'écran.
    return {
      title:
        resultat.motif === "introuvable"
          ? "Offre introuvable — Veille offres emploi IA"
          : "Offre indisponible — Veille offres emploi IA",
    };
  }

  // Le plus long intitulé en base fait 223 caractères : on tronque, un onglet
  // de navigateur n'en affiche qu'une poignée de toute façon.
  const intitule = resultat.offre.intitule;
  const court = intitule.length > 70 ? `${intitule.slice(0, 69)}…` : intitule;

  return { title: `${court} — Veille offres emploi IA` };
}

export default async function PageOffre({
  params,
}: PageProps<"/offres/[identifiant]">) {
  // ⚠️ Première ligne, sans exception.
  await exigerSession();

  const { identifiant } = await params;
  const resultat = await lireOffreUneFois(identifiant);

  if (!resultat.ok) {
    // ⚠️ **`notFound()` n'est pas dans un `try`, et ne doit jamais l'être** : il
    // fonctionne en levant une exception que Next intercepte pour rendre
    // `not-found.tsx`. Attrapée par un `catch`, la navigation ne se ferait pas.
    // Il renvoie `never`, ce qui suffit à TypeScript pour savoir qu'en dessous
    // il ne reste que les deux motifs de panne — sans le moindre transtypage.
    if (resultat.motif === "introuvable") {
      notFound();
    }

    return (
      <CadrePage>
        <RetourListe />
        {/* ⚠️ `niveauTitre={1}` : sur cette page, le `h1` est porté par
            l'intitulé de l'offre — qu'on n'a justement pas pu lire. Sans lui,
            l'arbre de titres démarrerait au niveau 2, ce que le plancher
            d'accessibilité du projet n'admet pas. Sur `/offres`, le `h1`
            « Offres » existe déjà : le panneau y reste en niveau 2. */}
        <BaseInjoignable
          niveauTitre={1}
          motif={resultat.motif}
          explication={resultat.explication}
        />
      </CadrePage>
    );
  }

  const { offre } = resultat;
  const maintenant = new Date();

  return (
    <CadrePage>
      <RetourListe />
      <EnTeteOffre offre={offre} maintenant={maintenant} />

      {/* Colonne unique, et c'est une décision — pas un provisoire.
          `docs/DESIGN.md` prévoyait deux colonnes, la droite portant la fiche
          d'enrichissement. Or celle-ci n'arrive qu'en **phase 6** : deux
          colonnes aujourd'hui laisseraient un vide de 404 px sur toute la
          hauteur. Et le défaut connu « colonne gauche creuse » est pire que
          décrit — il annonçait un résumé de trois lignes, la mesure du 28 août
          en donne **122 caractères en médiane**, soit une ligne et demie, et
          absent sur les 434 offres pas encore notées. La question des deux
          colonnes se rouvre en phase 6, quand il y aura de quoi les remplir. */}
      <div className="flex flex-col gap-8">
        {/* ⚠️ **Le titre n'est pas décoratif : sans lui, ces deux phrases sont
            orphelines.** Relevé par Maxime en regardant la page — on voit un
            paragraphe en haut de fiche sans savoir ce qu'il est ni d'où il
            vient. Les quatre autres blocs portent le leur ; celui-ci faisait
            exception sans raison.
            ⚠️ Ce résumé est **écrit par le modèle pendant la notation**, ce
            n'est pas un extrait de l'annonce. D'où sa place juste au-dessus de
            l'évaluation, et son absence sur les 434 offres non notées. */}
        {offre.resume && (
          <section aria-labelledby="titre-resume">
            <h2
              id="titre-resume"
              className="titre-section mb-3"
            >
              Résumé de l’offre
            </h2>
            {/* ⚠️ **Le cadre n'est pas décoratif : il aligne ce bloc sur ses
                quatre voisins.** Évaluation, Classement, L'annonce et Candidater
                portent tous `carte-produit` ; le résumé était le
                seul à ne rien porter — et il est le premier qu'on lit. Mesuré au
                DOM le 29 août 2026 : son paragraphe s'arrêtait à **690 px sur
                952**, sans filet pour dire où le bloc finissait, ce qui le
                faisait lire comme un texte tronqué plutôt que comme une colonne
                de lecture. Relevé par Maxime en regardant la page.
                ⚠️ **`max-w-prose` RESTE, et le vide à sa droite est voulu.**
                Sans lui, une ligne ferait ~150 caractères sur cette largeur —
                au-delà de ce qui se lit confortablement, même règle que la
                description intégrale. Dans un cadre, ce vide se lit comme une
                marge ; c'est sans cadre qu'il se lisait comme une coupure. */}
            <div className="carte-produit p-6">
              <p className="max-w-prose text-base leading-relaxed text-foreground">
                {offre.resume}
              </p>
            </div>
          </section>
        )}

        {/* Le bloc des notes ne se rend pas pour une offre en attente : son cas
            est déjà dit par le cartouche de l'entête. Même arbitrage qu'en
            liste — un état vide ne doit pas être plus encombrant que l'état
            plein. */}
        {etatNotation(offre) !== "en-attente" && (
          <section aria-labelledby="titre-notes">
            <h2
              id="titre-notes"
              className="titre-section mb-3"
            >
              Évaluation
            </h2>
            <div className="carte-produit p-6">
              <ContenuNotes offre={offre} aere />
            </div>
          </section>
        )}

        {/* ⚠️ **Trois props scalaires, jamais `offre`.** Ce composant est
            client : tout ce qu'on lui passe part dans le document envoyé au
            navigateur. Voir l'avertissement en tête de fichier.
            La note se place juste après l'évaluation du modèle — ce que Maxime
            en pense à côté de ce que la machine en pense — et avant l'annonce,
            pour qu'elle soit visible sans dérouler la fiche. */}
        <NotePersonnelle
          identifiant={offre.identifiant}
          noteInitiale={offre.note_personnelle}
          dateInitiale={offre.note_modifiee_a}
        />

        <Renseignements offre={offre} />

        <section aria-labelledby="titre-description">
          <h2
            id="titre-description"
            className="titre-section mb-3"
          >
            L’annonce
          </h2>
          <DescriptionOffre texte={offre.description} />
        </section>

        <Postuler offre={offre} />
      </div>
    </CadrePage>
  );
}

/**
 * Le retour vers la liste.
 *
 * ⚠️ **Un vrai lien, jamais un `router.back()`.** Le retour arrière du
 * navigateur dépend d'où l'on vient : arrivé par un favori ou par une adresse
 * collée, il ne mène nulle part. Un `Link` mène toujours à la liste, et se
 * comporte comme un lien — clic du milieu, ouverture dans un onglet.
 */
function RetourListe() {
  return (
    <Link
      href="/offres"
      className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
      Toutes les offres
    </Link>
  );
}
