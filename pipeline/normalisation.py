"""Le trieur : réponse brute de France Travail → une ligne de la table `offres`.

Deux responsabilités, et elles ne se délèguent pas :

1. **Écarter les données personnelles AVANT écriture.** Le champ `contact` est
   présent sur 100 % des offres et contient nom de personne physique, adresse
   postale et courriel. Deux valeurs seulement sont conservées, parce qu'elles
   servent directement à candidater : `contact.nom` et `contact.urlPostulation`.
   Tout le reste est jeté ici — pas filtré à l'affichage. Filtré à l'affichage,
   un champ est quand même en base et dans les journaux.

2. **Refuser ce que la base refuserait.** Un identifiant mal formé fait rejeter
   le lot ENTIER par Postgres : quarante offres perdues à cause d'une seule. On
   écarte l'intruse ici, on la compte, et les autres passent.

Ce module ne fait aucun appel réseau et n'écrit nulle part. Il est purement
transformationnel — donc entièrement testable sans base ni API.
"""
from __future__ import annotations

import logging
import re
from typing import Any

_journal = logging.getLogger(__name__)

# Même contrainte que `identifiant_bien_forme` en base. Dupliquée à dessein :
# la base est le garde-fou qui ne s'oublie pas, ce contrôle-ci est celui qui
# évite de perdre tout un lot pour une ligne.
IDENTIFIANT_VALIDE = re.compile(r"^[0-9A-Z]{7}$")


class OffreInexploitable(ValueError):
    """L'offre ne peut pas devenir une ligne valide. Motif toujours explicite."""


def normaliser_offre(brute: dict[str, Any], execution_id: int) -> dict[str, Any]:
    """Une offre de l'API → une ligne prête à écrire.

    Lève OffreInexploitable si l'offre ne peut pas entrer en base.
    """
    identifiant = (brute.get("id") or "").strip()
    if not IDENTIFIANT_VALIDE.match(identifiant):
        raise OffreInexploitable(f"identifiant mal formé : {identifiant!r}")

    intitule = (brute.get("intitule") or "").strip()
    if not intitule:
        raise OffreInexploitable(f"{identifiant} : intitulé vide")

    description = brute.get("description") or ""
    if not description.strip():
        raise OffreInexploitable(f"{identifiant} : description vide")

    publiee_a = brute.get("dateCreation")
    if not publiee_a:
        raise OffreInexploitable(f"{identifiant} : dateCreation absente")

    contact = brute.get("contact") or {}

    # L'archive, contact RETIRÉ. Elle existe parce que France Travail dépublie
    # ses offres : un champ non extrait aujourd'hui serait perdu pour toujours.
    # On copie avant de retirer — `brute` appartient à l'appelant.
    charge_brute = {cle: valeur for cle, valeur in brute.items() if cle != "contact"}

    return {
        "identifiant": identifiant,
        "execution_id": execution_id,
        # --- L'annonce ---------------------------------------------------
        "intitule": intitule,
        "appellation_libelle": brute.get("appellationlibelle"),
        "description": description,
        "entreprise_nom": (brute.get("entreprise") or {}).get("nom"),
        "lieu_libelle": (brute.get("lieuTravail") or {}).get("libelle"),
        "type_contrat": brute.get("typeContrat"),
        "type_contrat_libelle": brute.get("typeContratLibelle"),
        "nature_contrat": brute.get("natureContrat"),
        "alternance": bool(brute.get("alternance", False)),
        "salaire_libelle": (brute.get("salaire") or {}).get("libelle"),
        "url_origine": (brute.get("origineOffre") or {}).get("urlOrigine"),
        "publiee_a": publiee_a,
        "actualisee_a": brute.get("dateActualisation"),
        # --- Signaux structurés ------------------------------------------
        "experience_code": brute.get("experienceExige"),
        "experience_libelle": brute.get("experienceLibelle"),
        "qualification_libelle": brute.get("qualificationLibelle"),
        "rome_code": brute.get("romeCode"),
        "rome_libelle": brute.get("romeLibelle"),
        "code_naf": brute.get("codeNAF"),
        "secteur_activite_libelle": brute.get("secteurActiviteLibelle"),
        "tranche_effectif": brute.get("trancheEffectifEtab"),
        "langues": brute.get("langues"),
        "formations": brute.get("formations"),
        "competences": brute.get("competences"),
        # NULL ≠ false. Le champ n'arrive que sur une offre sur quatre :
        # `.get()` rend None quand France Travail n'a rien dit, et False
        # seulement quand il a dit non. Un `bool()` ici fabriquerait de la
        # donnée qui n'existe pas.
        "manque_candidats": brute.get("offresManqueCandidats"),
        # --- Contact : périmètre restreint, en colonnes nommées -----------
        "contact_nom": contact.get("nom"),
        "contact_url_postulation": contact.get("urlPostulation"),
        # --- Archive ------------------------------------------------------
        "charge_brute": charge_brute,
    }


def normaliser_lot(
    brutes: dict[str, dict[str, Any]], execution_id: int
) -> tuple[list[dict[str, Any]], list[str]]:
    """Normalise un lot. Rend les lignes valides et les motifs de rejet.

    Une offre écartée ne fait pas échouer la collecte : elle est comptée et
    signalée. Une nuit ne se perd pas pour une annonce mal formée.
    """
    lignes: list[dict[str, Any]] = []
    rejets: list[str] = []

    for brute in brutes.values():
        try:
            lignes.append(normaliser_offre(brute, execution_id))
        except OffreInexploitable as motif:
            rejets.append(str(motif))

    if rejets:
        _journal.warning(
            "%d offre(s) écartée(s) à la normalisation : %s",
            len(rejets), " | ".join(rejets[:5]),
        )
    return lignes, rejets
