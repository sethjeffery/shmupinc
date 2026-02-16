import type { BulletSpec } from "../../data/scripts";
import type { BulletOwner } from "../../entities/Bullet";
import type { Enemy } from "../../entities/Enemy";
import type { ParticleSystem } from "../Particles";

import { parseVectorColor } from "../../data/vectorShape";
import {
  getBulletExplosionInfo,
  type BulletExplosionInfo,
} from "./BulletVisualFx";

const PLAYER_FX_COLOR = 0x7df9ff;
const ENEMY_FX_COLOR = 0xff9f43;
const ENEMY_DEATH_COLOR = 0xff6b6b;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));
const lerp = (from: number, to: number, t: number): number =>
  from + (to - from) * t;
const dimColor = (color: number, factor: number): number => {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
};

export class CombatVfxDispatcher {
  private particles: ParticleSystem;
  private chargeRingCooldownMs = new WeakMap<Enemy, number>();
  private dyingFxCooldownMs = new WeakMap<Enemy, number>();
  private dyingEntered = new WeakSet<Enemy>();
  private playerContactCooldownMs = 0;
  private playerDamageCooldownMs = 0;

  constructor(particles: ParticleSystem) {
    this.particles = particles;
  }

  update(deltaMs: number): void {
    this.playerContactCooldownMs = Math.max(
      0,
      this.playerContactCooldownMs - deltaMs,
    );
    this.playerDamageCooldownMs = Math.max(
      0,
      this.playerDamageCooldownMs - deltaMs,
    );
  }

  reset(): void {
    this.chargeRingCooldownMs = new WeakMap();
    this.dyingFxCooldownMs = new WeakMap();
    this.dyingEntered = new WeakSet();
    this.playerContactCooldownMs = 0;
    this.playerDamageCooldownMs = 0;
  }

  onEnemySpawn(enemy: Enemy): void {
    this.chargeRingCooldownMs.delete(enemy);
    this.dyingFxCooldownMs.delete(enemy);
    this.dyingEntered.delete(enemy);
  }

  onEnemyReleased(enemy: Enemy): void {
    this.chargeRingCooldownMs.delete(enemy);
    this.dyingFxCooldownMs.delete(enemy);
    this.dyingEntered.delete(enemy);
  }

  onShotEmit(owner: BulletOwner, x: number, y: number, spec: BulletSpec): void {
    const muzzle = spec.vfx?.muzzle;
    const color = muzzle?.color ?? spec.color ?? this.resolveOwnerColor(owner);
    const burstCount = clamp(
      Math.round(
        muzzle?.burstCount ??
          (owner === "player" ? 0 : spec.kind === "orb" ? 1 : 2),
      ),
      0,
      10,
    );
    if (burstCount > 0) {
      this.particles.spawnBurst(x, y, burstCount, color);
    }
    const ringRadius =
      muzzle?.radius ??
      Math.max(spec.radius * (owner === "player" ? 1.35 : 1.7), 3);
    const ringLifeSec = Math.max(
      (muzzle?.lifeMs ?? (owner === "player" ? 65 : 90)) / 1000,
      0.05,
    );
    this.particles.spawnRing(x, y, ringRadius, color, 1.2, ringLifeSec);
  }

  onBulletTrail(
    x: number,
    y: number,
    angleRad: number,
    spec: BulletSpec,
  ): void {
    const trail = spec.trail;
    const color = trail?.color ?? spec.color ?? PLAYER_FX_COLOR;
    const kind = spec.vfx?.trail?.kind ?? trail?.kind ?? "spark";
    const count = Math.max(
      1,
      Math.round(
        trail?.count ??
          (spec.kind === "missile" ? 3 : spec.kind === "dart" ? 2 : 1),
      ),
    );
    if (kind === "spark") {
      const trailAngle = angleRad + Math.PI;
      const spread = spec.kind === "missile" ? 0.2 : 0.3;
      const softColor = dimColor(color, 0.58);
      const brightColor = dimColor(color, 0.76);
      this.particles.spawnSparks(x, y, count, {
        angleMax: trailAngle + spread,
        angleMin: trailAngle - spread,
        colors: [softColor, brightColor],
        drag: 0.86,
        lengthMax: spec.kind === "missile" ? 7.8 : 5.4,
        lengthMin: spec.kind === "missile" ? 3.4 : 2.6,
        lifeMax: 0.14,
        lifeMin: 0.07,
        speedMax: spec.kind === "missile" ? 112 : 92,
        speedMin: 42,
        thicknessMax: 1.15,
        thicknessMin: 0.72,
      });
      return;
    }
    this.particles.spawnTrail(
      x,
      y,
      color,
      trail?.sizeMin,
      trail?.sizeMax,
      trail?.count,
    );
  }

