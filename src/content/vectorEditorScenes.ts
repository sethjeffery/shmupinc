import type { VectorShape } from "../game/data/vectorShape";
import type {
  CanvasEditorGuide,
  CanvasEditorPath,
  CanvasEditorPathCommand,
  CanvasEditorPoint,
  CanvasEditorScene,
} from "./canvasPointEditor";

import { parseVectorColor } from "../game/data/vectorShape";

export interface EditablePointPath {
  xPath: (number | string)[];
  yPath: (number | string)[];
}

interface SceneBuildResult {
  pointPathById: Map<string, EditablePointPath>;
  scene: CanvasEditorScene;
}

interface VectorPreviewStyle {
  fill: string;
  helperStroke?: string;
  stroke: string;
}

const extractAlpha = (value: string, fallback: number): number => {
  const rgbaMatch =
    /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*\)$/i.exec(
      value,
    );
  if (!rgbaMatch) return fallback;
  const alpha = Number.parseFloat(rgbaMatch[1]);
  return Number.isFinite(alpha) ? alpha : fallback;
};

const toRgba = (color: number, alpha: number): string => {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const resolveStyledColor = (
  override: number | undefined,
  fallback: string,
): string => {
  if (override === undefined) return fallback;
  return toRgba(override, extractAlpha(fallback, 1));
};

export const buildVectorScene = (
  vector: VectorShape,
  pathPrefix: (number | string)[],
  style: VectorPreviewStyle,
  guides?: CanvasEditorGuide[],
  options?: {
    allowStyleFallback?: boolean;
  },
): SceneBuildResult => {
  const allowStyleFallback = options?.allowStyleFallback === true;
  const pointPathById = new Map<string, EditablePointPath>();
  const points: CanvasEditorPoint[] = [];
  const paths: CanvasEditorPath[] = [];
  let pointCounter = 0;

  const addPoint = (
    id: string,
    x: number,
    y: number,
    pointPath?: EditablePointPath,
  ): void => {
    points.push({ id, x, y });
    if (pointPath) {
      pointPathById.set(id, pointPath);
    }
  };

  const makePointId = (itemIndex: number, commandIndex: number): string => {
    const id = `p-${itemIndex}-${commandIndex}-${pointCounter}`;
    pointCounter += 1;
    return id;
  };

  for (let itemIndex = 0; itemIndex < vector.items.length; itemIndex += 1) {
    const item = vector.items[itemIndex];
    if (item.t === "c" || item.t === "e") {
      const steps = 24;
      const circlePointIds: string[] = [];
      for (let step = 0; step < steps; step += 1) {
        const angle = (step / steps) * Math.PI * 2;
        const x =
          item.t === "c"
            ? item.x + Math.cos(angle) * item.r
            : item.x + Math.cos(angle) * item.rx;
        const y =
          item.t === "c"
            ? item.y + Math.sin(angle) * item.r
            : item.y + Math.sin(angle) * item.ry;
        const pointId = makePointId(itemIndex, step);
        addPoint(pointId, x, y);
        circlePointIds.push(pointId);
      }
      const fillColor = parseVectorColor(item.f);
      const strokeColor = parseVectorColor(item.s);
      paths.push({
        closed: true,
        fill:
          fillColor !== undefined
            ? resolveStyledColor(fillColor, style.fill)
            : allowStyleFallback
              ? style.fill
              : undefined,
        pointIds: circlePointIds,
        stroke:
          strokeColor !== undefined
            ? resolveStyledColor(strokeColor, style.stroke)
            : allowStyleFallback
              ? style.stroke
              : null,
        width: item.w ?? 2,
      });
      continue;
    }
    if (item.t !== "p") continue;
    const fillColor = parseVectorColor(item.f);
    const strokeColor = parseVectorColor(item.s);
    let currentPointId: null | string = null;
    const pathCommands: CanvasEditorPathCommand[] = [];
    const helperPaths: CanvasEditorPath[] = [];
    const itemBasePath = [...pathPrefix, "items", itemIndex];
    for (
      let commandIndex = 0;
      commandIndex < item.c.length;
      commandIndex += 1
    ) {
      const command = item.c[commandIndex];
      if (command[0] === "M") {
        const id = makePointId(itemIndex, commandIndex);
        addPoint(id, command[1], command[2], {
          xPath: [...itemBasePath, "c", commandIndex, 1],
          yPath: [...itemBasePath, "c", commandIndex, 2],
        });
        currentPointId = id;
        pathCommands.push(["M", id]);
        continue;
      }
      if (command[0] === "L") {
        const id = makePointId(itemIndex, commandIndex);
        addPoint(id, command[1], command[2], {
          xPath: [...itemBasePath, "c", commandIndex, 1],
          yPath: [...itemBasePath, "c", commandIndex, 2],
        });
        if (!currentPointId) {
          pathCommands.push(["M", id]);
          currentPointId = id;
          continue;
        }
        pathCommands.push(["L", id]);
        currentPointId = id;
        continue;
      }
      if (command[0] === "Q") {
        const controlId = makePointId(itemIndex, commandIndex);
        addPoint(controlId, command[1], command[2], {
          xPath: [...itemBasePath, "c", commandIndex, 1],
          yPath: [...itemBasePath, "c", commandIndex, 2],
        });
        const endId = makePointId(itemIndex, commandIndex);
        addPoint(endId, command[3], command[4], {
          xPath: [...itemBasePath, "c", commandIndex, 3],
          yPath: [...itemBasePath, "c", commandIndex, 4],
        });
        if (!currentPointId) {
          pathCommands.push(["M", endId]);
          currentPointId = endId;
          continue;
        }
        helperPaths.push({
          pointIds: [currentPointId, controlId],
          stroke: style.helperStroke ?? "rgba(125, 214, 255, 0.45)",
          width: 1.25,
        });
        helperPaths.push({
          pointIds: [controlId, endId],
          stroke: style.helperStroke ?? "rgba(125, 214, 255, 0.45)",
          width: 1.25,
        });
        pathCommands.push(["Q", controlId, endId]);
        currentPointId = endId;
        continue;
      }
      if (command[0] === "C") {
        const controlAId = makePointId(itemIndex, commandIndex);
        addPoint(controlAId, command[1], command[2], {
          xPath: [...itemBasePath, "c", commandIndex, 1],
          yPath: [...itemBasePath, "c", commandIndex, 2],
        });
        const controlBId = makePointId(itemIndex, commandIndex);
        addPoint(controlBId, command[3], command[4], {
          xPath: [...itemBasePath, "c", commandIndex, 3],
          yPath: [...itemBasePath, "c", commandIndex, 4],
        });
        const endId = makePointId(itemIndex, commandIndex);
        addPoint(endId, command[5], command[6], {
          xPath: [...itemBasePath, "c", commandIndex, 5],
          yPath: [...itemBasePath, "c", commandIndex, 6],
        });
        if (!currentPointId) {
          pathCommands.push(["M", endId]);
          currentPointId = endId;
          continue;
        }
        const helperStroke = style.helperStroke ?? "rgba(125, 214, 255, 0.45)";
        helperPaths.push({
          pointIds: [currentPointId, controlAId],
          stroke: helperStroke,
          width: 1.25,
        });
        helperPaths.push({
          pointIds: [controlAId, controlBId],
          stroke: helperStroke,
          width: 1.25,
        });
        helperPaths.push({
          pointIds: [controlBId, endId],
          stroke: helperStroke,
          width: 1.25,
        });
        pathCommands.push(["C", controlAId, controlBId, endId]);
        currentPointId = endId;
        continue;
      }
      if (command[0] === "Z") {
        pathCommands.push(["Z"]);
      }
    }
    if (pathCommands.length) {
      paths.push({
        commands: pathCommands,
        fill:
          fillColor !== undefined
            ? resolveStyledColor(fillColor, style.fill)
            : allowStyleFallback
              ? style.fill
              : undefined,
        stroke:
          strokeColor !== undefined
            ? resolveStyledColor(strokeColor, style.stroke)
            : allowStyleFallback
              ? style.stroke
              : null,
        width: item.w ?? 2,
      });
      paths.push(...helperPaths);
    }
  }

  return {
    pointPathById,
    scene: {
      axisX: 0,
      axisY: 0,
      guides,
      paths,
      points,
    },
  };
};

export const buildBezierScene = (
  points: { x: number; y: number }[],
  pointsPath: (number | string)[],
): SceneBuildResult => {
  const pointPathById = new Map<string, EditablePointPath>();
  const scenePoints: CanvasEditorPoint[] = points.map((point, index) => {
    const id = `p-${index}`;
    pointPathById.set(id, {
      xPath: [...pointsPath, index, "x"],
      yPath: [...pointsPath, index, "y"],
    });
    return { id, x: point.x, y: point.y };
  });
  const pointIds = scenePoints.map((point) => point.id);
  return {
    pointPathById,
    scene: {
      axisX: 0,
      axisY: 0,
      beziers: [
        {
          pointIds,
          samples: 96,
          stroke: "rgba(255, 255, 255, 0.75)",
          width: 1.5,
        },
      ],
      paths: [
        {
          pointIds,
          stroke: "rgba(125, 214, 255, 0.3)",
          width: 1.25,
        },
      ],
      points: scenePoints,
    },
  };
};
