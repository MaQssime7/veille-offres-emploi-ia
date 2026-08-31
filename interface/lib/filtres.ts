/**
 * Ce que la liste `/offres` peut montrer : les six filtres, leurs libellés,
 * leur validation.
 *
 * Entre : rien, ou une chaîne venue de l'adresse pour `estFiltre`.
 * Sort : des constantes, et un verdict de validité.
 * Casse : rien à l'exécution.
 *
 * ⚠️ **Pas de `server-only` ici, comme `statuts.ts`, `notes.ts`, `francais.ts`,
 * `tri.ts`, `theme.ts`, `employeur.ts`, `coup-de-coeur.ts`, `enrichissement.ts`
 * et `regroupement.ts`** (règle 3 du `CLAUDE.md`).
 *
 * ⚠️ **Ce fichier a porté une JUSTIFICATION FAUSSE pendant une heure, le 31 août
 * 2026, et elle mérite d'être racontée.** Elle disait que `SEUIL_INTERET`
 * « s'écrit dans un écran vide, donc côté navigateur », faisant de l'absence de
 * `server-only` une nécessité. Vérifié en revue : les trois consommateurs —
 * `etats.tsx`, `etats-matin.tsx`, `offres/page.tsx` — n'ont pas de
 * `"use client"`, ils rendent sur le serveur. La constante n'atteint jamais le
 * navigateur. **Le danger d'un tel commentaire est qu'il annonce une garantie
 * acquise** : le jour où un vrai composant client voudrait ce nombre, on
 * croirait la question déjà réglée. Ce qui reste vrai, et qui suffit, c'est la
 * règle 3 — un module de constantes pures est importable des deux côtés.
 *
 * ⚠️ **Ce fichier est né d'une revue, le 29 août 2026, et le défaut qu'il
 * répare était dormant.** `FiltreListe` et `FILTRE_PAR_DEFAUT` vivaient dans
 * `lib/offres.ts`, qui porte `server-only`. `adresse.ts` — une fonction pure,
 * posée à côté de composants clients — allait donc chercher une simple
 * constante dans un module qui tire `lib/supabase.ts`, donc la clé secrète.
 * Rien ne cassait tant qu'aucun composant client ne l'importait ; le premier à
 * le faire, geste évident pour construire un lien côté navigateur, serait tombé
 * sur une erreur `server-only` incompréhensible dans un fichier qui ne lit aucun
 * secret. `TRI_PAR_DEFAUT` avait eu le bon traitement, pas celui-ci.
 */

// ⚠️ `STATUTS` n'est PAS importé : le garde-fou ci-dessous travaille sur le
// TYPE `Statut`, pas sur la constante. L'importer « pour faire bonne mesure »
// laissait un import mort dans le fichier dont l'hygiène d'import est justement
// la raison d'être — relevé en revue le 29 août 2026.
import { LIBELLE_COUP_DE_COEUR } from "./coup-de-coeur";
import { LIBELLES_STATUT, type Statut } from "./statuts";

/**
 * Ce que la liste peut montrer : un statut, tout, la dernière collecte, ou les
 * coups de cœur.
 *
 * ⚠️ **Ni `"toutes"`, ni `"nouvelles"`, ni `"coup_de_coeur"` ne sont des
 * statuts**, et c'est pour ça qu'ils vivent ici et non dans `STATUTS`. Les y
 * mettre les rendrait écrivables dans la colonne `statut` — or aucune offre
 * n'est « toutes ». Ce sont des modes d'affichage, ils n'appartiennent qu'à cet
 * écran.
 *
 * ⚠️ **`"nouvelles"` et `"coup_de_coeur"` sont TRANSVERSES aux trois statuts,
 * et c'est ce qui les rend différents des autres onglets.** Le premier montre
 * les offres de la dernière collecte réussie *quel que soit* leur statut : une
 * offre arrivée cette nuit et déjà écartée y figure encore. Le second montre
 * les offres likées, y compris celles auxquelles Maxime a déjà candidaté — c'est
 * même tout l'intérêt de la décision du 30 août 2026, expliquée dans
 * `coup-de-coeur.ts`. Deux conséquences à connaître :
 *
 * 1. Leurs comptes **ne s'additionnent pas** avec ceux des statuts (voir les
 *    champs `nouvelles` et `coupsDeCoeur` de `ResultatListe`).
 * 2. `"nouvelles"` est un filtre qui **change de contenu tout seul**, chaque
 *    nuit. Mis en favori, il ne ramène pas les mêmes offres demain — au
 *    contraire de `?statut=candidate` ou de `?statut=coup_de_coeur`, qui
 *    désignent des ensembles que seul un geste de Maxime fait bouger.
 *
 * ⚠️ **Le paramètre d'adresse reste `?statut=`**, alors qu'il porte désormais
 * trois valeurs qui n'en sont pas. Le renommer casserait les favoris existants
 * pour un gain de vocabulaire ; l'écran, lui, ne parle jamais de « statut ».
 */
