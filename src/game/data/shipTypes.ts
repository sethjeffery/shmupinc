import type { EnemyHitbox } from "./enemyTypes";
import type { Vec2 } from "./scripts";
import type { VectorShape } from "./vectorShape";
import type { WeaponSize } from "./weaponTypes";

export type ShipId = string;

export type ShipVector = VectorShape;
export type ShipHitbox = EnemyHitbox;

export const BASE_SHIP_RADIUS = 17;

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
  hitbox?: ShipHitbox;
  radiusMultiplier: number;
  magnetMultiplier: number;
  requiresUnlocks?: string[];
  mounts: WeaponMount[];
}

export const resolveShipRadius = (
  ship: Pick<ShipDefinition, "radiusMultiplier">,
  baseRadius = BASE_SHIP_RADIUS,
): number => baseRadius * (ship.radiusMultiplier ?? 1);

export const resolveShipHitbox = (
  ship: Pick<ShipDefinition, "hitbox" | "radiusMultiplier">,
  baseRadius = BASE_SHIP_RADIUS,
): ShipHitbox =>
  ship.hitbox ?? {
    kind: "circle",
    radius: resolveShipRadius(ship, baseRadius),
  };

export const shipHitboxMaxRadius = (hitbox: ShipHitbox): number =>
  hitbox.kind === "circle"
    ? hitbox.radius
    : Math.max(hitbox.radiusX, hitbox.radiusY);
