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
  particles.spawnTrail(
    x,
    y,
    trail.color ?? spec.color ?? 0x7df9ff,
    trail.sizeMin,
    trail.sizeMax,
    trail.count,
  );
};

export const spawnBulletExplosionFx = (
  particles: ParticleSystem,
  x: number,
  y: number,
  explosion: BulletExplosionInfo,
  burstCount = 24,
): void => {
  particles.spawnBurst(x, y, burstCount, explosion.color);
  particles.spawnRing(x, y, explosion.radius, explosion.color);
};
