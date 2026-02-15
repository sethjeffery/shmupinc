import type { GunDefinition } from "../data/gunTypes";
import type Phaser from "phaser";

import { drawVectorToCanvas } from "./vector/drawCanvas";
import { drawVectorToGraphics } from "./vector/drawPhaser";

const scaleColor = (color: number, factor: number): number => {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
};

const resolveLineColor = (gun: GunDefinition, accent: number): number =>
  gun.lineColor ?? accent;

const resolveFillColor = (gun: GunDefinition, accent: number): number =>
  gun.fillColor ?? scaleColor(accent, 0.28);

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
  const lineColor = resolveLineColor(gun, accent);
  const fillColor = resolveFillColor(gun, accent);
  drawVectorToGraphics(
    graphics,
    gun.vector,
    { mirror, rotationRad, scale: size, x, y },
    {
      fillColor,
      lineColor,
      lineWidth: 1.5,
    },
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
  const lineColor = resolveLineColor(gun, accent);
  const fillColor = resolveFillColor(gun, accent);
  ctx.save();
  drawVectorToCanvas(
    ctx,
    gun.vector,
    { mirror, rotationRad, scale: size, x, y },
    {
      fillStyle: `#${fillColor.toString(16).padStart(6, "0")}`,
      lineWidth: 2,
      strokeStyle: `#${lineColor.toString(16).padStart(6, "0")}`,
    },
  );
  ctx.restore();
};
