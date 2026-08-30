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

from pipeline import config as configuration
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
        tokens: "ConsommationTokens | None" = None, etape: str = "collecte",
    ) -> None:
        """Complète la ligne d'exécution. `echec` exige toujours un motif.

        ⚠️ **`etape` est passée, pas devinée.** La première version du compte
        rendu de fermeture inférait l'étape de « quel compteur est renseigné » :
        `offres_notees is not None` voulait dire notation, sinon collecte. Ça
        marchait sur les chemins de réussite et échouait précisément là où on a
        besoin de savoir — un échec survenu avant tout comptage laisse **tous**
        les compteurs à `None`, donc une collecte plantée et une notation
        plantée produisaient la même ligne de journal, indistinguables. Or
        `ouvrir_execution` connaît déjà l'étape : elle n'avait qu'à voyager.

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
        # Le compte rendu suit l'étape : une notation n'a ni offres reçues ni
        # rejets, et l'annoncer « None distinctes reçues, None nouvelles » — ce
        # qu'affichait la version précédente — donne l'air d'un compteur cassé
        # là où il n'y a simplement rien à compter. Constaté sur l'exécution #51.
        if etape == "notation":
            detail = (f"{offres_notees} offre(s) notée(s)" if offres_notees is not None
                      else "aucune offre notée")
        elif offres_recues is not None:
            detail = (f"{offres_recues} distincte(s) reçue(s), {offres_nouvelles} "
                      f"nouvelle(s), {offres_rejetees} rejetée(s)")
        else:
            detail = "aucun compteur"
        _journal.info("Exécution #%d (%s) fermée : %s (%s).",
                      execution_id, etape, issue, detail)

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


    def derniere_collecte_reussie_id(self) -> int | None:
        """L'IDENTIFIANT de la dernière collecte `reussite`, ou None s'il n'y en a pas.

        Jumelle de `derniere_execution_reussie()`, qui rend la *date* pour borner
        la fenêtre de collecte. Ici c'est l'identifiant qu'on veut, parce qu'il
        sert à autre chose : restreindre la notation aux offres que cette
        collecte-là vient de trouver.

        ⚠️ **Même filtre `etape=collecte`, même raison, et elle est ici encore
        plus vicieuse.** Sans lui, cette méthode renverrait l'identifiant de la
        dernière *notation* réussie — et `offres_a_noter(collecte=<id>)`
        chercherait alors les offres rattachées à une exécution qui n'a jamais
        collecté quoi que ce soit. Résultat : **zéro offre à noter, chaque nuit,
        sans la moindre erreur**. Le job serait vert, la base ne bougerait pas,
        et personne ne verrait rien avant des semaines.

        ⚠️ **Pourquoi passer par la base plutôt que se faire transmettre
        l'identifiant par l'étape précédente.** Le workflow GitHub pourrait faire
        remonter l'identifiant de la collecte en sortie de job et le passer à la
        notation. On ne le fait pas : ce serait coupler les deux étapes par un
        canal qui n'existe que dans GitHub Actions, donc casser le lancement à la
        main et la reprise d'un job. La base est déjà la source de vérité
        commune ; le producteur y dépose, le consommateur y lit. Les deux étapes
        restent lançables séparément, dans n'importe quel ordre, depuis
        n'importe où.
        """
        lignes = self._requete(
            "GET",
            "/executions_veille?etape=eq.collecte&issue=eq.reussite&select=id"
            "&order=demarree_a.desc&limit=1",
            operation="lecture de la dernière collecte réussie",
        ) or []
        return lignes[0]["id"] if lignes else None


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
        collecte: int | None = None,
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
        # ⚠️ **Le filtre de contrat s'applique AUSSI ici, et pas seulement à la
        # collecte.** Depuis le 28 août la collecte ne ramène que des CDI, mais
        # les 82 offres non-CDI arrivées AVANT ce jour-là sont toujours en base
        # et toujours sans note : sans cette ligne, un `--limite 100` lancé à la
        # main les paierait — ~50 centimes pour des offres que le filtre existe
        # précisément pour écarter. Le cron nocturne était protégé par
        # `--derniere-collecte`, les lancements manuels ne l'étaient pas.
        #
        # ⚠️ Volontairement basé sur la MÊME constante que la collecte : deux
        # réglages séparés divergeraient, et on repaierait un jour ce qu'on
        # croit exclure. Mettre `TYPE_CONTRAT` à `None` rouvre les deux
        # ensemble, ce qui est le comportement attendu.
        if configuration.TYPE_CONTRAT:
            valeurs = ",".join(configuration.TYPE_CONTRAT.split(","))
            filtres += f"&type_contrat=in.({valeurs})"
        if rome is not None:
            filtres += f"&rome_code=eq.{rome}"
        if collecte is not None:
            # Restreint aux offres trouvées par UNE exécution de collecte —
            # c'est ce qui permet de mesurer l'effet d'un changement de critères
            # sans le diluer dans tout l'historique déjà en base.
            filtres += f"&execution_id=eq.{collecte}"

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

    # ------------------------------------------- rattrapage de l'employeur

    def offres_sans_employeur(
        self, *, note_minimale: int, limite: int | None = None,
    ) -> list[dict[str, Any]]:
        """Les offres déjà notées dont l'employeur n'a jamais été identifié.

        Sert au seul mode `--completer-entreprise` : les 146 offres notées avant
        le 30 août 2026 ne repasseront **jamais** par la notation, qui est
        incrémentale (`note_interet=is.null`). Sans ce chemin de lecture, leur
        fiche afficherait indéfiniment le nom brut de France Travail — absent 4
        fois sur 10, et parfois faux.

        ⚠️ **Trois filtres, et chacun borne la dépense.** `note_interet` au-delà
        du seuil et `statut='a_traiter'` restreignent aux offres que Maxime voit
        réellement à l'écran — 18 offres au 30 août, contre 146 notées et 580 en
        base.

        ⚠️ **Le troisième filtre porte sur `entreprise_intermediaire`, PAS sur
        `entreprise_identifiee`, et c'est ce qui rend la commande réellement
        rejouable.** Le défaut a été relevé en revue le 30 août 2026, sur la
        première version qui filtrait sur le nom : quand le modèle répond `null`
        — ce que le module qualifie lui-même de « cas fréquent », et qui est
        arrivé sur **3 des 18 premières offres** — ou quand `verifier()` rejette
        une invention, la colonne du nom reste `NULL`. L'offre ressortait donc à
        chaque lancement et **était refacturée à chaque fois**, `tokens_cumules`
        gonflant à mesure, alors que la docstring promettait le contraire.

        Le drapeau, lui, est écrit à **chaque tentative exploitée**, y compris
        quand aucun nom n'est trouvé : il enregistre « cette offre a été
        regardée », qui est très exactement la question posée ici. Une offre
        dont l'appel a échoué reste à `NULL` sur les deux colonnes et sera bien
        reprise — ce qui est le comportement voulu.
        """
        filtres = (
            f"/offres?entreprise_intermediaire=is.null"
            f"&note_interet=gte.{int(note_minimale)}"
            f"&statut=eq.a_traiter"
            f"&select={self.CHAMPS_A_NOTER}"
            f"&order=note_interet.desc"
        )
        if limite is not None:
            filtres += f"&limit={int(limite)}"
        return self._requete(
            "GET", filtres, operation="lecture des offres sans employeur identifié",
        ) or []

    def enregistrer_employeur(
        self, offre: dict[str, Any], *, resultat: dict[str, Any], tokens: ConsommationTokens,
    ) -> None:
        """Écrit les deux colonnes d'employeur, et **rien d'autre**.

        ⚠️ **Ce PATCH ne touche jamais aux notes, ni à `notee_a`, ni à
        `notation_execution_id`.** C'est toute la raison d'être du mode : le
        rattrapage ne doit pas rejouer une notation. Le faire renverrait des
        notes différentes de celles déjà affichées — on a mesuré le 30 août
        que deux annonces jumelles peuvent être notées 68 et 45 — et Maxime
        verrait ses classements bouger sans avoir rien demandé.

        ⚠️ **Aucune ligne dans `executions_veille`.** La contrainte `etape_connue`
        n'admet que `collecte` et `notation` ; ce rattrapage n'est ni l'un ni
        l'autre, et l'inscrire en `notation` gonflerait `offres_notees` de l'écran
        de suivi avec des offres qu'il n'a pas notées. La trace de la dépense va
        là où elle appartient : `tokens_cumules`, par offre. Le jour où cette
        opération devient récurrente, elle mérite sa propre valeur d'`etape` —
        donc une migration, pas une approximation.
        """
        identifiant = offre["identifiant"]
        modifiees = self._requete(
            "PATCH", f"/offres?identifiant=eq.{identifiant}&select=identifiant",
            operation=f"enregistrement de l'employeur de {identifiant}",
            headers={"Prefer": "return=representation"},
            json={
                **resultat,
                "tokens_cumules": (offre.get("tokens_cumules") or 0) + tokens.total,
            },
        ) or []
        if not modifiees:
            raise ErreurStockage(
                f"employeur de {identifiant} : aucune ligne modifiée. "
                f"L'offre a disparu entre la lecture et l'écriture."
            )

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


    # ---------------------------------------------------- enrichissements

    def demarrer_enrichissement(self, enrichissement_id: int) -> bool:
        """Passe la tentative en `en_cours` — mais SEULEMENT si elle est encore en vol.

        Entre : l'identifiant de la tentative, reçu par l'entrée du workflow.
        Sort : True si l'agent a le droit de travailler, False sinon.
        Casse : lève ErreurStockage si la base est injoignable.

        ⚠️ **Le filtre sur `issue` n'est pas décoratif, c'est ce qui empêche
        d'écrire sur une tentative déjà refermée.** L'interface referme en
        `echec` toute demande de plus de dix minutes, et un runner GitHub alloué
        tardivement démarrerait sur une ligne morte : il écrirait alors des
        étapes sous une conclusion d'échec, et l'écran afficherait un
        enrichissement qui progresse *après* avoir annoncé qu'il avait renoncé.

        ⚠️ **Le test et l'écriture sont la MÊME requête.** Lire l'issue puis
        écrire laisserait entre les deux la fenêtre exacte pendant laquelle
        l'interface referme. C'est PostgREST qui tranche, en une opération.
        """
        modifiees = self._requete(
            "PATCH",
            f"/enrichissements?id=eq.{enrichissement_id}"
            "&issue=in.(demande,en_cours)&select=id",
            operation=f"démarrage de l'enrichissement {enrichissement_id}",
            headers={"Prefer": "return=representation"},
            json={"issue": "en_cours", "demarre_a": _maintenant()},
        ) or []
        return bool(modifiees)

    def ecrire_etape(self, enrichissement_id: int, rang: int, libelle: str) -> None:
        """Ajoute une étape à afficher.

        ⚠️ **Le libellé est BORNÉ ici, pas seulement par la contrainte.** La base
        refuse au-delà de 200 caractères ; laisser l'erreur remonter ferait
        échouer tout l'enrichissement parce qu'une phrase est trop longue. On
        coupe, l'étape s'affiche, le travail continue.

        ⚠️ **Rien de ce que l'agent produit ne va dans `print()`.** Les journaux
        de ce dépôt public sont publics : une étape peut citer un nom
        d'entreprise, demain davantage. Les étapes vont en base, à l'écran de
        Maxime, et nulle part ailleurs.
        """
        self._requete(
            "POST", "/etapes_enrichissement",
            operation=f"écriture de l'étape {rang} de {enrichissement_id}",
            headers={"Prefer": "return=minimal"},
            json={
                "enrichissement_id": enrichissement_id,
                "rang": rang,
                "libelle": (libelle or "…")[:200],
            },
        )

    def ecrire_rubriques(
        self, enrichissement_id: int, rubriques: list[dict[str, Any]],
    ) -> int:
        """Écrit les rubriques RÉDIGÉES de la fiche, une ligne chacune.

        Entre : la liste rendue par l'agent, déjà validée par l'outil.
        Sort : le nombre de rubriques écrites.
        Casse : lève ErreurStockage si la base refuse.

        ⚠️ **Une rubrique vide ne s'écrit PAS, elle s'omet.** C'est la règle du
        schéma, et elle a une conséquence qu'on perd de vue : « non disponible »
        ne s'écrit jamais en base. Écrire cette chaîne rendrait impossible de
        distinguer une information manquante d'une information dont le contenu
        est « non disponible » — et de compter ce que l'agent trouve vraiment.
        C'est l'affichage qui rend l'absence en toutes lettres.

        ⚠️ **La troncature est ici, pas seulement dans la contrainte.** La base
        refuse au-delà de 4 000 caractères ; laisser l'erreur remonter ferait
        perdre TOUTE la fiche parce qu'une rubrique est bavarde. Même
        raisonnement que pour les libellés d'étape : on coupe, la fiche
        s'affiche, le reste survit.

        ⚠️ **Un seul appel pour toutes les rubriques**, et c'est délibéré : elles
        partent alors dans la même requête, donc la même transaction. Une boucle
        d'appels laisserait une fiche à moitié écrite si le réseau tombait au
        milieu — la moitié d'une fiche est pire que pas de fiche, parce qu'elle
        ressemble à une fiche complète dont l'entreprise n'aurait rien à dire.
        """
        lignes = []
        for rang, rubrique in enumerate(rubriques):
            valeur = (rubrique.get("valeur") or "").strip()
            if not valeur:
                continue
            lignes.append({
                "enrichissement_id": enrichissement_id,
                "rubrique": rubrique["rubrique"],
                "valeur": valeur[:4000],
                "marqueur": rubrique.get("marqueur") or "deduit",
                "rang": rubrique.get("rang", rang),
            })
        if not lignes:
            return 0
        self._requete(
            "POST", "/rubriques_enrichissement",
            operation=f"écriture des rubriques de {enrichissement_id}",
            headers={"Prefer": "return=minimal"},
            json=lignes,
        )
        return len(lignes)

    def supprimer_rubriques(self, enrichissement_id: int) -> None:
        """Retire les rubriques d'une tentative dont la conclusion n'a pas pris.

        ⚠️ **Elle répare une course, pas une faute de frappe.** Les rubriques
        s'écrivent AVANT la conclusion, pour qu'aucun sondage ne puisse voir une
        fiche annoncée terminée et vide. Mais entre les deux, l'interface peut
        avoir refermé la tentative pour péremption : le `PATCH` de conclusion ne
        touche alors aucune ligne, et les rubriques restent accrochées à un
        enrichissement en échec dont l'ancrage est vide. Elles ne s'afficheraient
        pas — l'écran ne lit que les tentatives réussies — mais elles
        fausseraient tout décompte de ce que l'agent produit vraiment.

        ⚠️ **Le filtre est obligatoire, comme pour tout `PATCH`.** Un `DELETE`
        sans filtre viderait la table entière sans que PostgREST bronche.
        """
        self._requete(
            "DELETE",
            f"/rubriques_enrichissement?enrichissement_id=eq.{enrichissement_id}",
            operation=f"retrait des rubriques de {enrichissement_id}",
            headers={"Prefer": "return=minimal"},
        )

    def conclure_enrichissement(
        self, enrichissement_id: int, *, issue: str,
        motif_echec: str | None = None, modele: str | None = None,
        tours: int | None = None, tokens: ConsommationTokens | None = None,
        fiche: dict[str, Any] | None = None,
    ) -> bool:
        """Ferme la tentative — réussite ou échec — avec sa trace complète.

        Entre : l'issue, et tout ce qui n'était pas connu au démarrage.
        Sort : True si la ligne a bien été fermée.
        Casse : lève ErreurStockage si la base refuse ou ne répond pas.

        ⚠️ **Même filtre `en vol` qu'au démarrage** : une tentative refermée par
        péremption ne doit pas être ressuscitée en `reussite` par un agent qui
        finit en retard. L'écran a déjà annoncé l'échec à Maxime.
        """
        valeurs: dict[str, Any] = {
            "issue": issue,
            "termine_a": _maintenant(),
            "motif_echec": _tronquer(motif_echec, 2000),
            "modele": modele,
            "tours": tours,
            # ⚠️ **NULL, jamais 0, quand la consommation est inconnue** — règle 3
            # du projet, et ici elle protège de l'argent. Trouvé en revue le
            # 30 août 2026 : écrire 0 sur le chemin d'échec faisait qu'un agent
            # ayant brûlé 120 000 tokens avant de planter comptait pour RIEN
            # dans l'enveloppe du jour. La seule borne de dépense du système
            # perdait silencieusement ses échecs les plus coûteux.
            # ⚠️ Corollaire pour 6.3 : l'agent doit transmettre ses compteurs
            # PARTIELS au moment de l'échec. Sans cela, cette colonne reste
            # honnêtement vide, et l'enveloppe honnêtement incomplète.
            "tokens_entree": tokens.entree if tokens else None,
            "tokens_sortie": tokens.sortie if tokens else None,
            "tokens_cache_lu": tokens.cache_lecture if tokens else None,
            "tokens_cache_ecrit": tokens.cache_ecriture if tokens else None,
            **(fiche or {}),
        }
        # ⚠️ `appariement_motif` est rédigé par le modèle et borné à 1000 par la
        # base. Il passe par `fiche`, donc il échappait à la troncature
        # ci-dessus : une phrase trop longue faisait refuser toute la
        # conclusion. Relevé en revue le 30 août 2026.
        if valeurs.get("appariement_motif"):
            valeurs["appariement_motif"] = _tronquer(valeurs["appariement_motif"], 1000)
        modifiees = self._requete(
            "PATCH",
            f"/enrichissements?id=eq.{enrichissement_id}"
            "&issue=in.(demande,en_cours)&select=id",
            operation=f"conclusion de l'enrichissement {enrichissement_id}",
            headers={"Prefer": "return=representation"},
            json=valeurs,
        ) or []
        return bool(modifiees)

    def offre_de_l_enrichissement(self, enrichissement_id: int) -> dict[str, Any] | None:
        """L'offre visée par cette tentative, avec ce qu'il faut pour l'enrichir.

        ⚠️ **L'identifiant d'offre est résolu PAR LA BASE, jamais par le canal
        GitHub.** L'entrée du workflow ne porte que le numéro de tentative :
        c'est ce qui garantit que l'agent travaille sur l'offre que l'interface a
        désignée, et non sur celle qu'un déclenchement forgé aurait nommée.

        ⚠️ **Liste de colonnes explicite** : `charge_brute` fait plusieurs
        kilo-octets par offre et n'est jamais lue pour travailler.

        ⚠️ **`entreprise_identifiee` compte plus que `entreprise_nom`**, et les
        deux sont lues parce qu'elles ne disent pas la même chose. La seconde
        vient de France Travail : absente sur 39 % des offres, intermédiaire
        dans 36 % des cas, parfois fausse. La première a été extraite du TEXTE
        par le modèle de notation puis vérifiée mécaniquement contre ce texte.
        `entreprise_intermediaire` dit laquelle des deux on regarde — c'est ce
        qui permet à l'agent de ne pas se rabattre sur le cabinet de
        recrutement, l'erreur la plus trompeuse qu'il puisse commettre.

        ⚠️ **`contact_nom` n'est PAS lu, et son absence est une décision.** Il
        est en base pour que Maxime puisse candidater, pas pour entrer dans le
        contexte d'un modèle : c'est une personne physique nommée, et rien dans
        l'identification d'une entreprise n'en a besoin.
        """
        lignes = self._requete(
            "GET",
            f"/enrichissements?id=eq.{enrichissement_id}"
            "&select=id,issue,offre_identifiant,"
            "offres(identifiant,intitule,entreprise_nom,entreprise_identifiee,"
            "entreprise_intermediaire,description,lieu_libelle)",
            operation=f"lecture de l'enrichissement {enrichissement_id}",
        ) or []
        return lignes[0] if lignes else None

    def ajouter_tokens_a_l_offre(self, identifiant: str, total: int) -> None:
        """Ajoute la consommation de cet enrichissement au cumul de l'offre.

        ⚠️ **`tokens_cumules`, jamais `tokens_conversation`.** Le second est
        réservé à la conversation par offre, dont la borne se compte séparément :
        les mélanger ferait qu'un enrichissement coûteux fermerait d'avance la
        conversation sur la même offre.

        ⚠️ **C'est un INCRÉMENT, donc une lecture suivie d'une écriture** —
        l'API REST ne sait pas faire `colonne = colonne + n`. Non idempotent :
        rejoué, il compterait deux fois. Il n'est appelé qu'une fois, à la fin
        d'un enrichissement, jamais dans une boucle de reprise.
        """
        if total <= 0:
            return
        lignes = self._requete(
            "GET", f"/offres?identifiant=eq.{identifiant}&select=tokens_cumules",
            operation=f"lecture du cumul de {identifiant}",
        ) or []
        avant = (lignes[0].get("tokens_cumules") if lignes else 0) or 0
        self._requete(
            "PATCH", f"/offres?identifiant=eq.{identifiant}",
            operation=f"cumul de tokens de {identifiant}",
            headers={"Prefer": "return=minimal"},
            json={"tokens_cumules": avant + total},
        )


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


SUFFIXE_TRONCATURE = " […]"


def _tronquer(texte: str | None, limite: int = 500) -> str | None:
    """Coupe à `limite` caractères AU TOTAL, suffixe compris.

    ⚠️ **Corrigé le 30 août 2026, trouvé en revue.** La version précédente
    écrivait `texte[:limite] + " […]"` et rendait donc jusqu'à `limite + 4`
    caractères. Tant que rien ne bornait ces colonnes en base, personne ne
    pouvait s'en apercevoir. La migration 10 pose `motif_echec_borne`
    (≤ 2000) : un motif un peu long faisait alors refuser le PATCH de
    conclusion par la base, et l'enrichissement se refermait sur un message
    générique — ou pas du tout, laissant l'offre bloquée jusqu'à la péremption.
    **Une fonction qui dépasse sa propre limite est un bug dormant : il se
    réveille le jour où quelqu'un fait confiance à cette limite.**
    """
    if texte is None:
        return None
    if len(texte) <= limite:
        return texte
    return texte[: limite - len(SUFFIXE_TRONCATURE)] + SUFFIXE_TRONCATURE


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
