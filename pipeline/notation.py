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
from pipeline import employeur
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
        # L'employeur réel, lu dans le texte de l'annonce. Défini dans
        # `pipeline.employeur` pour n'exister qu'à un seul endroit : le mode de
        # rattrapage `--completer-entreprise` demande exactement les mêmes
        # champs, et deux définitions du même schéma finissent toujours par
        # diverger.
        **employeur.CHAMPS_SCHEMA,
    },
    "required": [
        "note_interet", "justification_interet",
        "note_accessibilite", "justification_accessibilite", "resume",
        # ⚠️ Requis, mais `entreprise_identifiee` accepte `null`. Un champ
        # facultatif serait simplement omis dès que la réponse est difficile ;
        # requis-mais-nullable force le modèle à trancher explicitement.
        "entreprise_identifiee", "entreprise_intermediaire",
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
                # La consigne d'identification de l'employeur vit dans le code,
                # pas dans `criteres_pertinence.txt` : ce fichier est une donnée
                # décrivant le profil de Maxime et les barèmes. Identifier une
                # entreprise n'est pas un critère de pertinence.
                f"{employeur.CONSIGNE}\n\n"
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

def _lire_reponse(message: Any, offre: dict[str, Any]) -> dict[str, Any]:
    """Extrait et valide la notation. Lève ErreurNotation si inexploitable.

    ⚠️ On regarde `stop_reason` AVANT de toucher au contenu. Un refus des
    classificateurs de sécurité rend un HTTP 200 avec un contenu vide : lire
    `content[0]` sans vérifier planterait sur une erreur incompréhensible au
    lieu de tracer un motif lisible.

    ⚠️ **Prend l'offre entière et pas seulement son identifiant**, parce que la
    vérification de l'employeur a besoin du texte qu'on a envoyé au modèle :
    c'est en cherchant le nom rendu *dans ce texte* qu'on écarte une invention.
    """
    identifiant = offre["identifiant"]
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

    # ⚠️ Volontairement APRÈS les contrôles bloquants ci-dessus, et lui-même non
    # bloquant. Un employeur absent ou rejeté laisse deux colonnes à NULL ; le
    # faire échouer ferait perdre des notes déjà payées pour un champ
    # d'affichage, et l'offre repasserait à la notation la nuit suivante.
    notation.update(employeur.lire(brut, offre))

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
            notation = _lire_reponse(message, offre)
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
            notation = _lire_reponse(message, offre)
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
    derniere_collecte: bool = False,
) -> int:
    """Note les offres en attente. Rend 0 en réussite, 1 en échec.

    La ligne d'`executions_veille` s'écrit AU DÉMARRAGE, en `etape='notation'` :
    une notation tuée net laisse une trace `en_cours` que le passage suivant
    refermera en `echec`, plutôt que de disparaître sans laisser de trace.
    """
    reglages = configuration.charger_notation()
    stockage = Stockage(reglages.supabase_url, reglages.supabase_secret_key)
    client = anthropic.Anthropic()

    if derniere_collecte:
        collecte = stockage.derniere_collecte_reussie_id()
        if collecte is None:
            # Aucune collecte n'a jamais réussi : il n'y a rien de neuf à noter.
            # On sort en RÉUSSITE, pas en échec — le job du soir n'a pas planté,
            # il n'avait simplement rien à faire.
            _journal.info("Aucune collecte réussie en base : rien à noter.")
            return 0
        _journal.info("Notation restreinte à la collecte #%d.", collecte)

    offres = stockage.offres_a_noter(limite, max_tentatives=MAX_TENTATIVES, renoter=renoter,
                                     rome=rome, au_hasard=au_hasard,
                                     collecte=collecte)
    if not offres:
        _journal.info("Aucune offre en attente de note. Rien à faire.")
        return 0

    # ⚠️ Une limite qui mord doit se VOIR dans les journaux. Le cron nocturne en
    # porte une comme garde-fou de facturation ; le jour où une collecte ramène
    # plus que prévu, des offres restent sans note — et avec `--derniere-collecte`
    # elles ne repasseront JAMAIS, la nuit suivante se restreignant à SA propre
    # collecte. Sans cet avertissement, le job serait vert et les offres
    # manquantes invisibles. Ce n'est pas une erreur, c'est une décision qui doit
    # laisser une trace.
    if limite is not None and len(offres) == limite:
        _journal.warning(
            "La limite de %d est atteinte : d'autres offres peuvent rester sans note. "
            "Avec --derniere-collecte elles ne seront pas reprises automatiquement.",
            limite,
        )

    systeme = construire_systeme(charger_criteres())

    # ⚠️ **`--sans-ecrire` n'ouvrait PAS de ligne d'exécution avant le 28 août
    # 2026 : il en ouvrait une, et c'était un bug.** `ouvrir_execution` et
    # `fermer_execution` tournaient inconditionnellement, donc une passe à blanc
    # sur 3 offres déposait en base une ligne `reussite, offres_notees=3` alors
    # qu'aucune note n'était écrite dans `offres`. Rien ne plantait, rien ne
    # s'affichait : seul l'historique était faux — celui-là même que l'écran de
    # suivi d'exploitation lira, et qui « ne se reconstitue pas ».
    #
    # `collecte.py` porte la règle en toutes lettres depuis toujours : « Tout
    # sauf l'écriture doit vouloir dire tout sauf l'écriture ». La notation ne
    # la tenait pas. Un drapeau dont le nom promet l'inertie doit être inerte,
    # sinon il est pire que son absence — on s'en sert pour tester sans risque.
    execution_id = 0 if sans_ecrire else stockage.ouvrir_execution(etape="notation")

    try:
        noter = noter_en_lot if en_lot else noter_en_direct
        resultats = noter(client, offres, modele=modele, effort=effort, systeme=systeme)
    except Exception as echec:  # noqa: BLE001 — on referme la trace avant de relancer
        if not sans_ecrire:
            stockage.fermer_execution(
                execution_id, issue="echec", modele=modele, etape="notation",
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
    if sans_ecrire:
        _journal.info(
            "À BLANC : %d offre(s) auraient été notée(s), %d en échec. "
            "Aucune ligne d'exécution, aucune note écrite.", notees, echoues,
        )
    else:
        stockage.fermer_execution(
            execution_id,
            issue="reussite" if notees else "echec",
            motif_echec=None if notees else f"{echoues} offre(s) tentée(s), aucune notée",
            offres_notees=notees, modele=modele, tokens=total, etape="notation",
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


def completer_les_employeurs(
    *, note_minimale: int, limite: int | None, modele: str, effort: str,
    sans_ecrire: bool = False, sans_appeler: bool = False,
) -> int:
    """Identifie l'employeur d'offres DÉJÀ notées, sans repayer leur notation.

    **Ce qui entre** : les offres notées au-dessus du seuil, encore à traiter, et
    dont `entreprise_identifiee` est vide.
    **Ce qui sort** : les deux colonnes d'employeur remplies. Les notes, elles,
    ne bougent pas d'un iota.
    **Ce qui casse s'il tombe** : rien. Les offres gardent le nom brut de France
    Travail et la commande se relance sans repayer ce qui est déjà écrit.

    ⚠️ **Ce mode existe parce que la notation est incrémentale.** `offres_a_noter`
    filtre sur `note_interet=is.null` : les 146 offres notées avant le 30 août
    2026 ne repasseront jamais par le modèle, donc leur employeur ne serait
    jamais identifié. Sans ce chemin, la nouvelle colonne ne se remplirait que
    pour l'avenir et les fiches déjà ouvertes resteraient fausses.

    ⚠️ **Ce n'est PAS `--renoter` déguisé.** Il n'ouvre aucune exécution, n'écrit
    aucune note et ne touche pas à `notation_tentatives` : le compteur borne la
    facturation de la *notation*, et l'incrémenter ici rapprocherait des offres
    parfaitement notées de leur plafond de tentatives pour une opération qui n'a
    rien à voir.
    """
    reglages = configuration.charger_notation()
    stockage = Stockage(reglages.supabase_url, reglages.supabase_secret_key)
    client = anthropic.Anthropic()

    offres = stockage.offres_sans_employeur(note_minimale=note_minimale, limite=limite)
    if not offres:
        _journal.info("Aucune offre notée au-dessus de %d n'attend son employeur.",
                      note_minimale)
        return 0

    systeme = [{"type": "text", "text": employeur.SYSTEME_RATTRAPAGE}]

    if sans_appeler:
        prefixe = client.messages.count_tokens(model=modele, system=systeme,
                                               messages=[{"role": "user", "content": "."}])
        print("=" * 78)
        print("PRÉFIXE SYSTÈME DU RATTRAPAGE D'EMPLOYEUR")
        print("=" * 78)
        print(employeur.SYSTEME_RATTRAPAGE)
        print(f"\n→ {prefixe.input_tokens} tokens de préfixe.")
        total = 0
        for offre in offres:
            mesure = client.messages.count_tokens(
                model=modele, system=systeme,
                messages=[{"role": "user", "content": decrire_offre(offre)}])
            total += mesure.input_tokens
            print(f"  {offre['identifiant']} — {mesure.input_tokens} tokens — "
                  f"{(offre.get('intitule') or '')[:52]}")
        print(f"\n{len(offres)} offre(s), {total} tokens d'entrée en tout.")
        print("Aucun appel facturé : count_tokens est gratuit.")
        return 0

    # ⚠️ **Le nombre d'appels FACTURÉS s'annonce avant de commencer.** Les
    # filtres bornent le lot à une vingtaine d'offres aujourd'hui, mais c'est un
    # état de la base, pas une garantie du code : le jour où le seuil descend ou
    # où l'arriéré grossit, un lancement sans `--limite` part sur tout le lot.
    # Relevé en revue le 30 août 2026. La règle du projet est de prévenir avant
    # toute dépense, et un journal qui ne dit pas « facturé » ne prévient pas.
    _journal.info(
        "%d offre(s) à compléter (note ≥ %d, encore à traiter) — "
        "autant d'appels FACTURÉS au modèle.%s",
        len(offres), note_minimale,
        "" if limite is not None else " Aucune limite posée : utiliser --limite pour borner.",
    )

    consommation = ConsommationTokens()
    identifies = rejetes = echecs = 0

    for rang, offre in enumerate(offres, start=1):
        identifiant = offre["identifiant"]
        _journal.info("[%d/%d] %s — %s", rang, len(offres), identifiant,
                      (offre.get("intitule") or "")[:60])
        try:
            message = client.messages.create(
                model=modele,
                max_tokens=MAX_TOKENS_REPONSE,
                system=systeme,
                output_config={"effort": effort,
                               "format": {"type": "json_schema",
                                          "schema": employeur.SCHEMA_SEUL}},
                messages=[{"role": "user", "content": decrire_offre(offre)}],
            )
        except (anthropic.APIStatusError, anthropic.APIConnectionError) as echec:
            # Une offre qui échoue n'interrompt pas les suivantes : même règle
            # que la notation, un lot ne se perd pas pour une annonce.
            _journal.warning("    échec de l'appel : %s", echec)
            echecs += 1
            continue

        tokens = _consommation(message.usage)
        consommation = consommation + tokens

        if message.stop_reason in ("refusal", "max_tokens"):
            _journal.warning("    réponse inexploitable (%s)", message.stop_reason)
            echecs += 1
            continue
        texte = next((b.text for b in message.content if b.type == "text"), None)
        try:
            brut = json.loads(texte or "")
        except ValueError as echec:
            _journal.warning("    réponse illisible en JSON : %s", echec)
            echecs += 1
            continue

        resultat = employeur.lire(brut, offre)
        trouve = bool(resultat["entreprise_identifiee"])
        if trouve:
            _journal.info("    → %s%s", resultat["entreprise_identifiee"],
                          " (via un intermédiaire)" if resultat["entreprise_intermediaire"] else "")
        else:
            # Distingue « le modèle a répondu null » de « le nom a été rejeté
            # par la vérification » : le second est journalisé en warning par
            # `employeur.verifier()` juste au-dessus, avec le nom fautif.
            _journal.info("    → aucun employeur identifiable")

        if not sans_ecrire:
            try:
                stockage.enregistrer_employeur(offre, resultat=resultat, tokens=tokens)
            except ErreurStockage as echec:
                # ⚠️ **On compte l'offre ICI et nulle part ailleurs**, sinon elle
                # entre à la fois dans `identifies` et dans `echecs` et les
                # totaux du bilan ne se recoupent plus. Défaut relevé en revue le
                # 30 août 2026 : ce récapitulatif est le seul compte rendu qu'on
                # ait de la commande, il ne doit pas mentir sur son propre lot.
                _journal.warning("    écriture refusée : %s", echec)
                echecs += 1
                continue

        identifies += trouve
        rejetes += not trouve

    _journal.info(
        "Terminé : %d identifié(s), %d sans employeur, %d échec(s). "
        "Tokens — entrée %d · sortie %d.%s",
        identifies, rejetes, echecs,
        consommation.entree, consommation.sortie,
        " AUCUNE ÉCRITURE (--sans-ecrire)." if sans_ecrire else "",
    )
    # Un échec isolé ne fait pas rougir la commande : les offres concernées
    # restent sans employeur et la relance les reprendra, puisque le filtre de
    # lecture est `entreprise_identifiee=is.null`.
    return 0


def apercevoir(
    *, limite: int, modele: str, renoter: bool = False,
    rome: str | None = None, au_hasard: bool = False, collecte: int | None = None,
    derniere_collecte: bool = False,
) -> int:
    """Affiche le prompt exact et compte ses tokens SANS rien facturer.

    `count_tokens` est gratuit. Ce mode existe pour vérifier le prompt, la
    taille du préfixe et le franchissement du plancher de cache avant de
    dépenser le premier centime.

    ⚠️ **Il reçoit exactement les mêmes filtres de sélection qu'`executer()`, et
    ce n'est pas de la symétrie décorative.** Jusqu'au 26 août 2026 il n'en
    acceptait aucun : `--sans-appeler --rome H1206` affichait le prompt d'une
    offre **quelconque**, sans le moindre avertissement. Un aperçu qui ne montre
    pas l'offre qui sera réellement notée est pire que pas d'aperçu du tout —
    c'est un piège de mesure, puisqu'on croit vérifier ce qu'on s'apprête à
    envoyer.
    """
    reglages = configuration.charger_notation()
    stockage = Stockage(reglages.supabase_url, reglages.supabase_secret_key)
    client = anthropic.Anthropic()

    if derniere_collecte:
        collecte = stockage.derniere_collecte_reussie_id()
        if collecte is None:
            print("Aucune collecte réussie en base : rien à apercevoir.")
            return 0
        print(f"→ Aperçu restreint à la collecte #{collecte}.")

    offres = stockage.offres_a_noter(limite, max_tentatives=MAX_TENTATIVES, renoter=renoter,
                                     rome=rome, au_hasard=au_hasard, collecte=collecte)
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
    analyseur.add_argument("--derniere-collecte", action="store_true",
                           help="ne noter que les offres trouvées par la dernière collecte "
                                "RÉUSSIE — c'est le mode du cron nocturne, celui qui borne "
                                "la dépense à ce qui vient d'arriver")
    analyseur.add_argument("--completer-entreprise", action="store_true",
                           help="RATTRAPAGE : identifier l'employeur d'offres DÉJÀ notées, "
                                "sans toucher à leurs notes. N'existe que parce que la "
                                "notation est incrémentale et ne les reprendra jamais")
    # ⚠️ **40 depuis le 31 août 2026, et le nombre doit SUIVRE l'interface.** Son
    # sens n'est pas « une note passable » mais « une offre que Maxime voit
    # réellement à l'écran » : payer l'identification d'un employeur sur une
    # offre invisible est une dépense pure. Il valait 35 tant que c'était le
    # seuil de l'écran du matin ; depuis que `SEUIL_INTERET`
    # (`interface/lib/filtres.ts`) vaut 40 et borne les DEUX écrans, c'est lui
    # qu'il faut recopier. ⚠️ Les deux nombres ne peuvent pas être partagés —
    # Python d'un côté, TypeScript de l'autre — donc c'est ce commentaire qui
    # porte le lien. **Un seuil d'interface abaissé sans toucher ici ne casse
    # rien : il laisse seulement des fiches au nom brut de France Travail.**
    analyseur.add_argument("--note-minimale", type=int, default=40,
                           help="avec --completer-entreprise : seuil d'intérêt en dessous "
                                "duquel on ne paie pas l'identification (défaut : 40, le "
                                "seuil d'affichage de l'interface)")
    arguments = analyseur.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(name)s | %(message)s",
        datefmt="%H:%M:%S",
    )

    if arguments.limite is not None and arguments.limite <= 0:
        analyseur.error("--limite doit être strictement positif.")

    # Les deux désignent un lot d'offres, l'un par son numéro, l'autre « la
    # dernière ». Les accepter ensemble obligerait à décider lequel gagne, et
    # ce choix serait invisible dans les journaux du cron.
    if arguments.derniere_collecte and arguments.collecte is not None:
        analyseur.error("--derniere-collecte et --collecte s'excluent : "
                        "choisir la dernière collecte, ou en désigner une par son numéro.")

    # ⚠️ Le mode nocturne ne reprend JAMAIS d'offres déjà notées. La combinaison
    # noterait deux fois les mêmes offres, chaque nuit, en silence et à chaque
    # fois payante — exactement ce que le filtre incrémental existe pour éviter.
    if arguments.derniere_collecte and arguments.renoter:
        analyseur.error("--derniere-collecte et --renoter s'excluent : "
                        "le mode nocturne ne repaie jamais une offre déjà notée.")

    # ⚠️ Le rattrapage s'exclut de tout ce qui désigne un lot À NOTER. Les
    # accepter ensemble obligerait à décider lequel gagne, et ce choix serait
    # invisible dans les journaux.
    if arguments.completer_entreprise and (
        arguments.renoter or arguments.lot or arguments.derniere_collecte
        or arguments.collecte is not None or arguments.rome or arguments.au_hasard
    ):
        analyseur.error("--completer-entreprise ne note rien : il ne se combine ni avec "
                        "--renoter, --lot, --derniere-collecte, --collecte, --rome, "
                        "ni avec --au-hasard.")

    try:
        if arguments.completer_entreprise:
            return completer_les_employeurs(
                note_minimale=arguments.note_minimale, limite=arguments.limite,
                modele=arguments.modele, effort=arguments.effort,
                sans_ecrire=arguments.sans_ecrire, sans_appeler=arguments.sans_appeler,
            )
        if arguments.sans_appeler:
            return apercevoir(limite=arguments.limite or 1, modele=arguments.modele,
                              renoter=arguments.renoter, rome=arguments.rome,
                              au_hasard=arguments.au_hasard, collecte=arguments.collecte,
                              derniere_collecte=arguments.derniere_collecte)
        return executer(
            limite=arguments.limite, modele=arguments.modele, effort=arguments.effort,
            en_lot=arguments.lot, sans_ecrire=arguments.sans_ecrire,
            renoter=arguments.renoter, rome=arguments.rome,
            au_hasard=arguments.au_hasard, collecte=arguments.collecte,
            derniere_collecte=arguments.derniere_collecte,
        )
    except (configuration.ConfigurationIncomplete, ErreurNotation, ErreurStockage) as echec:
        _journal.error("%s", echec)
        return 1


if __name__ == "__main__":
    sys.exit(main())
