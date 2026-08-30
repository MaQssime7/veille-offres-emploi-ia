/**
 * Quel nom d'entreprise l'écran affiche, et d'où il vient. **Fonctions pures,
 * partagées serveur et navigateur.**
 *
 * ⚠️ **Ce module n'a pas `import "server-only"`, comme `statuts.ts`,
 * `notes.ts`, `francais.ts`, `filtres.ts`, `tri.ts` et `theme.ts`, et pour la
 * même raison** : il ne contient que des fonctions pures, aucune ne lit de
 * secret ni ne touche au réseau. Il est aujourd'hui appelé par des composants
 * serveur uniquement — mais le poser dans `lib/offres.ts` tirerait
 * `lib/supabase.ts`, donc la clé secrète, dans le graphe du navigateur le jour
 * où un composant client voudra afficher un nom d'employeur. C'est très
 * exactement le défaut dormant qu'`adresse.ts` portait avant la naissance de
 * `filtres.ts` : rien ne cassait tant que personne ne l'importait.
 *
 * ---
 *
 * **Le problème que ce module résout, mesuré le 30 août 2026 sur 580 offres.**
 * `entreprise_nom` vient de France Travail. Il est absent sur **39 %** des
 * offres (47 % de celles qui sont notées), désigne un intermédiaire dans
 * **36 %** des cas, et il est **parfois faux** : l'offre `6426819` l'annonce à
 * « NEW NET 3D » quand sa description dit « L'entreprise Wavestone recherche
 * actuellement des profils ».
 *
 * `entreprise_identifiee` est le nom que le modèle a lu **dans le texte** de
 * l'annonce, et que `pipeline/employeur.py` a vérifié en cherchant ce nom dans
 * ce texte. Il prime donc sur le champ brut.
 *
 * ⚠️ **Mais l'écran ne doit jamais faire passer une déduction pour une donnée
 * officielle.** C'est la raison d'être de `source` et d'`annoncePar` : la fiche
 * dit d'où vient le nom qu'elle montre. Sans ça, Maxime candidaterait chez
 * « Wavestone » sans savoir que c'est un modèle qui l'a déduit, et sans moyen
 * de vérifier si l'annonce le contredit.
 */

/** D'où vient le nom affiché. */
export type SourceEmployeur =
  /** Lu dans le texte de l'annonce par le modèle, puis vérifié. */
  | "identifie"
  /** Le champ `entreprise.nom` de France Travail, tel quel. */
  | "france-travail"
  /** Personne ne nomme l'employeur : ni France Travail, ni le texte. */
  | "inconnu";

export type Employeur = {
  /** Le nom à afficher. `null` quand aucune source ne le donne. */
  nom: string | null;
  source: SourceEmployeur;
  /**
   * Le nom que France Travail annonce, **uniquement quand il diffère** de celui
   * qu'on affiche. `null` sinon — y compris quand les deux disent la même chose
   * à la casse près, auquel cas « annoncé par Wavestone » sous « WAVESTONE »
   * serait du bruit pur.
   */
  annoncePar: string | null;
  /** Le modèle a reconnu un cabinet, une ESN, une agence ou un forum. */
  parIntermediaire: boolean;
};

/** Les seules colonnes dont ce module a besoin. Pas l'offre entière. */
export type ChampsEmployeur = {
  entreprise_nom: string | null;
  entreprise_identifiee: string | null;
  entreprise_intermediaire: boolean | null;
};

/**
 * Ramène deux noms à une forme comparable, pour décider s'ils « disent la même
 * chose ». Minuscules, sans accents, blancs réduits.
 *
 * Jumelle de `_normaliser()` dans `pipeline/employeur.py`, et le doublon est
 * assumé : celui-ci sert à *ne pas afficher deux fois la même information*,
 * celui-là à *refuser une hallucination avant l'écriture en base*. Les faire
 * partager du code demanderait de faire dialoguer Python et TypeScript pour un
 * gain nul ; ce qui compte est qu'aucun des deux ne devienne « intelligent ».
 */
