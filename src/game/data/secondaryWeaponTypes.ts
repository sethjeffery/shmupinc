import type { BulletSpec } from "./scripts";
import type { WeaponPattern } from "./weaponPatterns";

export type SecondaryWeaponId = string;

export interface SecondaryWeaponDefinition {
  id: SecondaryWeaponId;
  name: string;
  description: string;
  cost: number;
  fireRate: number;
  pattern: WeaponPattern;
  bullet: BulletSpec;
  muzzleOffsets?: { x: number; y: number }[];
}
