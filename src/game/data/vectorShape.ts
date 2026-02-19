export type VectorPathCommand =
  | ["C", number, number, number, number, number, number]
  | ["L", number, number]
  | ["M", number, number]
  | ["Q", number, number, number, number]
  | ["Z"];

export type VectorColor = number | string;

export const parseVectorColor = (
  value: undefined | VectorColor,
): number | undefined => {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  const hashMatch = /^#([0-9a-f]{6})$/i.exec(text);
  if (hashMatch) {
    return Number.parseInt(hashMatch[1], 16);
  }
  const hexMatch = /^0x([0-9a-f]{1,6})$/i.exec(text);
  if (hexMatch) {
    return Number.parseInt(hexMatch[1], 16);
  }
  if (/^\d+$/.test(text)) {
    const parsed = Number.parseInt(text, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export interface VectorPathItem {
  c: VectorPathCommand[];
  // Fill color for this segment. Omit for no fill.
  f?: VectorColor;
  // Stroke color for this segment. Omit for no stroke.
  s?: VectorColor;
  t: "p";
  w?: number;
}

export interface VectorCircleItem {
  f?: VectorColor;
  r: number;
  s?: VectorColor;
  t: "c";
  w?: number;
  x: number;
  y: number;
}

export interface VectorEllipseItem {
  f?: VectorColor;
  s?: VectorColor;
  rx: number;
  ry: number;
  t: "e";
  w?: number;
  x: number;
  y: number;
}

export type VectorItem = VectorCircleItem | VectorEllipseItem | VectorPathItem;

export interface VectorShape {
  items: VectorItem[];
  v: 2;
}

interface VectorPoint {
  x: number;
  y: number;
}

interface VectorLine {
  from: VectorPoint;
  to: VectorPoint;
}

export const vectorFromOutlineLines = (
  outline: VectorPoint[],
  lines?: VectorLine[],
): VectorShape => {
  const defaultFill = 0x27314a;
  const defaultStroke = 0x9fb7ff;
  const items: VectorItem[] = [];
  if (outline.length > 0) {
    const commands: VectorPathCommand[] = [
      ["M", outline[0].x, outline[0].y],
      ...outline
        .slice(1)
        .map((point): VectorPathCommand => ["L", point.x, point.y]),
      ["Z"],
    ];
    items.push({
      c: commands,
      f: defaultFill,
      s: defaultStroke,
      t: "p",
    });
  }
  if (lines?.length) {
    for (const line of lines) {
      items.push({
        c: [
          ["M", line.from.x, line.from.y],
          ["L", line.to.x, line.to.y],
        ],
        s: defaultStroke,
        t: "p",
      });
    }
  }
  return { items, v: 2 };
};
