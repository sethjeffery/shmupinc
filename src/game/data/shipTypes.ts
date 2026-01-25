export type ShipId = string;

export type ShipShape = "bulwark" | "interceptor" | "scout" | "starling";

export interface ShipDefinition {
  id: ShipId;
  name: string;
  description: string;
  cost: number;
  maxHp: number;
  moveSpeed: number;
  color: number;
  shape: ShipShape;
  radiusMultiplier: number;
  magnetMultiplier: number;
}
