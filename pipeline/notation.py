"""Note les offres collectées : deux notes, deux justifications, un résumé.

**Ce qui entre** : les offres en base qui n'ont pas encore de note.
**Ce qui sort** : pour chacune, une note d'intérêt et une note d'accessibilité
de 0 à 100, leur justification, un résumé d'une phrase, et le salaire ramené à
l'année. Plus une ligne de trace dans `executions_veille`.
**Ce qui casse s'il tombe** : les offres restent sans note et remontent au
passage suivant. Rien n'est perdu — la notation est incrémentale et reprend là
où elle s'est arrêtée.

---

**La frontière, et pourquoi elle est ici.** Ce module appelle l'API Messages
(`anthropic`), **pas** le Claude Agent SDK. Une notation est une classification :
une entrée, une sortie, aucune exploration, aucun outil, aucune décision sur la
suite. Poser un agent dessus serait plus lent, plus cher et non déterministe
pour aucun gain. L'Agent SDK est réservé à l'enrichissement (phase 6), qui est
une tâche ouverte : chercher l'entreprise, lire son site, croiser, rédiger.

⚠️ **Le salaire n'est PAS calculé par le modèle.** Il l'est par
`pipeline.salaire`, en Python, de façon déterministe et vérifiable. Demander à
un modèle de multiplier un montant par douze coûterait des tokens pour un
résultat moins fiable qu'une multiplication — et le jour où il se tromperait,
rien ne le signalerait. **Ce qui se calcule ne se demande pas à un modèle.**
C'est la même règle que « ce qui se calcule ne se stocke pas ».

**Deux modes d'appel, et ce n'est pas une coquetterie.** L'API Batches coûte
moitié prix mais met jusqu'à une heure à rendre ses résultats : elle est
inutilisable tant qu'on règle le prompt, où chaque itération coûterait une heure
d'attente. Les appels directs répondent en secondes. On règle en direct sur une
poignée d'offres, on produit en lot sur des centaines.

⚠️ **En lot, les résultats reviennent dans le désordre.** Ils se rattachent par
`custom_id`, **jamais par position** — un rattachement positionnel donnerait à
une offre les notes d'une autre, sans lever la moindre erreur. C'est le bug le
plus coûteux possible ici : silencieux et invisible à la relecture.

**Le cache de prompt.** Les critères de pertinence font le même préfixe pour
toutes les offres. Marqué `cache_control`, il n'est facturé plein tarif qu'une
fois. ⚠️ Le plancher est de 1024 tokens chez Sonnet 5 : **en dessous, rien
n'est mis en cache et aucune erreur ne le dit** — `cache_read_input_tokens`
reste simplement à zéro. C'est pour ça que ce module journalise les quatre
compteurs à chaque appel.
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Any

import anthropic

from pipeline import config as configuration
from pipeline.salaire import annualiser
from pipeline.stockage import ConsommationTokens, ErreurStockage, Stockage

_journal = logging.getLogger(__name__)

RACINE = Path(__file__).resolve().parent
FICHIER_CRITERES = RACINE / "criteres_pertinence.txt"

# Tranché à l'architecture le 16 août 2026, et CLOS le 26 août 2026 : c'est
# Sonnet 5, définitivement. La comparaison avec Opus 5 était portée comme une
# question ouverte ; Maxime l'a fermée sans la mener, et le motif est bon — le
# prompt est calibré, les 97 notations produites sont conformes et lisibles, et
# l'écart de coût (2,30 $/mois) ne justifie pas de repayer 97 offres pour
# arbitrer un doute que personne n'a. Ne pas rouvrir « pour voir ».
# `--modele` reste là : il sert à changer de modèle le jour où il le faudra,
# pas à organiser un match.
MODELE_PAR_DEFAUT = "claude-sonnet-5"

# Assez pour la réponse structurée ET la réflexion adaptative du modèle.
# `max_tokens` plafonne les deux ensemble : trop bas, la réponse est tronquée
# en plein JSON et l'offre part en échec pour rien.
MAX_TOKENS_REPONSE = 4_000

# Au-delà, une offre sort de la file d'attente. Garde-fou de facturation : sans
# lui, une offre qui fait systématiquement échouer l'appel serait retentée à
# chaque passage, indéfiniment, et chaque tentative est payante.
MAX_TENTATIVES = 3

# Ce que le modèle doit rendre. Les bornes 0-100 ne figurent PAS dans le schéma :
# la sortie structurée ne gère pas les contraintes numériques (elles seraient
# ignorées en silence). On les vérifie en Python, où le dépassement se voit.
SCHEMA_NOTATION = {
    "type": "object",
    "properties": {
        "note_interet": {
            "type": "integer",
            "description": "Adéquation du poste au profil, de 0 à 100. Ne tient aucun compte des chances d'être pris.",
        },
        "justification_interet": {
            "type": "string",
            "description": "Une à deux phrases disant ce qui, dans l'annonce, produit ce chiffre.",
        },
        "note_accessibilite": {
            "type": "integer",
            "description": "Probabilité que la candidature ne soit pas écartée d'emblée, de 0 à 100. Ne tient aucun compte de l'envie.",
        },
        "justification_accessibilite": {
            "type": "string",
            "description": "Une à deux phrases disant ce qui, dans l'annonce, produit ce chiffre.",
        },
        "resume": {
            "type": "string",
            "description": "Une phrase de 25 mots au maximum : ce que fait vraiment le poste.",
        },
    },
    "required": [
        "note_interet", "justification_interet",
        "note_accessibilite", "justification_accessibilite", "resume",
    ],
    "additionalProperties": False,
}


class ErreurNotation(RuntimeError):
    """Un appel au modèle a échoué ou rendu quelque chose d'inexploitable."""


