import type { UiRouteTutorialTrigger } from "./uiTutorialTypes";

import { getContentRegistry } from "../../content/registry";

export const getUiRouteTutorials = (): UiRouteTutorialTrigger[] =>
  Object.values(getContentRegistry().tutorialsById).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
