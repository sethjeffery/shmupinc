import type { EnemyDef } from "./enemyTypes";

import { getContentRegistry } from "../../content/registry";

export const ENEMIES: Record<string, EnemyDef> =
  getContentRegistry().enemiesById;

export type { BossPhase, EnemyDef, EnemyId, EnemyShape } from "./enemyTypes";
