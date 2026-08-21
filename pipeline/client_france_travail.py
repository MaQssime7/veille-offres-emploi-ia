"""Le seul module qui sait téléphoner à France Travail.

Il ne connaît ni la base de données, ni la forme de nos tables : il rend les
offres telles que l'API les publie. Quand la collecte échoue, c'est ici qu'on
regarde si le problème vient de France Travail.

Tous les paramètres sont vérifiés en conditions réelles — voir
docs/API_FRANCE_TRAVAIL.md. Ne pas les improviser.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any

import requests

from pipeline.config import DELAI_CONNEXION, DELAI_LECTURE

_journal = logging.getLogger(__name__)

URL_JETON = (
    "https://entreprise.francetravail.fr/connexion/oauth2/access_token"
    "?realm=%2Fpartenaire"
)
URL_RECHERCHE = "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search"

# Exactement ces deux valeurs, séparées par une espace. La variante
# `application_<client_id>` échoue.
SCOPE = "api_offresdemploiv2 o2dsoffre"

# Quota mesuré : 10 appels par seconde pour cette application. Une boucle de
# pagination sans temporisation le dépasse et se fait couper.
DELAI_ENTRE_APPELS = 0.25

# Attente avant l'unique réessai sur HTTP 429, quand le serveur ne dit pas
# lui-même combien attendre.
ATTENTE_APRES_QUOTA = 5.0

# `range` accepte au plus 150 résultats par appel, et l'index maximum est ~1149.
# Au-delà, France Travail répond HTTP 400 : c'est l'INDEX DEMANDÉ qui est
# plafonné, pas le nombre d'offres déjà reçues.
TAILLE_PAGE = 150
PLAFOND_PAGINATION = 1150

# On renouvelle le jeton un peu avant son expiration plutôt que de la découvrir
# au milieu d'une pagination.
MARGE_EXPIRATION = timedelta(seconds=60)


class ErreurFranceTravail(RuntimeError):
    """Toute panne imputable à France Travail. Jamais avalée silencieusement."""


class AuthentificationEchouee(ErreurFranceTravail):
    """Le jeton n'a pas pu être obtenu.

    Cause la plus fréquente quand les identifiants sont bons : l'API n'est pas
    rattachée à l'application sur francetravail.io. Créer l'application ne
    suffit pas.
    """


class QuotaDepasse(ErreurFranceTravail):
    """HTTP 429 persistant après réessai. Géré explicitement, jamais avalé."""


class ClientFranceTravail:
    """Client de l'API Offres d'emploi v2.

    Entre : des identifiants OAuth2 et des critères de recherche.
    Sort : des offres, telles que l'API les publie.
    Casse : lève une sous-classe d'ErreurFranceTravail, jamais un plantage muet.
    """

    def __init__(self, client_id: str, client_secret: str) -> None:
        self._client_id = client_id
        self._client_secret = client_secret
        self._jeton: str | None = None
        self._expire_a: datetime = datetime.now(timezone.utc)
        self._session = requests.Session()
        # Horloge MONOTONE, pas l'horloge murale : une correction NTP en arrière
        # rendrait l'écart négatif, une correction en avant enverrait les appels
        # dos à dos et déclencherait le 429 que cette temporisation existe pour
        # éviter.
        self._dernier_appel: float | None = None

    # ------------------------------------------------------------------ jeton

    def _obtenir_jeton(self) -> str:
        """Échange les identifiants contre un jeton de courte durée.

        ⚠️ Les identifiants vont dans le CORPS de la requête, pas en en-tête
        Basic. Une authentification `Authorization: Basic` est rejetée par une
        page HTML d'erreur en HTTP 409 — pas un JSON, ce qui fait planter tout
        code qui suppose une réponse JSON sur le chemin d'erreur.
        """
        try:
            reponse = self._session.post(
                URL_JETON,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                    "scope": SCOPE,
                },
                timeout=(DELAI_CONNEXION, DELAI_LECTURE),
            )
        except requests.RequestException as echec:
            raise AuthentificationEchouee(
                f"Impossible de joindre le serveur d'authentification : {echec}"
            ) from echec

        if reponse.status_code != 200:
            # Le corps peut contenir du HTML : on le tronque, et on ne
            # journalise jamais les identifiants qui viennent d'être envoyés.
            raise AuthentificationEchouee(
                f"HTTP {reponse.status_code} sur la demande de jeton. "
                f"Début de la réponse : {reponse.text[:200]!r}"
            )

        charge = reponse.json()
        jeton = charge.get("access_token")
        if not jeton:
            raise AuthentificationEchouee("Réponse sans access_token.")

        duree = int(charge.get("expires_in", 1500))
        self._expire_a = datetime.now(timezone.utc) + timedelta(seconds=duree)
        _journal.info("Jeton obtenu, valide %d s.", duree)
        return jeton

    def _jeton_valide(self) -> str:
        if self._jeton is None or datetime.now(timezone.utc) >= self._expire_a - MARGE_EXPIRATION:
            self._jeton = self._obtenir_jeton()
        return self._jeton

    # ------------------------------------------------------------------ appels

    def _respecter_quota(self) -> None:
        if self._dernier_appel is not None:
            ecoule = time.monotonic() - self._dernier_appel
            if ecoule < DELAI_ENTRE_APPELS:
                time.sleep(DELAI_ENTRE_APPELS - ecoule)
        self._dernier_appel = time.monotonic()

    def _appeler(
        self, parametres: dict[str, str],
        *, reessai_jeton: bool = True, reessai_quota: bool = True,
    ) -> requests.Response:
        """Un appel de recherche, quota respecté et jeton renouvelé si besoin."""
        self._respecter_quota()
        try:
            reponse = self._session.get(
                URL_RECHERCHE,
                headers={"Authorization": f"Bearer {self._jeton_valide()}"},
                params=parametres,
                timeout=(DELAI_CONNEXION, DELAI_LECTURE),
            )
        except requests.RequestException as echec:
            raise ErreurFranceTravail(f"Appel de recherche échoué : {echec}") from echec

        # Jeton expiré en milieu de pagination : on le renouvelle et on reprend,
        # au lieu de planter. Cas limite qui ne se produit que sur les collectes
        # longues, donc jamais en développement.
        if reponse.status_code == 401 and reessai_jeton:
            _journal.warning("HTTP 401 : jeton renouvelé, reprise de l'appel.")
            self._jeton = None
            return self._appeler(parametres, reessai_jeton=False, reessai_quota=reessai_quota)

        # Quota dépassé : on patiente et on rejoue UNE fois. Sans ce réessai,
        # un 429 sur le neuvième critère jetterait les huit déjà collectés —
        # rien n'est écrit en base avant la fin de la collecte.
        if reponse.status_code == 429 and reessai_quota:
            attente = _attente_demandee(reponse.headers.get("Retry-After"))
            _journal.warning("HTTP 429 : quota dépassé, réessai dans %.1f s.", attente)
            time.sleep(attente)
            return self._appeler(parametres, reessai_jeton=reessai_jeton, reessai_quota=False)

        if reponse.status_code == 429:
            raise QuotaDepasse(
                "HTTP 429 après réessai : quota d'appels durablement dépassé. "
                "Le pipeline appelle trop vite, ou une autre exécution tourne en parallèle."
            )

        return reponse

    # ------------------------------------------------------------- recherche

    def rechercher(
        self,
        *,
        region: str,
        depuis: datetime,
        jusqua: datetime,
        mots_cles: str | None = None,
        code_rome: str | None = None,
    ) -> list[dict[str, Any]]:
        """Toutes les offres d'un critère, pagination comprise.

        `region` est obligatoire et sans valeur par défaut : `departement` est
        plafonné à 5 valeurs et l'Île-de-France en compte 8, donc `region` est
        la seule voie. Un appel qui l'oublierait doit échouer bruyamment, pas
        se rabattre sur une constante cachée ici.

        `minCreationDate` et `maxCreationDate` sont **indissociables** : fournir
        l'une sans l'autre renvoie une HTTP 400.
        """
        base: dict[str, str] = {
            "region": region,
            "minCreationDate": _iso(depuis),
            "maxCreationDate": _iso(jusqua),
        }
        if mots_cles:
            base["motsCles"] = mots_cles
        if code_rome:
            base["codeROME"] = code_rome

        critere = mots_cles or code_rome or "(aucun)"
        offres: list[dict[str, Any]] = []
        total: int | None = None
        debut = 0

        while True:
            # ⚠️ Le plafond porte sur l'INDEX DEMANDÉ. On le contrôle AVANT
            # d'appeler, et on borne aussi la fin de plage : `range=1050-1199`
            # demande l'index 1199, au-delà du maximum ~1149, et France Travail
            # répond HTTP 400 — ce qui ferait basculer TOUTE l'exécution en
            # échec, les autres critères déjà collectés perdus.
            if debut >= PLAFOND_PAGINATION:
                _journal.warning(
                    "« %s » : plafond de pagination atteint (%d offres sur %s annoncées). "
                    "La fenêtre est trop large — le reste ne sera pas collecté.",
                    critere, len(offres), total,
                )
                break

            fin = min(debut + TAILLE_PAGE - 1, PLAFOND_PAGINATION - 1)
            reponse = self._appeler(dict(base, range=f"{debut}-{fin}"))

            # Zéro résultat : HTTP 204 avec un corps ENTIÈREMENT VIDE. Appeler
            # .json() dessus lève une exception, donc on le traite avant tout
            # décodage.
            # ⚠️ En MILIEU de pagination, c'est un arrêt, pas un vide : des
            # offres ont été dépubliées entre deux appels. Rendre [] ici
            # jetterait toutes les pages déjà collectées, et le journal dirait
            # « aucune offre » — indistinguable d'une nuit calme.
            if reponse.status_code == 204:
                if offres:
                    _journal.warning(
                        "« %s » : HTTP 204 à l'index %d après %d offre(s) déjà reçue(s). "
                        "Pagination arrêtée, les offres déjà collectées sont conservées.",
                        critere, debut, len(offres),
                    )
                    break
                _journal.info("« %s » : aucune offre sur la période.", critere)
                return []

            # HTTP 206 = réponse partielle, c'est un SUCCÈS. Un code qui teste
            # `== 200` rate silencieusement toutes les pages intermédiaires.
            if reponse.status_code not in (200, 206):
                raise ErreurFranceTravail(
                    f"« {critere} » : HTTP {reponse.status_code} inattendu. "
                    f"Début de la réponse : {reponse.text[:200]!r}"
                )

            lot = reponse.json().get("resultats") or []
            offres.extend(lot)

            if total is None:
                total = _total_disponible(
                    reponse.headers.get("Content-Range"), len(lot), critere
                )

            if not lot or len(offres) >= total:
                break

            debut = fin + 1

        _journal.info("« %s » : %d offres reçues.", critere, len(offres))
        return offres


def _iso(moment: datetime) -> str:
    """Format attendu : AAAA-MM-JJTHH:MM:SSZ, en UTC."""
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _attente_demandee(retry_after: str | None) -> float:
    """Respecte l'en-tête `Retry-After` du serveur quand il le fournit."""
    if retry_after:
        try:
            return max(1.0, min(float(retry_after), 60.0))
        except ValueError:
            pass
    return ATTENTE_APRES_QUOTA


def _total_disponible(content_range: str | None, recus: int, critere: str) -> int:
    """Lit le total réel dans l'en-tête `Content-Range: offres 0-49/246`.

    C'est lui qui pilote la pagination, jamais une constante en dur : le nombre
    d'offres change tous les jours.

    ⚠️ Sans cet en-tête, on ne peut PAS savoir s'il reste des pages. On se
    rabat sur le nombre reçu — ce qui arrête la pagination après une page — mais
    on le DIT. Silencieux, ce repli collecterait 150 offres sur 800 et fermerait
    l'exécution en `reussite`.
    """
    if not content_range or "/" not in content_range:
        _journal.warning(
            "« %s » : en-tête Content-Range absent. Impossible de savoir s'il reste "
            "des pages — la collecte s'arrête à %d offre(s) et peut être incomplète.",
            critere, recus,
        )
        return recus
    try:
        return int(content_range.rsplit("/", 1)[1])
    except ValueError:
        _journal.warning(
            "« %s » : Content-Range illisible (%r). Collecte possiblement incomplète.",
            critere, content_range,
        )
        return recus
