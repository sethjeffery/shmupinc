import type { LevelDefinition } from "./types";

import { getContentRegistry } from "../../../content/registry";

export * from "./types";

export const getLevels = (): Record<string, LevelDefinition> =>
  getContentRegistry().levelsById;