  onBulletImpact(
    x: number,
    y: number,
    spec: BulletSpec,
    owner: BulletOwner,
  ): void {
    const impact = spec.vfx?.impact;
    const color = impact?.color ?? spec.color ?? this.resolveOwnerColor(owner);
    const sparkCount = clamp(
      Math.round(impact?.sparkCount ?? (spec.kind === "dart" ? 8 : 5)),
      0,
      20,
    );
    const ringRadius = Math.max(impact?.ringRadius ?? spec.radius * 3, 6);
    const ringLifeSec = Math.max((impact?.ringLifeMs ?? 180) / 1000, 0.08);
    this.particles.spawnSparks(x, y, sparkCount, {
      colors: [color, 0xffffff],
      drag: 0.9,
      lengthMax: 8,
      lengthMin: 4,
      lifeMax: 0.2,
      lifeMin: 0.12,
      speedMax: 180,
      speedMin: 80,
      thicknessMax: 1.5,
      thicknessMin: 1,
    });
    this.particles.spawnRing(x, y, ringRadius, color, 1.8, ringLifeSec);
  }

  onBulletExplosion(
    x: number,
    y: number,
    spec: BulletSpec,
    owner: BulletOwner,
  ): BulletExplosionInfo {
    const explosion = getBulletExplosionInfo(spec, owner);
    const detonation = spec.vfx?.detonation;
    const burstCount = clamp(Math.round(detonation?.burstCount ?? 24), 0, 40);
    const ringThickness = Math.max(detonation?.ringThickness ?? 2, 1);
    const ringLifeSec = Math.max((detonation?.ringLifeMs ?? 400) / 1000, 0.12);
    this.particles.spawnBurst(x, y, burstCount, explosion.color, true);
    this.particles.spawnRing(
      x,
      y,
      explosion.radius,
      explosion.color,
      ringThickness,
      ringLifeSec,
      true,
    );
    return explosion;
  }

  onEnemyCharging(enemy: Enemy, deltaMs: number): void {
    const progress = clamp(enemy.chargeProgress, 0, 1);
    const style = enemy.def.style;
    const chargeFx = style?.fx?.charge;
    const color = parseVectorColor(style?.color) ?? ENEMY_DEATH_COLOR;
    const minCount = clamp(
      Math.round(chargeFx?.inwardCountMinMax?.[0] ?? 2),
      1,
      10,
    );
    const maxCount = clamp(
      Math.round(chargeFx?.inwardCountMinMax?.[1] ?? 6),
      minCount,
      14,
    );
    const inwardCount = clamp(
      Math.round(lerp(minCount, maxCount, progress)),
      minCount,
      maxCount,
    );
    const radiusScale = Math.max(chargeFx?.ringRadiusScale ?? 1, 0.2);
    this.particles.spawnInward(
      enemy.x,
      enemy.y,
      inwardCount,
      color,
      enemy.radius * (2.3 + progress * 0.9) * radiusScale,
    );

    const ringCooldown = this.chargeRingCooldownMs.get(enemy) ?? 0;
    const remaining = ringCooldown - deltaMs;
    if (remaining <= 0) {
      this.particles.spawnRing(
        enemy.x,
        enemy.y,
        enemy.radius * (1.4 + progress * 1.2) * radiusScale,
        color,
        2,
        0.22,
      );
      const baseInterval = Math.max(chargeFx?.ringIntervalMs ?? 220, 40);
      const minInterval = Math.max(Math.round(baseInterval * 0.32), 50);
      this.chargeRingCooldownMs.set(
        enemy,
        lerp(baseInterval, minInterval, progress),
      );
    } else {
      this.chargeRingCooldownMs.set(enemy, remaining);
    }
    enemy.glow(0.12 + progress * 0.32);
  }

