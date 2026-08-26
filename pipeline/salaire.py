"""Ramène un salaire France Travail à une fourchette annuelle en euros.

**Ce qui entre** : le libellé tel que l'employeur l'a saisi
(`« Annuel de 40000.0 Euros à 70000.0 Euros »`), rien d'autre.
**Ce qui sort** : deux entiers en euros par an, ou rien du tout avec un motif.

⚠️ **Ce module n'écrase jamais `salaire_libelle`.** L'annualisation est une
*lecture* de la source, pas une correction : quand elle renonce, le libellé
d'origine reste affiché et c'est l'œil humain qui tranche.

**Ce qui casse s'il tombe** : les offres perdent leur montant comparable — la
liste ne peut plus se trier ni se filtrer par salaire, mais rien n'est perdu ni
faussé, le libellé reste. C'est le mode de défaillance qu'on a choisi :
**renoncer plutôt que deviner.**

---

**Pourquoi ce module n'est pas une simple expression régulière.** Passé le
26 août 2026 sur les 373 offres réelles en base, il en écarte exactement deux,
fausses à la source :

    « Mensuel de 45000.0 Euros à 60000.0 Euros sur 12.0 mois »
        -> × 12 = 540 000 à 720 000 € par an     (offre « Ingénieur IA (H/F) »)
    « Annuel de 35.0 Euros »
        -> 35 € par an                            (offre « Ingénieur d'études »)

La première est manifestement une fourchette **annuelle** étiquetée
« Mensuel » ; la seconde un taux **horaire** étiqueté « Annuel ». Un
convertisseur qui se contente de parser mettrait la première tout en haut de
n'importe quel tri par salaire : l'offre la mieux payée du site serait une
faute de frappe.

⚠️ **On ne les corrige pas pour autant.** Requalifier « Mensuel 45000 » en
annuel serait deviner l'intention de l'employeur, c'est-à-dire fabriquer de la
donnée. On les **écarte avec un motif**, le libellé reste visible, et l'humain
tranche.

⚠️ **Écarter un montant n'écarte pas l'offre.** Celle qui est ici écartée est
un poste d'ingénieur IA, c'est-à-dire précisément la cible de la veille : elle
reste dans la liste avec son libellé d'origine. À retenir le jour où un filtre
par salaire apparaîtra — filtrer sur `salaire_annuel_min` la ferait disparaître
alors qu'elle est peut-être la meilleure offre du lot.

⚠️ **La liste des périodes n'est pas fermée.** Trois formes de salaire sont
apparues en cinq jours entre deux mesures. Une période inconnue ne fait donc
pas planter et ne s'invente pas non plus : elle rend un motif
`periode_inconnue:<mot>` et un avertissement dans le journal, pour qu'on la voie
et qu'on la mesure avant de coder sa conversion.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass

_journal = logging.getLogger(__name__)

# Bornes de plausibilité d'un salaire annuel brut, en euros.
#
# Le plancher laisse passer un temps très partiel ; le plafond est largement
# au-dessus du maximum réellement observé (130 000 €) et largement en dessous
# des aberrations mesurées (540 000 €). Ce seuil vit ICI et nulle part ailleurs
# — surtout pas dupliqué en contrainte SQL : deux seuils dans deux endroits
# finissent toujours par diverger, et c'est celui qu'on oublie qui décide.
ANNUEL_PLANCHER = 5_000
ANNUEL_PLAFOND = 300_000

# Durée légale hebdomadaire française, hypothèse de repli pour les taux horaires.
#
# ⚠️ La vraie durée existe dans l'archive `charge_brute` (`dureeTravailLibelle`,
# renseignée sur 96 offres sur 373) mais n'est pas extraite en colonne, et
# l'archive ne se lit jamais pour travailler. Tant qu'elle ne l'est pas, un
# taux horaire est converti sur 35 h : l'écart avec une offre à 39 h est
# d'environ 11 %, ce qui déplace un montant sans changer un classement.
HEURES_LEGALES_PAR_SEMAINE = 35.0
SEMAINES_PAR_AN = 52
MOIS_PAR_AN_PAR_DEFAUT = 12

# « Annuel de 40000.0 Euros à 70000.0 Euros sur 12 mois »
#   période ──┘        montant ──┘         second ──┘        mois ──┘
#
# Le second montant et le nombre de mois sont optionnels : les deux formes à
# montant unique existent réellement en base.
_FORME = re.compile(
    r"^\s*(?P<periode>[^\W\d_]+)"
    r"\s+de\s+(?P<premier>\d+(?:[.,]\d+)?)\s*euros"
    r"(?:\s+à\s+(?P<second>\d+(?:[.,]\d+)?)\s*euros)?"
    r"(?:\s+sur\s+(?P<mois>\d+(?:[.,]\d+)?)\s*mois)?"
    r"\s*$",
    re.IGNORECASE | re.UNICODE,
)


@dataclass(frozen=True)
class Salaire:
    """Le résultat d'une annualisation. `motif_ecart` est None en cas de succès.

    `annuel_min` et `annuel_max` sont toujours renseignés ensemble, ou tous
    deux absents — jamais l'un sans l'autre. Un montant unique donne deux fois
    la même valeur : c'est fidèle à la source, qui ne donne pas de fourchette.
    """

    annuel_min: int | None = None
    annuel_max: int | None = None
    motif_ecart: str | None = None

    @property
    def retenu(self) -> bool:
        return self.annuel_min is not None


def annualiser(
    libelle: str | None,
    *,
    heures_par_semaine: float = HEURES_LEGALES_PAR_SEMAINE,
) -> Salaire:
    """Convertit un libellé France Travail en fourchette annuelle.

    Ne lève jamais : un libellé incompréhensible rend un `Salaire` sans montant
    et avec son motif. Un module de normalisation qui plante sur une saisie
    d'employeur ferait tomber toute une exécution pour une offre.
    """
    if libelle is None or not libelle.strip():
        return Salaire(motif_ecart="absent")

    correspondance = _FORME.match(libelle)
    if correspondance is None:
        # « Selon profil », « À négocier », ou une forme qu'on n'a jamais vue.
        _journal.info("Salaire non chiffré, écarté : %r", libelle)
        return Salaire(motif_ecart="non_chiffre")

    periode = correspondance["periode"].lower()
    premier = _nombre(correspondance["premier"])
    second = _nombre(correspondance["second"]) if correspondance["second"] else premier
    mois = _nombre(correspondance["mois"]) if correspondance["mois"] else None

    facteur = _facteur_annuel(periode, mois, heures_par_semaine)
    if facteur is None:
        _journal.warning(
            "Période de salaire inconnue %r dans %r — offre écartée du calcul. "
            "Mesurer ce que cette forme représente avant de coder sa conversion.",
            periode, libelle,
        )
        return Salaire(motif_ecart=f"periode_inconnue:{periode}")

    bas, haut = round(premier * facteur), round(second * facteur)

    if haut < bas:
        # Jamais observé, mais la base refuserait la ligne. On renonce plutôt
        # que d'inverser : inverser, ce serait décider à la place de l'employeur.
        _journal.warning("Fourchette de salaire inversée, écartée : %r", libelle)
        return Salaire(motif_ecart="fourchette_inversee")

    if not (ANNUEL_PLANCHER <= bas and haut <= ANNUEL_PLAFOND):
        _journal.warning(
            "Salaire annualisé invraisemblable (%d–%d €/an) depuis %r — écarté. "
            "Le libellé d'origine reste affiché.", bas, haut, libelle,
        )
        return Salaire(motif_ecart="invraisemblable")

    return Salaire(annuel_min=bas, annuel_max=haut)


def _nombre(texte: str) -> float:
    """« 40000.0 » et « 40000,0 » désignent le même montant."""
    return float(texte.replace(",", "."))


def _facteur_annuel(
    periode: str, mois: float | None, heures_par_semaine: float
) -> float | None:
    """Par combien multiplier le montant pour obtenir un montant annuel.

    Rend None si la période n'est pas une de celles qu'on a mesurées — on ne
    devine pas la conversion d'une forme qu'on n'a jamais vue.
    """
    if periode == "annuel":
        # Un montant annuel est déjà annuel : « sur 12 mois » dit en combien de
        # versements il tombe, pas combien de fois il faut le compter. Le
        # multiplier serait l'erreur la plus coûteuse de ce module.
        return 1.0
    if periode == "mensuel":
        return mois if mois else MOIS_PAR_AN_PAR_DEFAUT
    if periode == "horaire":
        return heures_par_semaine * SEMAINES_PAR_AN
    return None


# ---------------------------------------------------------------------------
# Contrôle exécutable : python -m pipeline.salaire
# ---------------------------------------------------------------------------
#
# Les cas viennent tous de la mesure du 26 août 2026 sur les 373 offres réelles,
# aberrations comprises. Aucun n'est inventé.

_CAS = [
    # (libellé, min attendu, max attendu, motif attendu)
    ("Annuel de 40000.0 Euros à 70000.0 Euros",              40000,  70000, None),
    ("Annuel de 55000.0 Euros à 70000.0 Euros sur 12 mois",  55000,  70000, None),
    ("Annuel de 42000.0 Euros sur 12 mois",                  42000,  42000, None),
    ("Annuel de 21000.0 Euros",                              21000,  21000, None),
    ("Mensuel de 2501.0 Euros à 3834.0 Euros",               30012,  46008, None),
    ("Mensuel de 1200.0 Euros à 1500.0 Euros sur 12 mois",   14400,  18000, None),
    ("Mensuel de 1139.0 Euros sur 12 mois",                  13668,  13668, None),
    ("Horaire de 12.5 Euros à 18.0 Euros sur 12 mois",       22750,  32760, None),
    # Les deux aberrations réellement en base, libellés recopiés tels quels.
    ("Mensuel de 45000.0 Euros à 60000.0 Euros sur 12.0 mois", None,  None, "invraisemblable"),
    ("Annuel de 35.0 Euros",                                  None,   None, "invraisemblable"),
    # Ce que la source produit aussi.
    (None,                                                    None,   None, "absent"),
    ("",                                                      None,   None, "absent"),
    ("Selon profil",                                          None,   None, "non_chiffre"),
    ("À négocier selon expérience",                           None,   None, "non_chiffre"),
    # Une forme jamais vue ne plante pas et ne s'invente pas.
    ("Journalier de 400.0 Euros",                             None,   None, "periode_inconnue:journalier"),
    # Un mensuel sur 13 mois compte bien 13 fois.
    ("Mensuel de 3000.0 Euros sur 13 mois",                  39000,  39000, None),
]


def main() -> int:
    logging.basicConfig(level=logging.CRITICAL)  # les avertissements sont attendus ici
    echecs = 0
    print(f"{'libellé':52s} {'→ min':>8s} {'max':>8s}  motif")
    print("-" * 92)
    for libelle, attendu_min, attendu_max, attendu_motif in _CAS:
        obtenu = annualiser(libelle)
        conforme = (
            obtenu.annuel_min == attendu_min
            and obtenu.annuel_max == attendu_max
            and obtenu.motif_ecart == attendu_motif
        )
        marque = "   " if conforme else "!! "
        if not conforme:
            echecs += 1
        print(
            f"{marque}{str(libelle)[:49]:49s} "
            f"{str(obtenu.annuel_min):>8s} {str(obtenu.annuel_max):>8s}  "
            f"{obtenu.motif_ecart or ''}"
        )
        if not conforme:
            print(f"    attendu : {attendu_min} / {attendu_max} / {attendu_motif}")
    print("-" * 92)
    print(f"{len(_CAS) - echecs}/{len(_CAS)} cas conformes")
    return 1 if echecs else 0


if __name__ == "__main__":
    raise SystemExit(main())
