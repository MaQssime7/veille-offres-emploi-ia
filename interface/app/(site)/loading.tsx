import { CadrePage } from "./_composants/cadre-page";
import { EnTetePage } from "./_composants/en-tete-page";
import { SqueletteEtatVeille } from "./_composants/etat-veille";
import { SquelettePassage } from "./_composants/passage-plan-travail";
import { SqueletteLigneOffre } from "./_composants/squelette-ligne";

/**
 * L'état de chargement de `/`.
 *
 * Next.js enveloppe la page dans une frontière Suspense dont ceci est le
 * repli : il s'affiche pendant que le serveur interroge la base, et cède la
 * place dès que le compte rendu arrive.
 *
 * ⚠️ **Posé au niveau du groupe `(site)`, il couvre AUSSI les routes enfants
 * qui n'ont pas leur propre `loading.tsx`.** Aujourd'hui `/offres` et
 * `/offres/[identifiant]` ont le leur, donc ce repli ne sert qu'à `/`. Une
 * route ajoutée sous `(site)` sans son squelette hériterait de celui-ci — et
 * afficherait un compte rendu du matin en attendant tout autre chose.
 *
 * ⚠️ **Il partage son en-tête, son cadre, ses lignes et sa carte de passage
 * avec la page** au lieu de les recopier. C'est ce partage qui garantit la
 * seule chose que ce fichier doit garantir : que le contenu réel ne fasse pas
 * sauter la mise en page en arrivant. Le projet a déjà payé trois sauts —
 * 297 px, 93 px, 222 px — pour avoir oublié d'ajouter à un squelette une
 * section ajoutée à son écran.
 */
export default function ChargementMatin() {
  return (
    <CadrePage aria-busy="true">
      <EnTetePage
        manchette={<SqueletteEtatVeille />}
        sousTitre={
          /* Annonce vocale : un lecteur d'écran ne voit pas une pulsation. */
          <p className="font-mono text-xs text-muted-foreground">
            Chargement du compte rendu…
          </p>
        }
      />

      {/* ⚠️ **UNE seule ligne, et le chiffre sort d'une MESURE qui contredit
          l'intuition.** On voudrait trois ou quatre barres « pour que ça
          ressemble à une liste » ; les hauteurs relevées au DOM le 30 août 2026
          disent l'inverse :

          | Ce qui arrive | Bureau | 375 px |
          |---|---|---|
          | Une ligne d'offre | 222 px | 358 px |
          | Un panneau vide (« Journée calme ») | 230 px | 259 px |
          | Trois lignes de squelette | 682 px | 1 090 px |

          **Un panneau vide fait presque exactement la hauteur d'une ligne**
          (8 px d'écart en bureau). Une barre unique cale donc à la fois le
          matin où il y a une offre à lire et le matin où il n'y en a aucune —
          c'est-à-dire, mesuré sur les six dernières collectes réelles, **cinq
          matins sur six**. Trois barres se seraient trompées de 450 px dans les
          deux cas à la fois.

          ⚠️ **Ce qui reste faux : le matin à cinq offres**, qui décale de
          plusieurs centaines de pixels. Il est arrivé une fois sur six. C'est
          l'écart qu'on accepte, et il est du bon côté — la page se détend quand
          il y a une bonne nouvelle, elle ne se resserre pas quand il n'y a rien.

          **Vérification de bout en bout**, hauteur du CONTENU mesurée au DOM
          contre les deux écrans réels :

          | | Bureau | 375 px |
          |---|---|---|
          | Ce squelette | 496 px | 655 px |
          | Écran vide (« Journée calme ») | 476 px | 528 px |
          | Écran à une offre | 524 px | 778 px |

          Le squelette tombe **entre les deux** : 20 px du vide et 28 px de la
          liste en bureau. Retirer le sous-titre « Chargement… » — qui n'existe
          pas sur un écran vide — le rapprocherait du vide de 24 px et
          l'éloignerait d'autant de la liste ; il reste, parce qu'il équilibre.

          ⚠️ **La première mesure de ce calage était FAUSSE, et c'est une leçon
          de méthode.** Elle lisait la hauteur du `<main>`, qui porte `flex-1` :
          le conteneur est étiré à la hauteur de la fenêtre et rend **841 px des
          deux côtés quel que soit son contenu**. Elle donnait donc « écart nul »
          avec une belle assurance. Ce qu'il faut mesurer est le **bas du dernier
          élément**. Un chiffre identique des deux côtés doit éveiller le soupçon
          avant de rassurer. */}
      <div className="flex flex-col gap-2" aria-hidden="true">
        <SqueletteLigneOffre />
      </div>

      {/* ⚠️ **La carte de passage est TOUJOURS dans le squelette, alors qu'elle
          disparaît de l'écran réel quand plus rien n'attend ailleurs.** Calage
          sur le cas courant : 570 offres sont à traiter au 30 août 2026, donc
          elle s'affiche tous les matins. */}
      <SquelettePassage />
    </CadrePage>
  );
}

/*
 * ⚠️ **La leçon de méthode, qui vaut au-delà de ce fichier.**
 *
 * La première version posait trois barres, par analogie avec `/offres` qui en
 * pose quatre. C'était raisonner par ressemblance : les deux écrans montrent des
 * lignes d'offres, donc leurs squelettes devraient se ressembler. La mesure dit
 * autre chose — `/offres` affiche jusqu'à deux cents lignes et n'est presque
 * jamais vide, `/` en affiche une poignée et est vide quatre matins sur six.
 *
 * **Un squelette ne s'aligne pas sur celui d'à côté, il s'aligne sur ce que SA
 * page affiche le plus souvent.** Et ce que sa page affiche le plus souvent se
 * compte, sur les données réelles — ici les six dernières collectes.
 */
