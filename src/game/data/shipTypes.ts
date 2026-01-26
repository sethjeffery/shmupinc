import type { Vec2 } from "./scripts";
import type { WeaponSize, WeaponZone } from "./weaponTypes";

export type ShipId = string;

export type ShipShape = "bulwark" | "interceptor" | "scout" | "starling";

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
  zone: WeaponZone;
  size: WeaponSize;
  offset: Vec2; // relative to ship radius
}

export interface ShipDefinition {
  id: ShipId;
  name: string;
  description: string;
  cost: number;
  maxHp: number;
  moveSpeed: number;
  color: number;
  shape: ShipShape;
  vector?: ShipVector;
  radiusMultiplier: number;
  magnetMultiplier: number;
  mounts: WeaponMount[];
}