function comparable(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/[’ʼ]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Une chaîne vide, absente ou faite de blancs vaut « pas de valeur ». */
function renseigne(valeur: string | null): string | null {
  const propre = valeur?.trim();
  return propre ? propre : null;
}

/**
 * Décide quel nom l'écran montre, et ce qu'il en dit.
 *
 * ⚠️ **L'ordre des trois cas EST la décision produit**, prise par Maxime le
 * 30 août 2026 : le nom identifié l'emporte sur le champ France Travail, y
 * compris quand ce dernier est renseigné. C'est ce qui fait disparaître
 * « NEW NET 3D » de l'écran. L'option prudente — ne combler que les trous —
 * a été écartée parce qu'elle laissait en place les noms **faux**, qui sont le
 * cas le plus coûteux : un nom absent se voit, un nom faux se croit.
 */
export function lireEmployeur(offre: ChampsEmployeur): Employeur {
  const identifie = renseigne(offre.entreprise_identifiee);
  const annonce = renseigne(offre.entreprise_nom);
  const parIntermediaire = offre.entreprise_intermediaire === true;

  if (identifie) {
    // ⚠️ **Le modèle rend la forme COURTE quand c'est elle qui figure dans le
    // texte, et la préférer serait une perte.** Mesuré le 30 août 2026 sur le
    // premier rattrapage réel : France Travail annonçait « IPPON
    // Technologies », l'annonce écrivait « IPPON », et la règle « l'identifié
    // l'emporte » remplaçait un nom complet par son abréviation. Ce n'est pas
    // une correction — c'est le même employeur, écrit moins bien.
    //
    // Quand le nom identifié est **contenu** dans celui de France Travail, le
    // modèle a donc confirmé la source plutôt que de la corriger : on garde le
    // nom long, et il n'y a aucune provenance à afficher.
    //
    // ⚠️ **Ne rattrape PAS les sigles** — « BnF » face à « BIBLIOTHEQUE
    // NATIONALE DE FRANCE » n'est pas une sous-chaîne, et aucune règle
    // raisonnable ne les rapprochera. C'est une limite connue, pas un oubli :
    // le sigle reste juste et lisible, il est seulement moins explicite.
    // ⚠️ **`!== ` autant que `includes` : la règle ne vaut que si France
    // Travail en dit STRICTEMENT plus.** Sans le premier test, deux noms
    // équivalents à la casse près — « THALES » contre « Thales » — tombaient
    // aussi dans cette branche, et l'écran affichait la version tout en
    // capitales du champ brut là où le modèle rendait une forme lisible. On ne
    // veut pas préférer France Travail, on veut seulement ne pas perdre
    // d'information.
    if (
      annonce &&
      comparable(annonce) !== comparable(identifie) &&
      comparable(annonce).includes(comparable(identifie))
    ) {
      return { nom: annonce, source: "france-travail", annoncePar: null, parIntermediaire };
    }
    return {
      nom: identifie,
      source: "identifie",
      annoncePar:
        annonce && comparable(annonce) !== comparable(identifie) ? annonce : null,
      parIntermediaire,
    };
  }
  if (annonce) {
    return { nom: annonce, source: "france-travail", annoncePar: null, parIntermediaire };
  }
  return { nom: null, source: "inconnu", annoncePar: null, parIntermediaire };
}

/**
 * La phrase de provenance, affichée **sur la fiche uniquement**.
 *
 * ⚠️ **Elle ne va pas en liste**, et c'est une décision de densité, pas un
 * oubli : la liste montre 200 offres qu'on balaye, la fiche en montre une
 * qu'on lit. Une seconde ligne de métadonnée sous chaque nom d'entreprise
 * ferait passer les intitulés longs — 223 caractères au maximum observé — sur
 * une ligne de plus, sur 200 lignes.
 *
 * Rend `null` quand il n'y a rien à dire : le champ vient de France Travail
 * tel quel, ou personne ne nomme l'employeur.
 */
export function provenanceEmployeur(employeur: Employeur): string | null {
  if (employeur.source !== "identifie") return null;

  // ⚠️ **`parIntermediaire` doit servir ICI, sinon il ne sert nulle part.**
  // Relevé en revue le 30 août 2026 : le champ était demandé au modèle, payé,
  // écrit en base — et jamais lu. Or le commentaire de la colonne, désormais
  // dans la base et non réécrivable, promet qu'il « sert à expliquer à l'écran
  // pourquoi le nom affiché diffère de celui annoncé par France Travail ».
  // Entre corriger la promesse par une migration de plus et la tenir, on la
  // tient : c'est aussi l'information la plus utile des deux quand Maxime
  // décide s'il candidate.
  const origine = employeur.parIntermediaire
    ? "Annonce déposée par un intermédiaire"
    : "Identifié dans l’annonce";

  return employeur.annoncePar
    ? `${origine} · France Travail annonce ${employeur.annoncePar}`
    : origine;
}
