import type { EnemyId } from "../enemyTypes";
import type { ShipId } from "../shipTypes";
import type { WaveDefinition } from "../waves";
import type { WeaponId } from "../weaponTypes";

export type PressureKind = "enemy" | "focus" | "space" | "throughput" | "time";

export interface PressureProfile {
  primary: PressureKind;
  secondary?: PressureKind[];
}

export interface HazardMotionSine {
  kind: "sine";
  axis: "x" | "y";
  amplitude: number; // normalized to playfield axis
  periodMs: number;
  phase?: number;
}

export interface HazardMotionLerp {
  kind: "lerp";
  axis: "x" | "y";
  from: number; // normalized offset from base position
  to: number; // normalized offset from base position
  durationMs: number;
  yoyo?: boolean;
}

export type HazardMotion = HazardMotionLerp | HazardMotionSine;

export interface LaneWallScript {
  type: "laneWall";
  x: number; // normalized center x (0..1)
  y: number; // normalized center y (0..1)
  w: number; // normalized width (0..1)
  h: number; // normalized height (0..1)
  motion?: HazardMotion;
  damageOnTouch?: boolean;
  fillColor?: number;
  lineColor?: number;
}

export type HazardScript = LaneWallScript;

export interface ShopRules {
  allowedWeapons?: WeaponId[];
  allowedShips?: ShipId[];
  caps?: {
    weaponCost?: number;
    shipCost?: number;
  };
}

export type LevelEndCondition =
  | { kind: "clearWaves" }
  | { kind: "defeatBoss"; bossId: EnemyId }
  | { kind: "survive"; durationMs: number };

export interface LevelDefinition {
  id: string;
  title: string;
  pressureProfile: PressureProfile;
  preBeatId?: string;
  postBeatId?: string;
  waves: WaveDefinition[];
  hazards?: HazardScript[];
  shopRules?: ShopRules;
  winCondition: LevelEndCondition;
  endCondition?: LevelEndCondition;
}
