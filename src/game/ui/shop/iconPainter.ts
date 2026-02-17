import type { ModIconVector } from "../../data/modTypes";
import type { ShipVector } from "../../data/shipTypes";
import type { WeaponSize } from "../../data/weaponTypes";

import { GUNS, type GunDefinition } from "../../data/guns";
import { drawGunToCanvas } from "../../render/gunShapes";
import { drawModToCanvas, getModIconBounds } from "../../render/modShapes";
import { drawShipToCanvas } from "../../render/shipShapes";
import { getVectorBounds } from "../../render/vector/cache";

export type CardIconKind = "gun" | "mod" | "ship";

export interface DrawIconOptions {
  canvas: HTMLCanvasElement;
  colorHex: string;
  colorValue: number;
  kind: CardIconKind;
  modVector?: ModIconVector;
  shipShape: ShipVector;
  weaponSize?: WeaponSize;
  gunId?: string;
}

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
      options.shipShape,
    );
    return;
  }

  if (options.kind === "mod") {
    if (options.modVector) {
      drawCenteredModIcon(
        ctx,
        options.modVector,
        width,
        height,
        options.colorValue,
      );
    } else {
      drawVacantMountIcon(ctx, width / 2, height / 2, width * 0.3, options.colorHex);
    }
    return;
  }

  const gun = options.gunId ? GUNS[options.gunId] : null;
  if (gun) {
    drawCenteredGunIcon(
      ctx,
      gun,
      width,
      height,
      options.colorValue,
      options.weaponSize,
    );
    return;
  }

  drawVacantMountIcon(ctx, width / 2, height / 2, width * 0.3, options.colorHex);
};

const drawCenteredGunIcon = (
  ctx: CanvasRenderingContext2D,
  gun: GunDefinition,
  canvasWidth: number,
  canvasHeight: number,
  colorValue: number,
  weaponSize?: WeaponSize,
): void => {
  const bounds = getGunLocalBounds(gun);
  const localWidth = Math.max(0.001, bounds.maxX - bounds.minX);
  const localHeight = Math.max(0.001, bounds.maxY - bounds.minY);
  const localMaxSpan = Math.max(localWidth, localHeight);
  const targetSpan = canvasWidth * (weaponSize === "large" ? 0.476 : 0.364);
  const scale = targetSpan / localMaxSpan;
  const localCenterX = (bounds.minX + bounds.maxX) * 0.5;
  const localCenterY = (bounds.minY + bounds.maxY) * 0.5;

  drawGunToCanvas(
    ctx,
    gun,
    canvasWidth * 0.5 - localCenterX * scale,
    canvasHeight * 0.5 - localCenterY * scale,
    scale,
    colorValue,
  );
};

const drawCenteredModIcon = (
  ctx: CanvasRenderingContext2D,
  icon: ModIconVector,
  canvasWidth: number,
  canvasHeight: number,
  colorValue: number,
): void => {
  const bounds = getModIconBounds(icon);
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
  );
};

const getGunLocalBounds = (gun: GunDefinition): {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
} => {
  return getVectorBounds(gun.vector);
};

const drawVacantMountIcon = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
): void => {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = toRgba(color, 0.9, 1.05);
  ctx.lineWidth = Math.max(2, size * 0.12);
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

const drawShip = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  stroke: string,
  fill: string,
  vector: ShipVector,
): void => {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  drawShipToCanvas(ctx, vector, r);
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
