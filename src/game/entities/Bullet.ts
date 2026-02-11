import type { BulletSpec } from "../data/scripts";
import type { Enemy } from "./Enemy";

import Phaser from "phaser";

export type BulletOwner = "enemy" | "player";

export interface BulletConfig {
  owner: BulletOwner;
}

export interface BulletUpdateContext {
  enemies: Enemy[];
  playerX: number;
  playerY: number;
  playerAlive: boolean;
}

export type EmitBulletTrail = (
  x: number,
  y: number,
  angleRad: number,
  spec: BulletSpec,
) => void;
export type EmitBulletExplosion = (
  x: number,
  y: number,
  spec: BulletSpec,
  owner: BulletOwner,
) => void;

const DEFAULT_SPEED_BY_KIND: Record<BulletSpec["kind"], number> = {
  bomb: 200,
  dart: 260,
  missile: 260,
  orb: 200,
};

const FALLBACK_SPEC_BY_OWNER: Record<BulletOwner, BulletSpec> = {
  enemy: {
    color: 0xff9f43,
    damage: 1,
    kind: "orb",
    radius: 3,
    speed: DEFAULT_SPEED_BY_KIND.orb,
  },
  player: {
    color: 0x7df9ff,
    damage: 1,
    kind: "orb",
    radius: 3,
    speed: 420,
  },
};

export class Bullet {
  scene: Phaser.Scene;
  owner: BulletOwner;
  radius: number;
  speed: number;
  damage: number;
  spec!: BulletSpec;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angleRad: number;
  graphics: Phaser.GameObjects.Graphics;
  private lastSignature = "";
  private lifeMs = 0;
  private trailTimerMs = 0;
  private target: Enemy | null = null;
  private targetAcquireMs = 0;
  private remainingBounces = 0;
  private sameTargetCooldowns = new Map<Enemy, number>();

  constructor(scene: Phaser.Scene, config: BulletConfig) {
    this.scene = scene;
    this.owner = config.owner;
    this.radius = 2;
    this.speed = 0;
    this.damage = 1;
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.angleRad = 0;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(7);
    this.graphics.setVisible(false);
  }

