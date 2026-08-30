"""L'employeur réel d'une offre, extrait du texte de l'annonce.

**Ce qui entre** : la réponse JSON du modèle, et l'offre telle qu'elle a été
envoyée.
**Ce qui sort** : un nom d'entreprise vérifié, ou `None`.
**Ce qui casse s'il tombe** : rien de bloquant. Une offre garde ses notes et
perd seulement son employeur identifié — la colonne reste `NULL`, ce qui est
déjà le cas normal pour les 580 offres antérieures.

---

**Le problème, mesuré le 30 août 2026 sur 580 offres réelles.**
`entreprise_nom` vient du champ `entreprise.nom` de France Travail. Il est
absent sur **39 %** des offres, désigne un intermédiaire dans **36 %** des cas
(« notre client », cabinet, agence, organisateur de forum), et il est **parfois
faux** : l'offre `6426819` l'annonce à « NEW NET 3D » quand sa description dit
« L'entreprise Wavestone recherche actuellement des profils ».

**La décision d'architecture, et pourquoi elle tient.** L'extraction se fait
dans l'appel de notation qui existe déjà, pas dans un appel supplémentaire. Le
modèle lit de toute façon la description entière (1 418 tokens sur l'offre
témoin) ; deux champs de plus en sortie coûtent ~30 tokens, soit **0,03 centime
par offre**. Un second appel coûterait dix fois ça pour relire le même texte.
C'est la même règle que le cache de prompt : *on ne paie pas deux fois la
lecture d'un document qui n'a pas changé.*

⚠️ **Le modèle propose, le code vérifie — et c'est le cœur de ce module.**
Demander « quelle est l'entreprise ? » à un modèle finit toujours par produire
une entreprise, y compris quand l'annonce n'en nomme aucune. Le garde-fou n'est
pas une consigne mais une vérification déterministe : `verifier()` contrôle que
le nom rendu apparaît **littéralement** dans le texte qu'on a envoyé. S'il n'y
est pas, il est jeté. Une consigne se contourne, une comparaison de chaînes non.
C'est la même règle que le salaire, calculé en Python plutôt que demandé au
modèle : **ce qui se vérifie ne se croit pas.**
"""
from __future__ import annotations

import logging
import re
import unicodedata
from typing import Any

_journal = logging.getLogger(__name__)

# Plus strict que la contrainte `entreprise_identifiee_courte` de la base, qui
# accepte 200 caractères.
#
# ⚠️ **Le sens de cet écart est le seul qui évite un 400 silencieux.** Si la
# base était la plus stricte des deux, un nom de 150 caractères passerait tous
# les contrôles Python pour mourir sur une erreur PostgREST opaque, en pleine
# notation nocturne, sur une offre déjà facturée. Dans ce sens-ci, le pire cas
# est un nom rejeté et journalisé.
#
# 120 caractères est très large : le plus long nom observé sur 580 offres en
# fait 44. Cette borne n'existe pas pour couper des noms légitimes, mais pour
# arrêter un modèle qui rendrait une phrase (« l'entreprise n'est pas nommée
# dans cette annonce ») au lieu d'un nom.
LONGUEUR_MAXIMALE = 120

# Le plancher, ajouté après une revue du 30 août 2026 : `LONGUEUR_MAXIMALE`
# bornait le haut et **rien ne bornait le bas**.
#
# ⚠️ **Le défaut n'était pas théorique, et il jouait dans le mauvais sens.**
# `verifier("IA", offre)` rendait « IA », parce que ces deux lettres figurent
# dans presque toutes les descriptions du corpus. Or `lireEmployeur()` fait
# *gagner* le nom identifié sur celui de France Travail : un fragment pareil
# aurait remplacé « Institut Curie » par « IA » à l'écran — exactement
# l'affichage trompeur que ce module existe pour empêcher, à l'envers.
#
# 3 est le plus haut plancher qu'on puisse poser sans perdre de vrais noms :
# « BnF », « IBM », « SAP », « CGI » en font trois. Il élimine « IA » et « AI »,
# les deux fragments réellement dangereux ici puisque tout le corpus tourne
# autour d'eux.
LONGUEUR_MINIMALE = 3

# Ce que le modèle doit rendre EN PLUS de sa notation. Fusionné dans
# `SCHEMA_NOTATION` par `pipeline.notation` — écrit ici pour qu'il n'existe
# qu'une seule définition, partagée par la notation et le mode de rattrapage.
#
# ⚠️ **`null` doit être une réponse possible**, sinon le modèle est acculé à
# inventer un nom pour respecter le schéma — la sortie structurée est une
# contrainte de FORME, elle ne rend pas le contenu vrai.
#
# ⚠️ Écrit en `anyOf` et non en `"type": ["string", "null"]`. Les deux sont du
# JSON Schema valide, mais la sortie structurée d'Anthropic documente
# explicitement `anyOf` dans ses constructions supportées, là où l'union de
# types en tableau n'y figure pas. Un schéma refusé se manifesterait par une
# 400 sur *toutes* les offres, en pleine notation nocturne.
CHAMPS_SCHEMA = {
    "entreprise_identifiee": {
        "anyOf": [{"type": "string"}, {"type": "null"}],
        "description": (
            "Le nom de l'entreprise où la personne travaillerait vraiment, "
            "recopié LITTÉRALEMENT depuis le texte de l'annonce. null si "
            "l'annonce ne le nomme pas."
        ),
    },
    "entreprise_intermediaire": {
        "type": "boolean",
        "description": (
            "true si l'annonce est déposée par un tiers qui n'embauchera PAS "
            "lui-même : cabinet de recrutement, agence d'intérim, organisateur "
            "de forum. false pour une ESN ou une société de conseil, qui "
            "embauche elle-même avant de placer la personne en mission."
        ),
    },
}

