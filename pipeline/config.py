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

# Seul le CDI est collecté. Décidé par Maxime le 28 août 2026, après mesure du
# coût : il ne regarde pas les autres contrats, donc les noter est une dépense
# pure (~0,6 centime l'offre).
#
# ⚠️ CE FILTRE EST IRRÉVERSIBLE POUR LE PASSÉ, et c'est le seul point qui compte
# ici. France Travail dépublie ses annonces : une offre écartée aujourd'hui
# n'existera plus le jour où on la voudrait. Le rendre à `None` rouvrira la
# collecte pour l'avenir, jamais pour les semaines écoulées. C'est le même
# raisonnement que « la base ne s'efface pas » — sauf qu'ici la perte est
# silencieuse, personne ne voit ce qui n'a pas été collecté.
#
# ⚠️ **Deux pourcentages circulent, avec deux dénominateurs — ne pas les
# confondre.** Sur ce que la COLLECTE écarte : **22 %** (39 CDD dont 27
# alternances, 16 intérims, 3 professions libérales, sur 30 jours). Sur
# l'échantillon des 123 offres NOTÉES : **31 %**. Le second est plus élevé
# parce que les offres notées ne sont pas un tirage représentatif de la base.
# Le chiffre qui décide de rouvrir ou non le filtre est le premier.
#
# Ce qu'il coûte, sur les 123 offres notées au 28 août : 11 des 20 meilleures
# offres perdues — dont 7 alternances et 4 vraies offres, dont un CDD Institut
# Curie noté 75. Maxime a vu ce chiffre et a confirmé : il ne prend que du CDI,
# donc ces offres sont du bruit pour lui.
#
# ⚠️ Ne pas remplacer par un filtre après réception : le but est justement de
# ne pas les faire entrer. Et `type_contrat` est renseigné sur 560 offres sur
# 560 (vérifié le 28 août), donc aucune offre ne disparaît faute de valeur.
#
# ⚠️ **Le filtre n'écarte les alternances que PAR ACCIDENT — ne pas s'y fier.**
# Aujourd'hui les 34 alternances de la base sont toutes typées CDD ou MIS, donc
# aucune ne passe. Mais rien ne le garantit : un contrat de professionnalisation
# peut être conclu en CDI, et le premier qui arrive passera le filtre. Si écarter
# l'alternance devient un besoin en soi, le levier direct est la colonne
# `alternance` — un booléen déjà extrait à la collecte, renseigné partout —
# et non un effet de bord du type de contrat.
#
# `None` désactive le filtre — et c'est le SEUL moyen : la chaîne vide est
# refusée au démarrage par `_valider_type_contrat()`, parce qu'elle
# désactiverait le filtre sans laisser de trace au journal.
# Plusieurs valeurs s'écrivent séparées par une virgule (`"CDI,CDD"`).
#
# ⚠️ **SENSIBLE À LA CASSE, et c'est sans danger** — vérifié le 28 août en
# violant la contrainte exprès. `"cdi"`, `"Cdi"`, `"CDI "` (espace final) et
# `"CDIX"` renvoient tous **HTTP 400 « Valeur du paramètre typeContrat
# incorrecte »**, ce qui lève `ErreurFranceTravail`, referme l'exécution en
# `echec` et rend le code de sortie 1 : le job GitHub Actions rougit.
# Le scénario redouté — une faute de frappe qui ferait rendre **zéro offre** en
# silence, donc une collecte « réussie » vide chaque nuit sans une seule erreur —
# **ne peut pas se produire**. C'est le seul point qu'il fallait vérifier ici.
# `_valider_type_contrat()` avance quand même l'erreur au démarrage, pour que le
# motif vienne du projet et non d'un message d'API après le premier appel.
#
# ⚠️ **CES 12 CODES VIENNENT DU RÉFÉRENTIEL OFFICIEL, PAS DE LA BASE.** La
# première version de cette liste n'en contenait que 4 — `CDI`, `CDD`, `MIS`,
# `LIB` — parce qu'elle avait été construite sur les valeurs *observées* dans
# 560 offres collectées avec nos propres mots-clés. C'est une liste blanche
# bâtie sur un échantillon, et elle refusait 8 codes que l'API accepte : passer
# `TYPE_CONTRAT = "CDI,DIN"` (CDI intérimaire, un élargissement naturel) aurait
# fait échouer la collecte au démarrage, avec un message accusant à tort France
# Travail de renvoyer une 400. Vérifié le 28 août : `typeContrat=DIN` et
# `typeContrat=SAI` répondent **HTTP 204**, pas 400.
#
# ⚠️ **La leçon dépasse ce cas** : ce qu'un échantillon contient ne dit pas ce
# qu'un système accepte. Le référentiel est gratuit —
# `GET /partenaire/offresdemploi/v2/referentiel/typesContrats` — et c'est lui
# qui fait foi. Le relire si un code manque ici.
TYPES_CONTRAT_CONNUS = frozenset({
    "CCE",  # Profession commerciale
    "CDD",  # Contrat à durée déterminée
    "CDI",  # Contrat à durée indéterminée
    "DDI",  # Contrat durée déterminée insertion
    "DDT",  # CDD Tremplin
    "DIN",  # CDI Intérimaire
    "FRA",  # Franchise
    "LIB",  # Profession libérale
    "MIS",  # Mission intérimaire
    "REP",  # Reprise d'entreprise
    "SAI",  # Contrat travail saisonnier
    "TTI",  # Contrat travail temporaire insertion
})

