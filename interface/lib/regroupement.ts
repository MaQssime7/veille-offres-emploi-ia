/**
 * Le regroupement des annonces qui décrivent le **même poste**.
 *
 * Entre : des offres telles qu'elles sortent de la base.
 * Sort : un groupe par poste, l'annonce la mieux notée en tête.
 * Casse : rien, c'est une fonction pure — d'où sa présence ici plutôt que dans
 * `lib/matin.ts`, et d'où ses tests, qui n'ont besoin ni de base ni de réseau.
 *
 * ⚠️ **Pourquoi ce module existe : France Travail publie le même poste
 * plusieurs fois.** Mesuré le 30 août 2026 sur les 574 offres réelles — une
 * version « f/h » et une version « (H/F) », avec deux identifiants différents,
 * donc deux lignes en base que la déduplication du pipeline (qui porte sur
 * l'identifiant) ne peut pas voir. **29 annonces en trop sur 574, soit 5,1 %** :
 * 24 postes publiés deux fois, un trois fois, un quatre fois.
 *
 * Sur l'écran du matin l'effet est amplifié : le 29 août, quatre des sept offres
 * collectées étaient deux postes en double, et Maxime a vu quatre lignes pour
 * deux annonces réelles.
 *
 * ⚠️ **Ce module N'EFFACE RIEN, et c'est ce qui le rend acceptable.** US-23 du
 * PRD dit que rien n'est jamais supprimé ; dédupliquer à la collecte aurait été
 * irréversible et aurait perdu, sans trace, deux vraies ouvertures au même
 * intitulé. Ici les annonces restent toutes en base, toutes visibles dans
 * `/offres`, et l'écran du matin se contente de n'en montrer qu'une en le
 * disant.
 *
 * ⚠️ **Il ne s'applique QU'À `/`, décision de Maxime le 30 août 2026.**
 * `/offres` reste exhaustif : c'est l'archive de travail (US-22 — accéder à tout
 * ce qui a été collecté), et sa liste est plafonnée à 200 sur 570, donc deux
 * jumelles peuvent être l'une dedans et l'autre dehors. Y regrouper rendrait le
 * compteur trompeur — « 570 offres · 187 affichées » sans que 187 veuille dire
 * quoi que ce soit.
 */

/** Le minimum qu'une offre doit porter pour être regroupée. */
export type OffreRegroupable = {
  identifiant: string;
  intitule: string;
  entreprise_nom: string | null;
  lieu_libelle: string | null;
  note_interet: number | null;
};

/** Un poste, et toutes les annonces qui le publient. */
export type GroupeOffres<T extends OffreRegroupable> = {
  /** L'annonce montrée : la mieux notée du groupe. */
  principale: T;
  /**
   * Les identifiants des **autres** annonces du même poste, celles qu'on
   * n'affiche pas.
   *
   * ⚠️ **Ils voyagent jusqu'au bouton de statut**, parce que Maxime a tranché
   * que le clic devait traiter le poste entier : sans eux, écarter l'annonce
   * affichée laisserait sa jumelle « à traiter », et elle reprendrait la place
   * au chargement suivant — on trierait deux fois le même poste, ce qui vide le
   * regroupement de son intérêt.
   */
  jumelles: string[];
  /** Combien d'annonces publient ce poste, l'affichée comprise. Toujours ≥ 1. */
  annonces: number;
};

/**
 * La clé qui identifie un poste : l'intitulé débarrassé de ses marques de genre,
 * et le lieu.
 *
 * ⚠️ **Elle repose sur l'intitulé, pas sur la description — et une première
 * tentative s'est trompée là-dessus.** Grouper sur les 200 premiers caractères
 * de description paraissait plus robuste ; ces caractères sont en réalité le
 * **préambule de présentation de l'entreprise**, identique sur toutes les
 * annonces d'un même employeur. La mesure annonçait alors 25,8 % de doublons et
 * un écart de note de 63 points — deux chiffres faux, produits par la fusion de
 * postes MBDA sans rapport entre eux. Sur l'intitulé normalisé : 5,1 % et
 * 23 points.
 *
 * ⚠️ **Le lieu entre dans la clé**, sans quoi deux ouvertures réelles du même
 * intitulé dans deux villes seraient fondues en une, et l'une des deux
 * disparaîtrait de l'écran du matin.
 *
 * ⚠️ **L'entreprise n'est PAS dans la clé, et c'est un retournement assumé.**
 * La première version l'y mettait, et refusait de regrouper les offres sans
 * employeur nommé — par prudence : 36 % des offres n'en nomment aucun, et les
 * traiter comme « la même entreprise inconnue » pouvait fusionner des sociétés
 * différentes. **Vu à l'écran le 30 août 2026, cette prudence ratait le cas
 * exact qui a motivé ce module** : les quatre annonces MBDA que Maxime a vues en
 * double affichent toutes « Entreprise non communiquée ». La règle protégeait
 * donc parfaitement contre un risque théorique, en ne servant jamais.
 *
 * Ce qui la remplace : **l'entreprise SÉPARE, elle ne rapproche pas** — voir
 * `separerParEmployeur()`. Deux annonces qui nomment deux employeurs
 * différents ne sont jamais fondues ; une annonce anonyme ne bloque plus rien.
 */
function clePoste(offre: OffreRegroupable): string {
  const intitule = normaliserIntitule(offre.intitule);
  const lieu = (offre.lieu_libelle ?? "").trim().toLowerCase();

  return `${intitule} ${lieu}`;
}

