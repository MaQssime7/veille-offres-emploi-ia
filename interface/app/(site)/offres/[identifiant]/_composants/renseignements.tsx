import type { OffreEnFiche } from "@/lib/offres";

import { formaterLangue } from "../../_composants/formats";

/**
 * Ce que France Travail sait de l'offre, au-delà de ce que l'annonce raconte.
 *
 * Entre : l'offre lue en base.
 * Sort : une liste de définitions — libellé à gauche, valeur à droite. Les
 * lignes sans valeur ne se rendent pas.
 * Casse : renvoie `null` si aucune ligne n'a de valeur, pour ne pas laisser un
 * cadre vide sur la page. En pratique ça n'arrive jamais : l'appellation et le
 * libellé ROME sont renseignés sur 560 offres sur 560.
 *
 * ⚠️ **L'appellation et le code ROME disent *pourquoi cette offre est là*.**
 * C'est l'appellation que le moteur de recherche France Travail indexe — pas
 * l'intitulé. Sur l'offre notée 85, l'annonce titre « Alternant Ingénieur IA
 * Agentique » et le référentiel la classe « Spécialiste IA embarquée ». C'est
 * aussi par ce champ que le faux positif `IPR-IA` entrait dans la collecte.
 * Les afficher prolonge sur la fiche ce que la liste fait déjà : rendre
 * visible ce que les critères ramènent réellement.
 *
 * ⚠️ **`experience_libelle` n'est PAS ici, et son absence est une décision.**
 * Le champ est renseigné sur 560 offres sur 560 — donc irrésistible — et il
 * contredit le texte de l'annonce environ **une fois sur deux** (mesuré : deux
 * offres sur trois vérifiées annonçaient « Débutant accepté » là où le corps
 * exigeait trois ans). L'afficher au même rang que le lieu reviendrait à poser
 * un mensonge dans la colonne des faits. C'est aussi l'argument central du
 * projet : si ces métadonnées suffisaient, un modèle n'aurait pas besoin de
 * lire le texte.
 *
 * ⚠️ **`tranche_effectif` et le secteur d'activité non plus.** Ils sont la
 * matière de la phase 6 : l'agent d'enrichissement produira la taille de
 * l'entreprise en lisant son site. Les afficher ici préparerait deux valeurs
 * contradictoires sur la même page — « 250 salariés » d'un côté, « 6 à 9
 * salariés » de l'autre — sans aucune règle pour arbitrer.
 */
export function Renseignements({ offre }: { offre: OffreEnFiche }) {
  // ⚠️ **`langues` est du `jsonb` recopié VERBATIM de France Travail** — aucune
  // contrainte de forme en base, aucune validation à la lecture. Le type
  // TypeScript décrit ce qu'on a observé, pas ce que la source garantit. Si
  // l'API renvoyait un jour un objet au lieu d'une liste, ou une liste
  // contenant `null`, un `.map()` direct lèverait en plein rendu et la fiche
  // entière basculerait sur l'écran d'erreur — alors que `lireOffre()` promet
  // par contrat de ne jamais lever. On se contente donc de ce qui a la bonne
  // forme, et on ignore le reste en silence : une langue manquante est moins
  // grave qu'une fiche qui disparaît.
  const langues = (Array.isArray(offre.langues) ? offre.langues : [])
    .filter((entree): entree is { libelle?: string | null; exigence?: string | null } =>
      typeof entree === "object" && entree !== null)
    .map(formaterLangue)
    .filter((valeur): valeur is string => valeur !== null);

  const lignes: { libelle: string; valeur: string }[] = [];

  if (offre.appellation_libelle) {
    lignes.push({ libelle: "Appellation", valeur: offre.appellation_libelle });
  }
  if (offre.rome_libelle) {
    lignes.push({ libelle: "Métier ROME", valeur: offre.rome_libelle });
  }
  if (offre.qualification_libelle) {
    lignes.push({
      libelle: "Qualification",
      valeur: offre.qualification_libelle,
    });
  }
  // ⚠️ **Aucune ligne « Langues : non précisé », jamais.** Mesuré sur les
  // 560 offres : 127 exigent l'anglais dans leur texte et ce champ n'en capte
  // que 10. Une mention d'absence se lirait « pas d'anglais exigé » alors
  // qu'elle voudrait dire « la case n'a pas été remplie » — 117 fois sur 127.
  // C'est le `NULL` ≠ `false` de la base, qui doit tenir jusqu'à l'écran.
  // L'exigence réelle est lue dans le TEXTE par le modèle, et remonte dans la
  // justification d'accessibilité depuis le 28 août 2026.
  if (langues.length > 0) {
    lignes.push({ libelle: "Langues", valeur: langues.join(" · ") });
  }

  if (lignes.length === 0) return null;

  return (
    <section aria-labelledby="titre-renseignements">
      <h2
        id="titre-renseignements"
        className="titre-section mb-3"
      >
        Classement France Travail
      </h2>

      {/* `dl` et non un tableau : ce sont des paires libellé/valeur, pas des
          données à croiser en deux dimensions. Un lecteur d'écran annonce le
          couple, ce qu'une grille de `div` ne ferait pas. */}
      <dl className="grid gap-x-6 gap-y-2 carte-produit px-4 py-3 sm:grid-cols-[9rem_1fr]">
        {lignes.map(({ libelle, valeur }) => (
          <div key={libelle} className="contents">
            <dt className="libelle-mono text-muted-foreground">{libelle}</dt>
            <dd className="text-sm leading-relaxed text-foreground">
              {valeur}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