# ---------------------------------------------------------------- le prompt

def charger_criteres() -> str:
    """Lit les critères versionnés, lignes `//` retirées.

    Les commentaires servent à la personne qui édite le fichier, pas au modèle :
    les envoyer gonflerait le préfixe facturé sans rien apprendre.

    ⚠️ **Le marqueur est `//`, surtout pas `#`.** Le fichier utilise `##` pour
    ses titres de section, et ces titres portent du sens : filtrer sur `#`
    emporterait « ## Note d'INTÉRÊT », laissant le paragraphe suivant commencer
    par « Elle mesure… » sans que le modèle sache de quelle note il s'agit. Le
    prompt reste grammaticalement correct, la notation devient du hasard, et
    rien ne le signale. Bug commis puis attrapé le 26 août 2026 par
    `--sans-appeler`, avant le premier appel facturé.
    """
    if not FICHIER_CRITERES.exists():
        raise ErreurNotation(f"Fichier de critères introuvable : {FICHIER_CRITERES}")
    lignes = [
        ligne for ligne in FICHIER_CRITERES.read_text(encoding="utf-8").splitlines()
        if not ligne.lstrip().startswith("//")
    ]
    texte = "\n".join(lignes).strip()
    if not texte:
        raise ErreurNotation(
            f"{FICHIER_CRITERES.name} ne contient aucun critère actif : "
            f"le modèle noterait sans savoir contre quoi."
        )
    return texte


