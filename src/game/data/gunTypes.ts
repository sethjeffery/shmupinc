import type { Vec2 } from "./scripts";

export type GunId = string;

export interface GunLine {
  from: Vec2;
  to: Vec2;
}

export interface GunDefinition {
  id: GunId;
  name: string;
  description: string;
  outline: Vec2[];
  lines?: GunLine[];
  fillColor?: number;
  lineColor?: number;
}
