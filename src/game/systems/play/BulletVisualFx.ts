import type { BulletSpec } from "../../data/scripts";
import type { BulletOwner } from "../../entities/Bullet";
import type { ParticleSystem } from "../Particles";

export interface BulletExplosionInfo {
  color: number;
  damage: number;
  radius: number;
}

export const isExplosiveBullet = (spec: BulletSpec): boolean =>
  spec.kind === "bomb" || Boolean(spec.aoe);

export const getBulletExplosionInfo = (
  spec: BulletSpec,
  owner: BulletOwner,
): BulletExplosionInfo => {
  const aoe = spec.aoe;
  return {
    color: spec.color ?? (owner === "player" ? 0x7df9ff : 0xff9f43),
    damage: aoe?.damage ?? spec.damage,
    radius: aoe?.radius ?? spec.radius * 3,
  };
};

export const spawnBulletTrail = (
  particles: ParticleSystem,
  x: number,
  y: number,
  spec: BulletSpec,
): void => {
  const trail = spec.trail;
  if (!trail) return;
  const color = trail.color ?? spec.color ?? 0x7df9ff;
  const kind = spec.vfx?.trail?.kind ?? trail.kind ?? "dot";
  if (kind === "spark") {
    particles.spawnSparks(x, y, Math.max(1, trail.count ?? 1), {
      colors: [color, 0xffffff],
      drag: 0.88,
      lengthMax: 4.5,
      lengthMin: 2.5,
      lifeMax: 0.14,
      lifeMin: 0.08,
      speedMax: 80,
      speedMin: 40,
      thicknessMax: 1.2,
      thicknessMin: 0.8,
    });
    return;
  }
  particles.spawnTrail(x, y, color, trail.sizeMin, trail.sizeMax, trail.count);
};

export const spawnBulletExplosionFx = (
  particles: ParticleSystem,
  x: number,
  y: number,
  explosion: BulletExplosionInfo,
  burstCount = 24,
  options?: { ringLifeMs?: number; ringThickness?: number },
): void => {
  particles.spawnBurst(x, y, burstCount, explosion.color);
  particles.spawnRing(
    x,
    y,
    explosion.radius,
    explosion.color,
    Math.max(1, options?.ringThickness ?? 2),
    Math.max((options?.ringLifeMs ?? 400) / 1000, 0.1),
  );
};