def construire_systeme(criteres: str) -> list[dict[str, Any]]:
    """Le préfixe stable, identique pour toutes les offres, donc mis en cache.

    ⚠️ Rien de variable ne doit entrer ici — pas de date, pas d'identifiant
    d'offre, pas de compteur. Le cache est un appariement d'octets : un seul
    caractère qui change invalide tout ce qui suit, sans erreur ni message.
    """
    return [
        {
            "type": "text",
            "text": (
                "Tu évalues des offres d'emploi France Travail pour un candidat "
                "unique, contre les critères ci-dessous. Tu rends deux notes de 0 "
                "à 100 et leurs justifications.\n\n"
                "Les deux notes sont indépendantes : l'intérêt mesure l'envie, "
                "l'accessibilité mesure les chances. Une offre passionnante mais "
                "hors de portée a un intérêt haut et une accessibilité basse — "
                "c'est un cas normal, pas une contradiction.\n\n"
                "Juge sur le contenu réel de l'annonce, pas sur son intitulé. "
                "N'invente jamais un élément absent : si l'expérience exigée n'est "
                "pas indiquée, dis-le.\n\n"
                f"{criteres}"
            ),
            # Le seul marqueur de cache du prompt, sur le dernier bloc stable.
            "cache_control": {"type": "ephemeral"},
        }
    ]


def decrire_offre(offre: dict[str, Any]) -> str:
    """Met l'offre en texte pour le modèle, champ par champ.

    Les champs absents sont écrits « non précisé » plutôt qu'omis : le modèle
    doit pouvoir distinguer « l'employeur n'a pas rempli ce champ » de « ce
    champ n'existe pas », faute de quoi il comble le vide en devinant.
    """
    def valeur(cle: str) -> str:
        brut = offre.get(cle)
        if brut is None or (isinstance(brut, str) and not brut.strip()):
            return "non précisé"
        if isinstance(brut, list):
            return ", ".join(str(x) for x in brut) if brut else "non précisé"
        return str(brut).strip()

    return (
        f"Intitulé : {valeur('intitule')}\n"
        f"Entreprise : {valeur('entreprise_nom')}\n"
        f"Lieu : {valeur('lieu_libelle')}\n"
        f"Contrat : {valeur('type_contrat_libelle')} ({valeur('nature_contrat')})\n"
        f"Alternance : {'oui' if offre.get('alternance') else 'non précisé'}\n"
        f"Expérience exigée : {valeur('experience_libelle')}\n"
        f"Qualification : {valeur('qualification_libelle')}\n"
        f"Métier ROME : {valeur('rome_libelle')} / {valeur('appellation_libelle')}\n"
        f"Secteur : {valeur('secteur_activite_libelle')}\n"
        f"Salaire annoncé : {valeur('salaire_libelle')}\n"
        f"Compétences listées : {valeur('competences')}\n\n"
        f"Description intégrale de l'annonce :\n{valeur('description')}"
    )


def _parametres_appel(
    offre: dict[str, Any], systeme: list[dict[str, Any]], modele: str, effort: str
) -> dict[str, Any]:
    """Le corps de requête, identique en direct et en lot."""
    return {
        "model": modele,
        "max_tokens": MAX_TOKENS_REPONSE,
        "system": systeme,
        "output_config": {
            "effort": effort,
            "format": {"type": "json_schema", "schema": SCHEMA_NOTATION},
        },
        "messages": [{"role": "user", "content": decrire_offre(offre)}],
    }


# ------------------------------------------------------------- la réponse

