import type { Vec2 } from "./scripts";
import type { WeaponSize } from "./weaponTypes";

export type ShipId = string;

export interface ShipVectorLine {
  from: Vec2;
  to: Vec2;
}

export interface ShipVector {
  outline: Vec2[];
  lines?: ShipVectorLine[];
}

export interface WeaponMount {
  id: string;
  size: WeaponSize;
  offset: Vec2; // relative to ship radius
  modSlots: number;
}

export interface ShipDefinition {
  id: ShipId;
  name: string;
  description: string;
  cost: number;
  costResource?: string;
  maxHp: number;
  moveSpeed: number;
  color: number;
  vector: ShipVector;
  radiusMultiplier: number;
  magnetMultiplier: number;
  requiresUnlocks?: string[];
  mounts: WeaponMount[];
}
