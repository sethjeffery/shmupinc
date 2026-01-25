import type { LevelDefinition } from "./types";

import { getContentRegistry } from "../../../content/registry";
import { L2_SQUEEZE } from "./L2_SQUEEZE";

export { L2_SQUEEZE };
export * from "./types";

const contentLevels = getContentRegistry().levelsById;

export const LEVELS: Record<string, LevelDefinition> =
  Object.keys(contentLevels).length > 0 ? contentLevels : { L2_SQUEEZE };
