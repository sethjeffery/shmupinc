import type { VectorShape } from "./vectorShape";

export type GunId = string;

export interface GunDefinition {
  id: GunId;
  name: string;
  description: string;
  vector: VectorShape;
}