def _lire_reponse(message: Any, identifiant: str) -> dict[str, Any]:
    """Extrait et valide la notation. Lève ErreurNotation si inexploitable.

    ⚠️ On regarde `stop_reason` AVANT de toucher au contenu. Un refus des
    classificateurs de sécurité rend un HTTP 200 avec un contenu vide : lire
    `content[0]` sans vérifier planterait sur une erreur incompréhensible au
    lieu de tracer un motif lisible.
    """
    if message.stop_reason == "refusal":
        raise ErreurNotation("le modèle a refusé de traiter cette annonce")
    if message.stop_reason == "max_tokens":
        raise ErreurNotation(
            f"réponse tronquée à {MAX_TOKENS_REPONSE} tokens — JSON incomplet"
        )

    texte = next((b.text for b in message.content if b.type == "text"), None)
    if not texte:
        raise ErreurNotation(f"réponse sans texte (stop_reason={message.stop_reason})")

    try:
        brut = json.loads(texte)
    except ValueError as echec:
        raise ErreurNotation(f"réponse illisible en JSON : {echec}") from echec

    notation = {}
    for cle in ("note_interet", "note_accessibilite"):
        note = brut.get(cle)
        if not isinstance(note, int) or not 0 <= note <= 100:
            # La base refuserait de toute façon ; on échoue ici avec un motif
            # lisible plutôt que sur une 400 opaque de PostgREST.
            raise ErreurNotation(f"{cle} hors bornes ou absente : {note!r}")
        notation[cle] = note

    for cle in ("justification_interet", "justification_accessibilite", "resume"):
        texte_champ = (brut.get(cle) or "").strip()
        if not texte_champ:
            raise ErreurNotation(f"{cle} vide — une note sans justification ne s'affiche pas")
        notation[cle] = texte_champ

    _journal.debug("Notation de %s lue : %s", identifiant, notation)
    return notation


def _consommation(usage: Any) -> ConsommationTokens:
    return ConsommationTokens(
        entree=usage.input_tokens or 0,
        sortie=usage.output_tokens or 0,
        cache_ecriture=getattr(usage, "cache_creation_input_tokens", 0) or 0,
        cache_lecture=getattr(usage, "cache_read_input_tokens", 0) or 0,
    )


def completer_avec_le_salaire(notation: dict[str, Any], offre: dict[str, Any]) -> dict[str, Any]:
    """Ajoute le salaire annualisé, calculé en Python et non demandé au modèle."""
    salaire = annualiser(offre.get("salaire_libelle"))
    return {
        **notation,
        "salaire_annuel_min": salaire.annuel_min,
        "salaire_annuel_max": salaire.annuel_max,
    }


# ------------------------------------------------------------ les appels

def noter_en_direct(
    client: anthropic.Anthropic, offres: list[dict[str, Any]], *,
    modele: str, effort: str, systeme: list[dict[str, Any]],
) -> list[tuple[dict[str, Any], dict[str, Any] | None, str | None, ConsommationTokens]]:
    """Un appel par offre, séquentiellement. Rend (offre, notation, motif, tokens).

    Une offre qui échoue n'interrompt pas les suivantes : son motif est rendu et
    la boucle continue. Un lot de deux cents offres ne doit pas être perdu parce
    que la trente-septième a une description pathologique.
    """
    resultats = []
    for rang, offre in enumerate(offres, start=1):
        identifiant = offre["identifiant"]
        _journal.info(
            "[%d/%d] %s — %s", rang, len(offres), identifiant, offre.get("intitule", "")[:60]
        )
        try:
            message = client.messages.create(**_parametres_appel(offre, systeme, modele, effort))
        except anthropic.APIStatusError as echec:
            resultats.append((offre, None, f"HTTP {echec.status_code} : {echec.message}", ConsommationTokens()))
            continue
        except anthropic.APIConnectionError as echec:
            resultats.append((offre, None, f"réseau : {echec}", ConsommationTokens()))
            continue

        tokens = _consommation(message.usage)
        _journal.info(
            "    tokens — entrée %d · sortie %d · cache écrit %d · cache lu %d",
            tokens.entree, tokens.sortie, tokens.cache_ecriture, tokens.cache_lecture,
        )
        try:
            notation = _lire_reponse(message, identifiant)
        except ErreurNotation as echec:
            resultats.append((offre, None, str(echec), tokens))
            continue
        resultats.append((offre, completer_avec_le_salaire(notation, offre), None, tokens))
    return resultats


