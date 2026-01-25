import type { FireScript, MoveScript } from "./scripts";

export interface BossPhase {
  hpThreshold: number;
  move?: MoveScript;
  fire?: FireScript;
}

export type EnemyId = string;

export type EnemyShape =
  | "asteroid"
  | "bomber"
  | "boss"
  | "crossfire"
  | "sine"
  | "skitter"
  | "snake"
  | "sniper"
  | "spinner"
  | "swooper";

export interface EnemyDef {
  id: EnemyId;
  hp: number;
  radius: number;
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
  };
}
