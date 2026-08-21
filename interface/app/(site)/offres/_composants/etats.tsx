import { DatabaseZap, Inbox } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { MotifEchec } from "@/lib/supabase";

/** L'ossature commune aux écrans qui n'ont pas d'offres à montrer. */
function Panneau({
  icone,
  titre,
  children,
  ton = "neutre",
}: {
  icone: ReactNode;
  titre: string;
  children: ReactNode;
  ton?: "neutre" | "erreur";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 border px-5 py-8 sm:px-8 sm:py-10",
        ton === "erreur"
          ? "border-destructive/40 bg-destructive/5"
          : "border-border bg-card",
      )}
    >
      <span
        className={cn(
          ton === "erreur" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {icone}
      </span>
      <h2 className="font-display text-xl font-bold leading-tight text-foreground">
        {titre}
      </h2>
      <div className="max-w-prose text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

/**
 * La base répond, mais elle est vide. C'est l'écran du tout premier matin,
 * avant que le cron n'ait jamais tourné — et il ne doit surtout pas ressembler
 * à une panne, sinon on cherchera un bug là où il n'y en a pas.
 */
export function AucuneOffre() {
  return (
    <Panneau
      icone={<Inbox className="size-6" aria-hidden="true" />}
      titre="Aucune offre pour l'instant"
    >
      <p>
        La base est joignable, elle ne contient simplement encore aucune offre.
        La collecte tourne chaque nuit&nbsp;; les premières annonces
        apparaîtront ici au prochain passage.
      </p>
    </Panneau>
  );
}

/**
 * La base n'a pas répondu.
 *
 * ⚠️ **Le détail technique ne descend jamais jusqu'ici.** Le corps d'une erreur
 * PostgREST peut contenir l'adresse du projet ou la structure de la requête
 * refusée ; il reste dans le journal du serveur. L'écran ne dit que ce qui est
 * actionnable — sauf pour le motif « configuration », où la variable absente
 * est nommée : ce site n'a qu'un utilisateur, et c'est lui qui pose les
 * variables chez l'hébergeur.
 */
export function BaseInjoignable({
  motif,
  explication,
}: {
  motif: MotifEchec;
  explication: string;
}) {
  return (
    <Panneau
      ton="erreur"
      icone={<DatabaseZap className="size-6" aria-hidden="true" />}
      titre={
        motif === "configuration"
          ? "Le site n'est pas configuré"
          : "La base est injoignable"
      }
    >
      {motif === "configuration" ? (
        <p>
          {explication} Les offres ne peuvent pas être lues tant qu’elle n’est
          pas posée dans les variables d’environnement.
        </p>
      ) : (
        <p>
          Les offres n’ont pas pu être lues. Elles ne sont pas perdues&nbsp;:
          elles sont en base, c’est la lecture qui a échoué. Recharger la page
          suffit souvent&nbsp;; le détail de la panne est dans le journal du
          serveur.
        </p>
      )}
    </Panneau>
  );
}
