import type { WeaponMount } from "./shipTypes";
import type { WeaponDefinition, WeaponStats } from "./weaponTypes";

import { DEFAULT_WEAPON_SHOTS } from "./weaponTypes";

export const resolveWeaponStats = (weapon: WeaponDefinition): WeaponStats => {
  const base = weapon.stats;
  const homing = base.homing ?? base.bullet.homing;
  const aoe = base.aoe ?? base.bullet.aoe;
  const lifetimeMs = base.lifetimeMs ?? base.bullet.lifetimeMs;
  return {
    ...base,
    aoe,
    bullet: {
      ...base.bullet,
      aoe,
      homing,
      lifetimeMs,
      speed: base.speed,
    },
    homing,
    lifetimeMs,
    multiShotMode: base.multiShotMode ?? "simultaneous",
    shots: base.shots ?? DEFAULT_WEAPON_SHOTS,
  };
};

export const canMountWeapon = (
  weapon: WeaponDefinition,
  mount: WeaponMount,
): boolean => {
  if (weapon.size === "large" && mount.size !== "large") return false;
  return true;
};