  spawn(x: number, y: number, angleRad: number, spec: BulletSpec): void {
    const safeSpec = spec ?? FALLBACK_SPEC_BY_OWNER[this.owner];
    this.spec = safeSpec;
    this.radius = safeSpec.radius ?? 3;
    const fallbackSpeed = DEFAULT_SPEED_BY_KIND[safeSpec.kind];
    const requestedSpeed = safeSpec.speed ?? fallbackSpeed;
    this.speed =
      Number.isFinite(requestedSpeed) && requestedSpeed > 0
        ? requestedSpeed
        : fallbackSpeed;
    this.damage = safeSpec.damage ?? 1;
    this.angleRad = angleRad;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angleRad) * this.speed;
    this.vy = Math.sin(angleRad) * this.speed;
    this.active = true;
    this.lifeMs = 0;
    this.trailTimerMs = 0;
    this.target = null;
    this.targetAcquireMs = 0;
    this.remainingBounces = Math.max(0, safeSpec.ricochet?.maxBounces ?? 0);
    this.sameTargetCooldowns.clear();
    this.redraw();
    this.graphics.setVisible(true);
    this.graphics.setPosition(x, y);
    this.graphics.setRotation(angleRad);
  }

  update(
    delta: number,
    bounds: Phaser.Geom.Rectangle,
    context: BulletUpdateContext,
    emitTrail?: EmitBulletTrail,
    emitExplosion?: EmitBulletExplosion,
  ): void {
    if (!this.active) return;
    const deltaMs = delta * 1000;
    this.lifeMs += deltaMs;
    this.updateRicochetCooldowns(deltaMs);
    if (this.spec.lifetimeMs && this.lifeMs >= this.spec.lifetimeMs) {
      this.explode(emitExplosion);
      return;
    }

    if (this.spec.homing) {
      this.updateHoming(delta, deltaMs, context);
    }

    const prevX = this.x;
    const prevY = this.y;
    this.x += this.vx * delta;
    this.y += this.vy * delta;
    this.graphics.setPosition(this.x, this.y);
    this.updateTrail(deltaMs, prevX, prevY, emitTrail);

    const offscreen =
      this.y < bounds.y - 50 ||
      this.y > bounds.y + bounds.height + 50 ||
      this.x < bounds.x - 50 ||
      this.x > bounds.x + bounds.width + 50;
    if (offscreen) {
      this.deactivate();
    }
  }

  hit(emitExplosion?: EmitBulletExplosion): void {
    if (this.spec.kind === "bomb" || this.spec.aoe) {
      this.explode(emitExplosion);
    } else {
      this.deactivate();
    }
  }

  explode(emitExplosion?: EmitBulletExplosion): void {
    if (!this.active) return;
    if (emitExplosion) {
      emitExplosion(this.x, this.y, this.spec, this.owner);
    }
    this.deactivate();
  }

  deactivate(): void {
    this.active = false;
    this.graphics.setVisible(false);
  }

  destroy(): void {
    this.graphics.destroy();
  }

  canRicochetOff(enemy: Enemy): boolean {
    const ricochet = this.spec.ricochet;
    if (!ricochet) return false;
    if (this.remainingBounces <= 0) return false;
    return (this.sameTargetCooldowns.get(enemy) ?? 0) <= 0;
  }

  ricochetOff(enemy: Enemy): boolean {
    const ricochet = this.spec.ricochet;
    if (!ricochet) return false;
    if (!this.canRicochetOff(enemy)) return false;

    const dx = this.x - enemy.x;
    const dy = this.y - enemy.y;
    const length = Math.hypot(dx, dy);
    const nx = length > 0 ? dx / length : -Math.cos(this.angleRad);
    const ny = length > 0 ? dy / length : -Math.sin(this.angleRad);
    const dot = this.vx * nx + this.vy * ny;
    const reflectedX = this.vx - 2 * dot * nx;
    const reflectedY = this.vy - 2 * dot * ny;
    const speedRetention = Phaser.Math.Clamp(ricochet.speedRetention, 0, 1);

    this.vx = reflectedX * speedRetention;
    this.vy = reflectedY * speedRetention;
    this.speed = Math.hypot(this.vx, this.vy);
    this.damage *= Phaser.Math.Clamp(ricochet.damageRetention, 0, 1);
    this.angleRad = Math.atan2(this.vy, this.vx);
    this.graphics.setRotation(this.angleRad);
    this.remainingBounces -= 1;
    this.sameTargetCooldowns.set(
      enemy,
      Math.max(0, ricochet.sameTargetCooldownMs),
    );
    return true;
  }

  private redraw(): void {
    const signature = [
      this.spec.kind,
      this.spec.color ?? 0,
      this.spec.radius,
      this.spec.length ?? 0,
      this.spec.thickness ?? 0,
    ].join("|");
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;

    this.graphics.clear();
    const color =
      this.spec.color ?? (this.owner === "player" ? 0x7df9ff : 0xff9f43);
    const thickness = this.spec.thickness ?? 2;
    const length = this.spec.length ?? this.radius * 2;

    switch (this.spec.kind) {
      case "dart":
        this.graphics.lineStyle(thickness + 2, color, 0.25);
        this.graphics.beginPath();
        this.graphics.moveTo(-length * 0.5, 0);
        this.graphics.lineTo(length * 0.5, 0);
        this.graphics.strokePath();
        this.graphics.lineStyle(thickness, color, 1);
        this.graphics.beginPath();
        this.graphics.moveTo(-length * 0.5, 0);
        this.graphics.lineTo(length * 0.5, 0);
        this.graphics.strokePath();
        this.graphics.fillStyle(color, 0.6);
        this.graphics.fillCircle(0, 0, Math.max(1, thickness * 0.75));
        break;
      case "missile":
        this.graphics.fillStyle(color, 0.2);
        this.graphics.fillRect(
          -length * 0.65,
          -thickness,
          length * 1.3,
          thickness * 2,
        );
        this.graphics.lineStyle(1, color, 1);
        this.graphics.fillStyle(color, 1);
        this.graphics.fillRect(
          -length * 0.5,
          -thickness * 0.5,
          length,
          thickness,
        );
        this.graphics.strokeRect(
          -length * 0.5,
          -thickness * 0.5,
          length,
          thickness,
        );
        break;
      case "bomb":
        this.graphics.fillStyle(color, 0.22);
        this.graphics.fillCircle(0, 0, this.radius * 1.7);
        this.graphics.lineStyle(2, color, 1);
        this.graphics.fillStyle(color, 0.7);
        this.graphics.fillCircle(0, 0, this.radius);
        this.graphics.strokeCircle(0, 0, this.radius);
        this.graphics.lineStyle(1.2, color, 0.6);
        this.graphics.strokeCircle(0, 0, this.radius * 1.28);
        break;
      case "orb":
      default:
        this.graphics.fillStyle(color, 0.24);
        this.graphics.fillCircle(0, 0, this.radius * 1.85);
        this.graphics.fillStyle(color, 1);
        this.graphics.fillCircle(0, 0, this.radius);
        this.graphics.lineStyle(1, color, 0.72);
        this.graphics.strokeCircle(0, 0, this.radius * 1.3);
        break;
    }
  }

  private updateHoming(
    delta: number,
    deltaMs: number,
    context: BulletUpdateContext,
  ): void {
    const homing = this.spec.homing;
    if (!homing) return;

    this.targetAcquireMs -= deltaMs;
    if (this.owner === "player") {
      if (!this.target?.active) {
        this.target = null;
      }
      const needsAcquire = !this.target || this.targetAcquireMs <= 0;
      if (needsAcquire) {
        this.targetAcquireMs = 180;
        this.target = this.findNearestEnemy(
          context.enemies,
          homing.acquireRadius,
        );
      }
      if (this.target) {
        this.applyTurn(
          delta,
          this.target.x,
          this.target.y,
          homing.turnRateRadPerSec,
        );
      }
    } else if (context.playerAlive) {
      this.applyTurn(
        delta,
        context.playerX,
        context.playerY,
        homing.turnRateRadPerSec,
      );
    }

    this.vx = Math.cos(this.angleRad) * this.speed;
    this.vy = Math.sin(this.angleRad) * this.speed;
    this.graphics.setRotation(this.angleRad);
  }

  private updateTrail(
    deltaMs: number,
    prevX: number,
    prevY: number,
    emitTrail?: EmitBulletTrail,
  ): void {
    if (!emitTrail) return;
    if (deltaMs <= 0) return;
    const trail = this.spec.trail;
    const intervalMs = Math.max(
      trail?.intervalMs ?? this.getDefaultTrailIntervalMs(),
      10,
    );
    const dx = this.x - prevX;
    const dy = this.y - prevY;
    this.trailTimerMs -= deltaMs;
    let safety = 0;
    while (this.trailTimerMs <= 0 && safety < 10) {
      const overshootMs = -this.trailTimerMs;
      const t = Phaser.Math.Clamp(1 - overshootMs / deltaMs, 0, 1);
      emitTrail(prevX + dx * t, prevY + dy * t, this.angleRad, this.spec);
      this.trailTimerMs += intervalMs;
      safety += 1;
    }
    if (safety >= 10 && this.trailTimerMs < 0) {
      // Keep bounded during stalls to avoid a large burst next frame.
      this.trailTimerMs = 0;
    }
  }

  private getDefaultTrailIntervalMs(): number {
    switch (this.spec.kind) {
      case "dart":
        return 42;
      case "missile":
        return 30;
      case "bomb":
        return 70;
      case "orb":
      default:
        return 52;
    }
  }

  private updateRicochetCooldowns(deltaMs: number): void {
    if (!this.spec.ricochet || this.sameTargetCooldowns.size === 0) return;
    for (const [enemy, cooldown] of this.sameTargetCooldowns.entries()) {
      const next = cooldown - deltaMs;
      if (next <= 0 || !enemy.active) {
        this.sameTargetCooldowns.delete(enemy);
      } else {
        this.sameTargetCooldowns.set(enemy, next);
      }
    }
  }

  private applyTurn(
    delta: number,
    targetX: number,
    targetY: number,
    turnRate: number,
  ): void {
    const desired = Math.atan2(targetY - this.y, targetX - this.x);
    const diff = Phaser.Math.Angle.Wrap(desired - this.angleRad);
    const maxTurn = turnRate * delta;
    this.angleRad += Phaser.Math.Clamp(diff, -maxTurn, maxTurn);
  }

  private findNearestEnemy(enemies: Enemy[], radius: number): Enemy | null {
    const radiusSq = radius * radius;
    let best: Enemy | null = null;
    let bestDistSq = radiusSq;
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= bestDistSq) {
        best = enemy;
        bestDistSq = distSq;
      }
    }
    return best;
  }
}
