"""Le trousseau de clés du pipeline.

Ce module fait deux choses et rien d'autre : lire les secrets depuis
l'environnement, et lire les fichiers de critères versionnés.

Sa règle : **échouer au démarrage, jamais au milieu**. Un secret manquant
découvert après quarante minutes de collecte, c'est une exécution perdue et une
ligne `en_cours` à refermer. Découvert à la première ligne, c'est un message
d'erreur clair.

⚠️ Aucune fonction d'ici ne journalise la valeur d'un secret. Un `print(config)`
qui affiche la clé finit dans un journal GitHub Actions public.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

RACINE = Path(__file__).resolve().parent
REGION_ILE_DE_FRANCE = "11"

# Délais réseau, partagés par les deux modules qui parlent au réseau.
DELAI_CONNEXION = 15
DELAI_LECTURE = 60

# Au-delà, une exécution restée `en_cours` est forcément morte : le job de
# collecte est coupé à 30 min par `timeout-minutes` dans
# `.github/workflows/collecte-nocturne.yml`. Ce seuil-ci est délibérément bien
# plus large que ce plafond — il n'existe pas pour détecter vite, mais pour ne
# JAMAIS déclarer `echec` une collecte encore vivante : un lancement manuel
# pendant que le cron tourne, ou un rattrapage sur 30 jours qui dure plusieurs
# minutes.
AGE_EXECUTION_ORPHELINE_HEURES = 6

# Sans exécution réussie antérieure, on regarde 24 h en arrière.
FENETRE_INITIALE_HEURES = 24

# Recouvrement volontaire avec l'exécution précédente. Sans lui, une offre
# publiée pendant que le pipeline tournait tomberait dans le trou entre deux
# fenêtres et ne serait jamais vue. Le doublon ne coûte rien : la clé primaire
# le refuse en base.
RECOUVREMENT_HEURES = 1

# Plafond de rattrapage. Si le cron est tombé trois jours, on rattrape trois
# jours ; s'il est tombé trois mois, on ne tente pas de rattraper trois mois —
# la pagination de France Travail plafonne à ~1150 offres par recherche.
FENETRE_MAXIMALE_JOURS = 30


class ConfigurationIncomplete(RuntimeError):
    """Un secret ou un fichier de critères manque. Rien ne peut démarrer."""


@dataclass(frozen=True)
class Config:
    """Tout ce dont le pipeline a besoin pour tourner, validé."""

    ft_client_id: str
    ft_client_secret: str
    supabase_url: str
    supabase_secret_key: str
    mots_cles: tuple[str, ...]
    codes_rome: tuple[str, ...]

    def __repr__(self) -> str:  # pragma: no cover - garde-fou, pas de la logique
        """Masque les secrets.

        `print(config)` arrive tôt ou tard, en débogage ou dans un message
        d'erreur. Sans ce garde-fou, il publie la clé qui contourne toute la
        sécurité de la base.
        """
        return (
            f"Config(mots_cles={len(self.mots_cles)}, codes_rome={len(self.codes_rome)}, "
            f"supabase_url={self.supabase_url!r}, secrets=***)"
        )


def _lire_variable(nom: str) -> str:
    valeur = os.environ.get(nom, "").strip()
    if not valeur:
        raise ConfigurationIncomplete(
            f"La variable d'environnement {nom} est absente ou vide. "
            f"En local elle vient du fichier .env ; en CI, des secrets GitHub Actions."
        )
    return valeur


def _lire_liste(fichier: Path) -> tuple[str, ...]:
    """Lit un fichier « une valeur par ligne », commentaires `#` retirés.

    Les commentaires sont retirés en fin de ligne aussi : `M1805  # Études…`
    donne `M1805`. Sans ça, on interrogerait l'API avec un code ROME suivi de
    son libellé, et la recherche ne renverrait rien — silencieusement.
    """
    if not fichier.exists():
        raise ConfigurationIncomplete(f"Fichier de critères introuvable : {fichier}")

    valeurs: list[str] = []
    for ligne in fichier.read_text(encoding="utf-8").splitlines():
        sans_commentaire = ligne.split("#", 1)[0].strip()
        if sans_commentaire:
            valeurs.append(sans_commentaire)

    if not valeurs:
        raise ConfigurationIncomplete(
            f"{fichier.name} ne contient aucune valeur active. "
            f"Une collecte sans critère ne ramènerait rien."
        )
    return tuple(valeurs)


@dataclass(frozen=True)
class ConfigNotation:
    """Ce dont la notation a besoin, et rien de plus."""

    supabase_url: str
    supabase_secret_key: str

    def __repr__(self) -> str:  # pragma: no cover - garde-fou, pas de la logique
        return f"ConfigNotation(supabase_url={self.supabase_url!r}, secrets=***)"


def charger_notation() -> ConfigNotation:
    """Valide uniquement ce que la notation utilise.

    ⚠️ Délibérément séparé de `charger()` : la notation n'a rien à faire avec
    France Travail. Réutiliser la configuration complète obligerait le job de
    notation à porter les identifiants France Travail dans ses secrets GitHub
    Actions — quatre secrets pour deux besoins, et deux clés de plus exposées
    à qui entrerait dans le dépôt, pour rien.

    La clé Anthropic n'est pas rendue : le SDK lit `ANTHROPIC_API_KEY` dans
    l'environnement tout seul. On vérifie seulement qu'elle est là, ici, plutôt
    que de laisser le premier appel échouer après la lecture de la base.
    """
    load_dotenv()
    _lire_variable("ANTHROPIC_API_KEY")
    return ConfigNotation(
        supabase_url=_lire_variable("SUPABASE_URL").rstrip("/"),
        supabase_secret_key=_lire_variable("SUPABASE_SECRET_KEY"),
    )


def charger() -> Config:
    """Assemble la configuration, ou échoue tout de suite avec un motif lisible."""
    load_dotenv()  # sans effet en CI, où les secrets sont déjà dans l'environnement

    # ⚠️ Le garde-fou « aucune variable NEXT_PUBLIC_ » N'EST PAS ici, et c'est
    # délibéré : le risque qu'il vise — une valeur publiée dans le code source
    # d'une page — vit entièrement dans `interface/`, que ce module ne voit pas.
    # Posé ici, il ne protégerait rien et annulerait la collecte nocturne si le
    # runner GitHub portait une telle variable pour une raison étrangère au
    # projet. Il appartient au build Next.js.

    return Config(
        ft_client_id=_lire_variable("FT_CLIENT_ID"),
        ft_client_secret=_lire_variable("FT_CLIENT_SECRET"),
        supabase_url=_lire_variable("SUPABASE_URL").rstrip("/"),
        supabase_secret_key=_lire_variable("SUPABASE_SECRET_KEY"),
        mots_cles=_lire_liste(RACINE / "mots_cles.txt"),
        codes_rome=_lire_liste(RACINE / "codes_rome.txt"),
    )
