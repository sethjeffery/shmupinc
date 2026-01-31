import type { BulletAoe, BulletHoming, BulletSpec, Vec2 } from "./scripts";

export type WeaponId = string;

export type WeaponZone = "front" | "rear" | "side";

export type WeaponSize = "large" | "small";

export type MultiShotMode = "roundRobin" | "simultaneous";

export interface WeaponShot {
  angleDeg?: number;
  offset?: Vec2;
}

export const DEFAULT_WEAPON_SHOTS: WeaponShot[] = [
  { angleDeg: 0, offset: { x: 0, y: 0 } },
];

export interface WeaponStats {
  speed: number;
  fireRate: number;
  bullet: BulletSpec;
  homing?: BulletHoming;
  aoe?: BulletAoe;
  lifetimeMs?: number;
  angleDeg?: number;
  shots?: WeaponShot[];
  multiShotMode?: MultiShotMode;
}

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  description: string;
  cost: number;
  gunId: string;
  size: WeaponSize;
  zones: WeaponZone[];
  stats: WeaponStats;
  zoneStats?: Partial<Record<WeaponZone, Partial<WeaponStats>>>;
}
