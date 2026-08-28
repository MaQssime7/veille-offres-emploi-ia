"""Le chef d'orchestre : une nuit de veille, du premier appel à la trace en base.

    source .venv/bin/activate
    python -m pipeline.collecte                     # la collecte nocturne normale
    python -m pipeline.collecte --depuis-jours 30   # rattrapage manuel
    python -m pipeline.collecte --sans-ecrire       # tout sauf l'écriture

Ce module ne sait ni parler HTTP ni écrire en base : il appelle les quatre
autres dans l'ordre et tient le compte rendu. Quand la collecte échoue, le
message dit lequel a lâché.

**La ligne d'exécution est fermée quoi qu'il arrive.** Un plantage laisse une
ligne `echec` motivée, jamais un `en_cours` orphelin — sauf coupure brutale du
processus, que le démarrage suivant rattrape.
"""
from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime, timedelta, timezone
from typing import Any

from pipeline import config as configuration
from pipeline.client_france_travail import ClientFranceTravail, ErreurFranceTravail
from pipeline.normalisation import normaliser_lot
from pipeline.stockage import ErreurStockage, Stockage

_journal = logging.getLogger("pipeline.collecte")


def calculer_fenetre(
    derniere_reussite: datetime | None, *, depuis_jours: int | None = None
) -> tuple[datetime, datetime]:
    """Détermine la période à demander à France Travail.

    La fenêtre se répare toute seule : elle repart de la dernière exécution
    RÉUSSIE, pas d'un « il y a 24 h » figé. Si le cron tombe trois jours, la
    nuit suivante rattrape les trois jours au lieu d'en perdre deux.

    L'heure de recouvrement ferme un trou réel : une offre publiée pendant que
    le pipeline tournait tomberait entre deux fenêtres. Le doublon ne coûte
    rien, la clé primaire le refuse.

    Le plafond de 30 jours empêche qu'une longue panne produise une fenêtre si
    large que la pagination de France Travail (~1150 offres par recherche) la
    tronque silencieusement.
    """
    jusqua = datetime.now(timezone.utc)

    if depuis_jours is not None:
        if depuis_jours <= 0:
            # Une valeur négative inverse la fenêtre (minCreationDate >
            # maxCreationDate → HTTP 400, exécution en échec) ; zéro produit une
            # fenêtre de largeur nulle qui se ferme en `reussite` sans rien
            # ramener, et décale ensuite la fenêtre automatique dessus.
            raise ValueError(
                f"--depuis-jours doit être strictement positif (reçu : {depuis_jours})."
            )
        return jusqua - timedelta(days=depuis_jours), jusqua

    if derniere_reussite is None:
        _journal.info("Aucune exécution réussie en base : fenêtre initiale de %d h.",
                      configuration.FENETRE_INITIALE_HEURES)
        depuis = jusqua - timedelta(hours=configuration.FENETRE_INITIALE_HEURES)
    else:
        depuis = derniere_reussite - timedelta(hours=configuration.RECOUVREMENT_HEURES)

    plancher = jusqua - timedelta(days=configuration.FENETRE_MAXIMALE_JOURS)
    if depuis < plancher:
        _journal.warning(
            "Dernière réussite le %s : fenêtre plafonnée à %d jours. "
            "Les offres antérieures ne seront pas rattrapées.",
            derniere_reussite, configuration.FENETRE_MAXIMALE_JOURS,
        )
        depuis = plancher

    return depuis, jusqua


