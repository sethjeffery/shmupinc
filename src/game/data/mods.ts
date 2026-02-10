import type { ModDefinition } from "./modTypes";

import { getContentRegistry } from "../../content/registry";

export const MODS: Record<string, ModDefinition> =
  getContentRegistry().modsById;

export type { ModDefinition, ModId, ModIconKind } from "./modTypes";
