export type ShipId = "bulwark" | "interceptor" | "scout" | "starter";

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

export const SHIPS: Record<ShipId, ShipDefinition> = {
  bulwark: {
    color: 0xff6b6b,
    cost: 260,
    description: "High armor, slower handling.",
    id: "bulwark",
    magnetMultiplier: 1,
    maxHp: 10,
    moveSpeed: 5.5,
    name: "Bulwark",
    radiusMultiplier: 1.35,
    shape: "bulwark",
  },
  interceptor: {
    color: 0x7df9ff,
    cost: 220,
    description: "Balanced ship with steady handling.",
    id: "interceptor",
    magnetMultiplier: 2.5,
    maxHp: 7,
    moveSpeed: 6.8,
    name: "Interceptor",
    radiusMultiplier: 1,
    shape: "interceptor",
  },
  scout: {
    color: 0xffd166,
    cost: 120,
    description: "Fast, light, low HP.",
    id: "scout",
    magnetMultiplier: 1.25,
    maxHp: 5,
    moveSpeed: 8.2,
    name: "Scout",
    radiusMultiplier: 1,
    shape: "scout",
  },
  starter: {
    color: 0x9fb7ff,
    cost: 0,
    description: "Your trusty starter craft.",
    id: "starter",
    magnetMultiplier: 1,
    maxHp: 6,
    moveSpeed: 7,
    name: "Starling",
    radiusMultiplier: 1,
    shape: "starling",
  },
};

export const STARTER_SHIP_ID: ShipId = "starter";
