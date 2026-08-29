"use client";

/**
 * Page de contrôle temporaire, posée par /installe.
 * Elle prouve que la chaîne fonctionne : les trois polices se chargent, les
 * jetons de couleur du DESIGN.md sont appliqués, le mode sombre bascule.
 * Elle sera remplacée par le compte rendu de la nuit en phase 1.
 *
 * Déplacée dans un dossier privé (préfixe `_`, hors routage) le 21 août :
 * `app/page.tsx` est redevenue un composant serveur, pour pouvoir y appeler
 * `exigerSession()`. Un composant client ne peut pas lire de cookie côté
 * serveur, donc il ne peut pas porter la serrure.
 */

const JETONS = [
  { nom: "background", surface: "bg-background", texte: "text-foreground" },
  { nom: "card", surface: "bg-card", texte: "text-card-foreground" },
  { nom: "primary", surface: "bg-primary", texte: "text-primary-foreground" },
  { nom: "secondary", surface: "bg-secondary", texte: "text-secondary-foreground" },
  { nom: "muted", surface: "bg-muted", texte: "text-muted-foreground" },
  { nom: "accent", surface: "bg-accent", texte: "text-accent-foreground" },
  { nom: "signal", surface: "bg-signal", texte: "text-signal-foreground" },
  { nom: "signal-fort", surface: "bg-signal-fort", texte: "text-primary-foreground" },
  { nom: "success", surface: "bg-success", texte: "text-success-foreground" },
  { nom: "destructive", surface: "bg-destructive", texte: "text-destructive-foreground" },
];

export function PageDeControle() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-3 border-b border-border pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Page de contrôle — installation
        </p>
        <h1 className="font-display text-4xl font-bold text-foreground">
          Veille offres emploi IA
        </h1>
        <button
          type="button"
          onClick={() => document.documentElement.classList.toggle("dark")}
          className="w-fit rounded-md border border-input bg-card px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Basculer le mode sombre
        </button>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Les trois polices
        </h2>
        {/* ⚠️ Ces trois lignes NOMMENT la police qu'elles affichent : elles
            deviennent fausses au moindre changement de typographie, et rien ne
            le signale — le texte reste lisible, il ment simplement. Corrigées
            le 29 août 2026 au passage de Fraunces/Geist à Fredoka/Nunito. */}
        <p className="font-display text-2xl font-bold text-foreground">
          Fredoka 700 — titrage, les titres de page et rien d’autre
        </p>
        <p className="font-sans text-base text-foreground">
          Nunito — texte courant et interface. Ingénieur en intelligence
          artificielle, jeune diplômé, Île-de-France.
        </p>
        <p className="font-mono text-sm text-foreground">
          Geist Mono — 0123456789 · Intérêt 87 · Accessibilité 62 · 2026-08-17
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Jetons de couleur
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {JETONS.map((jeton) => (
            <div
              key={jeton.nom}
              className={`${jeton.surface} ${jeton.texte} rounded-md border border-border px-3 py-4 font-mono text-xs`}
            >
              {jeton.nom}
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Rayon de bordure et filets
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          {["rounded-sm", "rounded-md", "rounded-lg", "rounded-xl"].map((r) => (
            <div
              key={r}
              className={`${r} size-16 border border-border bg-card p-2 font-mono text-[10px] text-muted-foreground`}
            >
              {r}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
