import { CadrePage, EnTetePage } from "./_composants/en-tete-page";

/**
 * L'état de chargement de `/offres`.
 *
 * Next.js enveloppe la page dans une frontière Suspense dont ceci est le
 * repli : il s'affiche pendant que le serveur interroge la base, et cède la
 * place dès que la liste arrive.
 *
 * ⚠️ Il **partage** son en-tête et son cadre avec la page (`EnTetePage`,
 * `CadrePage`) au lieu de les recopier. C'est ce partage qui garantit la seule
 * chose que ce fichier doit garantir : que le contenu réel ne fasse pas sauter
 * la mise en page en arrivant. Deux copies du même balisage divergeraient à la
 * première modification, sans erreur pour le signaler.
 *
 * ⚠️ La pulsation est une boucle d'animation : elle est coupée par le bloc
 * `prefers-reduced-motion` de `globals.css`, qui est opposable sur ce projet.
 */
export default function ChargementOffres() {
  return (
    <CadrePage aria-busy="true">
      <EnTetePage>
        {/* Annonce vocale : un lecteur d'écran ne voit pas une pulsation. */}
        <p className="font-mono text-xs text-muted-foreground">
          Chargement des offres…
        </p>
      </EnTetePage>

      <div className="border border-border bg-card" aria-hidden="true">
        {Array.from({ length: 6 }, (_, rang) => (
          <div
            key={rang}
            className="animate-pulse border-b border-border px-4 py-4 last:border-b-0 sm:px-5"
          >
            <div className="mb-2 h-3 w-40 max-w-[60%] bg-muted" />
            <div className="mb-3 h-4 w-80 max-w-[85%] bg-muted" />
            <div className="flex flex-wrap gap-1.5">
              <div className="h-5 w-24 bg-muted" />
              <div className="h-5 w-16 bg-muted" />
              <div className="h-5 w-40 max-w-[55%] bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </CadrePage>
  );
}