export type FiltreListe = Statut | "toutes" | "nouvelles" | "coup_de_coeur";

/**
 * Le filtre par défaut, quand l'adresse ne dit rien.
 *
 * ⚠️ **« À traiter » et non « toutes », et ce n'est pas un détail de
 * commodité.** L'écran devient un plan de travail : ce qui reste à faire. Une
 * offre triée disparaît, ce qui est exactement le geste que la phase 4 existe
 * pour offrir. ⚠️ **Effet de bord à connaître** : ça desserre le plafond de 200
 * sans le résoudre — tant qu'aucune offre n'est triée, les 567 restent « à
 * traiter » et la troncature mord pareil.
 */
export const FILTRE_PAR_DEFAUT: FiltreListe = "a_traiter";

/**
 * Le seuil d'intérêt en dessous duquel une offre ne s'affiche nulle part.
 *
 * Entre : rien. Sort : une note sur 100.
 *
 * ⚠️ **C'est le seul endroit du produit qui CACHE une offre, et il vaut
 * désormais pour les DEUX écrans.** Il vivait dans `lib/matin.ts` sous le nom
 * `SEUIL_INTERET_MATIN` et ne bornait que le compte rendu du matin ; `/offres`
 * montrait tout. Décision de Maxime, 31 août 2026, après mesure : la liste
 * affichait 580 offres dont **434 jamais notées** — l'arriéré d'avant la mise
 * en place du cron, que la notation ne reprendra jamais puisqu'elle ne tourne
 * que sur la dernière collecte. Les quelques annonces à lire s'y noyaient.
 *
 * ⚠️ **Il déménage ICI et pas ailleurs pour une raison mécanique** : `matin.ts`
 * importe déjà `offres.ts`, donc y laisser la constante que les deux partagent
 * aurait fait un cycle d'import. Ce fichier n'a pas `server-only` (règle 3 du
 * `CLAUDE.md`), il est donc lisible du serveur comme du navigateur — et c'est
 * nécessaire : les écrans vides écrivent ce nombre en toutes lettres.
 *
 * ⚠️ **Rien n'est supprimé en base, et c'est cette propriété qui rend le seuil
 * réversible.** Le pipeline continue de tout collecter et de tout noter :
 * baisser ce nombre rend les offres immédiatement, sans recollecte et sans
 * repayer une notation. Supprimer aurait été définitif — France Travail
 * dépublie ses annonces, et une ligne effacée ne se récupère jamais.
 *
 * ⚠️ **40 et non 50 — décision de Maxime, prise sur mesure le 31 août 2026.**
 * Les 146 offres notées se répartissent en deux paquets séparés par un vide :
 *
 * | Intérêt | Offres | | Seuil | Reste à l'écran |
 * |---|---|---|---|---|
 * | 0-19 | **115** | | ≥ 30 | 26 |
 * | 20-29 | 5 | | ≥ 35 | 22 |
 * | 30-34 | 4 | | **≥ 40** | **16** |
 * | 35-39 | 6 | | ≥ 50 | 12 |
 * | 40-100 | **16** | | ≥ 60 | 11 |
 *
 * La coupure naturelle est le trou entre 20 et 40 : à 40 on coupe juste après
 * le vide. Passer à 50 ne retire que **4** annonces, toutes dans la bande
 * 40-49 — on couperait alors dans ce qui reste, plus dans le bruit.
 *
 * ⚠️ **`NULL >= 40` est FAUX en SQL, et c'est ce qui écarte les 434 offres
 * jamais notées sans une ligne de code de plus.** Conséquence à connaître : une
 * offre collectée cette nuit mais **pas encore notée** est invisible elle
 * aussi. C'est voulu — une offre sans note ne peut pas être jugée — mais ça
 * veut dire qu'un ratage de la notation vide l'écran sans rien casser.
 * `AucuneOffreAuSeuil` (`_composants/etats.tsx`) existe pour que ce vide-là
 * s'explique au lieu de passer pour une panne de collecte.
 *
 * ⚠️ **Le changer reste une décision produit, pas un réglage.** C'est ce seuil
 * qui sépare un instrument de décision d'une archive.
 */
