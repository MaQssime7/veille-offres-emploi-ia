/**
 * Les trois statuts d'une offre : leur liste, leurs libellés, leur validation.
 *
 * Entre : rien, ou une chaîne venue de l'extérieur pour `estStatut`.
 * Sort : des constantes, et un verdict de validité.
 * Casse : rien à l'exécution.
 *
 * ⚠️ **Ce fichier n'a PAS `import "server-only"`, et c'est toute sa raison
 * d'être.** Les autres modules de `lib/` en portent un parce qu'ils lisent la
 * clé secrète de Supabase. Or la phase 4 pose les premiers composants clients
 * du projet, et ils ont besoin des mêmes trois valeurs que le serveur : le
 * libellé à écrire sur un bouton, la liste des statuts possibles.
 *
 * S'ils importaient `lib/offres.ts` pour les récupérer, ils tireraient
 * `lib/supabase.ts` dans le graphe du navigateur — donc `server-only`, donc une
 * erreur de compilation. Et si ce garde-fou n'existait pas, ils y tireraient la
 * clé secrète. **Séparer les constantes du code qui lit les secrets est ce qui
 * rend la frontière tenable** : sans ce fichier, on serait tenté de recopier les
 * trois chaînes dans le composant client, et deux listes de statuts finiraient
 * par diverger.
 *
 * ⚠️ **La liste ci-dessous doit rester identique à la contrainte `statut_connu`**
 * de `supabase/migrations/20260829084815_…`. Elles ne peuvent pas être générées
 * l'une depuis l'autre — l'une est du SQL dans la base, l'autre du TypeScript
 * dans le paquet. La base est l'autorité : si les deux divergent, c'est le code
 * qui a tort, et la base répondra 400 plutôt que d'écrire une valeur inconnue.
 */

/**
 * ⚠️ **Sans accent ni espace, parce que ces chaînes voyagent dans l'adresse.**
 * `/offres?statut=candidate` se met en favori et se lit ; `?statut=candidaté`
 * s'écrirait `%C3%A9` et `?statut=à traiter` deviendrait `%C3%A0%20traiter`.
 * Le libellé français s'affiche à l'écran, il ne se stocke pas et ne circule
 * pas.
 */
export const STATUTS = ["a_traiter", "candidate", "ecarte"] as const;

export type Statut = (typeof STATUTS)[number];

/**
 * Le statut d'une offre que personne n'a encore triée.
 *
 * ⚠️ **C'est aussi le `default` de la colonne en base**, et les deux valeurs
 * doivent rester d'accord. La base fait autorité : une offre écrite par le
 * pipeline reçoit ce statut sans que ce fichier n'intervienne.
 */
export const STATUT_PAR_DEFAUT: Statut = "a_traiter";

/**
 * Ce qui s'affiche à l'écran. Accentué, en français, et jamais stocké.
 */
export const LIBELLES_STATUT: Record<Statut, string> = {
  a_traiter: "À traiter",
  candidate: "Candidaté",
  ecarte: "Écarté",
};

/**
 * Est-ce que cette chaîne est un statut connu ?
 *
 * Entre : n'importe quoi — typiquement le contenu de `?statut=` dans l'adresse,
 * que l'utilisateur peut écrire à la main.
 * Sort : `true` **et** la garantie pour TypeScript qu'il s'agit d'un `Statut`.
 * Casse : rien. `undefined`, `null` et les tableaux rendent `false`.
 *
 * ⚠️ **C'est le premier des deux verrous, pas le seul.** Le second est la
 * contrainte `statut_connu` en base. Le projet applique déjà ce principe à
 * l'identifiant d'offre — validé par expression régulière *avant* d'atteindre
 * la base, *et* encodé par `options.egal` — et pour la même raison : celui-ci
 * tient encore le jour où quelqu'un ajoutera un chemin d'écriture en oubliant
 * de valider.
 */
export function estStatut(valeur: unknown): valeur is Statut {
  return typeof valeur === "string" && (STATUTS as readonly string[]).includes(valeur);
}
