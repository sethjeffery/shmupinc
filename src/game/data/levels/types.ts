import type { EnemyId } from "../enemyTypes";
import type { ModId } from "../modTypes";
import type { ObjectiveSetDefinition } from "../objectiveTypes";
import type { ShipId } from "../shipTypes";
import type { WaveDefinition } from "../waves";
import type { WeaponId } from "../weaponTypes";

type PressureKind = "enemy" | "focus" | "space" | "throughput" | "time";

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

export interface HazardMotionSweep {
  kind: "sweep";
  from: {
    x: number; // normalized offset from base position
    y: number; // normalized offset from base position
  };
  to: {
    x: number; // normalized offset from base position
    y: number; // normalized offset from base position
  };
  durationMs: number;
  loop?: boolean;
  yoyo?: boolean;
}

export type HazardMotion =
  | HazardMotionLerp
  | HazardMotionSine
  | HazardMotionSweep;

export interface LaneWallScript {
  type: "laneWall";
  x: number; // normalized center x (0..1)
  y: number; // normalized center y (0..1)
  w: number; // normalized width (0..1)
  h: number; // normalized height (0..1)
  startMs?: number;
  endMs?: number;
  motion?: HazardMotion;
  damageOnTouch?: boolean;
  deathOnBottomEject?: boolean;
  fillColor?: number;
  lineColor?: number;
}

export type HazardScript = LaneWallScript;

export interface ShopRules {
  allowedWeapons?: WeaponId[];
  allowedMods?: ModId[];
  allowedShips?: ShipId[];
  caps?: {
    weaponCost?: number;
    modCost?: number;
    shipCost?: number;
  };
}

export type LevelEndCondition =
  | { kind: "clearWaves" }
  | { kind: "defeatBoss"; bossId: EnemyId }
  | { kind: "survive"; durationMs: number };

export interface LevelConversationMoment {
  characterId?: string;
  durationMs?: number;
  expression?: string;
  placement?: "bottom" | "center" | "top";
  text: string;
  transition?: "smooth" | "urgent" | "wham";
}

export interface LevelEventCondition {
  firstClearOnly?: boolean;
  hpRatioGte?: number;
  hpRatioLte?: number;
  maxTimes?: number;
  maxHpGte?: number;
  maxHpLte?: number;
  repeatOnly?: boolean;
}

export type LevelEventAction =
  | {
      kind: "conversation";
      moments: LevelConversationMoment[];
    }
  | {
      kind: "wave";
      wave: WaveDefinition;
    };

export interface LevelEventBranchOption {
  event: LevelEventAction;
  when?: LevelEventCondition;
}

export type LevelEvent =
  | {
      kind: "branch";
      options: LevelEventBranchOption[];
    }
  | LevelEventAction;

export interface LevelDefinition {
  events: LevelEvent[];
  id: string;
  title: string;
  pressureProfile: PressureProfile;
  hazards?: HazardScript[];
  objectiveSet?: ObjectiveSetDefinition;
  shopRules?: ShopRules;
  winCondition: LevelEndCondition;
  endCondition?: LevelEndCondition;
}
