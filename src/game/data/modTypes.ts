import type { BulletHoming, BulletRicochet } from "./scripts";
import type { VectorShape } from "./vectorShape";

export type ModId = string;

export type ModIconKind = "aoe" | "bounce" | "homing" | "multi" | "power";

export type ModIconVector = VectorShape;

export interface ModMultiEffect {
  count: 3;
  spreadDeg: number;
  projectileDamageMultiplier: number;
}

export interface ModAoeEffect {
  radiusMultiplier?: number;
  radiusAdd?: number;
  damageMultiplier?: number;
  defaultRadius?: number;
  defaultDamageFactor?: number;
}

export interface ModEffects {
  damageMultiplier?: number;
  homing?: BulletHoming;
  aoe?: ModAoeEffect;
  multi?: ModMultiEffect;
  bounce?: BulletRicochet;
}

export interface ModDefinition {
  id: ModId;
  name: string;
  description: string;
  cost: number;
  costResource?: string;
  requiresUnlocks?: string[];
  iconKind: ModIconKind;
  icon: ModIconVector;
  effects: ModEffects;
}
