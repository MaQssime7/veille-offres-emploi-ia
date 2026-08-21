"use client";

/**
 * Le formulaire de la porte.
 *
 * Composant client parce qu'il lui faut trois choses que le serveur seul ne
 * donne pas : le message d'erreur renvoyé par l'action, l'état « vérification
 * en cours » du bouton, et le focus sur le champ à l'ouverture.
 *
 * Il ne détient aucun secret : le mot de passe part au serveur et n'en revient
 * jamais.
 */

import { useActionState, useEffect, useRef } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { connecter } from "./actions";
import { ETAT_CONNEXION_INITIAL } from "./etat";

export function FormulaireConnexion({ suite }: { suite: string }) {
  const [etat, envoyer, enAttente] = useActionState(
    connecter,
    ETAT_CONNEXION_INITIAL,
  );

  // Le message n'existe dans le DOM que hors vérification : les attributs
  // qui le désignent doivent suivre, sinon `aria-describedby` pointerait
  // vers un élément absent et un lecteur d'écran n'annoncerait rien.
  const erreurAffichee = etat.erreur !== null && !enAttente;

  const champ = useRef<HTMLInputElement>(null);

  // Après une tentative ratée, React réinitialise le formulaire : le champ est
  // vidé et le focus retombe sur `<body>`. Sans cette remise au point, il faut
  // re-cliquer pour réessayer — et sur téléphone le clavier se referme.
  // Deux moments où le focus s'échappe : au clic (le bouton se désactive et le
  // perd) et au retour de l'action (React réinitialise le formulaire). On le
  // ramène dans le champ dans les deux cas — sinon il reste une seconde sur
  // `<body>`, où plus rien n'est visible au clavier.
  useEffect(() => {
    if (enAttente || etat.erreur !== null) {
      champ.current?.focus();
    }
  }, [etat, enAttente]);

  return (
    <form action={envoyer} className="flex flex-col gap-4">
      {/* Où l'utilisateur voulait aller avant d'être arrêté ici. Relu et
          filtré côté serveur par `destinationSure` — un champ caché se
          modifie depuis le navigateur en trois clics. */}
      <input type="hidden" name="suite" value={suite} />

      {/* Un formulaire de mot de passe sans champ d'identifiant fait râler
          Chrome en console et empêche les gestionnaires de mots de passe
          d'enregistrer une fiche propre. Le site n'a qu'un utilisateur : le
          champ est constant et masqué. */}
      <input
        type="text"
        name="identifiant"
        value="veille-offres-emploi-ia"
        autoComplete="username"
        readOnly
        hidden
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="mot_de_passe" className="font-mono text-xs uppercase tracking-wider">
          Mot de passe
        </Label>
        <Input
          id="mot_de_passe"
          name="mot_de_passe"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          ref={champ}
          // Volontairement PAS `disabled` pendant la vérification : un champ
          // désactivé perd le focus, et le bouton désactivé suffit déjà à
          // empêcher une seconde soumission. `readOnly` fige la saisie sans
          // sortir le champ de l'ordre de tabulation.
          readOnly={enAttente}
          // ⚠️ `undefined` et non `false` : le variant `aria-invalid:` de
          // Tailwind réagit à la présence de l'attribut, pas à sa valeur.
          // Avec `false`, le champ s'affichait encadré de rouge au chargement.
          aria-invalid={erreurAffichee || undefined}
          aria-describedby={erreurAffichee ? "erreur-connexion" : undefined}
          className="h-9"
        />
      </div>

      {/* Pendant une nouvelle vérification, l'erreur de la tentative
          précédente disparaît : la laisser afficherait « incorrect »
          au moment même où on est en train de revérifier. */}
      {erreurAffichee && (
        /* L'erreur ne tient pas sur la seule couleur : un symbole la porte
           aussi. `role="alert"` la fait annoncer par un lecteur d'écran. */
        <p
          id="erreur-connexion"
          role="alert"
          className="flex items-center gap-2 text-sm text-destructive"
        >
          <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
          {etat.erreur}
        </p>
      )}

      <Button type="submit" size="lg" disabled={enAttente} className="w-full">
        {enAttente ? (
          <>
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Vérification…
          </>
        ) : (
          "Entrer"
        )}
      </Button>
    </form>
  );
}
