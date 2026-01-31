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
  }
  const speed = override.speed ?? base.speed;
  const homing = override.homing ?? base.homing ?? base.bullet.homing;
  const aoe = override.aoe ?? base.aoe ?? base.bullet.aoe;
  const lifetimeMs =
    override.lifetimeMs ?? base.lifetimeMs ?? base.bullet.lifetimeMs;
  const bullet = override.bullet ?? base.bullet;
  return {
    ...base,
    ...override,
    aoe,
    bullet: {
      ...bullet,
      aoe,
      homing,
      lifetimeMs,
      speed,
    },
    homing,
    lifetimeMs,
    multiShotMode:
      override.multiShotMode ?? base.multiShotMode ?? "simultaneous",
    shots: override.shots ?? base.shots ?? DEFAULT_WEAPON_SHOTS,
    speed,
  };
};

export const canMountWeapon = (
  weapon: WeaponDefinition,
  mount: WeaponMount,
): boolean => {
  if (weapon.size === "large" && mount.size !== "large") return false;
  return weapon.zones.includes(mount.zone);
};
