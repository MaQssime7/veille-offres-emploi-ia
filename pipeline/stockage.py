"""L'archiviste : le seul module qui écrit dans Supabase.

Il passe par l'**API REST** (PostgREST) en HTTPS, avec la clé secrète — pas par
une connexion PostgreSQL directe. Raison : ce code tournera chez GitHub, donc il
faut lui confier des secrets, et l'accès direct réclamerait EN PLUS le mot de
passe de la base, celui qui sert à modifier le schéma. Un secret de moins en
circulation.

⚠️ **Aucune erreur d'écriture n'est journalisée en entier.** Quand Postgres
refuse une ligne, PostgREST recopie souvent la ligne fautive dans le champ
`details` de son erreur — et le journal de GitHub Actions est PUBLIC sur ce
dépôt. On ne garde que le code et le message court.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import requests

from pipeline.config import (
    AGE_EXECUTION_ORPHELINE_HEURES,
    DELAI_CONNEXION,
    DELAI_LECTURE,
)

_journal = logging.getLogger(__name__)

# Assez petit pour que la charge utile reste raisonnable (une archive
# `charge_brute` pèse plusieurs kilo-octets), assez grand pour ne pas multiplier
# les allers-retours.
TAILLE_LOT = 50


class ErreurStockage(RuntimeError):
    """Toute panne imputable à la base. Jamais avalée silencieusement."""


class Stockage:
    """Entre : des lignes prêtes. Sort : des identifiants écrits, et des compteurs.

    Casse : lève ErreurStockage avec le code Postgres, jamais le contenu de la
    ligne refusée.
    """

    def __init__(self, url_supabase: str, cle_secrete: str) -> None:
        self._base = f"{url_supabase.rstrip('/')}/rest/v1"
        self._session = requests.Session()
        self._session.headers.update({
            "apikey": cle_secrete,
            "Authorization": f"Bearer {cle_secrete}",
            "Content-Type": "application/json",
        })

    # ------------------------------------------------------------- interne

    def _requete(self, methode: str, chemin: str, *, operation: str, **kwargs: Any) -> Any:
        try:
            reponse = self._session.request(
                methode, f"{self._base}{chemin}",
                timeout=(DELAI_CONNEXION, DELAI_LECTURE), **kwargs,
            )
        except requests.RequestException as echec:
            raise ErreurStockage(f"{operation} : base injoignable ({echec})") from echec

        if reponse.status_code >= 400:
            raise ErreurStockage(f"{operation} : {_erreur_assainie(reponse)}")

        if not reponse.content:
            return None
        try:
            return reponse.json()
        except ValueError:
            return None

    # ------------------------------------------------------- exécutions

    def refermer_executions_orphelines(self) -> int:
        """Referme en `echec` les exécutions ANCIENNES restées `en_cours`.

        Une ligne restée `en_cours` est une exécution tuée net — plantage,
        annulation, coupure de GitHub Actions. Personne ne viendra la refermer :
        c'est le démarrage suivant qui le fait.

        ⚠️ **Le seuil d'ancienneté n'est pas une précaution, il est nécessaire.**
        Sans lui, un lancement manuel pendant que le cron tourne déclarerait
        `echec` une exécution bien vivante, avec un motif mensonger — et
        `derniere_execution_reussie()`, qui borne la fenêtre de collecte,
        repartirait d'une exécution qui n'avait rien écrit.

        ⚠️ À appeler AVANT d'ouvrir la sienne — le seuil la protégerait de toute
        façon, mais l'ordre reste le bon.
        """
        # ⚠️ Format « Z », pas `isoformat()` : le `+` de `+00:00` est interprété
        # comme une espace dans une chaîne de requête, et Postgres refuse la
        # date. Bug trouvé en exécutant, invisible à la relecture.
        limite = (datetime.now(timezone.utc) - timedelta(hours=AGE_EXECUTION_ORPHELINE_HEURES)
                  ).strftime("%Y-%m-%dT%H:%M:%SZ")
        refermees = self._requete(
            "PATCH",
            f"/executions_veille?issue=eq.en_cours&demarree_a=lt.{limite}&select=id",
            operation="fermeture des exécutions orphelines",
            headers={"Prefer": "return=representation"},
            json={
                "issue": "echec",
                "motif_echec": (
                    f"Exécution interrompue : restée en_cours plus de "
                    f"{AGE_EXECUTION_ORPHELINE_HEURES} h, refermée au démarrage suivant."
                ),
                "terminee_a": _maintenant(),
            },
        ) or []
        if refermees:
            _journal.warning(
                "%d exécution(s) restée(s) en_cours depuis plus de %d h refermée(s) en echec.",
                len(refermees), AGE_EXECUTION_ORPHELINE_HEURES,
            )
        return len(refermees)

    def ouvrir_execution(self, etape: str = "collecte") -> int:
        """Écrit la ligne d'exécution AU DÉMARRAGE et rend son identifiant.

        Écrire à la fin imposerait de garder toutes les offres en mémoire (la
        clé étrangère exige que l'exécution existe avant la première offre), et
        surtout : un plantage ne laisserait aucune trace, rendant la panne
        indistinguable d'une nuit calme.

        `etape` vaut `collecte` ou `notation` — la base refuse tout le reste.
        Elle sépare deux passages qui n'ont pas la même conséquence : seule une
        collecte réussie déplace la fenêtre de la nuit suivante.
        """
        cree = self._requete(
            "POST", "/executions_veille?select=id",
            operation=f"ouverture de l'exécution ({etape})",
            headers={"Prefer": "return=representation"},
            json={"issue": "en_cours", "etape": etape},
        )
        if not cree:
            raise ErreurStockage("ouverture de l'exécution : aucune ligne rendue.")
        identifiant = cree[0]["id"]
        _journal.info("Exécution #%d ouverte.", identifiant)
        return identifiant

    def fermer_execution(
        self, execution_id: int, *, issue: str,
        offres_recues: int | None = None, offres_nouvelles: int | None = None,
        offres_rejetees: int | None = None, motif_echec: str | None = None,
    ) -> None:
        """Complète la ligne d'exécution. `echec` exige toujours un motif.

        ⚠️ On VÉRIFIE qu'une ligne a bien été modifiée. Un PATCH PostgREST qui
        ne correspond à aucune ligne renvoie 204 — un succès apparent. Sans ce
        contrôle, un identifiant erroné laisserait le job GitHub Actions au vert
        alors qu'aucune trace n'existe.
        """
        if issue == "echec" and not motif_echec:
            # La base refuserait de toute façon (contrainte echec_toujours_motive).
            # On échoue ici avec un message lisible plutôt que sur une 400 opaque.
            raise ErreurStockage("fermeture en echec sans motif : interdit.")

        modifiees = self._requete(
            "PATCH", f"/executions_veille?id=eq.{execution_id}&select=id",
            operation=f"fermeture de l'exécution #{execution_id}",
            headers={"Prefer": "return=representation"},
            json={
                "issue": issue,
                "terminee_a": _maintenant(),
                "offres_recues": offres_recues,
                "offres_nouvelles": offres_nouvelles,
                "offres_rejetees": offres_rejetees,
                "motif_echec": _tronquer(motif_echec),
            },
        ) or []
        if not modifiees:
            raise ErreurStockage(
                f"fermeture de l'exécution #{execution_id} : aucune ligne modifiée. "
                f"La ligne n'existe plus — la trace de cette exécution est perdue."
            )
        _journal.info(
            "Exécution #%d fermée : %s (%s distinctes reçues, %s nouvelles, %s rejetées).",
            execution_id, issue, offres_recues, offres_nouvelles, offres_rejetees,
        )

    def derniere_execution_reussie(self) -> datetime | None:
        """Date de démarrage de la dernière **collecte** `reussite`, ou None.

        C'est elle qui borne la fenêtre de collecte : on repart de là, avec une
        heure de recouvrement. Un `en_cours` ne compte JAMAIS comme une réussite.

        ⚠️ **Le filtre `etape=collecte` est la partie qui compte.** Depuis la
        phase 2, la notation écrit ses propres lignes dans cette table. Sans ce
        filtre, une notation réussie à 14 h ferait repartir la collecte de la
        nuit suivante de 14 h au lieu de la veille : les offres publiées entre
        les deux seraient **perdues, sans la moindre erreur** — ni exception, ni
        job rouge, juste des offres qui n'existent jamais.
        """
        lignes = self._requete(
            "GET",
            "/executions_veille?etape=eq.collecte&issue=eq.reussite&select=demarree_a"
            "&order=demarree_a.desc&limit=1",
            operation="lecture de la dernière exécution réussie",
        ) or []
        if not lignes:
            return None
        return datetime.fromisoformat(lignes[0]["demarree_a"].replace("Z", "+00:00"))


    def recoller_offres_orphelines(self, execution_id: int) -> int:
        """Rattache à `execution_id` les offres restées liées à une exécution en échec.

        **Pourquoi c'est nécessaire.** L'écriture par lots n'est pas atomique :
        si le lot 3 échoue, les lots 1 et 2 sont déjà écrits et pointent vers une
        exécution qui sera marquée `echec`. Or « Nouveau » se définit par
        l'appartenance à la dernière exécution *réussie* — ces offres
        n'apparaîtraient donc sur aucun écran du matin, et la nuit suivante ne
        les réécrirait pas (`on conflict do nothing` les laisse telles quelles).
        Elles resteraient invisibles pour toujours.

        Le recollage les fait apparaître le lendemain, avec un jour de retard.

        ⚠️ **Contrepartie assumée** : on réécrit l'histoire. L'offre a été
        *trouvée* par l'exécution ratée, on note qu'elle l'a été par celle-ci.
        Le lien ne sert pas à établir la chronologie, il sert à décider ce qui
        s'affiche le matin — et une offre jamais annoncée mérite de l'être une
        fois. L'archive `charge_brute` garde la réponse d'origine.

        Idempotent : une fois recollées, ces offres pointent vers une exécution
        réussie et ne sont plus jamais reprises.
        """
        # `etape=collecte` : seule une collecte peut laisser des offres orphelines.
        # Sans le filtre, la liste d'identifiants gonflerait à chaque notation
        # ratée pour rien — et finirait par produire une URL trop longue.
        echouees = self._requete(
            "GET", "/executions_veille?etape=eq.collecte&issue=eq.echec&select=id",
            operation="lecture des collectes en échec",
        ) or []
        if not echouees:
            return 0

        identifiants = ",".join(str(e["id"]) for e in echouees)
        recollees = self._requete(
            "PATCH", f"/offres?execution_id=in.({identifiants})&select=identifiant",
            operation="recollage des offres orphelines",
            headers={"Prefer": "return=representation"},
            json={"execution_id": execution_id},
        ) or []

        if recollees:
            _journal.warning(
                "%d offre(s) écrite(s) lors d'une exécution en échec recollée(s) à "
                "l'exécution #%d : elles apparaîtront sur le compte rendu de ce matin, "
                "avec un jour de retard.", len(recollees), execution_id,
            )
        return len(recollees)

    # ------------------------------------------------------------- offres

    def inserer_offres(self, lignes: list[dict[str, Any]]) -> int:
        """Écrit les offres et rend le nombre de NOUVELLES lignes.

        La déduplication est faite par le moteur : `resolution=ignore-duplicates`
        se traduit en `on conflict do nothing` sur la clé primaire. Une offre
        déjà collectée hier n'est pas réécrite, et garde le lien vers
        l'exécution qui l'a vue en premier — c'est ce lien qui définit
        « Nouveau » côté interface.

        `select=identifiant` limite la réponse aux identifiants : sans lui,
        PostgREST renverrait chaque archive `charge_brute` en écho.

        ⚠️ **L'écriture par lots n'est PAS atomique.** Si le lot 3 échoue, les
        lots 1 et 2 sont déjà validés et resteront rattachés à une exécution
        qu'on va marquer `echec`. Faute de transaction accessible par l'API
        REST, on fait remonter le compte partiel dans le message : sans lui, ces
        offres seraient invisibles — jamais « nouvelles » sur aucun écran, et
        `offres_nouvelles` resterait vide.
        """
        if not lignes:
            return 0

        nouvelles = 0
        for depart in range(0, len(lignes), TAILLE_LOT):
            lot = lignes[depart:depart + TAILLE_LOT]
            try:
                ecrites = self._requete(
                    "POST", "/offres?select=identifiant",
                    operation=f"insertion des offres {depart + 1}-{depart + len(lot)}",
                    headers={"Prefer": "resolution=ignore-duplicates,return=representation"},
                    json=lot,
                ) or []
            except ErreurStockage as echec:
                raise ErreurStockage(
                    f"{echec} — ⚠️ {nouvelles} offre(s) DÉJÀ ÉCRITE(S) avant cet échec, "
                    f"rattachée(s) à cette exécution."
                ) from echec
            nouvelles += len(ecrites)

        _journal.info(
            "%d offre(s) présentée(s), %d nouvelle(s) écrite(s).", len(lignes), nouvelles
        )
        return nouvelles


def _maintenant() -> str:
    """L'heure de FIN, prise par le serveur — jamais par la machine locale.

    ⚠️ `demarree_a` a pour valeur par défaut le `now()` de Postgres, donc
    l'horloge du serveur. Poser `terminee_a` avec l'horloge locale compare deux
    horloges différentes : mesuré le 21 août, cette machine est **186 ms
    derrière** le serveur Supabase. Toute exécution bouclée en moins de 186 ms —
    une nuit sans nouvelles offres — voyait sa fin précéder son début et se
    faisait refuser par la contrainte `terminee_apres_demarree`.

    La chaîne `'now'` est une valeur spéciale que Postgres résout lui-même à
    l'heure de la transaction. Les deux horodatages viennent alors de la même
    horloge, et l'ordre est garanti par construction.
    """
    return "now"


def _tronquer(texte: str | None, limite: int = 500) -> str | None:
    if texte is None:
        return None
    return texte if len(texte) <= limite else texte[:limite] + " […]"


def _erreur_assainie(reponse: requests.Response) -> str:
    """Extrait le code et le message d'une erreur PostgREST, et RIEN d'autre.

    Les champs `details` et `hint` contiennent régulièrement la ligne refusée,
    donc potentiellement `contact_nom` — une donnée personnelle. Le journal de
    GitHub Actions est public sur ce dépôt : elle y serait lisible par tous.

    ⚠️ Le corps n'est pas toujours un objet JSON. Une passerelle en panne peut
    rendre une liste ou une chaîne, et un `.get` dessus lèverait une
    AttributeError DEPUIS le gestionnaire d'erreur — masquant complètement la
    panne d'origine.
    """
    try:
        charge = reponse.json()
    except ValueError:
        return f"HTTP {reponse.status_code}"

    if not isinstance(charge, dict):
        return f"HTTP {reponse.status_code} (réponse non structurée)"

    code = charge.get("code") or "sans code"
    message = _tronquer(charge.get("message") or "", 200)
    return f"HTTP {reponse.status_code} [{code}] {message}"
