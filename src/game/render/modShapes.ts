import type { ModIconVector } from "../data/modTypes";

import { drawVectorToCanvas } from "./vector/drawCanvas";

const scaleColor = (color: number, factor: number): number => {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
};

export const drawModToCanvas = (
  ctx: CanvasRenderingContext2D,
  icon: ModIconVector,
  x: number,
  y: number,
  size: number,
  accent: number,
): void => {
  const stroke = accent;
  const fill = scaleColor(accent, 0.32);
  ctx.save();
  drawVectorToCanvas(
    ctx,
    icon,
    { scale: size, x, y },
    {
      fillStyle: `#${fill.toString(16).padStart(6, "0")}`,
      lineWidth: 2,
      strokeStyle: `#${stroke.toString(16).padStart(6, "0")}`,
    },
  );
  ctx.restore();
};
