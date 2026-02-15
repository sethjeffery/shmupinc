import type { ShipVector } from "../data/shipTypes";
import type Phaser from "phaser";

import { vectorFromOutlineLines } from "../data/vectorShape";
import { drawVectorToCanvas } from "./vector/drawCanvas";
import { drawVectorToGraphics } from "./vector/drawPhaser";

export const DEFAULT_SHIP_VECTOR: ShipVector = vectorFromOutlineLines([
  { x: 0, y: -1 },
  { x: 0.5, y: 0.3 },
  { x: 0.8, y: -0.1 },
  { x: 0.95, y: 0 },
  { x: 0.8, y: 1 },
  { x: 0, y: 0.8 },
  { x: -0.8, y: 1 },
  { x: -0.95, y: 0 },
  { x: -0.8, y: -0.1 },
  { x: -0.5, y: 0.3 },
]);

export const drawShipToGraphics = (
  graphics: Phaser.GameObjects.Graphics,
  vector: ShipVector,
  radius: number,
): void => {
  drawVectorToGraphics(graphics, vector, { scale: radius, x: 0, y: 0 });
};

export const drawShipToCanvas = (
  ctx: CanvasRenderingContext2D,
  vector: ShipVector,
  radius: number,
): void => {
  drawVectorToCanvas(ctx, vector, { scale: radius, x: 0, y: 0 });
};
