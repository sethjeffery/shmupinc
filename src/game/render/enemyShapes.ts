import type { EnemyShape, EnemyVector } from "../data/enemyTypes";
import type Phaser from "phaser";

export const ENEMY_VECTORS: Record<EnemyShape, EnemyVector> = {
  asteroid: {
    lines: [
      { from: { x: -0.2, y: -0.2 }, to: { x: 0.2, y: 0.2 } },
      { from: { x: -0.45, y: 0.2 }, to: { x: -0.1, y: 0.5 } },
    ],
    outline: [
      { x: 0.1, y: -1 },
      { x: 0.6, y: -0.8 },
      { x: 1, y: -0.2 },
      { x: 0.85, y: 0.45 },
      { x: 0.35, y: 0.95 },
      { x: -0.25, y: 0.85 },
      { x: -0.8, y: 0.5 },
      { x: -1, y: -0.1 },
      { x: -0.5, y: -0.75 },
    ],
  },
  bomber: {
    lines: [
      { from: { x: -0.5, y: 0.1 }, to: { x: 0.5, y: 0.1 } },
      { from: { x: -0.15, y: -0.2 }, to: { x: 0.15, y: -0.2 } },
    ],
    outline: [
      { x: 0, y: -1 },
      { x: 0.6, y: -0.6 },
      { x: 1, y: -0.1 },
      { x: 0.95, y: 0.5 },
      { x: 0.55, y: 0.95 },
      { x: 0.15, y: 1 },
      { x: -0.15, y: 1 },
      { x: -0.55, y: 0.95 },
      { x: -0.95, y: 0.5 },
      { x: -1, y: -0.1 },
      { x: -0.6, y: -0.6 },
    ],
  },
  boss: {
    lines: [
      { from: { x: -0.6, y: -0.1 }, to: { x: -0.3, y: 0.25 } },
      { from: { x: 0.6, y: -0.1 }, to: { x: 0.3, y: 0.25 } },
      { from: { x: -0.25, y: -0.45 }, to: { x: 0.25, y: -0.45 } },
    ],
    outline: [
      { x: 0, y: -1 },
      { x: 0.7, y: -0.8 },
      { x: 1.1, y: -0.35 },
      { x: 1.25, y: 0.25 },
      { x: 0.95, y: 0.85 },
      { x: 0.35, y: 1.05 },
      { x: -0.35, y: 1.05 },
      { x: -0.95, y: 0.85 },
      { x: -1.25, y: 0.25 },
      { x: -1.1, y: -0.35 },
      { x: -0.7, y: -0.8 },
    ],
  },
  crossfire: {
    lines: [
      { from: { x: -0.75, y: 0.2 }, to: { x: -0.2, y: 0.2 } },
      { from: { x: 0.2, y: 0.2 }, to: { x: 0.75, y: 0.2 } },
    ],
    outline: [
      { x: 0, y: -1 },
      { x: 0.45, y: -0.6 },
      { x: 1, y: -0.45 },
      { x: 1.1, y: 0.05 },
      { x: 0.7, y: 0.35 },
      { x: 0.65, y: 0.95 },
      { x: 0.2, y: 0.6 },
      { x: -0.2, y: 0.6 },
      { x: -0.65, y: 0.95 },
      { x: -0.7, y: 0.35 },
      { x: -1.1, y: 0.05 },
      { x: -1, y: -0.45 },
      { x: -0.45, y: -0.6 },
    ],
  },
  sidesweeper: {
    lines: [
      { from: { x: -0.6, y: -0.1 }, to: { x: 0.6, y: -0.1 } },
      { from: { x: -0.4, y: 0.2 }, to: { x: 0.4, y: 0.2 } },
    ],
    outline: [
      { x: 0, y: -1 },
      { x: 0.85, y: -0.55 },
      { x: 1, y: 0 },
      { x: 0.55, y: 0.55 },
      { x: 0, y: 0.75 },
      { x: -0.55, y: 0.55 },
      { x: -1, y: 0 },
      { x: -0.85, y: -0.55 },
    ],
  },
  sine: {
    lines: [{ from: { x: -0.25, y: -0.15 }, to: { x: 0.25, y: -0.15 } }],
    outline: [
      { x: 0, y: -1 },
      { x: 0.7, y: -0.55 },
      { x: 1.05, y: -0.05 },
      { x: 0.8, y: 0.35 },
      { x: 0.45, y: 0.9 },
      { x: 0, y: 0.65 },
      { x: -0.45, y: 0.9 },
      { x: -0.8, y: 0.35 },
      { x: -1.05, y: -0.05 },
      { x: -0.7, y: -0.55 },
    ],
  },
  skitter: {
    lines: [
      { from: { x: -0.3, y: -0.1 }, to: { x: 0.3, y: -0.1 } },
      { from: { x: -0.15, y: 0.2 }, to: { x: 0.15, y: 0.2 } },
    ],
    outline: [
      { x: 0, y: -1 },
      { x: 0.5, y: -0.65 },
      { x: 0.9, y: -0.2 },
      { x: 0.7, y: 0.3 },
      { x: 0.35, y: 0.85 },
      { x: 0, y: 0.65 },
      { x: -0.35, y: 0.85 },
      { x: -0.7, y: 0.3 },
      { x: -0.9, y: -0.2 },
      { x: -0.5, y: -0.65 },
    ],
  },
  snake: {
    outline: [
      { x: 0, y: -1 },
      { x: 0.6, y: -0.15 },
      { x: 0.3, y: 0.95 },
      { x: 0, y: 0.45 },
      { x: -0.3, y: 0.95 },
      { x: -0.6, y: -0.15 },
    ],
  },
  sniper: {
    lines: [{ from: { x: -0.15, y: -0.4 }, to: { x: 0.15, y: -0.4 } }],
    outline: [
      { x: 0, y: -1.15 },
      { x: 0.25, y: -0.7 },
      { x: 0.55, y: -0.4 },
      { x: 0.9, y: 0.15 },
      { x: 0.35, y: 0.95 },
      { x: 0, y: 0.55 },
      { x: -0.35, y: 0.95 },
      { x: -0.9, y: 0.15 },
      { x: -0.55, y: -0.4 },
      { x: -0.25, y: -0.7 },
    ],
  },
  spinner: {
    lines: [
      { from: { x: -0.4, y: -0.05 }, to: { x: 0.4, y: -0.05 } },
      { from: { x: -0.2, y: 0.35 }, to: { x: 0.2, y: 0.35 } },
    ],
    outline: [
      { x: 0, y: -1 },
      { x: 0.55, y: -0.55 },
      { x: 1, y: 0 },
      { x: 0.55, y: 0.55 },
      { x: 0, y: 1 },
      { x: -0.55, y: 0.55 },
      { x: -1, y: 0 },
      { x: -0.55, y: -0.55 },
    ],
  },
  swooper: {
    lines: [{ from: { x: -0.3, y: 0 }, to: { x: 0.3, y: 0 } }],
    outline: [
      { x: 0, y: -1 },
      { x: 0.55, y: -0.4 },
      { x: 0.95, y: -0.1 },
      { x: 1.05, y: 0.4 },
      { x: 0.55, y: 0.85 },
      { x: 0, y: 0.6 },
      { x: -0.55, y: 0.85 },
      { x: -1.05, y: 0.4 },
      { x: -0.95, y: -0.1 },
      { x: -0.55, y: -0.4 },
    ],
  },
};

const resolveEnemyVector = (shape: EnemyShape | EnemyVector): EnemyVector =>
  typeof shape === "string" ? ENEMY_VECTORS[shape] : shape;

const drawOutline = (
  outline: EnemyVector["outline"],
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
  lines: EnemyVector["lines"],
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

export const drawEnemyToGraphics = (
  graphics: Phaser.GameObjects.Graphics,
  shape: EnemyShape | EnemyVector,
  radius: number,
): void => {
  const vector = resolveEnemyVector(shape);
  graphics.beginPath();
  drawOutline(
    vector.outline,
    radius,
    (x, y) => graphics.moveTo(x, y),
    (x, y) => graphics.lineTo(x, y),
  );
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

export const drawEnemyToCanvas = (
  ctx: CanvasRenderingContext2D,
  shape: EnemyShape | EnemyVector,
  radius: number,
): void => {
  const vector = resolveEnemyVector(shape);
  ctx.beginPath();
  drawOutline(
    vector.outline,
    radius,
    (x, y) => ctx.moveTo(x, y),
    (x, y) => ctx.lineTo(x, y),
  );
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