# La consigne envoyée au modèle. Vit dans le prompt SYSTÈME (donc dans le
# préfixe mis en cache), pas dans `criteres_pertinence.txt` : ce fichier est une
# donnée qui décrit le profil de Maxime et les barèmes de notation. Identifier
# un employeur n'est pas un critère de pertinence, c'est une consigne de tâche.
#
# ⚠️ Les deux phrases sur l'invention ne sont PAS décoratives : elles réduisent
# le nombre de noms que `verifier()` aura à rejeter. Elles ne le garantissent
# pas — c'est la vérification qui garantit.
CONSIGNE = (
    "Tu identifies aussi l'employeur réel.\n\n"
    "Le champ « Entreprise » que France Travail fournit est absent 4 fois sur "
    "10, désigne souvent un intermédiaire et il est parfois carrément faux. Le "
    "nom de l'employeur, lui, est très souvent écrit dans le texte de "
    "l'annonce.\n\n"
    "**Ce qu'on cherche est l'entité qui EMBAUCHE — celle qui signerait le "
    "contrat de travail**, pas le lieu où se déroulerait la mission. Deux cas "
    "à ne pas confondre :\n\n"
    "1. L'annonce est déposée par un **cabinet de recrutement, une agence "
    "d'intérim ou un organisateur de forum** pour le compte d'une autre "
    "entreprise : c'est **cette autre entreprise** qu'il faut rendre, puisque "
    "c'est elle qui embauchera. Exemple : une annonce publiée par « Talents "
    "Handicap » qui dit « L'entreprise Wavestone recherche des profils » — "
    "rends « Wavestone ».\n"
    "2. L'annonce vient d'une **ESN, d'une société de conseil ou de services** "
    "qui embauche elle-même pour placer ensuite la personne en mission chez "
    "ses clients : c'est **l'ESN** qu'il faut rendre, c'est elle l'employeur. "
    "**Ne rends jamais le nom du client final dans ce cas**, même si l'annonce "
    "le cite.\n\n"
    "Si le champ « Entreprise » fourni est déjà cet employeur et qu'il "
    "apparaît dans le texte, redonne-le tel quel.\n\n"
    "Recopie le nom **caractère pour caractère depuis le texte que je te "
    "donne**. Ne le complète pas, ne le corrige pas, n'ajoute ni forme "
    "juridique ni groupe : si l'annonce écrit « Wavestone », rends "
    "« Wavestone », pas « Groupe Wavestone » ni « Wavestone SA ».\n\n"
    "Rends `null` seulement si aucun employeur n'est nommé dans le texte. "
    "C'est une réponse acceptable — une annonce de cabinet qui ne nomme pas "
    "son client est un cas normal. N'utilise jamais ce que tu sais par "
    "ailleurs d'une entreprise pour deviner laquelle recrute : un nom qui ne "
    "figure pas dans le texte sera rejeté automatiquement."
)

# Le prompt du mode de rattrapage : identifier l'employeur d'offres DÉJÀ notées,
# sans repayer leur notation.
#
# ⚠️ **Court à dessein, et ce n'est pas une économie de bouts de chandelle.**
# Envoyer `criteres_pertinence.txt` (3 400 tokens) reviendrait à faire renoter
# l'offre pour n'en garder qu'un nom — le double du prix, et surtout le risque
# de croire qu'on peut réutiliser les notes produites au passage. Elles ne le
# sont pas : deux notations de la même annonce ne rendent pas le même chiffre
# (68 contre 45 sur la paire mesurée le 30 août 2026).
#
# ⚠️ Aucun `cache_control` : ce préfixe fait quelques centaines de tokens, sous
# le plancher de 1024 de Sonnet 5. Le marquer ne mettrait rien en cache et
# n'afficherait aucune erreur — exactement le piège que `notation.py` documente.
SYSTEME_RATTRAPAGE = (
    "Tu lis une offre d'emploi France Travail et tu identifies l'employeur "
    "réel. Tu ne notes rien, tu n'évalues rien.\n\n" + CONSIGNE
)

# Le schéma du mode de rattrapage : les deux mêmes champs, sans la notation.
SCHEMA_SEUL = {
    "type": "object",
    "properties": CHAMPS_SCHEMA,
    "required": ["entreprise_identifiee", "entreprise_intermediaire"],
    "additionalProperties": False,
}


