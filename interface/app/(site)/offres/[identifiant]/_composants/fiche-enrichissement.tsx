"use client";

import { BadgeCheck, CircleHelp, ExternalLink } from "lucide-react";

import {
  DITS_APPARIEMENT,
  TITRES_RUBRIQUES,
  TRANCHES_EFFECTIF,
  type Etape,
  type FicheEntreprise,
  type Marqueur,
} from "@/lib/enrichissement";
import { accorder } from "@/lib/francais";

/**
 * Ce que l'agent a trouvé sur l'entreprise, présenté dans la fenêtre modale.
 *
 * Entre : la fiche lue en base et les étapes franchies.
 * Sort : l'ancrage vérifiable, les rubriques rédigées, et le chemin suivi.
 * Casse : rien — chaque valeur absente devient « non disponible » en toutes
 * lettres, et une fiche entièrement vide reste lisible.
 *
 * ⚠️ **« Non disponible » s'écrit ICI et JAMAIS en base.** C'est une règle du
 * schéma, et c'est cet écran qui la paie : en base, une information manquante
 * est une colonne `NULL` ou une ligne absente. Écrire la chaîne en base
 * rendrait impossible de distinguer « l'agent n'a rien trouvé » de « l'agent a
 * trouvé que c'était non disponible » — et de compter ce qu'il trouve vraiment.
 *
 * ⚠️ **Le degré de certitude passe AVANT les données, et c'est délibéré.** Le
 * risque nommé au PRD est la fiche fausse d'apparence rigoureuse : des données
 * exactes sur la mauvaise entreprise restent fausses. Mettre le SIREN en tête et
 * le doute en bas de page inverserait exactement l'ordre de lecture qu'il faut.
 */