export const SEUIL_INTERET = 40;

/**
 * Comment le seuil s'applique à un filtre — **trois régimes, pas deux**.
 *
 * Entre : un filtre déjà validé par `estFiltre`.
 * Sort : le régime qui gouverne à la fois la requête, le compteur de la pilule
 * et le message d'écran vide.
 * Casse : rien — le `switch` est exhaustif à la compilation, un septième filtre
 * ajouté sans passer ici ne compilerait pas.
 *
 * | Régime | Filtres | Ce que la liste montre |
 * |---|---|---|
 * | `"seuil"` | À traiter · Écarté · Nouveau | uniquement au-dessus du seuil |
 * | `"aucun"` | Coup de cœur · Candidaté | tout, le seuil n'y filtre rien |
 * | `"visible"` | Toutes | au-dessus du seuil **ou** marqué par Maxime |
 *
 * ⚠️ **Le seuil filtre ce que le MODÈLE propose, jamais ce que Maxime a
 * lui-même désigné** — décision du 31 août 2026. « Coup de cœur » et
 * « Candidaté » sont les deux seules listes dont le contenu vient d'un clic :
 * une offre notée 30 qu'il a likée doit y rester, sinon le filtre annule son
 * propre geste — et sans le moindre message, puisqu'une offre cachée ne laisse
 * aucune trace à l'écran.
 *
 * ⚠️ **`"visible"` existe parce que « Toutes » doit rester un SUR-ENSEMBLE des
 * autres onglets, et une première version l'avait cassé** — relevé en revue le
 * 31 août 2026. Avec un simple booléen, « Toutes » appliquait le seuil sec :
 * l'offre likée à 30 apparaissait sous « Coup de cœur » puis **disparaissait**
 * en cliquant « Toutes », et la pilule « Toutes » pouvait afficher un chiffre
 * **inférieur** à la pilule « Candidaté » juste à côté. Un onglet nommé
 * « Toutes » qui montre moins que son voisin est un défaut, pas un arbitrage.
 *
 * ⚠️ **« Écarté » est en régime `"seuil"`, et c'est le cas qui se discute** :
 * écarter est aussi un clic. Mais c'est la corbeille — l'exempter ferait de la
 * seule liste qu'on n'ouvre jamais celle qui contient tout le bruit.
 *
 * ⚠️ **La liste ET les compteurs traversent cette fonction**, et ça n'est pas
 * optionnel : une pilule annonçant 562 en face de trois lignes ferait douter
 * des deux. C'est elle, et non une discipline, qui empêche la divergence.
 */
export type RegimeSeuil = "seuil" | "aucun" | "visible";

export function regimeDuSeuil(filtre: FiltreListe): RegimeSeuil {
  switch (filtre) {
    case "candidate":
    case "coup_de_coeur":
      return "aucun";
    case "toutes":
      return "visible";
    case "a_traiter":
    case "ecarte":
    case "nouvelles":
      return "seuil";
  }
}

/**
 * Le seuil retire-t-il quelque chose de cette liste ?
 *
 * ⚠️ **Vrai pour `"seuil"` ET pour `"visible"`** : dans les deux cas une offre
 * peut manquer à cause de sa note. C'est la question que se posent le sous-titre
 * (« faut-il annoncer le seuil ? ») et l'écran vide (« faut-il l'incriminer ? »),
 * et elle ne se confond pas avec le régime lui-même.
 */