def collecter_offres(
    client: ClientFranceTravail, config: configuration.Config,
    depuis: datetime, jusqua: datetime,
) -> dict[str, dict[str, Any]]:
    """Interroge tous les critères et rend les offres dédupliquées par identifiant.

    Déduplication AVANT écriture, pas après : une même offre remonte sur
    plusieurs mots-clés et sur son code ROME. Sans ce dictionnaire, on
    présenterait la même offre cinq fois à la base.

    ⚠️ Le commentaire précédent justifiait ici les codes ROME comme le filet qui
    rattrape « les annonces dont la description parle d'IA, la recherche par
    mots-clés n'indexant pas la description ». Le raisonnement était juste, la
    mesure l'a démenti deux fois — les six codes ont été retirés le 26 août
    (445 offres nettes par mois, aucune au-dessus de 30 sur 50 notées), et le
    28 août on a établi que `motsCles` ne fait pas de correspondance textuelle
    du tout : sur 40 offres rendues par « intelligence artificielle », 26 ne
    contiennent le terme **nulle part** dans la réponse de l'API. Le moteur
    élargit au domaine. La boucle sur les codes ROME reste, `codes_rome.txt`
    est vide et valide — mais ne pas la re-justifier par la description.

    Le filtre de contrat est appliqué à **toutes** les recherches, mots-clés et
    codes ROME confondus : un filtre posé sur une seule des deux voies laisserait
    entrer par l'autre exactement ce qu'on cherche à écarter.
    """
    offres: dict[str, dict[str, Any]] = {}
    sans_identifiant = 0

    def ajouter(lot: list[dict[str, Any]]) -> None:
        nonlocal sans_identifiant
        for offre in lot:
            identifiant = offre.get("id")
            if identifiant:
                offres.setdefault(identifiant, offre)
            else:
                # ⚠️ On ne journalise NI l'offre, NI un extrait : la charge brute
                # contient encore le champ `contact` (nom, courriel, adresse) à
                # ce stade — la normalisation ne l'a pas encore retiré. Le
                # journal de GitHub Actions est public sur ce dépôt. Un simple
                # compteur suffit à savoir que le cas s'est produit.
                sans_identifiant += 1

    # Tracé à CHAQUE exécution, dans les deux sens, et pas seulement documenté.
    # Un filtre qui écarte 21 % des offres sans empreinte au journal se relit
    # comme « France Travail n'a rien publié cette nuit ». Et journaliser
    # seulement quand le filtre est actif serait aussi trompeur à l'envers : une
    # nuit sans filtre ressemblerait alors trait pour trait à une nuit d'avant le
    # 28 août, et comparer deux exécutions supposerait de savoir quel commit
    # tournait. Deux nuits doivent se décrire elles-mêmes.
    if configuration.TYPE_CONTRAT:
        _journal.info(
            "Filtre de contrat actif : seules les offres « %s » sont demandées. "
            "Les autres ne seront pas collectées, et ne pourront pas l'être plus tard.",
            configuration.TYPE_CONTRAT,
        )
    else:
        _journal.info(
            "Filtre de contrat DÉSACTIVÉ : toutes natures de contrat sont collectées."
        )

    for mot_cle in config.mots_cles:
        ajouter(client.rechercher(
            region=configuration.REGION_ILE_DE_FRANCE,
            depuis=depuis, jusqua=jusqua, mots_cles=mot_cle,
            type_contrat=configuration.TYPE_CONTRAT,
        ))

    for code_rome in config.codes_rome:
        ajouter(client.rechercher(
            region=configuration.REGION_ILE_DE_FRANCE,
            depuis=depuis, jusqua=jusqua, code_rome=code_rome,
            type_contrat=configuration.TYPE_CONTRAT,
        ))

    if sans_identifiant:
        _journal.warning(
            "%d offre(s) sans identifiant écartée(s) — inexploitables, "
            "l'identifiant est la clé primaire de la table.", sans_identifiant
        )
    return offres


