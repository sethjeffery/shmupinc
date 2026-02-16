import type { EnemyVector } from "../data/enemyTypes";
import type Phaser from "phaser";

import { drawVectorToCanvas } from "./vector/drawCanvas";
import { drawVectorToGraphics } from "./vector/drawPhaser";

export const DEFAULT_ENEMY_VECTOR: EnemyVector = {
  items: [
    {
      c: [["M", 0, -1], ["L", 0.82, 0], ["L", 0, 1], ["L", -0.82, 0], ["Z"]],
      f: "#1c0f1a",
      s: "#ff6b6b",
      t: "p",
    },
  ],
  v: 2,
};

export const drawEnemyToGraphics = (
  graphics: Phaser.GameObjects.Graphics,
  vector: EnemyVector,
  radius: number,
): void => {
  drawVectorToGraphics(graphics, vector, {
    scale: radius,
    x: 0,
    y: 0,
  });
};

export const drawEnemyToCanvas = (
  ctx: CanvasRenderingContext2D,
  vector: EnemyVector,
  radius: number,
): void => {
  drawVectorToCanvas(ctx, vector, {
    scale: radius,
    x: 0,
    y: 0,
  });
};
