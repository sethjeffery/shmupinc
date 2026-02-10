import type { WeaponDefinition, WeaponId } from "./weaponTypes";

import { getContentRegistry } from "../../content/registry";

const contentWeapons = getContentRegistry().weaponsById;

export const WEAPONS: Record<string, WeaponDefinition> = contentWeapons;

export const STARTER_WEAPON_ID: WeaponId = "orbPulse";

export type { WeaponDefinition, WeaponId } from "./weaponTypes";
