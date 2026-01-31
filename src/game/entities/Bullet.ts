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
    this.spec = spec;
    this.radius = spec.radius;
    this.speed = spec.speed;
    this.damage = spec.damage;
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
    if (this.spec.lifetimeMs && this.lifeMs >= this.spec.lifetimeMs) {
      this.explode(emitExplosion);
      return;
    }

    if (this.spec.homing) {
      this.updateHoming(delta, deltaMs, context);
    }

    this.x += this.vx * delta;
    this.y += this.vy * delta;
    this.graphics.setPosition(this.x, this.y);
    this.updateTrail(deltaMs, emitTrail);

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
        this.graphics.lineStyle(thickness, color, 1);
        this.graphics.beginPath();
        this.graphics.moveTo(-length * 0.5, 0);
        this.graphics.lineTo(length * 0.5, 0);
        this.graphics.strokePath();
        break;
      case "missile":
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
        this.graphics.lineStyle(2, color, 1);
        this.graphics.fillStyle(color, 0.7);
        this.graphics.fillCircle(0, 0, this.radius);
        this.graphics.strokeCircle(0, 0, this.radius);
        break;
      case "orb":
      default:
        this.graphics.fillStyle(color, 1);
        this.graphics.fillCircle(0, 0, this.radius);
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

  private updateTrail(deltaMs: number, emitTrail?: EmitBulletTrail): void {
    const trail = this.spec.trail;
    if (!trail || !emitTrail) return;
    const intervalMs = Math.max(trail.intervalMs ?? 80, 10);
    this.trailTimerMs -= deltaMs;
    if (this.trailTimerMs <= 0) {
      emitTrail(this.x, this.y, this.angleRad, this.spec);
      this.trailTimerMs = intervalMs;
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