# ⚠️ L'annotation `str | None` n'est pas décorative : sans elle le type est
# déduit à `str`, et le `None` documenté juste au-dessus comme seule façon de
# désactiver le filtre devient une erreur de typage — pendant que les deux
# branches de `_valider_type_contrat()` qui le traitent passent pour du code
# mort. Les états réellement supportés doivent se lire dans la déclaration.
TYPE_CONTRAT: str | None = "CDI"


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


def _lire_liste(fichier: Path, *, autoriser_vide: bool = False) -> tuple[str, ...]:
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

    if not valeurs and not autoriser_vide:
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


@dataclass(frozen=True)
class ConfigEnrichissement:
    """Ce dont l'enrichissement a besoin, et rien de plus."""

    supabase_url: str
    supabase_secret_key: str

    def __repr__(self) -> str:  # pragma: no cover - garde-fou, pas de la logique
        return f"ConfigEnrichissement(supabase_url={self.supabase_url!r}, secrets=***)"


def charger_enrichissement() -> ConfigEnrichissement:
    """Valide uniquement ce que l'enrichissement utilise.

    ⚠️ **La clé Anthropic est entrée ici le 30 août 2026, avec l'agent réel
    (tranche 6.3).** Jusque-là ce job ne portait que Supabase, et la phrase qui
    tenait cette place disait « la refuser tant qu'aucun appel n'est fait évite
    de la poser dans un workflow qui n'en a pas besoin ». Le besoin existe
    désormais, et la contrepartie doit être dite : **le workflow
    d'enrichissement détient maintenant une clé facturée.** Qui peut le lancer
    peut faire dépenser. C'est ce qui rend `JETON_GITHUB` critique — portée
    fine, ce seul dépôt, « Actions : write » et rien d'autre — et c'est la
    raison d'être de l'enveloppe quotidienne.

    ⚠️ Toujours pas France Travail : l'agent ne parle jamais à cette API. Il lit
    l'annonce **en base**, où la collecte l'a déjà écartée de ses données
    personnelles. Ajouter ces identifiants ici exposerait deux clés de plus pour
    un besoin qui n'existe pas.

    La clé n'est pas rendue dans l'objet : le SDK lit `ANTHROPIC_API_KEY` dans
    l'environnement tout seul. On vérifie seulement qu'elle est là, **au
    démarrage**, plutôt que de laisser le premier appel échouer une fois la
    tentative réclamée et les premières étapes écrites.

    ⚠️ **Ce contrôle n'évite PAS la péremption, et la version précédente de
    cette phrase le prétendait — relevé en revue le 30 août 2026.** Quand cette
    fonction lève, rien n'a encore été construit : on n'a pas les identifiants
    Supabase, donc aucun moyen de refermer la ligne, qui reste en `demande` et
    fait pulser l'écran les mêmes dix minutes qu'un échec tardif. Ce qu'on
    économise est réel mais plus modeste : un enrichissement à moitié écrit, des
    étapes qui s'arrêtent net sans conclusion, et un appel au modèle payé pour
    rien. La péremption, elle, reste le seul filet — et c'est bien pour ça
    qu'elle existe.
    """
    load_dotenv()
    _lire_variable("ANTHROPIC_API_KEY")
    return ConfigEnrichissement(
        supabase_url=_lire_variable("SUPABASE_URL").rstrip("/"),
        supabase_secret_key=_lire_variable("SUPABASE_SECRET_KEY"),
    )


