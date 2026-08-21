import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * L'indicateur de développement de Next.js est masqué.
   *
   * Ce n'est pas une question de goût : la pastille en bas de l'écran anime en
   * permanence, et Playwright refuse de capturer une page dont un élément
   * bouge encore — toutes les captures échouaient sur « waiting for element to
   * be stable ». Or ce projet impose de *regarder* chaque écran construit,
   * puisque personne ne relit le code.
   *
   * ⚠️ Next.js continue d'afficher les erreurs de compilation et d'exécution :
   * on ne perd que la pastille, pas la remontée des pannes.
   */
  devIndicators: false,
};

export default nextConfig;