export function leSeuilRetireQuelqueChose(filtre: FiltreListe): boolean {
  return regimeDuSeuil(filtre) !== "aucun";
}

/**
 * L'ordre d'affichage des onglets, et la seule liste qui en fasse foi.
 *
 * ⚠️ **« Nouveau » se glisse en DEUXIÈME, juste après le défaut**, et ce n'est
 * pas alphabétique : les deux premiers onglets sont ceux d'un matin — ce qui
 * reste à faire, ce qui vient d'arriver. Candidaté et Écarté sont des
 * consultations, elles viennent après.
 *
 * ⚠️ **« Coup de cœur » se pose en TROISIÈME, entre les deux groupes**, et sa
 * place dit ce qu'il est : ni tout à fait le matin (il ne change pas tout seul
 * dans la nuit), ni tout à fait une consultation d'archive (c'est la liste qu'on
 * rouvre en cours de journée pour décider où postuler). Le mettre en dernier,
 * après « Toutes », l'aurait rendu invisible — or c'est le seul onglet dont le
 * contenu est entièrement choisi à la main.
 */
export const FILTRES = [
  "a_traiter",
  "nouvelles",
  "coup_de_coeur",
  "candidate",
  "ecarte",
  "toutes",
] as const;

/**
 * ⚠️ **Garde-fou de COMPILATION : tout statut doit avoir son onglet.**
 * Un statut ajouté à `STATUTS` sans être ajouté ci-dessus n'aurait aucun filtre,
 * et son compte serait invisible à l'écran — sans la moindre erreur. Les
 * crochets rendent la comparaison non distributive : sans eux, l'union se
 * testerait membre par membre et un `never` isolé disparaîtrait dans le
 * résultat, ce qui laisserait passer le cas qu'on veut attraper.
 *
 * Il remplace un `throw` posé au rendu : une vérification qui échoue à la
 * compilation vaut mieux qu'une qui attend qu'on ouvre la page.
 */
type ChaqueStatutEstUnFiltre = [Statut] extends [(typeof FILTRES)[number]]
  ? true
  : never;
const _controleDesFiltres: ChaqueStatutEstUnFiltre = true;
void _controleDesFiltres;

/** Ce qui s'affiche sur chaque onglet. Accentué, jamais stocké. */
export const LIBELLES_FILTRE: Record<FiltreListe, string> = {
  ...LIBELLES_STATUT,
  /**
   * ⚠️ **« Nouveau » au SINGULIER**, comme la bulle de chaque ligne, alors que
   * l'onglet en compte plusieurs. Deux mots différents pour la même chose
   * donneraient à croire à deux notions.
   */
  nouvelles: "Nouveau",
  /**
   * ⚠️ **Le libellé vient de `coup-de-coeur.ts`, il n'est pas recopié ici.**
   * Le même texte s'affiche sur la pilule de filtre et sur le bouton de la
   * ligne, qui est un composant client : deux copies auraient fini par
   * diverger, et l'écran aurait nommé « Coup de cœur » ce que le bouton
   * appelait autrement.
   */
  coup_de_coeur: LIBELLE_COUP_DE_COEUR,
  toutes: "Toutes",
};

/**
 * Est-ce que cette chaîne est un filtre connu ?
 *
 * Entre : n'importe quoi — typiquement `?statut=` dans l'adresse.
 * Sort : `true` **et** la garantie pour TypeScript qu'il s'agit d'un
 * `FiltreListe`.
 * Casse : rien. `undefined`, `null` et les tableaux rendent `false`.
 *
 * ⚠️ **Il accepte `"toutes"`, `"nouvelles"` et `"coup_de_coeur"`, que
 * `estStatut()` refuse à raison** — aucune offre ne peut porter ces valeurs
 * dans sa colonne `statut`. Les deux validations existent donc pour deux
 * frontières différentes : celle de l'écran et celle de la table.
 */
export function estFiltre(valeur: unknown): valeur is FiltreListe {
  return (
    typeof valeur === "string" && (FILTRES as readonly string[]).includes(valeur)
  );
}
