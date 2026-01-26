import type { ShipShape, ShipVector } from "../data/shipTypes";
import type Phaser from "phaser";

export const SHIP_VECTORS: Record<ShipShape, ShipVector> = {
  bulwark: {
    outline: [
      { x: 0, y: -0.7 },
      { x: 0.25, y: -0.9 },
      { x: 0.8, y: -0.7 },
      { x: 1, y: -1 },
      { x: 1.15, y: 0 },
      { x: 1, y: 0.8 },
      { x: 0.35, y: 1 },
      { x: -0.35, y: 1 },
      { x: -1, y: 0.8 },
      { x: -1.15, y: 0 },
      { x: -1, y: -1 },
      { x: -0.8, y: -0.7 },
      { x: -0.25, y: -0.9 },
    ],
  },
  interceptor: {
    outline: [
      { x: 0, y: -0.8 },
      { x: 0.3, y: -0.7 },
      { x: 0.5, y: -0.4 },
      { x: 0.9, y: -0.8 },
      { x: 1.15, y: 0 },
      { x: 0.95, y: 0.9 },
      { x: 0.65, y: 0.9 },
      { x: 0, y: 0.8 },
      { x: -0.65, y: 0.9 },
      { x: -0.95, y: 0.9 },
      { x: -1.15, y: 0 },
      { x: -0.9, y: -0.8 },
      { x: -0.5, y: -0.4 },
      { x: -0.3, y: -0.7 },
    ],
  },
  scout: {
    outline: [
      { x: 0, y: -1 },
      { x: 0.4, y: -0.25 },
      { x: 1, y: 0.3 },
      { x: 1, y: 0.5 },
      { x: 0.3, y: 0.2 },
      { x: 0.45, y: 1 },
      { x: 0.25, y: 1 },
      { x: 0, y: 0.9 },
      { x: -0.25, y: 1 },
      { x: -0.45, y: 1 },
      { x: -0.3, y: 0.2 },
      { x: -1, y: 0.5 },
      { x: -1, y: 0.3 },
      { x: -0.4, y: -0.25 },
    ],
  },
  starling: {
    outline: [
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
    ],
  },
};

const resolveShipVector = (shape: ShipShape | ShipVector): ShipVector =>
  typeof shape === "string" ? SHIP_VECTORS[shape] : shape;

const drawOutline = (
  outline: ShipVector["outline"],
  radius: number,
  moveTo: (x: number, y: number) => void,
  lineTo: (x: number, y: number) => void,
): void => {
  if (outline.length === 0) return;
  const first = outline[0];
  moveTo(first.x * radius, first.y * radius);
  for (let i = 1; i < outline.length; i += 1) {
    const point = outline[i];
    lineTo(point.x * radius, point.y * radius);
  }
};

const drawLines = (
  lines: ShipVector["lines"],
  radius: number,
  moveTo: (x: number, y: number) => void,
  lineTo: (x: number, y: number) => void,
): void => {
  if (!lines) return;
  for (const line of lines) {
    moveTo(line.from.x * radius, line.from.y * radius);
    lineTo(line.to.x * radius, line.to.y * radius);
  }
};

export const drawShipToGraphics = (
  graphics: Phaser.GameObjects.Graphics,
  shape: ShipShape | ShipVector,
  radius: number,
): void => {
  const vector = resolveShipVector(shape);
  graphics.beginPath();
  drawOutline(vector.outline, radius, (x, y) => graphics.moveTo(x, y), (x, y) => graphics.lineTo(x, y));
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();
  if (vector.lines && vector.lines.length > 0) {
    for (const line of vector.lines) {
      graphics.beginPath();
      drawLines(
        [line],
        radius,
        (x, y) => graphics.moveTo(x, y),
        (x, y) => graphics.lineTo(x, y),
      );
      graphics.strokePath();
    }
  }
};

export const drawShipToCanvas = (
  ctx: CanvasRenderingContext2D,
  shape: ShipShape | ShipVector,
  radius: number,
): void => {
  const vector = resolveShipVector(shape);
  ctx.beginPath();
  drawOutline(vector.outline, radius, (x, y) => ctx.moveTo(x, y), (x, y) => ctx.lineTo(x, y));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (vector.lines && vector.lines.length > 0) {
    for (const line of vector.lines) {
      ctx.beginPath();
      drawLines(
        [line],
        radius,
        (x, y) => ctx.moveTo(x, y),
        (x, y) => ctx.lineTo(x, y),
      );
      ctx.stroke();
    }
  }
};
