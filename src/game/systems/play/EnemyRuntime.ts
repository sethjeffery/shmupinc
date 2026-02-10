import type { EnemyId } from "../../data/enemyTypes";
import type { EnemyHitbox } from "../../data/enemyTypes";
import type { EnemyOverride } from "../../data/waves";
import type { EmitBullet } from "../FireScriptRunner";
import type Phaser from "phaser";

import { ENEMIES, resolveEnemyDefinition } from "../../data/enemies";
import { Enemy } from "../../entities/Enemy";

export interface EnemyPush {
  nx: number;
  ny: number;
  x: number;
  y: number;
}

export interface SpawnEnemyRuntimeContext {
  enemies: Enemy[];
  enemyPool: Enemy[];
  hpMultiplier: number;
  overrides?: EnemyOverride;
  playArea: Phaser.Geom.Rectangle;
  scene: Phaser.Scene;
  spawnX: number;
  spawnY: number;
}

export const spawnEnemyRuntime = (
  enemyId: EnemyId,
  context: SpawnEnemyRuntimeContext,
): void => {
  const base = ENEMIES[enemyId];
  const def = resolveEnemyDefinition(base, context.overrides);
  const worldX =
    context.playArea.x + (0.5 + context.spawnX) * context.playArea.width;
  const worldY = context.playArea.y + context.spawnY * context.playArea.height;
  const enemy =
    context.enemyPool.pop() ??
    new Enemy(
      context.scene,
      def,
      worldX,
      worldY,
      context.playArea.width,
      context.playArea.height,
    );
  enemy.setPlayfieldSize(context.playArea.width, context.playArea.height);
  enemy.reset(def, worldX, worldY, context.hpMultiplier);
  context.enemies.push(enemy);
};

export interface UpdateEnemiesRuntimeContext {
  bounds: Phaser.Geom.Rectangle;
  contactDamagePerSec: number;
  deltaMs: number;
  emitEnemyBullet: EmitBullet;
  enemies: Enemy[];
  exitDashMs: number;
  finishLingerMs: number;
  getEnemyEntered: (enemy: Enemy) => boolean;
  getEnemyPush: (
    enemyX: number,
    enemyY: number,
    enemyHitbox: EnemyHitbox,
  ) => EnemyPush | null;
  margin: number;
  markEnemyEntered: (enemy: Enemy) => void;
  onEnemyCharging: (enemy: Enemy) => void;
  onEnemyContact: (
    index: number,
    enemy: Enemy,
    push: EnemyPush,
    contactDamage: number,
  ) => void;
  onReleaseEnemy: (index: number, dropGold: boolean) => void;
  playerAlive: boolean;
  playerX: number;
  playerY: number;
}

export const updateEnemiesRuntime = (
  context: UpdateEnemiesRuntimeContext,
): void => {
  const OFFSCREEN_EPSILON = 0.5;
  const contactDamage = (context.contactDamagePerSec * context.deltaMs) / 1000;
  const bounds = context.bounds;
  const margin = context.margin;

  for (let i = context.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = context.enemies[i];
    if (!enemy.active) {
      context.onReleaseEnemy(i, true);
      continue;
    }

    enemy.update(
      context.deltaMs,
      context.playerX,
      context.playerY,
      context.playerAlive,
      context.emitEnemyBullet,
    );

    if (enemy.isCharging) {
      context.onEnemyCharging(enemy);
    }

    const offscreen =
      enemy.y >= bounds.y + bounds.height + margin - OFFSCREEN_EPSILON ||
      enemy.y <= bounds.y - margin + OFFSCREEN_EPSILON ||
      enemy.x <= bounds.x - margin + OFFSCREEN_EPSILON ||
      enemy.x >= bounds.x + bounds.width + margin - OFFSCREEN_EPSILON;
    const entered =
      enemy.x >= bounds.x &&
      enemy.x <= bounds.x + bounds.width &&
      enemy.y >= bounds.y &&
      enemy.y <= bounds.y + bounds.height;
    let hasEntered = context.getEnemyEntered(enemy);
    if (entered) {
      context.markEnemyEntered(enemy);
      hasEntered = true;
    }
    if (
      (enemy.isMoveFinished &&
        offscreen &&
        (hasEntered || enemy.finishedElapsedMs > context.finishLingerMs * 4)) ||
      enemy.y >= bounds.y + bounds.height + margin - OFFSCREEN_EPSILON
    ) {
      context.onReleaseEnemy(i, false);
      continue;
    }

    if (
      hasEntered &&
      enemy.isMoveFinished &&
      enemy.finishedElapsedMs > context.finishLingerMs
    ) {
      const { height, width, x, y } = bounds;
      const leftDist = enemy.x - x;
      const rightDist = x + width - enemy.x;
      const topDist = enemy.y - y;
      const bottomDist = y + height - enemy.y;
      const marginExit = margin;
      let targetX = enemy.x;
      let targetY = enemy.y;
      const minDist = Math.min(leftDist, rightDist, topDist, bottomDist);
      if (minDist === leftDist) {
        targetX = x - marginExit;
      } else if (minDist === rightDist) {
        targetX = x + width + marginExit;
      } else if (minDist === topDist) {
        targetY = y - marginExit;
      } else {
        targetY = y + height + marginExit;
      }
      enemy.triggerExit(targetX, targetY, context.exitDashMs);
    }

    if (context.playerAlive) {
      const push = context.getEnemyPush(enemy.x, enemy.y, enemy.hitbox);
      if (!push) continue;
      context.onEnemyContact(i, enemy, push, contactDamage * 4);
    }
  }
};
