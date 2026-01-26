import type { GunDefinition } from "./gunTypes";

import { getContentRegistry } from "../../content/registry";

export const GUNS: Record<string, GunDefinition> = getContentRegistry().gunsById;

export type { GunDefinition, GunId } from "./gunTypes";
