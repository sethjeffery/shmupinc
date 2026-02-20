import type { VectorShape } from "../../data/vectorShape";

import { drawModToCanvas } from "../../render/modShapes";
import { drawShipToCanvas } from "../../render/shipShapes";
import { getVectorBounds } from "../../render/vector/cache";

export type CardIconKind = "mod" | "ship" | "weapon";

interface DrawIconOptions {
  canvas: HTMLCanvasElement;
  colorHex: string;
  colorValue: number;
  kind: CardIconKind;
  rotationRad?: number;
  shape: VectorShape;
}

const getIconBounds = (
  icon: VectorShape,
): {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
} => getVectorBounds(icon);

export const drawShopIcon = (options: DrawIconOptions): void => {
  const ctx = options.canvas.getContext("2d");
  if (!ctx) return;
  const { height, width } = options.canvas;
  ctx.clearRect(0, 0, width, height);

  if (options.kind === "ship") {
    const fill = toRgba(options.colorHex, 0.9, 0.25);
    drawShip(
      ctx,
      width / 2,
      height / 2,
      width * 0.28,
      options.colorHex,
      fill,
      options.shape,
    );
    return;
  }

  drawCenteredIcon(
    ctx,
    options.shape,
    width,
    height,
    options.colorValue,
    options.rotationRad,
  );
};

const drawCenteredIcon = (
  ctx: CanvasRenderingContext2D,
  icon: VectorShape,
  canvasWidth: number,
  canvasHeight: number,
  colorValue: number,
  rotationRad = 0,
): void => {
  const bounds = getIconBounds(icon);
  const localWidth = Math.max(0.001, bounds.maxX - bounds.minX);
  const localHeight = Math.max(0.001, bounds.maxY - bounds.minY);
  const localMaxSpan = Math.max(localWidth, localHeight);
  const targetSpan = canvasWidth * 0.5;
  const scale = targetSpan / localMaxSpan;
  const localCenterX = (bounds.minX + bounds.maxX) * 0.5;
  const localCenterY = (bounds.minY + bounds.maxY) * 0.5;

  drawModToCanvas(
    ctx,
    icon,
    canvasWidth * 0.5 - localCenterX * scale,
    canvasHeight * 0.5 - localCenterY * scale,
    scale,
    colorValue,
    rotationRad,
  );
};

const drawShip = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  stroke: string,
  fill: string,
  vector: VectorShape,
): void => {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  drawShipToCanvas(ctx, vector, r, {
    bevel: {
      depthPx: Math.max(2, Math.min(5, Math.round(r * 0.26))),
      layerAlpha: 0.97,
    },
    lineWidth: 2,
  });
  ctx.restore();
};

const toRgba = (hex: string, alpha: number, factor: number): string => {
  const { b, g, r } = hexToRgb(hex);
  return `rgba(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)}, ${alpha})`;
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const raw = hex.replace("#", "").padStart(6, "0");
  const value = parseInt(raw, 16);
  return {
    b: value & 255,
    g: (value >> 8) & 255,
    r: (value >> 16) & 255,
  };
};