def _valider_type_contrat() -> None:
    """Refuse une valeur de `TYPE_CONTRAT` que France Travail rejetterait.

    ⚠️ Ce contrôle n'existe pas pour éviter une panne — il n'y en a pas : une
    valeur invalide fait répondre HTTP 400 à l'API, ce qui referme l'exécution
    en `echec` et fait rougir le job (vérifié le 28 août en la cassant exprès).
    Il existe pour tenir la règle de ce module — **échouer au démarrage, jamais
    au milieu**. Sans lui, la faute de frappe n'apparaît qu'après le premier
    appel réseau, dans un message de France Travail plutôt que du projet.

    ⚠️ La chaîne vide est refusée explicitement, et ce n'est pas du zèle : elle
    est *falsy*, donc elle désactiverait le filtre en silence **et** sauterait
    la ligne de journal qui annonce son état. Un `""` laissé par une édition à
    moitié faite rouvrirait la collecte à tous les contrats sans une seule
    trace. `None` est le seul moyen de désactiver, et il est explicite.
    """
    if TYPE_CONTRAT is None:
        return
    if not isinstance(TYPE_CONTRAT, str) or not TYPE_CONTRAT.strip():
        raise ConfigurationIncomplete(
            "TYPE_CONTRAT est vide ou n'est pas un texte. Pour désactiver le "
            "filtre de contrat, écrire `None` — jamais une chaîne vide, qui le "
            "désactiverait sans le dire dans le journal."
        )
    inconnus = [v for v in TYPE_CONTRAT.split(",") if v not in TYPES_CONTRAT_CONNUS]
    if inconnus:
        raise ConfigurationIncomplete(
            f"TYPE_CONTRAT contient {inconnus}, que France Travail refuse "
            f"(HTTP 400). Valeurs acceptées, SENSIBLES À LA CASSE : "
            f"{sorted(TYPES_CONTRAT_CONNUS)}. Plusieurs se séparent par une "
            f"virgule, sans espace : « CDI,CDD »."
        )


def charger() -> Config:
    """Assemble la configuration, ou échoue tout de suite avec un motif lisible."""
    load_dotenv()  # sans effet en CI, où les secrets sont déjà dans l'environnement

    _valider_type_contrat()

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
        # ⚠️ Vide est une configuration VALIDE pour les codes ROME, pas pour les
        # mots-clés. Mesuré le 26 août 2026 : les six codes collectés apportaient
        # 445 offres nettes par mois pour zéro offre dépassant 30 sur 50 notées
        # au hasard. Le fichier reste en place, documenté et prêt à resservir —
        # supprimer le fichier plutôt que son contenu ferait perdre la mesure qui
        # justifie la décision.
        codes_rome=_lire_liste(RACINE / "codes_rome.txt", autoriser_vide=True),
    )
