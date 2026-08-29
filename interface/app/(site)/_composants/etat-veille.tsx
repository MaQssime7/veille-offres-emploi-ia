import { CircleDashed, CircleDot, TriangleAlert } from "lucide-react";

import { accorder, daterPassage, duree } from "@/lib/francais";
// Ni le seuil de 36 h ni celui des 60 minutes ne sont importés ici : c'est
// `calculerEtat()` qui les applique et rend un état déjà tranché. L'affichage ne
// rejuge pas, il met en français.
import type { EtatVeille } from "@/lib/veille";

/**
 * La ligne d'état de la veille, en manchette du bandeau.
 *
 * Entre : l'état lu en base et l'heure de référence de la page.
 * Sort : une ligne pleine largeur — ce que la machine a fait à gauche, quand à
 * droite.
 * Casse : rien. Les cinq états sont couverts, le compilateur refuse d'en
 * oublier un.
 *
 * ⚠️ **Ce composant vit au niveau du groupe `(site)` et non dans
 * `offres/_composants/`, parce que l'écran du matin le portera à l'identique.**
 * C'est un critère d'acceptation de la phase 5 : l'indicateur doit être
 * « visible en permanence, sur cet écran comme sur le poste de travail ». Le
 * poser dans le dossier de `/offres` obligerait `/` à le recopier, et deux
 * copies divergeraient dès le premier ajustement de seuil.
 *
 * ⚠️ **L'information est dans le TEXTE, jamais dans la couleur ni dans
 * l'icône.** « Aucune veille depuis 2 jours » se lit en noir et blanc, sans
 * icône, et sur un lecteur d'écran. La teinte et le triangle ne font que
 * renforcer — c'est le plancher d'accessibilité du projet, qui interdit qu'une
 * information tienne sur la seule couleur.
 *
 * ⚠️ **Rendu côté serveur, donc figé à l'affichage.** Un onglet laissé ouvert
 * toute la journée ne verra pas l'indicateur vieillir : il faut recharger. Le
 * corriger demanderait une horloge dans le navigateur, donc un composant
 * client, donc du JavaScript pour une information qui change une fois par jour.
 * Le compromis est délibéré, et il est écrit ici pour ne pas passer pour un
 * oubli.
 */
