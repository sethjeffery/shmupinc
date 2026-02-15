import type { VectorShape } from "../../data/vectorShape";
import type { CompiledPathItem, CompiledVectorItem } from "./compile";

import { getCompiledVectorShape } from "./cache";

export interface CanvasVectorStyle {
  fillStyle: string;
  lineWidth: number;
  strokeStyle: string;
}

export interface VectorTransform {
  mirror?: boolean;
  rotationRad?: number;
  scale: number;
  x: number;
  y: number;
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
  ctx: CanvasRenderingContext2D,
  item: CompiledPathItem,
  transform: VectorTransform,
  style: CanvasVectorStyle | undefined,
): void => {
  if (!item.c.length || (!item.f && !item.s)) return;
  ctx.beginPath();
  for (const command of item.c) {
    switch (command.k) {
      case "M": {
        const point = transformPoint(transform, command.x, command.y);
        ctx.moveTo(point.x, point.y);
        break;
      }
      case "L": {
        const point = transformPoint(transform, command.x, command.y);
        ctx.lineTo(point.x, point.y);
        break;
      }
      case "Q": {
        const control = transformPoint(transform, command.cx, command.cy);
        const point = transformPoint(transform, command.x, command.y);
        ctx.quadraticCurveTo(control.x, control.y, point.x, point.y);
        break;
      }
      case "C": {
        const controlA = transformPoint(transform, command.c1x, command.c1y);
        const controlB = transformPoint(transform, command.c2x, command.c2y);
        const point = transformPoint(transform, command.x, command.y);
        ctx.bezierCurveTo(
          controlA.x,
          controlA.y,
          controlB.x,
          controlB.y,
          point.x,
          point.y,
        );
        break;
      }
      case "Z":
        ctx.closePath();
        break;
    }
  }
  const lineWidth = item.w ?? style?.lineWidth ?? ctx.lineWidth;
  if (item.f) {
    if (style) {
      ctx.fillStyle = style.fillStyle;
    }
    ctx.fill();
  }
  if (item.s) {
    ctx.lineWidth = lineWidth;
    if (style) {
      ctx.strokeStyle = style.strokeStyle;
    }
    ctx.stroke();
  }
};

const drawCircleItem = (
  ctx: CanvasRenderingContext2D,
  item: Extract<CompiledVectorItem, { t: "c" }>,
  transform: VectorTransform,
  style: CanvasVectorStyle | undefined,
): void => {
  const center = transformPoint(transform, item.x, item.y);
  const radius = Math.abs(item.r * transform.scale);
  if (radius <= 0) return;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  if (item.f) {
    if (style) {
      ctx.fillStyle = style.fillStyle;
    }
    ctx.fill();
  }
  if (item.s) {
    ctx.lineWidth = item.w ?? style?.lineWidth ?? ctx.lineWidth;
    if (style) {
      ctx.strokeStyle = style.strokeStyle;
    }
    ctx.stroke();
  }
};

const drawEllipseItem = (
  ctx: CanvasRenderingContext2D,
  item: Extract<CompiledVectorItem, { t: "e" }>,
  transform: VectorTransform,
  style: CanvasVectorStyle | undefined,
): void => {
  const center = transformPoint(transform, item.x, item.y);
  const rotation = transform.rotationRad ?? 0;
  const radiusX = Math.abs(item.rx * transform.scale);
  const radiusY = Math.abs(item.ry * transform.scale);
  if (radiusX <= 0 || radiusY <= 0) return;
  ctx.beginPath();
  ctx.ellipse(center.x, center.y, radiusX, radiusY, rotation, 0, Math.PI * 2);
  if (item.f) {
    if (style) {
      ctx.fillStyle = style.fillStyle;
    }
    ctx.fill();
  }
  if (item.s) {
    ctx.lineWidth = item.w ?? style?.lineWidth ?? ctx.lineWidth;
    if (style) {
      ctx.strokeStyle = style.strokeStyle;
    }
    ctx.stroke();
  }
};

export const drawVectorToCanvas = (
  ctx: CanvasRenderingContext2D,
  shape: VectorShape,
  transform: VectorTransform,
  style?: CanvasVectorStyle,
): void => {
  const compiled = getCompiledVectorShape(shape);
  for (const item of compiled.items) {
    if (item.t === "p") {
      drawPathItem(ctx, item, transform, style);
      continue;
    }
    if (item.t === "c") {
      drawCircleItem(ctx, item, transform, style);
      continue;
    }
    drawEllipseItem(ctx, item, transform, style);
  }
};
