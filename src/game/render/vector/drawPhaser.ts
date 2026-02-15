import type { VectorShape } from "../../data/vectorShape";
import type { CompiledPathItem, CompiledVectorItem } from "./compile";
import type { VectorTransform } from "./drawCanvas";
import type Phaser from "phaser";

import { getCompiledVectorShape } from "./cache";

export interface PhaserVectorStyle {
  fillAlpha?: number;
  fillColor: number;
  lineAlpha?: number;
  lineColor: number;
  lineWidth: number;
}

const transformPoint = (
  transform: VectorTransform,
  x: number,
  y: number,
): { x: number; y: number } => {
  const mirror = transform.mirror ? -1 : 1;
  const localX = x * transform.scale * mirror;
  const localY = y * transform.scale;
  const rotation = transform.rotationRad ?? 0;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: transform.x + localX * cos - localY * sin,
    y: transform.y + localX * sin + localY * cos,
  };
};

const drawPathItem = (
  graphics: Phaser.GameObjects.Graphics,
  item: CompiledPathItem,
  transform: VectorTransform,
  style: PhaserVectorStyle | undefined,
): void => {
  if (!item.c.length || (!item.f && !item.s)) return;
  let currentX = 0;
  let currentY = 0;
  let hasCurrentPoint = false;
  graphics.beginPath();
  for (const command of item.c) {
    switch (command.k) {
      case "M": {
        const point = transformPoint(transform, command.x, command.y);
        graphics.moveTo(point.x, point.y);
        currentX = point.x;
        currentY = point.y;
        hasCurrentPoint = true;
        break;
      }
      case "L": {
        const point = transformPoint(transform, command.x, command.y);
        graphics.lineTo(point.x, point.y);
        currentX = point.x;
        currentY = point.y;
        hasCurrentPoint = true;
        break;
      }
      case "Q": {
        if (!hasCurrentPoint) break;
        const control = transformPoint(transform, command.cx, command.cy);
        const point = transformPoint(transform, command.x, command.y);
        const sampleCount = 18;
        for (let step = 1; step <= sampleCount; step += 1) {
          const t = step / sampleCount;
          const inv = 1 - t;
          const x =
            inv * inv * currentX + 2 * inv * t * control.x + t * t * point.x;
          const y =
            inv * inv * currentY + 2 * inv * t * control.y + t * t * point.y;
          graphics.lineTo(x, y);
        }
        currentX = point.x;
        currentY = point.y;
        break;
      }
      case "C": {
        if (!hasCurrentPoint) break;
        const controlA = transformPoint(transform, command.c1x, command.c1y);
        const controlB = transformPoint(transform, command.c2x, command.c2y);
        const point = transformPoint(transform, command.x, command.y);
        const sampleCount = 24;
        for (let step = 1; step <= sampleCount; step += 1) {
          const t = step / sampleCount;
          const inv = 1 - t;
          const x =
            inv * inv * inv * currentX +
            3 * inv * inv * t * controlA.x +
            3 * inv * t * t * controlB.x +
            t * t * t * point.x;
          const y =
            inv * inv * inv * currentY +
            3 * inv * inv * t * controlA.y +
            3 * inv * t * t * controlB.y +
            t * t * t * point.y;
          graphics.lineTo(x, y);
        }
        currentX = point.x;
        currentY = point.y;
        break;
      }
      case "Z":
        graphics.closePath();
        break;
    }
  }
  if (item.f) {
    if (style) {
      graphics.fillStyle(style.fillColor, style.fillAlpha ?? 1);
    }
    graphics.fillPath();
  }
  if (item.s) {
    if (style) {
      graphics.lineStyle(
        item.w ?? style.lineWidth,
        style.lineColor,
        style.lineAlpha ?? 1,
      );
    }
    graphics.strokePath();
  }
};

const drawCircleItem = (
  graphics: Phaser.GameObjects.Graphics,
  item: Extract<CompiledVectorItem, { t: "c" }>,
  transform: VectorTransform,
  style: PhaserVectorStyle | undefined,
): void => {
  const center = transformPoint(transform, item.x, item.y);
  const radius = Math.abs(item.r * transform.scale);
  if (radius <= 0) return;
  if (item.f) {
    if (style) {
      graphics.fillStyle(style.fillColor, style.fillAlpha ?? 1);
    }
    graphics.fillCircle(center.x, center.y, radius);
  }
  if (item.s) {
    if (style) {
      graphics.lineStyle(
        item.w ?? style.lineWidth,
        style.lineColor,
        style.lineAlpha ?? 1,
      );
    }
    graphics.strokeCircle(center.x, center.y, radius);
  }
};

const drawEllipseItem = (
  graphics: Phaser.GameObjects.Graphics,
  item: Extract<CompiledVectorItem, { t: "e" }>,
  transform: VectorTransform,
  style: PhaserVectorStyle | undefined,
): void => {
  const center = transformPoint(transform, item.x, item.y);
  const width = Math.abs(item.rx * transform.scale) * 2;
  const height = Math.abs(item.ry * transform.scale) * 2;
  if (width <= 0 || height <= 0) return;
  if (item.f) {
    if (style) {
      graphics.fillStyle(style.fillColor, style.fillAlpha ?? 1);
    }
    graphics.fillEllipse(center.x, center.y, width, height);
  }
  if (item.s) {
    if (style) {
      graphics.lineStyle(
        item.w ?? style.lineWidth,
        style.lineColor,
        style.lineAlpha ?? 1,
      );
    }
    graphics.strokeEllipse(center.x, center.y, width, height);
  }
};

export const drawVectorToGraphics = (
  graphics: Phaser.GameObjects.Graphics,
  shape: VectorShape,
  transform: VectorTransform,
  style?: PhaserVectorStyle,
): void => {
  const compiled = getCompiledVectorShape(shape);
  for (const item of compiled.items) {
    if (item.t === "p") {
      drawPathItem(graphics, item, transform, style);
      continue;
    }
    if (item.t === "c") {
      drawCircleItem(graphics, item, transform, style);
      continue;
    }
    drawEllipseItem(graphics, item, transform, style);
  }
};