def _normaliser(texte: str) -> str:
    """Ramène un texte à une forme comparable : minuscules, sans accents.

    Trois transformations, chacune pour un cas rencontré dans les vraies
    annonces :

    * **Accents retirés** — le modèle recopie « Société Générale » quand
      l'annonce écrit parfois « SOCIETE GENERALE » en capitales sans accents,
      les capitales accentuées étant souvent perdues à la saisie.
    * **Minuscules** — beaucoup d'annonces écrivent l'employeur tout en
      capitales dans un intertitre et en casse normale dans le corps.
    * **Blancs réduits à un espace simple** — les descriptions France Travail
      sont truffées de sauts de ligne et de doubles espaces ; un nom en deux
      mots peut être coupé par un retour à la ligne.

    ⚠️ **Rien ici ne doit devenir « intelligent ».** Chaque tolérance ajoutée
    est une porte ouverte à un nom inventé qui ressemblerait de loin à un mot
    du texte. La comparaison doit rester ennuyeuse et prévisible.
    """
    sans_accents = "".join(
        caractere
        for caractere in unicodedata.normalize("NFD", texte)
        if unicodedata.category(caractere) != "Mn"
    )
    # Les apostrophes typographiques et droites sont interchangeables à la
    # saisie ; « L'Oréal » ne doit pas échouer parce que le modèle a recopié
    # l'une pour l'autre.
    uniformise = sans_accents.replace("’", "'").replace("ʼ", "'")
    return re.sub(r"\s+", " ", uniformise).strip().lower()


def verifier(nom: Any, offre: dict[str, Any]) -> str | None:
    """Rend le nom s'il apparaît vraiment dans l'annonce, `None` sinon.

    **C'est la fonction qui empêche une hallucination d'entrer en base.** Elle
    est pure : aucun réseau, aucune écriture, entièrement rejouable.

    Le texte de référence est **tout ce que le modèle a vu** — l'intitulé, la
    description et le champ `entreprise_nom` de France Travail. Ce dernier
    compte : quand France Travail dit vrai (« THALES », confirmé par le modèle)
    mais que la description ne répète jamais le nom, le rejeter serait perdre
    une identification correcte. Le contrat est « ce nom vient de l'annonce que
    je t'ai montrée », pas « ce nom vient de la description ».
    """
    if not isinstance(nom, str):
        # Couvre `None` (le cas normal : le modèle n'a rien trouvé) et un type
        # inattendu, qui ne mérite pas plus de cérémonie.
        return None

    propre = nom.strip()
    if not propre:
        return None
    if len(propre) > LONGUEUR_MAXIMALE:
        _journal.warning(
            "Employeur de %s rejeté : %d caractères, ce n'est pas un nom (%r…)",
            offre.get("identifiant"), len(propre), propre[:60],
        )
        return None
    if len(propre) < LONGUEUR_MINIMALE:
        _journal.warning(
            "Employeur de %s rejeté : %r est trop court pour être un nom.",
            offre.get("identifiant"), propre,
        )
        return None

    reference = _normaliser(" ".join(
        str(offre.get(cle) or "")
        for cle in ("intitule", "entreprise_nom", "description")
    ))
    # ⚠️ **Recherche encadrée par des frontières de mot, pas une simple
    # sous-chaîne.** Sans elles, « Net » serait « vérifié » par le mot
    # « Internet », et « Curie » par « Curieux » : le nom paraîtrait confirmé
    # par l'annonce alors qu'il n'y figure pas. `\B` plutôt que `\b` en négatif
    # est volontairement évité — on veut que « Signe+ » ou « L'Oréal », qui se
    # terminent ou contiennent des caractères non alphanumériques, restent
    # trouvables. `(?<!\w)` / `(?!\w)` ne s'appliquent qu'aux bords réellement
    # alphanumériques et laissent passer le reste.
    motif = re.compile(rf"(?<!\w){re.escape(_normaliser(propre))}(?!\w)")
    if not motif.search(reference):
        _journal.warning(
            "Employeur de %s rejeté : %r est absent du texte de l'annonce.",
            offre.get("identifiant"), propre,
        )
        return None

    return propre


def lire(brut: dict[str, Any], offre: dict[str, Any]) -> dict[str, Any]:
    """Extrait les deux colonnes d'employeur d'une réponse du modèle.

    ⚠️ **Ne lève jamais.** Un employeur manquant ou refusé ne doit pas faire
    échouer une notation : les deux notes et leurs justifications sont bonnes,
    et les perdre coûterait de renoter l'offre — donc de repayer — pour un
    champ d'affichage. Les colonnes restent simplement `NULL`, ce qui est déjà
    l'état des 580 offres antérieures.
    """
    intermediaire = brut.get("entreprise_intermediaire")
    return {
        "entreprise_identifiee": verifier(brut.get("entreprise_identifiee"), offre),
        # `NULL` ≠ `false` : si le modèle n'a pas répondu ou a répondu autre
        # chose qu'un booléen, on écrit « pas évalué », jamais « non ».
        "entreprise_intermediaire": intermediaire if isinstance(intermediaire, bool) else None,
    }
