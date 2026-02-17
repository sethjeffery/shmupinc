export type GalaxyDecorationKind = "asteroidField" | "nebula" | "planet";

export interface GalaxyNodePosition {
  x: number;
  y: number;
}

export interface GalaxyLevelDefinition {
  levelId: string;
  name?: string;
  pos: GalaxyNodePosition;
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
  levels: GalaxyLevelDefinition[];
  decorations?: GalaxyDecorationDefinition[];
}