export function FicheEnrichissement({
  fiche,
  etapes,
}: {
  fiche: FicheEntreprise;
  etapes: Etape[];
}) {
  const identite = [
    { libelle: "Nom officiel", valeur: fiche.nomOfficiel },
    { libelle: "SIREN", valeur: fiche.siren },
    { libelle: "Créée le", valeur: formaterDateCreation(fiche.creeeLe) },
  ];

  const taille = [
    {
      libelle: "Effectif",
      // ⚠️ La tranche et son millésime ne se séparent JAMAIS. Le registre ne
      // rend qu'un seul millésime, parfois vieux de plusieurs années : « 100 à
      // 199 salariés » sans date se lit comme la taille d'aujourd'hui.
      valeur:
        fiche.trancheEffectif && fiche.trancheEffectifAnnee
          ? `${TRANCHES_EFFECTIF[fiche.trancheEffectif] ?? `code INSEE ${fiche.trancheEffectif}`} (${fiche.trancheEffectifAnnee})`
          : null,
    },
    {
      libelle: "Chiffre d’affaires",
      valeur:
        fiche.chiffreAffaires !== null && fiche.chiffreAffairesAnnee !== null
          ? `${formaterEuros(fiche.chiffreAffaires)} (exercice ${fiche.chiffreAffairesAnnee})`
          : null,
    },
  ];

  // ⚠️ **La catégorie INSEE a été RETIRÉE de l'affichage le 30 août 2026**, avec
  // l'avertissement de filiale qui l'accompagnait — décision de Maxime :
  // « l'effectif me suffit ». La colonne reste en base, mais l'agent ne la rend
  // plus : voir le préambule de `_valider_fiche()` côté Python.

  return (
    <div className="flex flex-col gap-6">
      <Appariement fiche={fiche} />

      <Groupe titre="Identité" lignes={identite}>
        {fiche.site ? (
          <div className="contents">
            <dt className="libelle-mono text-foreground">Site officiel</dt>
            <dd className="flex flex-wrap items-center gap-2">
              {/* ⚠️ **`rel="noopener noreferrer"` n'est pas optionnel ici.**
                  Cette adresse a été trouvée par un modèle sur une page web que
                  personne ne contrôle. `noopener` empêche la page ouverte de
                  manipuler la nôtre par `window.opener` ; `noreferrer` lui
                  cache d'où vient le clic. Le schéma, lui, a déjà été validé
                  côté Python — seuls `http://` et `https://` passent, ce qui
                  ferme la porte à un `javascript:` glissé par une page
                  hostile. */}
              <a
                href={fiche.site}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-produit inline-flex items-center gap-1.5 text-base leading-relaxed text-primary underline-offset-4 hover:underline"
              >
                {fiche.site.replace(/^https?:\/\/(www\.)?/, "")}
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
              <Pastille marqueur={fiche.siteMarqueur} />
            </dd>
          </div>
        ) : (
          <div className="contents">
            <dt className="libelle-mono text-foreground">Site officiel</dt>
            <dd>
              <Absent />
            </dd>
          </div>
        )}
      </Groupe>

      <Groupe titre="Taille et santé" lignes={taille} />

      <section>
        <h3 className="titre-section mb-3">Ce que l’agent a compris</h3>
        <div className="flex flex-col gap-3">
          {Object.entries(TITRES_RUBRIQUES).map(([cle, titre]) => {
            const rubrique = fiche.rubriques.find((r) => r.rubrique === cle);
            return (
              <div key={cle} className="carte-produit p-5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h4 className="libelle-mono text-foreground">{titre}</h4>
                  {rubrique ? <Pastille marqueur={rubrique.marqueur} /> : null}
                </div>
                {rubrique ? (
                  // `whitespace-pre-wrap` : les rubriques acceptent plusieurs
                  // paragraphes, et un agent qui en écrit deux doit les voir
                  // rendus comme deux.
                  <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
                    {rubrique.valeur}
                  </p>
                ) : (
                  <p>
                    <Absent />
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {etapes.length > 0 ? (
        <details className="group">
          <summary className="focus-produit flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
            <span
              aria-hidden="true"
              className="text-muted-foreground transition-transform group-open:rotate-90"
            >
              ›
            </span>
            Le chemin suivi&nbsp;: {etapes.length}{" "}
            {accorder(etapes.length, "étape")}
          </summary>
          {/* ⚠️ Ces étapes sont les traces des OUTILS que l'agent a réellement
              appelés, pas une narration qu'il aurait produite. C'est ce qui les
              rend fiables — et c'est l'argument à montrer en entretien. */}
          <ol className="mt-3 flex flex-col gap-2">
            {etapes.map((etape) => (
              <li
                key={etape.rang}
                className="flex items-start gap-2 text-sm leading-relaxed text-foreground"
              >
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground"
                />
                <span>{etape.libelle}</span>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}

/**
 * Le degré de certitude, en tête et en clair.
 *
 * ⚠️ **L'information ne tient jamais sur la seule couleur** — plancher
 * d'accessibilité du projet. Le mot (« Identité vérifiée », « Identité
 * probable ») porte le sens ; l'icône et la teinte ne font que le renforcer.
 */
function Appariement({ fiche }: { fiche: FicheEntreprise }) {
  const sur = fiche.appariement === "verifie";
  return (
    <section
      className={`flex items-start gap-3 rounded-2xl p-5 ${
        sur ? "bg-success/40" : "bg-signal/40"
      }`}
    >
      {sur ? (
        <BadgeCheck className="mt-0.5 size-5 shrink-0 text-foreground" aria-hidden="true" />
      ) : (
        <CircleHelp className="mt-0.5 size-5 shrink-0 text-foreground" aria-hidden="true" />
      )}
      <div className="flex flex-col gap-1">
        <p className="text-base font-bold leading-snug text-foreground">
          {DITS_APPARIEMENT[fiche.appariement]}
        </p>
        {fiche.appariementMotif ? (
          <p className="text-sm leading-relaxed text-foreground">
            {fiche.appariementMotif}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** Un groupe de paires libellé / valeur, les absentes en « non disponible ». */
function Groupe({
  titre,
  lignes,
  children,
}: {
  titre: string;
  lignes: { libelle: string; valeur: string | null }[];
  children?: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="titre-section mb-3">{titre}</h3>
      {/* ⚠️ `items-baseline` : les lignes de base du libellé et de la valeur
          n'ont pas la même hauteur de ligne, et aligner les boîtes ferait
          flotter le libellé au-dessus du texte qu'il désigne. Constat de Maxime
          le 29 août sur l'ancien bloc de renseignements — le décalage y était
          de 6,8 px. */}
      <dl className="grid items-baseline gap-x-6 gap-y-3.5 carte-produit p-6 sm:grid-cols-[10rem_1fr]">
        {lignes.map(({ libelle, valeur }) => (
          <div key={libelle} className="contents">
            <dt className="libelle-mono text-foreground">{libelle}</dt>
            <dd className="text-base leading-relaxed text-foreground">
              {valeur ?? <Absent />}
            </dd>
          </div>
        ))}
        {children}
      </dl>
    </section>
  );
}

/**
 * « non disponible », la seule façon de dire une absence sur cette fiche.
 *
 * ⚠️ **L'ITALIQUE met en retrait, JAMAIS une couleur affaiblie** — et ce n'est
 * pas un choix de goût, c'est la règle que le projet a déjà tranchée pour
 * « Entreprise non communiquée » : `muted-foreground` échoue le plancher
 * d'accessibilité en mode sombre (2,75:1 sur les cartes contre 4,5 exigés,
 * mesuré le 30 août 2026). Le premier jet de cette fiche l'employait aux trois
 * endroits où une absence s'écrit — c'est-à-dire là où une fiche pauvre en
 * affiche le plus.
 *
 * ⚠️ **Et l'absence DOIT rester distinguable d'une valeur**, sinon « non
 * disponible » se lirait comme le contenu d'une rubrique. L'italique fait ce
 * travail sans toucher au contraste.
 */
function Absent() {
  return (
    <span className="text-base leading-relaxed text-foreground italic">
      non disponible
    </span>
  );
}

/**
 * *vérifié* ou *déduit*, à côté de ce que ça qualifie.
 *
 * ⚠️ **Le marqueur est le cœur d'US-21** : ne jamais prendre une supposition
 * pour un fait en entretien. Il est donc écrit en toutes lettres, jamais réduit
 * à une couleur ou à une icône seule.
 */
function Pastille({ marqueur }: { marqueur: Marqueur | null }) {
  if (!marqueur) return null;
  const verifie = marqueur === "verifie";
  return (
    <span
      className={`libelle-mono rounded-full px-2 py-0.5 ${
        verifie
          ? "bg-success/55 text-success-foreground"
          : "bg-signal/40 text-signal-foreground"
      }`}
    >
      {verifie ? "vérifié" : "déduit"}
    </span>
  );
}

/** « 2003-04-14 » → « 14 avril 2003 ». */
function formaterDateCreation(iso: string | null): string | null {
  if (!iso) return null;
  // ⚠️ **`T12:00:00Z` et non la date nue.** `new Date("2003-04-14")` est
  // interprétée en UTC, puis affichée dans le fuseau du lecteur : à Paris en
  // hiver, une date nue recule d'un jour. Midi met la valeur à l'abri des deux
  // côtés. Même piège que celui qui a fait ajouter le second passage `TZ=UTC`
  // à la suite de tests le 29 août.
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(date);
}

/** 18 870 529 → « 18,9 M€ », parce qu'un chiffre d'affaires se lit en ordre de grandeur. */
function formaterEuros(montant: number): string {
  if (montant >= 1_000_000_000) {
    return `${(montant / 1_000_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Md€`;
  }
  if (montant >= 1_000_000) {
    return `${(montant / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M€`;
  }
  return `${montant.toLocaleString("fr-FR")} €`;
}
