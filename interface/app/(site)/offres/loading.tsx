import { CadrePage, EnTetePage } from "./_composants/en-tete-page";
import { HAUTEURS_SQUELETTE, RYTHME_LIGNE } from "./_composants/rythme";

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
 * ⚠️ **Le rythme vertical n'est plus recopié ici** : il vient de `rythme.ts`,
 * partagé avec `ligne-offre.tsx`. C'est ce fichier-là qu'il faut modifier, et la
 * ligne comme son squelette suivront ensemble. Avant ce partage, resserrer la
 * ligne sans toucher au squelette faisait sauter la page de 56 px.
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
            className={`animate-pulse border-b border-border last:border-b-0 ${RYTHME_LIGNE.article}`}
          >
            <div
              className={`w-40 max-w-[60%] bg-muted ${RYTHME_LIGNE.margeEntreprise} ${HAUTEURS_SQUELETTE.entreprise}`}
            />
            <div
              className={`w-80 max-w-[85%] bg-muted ${RYTHME_LIGNE.margeIntitule} ${HAUTEURS_SQUELETTE.intitule}`}
            />
            <div className="flex flex-wrap gap-1.5">
              <div className={`w-24 bg-muted ${HAUTEURS_SQUELETTE.cartouche}`} />
              <div className={`w-16 bg-muted ${HAUTEURS_SQUELETTE.cartouche}`} />
              <div className={`w-40 max-w-[55%] bg-muted ${HAUTEURS_SQUELETTE.cartouche}`} />
            </div>
          </div>
        ))}
      </div>
    </CadrePage>
  );
}