def noter_en_lot(
    client: anthropic.Anthropic, offres: list[dict[str, Any]], *,
    modele: str, effort: str, systeme: list[dict[str, Any]], attente_secondes: int = 30,
) -> list[tuple[dict[str, Any], dict[str, Any] | None, str | None, ConsommationTokens]]:
    """Même travail via l'API Batches : moitié prix, jusqu'à une heure d'attente.

    ⚠️ **Le rattachement se fait par `custom_id`.** Les résultats reviennent
    dans un ordre quelconque ; les apparier par position donnerait à une offre
    les notes d'une autre, en silence et sans qu'aucune relecture ne le voie.
    """
    import time

    par_identifiant = {o["identifiant"]: o for o in offres}
    lot = client.messages.batches.create(requests=[
        {
            "custom_id": offre["identifiant"],
            "params": _parametres_appel(offre, systeme, modele, effort),
        }
        for offre in offres
    ])
    _journal.info("Lot %s déposé : %d offre(s). Attente des résultats…", lot.id, len(offres))

    while True:
        lot = client.messages.batches.retrieve(lot.id)
        if lot.processing_status == "ended":
            break
        _journal.info("  lot %s : %s", lot.id, lot.processing_status)
        time.sleep(attente_secondes)

    resultats = []
    vus = set()
    for resultat in client.messages.batches.results(lot.id):
        identifiant = resultat.custom_id
        vus.add(identifiant)
        offre = par_identifiant[identifiant]
        if resultat.result.type != "succeeded":
            resultats.append((offre, None, f"lot : {resultat.result.type}", ConsommationTokens()))
            continue
        message = resultat.result.message
        tokens = _consommation(message.usage)
        try:
            notation = _lire_reponse(message, identifiant)
        except ErreurNotation as echec:
            resultats.append((offre, None, str(echec), tokens))
            continue
        resultats.append((offre, completer_avec_le_salaire(notation, offre), None, tokens))

    # Une offre déposée dont aucun résultat ne revient est une offre perdue :
    # sans cette trace, elle ressortirait « jamais tentée » au passage suivant.
    for identifiant, offre in par_identifiant.items():
        if identifiant not in vus:
            resultats.append((offre, None, "aucun résultat rendu par le lot", ConsommationTokens()))
    return resultats


# ------------------------------------------------------------ orchestration

def executer(
    *, limite: int | None, modele: str, effort: str,
    en_lot: bool = False, sans_ecrire: bool = False, renoter: bool = False,
    rome: str | None = None, au_hasard: bool = False, collecte: int | None = None,
) -> int:
    """Note les offres en attente. Rend 0 en réussite, 1 en échec.

    La ligne d'`executions_veille` s'écrit AU DÉMARRAGE, en `etape='notation'` :
    une notation tuée net laisse une trace `en_cours` que le passage suivant
    refermera en `echec`, plutôt que de disparaître sans laisser de trace.
    """
    reglages = configuration.charger_notation()
    stockage = Stockage(reglages.supabase_url, reglages.supabase_secret_key)
    client = anthropic.Anthropic()

    offres = stockage.offres_a_noter(limite, max_tentatives=MAX_TENTATIVES, renoter=renoter,
                                     rome=rome, au_hasard=au_hasard,
                                     collecte=collecte)
    if not offres:
        _journal.info("Aucune offre en attente de note. Rien à faire.")
        return 0

    systeme = construire_systeme(charger_criteres())
    execution_id = stockage.ouvrir_execution(etape="notation")

    try:
        noter = noter_en_lot if en_lot else noter_en_direct
        resultats = noter(client, offres, modele=modele, effort=effort, systeme=systeme)
    except Exception as echec:  # noqa: BLE001 — on referme la trace avant de relancer
        stockage.fermer_execution(
            execution_id, issue="echec", modele=modele,
            motif_echec=f"{type(echec).__name__} : {echec}",
        )
        _journal.error("Notation interrompue : %s", echec)
        return 1

    total = ConsommationTokens()
    notees = 0
    for offre, notation, motif, tokens in resultats:
        total = total + tokens
        if notation is None:
            if not sans_ecrire:
                stockage.enregistrer_echec_notation(
                    offre, motif=motif or "motif inconnu",
                    execution_id=execution_id, modele=modele,
                )
            continue
        notees += 1
        if sans_ecrire:
            _journal.info("À BLANC — %s : %s", offre["identifiant"], notation)
        else:
            stockage.enregistrer_notation(
                offre, notation=notation, execution_id=execution_id,
                modele=modele, tokens=tokens,
            )

    echoues = len(resultats) - notees
    stockage.fermer_execution(
        execution_id,
        issue="reussite" if notees else "echec",
        motif_echec=None if notees else f"{echoues} offre(s) tentée(s), aucune notée",
        offres_notees=notees, modele=modele, tokens=total,
    )
    _journal.info(
        "%d offre(s) notée(s), %d en échec. Tokens : entrée %d · sortie %d · "
        "cache écrit %d · cache lu %d.",
        notees, echoues, total.entree, total.sortie, total.cache_ecriture, total.cache_lecture,
    )
    if total.cache_lecture == 0 and len(resultats) > 1:
        _journal.warning(
            "⚠️ Aucune lecture de cache sur %d appels : le préfixe n'est pas mis "
            "en cache. Vérifier qu'il dépasse 1024 tokens et qu'aucune valeur "
            "variable ne s'y est glissée.", len(resultats),
        )
    return 0 if notees else 1


