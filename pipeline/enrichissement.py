"""L'enrichissement d'une offre — le processus lancé par le clic de Maxime.

Entre : l'identifiant d'une tentative, passé par l'entrée du workflow GitHub.
Sort : des étapes écrites au fil de l'eau, puis une conclusion en base.
Casse : code de sortie 1 en cas d'échec — c'est lui qui fait rougir le job.

⚠️ **ÉTAT AU 30 AOÛT 2026 — TRANCHE 6.2 : ce module prouve le TUYAU, il
n'appelle aucun modèle.** Il écrit des étapes de démonstration et conclut. Le
découpage est délibéré : le mécanisme complet — déclenchement par l'API GitHub,
étapes qui remontent par sondage, péremption, enveloppe — est vérifiable de bout
en bout pour **zéro centime**. L'agent le remplacera en 6.3, sans qu'aucune
autre pièce ne bouge.

---------------------------------------------------------------------------
Pourquoi ce processus tourne chez GitHub Actions et pas chez Vercel
---------------------------------------------------------------------------

Une fonction Vercel s'arrête à 300 s en offre gratuite ; un agent qui explore le
site d'une entreprise peut dépasser. Plutôt que de contourner la limite, on
l'évite : l'interface écrit la demande et rend la main **immédiatement**, ce
processus la sert ailleurs, et l'écran suit par sondage. C'est un découplage
producteur/consommateur — plus solide qu'un streaming synchrone, et il tient si
l'onglet se ferme.

⚠️ **Ce n'est PAS parce que Vercel ne saurait pas exécuter du Python.** Il le
sait. Ce qu'on laisse sur la table, c'est la latence au clic : 30 à 60 secondes
avant que GitHub n'alloue une machine. Arbitrage assumé, pas impossibilité.

---------------------------------------------------------------------------
⚠️ LES JOURNAUX DE CE WORKFLOW SONT PUBLICS
---------------------------------------------------------------------------

Le dépôt est public. **Rien de ce que produit l'enrichissement ne va dans la
sortie standard** : ni le texte de l'annonce, ni un nom de contact, ni les
étapes rédigées. Tout part en base, à l'écran de Maxime. Ce module ne journalise
que des compteurs et des identifiants.
"""
from __future__ import annotations

import argparse
import logging
import sys
import time

from pipeline import config as configuration
from pipeline.stockage import ConsommationTokens, ErreurStockage, Stockage

_journal = logging.getLogger(__name__)

# ⚠️ **Le rang 0 appartient à l'interface**, qui écrit « Demande reçue » en
# moins d'une seconde pour que l'écran ne reste pas muet pendant que GitHub
# alloue une machine. Ce module commence donc à 1. Aucune collision possible :
# une relance crée une NOUVELLE tentative, dont les rangs repartent de zéro.
PREMIER_RANG = 1

# Les étapes de la tranche 6.2. Elles imitent le rythme réel — quelques secondes
# chacune — pour que le fondu-glissé, la pulsation et l'arrêt du sondage soient
# regardés dans les conditions où ils serviront, pas sur une liste qui apparaît
# d'un bloc.
ETAPES_DEMONSTRATION = (
    ("Lecture de l’annonce", 2),
    ("Interrogation du registre public des entreprises", 3),
    ("Vérification de l’identité de l’employeur", 2),
)


def executer(enrichissement_id: int, *, pause: bool = True) -> int:
    """Sert une demande d'enrichissement.

    ⚠️ **La toute première chose faite est de RÉCLAMER la tentative.**
    `demarrer_enrichissement()` ne réussit que si la ligne est encore en vol :
    si l'interface l'a refermée pour péremption pendant que GitHub cherchait une
    machine, ce processus s'arrête sans rien écrire. Sans ce garde-fou, il
    écrirait des étapes sous une conclusion d'échec déjà affichée — un
    enrichissement qui progresse après avoir annoncé qu'il renonçait.
    """
    config = configuration.charger_enrichissement()
    stockage = Stockage(config.supabase_url, config.supabase_secret_key)

    if not stockage.demarrer_enrichissement(enrichissement_id):
        # Sortie 0, pas 1 : ce n'est pas une panne. La demande a expiré ou a
        # déjà été servie, et faire rougir le job ferait croire à un défaut.
        _journal.warning(
            "enrichissement %s : la tentative n'est plus en vol, rien à faire",
            enrichissement_id,
        )
        return 0

    ligne = stockage.offre_de_l_enrichissement(enrichissement_id)
    if ligne is None or not ligne.get("offres"):
        stockage.conclure_enrichissement(
            enrichissement_id, issue="echec",
            motif_echec="L’offre visée par cette demande est introuvable.",
        )
        _journal.error("enrichissement %s : offre introuvable", enrichissement_id)
        return 1

    identifiant = ligne["offre_identifiant"]
    _journal.info("enrichissement %s : offre %s", enrichissement_id, identifiant)

    try:
        rang = PREMIER_RANG
        for libelle, secondes in ETAPES_DEMONSTRATION:
            if pause:
                time.sleep(secondes)
            stockage.ecrire_etape(enrichissement_id, rang, libelle)
            rang += 1

        # ⚠️ **`appariement` est OBLIGATOIRE sur une réussite** — la contrainte
        # `reussite_conclut_l_appariement` refuse une conclusion muette. En 6.2
        # rien n'a été cherché, donc la seule valeur honnête est
        # « non identifié », avec son motif. Écrire « vérifié » pour faire
        # passer la contrainte serait exactement la fiche fausse d'apparence
        # rigoureuse que le PRD redoute.
        ferme = stockage.conclure_enrichissement(
            enrichissement_id, issue="reussite",
            tours=0, tokens=ConsommationTokens(),
            fiche={
                "appariement": "non_identifie",
                "appariement_motif": (
                    "Tranche 6.2 : le mécanisme est en place, l’agent n’a pas "
                    "encore été branché."
                ),
            },
        )
        if not ferme:
            # La tentative a été refermée pendant qu'on travaillait.
            _journal.warning(
                "enrichissement %s : refermé pendant l'exécution, conclusion ignorée",
                enrichissement_id,
            )
            return 0

    except ErreurStockage as echec:
        # ⚠️ **On tente de fermer la ligne AVANT de sortir en erreur.** Sans ça,
        # elle resterait `en_cours` et bloquerait l'offre jusqu'à la péremption :
        # dix minutes pendant lesquelles l'écran pulse pour rien.
        try:
            stockage.conclure_enrichissement(
                enrichissement_id, issue="echec",
                motif_echec="L’enrichissement s’est interrompu sur une erreur technique.",
            )
        except ErreurStockage:
            _journal.error("enrichissement %s : clôture impossible", enrichissement_id)
        raise echec

    _journal.info("enrichissement %s : terminé", enrichissement_id)
    return 0


def main() -> int:
    analyseur = argparse.ArgumentParser(
        description="Sert une demande d'enrichissement déposée par l'interface.",
    )
    analyseur.add_argument("--id", type=int, required=True,
                           help="identifiant de la tentative à servir")
    analyseur.add_argument("--sans-attendre", action="store_true",
                           help="enchaîner les étapes sans pause (tests)")
    arguments = analyseur.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    try:
        return executer(arguments.id, pause=not arguments.sans_attendre)
    except (configuration.ConfigurationIncomplete, ErreurStockage) as echec:
        _journal.error("%s", echec)
        return 1


if __name__ == "__main__":
    sys.exit(main())
