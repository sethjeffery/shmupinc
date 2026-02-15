import type { GalaxyDefinition } from "./galaxyTypes";

import { getContentRegistry } from "../../content/registry";

export const getGalaxies = (): Record<string, GalaxyDefinition> =>
  getContentRegistry().galaxiesById;

export const getFirstGalaxyId = (): null | string =>
  Object.keys(getGalaxies()).sort((a, b) => a.localeCompare(b))[0] ?? null;

