export type GalaxyDecorationKind = "asteroidField" | "nebula" | "planet";

export interface GalaxyNodePosition {
  x: number;
  y: number;
}

export interface GalaxyNodeDefinition {
  id: string;
  levelId: string;
  name?: string;
  pos: GalaxyNodePosition;
}

export interface GalaxyEdgeDefinition {
  from: string;
  to: string;
}

export interface GalaxyDecorationDefinition {
  id?: string;
  kind: GalaxyDecorationKind;
  label?: string;
  pos: GalaxyNodePosition;
  scale?: number;
  tint?: string;
}

export interface GalaxyDefinition {
  id: string;
  name: string;
  description?: string;
  startNodeId: string;
  nodes: GalaxyNodeDefinition[];
  edges: GalaxyEdgeDefinition[];
  decorations?: GalaxyDecorationDefinition[];
}

