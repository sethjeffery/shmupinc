import type {
  Bullet,
  BulletUpdateContext,
  EmitBulletExplosion,
  EmitBulletTrail,
} from "../../entities/Bullet";
import type { Enemy } from "../../entities/Enemy";
import type { ObjectPool } from "../../util/pool";
import type Phaser from "phaser";

import { circleOverlap } from "../Collision";
import { circleHitboxOverlap } from "../hitbox";
import { isExplosiveBullet } from "./BulletVisualFx";

export interface BulletRuntimeContext {
  bulletContext: BulletUpdateContext;
  enemies: Enemy[];
  enemyBullets: ObjectPool<Bullet>;
  emitTrail: EmitBulletTrail;
  handleExplosion: EmitBulletExplosion;
  onBulletImpact?: (
    x: number,
    y: number,
    spec: Bullet["spec"],
    owner: Bullet["owner"],
  ) => void;
  onDamagePlayer: (amount: number, fxX?: number, fxY?: number) => void;
  onEnemyKilled: (enemyIndex: number) => void;
  playArea: Phaser.Geom.Rectangle;
  playerAlive: boolean;
  playerBullets: ObjectPool<Bullet>;
  playerRadius: number;
  playerX: number;
  playerY: number;
}

const syncBulletContext = (ctx: BulletRuntimeContext): void => {
  ctx.bulletContext.enemies = ctx.enemies;
  ctx.bulletContext.playerX = ctx.playerX;
  ctx.bulletContext.playerY = ctx.playerY;
  ctx.bulletContext.playerAlive = ctx.playerAlive;
};

export const updatePlayerBulletsRuntime = (
  delta: number,
  ctx: BulletRuntimeContext,
): void => {
  syncBulletContext(ctx);
  ctx.playerBullets.forEachActive((bullet) => {
    bullet.update(
      delta,
      ctx.playArea,
      ctx.bulletContext,
      ctx.emitTrail,
      ctx.handleExplosion,
    );
    if (!bullet.active) return;

    for (let i = ctx.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = ctx.enemies[i];
      if (!enemy.active) continue;
      const hit = circleHitboxOverlap(
        bullet.x,
        bullet.y,
        bullet.radius,
        enemy.x,
        enemy.y,
        enemy.hitbox,
      );
      if (!hit) continue;

      if (isExplosiveBullet(bullet.spec)) {
        bullet.hit(ctx.handleExplosion);
      } else {
        ctx.onBulletImpact?.(bullet.x, bullet.y, bullet.spec, bullet.owner);
        enemy.takeDamage(bullet.damage);
        if (!enemy.active) {
          ctx.onEnemyKilled(i);
          bullet.deactivate();
        } else if (!bullet.ricochetOff(enemy)) {
          bullet.deactivate();
        }
      }
      break;
    }
  });
};

export const updateEnemyBulletsRuntime = (
  delta: number,
  ctx: BulletRuntimeContext,
): void => {
  syncBulletContext(ctx);
  ctx.enemyBullets.forEachActive((bullet) => {
    bullet.update(
      delta,
      ctx.playArea,
      ctx.bulletContext,
      ctx.emitTrail,
      ctx.handleExplosion,
    );
    if (!bullet.active || !ctx.playerAlive) return;
    const hit = circleOverlap(
      bullet.x,
      bullet.y,
      bullet.radius,
      ctx.playerX,
      ctx.playerY,
      ctx.playerRadius,
    );
    if (!hit) return;

    if (isExplosiveBullet(bullet.spec)) {
      bullet.hit(ctx.handleExplosion);
    } else {
      ctx.onBulletImpact?.(bullet.x, bullet.y, bullet.spec, bullet.owner);
      bullet.deactivate();
      ctx.onDamagePlayer(bullet.damage, bullet.x, bullet.y);
    }
  });
};
