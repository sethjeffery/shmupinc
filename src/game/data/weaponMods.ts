import type { ModDefinition } from "./mods";
import type { BulletAoe, BulletHoming, BulletRicochet } from "./scripts";
import type { WeaponDefinition, WeaponShot, WeaponStats } from "./weaponTypes";

import { resolveWeaponStats } from "./weaponMounts";

const mergeHoming = (
  current: BulletHoming | undefined,
  next: BulletHoming | undefined,
): BulletHoming | undefined => {
  if (!next) return current;
  if (!current) return { ...next };
  return {
    acquireRadius: Math.max(current.acquireRadius, next.acquireRadius),
    turnRateRadPerSec: Math.max(
      current.turnRateRadPerSec,
      next.turnRateRadPerSec,
    ),
  };
};

const applyAoeEffect = (
  current: BulletAoe | undefined,
  effect: NonNullable<ModDefinition["effects"]["aoe"]>,
  baseDamage: number,
): BulletAoe => {
  const radiusMultiplier = effect.radiusMultiplier ?? 1;
  const radiusAdd = effect.radiusAdd ?? 0;
  const damageMultiplier = effect.damageMultiplier ?? 1;
  const initial =
    current ??
    ({
      damage: baseDamage * (effect.defaultDamageFactor ?? 1),
      radius: effect.defaultRadius ?? 52,
    } satisfies BulletAoe);
  return {
    damage: initial.damage * damageMultiplier,
    radius: initial.radius * radiusMultiplier + radiusAdd,
  };
};

const buildSpreadLayer = (
  shots: WeaponShot[],
  count: number,
  spreadDeg: number,
): WeaponShot[] => {
  if (count <= 1) return shots;
  if (count === 3) {
    return shots.flatMap((shot) => [
      {
        ...shot,
        angleDeg: (shot.angleDeg ?? 0) - spreadDeg,
      },
      {
        ...shot,
        angleDeg: shot.angleDeg ?? 0,
      },
      {
        ...shot,
        angleDeg: (shot.angleDeg ?? 0) + spreadDeg,
      },
    ]);
  }

  const first = -spreadDeg;
  const last = spreadDeg;
  const step = (last - first) / (count - 1);
  return shots.flatMap((shot) =>
    Array.from({ length: count }, (_, index) => ({
      ...shot,
      angleDeg: (shot.angleDeg ?? 0) + first + step * index,
    })),
  );
};

export const normalizeMountMods = (mods: ModDefinition[]): ModDefinition[] => {
  const seen = new Set<ModDefinition["iconKind"]>();
  const unique: ModDefinition[] = [];
  for (const mod of mods) {
    if (seen.has(mod.iconKind)) continue;
    seen.add(mod.iconKind);
    unique.push(mod);
  }
  return unique;
};

const pickRicochet = (mods: ModDefinition[]): BulletRicochet | undefined => {
  for (const mod of mods) {
    if (mod.effects.bounce) return mod.effects.bounce;
  }
  return undefined;
};

export const resolveWeaponStatsWithMods = (
  weapon: WeaponDefinition,
  mods: ModDefinition[],
): WeaponStats => {
  const base = resolveWeaponStats(weapon);
  const normalizedMods = normalizeMountMods(mods);
  const baseDamage = base.bullet.damage;

  let damageMultiplier = 1;
  let projectileDamageMultiplier = 1;
  let homing = base.homing ?? base.bullet.homing;
  let aoe = base.aoe ?? base.bullet.aoe;
  let shots = base.shots ?? [];

  for (const mod of normalizedMods) {
    const effects = mod.effects;
    if (effects.damageMultiplier) {
      damageMultiplier *= effects.damageMultiplier;
    }
    homing = mergeHoming(homing, effects.homing);
    if (effects.aoe) {
      aoe = applyAoeEffect(aoe, effects.aoe, baseDamage);
    }
    if (effects.multi) {
      shots = buildSpreadLayer(
        shots,
        effects.multi.count,
        effects.multi.spreadDeg,
      );
      projectileDamageMultiplier *= effects.multi.projectileDamageMultiplier;
    }
  }

  const finalDamage =
    baseDamage * damageMultiplier * projectileDamageMultiplier;
  const finalAoe = aoe
    ? {
        damage: aoe.damage * damageMultiplier * projectileDamageMultiplier,
        radius: aoe.radius,
      }
    : undefined;
  const ricochet = pickRicochet(normalizedMods);

  return {
    ...base,
    aoe: finalAoe,
    bullet: {
      ...base.bullet,
      aoe: finalAoe,
      damage: finalDamage,
      homing,
      ricochet,
    },
    homing,
    shots,
  };
};