/**
 * Éclate un groupe si — et seulement si — il réunit **deux employeurs nommés
 * différents**.
 *
 * Entre : les annonces partageant déjà intitulé et lieu.
 * Sort : un sous-groupe par employeur nommé, plus un sous-groupe pour les
 * anonymes ; ou le groupe entier si rien ne le contredit.
 *
 * ⚠️ **Le cas courant ne coûte rien** : zéro ou un seul employeur nommé — ce qui
 * couvre les quatre annonces MBDA anonymes — et le groupe ressort intact.
 *
 * ⚠️ **Les anonymes forment leur propre sous-groupe quand il y a conflit**, et
 * ne sont rattachés à aucun employeur. Les rattacher au premier venu serait
 * deviner : rien dans l'annonce ne dit à qui elle appartient, et se tromper
 * ferait disparaître une offre de l'écran.
 */
function separerParEmployeur<T extends OffreRegroupable>(membres: T[]): T[][] {
  const employeurs = new Set(
    membres
      .map((o) => o.entreprise_nom?.trim().toLowerCase())
      .filter((nom): nom is string => Boolean(nom)),
  );

  if (employeurs.size <= 1) return [membres];

  const parEmployeur = new Map<string, T[]>();
  for (const offre of membres) {
    const cle = offre.entreprise_nom?.trim().toLowerCase() ?? " anonymes";
    const lot = parEmployeur.get(cle);
    if (lot) lot.push(offre);
    else parEmployeur.set(cle, [offre]);
  }

  return [...parEmployeur.values()];
}

/**
 * L'intitulé réduit à ce qui désigne le poste.
 *
 * « Coordinateur transformation ia au profit des métiers de l'ingénierie f/h »
 * et « … f/h (H/F) » doivent rendre la même chaîne — c'est exactement la paire
 * qui a déclenché ce module.
 *
 * ⚠️ **Les marques de genre sont retirées AVANT la ponctuation**, sinon
 * `(H/F)` devient `h f` et ne se distingue plus d'un mot du titre.
 */
export function normaliserIntitule(intitule: string): string {
  return intitule
    .toLowerCase()
    .replace(/\((?:h\/f|f\/h|h\/f\/d|m\/f)\)/g, " ")
    .replace(/\b(?:h\/f|f\/h|h\/f\/d|m\/f)\b/g, " ")
    // Les accents restent : « ingénieur » et « ingenieur » sont deux graphies
    // différentes de la source, et les confondre ne gagnerait rien de mesuré.
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Regroupe les annonces par poste, en préservant l'ordre d'arrivée.
 *
 * ⚠️ **L'ordre des groupes suit celui de la première annonce rencontrée**, donc
 * le classement décidé par la requête SQL. Retrier ici referait, mal et en
 * mémoire, ce que Postgres a déjà fait — et ferait diverger l'ordre de `/` de
 * celui de `/offres`.
 *
 * ⚠️ **C'est la MIEUX NOTÉE qui est montrée, pas la première.** Les deux
 * annonces d'un même poste peuvent porter des notes différentes : 68 et 45 sur
 * la paire mesurée le 30 août 2026, pour des justifications qui disaient
 * pourtant la même chose. Montrer la meilleure est le choix qui ne fait pas
 * rater une offre ; le cartouche « 2 annonces » signale qu'une autre lecture
 * existe, et `/offres` la donne.
 *
 * ⚠️ **`null` ne gagne jamais contre une note.** Une offre non notée qui
 * arriverait en tête de groupe cacherait une jumelle notée 68.
 */
export function regrouperParPoste<T extends OffreRegroupable>(
  offres: T[],
): GroupeOffres<T>[] {
  const parCle = new Map<string, T[]>();

  for (const offre of offres) {
    const cle = clePoste(offre);
    const groupe = parCle.get(cle);
    if (groupe) groupe.push(offre);
    else parCle.set(cle, [offre]);
  }

  return [...parCle.values()].flatMap(separerParEmployeur).map((membres) => {
    const principale = membres.reduce((meilleure, candidate) =>
      mieuxNotee(candidate, meilleure) ? candidate : meilleure,
    );

    return {
      principale,
      jumelles: membres
        .filter((o) => o.identifiant !== principale.identifiant)
        .map((o) => o.identifiant),
      annonces: membres.length,
    };
  });
}

/**
 * `a` est-elle mieux notée que `b` ?
 *
 * ⚠️ **Le départage à égalité passe par l'identifiant**, et ce n'est pas de la
 * coquetterie : sans lui, deux annonces à la même note pourraient s'échanger la
 * place d'un chargement à l'autre selon l'ordre rendu par Postgres, et la ligne
 * du matin changerait d'identifiant sans raison visible. C'est le même
 * raisonnement que le départage jusqu'à une colonne unique dans `CLASSEMENTS`.
 */
function mieuxNotee(a: OffreRegroupable, b: OffreRegroupable): boolean {
  const na = a.note_interet;
  const nb = b.note_interet;

  if (na === nb) return a.identifiant < b.identifiant;
  if (na === null) return false;
  if (nb === null) return true;
  return na > nb;
}

/**
 * Toutes les annonces représentées par ces groupes — l'affichée et ses jumelles.
 *
 * ⚠️ **C'est ce compte, et non le nombre de groupes, qui sert au compteur de la
 * carte de passage.** Les jumelles ne sont pas à l'écran, mais elles sont
 * traitées par le clic sur le groupe : les compter comme « en attente ailleurs »
 * ferait promettre du travail qui n'existe plus dès que Maxime aura trié.
 */
export function annoncesRepresentees<T extends OffreRegroupable>(
  groupes: GroupeOffres<T>[],
): number {
  return groupes.reduce((total, groupe) => total + groupe.annonces, 0);
}
