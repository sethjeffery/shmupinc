import type { FireScript, MoveScript } from "./scripts";

export interface BossPhase {
  hpThreshold: number;
  move?: MoveScript;
  fire?: FireScript;
}

export type EnemyId = string;

export type EnemyShape =
  | "asteroid"
  | "blimp"
  | "bomber"
  | "boss"
  | "crossfire"
  | "sidesweeper"
  | "sine"
  | "skitter"
  | "snake"
  | "sniper"
  | "spinner"
  | "swooper";

export interface EnemyVectorLine {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export interface EnemyVector {
  outline: { x: number; y: number }[];
  lines?: EnemyVectorLine[];
}

export type EnemyHitbox =
  | {
      kind: "circle";
      radius: number;
    }
  | {
      kind: "ellipse";
      radiusX: number;
      radiusY: number;
    };

export interface EnemyDef {
  id: EnemyId;
  hp: number;
  radius: number;
  hitbox: EnemyHitbox;
  goldDrop: { min: number; max: number };
  move: MoveScript;
  fire: FireScript;
  phases?: BossPhase[];
  rotation?: "fixed" | "movement";
  rotationDeg?: number;
  style?: {
    fillColor?: number;
    lineColor?: number;
    shape?: EnemyShape;
    vector?: EnemyVector;
  };
}
