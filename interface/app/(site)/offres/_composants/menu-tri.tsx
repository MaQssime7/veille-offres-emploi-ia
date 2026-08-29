"use client";

/**
 * Le menu de classement de la liste, à droite du bandeau.
 *
 * Entre : le classement en cours et l'adresse de chacun des trois — toutes
 * calculées **sur le serveur** et passées une par une.
 * Sort : un déclencheur bleu et un menu de trois liens.
 * Casse : sans JavaScript, le menu ne s'ouvre pas. La liste reste classée par
 * intérêt et les cinq filtres, qui sont de simples liens, continuent de
 * fonctionner — on perd un réglage, jamais l'écran.
 *
 * ⚠️ **Il reçoit des ADRESSES DÉJÀ FAITES, pas de quoi les fabriquer** — et la
 * raison a changé le jour même, ce qui vaut d'être noté. Elle était : « les
 * construire ici tirerait `lib/offres.ts`, donc la clé Supabase, dans le graphe
 * du navigateur ». C'est **faux depuis que `FILTRE_PAR_DEFAUT` vit dans
 * `lib/filtres.ts`**, qui ne porte pas `server-only` — un correctif du même
 * diff. Ce qui tient encore : la **discipline de props** du projet, la même que
 * pour les boutons de statut — un composant client reçoit des valeurs
 * scalaires, jamais de quoi reconstruire une décision serveur. Trois chaînes
 * suffisent, et une adresse calculée à un seul endroit ne peut pas diverger de
 * celle des filtres.
 *
 * ⚠️ **Ce sont des LIENS dans le menu, pas des boutons qui appelleraient
 * `router.push`.** Même raison que les filtres : le classement doit vivre dans
 * l'adresse pour survivre au favori et au bouton retour. Un menu à état React
 * donnerait le même écran et perdrait les deux.
 */

import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { ArrowDownWideNarrow, Check } from "lucide-react";

import { DESCRIPTIONS_TRI, LIBELLES_TRI, TRIS, type Tri } from "@/lib/tri";

export function MenuTri({
  actif,
  adresses,
}: {
  actif: Tri;
  /** L'adresse de chaque classement, filtre courant conservé. */
  adresses: Record<Tri, string>;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        // ⚠️ **Le bleu est la teinte de l'INTÉRÊT dans ce produit, et l'employer
        // ici est un emprunt assumé.** Le système tient à « une teinte, un
        // rôle » ; ce bouton n'est pas un signal, c'est un contrôle. Il prend le
        // bleu parce que le classement par défaut EST l'intérêt et que les
        // quatre autres teintes sont déjà prises par les cinq filtres d'à côté —
        // en réutiliser une ferait croire à un sixième filtre.
        //
        // ⚠️ **`cushion-control` sans variante enfoncée** : ce bouton n'a pas
        // d'état « engagé », il ouvre un menu. Radix lui pose
        // `data-state="open"`, dont on se sert pour l'enfoncer pendant que le
        // menu est ouvert — c'est le même geste que les autres contrôles du
        // système.
        className="cushion-control data-[state=open]:cushion-control-active inline-flex items-center gap-2 rounded-full border border-transparent bg-interet px-3.5 py-1.5 font-mono text-[0.6875rem] font-bold uppercase tracking-wider text-interet-foreground transition-colors focus-produit"
        // ⚠️ **Le déclencheur annonce le classement EN TOUTES LETTRES, et c'est
        // un correctif de revue.** `DESCRIPTIONS_TRI` se disait « pour le lecteur
        // d'écran et l'infobulle du déclencheur » alors que le déclencheur
        // n'avait ni l'un ni l'autre : les phrases n'existaient que dans le menu
        // ouvert. Un lecteur d'écran entendait donc « Trier · Intérêt » sans
        // savoir dans quel sens, et il faut ouvrir un menu pour l'apprendre.
        aria-label={`Trier les offres. Classement actuel : ${DESCRIPTIONS_TRI[actif].toLowerCase()}`}
        title={DESCRIPTIONS_TRI[actif]}
      >
        <ArrowDownWideNarrow className="size-3.5 shrink-0" aria-hidden="true" />
        Trier
        {/* ⚠️ **Le critère en cours est écrit SUR le bouton, pas seulement dans
            le menu.** Sans lui, il faut ouvrir le menu pour savoir comment la
            liste est classée — c'est-à-dire deviner pourquoi une offre est en
            haut. La graisse normale le détache du mot « Trier » sans recourir à
            une opacité, qui coûterait du contraste sur un pastel. */}
        <span className="font-normal normal-case tracking-normal">
          · {LIBELLES_TRI[actif]}
        </span>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          // `align="end"` colle le menu au bord DROIT du déclencheur, qui est
          // lui-même aligné sur le bord droit de la liste. Sans ça, un menu de
          // 200 px de large déborderait de la page à 375 px.
          align="end"
          sideOffset={8}
          // ⚠️ **`pouf-menu` vient du système, pas de Tailwind.** Le registre
          // fournit déjà la surface, le rayon, le coussin et l'animation d'un
          // menu ; les refaire en utilitaires produirait un menu presque
          // pareil, qui dériverait au premier ajustement de `pouf.css`.
          //
          // ⚠️ **La largeur maximale est un correctif VU à 375 px, pas une
          // précaution.** `pouf-menu` ne pose qu'un `min-width` : le menu prenait
          // la largeur de sa plus longue description — « Date de publication, de
          // la plus récente à la plus ancienne » — soit 427 px. Radix le
          // repoussait contre le bord gauche, et il sortait quand même de
          // l'écran à droite : la coche du classement actif devenait invisible,
          // c'est-à-dire qu'on ne savait plus lequel était choisi. Borné, le
          // texte s'enroule au lieu de pousser.
          className="pouf-menu max-w-[calc(100vw-2rem)]"
        >
          {TRIS.map((tri) => (
            <DropdownMenu.Item key={tri} asChild>
              <Link
                href={adresses[tri]}
                className="pouf-menu__item justify-between gap-4 no-underline"
                // ⚠️ **`aria-current` ET une coche visible.** La coche seule
                // laisserait un lecteur d'écran devant trois entrées
                // identiques ; l'attribut seul laisserait l'œil sans repère.
                // Le plancher du projet interdit qu'une information tienne sur
                // un seul canal.
                aria-current={tri === actif ? "true" : undefined}
              >
                {/* ⚠️ `min-w-0` : sans lui, un enfant de `flex` refuse de
                    passer sous la largeur de son contenu, et la borne posée sur
                    le menu ne servirait à rien — le texte pousserait quand
                    même. */}
                <span className="flex min-w-0 flex-col gap-0.5">
                  {LIBELLES_TRI[tri]}
                  {/* La phrase entière sous le libellé : « Intérêt » ne dit pas
                      dans quel sens on trie, et l'ordre est justement ce qu'on
                      vient choisir. */}
                  <span className="font-mono text-[0.625rem] font-normal normal-case leading-snug text-wrap text-muted-foreground">
                    {DESCRIPTIONS_TRI[tri]}
                  </span>
                </span>

                {tri === actif ? (
                  <Check className="size-4 shrink-0 text-foreground" aria-hidden="true" />
                ) : (
                  // ⚠️ **Une place vide de la même largeur, et ce n'est pas du
                  // zèle** : sans elle, l'entrée cochée est plus large que les
                  // deux autres et le menu change de largeur à chaque
                  // ouverture, selon le classement en cours.
                  <span className="size-4 shrink-0" aria-hidden="true" />
                )}
              </Link>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