def executer(*, depuis_jours: int | None = None, sans_ecrire: bool = False) -> int:
    """Une exécution complète. Rend un code de sortie : 0 réussite, 1 échec."""
    config = configuration.charger()
    client = ClientFranceTravail(config.ft_client_id, config.ft_client_secret)
    stockage = Stockage(config.supabase_url, config.supabase_secret_key)

    if sans_ecrire:
        # ⚠️ `refermer_executions_orphelines` fait un PATCH : elle N'A RIEN À
        # FAIRE sur ce chemin. « Tout sauf l'écriture » doit vouloir dire tout
        # sauf l'écriture, sinon une passe à blanc lancée pendant la collecte
        # nocturne marquerait l'exécution vivante en `echec`.
        depuis, jusqua = calculer_fenetre(
            stockage.derniere_execution_reussie(), depuis_jours=depuis_jours
        )
        _journal.info("Fenêtre de collecte : %s → %s", depuis.isoformat(), jusqua.isoformat())
        offres = collecter_offres(client, config, depuis, jusqua)
        lignes, rejets = normaliser_lot(offres, execution_id=0)
        _journal.info("À BLANC : %d offre(s) distincte(s), %d exploitable(s), %d rejet(s). "
                      "Rien n'a été écrit.", len(offres), len(lignes), len(rejets))
        return 0

    stockage.refermer_executions_orphelines()
    depuis, jusqua = calculer_fenetre(
        stockage.derniere_execution_reussie(), depuis_jours=depuis_jours
    )
    _journal.info("Fenêtre de collecte : %s → %s", depuis.isoformat(), jusqua.isoformat())

    execution_id = stockage.ouvrir_execution()
    try:
        offres = collecter_offres(client, config, depuis, jusqua)
        lignes, rejets = normaliser_lot(offres, execution_id)
        nouvelles = stockage.inserer_offres(lignes)

        # Après l'insertion, donc sur une collecte déjà aboutie : on ne recolle
        # pas des offres à une exécution qui pourrait encore échouer.
        recollees = stockage.recoller_offres_orphelines(execution_id)

        stockage.fermer_execution(
            execution_id, issue="reussite",
            offres_recues=len(offres), offres_nouvelles=nouvelles,
            offres_rejetees=len(rejets),
        )
        _journal.info(
            "Collecte terminée : %d distincte(s) reçue(s), %d nouvelle(s), %d rejetée(s)"
            "%s.", len(offres), nouvelles, len(rejets),
            f", {recollees} recollée(s) d'une exécution en échec" if recollees else "",
        )
        return 0

    except (ErreurFranceTravail, ErreurStockage) as panne:
        # Panne attendue et identifiée : on la trace en clair. `type(panne).__name__`
        # dit lequel des modules a lâché — standardiste ou archiviste.
        _journal.error("Collecte échouée : %s", panne)
        _fermer_en_echec(stockage, execution_id, f"{type(panne).__name__} : {panne}")
        return 1

    except Exception as imprevu:  # noqa: BLE001 - filet de dernier recours, jamais muet
        # Tout le reste : on referme quand même la ligne, sinon elle reste
        # `en_cours` et l'interface compte une exécution qui n'a jamais fini.
        _journal.exception("Collecte échouée sur une erreur imprévue.")
        _fermer_en_echec(stockage, execution_id, f"{type(imprevu).__name__} : {imprevu}")
        return 1


def _fermer_en_echec(stockage: Stockage, execution_id: int, motif: str) -> None:
    """Referme la ligne. Si même ça échoue, on le dit — sans masquer la panne d'origine."""
    try:
        stockage.fermer_execution(execution_id, issue="echec", motif_echec=motif)
    except ErreurStockage as echec_fermeture:
        _journal.error(
            "Impossible de refermer l'exécution #%d (%s). Elle restera en_cours "
            "jusqu'à ce qu'un démarrage ultérieur la déclare orpheline.",
            execution_id, echec_fermeture,
        )


def main() -> int:
    analyseur = argparse.ArgumentParser(
        description="Collecte les offres France Travail et les range en base."
    )
    analyseur.add_argument(
        "--depuis-jours", type=int, default=None,
        help="Ignorer la fenêtre automatique et remonter de N jours "
             "(remplissage manuel de la base). Doit être strictement positif.",
    )
    analyseur.add_argument(
        "--sans-ecrire", action="store_true",
        help="Collecter et normaliser sans rien écrire en base.",
    )
    arguments = analyseur.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(name)s | %(message)s",
        datefmt="%H:%M:%S",
    )
    try:
        return executer(depuis_jours=arguments.depuis_jours, sans_ecrire=arguments.sans_ecrire)
    except configuration.ConfigurationIncomplete as manque:
        _journal.error("Démarrage impossible : %s", manque)
        return 1
    except ValueError as argument_invalide:
        _journal.error("Argument invalide : %s", argument_invalide)
        return 1
    except (ErreurStockage, ErreurFranceTravail) as panne:
        # Panne survenue AVANT l'ouverture de la ligne d'exécution — typiquement
        # la base injoignable au moment de lire la dernière réussite. Rien à
        # refermer, mais on sort proprement au lieu d'une trace Python brute.
        _journal.error("Démarrage impossible : %s", panne)
        return 1


if __name__ == "__main__":
    sys.exit(main())