# ---------------------------------------------------------------------------
# ⚠️ `--renoter` est MIS DE CÔTÉ depuis le 26 août 2026, et il porte un bug connu
# ---------------------------------------------------------------------------
#
# Il a servi à une seule chose : itérer sur `criteres_pertinence.txt` en renotant
# les mêmes offres, jusqu'à ce que le barème d'accessibilité soit correct. Ce
# travail est fait. Décision de Maxime le 26 août : **une offre n'est notée
# qu'une fois**, l'outil est conservé mais n'a plus d'usage quotidien.
#
# ⚠️ **Avant de le ressortir, corriger ceci.** `stockage.enregistrer_echec_notation()`
# écrit `notation_motif_echec` **sans toucher aux notes existantes**. Sur une
# offre déjà notée — c'est-à-dire uniquement en `--renoter` — le `PATCH` viole la
# contrainte `echec_sans_note` et Postgres renvoie 400 : la trace de l'échec est
# perdue, et l'exception remonte en plein milieu de la campagne.
#
# ⚠️ **Le correctif n'est PAS d'effacer les notes pour satisfaire la contrainte.**
# Ce serait détruire une note valide à cause d'un incident réseau. La contrainte
# dit « un échec veut dire pas de note », et elle a raison : une offre déjà notée
# dont la RE-notation échoue n'est pas en échec, elle garde simplement la note
# qu'elle avait. Le bon comportement est donc de n'écrire aucun motif dans ce cas
# et de se contenter d'incrémenter `notation_tentatives`. C'est une décision de
# conception, pas un correctif mécanique — d'où le fait qu'elle attende un usage
# réel plutôt que d'être tranchée à vide.
#
# Relevé en revue de code le 26 août 2026. Jamais déclenché : 0 échec sur 97 appels.


