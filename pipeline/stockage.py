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
import random
from dataclasses import dataclass
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


@dataclass(frozen=True)
class ConsommationTokens:
    """Compteurs bruts d'un ou plusieurs appels au modèle. Jamais des euros.

    Les quatre compteurs sont distincts parce qu'ils ne coûtent pas la même
    chose : une lecture de cache vaut environ un dixième d'un token d'entrée
    plein, et une écriture de cache environ 1,25 fois. Les agréger en un seul
    nombre rendrait impossible de vérifier que le cache mord — le seul contrôle
    qui distingue « le cache fonctionne » de « on repaie le préfixe à chaque
    offre ».
    """

    entree: int = 0
    sortie: int = 0
    cache_ecriture: int = 0
    cache_lecture: int = 0

    def __add__(self, autre: "ConsommationTokens") -> "ConsommationTokens":
        return ConsommationTokens(
            entree=self.entree + autre.entree,
            sortie=self.sortie + autre.sortie,
            cache_ecriture=self.cache_ecriture + autre.cache_ecriture,
            cache_lecture=self.cache_lecture + autre.cache_lecture,
        )

    @property
    def total(self) -> int:
        """Ce qui s'ajoute au compteur `tokens_cumules` d'une offre."""
        return self.entree + self.sortie + self.cache_ecriture + self.cache_lecture


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
        offres_notees: int | None = None, modele: str | None = None,
        tokens: "ConsommationTokens | None" = None,
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
                "offres_notees": offres_notees,
                "modele": modele,
                # Compteurs BRUTS. La conversion en euros se fait à l'affichage,
                # contre une grille tarifaire versionnée : les tarifs changent
                # (Sonnet 5 est en tarif d'introduction jusqu'au 31 août 2026),
                # un historique en euros deviendrait faux sans prévenir.
                "tokens_entree": tokens.entree if tokens else None,
                "tokens_sortie": tokens.sortie if tokens else None,
                "tokens_cache_ecriture": tokens.cache_ecriture if tokens else None,
                "tokens_cache_lecture": tokens.cache_lecture if tokens else None,
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

    # ---------------------------------------------------------- notation

    # Les colonnes envoyées au modèle. `charge_brute` en est délibérément
    # absente : c'est une archive, jamais une valeur de travail — et la tirer
    # ici multiplierait par trois le nombre de tokens facturés par offre.
    CHAMPS_A_NOTER = (
        "identifiant,intitule,entreprise_nom,lieu_libelle,type_contrat_libelle,"
        "nature_contrat,experience_libelle,description,competences,salaire_libelle,"
        "rome_libelle,appellation_libelle,secteur_activite_libelle,"
        "qualification_libelle,alternance,tokens_cumules,notation_tentatives"
    )

    def offres_a_noter(
        self, limite: int | None = None, *, max_tentatives: int = 3,
        renoter: bool = False, rome: str | None = None, au_hasard: bool = False,
    ) -> list[dict[str, Any]]:
        """Les offres pas encore notées, les plus récentes d'abord.

        ⚠️ **`note_interet=is.null` est ce qui rend la notation incrémentale.**
        Une offre déjà notée n'est jamais reprise, même si l'annonce a changé à
        la source : renoter en boucle coûterait à chaque passage sans rien
        apprendre.

        `renoter=True` inverse ce filtre — c'est le mode d'étalonnage, et il ne
        s'active jamais tout seul. Il sert à mesurer l'effet d'une correction
        des critères sur les mêmes offres : sans lui, un réglage ne peut se
        juger que sur des annonces différentes, donc pas se juger du tout.

        ⚠️ **Le filtre sur `notation_tentatives` est un garde-fou de
        facturation.** Une offre qui fait systématiquement échouer l'appel —
        description pathologique, refus du modèle — serait autrement retentée
        chaque nuit, indéfiniment, et chaque tentative est payante. Au-delà de
        `max_tentatives`, elle sort de la file et attend une intervention.
        """
        if renoter:
            # Mode étalonnage : reprendre les offres DÉJÀ notées, les plus
            # récemment notées d'abord, pour comparer un avant et un après sur
            # les mêmes annonces. Le plafond de tentatives ne s'applique pas —
            # ici c'est un humain qui décide de repayer, pas une boucle.
            filtres = (
                f"/offres?note_interet=not.is.null"
                f"&select={self.CHAMPS_A_NOTER}"
                f"&order=notee_a.desc"
            )
        else:
            filtres = (
                f"/offres?note_interet=is.null"
                f"&notation_tentatives=lt.{max_tentatives}"
                f"&select={self.CHAMPS_A_NOTER}"
                f"&order=publiee_a.desc"
            )
        if rome is not None:
            filtres += f"&rome_code=eq.{rome}"

        if au_hasard and limite is not None:
            # ⚠️ Tirer les N plus récentes n'est PAS un échantillon : une seule
            # journée de collecte peut être atypique, et une mesure faite dessus
            # ne dit rien du gisement. On lit donc tous les identifiants
            # éligibles, on en tire N au hasard, puis on relit ces N lignes.
            # Deux requêtes plutôt qu'une, mais une mesure au lieu d'une
            # impression.
            candidats = self._requete(
                "GET", filtres.replace(f"&select={self.CHAMPS_A_NOTER}", "&select=identifiant"),
                operation="tirage de l'échantillon à noter",
            ) or []
            if not candidats:
                return []
            tires = random.sample(
                [c["identifiant"] for c in candidats], min(limite, len(candidats))
            )
            _journal.info(
                "Échantillon tiré au hasard : %d offre(s) sur %d éligibles — %s",
                len(tires), len(candidats), ", ".join(tires),
            )
            liste = ",".join(tires)
            return self._requete(
                "GET", f"/offres?identifiant=in.({liste})&select={self.CHAMPS_A_NOTER}",
                operation="lecture de l'échantillon tiré",
            ) or []

        if limite is not None:
            filtres += f"&limit={limite}"
        return self._requete(
            "GET", filtres, operation="lecture des offres à noter"
        ) or []

    def compter_offres_a_noter(self, *, max_tentatives: int = 3) -> int:
        """Combien d'offres attendent une note. Sert à annoncer la dépense avant
        de la faire.

        On ramène les identifiants et on les compte, plutôt que d'ajouter un
        chemin HTTP parallèle pour lire un en-tête `Content-Range`. À la
        volumétrie de ce projet — 373 offres aujourd'hui, quelques milliers d'ici
        la fin de l'année — c'est quelques kilo-octets. Un second chemin de
        requête, lui, se paierait à chaque relecture du code.
        """
        lignes = self._requete(
            "GET",
            f"/offres?note_interet=is.null"
            f"&notation_tentatives=lt.{max_tentatives}&select=identifiant",
            operation="comptage des offres à noter",
        ) or []
        return len(lignes)

    def enregistrer_notation(
        self, offre: dict[str, Any], *, notation: dict[str, Any],
        execution_id: int, modele: str, tokens: ConsommationTokens,
    ) -> None:
        """Écrit les notes d'une offre et sa consommation.

        `offre` est la ligne lue par `offres_a_noter()` : on s'en sert pour
        **incrémenter** les compteurs plutôt que de les écraser. L'API REST ne
        sait pas faire `colonne = colonne + n` ; sans la valeur d'avant, une
        renotation remettrait `tokens_cumules` à la consommation du dernier
        appel et l'écran de suivi d'exploitation compterait faux.
        """
        identifiant = offre["identifiant"]
        modifiees = self._requete(
            "PATCH", f"/offres?identifiant=eq.{identifiant}&select=identifiant",
            operation=f"enregistrement de la notation de {identifiant}",
            headers={"Prefer": "return=representation"},
            json={
                **notation,
                "notee_a": _maintenant(),
                "notation_execution_id": execution_id,
                "notation_modele": modele,
                "notation_motif_echec": None,
                "notation_tentatives": (offre.get("notation_tentatives") or 0) + 1,
                "tokens_cumules": (offre.get("tokens_cumules") or 0) + tokens.total,
            },
        ) or []
        if not modifiees:
            raise ErreurStockage(
                f"notation de {identifiant} : aucune ligne modifiée. "
                f"L'offre a disparu entre la lecture et l'écriture."
            )

    def enregistrer_echec_notation(
        self, offre: dict[str, Any], *, motif: str, execution_id: int, modele: str
    ) -> None:
        """Trace l'échec sans perdre l'offre : elle reste sans note, à reprendre.

        On incrémente quand même le compteur de tentatives — c'est lui qui
        empêchera la boucle de facturation si l'échec est permanent.
        """
        identifiant = offre["identifiant"]
        self._requete(
            "PATCH", f"/offres?identifiant=eq.{identifiant}&select=identifiant",
            operation=f"trace de l'échec de notation de {identifiant}",
            headers={"Prefer": "return=representation"},
            json={
                "notation_motif_echec": _tronquer(motif),
                "notation_execution_id": execution_id,
                "notation_modele": modele,
                "notation_tentatives": (offre.get("notation_tentatives") or 0) + 1,
            },
        )
        _journal.warning("Notation de %s en échec : %s", identifiant, motif)


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
