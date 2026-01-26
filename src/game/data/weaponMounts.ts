import type { WeaponMount } from "./shipTypes";
import type { WeaponDefinition, WeaponStats, WeaponZone } from "./weaponTypes";

import { DEFAULT_WEAPON_SHOTS } from "./weaponTypes";

export const resolveWeaponStats = (
  weapon: WeaponDefinition,
  zone: WeaponZone,
): WeaponStats => {
  const base = weapon.stats;
  const override = weapon.zoneStats?.[zone];
  if (!override) {
    return {
      ...base,
      bullet: { ...base.bullet, speed: base.speed },
      shots: base.shots ?? DEFAULT_WEAPON_SHOTS,
      multiShotMode: base.multiShotMode ?? "simultaneous",
    };
  }
  const speed = override.speed ?? base.speed;
  const bullet = override.bullet ?? base.bullet;
  return {
    ...base,
    ...override,
    bullet: { ...bullet, speed },
    speed,
    shots: override.shots ?? base.shots ?? DEFAULT_WEAPON_SHOTS,
    multiShotMode: override.multiShotMode ?? base.multiShotMode ?? "simultaneous",
  };
};

export const canMountWeapon = (
  weapon: WeaponDefinition,
  mount: WeaponMount,
): boolean => {
  if (weapon.size === "large" && mount.size !== "large") return false;
  return weapon.zones.includes(mount.zone);
};
