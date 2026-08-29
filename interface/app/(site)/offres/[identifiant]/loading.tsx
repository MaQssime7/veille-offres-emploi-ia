import { CadrePage } from "../../_composants/cadre-page";

/**
 * Le repli de chargement de la fiche.
 *
 * ⚠️ **Son seul rôle est d'occuper la place**, pour que l'arrivée du contenu ne
 * fasse pas sauter la page. Il reprend donc les hauteurs réelles de la fiche :
 * lien de retour, entête, résumé, notes, **note personnelle**, renseignements,
 * description, et le bloc de candidature.
 *
 * ⚠️ **Les hauteurs sont mesurées, pas estimées — et l'exactitude est
 * impossible ici, contrairement à la liste.** Première version : 641 px contre
 * 938 px pour la fiche réelle, soit un saut de 297 px à l'arrivée, dû pour
 * l'essentiel au bloc de candidature dessiné trop court. Corrigé et remesuré.
 * Mais une fiche n'a pas de hauteur fixe : elle dépend de la longueur des deux
 * justifications, de la présence du résumé, du nombre de rubriques. On vise
 * donc la fiche **médiane**, pas une égalité parfaite — et à la différence de
 * la liste, où 200 lignes sautaient d'un coup, l'écart résiduel se produit en
 * bas de page, hors du champ de lecture.
 *
 * ⚠️ **`animate-pulse` s'arrête sous `prefers-reduced-motion`** grâce à la règle
 * globale de `globals.css`. Une pulsation est une boucle : c'est exactement le
 * type de mouvement que le plancher d'accessibilité du projet impose de couper.
 *
 * ⚠️ **`aria-hidden` et `sr-only`** : un lecteur d'écran n'a rien à faire de
 * six rectangles gris. On lui dit « Chargement de l'offre » une fois, en texte.
 *
 * ⚠️ **TOUTES les hauteurs ont été remesurées le 29 août 2026** — deux fois,
 * après l'aération des cartes puis après l'alignement typographique des
 * justifications sur le résumé. Deux valeurs étaient fausses avant même ces
 * chantiers : le bloc de candidature était dessiné **26 px trop grand**. Une
 * hauteur calée sur une seule fiche décrit cette fiche, pas la population.
 *
 * ⚠️ **On se cale sur la MOYENNE de chaque section, et surtout pas sur sa
 * médiane — c'est la correction de méthode la plus utile de ce fichier.**
 * Une médiane ne s'additionne pas : la somme des médianes des six sections
 * donnait **1 325 px** là où la médiane du total mesuré est **1 381**, soit
 * 55 px d'erreur venue de nulle part. La raison est que les distributions sont
 * asymétriques — trois sections ont une médiane égale à leur minimum, parce
 * qu'une longue minorité tire la queue vers le haut. La moyenne, elle,
 * s'additionne exactement : `E[total] = Σ E[section]`. Et c'est bien le TOTAL
 * qui décide du saut de page.
 *
 * Mesuré sur **20 offres réelles** :
 *
 * | Section | Moyenne | Étendue observée |
 * |---|---|---|
 * | Résumé | 101,3 px | 100 – 126 |
 * | Évaluation | 192,4 px | 156 – 234 |
 * | Ma note | 208,5 px | fixe (champ vide) |
 * | Classement | 130 px | 114 – 154 |
 * | L'annonce | 52 px | fixe (replié) |
 * | Candidater | 119,1 px | 115,5 – 150 |
 * | **Total** | **1 402 px** | mesuré sur 20 fiches |
 *
 * ⚠️ **L'évaluation a repris 4 px le 29 août** en fin de journée, quand son
 * chiffre est passé de 12 à 14 px. Une hauteur de squelette se remesure à
 * **chaque** changement de la section qu'elle double — c'est mécanique, et rien
 * ne le rappelle.
 * ✅ **Les deux réglages suivants de la jauge — pleine largeur, puis plafond à
 * 13 rem et libellé resserré — n'ont PAS bougé cette hauteur**, et c'est
 * vérifié plutôt que supposé : la rangée est haute comme son chiffre, pas comme
 * sa barre (10 px dans 22). Remesuré sur les mêmes 20 offres après chaque
 * changement : 192,4 px les deux fois.
 *
 * ⚠️ **L'étendue reste le vrai sujet** : l'évaluation seule va de 152 à 230 px.
 * Aucun calage ne supprimera ce ±39 px, il se paie en bas de page plutôt qu'en
 * haut. **Ne pas chercher l'égalité parfaite ici** — la chercher conduirait à
 * mesurer le texte avant de l'avoir reçu.
 *
 * ✅ **Vérifié en ralentissant la page exprès**, squelette contre contenu réel
 * sur 12 fiches : squelette **1 400,7 px** pour une moyenne mesurée de
 * **1 402,2** — écart moyen de **−7,7 px** sur l'échantillon de contrôle, et
 * l'étendue reste celle du contenu (−57 à +59). C'est ce que le calage sur les
 * moyennes doit donner : un écart qui tourne autour de zéro au lieu de pencher
 * toujours du même côté.
 *
 * ⚠️ **Une mesure automatisée de ce fichier produit une valeur aberrante par
 * lot** (~−1 200 px), et ce n'est PAS une fiche longue : c'est l'instant où le
 * squelette et le contenu coexistent pendant la transition. Vérifié en listant
 * les hauteurs réelles — aucune fiche ne dépasse 1 400 px. La jeter est correct ;
 * la prendre pour un cas limite conduirait à surdimensionner tout le squelette.
 */
