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
 * ⚠️ **Toute la chaîne est en composants serveur, et c'est une propriété à
 * préserver.** Cette page lit `contact_nom` — la seule donnée nominative du
 * projet. Tant qu'aucun composant client n'est posé ici, seules les valeurs
 * réellement rendues traversent vers le navigateur : les props, elles, ne
 * traversent pas. Le dépliage de la description utilise le `<details>` natif
 * précisément pour ne pas casser ça (voir `_composants/description.tsx`).
 * La phase 4 posera des boutons de statut, donc des composants clients : il
 * faudra alors leur passer les champs un par un, jamais l'objet `offre`.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cache } from "react";

import { exigerSession } from "@/lib/acces";
import { lireOffre } from "@/lib/offres";

import { CadrePage } from "../_composants/en-tete-page";
import { BaseInjoignable } from "../_composants/etats";
import { ContenuNotes, etatNotation } from "../_composants/notes";
import { DescriptionOffre } from "./_composants/description";
import { EnTeteOffre } from "./_composants/entete";
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
    return { title: "Offre introuvable — Veille offres emploi IA" };
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
        <BaseInjoignable
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
        {offre.resume && (
          <p className="max-w-prose text-base leading-relaxed text-foreground">
            {offre.resume}
          </p>
        )}

        {/* Le bloc des notes ne se rend pas pour une offre en attente : son cas
            est déjà dit par le cartouche de l'entête. Même arbitrage qu'en
            liste — un état vide ne doit pas être plus encombrant que l'état
            plein. */}
        {etatNotation(offre) !== "en-attente" && (
          <section aria-labelledby="titre-notes">
            <h2
              id="titre-notes"
              className="libelle-mono mb-3 text-muted-foreground"
            >
              Évaluation
            </h2>
            <div className="border border-border bg-card px-4 py-4">
              <ContenuNotes offre={offre} />
            </div>
          </section>
        )}

        <Renseignements offre={offre} />

        <section aria-labelledby="titre-description">
          <h2
            id="titre-description"
            className="libelle-mono mb-3 text-muted-foreground"
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
      className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring hover:text-foreground"
    >
      <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
      Toutes les offres
    </Link>
  );
}
