import type { GunDefinition } from "../data/gunTypes";
import type Phaser from "phaser";

import { drawVectorToCanvas } from "./vector/drawCanvas";
import { drawVectorToGraphics } from "./vector/drawPhaser";

export const drawGunToGraphics = (
  graphics: Phaser.GameObjects.Graphics,
  gun: GunDefinition,
  x: number,
  y: number,
  size: number,
  accent: number,
  mirror = false,
  rotationRad = 0,
): void => {
  void accent;
  drawVectorToGraphics(
    graphics,
    gun.vector,
    { mirror, rotationRad, scale: size, x, y },
    { lineWidth: 1.5 },
  );
};

export const drawGunToCanvas = (
  ctx: CanvasRenderingContext2D,
  gun: GunDefinition,
  x: number,
  y: number,
  size: number,
  accent: number,
  mirror = false,
  rotationRad = 0,
): void => {
  void accent;
  ctx.save();
  drawVectorToCanvas(
    ctx,
    gun.vector,
    { mirror, rotationRad, scale: size, x, y },
    { lineWidth: 2 },
  );
  ctx.restore();
};
