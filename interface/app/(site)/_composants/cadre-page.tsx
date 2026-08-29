/**
 * L'enveloppe de tout écran du site : la largeur du jeton `--largeur-page`, et
 * les marges qui vont avec.
 *
 * ⚠️ **Extraite de `offres/_composants/en-tete-page.tsx` le 30 août 2026, quand
 * l'écran du matin est arrivé.** Elle y cohabitait avec l'en-tête de `/offres`,
 * qui lui est propre — la liste, sa fiche et maintenant `/` partagent le cadre
 * sans partager l'en-tête. Les laisser ensemble aurait obligé `/` à importer un
 * module nommé « en-tête de page » pour n'en prendre que la marge.
 *
 * ⚠️ **La largeur est un jeton, jamais un nombre écrit ici.** `--largeur-page`
 * vaut 1000 px et ce seuil est mesuré : en dessous, les offres qui affichent un
 * salaire cassent sur deux lignes (`docs/DESIGN.md`). Un `max-w-4xl` posé à la
 * main sur un seul écran ferait diverger les deux pages sans que rien ne le
 * signale.
 */
export function CadrePage({
  children,
  ...reste
}: React.ComponentProps<"main">) {
  return (
    <main
      className="mx-auto w-full max-w-(--largeur-page) flex-1 px-4 py-8 sm:px-6 sm:py-10"
      {...reste}
    >
      {children}
    </main>
  );
}