export function LigneEtatVeille({
  etat,
  maintenant,
}: {
  etat: EtatVeille;
  maintenant: Date;
}) {
  const { ton, Icone, libelle, detail } = decrire(etat, maintenant);

  const teintes = {
    // Ocre : le temporel. `docs/DESIGN.md` lui donne ce rôle et pas un autre —
    // une veille fraîche est une information de temps, pas de réussite. Un vert
    // ici volerait à l'olive son rôle unique (accessibilité et candidaté).
    frais: "text-signal-fort",
    alerte: "font-semibold text-destructive",
    muet: "text-muted-foreground",
  } as const;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b pb-2 ${
        ton === "alerte" ? "border-destructive/40" : "border-border"
      }`}
    >
      <p className={`libelle-mono flex items-center gap-1.5 ${teintes[ton]}`}>
        <Icone aria-hidden="true" className="size-3.5 shrink-0" />
        <span>{libelle}</span>
      </p>
      {detail && (
        <p className="libelle-mono text-muted-foreground">{detail}</p>
      )}
    </div>
  );
}

type Description = {
  ton: "frais" | "alerte" | "muet";
  Icone: typeof CircleDot;
  libelle: string;
  detail: string | null;
};

/**
 * Ce que chaque état dit, en français.
 *
 * ⚠️ **Le `switch` est exhaustif et le reste** : `EtatVeille` est une union
 * fermée, donc l'ajout d'un sixième état ferait échouer la compilation ici
 * plutôt que de tomber dans un cas par défaut qui l'afficherait « à jour ».
 * C'est le seul garde-fou qui survit à une modification faite dans six mois.
 */
function decrire(etat: EtatVeille, maintenant: Date): Description {
  switch (etat.sorte) {
    case "a_jour": {
      const nouvelles = etat.reussite.offresNouvelles;
      return {
        ton: "frais",
        Icone: CircleDot,
        libelle: "Dernière veille",
        detail: [
          daterPassage(etat.reussite.demarreeA, maintenant),
          // ⚠️ `null` ne s'écrit pas « 0 nouvelle » : la colonne non renseignée
          // veut dire « on ne sait pas », pas « rien trouvé ». Le segment
          // disparaît plutôt que d'affirmer.
          nouvelles === null
            ? null
            : `${nouvelles} ${accorder(nouvelles, "nouvelle")} ${accorder(nouvelles, "offre")}`,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    }

    case "en_retard":
      return {
        ton: "alerte",
        Icone: TriangleAlert,
        // Le libellé porte la durée : c'est l'information, la couleur ne fait
        // que la souligner.
        libelle: `Aucune veille depuis ${duree(etat.heures)}`,
        detail: `Dernière réussite : ${daterPassage(etat.reussite.demarreeA, maintenant)}`,
      };

    case "echec":
      return {
        ton: "alerte",
        Icone: TriangleAlert,
        // ⚠️ Deux libellés, parce que ce sont deux faits différents. « En
        // échec » = le pipeline a écrit son échec, donc un motif existe
        // quelque part. « Interrompue » = l'exécution a été tuée avant d'avoir
        // pu écrire quoi que ce soit ; annoncer « en échec » enverrait chercher
        // une explication qui n'a jamais été enregistrée.
        libelle: etat.interrompue
          ? "Dernière veille interrompue"
          : "Dernière veille en échec",
        // ⚠️ On donne quand même la dernière réussite : c'est elle qui dit
        // depuis quand les données ne bougent plus, et c'est la seule question
        // que l'écran pose vraiment.
        detail: etat.reussite
          ? `Dernière réussite : ${daterPassage(etat.reussite.demarreeA, maintenant)}`
          : "Aucune veille n'a jamais réussi",
      };

    case "jamais":
      return {
        ton: "muet",
        Icone: CircleDashed,
        libelle: "Aucune veille enregistrée",
        detail: null,
      };

    case "inconnu":
      // ⚠️ **Distinct de « aucune veille », et le rester est important.** Ici
      // c'est la LECTURE qui a échoué : annoncer « aucune veille » ferait
      // croire à une panne de collecte un jour où seule la base est
      // injoignable. Le ton reste muet — on ne crie pas une alerte qu'on n'a
      // pas constatée.
      return {
        ton: "muet",
        Icone: CircleDashed,
        libelle: "État de la veille indisponible",
        detail: null,
      };
  }
}

/**
 * Le squelette de la ligne d'état, pour `loading.tsx`.
 *
 * ⚠️ **Il vit dans le même fichier que la ligne réelle, et c'est délibéré.**
 * Le projet a déjà payé trois sauts de mise en page — 297 px, 93 px, 222 px —
 * parce qu'une section ajoutée à un écran n'avait pas été ajoutée à son
 * squelette. Rien ne relie mécaniquement les deux : les garder côte à côte est
 * le seul rappel qui survit.
 *
 * ⚠️ **Sa hauteur doit égaler celle de la ligne réelle.** Les deux sont faites
 * du même `libelle-mono` (0,6875 rem à 1,4 d'interligne, soit 15,4 px) dans un
 * conteneur à `pb-2` et bordure basse — la barre grise reprend donc la hauteur
 * du texte, pas une valeur choisie à l'œil.
 *
 * ⚠️ **Les largeurs sont MESURÉES, pas choisies — et une première version l'a
 * appris à ses dépens.** Elles valaient `w-44` / `w-52` (176 et 208 px, soit
 * 400 px avec l'écart), face à un contenu réel de **135,5 + 300,3 + 16 =
 * 451,8 px**. Conséquence relevée en revue puis confirmée au DOM : entre
 * **448 et 496 px de large**, la vraie ligne se repliait en deux quand le
 * squelette tenait encore sur une — exactement le saut de 19,40 px que ce
 * fichier existe pour empêcher, simplement **déplacé dans une autre bande**.
 * Les deux barres reprennent maintenant les largeurs du cas courant (8,5 rem et
 * 18,75 rem), donc les deux se replient au même endroit.
 *
 * ⚠️ **La leçon, qui vaut au-delà de ce cas** : caler un squelette sur deux
 * largeurs de référence ne prouve rien entre les deux. Le repli est un
 * **seuil**, et un seuil ne se vérifie qu'en balayant les largeurs — 360 à
 * 720 px par pas de 4 ici. Deux points concordants avaient donné une fausse
 * certitude.
 *
 * **Balayage 300 → 760 px par pas de 2, après correction** : la ligne réelle et
 * le squelette basculent de 43,80 à 24,40 px **à la même largeur disponible,
 * 452 px**. Une seule transition chacun, au même endroit.
 *
 * ⚠️ **L'égalité n'est pas universelle pour autant, et deux cas restent.**
 *
 * | Largeur disponible | Ligne réelle | Squelette | Écart |
 * |---|---|---|---|
 * | ≥ 452 px | 24,40 px | 24,40 px | **0** |
 * | 302 → 450 px | 43,80 px | 43,80 px | **0** |
 * | ≤ 300 px | 59,20 px | 43,80 px | 15,40 px |
 *
 * 1. **Sous 302 px de large**, le détail de droite se coupe en deux et la ligne
 *    réelle passe à trois rangées. Cela correspond à un écran d'environ 334 px
 *    — **sous le plancher de 375 px** du projet, et sous tout téléphone courant.
 *    Un squelette à trois barres corrigerait ce cas et serait faux partout
 *    ailleurs.
 * 2. **Trois états n'ont rien à mettre à droite** — « aucune veille
 *    enregistrée », « état indisponible », et le cas où `offres_nouvelles` est
 *    `NULL`. Ils ne se replient donc jamais et restent à 24,40 px.
 *
 * **Le squelette est calé sur le cas COURANT, délibérément.** Ces trois
 * exceptions sont toutes des situations dégradées (base neuve, base
 * injoignable, colonne non renseignée) où un décalage de 19 px n'est pas le
 * problème que l'utilisateur a. Caler sur elles déplacerait le saut sur le cas
 * de tous les matins.
 *
 * C'est la même leçon que `loading.tsx` écrit pour les lignes d'offres : dès
 * que la hauteur dépend du contenu, l'égalité exacte devient impossible, et le
 * travail n'est plus de l'obtenir mais de **choisir quel écart on accepte, sur
 * quel cas** — et de l'écrire.
 */
export function SqueletteEtatVeille() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border pb-2"
    >
      <div className="h-[0.9625rem] w-[8.5rem] animate-pulse bg-muted" />
      <div className="h-[0.9625rem] w-[18.75rem] animate-pulse bg-muted" />
    </div>
  );
}
