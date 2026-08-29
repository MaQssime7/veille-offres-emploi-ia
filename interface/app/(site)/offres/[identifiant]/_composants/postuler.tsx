import { ExternalLink, UserRound } from "lucide-react";

import type { OffreEnFiche } from "@/lib/offres";

/**
 * Comment candidater : les liens, et le contact quand l'annonce en donne un.
 *
 * Entre : l'offre lue en base.
 * Sort : jusqu'à deux liens et une ligne de contact. Renvoie `null` si
 * l'annonce ne donne rien — en pratique jamais, `url_origine` est renseignée
 * sur 560 offres sur 560.
 * Casse : rien.
 *
 * ⚠️ **Le lien d'origine n'est PAS présenté comme garanti**, et c'est un
 * critère d'acceptation du plan, pas une précaution de style. France Travail
 * dépublie ses annonces : le lien meurt sans prévenir, alors que la
 * description reste lisible ici. Promettre « Voir l'annonce » ferait porter
 * l'échec à notre site ; la phrase dit donc que l'annonce *peut* avoir disparu,
 * et rappelle que le texte, lui, est conservé.
 *
 * ⚠️ **`contact_nom` et `contact_url_postulation` s'affichent ici et nulle part
 * ailleurs.** Décision de Maxime du 28 août 2026, qui amende le garde-fou n° 2
 * de `docs/PRD.md` : ces deux champs n'existent que pour candidater, les
 * conserver sans jamais les montrer revenait à porter le risque sans l'usage.
 * Le site est derrière un mot de passe et n'a qu'un utilisateur.
 * **Ce qui n'est pas amendé** : jamais dans un journal — ceux de GitHub Actions
 * sont publics — ni dans un export, ni dans la liste `/offres`, dont les
 * colonnes ne les lisent pas.
 *
 * ⚠️ **`rel="noopener noreferrer"` sur les liens externes.** Sans `noopener`,
 * la page ouverte garde une référence à la nôtre par `window.opener` et peut la
 * faire naviguer ailleurs ; `noreferrer` évite en plus d'annoncer au site
 * d'arrivée d'où vient le clic.
 */
export function Postuler({ offre }: { offre: OffreEnFiche }) {
  if (!offre.url_origine && !offre.contact_url_postulation && !offre.contact_nom) {
    return null;
  }

  return (
    <section aria-labelledby="titre-postuler">
      <h2 id="titre-postuler" className="titre-section mb-3">
        Candidater
      </h2>

      <div className="flex flex-col gap-3 carte-produit px-4 py-4">
        <div className="flex flex-wrap gap-2">
          {offre.url_origine && (
            <LienExterne href={offre.url_origine} principal>
              Ouvrir l’annonce sur France Travail
            </LienExterne>
          )}
          {offre.contact_url_postulation && (
            <LienExterne href={offre.contact_url_postulation}>
              Postuler directement
            </LienExterne>
          )}
        </div>

        {offre.contact_nom && (
          <p className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
            <UserRound
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span>
              <span className="text-muted-foreground">Contact indiqué : </span>
              {offre.contact_nom}
            </span>
          </p>
        )}

        {offre.url_origine && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            France Travail retire ses annonces sans préavis&nbsp;: ce lien peut
            ne plus répondre. La description ci-dessus, elle, reste consultable
            ici.
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Un lien qui sort du site.
 *
 * ⚠️ **L'icône n'est pas décorative** : elle prévient que le clic quitte la
 * page, ce que le libellé seul ne dit pas. Elle est doublée d'un texte réservé
 * aux lecteurs d'écran — l'information ne tient jamais sur le seul pictogramme.
 */
function LienExterne({
  href,
  children,
  principal = false,
}: {
  href: string;
  children: React.ReactNode;
  principal?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        // ⚠️ **Focus par `outline`, jamais par `ring`, sur le bouton
        // principal** : il porte un `cushion-control`, dont le `box-shadow`
        // brut écrase les `ring-*` de Tailwind. Le secondaire n'a pas de
        // coussin, mais on garde la même écriture pour que les deux se
        // modifient ensemble.
        principal
          ? "cushion-control inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors focus-produit hover:brightness-95"
          : "inline-flex items-center gap-2 rounded-full border border-input px-4 py-2 text-sm font-bold text-foreground transition-colors focus-produit hover:bg-accent"
      }
    >
      {children}
      <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">(ouvre un nouvel onglet)</span>
    </a>
  );
}
