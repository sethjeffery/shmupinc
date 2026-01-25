import type { BulletSpec } from "./scripts";
import type { WeaponPattern } from "./weaponPatterns";

export type WeaponId = string;

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  description: string;
  cost: number;
  fireRate: number; // shots per second
  pattern: WeaponPattern;
  bullet: BulletSpec;
  icon: "bomb" | "dart" | "missile" | "orb";
  muzzleOffsets?: { x: number; y: number }[];
}