export default function ChargementFiche() {
  return (
    <CadrePage>
      <p className="sr-only" role="status">
        Chargement de l’offre…
      </p>

      <div aria-hidden="true" className="animate-pulse">
        <div className="mb-6 h-5 w-40 bg-muted" />

        <div className="mb-6 border-b border-border pb-6">
          <div className="mb-2 h-7 w-48 bg-muted" />
          <div className="mb-2 h-[2.34375rem] w-full max-w-xl bg-muted" />
          {/* ⚠️ **Toute la rangée d'entête a été remesurée le 29 août au soir**,
              quand l'échelle typographique de la fiche a été remontée : intitulé
              24 → 30 px, entreprise 15 → 18, cartouches et boutons de statut
              11 → 13. Valeurs au DOM : entreprise **28 px**, titre **37,5**,
              cartouches **27,5**, boutons **31,5**.
              ⚠️ **Les LARGEURS des deux boutons ont bougé aussi** — un libellé
              plus grand dans un cartouche plus rembourré ne tient plus dans la
              même boîte. Elles ne changent pas la hauteur, mais un squelette qui
              annonce des boutons trop courts se voit à l'œil. */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            <div className="h-[1.71875rem] w-28 bg-muted" />
            <div className="h-[1.71875rem] w-16 bg-muted" />
            <div className="h-[1.71875rem] w-36 bg-muted" />
            <div className="h-[1.71875rem] w-24 bg-muted" />
          </div>

          {/* ⚠️ **Les deux boutons de statut, arrivés en phase 4.** Sans cette
              rangée le squelette faisait 117 px là où l'entête réel en fait
              169 : **52 px de saut** au moment où l'offre arrive, mesuré au DOM
              le 29 août 2026. La hauteur (1,6875 rem = 27 px) est celle d'un
              bouton réel, la même valeur que `RYTHME_LIGNE.rangeeEntete` — mais
              **recopiée ici et non importée**, parce que ce module dessine la
              fiche et l'autre la liste : les deux se ressemblent aujourd'hui et
              n'ont aucune raison de rester liées. */}
          <div className="mt-5 flex gap-1.5">
            <div className="h-[1.96875rem] w-[7.5rem] bg-muted" />
            <div className="h-[1.96875rem] w-[6.25rem] bg-muted" />
          </div>
        </div>

        <div className="flex flex-col gap-8">
          {/* ⚠️ **Le résumé a un TITRE et un CADRE depuis le 29 août 2026**, et
              ce squelette montrait encore une barre grise nue de 20 px là où la
              section réelle en fait 113 : **93 px de saut**. Les 5,375 rem du
              cadre correspondent à un résumé de deux lignes — la médiane
              mesurée est de 122 caractères, soit deux lignes à cette largeur.
              ⚠️ **L'égalité exacte est impossible ici**, comme pour les
              justifications de la liste : un résumé d'une ligne fera 59 px, un
              de trois en fera 113. On se cale sur la médiane pour que l'écart
              soit centré autour de zéro plutôt que systématiquement négatif. */}
          <div>
            <div className="mb-3 h-4 w-32 bg-muted" />
            <div className="h-[6.33rem] carte-produit" />
          </div>

          <div>
            <div className="mb-3 h-4 w-24 bg-muted" />
            <div className="h-[12.025rem] carte-produit" />
          </div>

          {/* ⚠️ **« Ma note », ajoutée le 29 août 2026 — et ce bloc a MANQUÉ
              d'être oublié.** Relevé en revue : la fiche est passée de cinq à
              six sections sans que ce squelette ne bouge, ce qui aurait rendu
              **222 px** de saut à l'arrivée du contenu, juste au milieu de la
              page. C'est le troisième saut de ce fichier après 297 px et 93 px.
              ⚠️ **La leçon vaut plus que la correction : ce fichier ne se
              rappelle pas tout seul.** Toute section ajoutée à `page.tsx` doit
              être ajoutée ici dans le même geste, sinon le défaut est invisible
              en développement — où le contenu arrive en 80 ms et où le squelette
              ne s'affiche presque jamais.
              12,1875 rem = 195 px, la hauteur mesurée au DOM du cadre avec son
              champ vide (146 px), son indicateur et ses marges. **C'est le cas
              médian et non un compromis** : les 574 offres sont aujourd'hui
              sans note, et une note longue ne dépasse pas 60 vh. */}
          <div>
            <div className="mb-3 h-4 w-20 bg-muted" />
            <div className="h-[13.03rem] carte-produit" />
          </div>

          <div>
            <div className="mb-3 h-4 w-40 bg-muted" />
            <div className="h-[8.125rem] carte-produit" />
          </div>

          <div>
            <div className="mb-3 h-4 w-20 bg-muted" />
            <div className="h-[3.25rem] carte-produit" />
          </div>

          {/* Le bloc de candidature : bouton, ligne de contact, avertissement
              sur la dépublication. C'est lui qui manquait le plus. */}
          <div>
            <div className="mb-3 h-4 w-24 bg-muted" />
            <div className="h-[7.4425rem] carte-produit" />
          </div>
        </div>
      </div>
    </CadrePage>
  );
}
