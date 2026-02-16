import type { FireScript, MoveScript } from "./scripts";
import type { VectorColor, VectorShape } from "./vectorShape";

export interface BossPhase {
  hpThreshold: number;
  move?: MoveScript;
  fire?: FireScript;
}

export type EnemyId = string;

export type EnemyVector = VectorShape;

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
    color?: VectorColor;
    vector?: EnemyVector;
    fx?: {
      charge?: {
        ringIntervalMs?: number;
        inwardCountMinMax?: [number, number];
        ringRadiusScale?: number;
      };
      death?: {
        burstCount?: number;
        secondaryBurstCount?: number;
        ringRadiusScale?: number;
      };
    };
  };
}
