"""Le registre public des entreprises — `recherche-entreprises.api.gouv.fr`.

Entre : un nom d'entreprise lu dans une annonce, ou un SIREN.
Sort : des candidats **assainis**, prêts à être montrés au modèle.
Casse : lève `ErreurRegistre` — jamais de `try/except` nu qui avale la panne.

Gratuit, sans clé, sans quota gênant. C'est la seule source *qui fait foi* de
l'enrichissement : tout ce qui porte le marqueur « vérifié » côté ancrage vient
d'ici, et rien de ce que l'agent lit sur un site web n'a le droit d'y entrer.

---------------------------------------------------------------------------
⚠️ CE MODULE EST UNE FRONTIÈRE, PAS UN CLIENT HTTP
---------------------------------------------------------------------------

Sa vraie responsabilité est de décider **ce que le modèle a le droit de voir**.
La réponse brute de l'API porte des choses qui n'ont rien à faire dans le
contexte d'un agent :

  · ⚠️ **`dirigeants` — des personnes physiques, nommées, avec leur date de
    naissance.** C'est exactement la nature de donnée que la collecte écarte
    AVANT écriture depuis le 20 août 2026, et que le schéma d'enrichissement
    refuse d'accueillir (« une donnée qui n'a pas de colonne ne peut pas être
    écrite par distraction »). Ici il n'y a pas de colonne pour l'arrêter : si
    on passait la réponse brute, ces noms entreraient dans le contexte du
    modèle, et de là dans une étape affichée ou une rubrique rédigée. Le filtre
    est donc à l'entrée, dans `_assainir()`, et c'est sa raison d'être.

  · ⚠️ **L'adresse de voie du siège.** Inutile pour apparier — la commune et le
    département suffisent à départager des homonymes — et pour une entreprise
    individuelle, cette adresse **est souvent le domicile du dirigeant**. On
    garde la commune, jamais le numéro et la rue.

  · Les coordonnées GPS, les identifiants de conventions collectives, les
    trente drapeaux `est_*` : du bruit, qui se paie en tokens à chaque candidat
    rendu. Une réponse brute fait plusieurs kilo-octets ; « Orion » en rend
    4 382.

---------------------------------------------------------------------------
⚠️ TROIS PIÈGES MESURÉS LE 30 AOÛT 2026, à ne pas redécouvrir
---------------------------------------------------------------------------

1. **Le registre ne rend qu'UN exercice comptable, et c'est le dernier
   DÉPOSÉ, pas le dernier écoulé.** Capgemini 2024, Wavestone 2023, Dataiku
   2018, OCTO **2016**, Mirakl rien du tout. Un chiffre d'affaires sans son
   année est un mensonge, pas une imprécision — d'où le couple indissociable
   rendu par `_dernier_exercice()`, et la contrainte du même nom en base.

2. **Le rapprochement par nom est un pari.** « Orion » rend 4 382 entreprises.
   C'est pourquoi `chercher()` rend `total` en plus des candidats : le nombre
   de résultats est une information sur la **fiabilité** de l'appariement, pas
   une statistique décorative. L'agent doit le voir pour pouvoir douter.

3. **Le code NAF ne dit pas le métier.** `62.02A` range Capgemini, Sopra
   Steria et OCTO dans la même case. Il est rendu pour information, jamais
   comme preuve du modèle économique — qui se déduit en lisant le site.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any

import requests

_journal = logging.getLogger(__name__)

URL_RECHERCHE = "https://recherche-entreprises.api.gouv.fr/search"

# Le délai est court à dessein : l'agent est borné en durée, et une API gratuite
# qui ne répond pas en dix secondes ne répondra pas mieux en soixante. Mieux
# vaut rendre l'échec au modèle, qui décidera de retenter ou de conclure au
# doute, que de consommer la moitié du budget de temps sur une seule requête.
DELAI_SECONDES = 10

# ⚠️ **On peut prendre un 429 SANS AVOIR RIEN FAIT DE MAL, et c'est propre à là
# où ce code tourne.** La documentation de l'API pose deux limites : 7 requêtes
# par seconde et par adresse IP — que l'agent, qui en fait une ou deux par
# enrichissement, n'approchera jamais — mais aussi **30 requêtes par seconde par
# ASN**, avec cet avertissement mot pour mot : « il est donc probable de faire
# face à cette limite sur les cloud publics ». GitHub Actions EST un cloud
# public : nos requêtes partagent leur ASN avec tous les autres runners de la
# plateforme. Le refus ne dépend donc pas de notre débit à nous.
#
# ⚠️ **D'où un réessai, et un seul.** Sans lui, un enrichissement payé échouait
# sur la seconde d'activité d'un inconnu. Avec davantage, on mangerait le budget
# de durée de l'agent à attendre une API qui refuse pour une raison qui ne nous
# concerne pas — et on cognerait sur une limite déjà saturée.
REESSAIS_SUR_429 = 1
ATTENTE_APRES_429 = 1.5

# ⚠️ **La documentation le RECOMMANDE explicitement**, et ce n'est pas de la
# politesse : c'est ce qui permet à l'équipe d'une API gratuite et financée sur
# fonds publics de distinguer un usage identifiable d'un robot anonyme le jour
# où elle doit arbitrer. Une adresse de contact serait mieux encore ; le dépôt
# étant public, son adresse en tient lieu sans exposer de courriel personnel.
ENTETE_AGENT = (
    "veille-offres-emploi-ia/1.0 "
    "(+https://github.com/MaQssime7/veille-offres-emploi-ia)"
)

# ⚠️ Cinq candidats, pas trente. Chaque candidat rendu se paie en tokens
# d'entrée à CHAQUE tour suivant de l'agent, le contexte étant renvoyé en
# entier. Au-delà de cinq, le modèle ne départage pas mieux — il a le `total`
# pour savoir que le nom est ambigu, et un nom qui rend 4 382 résultats ne se
# tranche pas en en lisant vingt.
CANDIDATS_MAX = 5

# La table INSEE des tranches d'effectif salarié.
#
# ⚠️ **Elle n'est PAS la source d'affichage** — la migration 10 est explicite :
# la base stocke le CODE, la traduction en toutes lettres se fait à l'écran,
# donc côté TypeScript en 6.4. Cette copie-ci sert à autre chose : donner au
# modèle de quoi COMPARER la tranche officielle à l'effectif annoncé sur le
# site de l'entreprise, ce qui est précisément le travail demandé (deux points,
# l'un vérifié et l'autre déduit). Un code « 41 » ne se compare pas à « environ
# 700 personnes » ; « 500 à 999 salariés » si.
TRANCHES_EFFECTIF = {
    "NN": "effectif non renseigné",
    "00": "0 salarié",
    "01": "1 ou 2 salariés",
    "02": "3 à 5 salariés",
    "03": "6 à 9 salariés",
    "11": "10 à 19 salariés",
    "12": "20 à 49 salariés",
    "21": "50 à 99 salariés",
    "22": "100 à 199 salariés",
    "31": "200 à 249 salariés",
    "32": "250 à 499 salariés",
    "41": "500 à 999 salariés",
    "42": "1 000 à 1 999 salariés",
    "51": "2 000 à 4 999 salariés",
    "52": "5 000 à 9 999 salariés",
    "53": "10 000 salariés et plus",
}

# ⚠️ **Ces libellés portent un avertissement, et ce n'est pas de la prudence
# rédactionnelle — c'est un défaut trouvé en interrogeant l'API le 30 août
# 2026.** OCTO Technology ressort en « GE » avec une tranche d'effectif de
# 500 à 999 salariés : les deux champs de la MÊME fiche se contredisent. Ils ne
# mesurent pas la même chose — l'INSEE calcule la catégorie au niveau du
# GROUPE, l'effectif au niveau de l'entreprise. Un libellé nu (« grande
# entreprise, 5 000 salariés et plus ») aurait fait écrire au modèle qu'OCTO en
# compte 5 000, alors qu'elle en a environ sept cents.
#
# ⚠️ Et la contradiction est une INFORMATION, pas une nuisance : une petite
# tranche d'effectif sous une catégorie « GE » trahit une filiale, donc une
# appartenance à un groupe — qui est justement l'une des rubriques à remplir.
# C'est pourquoi le libellé le dit au modèle plutôt que de le taire.
#
# ⚠️ Mesuré sur UN cas, pas sur un échantillon : c'est une piste à confirmer,
# pas une règle. Le libellé est écrit pour qu'un modèle l'utilise comme indice
# et le vérifie sur le site, jamais comme preuve.
CATEGORIES = {
    "PME": "catégorie INSEE « PME », calculée au niveau du GROUPE et non de "
           "cette entreprise seule",
    "ETI": "catégorie INSEE « ETI », calculée au niveau du GROUPE et non de "
           "cette entreprise seule",
    "GE": "catégorie INSEE « grande entreprise », calculée au niveau du GROUPE "
          "et non de cette entreprise seule — si la tranche d'effectif "
          "ci-dessus est bien plus petite, c'est l'indice d'une FILIALE",
}


class ErreurRegistre(RuntimeError):
    """Le registre est injoignable ou refuse la requête. Jamais avalée."""


@dataclass(frozen=True)
class ResultatRegistre:
    """Ce que la recherche a rendu, et combien elle en a trouvé en tout.

    ⚠️ `total` compte les résultats du registre, `candidats` ceux qu'on montre
    au modèle. **L'écart entre les deux EST l'information de fiabilité** : trois
    candidats sur trois résultats se départagent, cinq candidats sur 4 382 ne se
    départagent pas — et c'est ce second cas qui doit produire un appariement
    « non identifié » plutôt qu'une fiche fausse d'apparence rigoureuse.
    """

    total: int = 0
    candidats: list[dict[str, Any]] = field(default_factory=list)


def chercher(nom: str, *, departement: str | None = None,
             limite: int = CANDIDATS_MAX) -> ResultatRegistre:
    """Cherche une entreprise par son nom.

    Entre : un nom tel qu'il apparaît dans l'annonce, et éventuellement un
    département pour départager.
    Sort : un `ResultatRegistre` assaini.
    Casse : `ErreurRegistre` si l'API ne répond pas ou répond mal.

    ⚠️ **Le département RESTREINT, il ne classe pas.** Il est tentant de le
    poser d'office puisque toutes les offres sont en Île-de-France : ce serait
    faux. Le siège social d'une entreprise n'est pas le lieu du poste — une
    société lyonnaise recrute à Paris tous les jours. Filtrer d'office ferait
    disparaître le bon candidat sans le moindre signal, et l'agent conclurait
    « introuvable » sur une entreprise qui est au registre. Le paramètre existe
    donc pour un SECOND essai, quand le premier rend trop de monde.
    """
    nom = (nom or "").strip()
    if not nom:
        raise ErreurRegistre("Recherche au registre demandée sans nom.")

    parametres: dict[str, Any] = {
        "q": nom,
        "per_page": max(1, min(limite, CANDIDATS_MAX)),
        "page": 1,
    }
    if departement:
        parametres["departement"] = departement

    reponse = _appeler(parametres)

    if reponse.status_code == 429:
        raise ErreurRegistre(
            "Le registre public limite temporairement les requêtes (429). "
            "Réessaie dans quelques secondes, ou conclus avec ce que tu as."
        )
    if reponse.status_code != 200:
        raise ErreurRegistre(
            f"Le registre public a répondu {reponse.status_code}."
        )

    try:
        charge = reponse.json()
    except ValueError as echec:
        raise ErreurRegistre("Le registre public a rendu une réponse illisible.") from echec

    resultats = charge.get("results") or []
    return ResultatRegistre(
        total=int(charge.get("total_results") or 0),
        candidats=[_assainir(unite) for unite in resultats],
    )


def _appeler(parametres: dict[str, Any]) -> requests.Response:
    """Un appel au registre, avec un unique réessai sur limitation de débit.

    ⚠️ **Le réessai ne couvre QUE le 429.** Une panne réseau ou un 500 se
    rejouent rarement mieux à 1,5 seconde d'intervalle, et l'agent a mieux à
    faire de son budget de durée : le modèle reçoit l'échec et décide lui-même
    s'il retente ou s'il conclut au doute. La limitation de débit, elle, est par
    nature transitoire — et sur un cloud public, elle peut ne rien devoir à
    notre propre débit.
    """
    dernier: requests.Response | None = None
    for tentative in range(REESSAIS_SUR_429 + 1):
        try:
            dernier = requests.get(
                URL_RECHERCHE, params=parametres, timeout=DELAI_SECONDES,
                headers={"User-Agent": ENTETE_AGENT},
            )
        except requests.RequestException as echec:
            raise ErreurRegistre(
                f"Le registre public n'a pas répondu : {type(echec).__name__}."
            ) from echec
        if dernier.status_code != 429:
            return dernier
        if tentative < REESSAIS_SUR_429:
            _journal.warning("registre : limitation de débit, un réessai")
            time.sleep(ATTENTE_APRES_429)
    return dernier  # type: ignore[return-value]


def par_siren(siren: str) -> dict[str, Any] | None:
    """Retrouve une entreprise par son SIREN, pour CONFIRMER un appariement.

    Entre : neuf chiffres, typiquement lus dans les mentions légales d'un site.
    Sort : la fiche assainie, ou `None` si le SIREN n'existe pas au registre.
    Casse : `ErreurRegistre` si l'API ne répond pas.

    ⚠️ **C'est ce chemin-là qui fabrique un appariement « vérifié ».** Le nom
    seul ne prouve rien ; un SIREN lu sur les mentions légales du site officiel
    et retrouvé au registre ferme la question. Sans lui, le meilleur qu'on
    puisse honnêtement écrire est « probable ».
    """
    siren = "".join(c for c in (siren or "") if c.isdigit())
    if len(siren) != 9:
        return None
    resultat = chercher(siren, limite=1)
    for candidat in resultat.candidats:
        if candidat.get("siren") == siren:
            return candidat
    return None


def _assainir(unite: dict[str, Any]) -> dict[str, Any]:
    """Ne garde que ce qui sert à apparier — voir le préambule du module.

    ⚠️ **Liste blanche, jamais liste noire.** Écrire « tout sauf `dirigeants` »
    laisserait passer le champ personnel que l'API ajoutera un jour sans nous
    prévenir. Ici, un champ nouveau est invisible tant que personne ne l'a
    explicitement demandé — c'est le sens de marche qui protège.
    """
    siege = unite.get("siege") or {}
    montant, exercice = _dernier_exercice(unite.get("finances"))
    tranche = unite.get("tranche_effectif_salarie")

    assaini: dict[str, Any] = {
        "siren": unite.get("siren"),
        "nom": unite.get("nom_complet") or unite.get("nom_raison_sociale"),
        "sigle": unite.get("sigle"),
        "cree_le": unite.get("date_creation"),
        # 'A' = active, 'C' = cessée. Une entreprise cessée qui recrute est le
        # signe d'un appariement raté, pas d'une annonce bizarre : c'est une
        # information de doute, donc elle est rendue.
        #
        # ⚠️ **Trois états, pas deux — et `None` quand le registre se tait.**
        # Écrire `== "A"` rendait `False` sur un champ ABSENT, c'est-à-dire
        # « entreprise cessée » là où le registre ne dit rien. Le filtre final
        # ne retire que les `None` : le modèle aurait donc lu une affirmation
        # fabriquée par le code, sur le champ même dont le commentaire ci-dessus
        # fait un signal de doute. C'est la règle 3 du projet — `NULL` n'est pas
        # `false` — appliquée à ce qu'on montre à un modèle plutôt qu'à une
        # colonne. Relevé en revue le 30 août 2026.
        "encore_active": _etat_connu(unite.get("etat_administratif")),
        "ferme_le": unite.get("date_fermeture"),
        "activite_naf": unite.get("activite_principale"),
        "forme_juridique": unite.get("nature_juridique"),
        "etablissements_ouverts": unite.get("nombre_etablissements_ouverts"),
        # Commune et département seulement. Jamais la voie : voir le préambule.
        "commune_siege": siege.get("libelle_commune"),
        "departement_siege": siege.get("departement"),
    }

    if tranche:
        assaini["tranche_effectif"] = tranche
        assaini["tranche_effectif_libelle"] = TRANCHES_EFFECTIF.get(
            tranche, f"code INSEE {tranche}")
        assaini["tranche_effectif_annee"] = _en_annee(
            unite.get("annee_tranche_effectif_salarie"))

    categorie = unite.get("categorie_entreprise")
    if categorie:
        assaini["categorie"] = categorie
        assaini["categorie_libelle"] = CATEGORIES.get(categorie, categorie)
        assaini["categorie_annee"] = _en_annee(unite.get("annee_categorie_entreprise"))

    if montant is not None:
        assaini["chiffre_affaires"] = montant
        assaini["chiffre_affaires_annee"] = exercice

    return {cle: valeur for cle, valeur in assaini.items() if valeur is not None}


def _etat_connu(etat: Any) -> bool | None:
    """« Active », « cessée », ou rien du tout — jamais deviné."""
    if etat == "A":
        return True
    if etat == "C":
        return False
    return None


def _dernier_exercice(finances: Any) -> tuple[int | None, int | None]:
    """Le chiffre d'affaires le plus récent DÉPOSÉ, avec son année.

    ⚠️ **Les deux sortent ensemble ou pas du tout.** C'est la mesure du 30 août
    gravée dans le code autant que dans la base : OCTO ne dépose rien depuis
    2016, et rendre « 47 276 000 € » sans « 2016 » laisserait croire que
    l'entreprise pèse ça aujourd'hui.

    ⚠️ Le registre n'en rend qu'un en pratique, mais le champ est un
    dictionnaire d'années — **on prend le maximum plutôt que le premier**, un
    dictionnaire JSON n'ayant aucun ordre garanti.
    """
    if not isinstance(finances, dict) or not finances:
        return None, None
    annees = [_en_annee(cle) for cle in finances]
    annees = [a for a in annees if a is not None]
    if not annees:
        return None, None
    recente = max(annees)
    exercice = finances.get(str(recente)) or {}
    montant = exercice.get("ca")
    if not isinstance(montant, int) or montant < 0:
        return None, None
    return montant, recente


def _en_annee(valeur: Any) -> int | None:
    """Le registre rend ses années en TEXTE (« 2023 »), la base les veut en entier."""
    try:
        annee = int(str(valeur))
    except (TypeError, ValueError):
        return None
    # Même borne que la contrainte `annees_plausibles` : ce qui serait refusé par
    # le moteur n'a pas à voyager jusqu'à lui.
    return annee if 1900 <= annee <= 2200 else None
