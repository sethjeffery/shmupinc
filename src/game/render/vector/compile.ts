import type {
  VectorCircleItem,
  VectorEllipseItem,
  VectorPathCommand,
  VectorPathItem,
  VectorShape,
} from "../../data/vectorShape";

import { parseVectorColor } from "../../data/vectorShape";

export interface VectorBounds {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

export interface CompiledPathCommandCubic {
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
  k: "C";
  x: number;
  y: number;
}

export interface CompiledPathCommandLine {
  k: "L";
  x: number;
  y: number;
}

export interface CompiledPathCommandMove {
  k: "M";
  x: number;
  y: number;
}

export interface CompiledPathCommandQuadratic {
  cx: number;
  cy: number;
  k: "Q";
  x: number;
  y: number;
}

export interface CompiledPathCommandClose {
  k: "Z";
}

export type CompiledPathCommand =
  | CompiledPathCommandClose
  | CompiledPathCommandCubic
  | CompiledPathCommandLine
  | CompiledPathCommandMove
  | CompiledPathCommandQuadratic;

export interface CompiledPathItem {
  c: CompiledPathCommand[];
  fillColor?: number;
  lineColor?: number;
  t: "p";
  w?: number;
}

export interface CompiledCircleItem {
  fillColor?: number;
  r: number;
  lineColor?: number;
  t: "c";
  w?: number;
  x: number;
  y: number;
}

export interface CompiledEllipseItem {
  fillColor?: number;
  lineColor?: number;
  rx: number;
  ry: number;
  t: "e";
  w?: number;
  x: number;
  y: number;
}

export type CompiledVectorItem =
  | CompiledCircleItem
  | CompiledEllipseItem
  | CompiledPathItem;

export interface CompiledVectorShape {
  bounds: VectorBounds;
  items: CompiledVectorItem[];
}

const DEFAULT_BOUNDS: VectorBounds = {
  maxX: 1,
  maxY: 1,
  minX: -1,
  minY: -1,
};

const commandToCompiled = (command: VectorPathCommand): CompiledPathCommand => {
  switch (command[0]) {
    case "M":
      return { k: "M", x: command[1], y: command[2] };
    case "L":
      return { k: "L", x: command[1], y: command[2] };
    case "Q":
      return {
        cx: command[1],
        cy: command[2],
        k: "Q",
        x: command[3],
        y: command[4],
      };
    case "C":
      return {
        c1x: command[1],
        c1y: command[2],
        c2x: command[3],
        c2y: command[4],
        k: "C",
        x: command[5],
        y: command[6],
      };
    case "Z":
    default:
      return { k: "Z" };
  }
};

const includeBounds = (
  bounds: VectorBounds,
  x: number,
  y: number,
): VectorBounds => ({
  maxX: Math.max(bounds.maxX, x),
  maxY: Math.max(bounds.maxY, y),
  minX: Math.min(bounds.minX, x),
  minY: Math.min(bounds.minY, y),
});

const compilePathItem = (
  item: VectorPathItem,
  bounds: VectorBounds,
): { bounds: VectorBounds; item: CompiledPathItem } => {
  const commands = item.c.map(commandToCompiled);
  const fillColor = parseVectorColor(item.f);
  const lineColor = parseVectorColor(item.s);
  let nextBounds = bounds;
  for (const command of commands) {
    switch (command.k) {
      case "M":
      case "L":
        nextBounds = includeBounds(nextBounds, command.x, command.y);
        break;
      case "Q":
        nextBounds = includeBounds(nextBounds, command.cx, command.cy);
        nextBounds = includeBounds(nextBounds, command.x, command.y);
        break;
      case "C":
        nextBounds = includeBounds(nextBounds, command.c1x, command.c1y);
        nextBounds = includeBounds(nextBounds, command.c2x, command.c2y);
        nextBounds = includeBounds(nextBounds, command.x, command.y);
        break;
      case "Z":
        break;
    }
  }
  return {
    bounds: nextBounds,
    item: {
      c: commands,
      fillColor,
      lineColor,
      t: "p",
      w: item.w,
    },
  };
};

const compileCircleItem = (
  item: VectorCircleItem,
  bounds: VectorBounds,
): { bounds: VectorBounds; item: CompiledCircleItem } => {
  const fillColor = parseVectorColor(item.f);
  const lineColor = parseVectorColor(item.s);
  const nextBounds = includeBounds(
    includeBounds(bounds, item.x - item.r, item.y - item.r),
    item.x + item.r,
    item.y + item.r,
  );
  return {
    bounds: nextBounds,
    item: {
      fillColor,
      lineColor,
      r: item.r,
      t: "c",
      w: item.w,
      x: item.x,
      y: item.y,
    },
  };
};

const compileEllipseItem = (
  item: VectorEllipseItem,
  bounds: VectorBounds,
): { bounds: VectorBounds; item: CompiledEllipseItem } => {
  const fillColor = parseVectorColor(item.f);
  const lineColor = parseVectorColor(item.s);
  const nextBounds = includeBounds(
    includeBounds(bounds, item.x - item.rx, item.y - item.ry),
    item.x + item.rx,
    item.y + item.ry,
  );
  return {
    bounds: nextBounds,
    item: {
      fillColor,
      lineColor,
      rx: item.rx,
      ry: item.ry,
      t: "e",
      w: item.w,
      x: item.x,
      y: item.y,
    },
  };
};

export const compileVectorShape = (shape: VectorShape): CompiledVectorShape => {
  const items: CompiledVectorItem[] = [];
  let bounds: VectorBounds = {
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
  };

  for (const item of shape.items) {
    if (item.t === "p") {
      const compiled = compilePathItem(item, bounds);
      bounds = compiled.bounds;
      items.push(compiled.item);
      continue;
    }
    if (item.t === "c") {
      const compiled = compileCircleItem(item, bounds);
      bounds = compiled.bounds;
      items.push(compiled.item);
      continue;
    }
    const compiled = compileEllipseItem(item, bounds);
    bounds = compiled.bounds;
    items.push(compiled.item);
  }

  if (
    !Number.isFinite(bounds.minX) ||
    !Number.isFinite(bounds.maxX) ||
    !Number.isFinite(bounds.minY) ||
    !Number.isFinite(bounds.maxY)
  ) {
    bounds = DEFAULT_BOUNDS;
  } else {
    if (bounds.minX === bounds.maxX) {
      bounds.minX -= 1;
      bounds.maxX += 1;
    }
    if (bounds.minY === bounds.maxY) {
      bounds.minY -= 1;
      bounds.maxY += 1;
    }
  }

  return { bounds, items };
};
