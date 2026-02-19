import type { EnemyDef } from "./enemyTypes";
import type { EnemyOverride } from "./waves";

import { getContentRegistry } from "../../content/registry";

export const ENEMIES: Record<string, EnemyDef> =
  getContentRegistry().enemiesById;

export const resolveEnemyDefinition = (
  base: EnemyDef,
  overrides?: EnemyOverride,
): EnemyDef => {
  if (!overrides) return base;
  return {
    fire: overrides.fire ?? base.fire,
    goldDrop: overrides.goldDrop ?? base.goldDrop,
    hitbox: overrides.hitbox ?? base.hitbox,
    hp: overrides.hp ?? base.hp,
    id: base.id,
    move: overrides.move ?? base.move,
    phases: overrides.phases ?? base.phases,
    radius: overrides.radius ?? base.radius,
    rotation: overrides.rotation ?? base.rotation,
    rotationDeg: overrides.rotationDeg ?? base.rotationDeg,
    style: overrides.style ?? base.style,
  };
};

export type { EnemyDef } from "./enemyTypes";
