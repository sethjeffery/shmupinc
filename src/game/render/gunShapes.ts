import type { GunDefinition } from "../data/gunTypes";
import type Phaser from "phaser";

const scaleColor = (color: number, factor: number): number => {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
};

const drawOutline = (
  outline: { x: number; y: number }[],
  centerX: number,
  centerY: number,
  scale: number,
  mirror: boolean,
  rotationRad: number,
  moveTo: (x: number, y: number) => void,
  lineTo: (x: number, y: number) => void,
): void => {
  if (!outline.length) return;
  const mirrorFactor = mirror ? -1 : 1;
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);
  const toPoint = (point: {
    x: number;
    y: number;
  }): { x: number; y: number } => {
    const localX = point.x * scale * mirrorFactor;
    const localY = point.y * scale;
    return {
      x: centerX + localX * cos - localY * sin,
      y: centerY + localX * sin + localY * cos,
    };
  };
  const first = outline[0];
  const firstPoint = toPoint(first);
  moveTo(firstPoint.x, firstPoint.y);
  for (let i = 1; i < outline.length; i += 1) {
    const point = toPoint(outline[i]);
    lineTo(point.x, point.y);
  }
};

const drawLines = (
  lines: { from: { x: number; y: number }; to: { x: number; y: number } }[],
  centerX: number,
  centerY: number,
  scale: number,
  mirror: boolean,
  rotationRad: number,
  moveTo: (x: number, y: number) => void,
  lineTo: (x: number, y: number) => void,
): void => {
  if (!lines) return;
  const mirrorFactor = mirror ? -1 : 1;
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);
  const toPoint = (point: {
    x: number;
    y: number;
  }): { x: number; y: number } => {
    const localX = point.x * scale * mirrorFactor;
    const localY = point.y * scale;
    return {
      x: centerX + localX * cos - localY * sin,
      y: centerY + localX * sin + localY * cos,
    };
  };
  for (const line of lines) {
    const from = toPoint(line.from);
    const to = toPoint(line.to);
    moveTo(from.x, from.y);
    lineTo(to.x, to.y);
  }
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
  graphics.lineStyle(1.5, lineColor, 1);
  graphics.fillStyle(fillColor, 1);
  graphics.beginPath();
  drawOutline(
    gun.outline,
    x,
    y,
    size,
    mirror,
    rotationRad,
    (mx, my) => graphics.moveTo(mx, my),
    (lx, ly) => graphics.lineTo(lx, ly),
  );
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();
  if (gun.lines && gun.lines.length > 0) {
    graphics.lineStyle(1.5, lineColor, 0.9);
    for (const line of gun.lines) {
      graphics.beginPath();
      drawLines(
        [line],
        x,
        y,
        size,
        mirror,
        rotationRad,
        (mx, my) => graphics.moveTo(mx, my),
        (lx, ly) => graphics.lineTo(lx, ly),
      );
      graphics.strokePath();
    }
  }
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
  ctx.strokeStyle = `#${lineColor.toString(16).padStart(6, "0")}`;
  ctx.fillStyle = `#${fillColor.toString(16).padStart(6, "0")}`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  drawOutline(
    gun.outline,
    x,
    y,
    size,
    mirror,
    rotationRad,
    (mx, my) => ctx.moveTo(mx, my),
    (lx, ly) => ctx.lineTo(lx, ly),
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (gun.lines && gun.lines.length > 0) {
    ctx.lineWidth = 1.5;
    for (const line of gun.lines) {
      ctx.beginPath();
      drawLines(
        [line],
        x,
        y,
        size,
        mirror,
        rotationRad,
        (mx, my) => ctx.moveTo(mx, my),
        (lx, ly) => ctx.lineTo(lx, ly),
      );
      ctx.stroke();
    }
  }
  ctx.restore();
};
