// MoveScript bezier/dashTo coordinates are normalized offsets from step start.
// x=1 spans one full playfield width, y=1 spans one full playfield height.
export interface Vec2 {
  x: number;
  y: number;
}

export type MoveStep =
  | {
      kind: "bezier";
      points: Vec2[];
      durationMs: number;
      ease?: "in" | "inOut" | "linear" | "out" | "outIn";
    }
  | {
      kind: "dashTo";
      to: Vec2;
      durationMs: number;
      position?: "absolute" | "relative";
      ease?: "in" | "inOut" | "linear" | "out" | "outIn";
    }
  | { kind: "hover"; durationMs: number }
  | {
      kind: "sineDown";
      amp: number;
      freq: number;
      speed: number;
      durationMs: number;
    };

export interface MoveScript {
  steps: MoveStep[];
  loop?: boolean;
}

export type Aim =
  | { kind: "atPlayer" }
  | { kind: "fixed"; angleDeg: number }
  | { kind: "sweep"; fromDeg: number; toDeg: number; periodMs: number };

export type BulletKind = "bomb" | "dart" | "missile" | "orb";

export interface BulletHoming {
  turnRateRadPerSec: number;
  acquireRadius: number;
}

export interface BulletAoe {
  radius: number;
  damage: number;
}

export interface BulletTrail {
  color: number;
  intervalMs?: number;
  sizeMin?: number;
  sizeMax?: number;
  count?: number;
}

export interface BulletRicochet {
  maxBounces: number;
  speedRetention: number;
  damageRetention: number;
  sameTargetCooldownMs: number;
}

export interface BulletSpec {
  kind: BulletKind;
  damage: number;
  radius: number;
  speed?: number;
  lifetimeMs?: number;
  homing?: BulletHoming;
  aoe?: BulletAoe;
  trail?: BulletTrail;
  color?: number;
  length?: number;
  thickness?: number;
  ricochet?: BulletRicochet;
}

// originOffsets are local offsets from the emitter position (no rotation applied).
export type FireStep =
  | {
      kind: "burst";
      count: number;
      intervalMs: number;
      aim: Aim;
      bullet: BulletSpec;
      originOffsets?: Vec2[];
    }
  | { kind: "charge"; durationMs: number }
  | { kind: "cooldown"; durationMs: number }
  | {
      kind: "spray";
      durationMs: number;
      ratePerSec: number;
      aim: Aim;
      bullet: BulletSpec;
      originOffsets?: Vec2[];
    };

export interface FireScript {
  steps: FireStep[];
  loop?: boolean;
}