  onEnemyDeath(enemy: Enemy, dropGold: boolean): void {
    const deathFx = enemy.def.style?.fx?.death;
    const color = parseVectorColor(enemy.def.style?.color) ?? ENEMY_DEATH_COLOR;
    if (dropGold) {
      const isBoss = enemy.def.id === "boss";
      const primaryBurst = clamp(
        Math.round(deathFx?.burstCount ?? (isBoss ? 40 : 18)),
        4,
        40,
      );
      this.particles.spawnBurst(enemy.x, enemy.y, primaryBurst, color, true);
      const secondaryBurst = clamp(
        Math.round(deathFx?.secondaryBurstCount ?? (isBoss ? 30 : 0)),
        0,
        40,
      );
      if (secondaryBurst > 0) {
        this.particles.spawnBurst(
          enemy.x,
          enemy.y,
          secondaryBurst,
          0xff9fae,
          true,
        );
      }
      this.particles.spawnSparks(enemy.x, enemy.y, isBoss ? 20 : 10, {
        colors: [color, 0xffffff, 0xffd5a8],
        drag: 0.92,
        lengthMax: 14,
        lengthMin: 6,
        lifeMax: 0.45,
        lifeMin: 0.2,
        priority: true,
        speedMax: isBoss ? 320 : 220,
        speedMin: isBoss ? 140 : 80,
      });
      this.particles.spawnDebris(enemy.x, enemy.y, isBoss ? 22 : 10, 0xffc477, {
        drag: 0.95,
        lifeMax: isBoss ? 1.1 : 0.8,
        lifeMin: isBoss ? 0.45 : 0.3,
        priority: true,
        sizeMax: isBoss ? 4.5 : 3.2,
        sizeMin: isBoss ? 2.1 : 1.4,
        speedMax: isBoss ? 260 : 180,
        speedMin: isBoss ? 90 : 60,
      });
      if (isBoss) {
        const ringScale = Math.max(deathFx?.ringRadiusScale ?? 1, 0.2);
        this.particles.spawnRing(
          enemy.x,
          enemy.y,
          enemy.radius * 6 * ringScale,
          color,
          5,
          0.8,
          true,
        );
        this.particles.spawnRing(
          enemy.x,
          enemy.y,
          enemy.radius * 3.5 * ringScale,
          0xffa3b8,
          3,
          0.6,
          true,
        );
      }
      return;
    }
    this.particles.spawnBurst(enemy.x, enemy.y, 6, 0x1f3c5e);
  }

  onEnemyDying(enemy: Enemy, deltaMs: number): void {
    const hpRatio = enemy.hpRatio;
    const deathProgress = clamp(1 - hpRatio / 0.25, 0, 1);
    const smokeColor = 0x394553;
    const sparkColor =
      parseVectorColor(enemy.def.style?.color) ?? ENEMY_DEATH_COLOR;

    if (!this.dyingEntered.has(enemy)) {
      this.dyingEntered.add(enemy);
      this.particles.spawnRing(
        enemy.x,
        enemy.y,
        enemy.radius * 1.35,
        sparkColor,
        2.2,
        0.24,
      );
      this.particles.spawnSparks(enemy.x, enemy.y, 8, {
        colors: [sparkColor, 0xffffff],
        lengthMax: 10,
        lengthMin: 4,
        lifeMax: 0.28,
        lifeMin: 0.16,
        speedMax: 180,
        speedMin: 80,
      });
    }

    const cooldown = this.dyingFxCooldownMs.get(enemy) ?? 0;
    const remaining = cooldown - deltaMs;
    if (remaining > 0) {
      this.dyingFxCooldownMs.set(enemy, remaining);
      return;
    }

    const smokeCount = clamp(Math.round(2 + deathProgress * 5), 2, 7);
    this.particles.spawnSmoke(enemy.x, enemy.y, smokeCount, smokeColor, {
      grow: lerp(2.8, 4.3, deathProgress),
      lifeMax: lerp(0.45, 0.7, deathProgress),
      lifeMin: 0.26,
      sizeMax: lerp(2.8, 4.2, deathProgress),
      sizeMin: 1.4,
      speedMax: lerp(24, 40, deathProgress),
      speedMin: 8,
    });

    const sparkCount = clamp(Math.round(1 + deathProgress * 4), 1, 5);
    this.particles.spawnSparks(enemy.x, enemy.y, sparkCount, {
      colors: [sparkColor, 0xffffff, 0xffd8a2],
      drag: 0.9,
      lengthMax: 8,
      lengthMin: 4,
      lifeMax: 0.24,
      lifeMin: 0.12,
      speedMax: 180,
      speedMin: 70,
      thicknessMax: 1.4,
      thicknessMin: 0.9,
    });

    const debrisCount = deathProgress > 0.38 ? 1 : 0;
    if (debrisCount > 0) {
      this.particles.spawnDebris(enemy.x, enemy.y, debrisCount, 0xbdd9ff, {
        drag: 0.94,
        lifeMax: 0.55,
        lifeMin: 0.3,
        sizeMax: 1.9,
        sizeMin: 1.1,
        speedMax: 120,
        speedMin: 45,
      });
    }

    const next = lerp(140, 45, deathProgress);
    this.dyingFxCooldownMs.set(enemy, next);
  }

  onPlayerContact(x: number, y: number, color = PLAYER_FX_COLOR): void {
    if (this.playerContactCooldownMs > 0) return;
    this.playerContactCooldownMs = 110;
    this.particles.spawnRing(x, y, 16, color, 1.5, 0.18);
  }

  onPlayerDamage(x: number, y: number): void {
    if (this.playerDamageCooldownMs > 0) return;
    this.playerDamageCooldownMs = 75;
    this.particles.spawnRing(x, y, 20, 0xff6b6b, 2, 0.2, true);
  }

  private resolveOwnerColor(owner: BulletOwner): number {
    return owner === "player" ? PLAYER_FX_COLOR : ENEMY_FX_COLOR;
  }
}