def apercevoir(*, limite: int, modele: str, renoter: bool = False) -> int:
    """Affiche le prompt exact et compte ses tokens SANS rien facturer.

    `count_tokens` est gratuit. Ce mode existe pour vérifier le prompt, la
    taille du préfixe et le franchissement du plancher de cache avant de
    dépenser le premier centime.
    """
    reglages = configuration.charger_notation()
    stockage = Stockage(reglages.supabase_url, reglages.supabase_secret_key)
    client = anthropic.Anthropic()

    offres = stockage.offres_a_noter(limite, max_tentatives=MAX_TENTATIVES, renoter=renoter)
    if not offres:
        print("Aucune offre en attente de note.")
        return 0

    systeme = construire_systeme(charger_criteres())
    prefixe = client.messages.count_tokens(model=modele, system=systeme,
                                           messages=[{"role": "user", "content": "."}])
    print("=" * 78)
    print("PRÉFIXE SYSTÈME (mis en cache, identique pour toutes les offres)")
    print("=" * 78)
    print(systeme[0]["text"])
    print()
    print(f"→ {prefixe.input_tokens} tokens, plancher de cache Sonnet 5 = 1024 : "
          f"{'AU-DESSUS, le cache mordra' if prefixe.input_tokens >= 1024 else 'EN DESSOUS, RIEN NE SERA MIS EN CACHE'}")

    for offre in offres:
        corps = decrire_offre(offre)
        mesure = client.messages.count_tokens(model=modele, system=systeme,
                                              messages=[{"role": "user", "content": corps}])
        print()
        print("=" * 78)
        print(f"OFFRE {offre['identifiant']} — {offre.get('intitule')}")
        print("=" * 78)
        print(corps)
        print()
        print(f"→ {mesure.input_tokens} tokens en tout "
              f"({mesure.input_tokens - prefixe.input_tokens} pour l'offre seule)")
    print()
    print("Aucun appel facturé : count_tokens est gratuit.")
    return 0


def main() -> int:
    analyseur = argparse.ArgumentParser(
        description="Note les offres collectées contre les critères de pertinence.",
    )
    analyseur.add_argument("--limite", type=int, default=None,
                           help="nombre maximum d'offres à noter (défaut : toutes)")
    analyseur.add_argument("--modele", default=MODELE_PAR_DEFAUT,
                           help=f"identifiant du modèle (défaut : {MODELE_PAR_DEFAUT})")
    analyseur.add_argument("--effort", default="low", choices=("low", "medium", "high", "xhigh", "max"),
                           help="profondeur de réflexion du modèle (défaut : low)")
    analyseur.add_argument("--lot", action="store_true",
                           help="passer par l'API Batches : moitié prix, jusqu'à une heure d'attente")
    analyseur.add_argument("--sans-ecrire", action="store_true",
                           help="appeler le modèle mais ne rien écrire en base")
    analyseur.add_argument("--sans-appeler", action="store_true",
                           help="afficher le prompt et compter ses tokens sans rien facturer")
    analyseur.add_argument("--rome", default=None,
                           help="ne noter que les offres d'un code ROME (ex. H1206)")
    analyseur.add_argument("--au-hasard", action="store_true",
                           help="tirer l'échantillon au hasard au lieu de prendre les plus récentes "
                                "— indispensable pour mesurer un gisement")
    analyseur.add_argument("--collecte", type=int, default=None,
                           help="ne noter que les offres trouvées par cette exécution de collecte")
    analyseur.add_argument("--renoter", action="store_true",
                           help="reprendre les offres DÉJÀ notées, les plus récentes d'abord "
                                "— outil d'étalonnage MIS DE CÔTÉ, voir la note ci-dessous. "
                                "Chaque offre est repayée")
    arguments = analyseur.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(name)s | %(message)s",
        datefmt="%H:%M:%S",
    )

    if arguments.limite is not None and arguments.limite <= 0:
        analyseur.error("--limite doit être strictement positif.")

    try:
        if arguments.sans_appeler:
            return apercevoir(limite=arguments.limite or 1, modele=arguments.modele,
                              renoter=arguments.renoter)
        return executer(
            limite=arguments.limite, modele=arguments.modele, effort=arguments.effort,
            en_lot=arguments.lot, sans_ecrire=arguments.sans_ecrire,
            renoter=arguments.renoter, rome=arguments.rome,
            au_hasard=arguments.au_hasard, collecte=arguments.collecte,
        )
    except (configuration.ConfigurationIncomplete, ErreurNotation, ErreurStockage) as echec:
        _journal.error("%s", echec)
        return 1


if __name__ == "__main__":
    sys.exit(main())
