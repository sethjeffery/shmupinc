import type { GalaxyView } from "../../../data/galaxyProgress";

import { useTypewriter } from "../../shop/hooks/useTypewriter";

export const useProgressionTitle = (view: GalaxyView): string =>
  useTypewriter(view.name, 30, {
    offset: 500,
    restartKey: `${view.id}:${view.currentLevelId ?? "complete"}`,
  });
