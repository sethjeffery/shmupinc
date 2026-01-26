import type { EnemyDef, EnemyId } from "./enemyTypes";

export type EnemyOverride = Partial<
  Pick<
    EnemyDef,
    | "fire"
    | "goldDrop"
    | "hp"
    | "move"
    | "phases"
    | "radius"
    | "rotation"
    | "rotationDeg"
  >
>;

export interface Spawn {
  atMs: number;
  enemyId: EnemyId;
  x: number; // normalized offset from center (-0.5..0.5 across viewport width)
  y: number; // normalized position (0..1 visible, negative spawns above)
  overrides?: EnemyOverride;
}

export interface WaveDefinition {
  id: string;
  spawns: Spawn[];
}
