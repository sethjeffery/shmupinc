export type VectorPathCommand =
  | ["C", number, number, number, number, number, number]
  | ["L", number, number]
  | ["M", number, number]
  | ["Q", number, number, number, number]
  | ["Z"];

export interface VectorPathItem {
  c: VectorPathCommand[];
  f?: boolean;
  s?: boolean;
  t: "p";
  w?: number;
}

export interface VectorCircleItem {
  f?: boolean;
  r: number;
  s?: boolean;
  t: "c";
  w?: number;
  x: number;
  y: number;
}

export interface VectorEllipseItem {
  f?: boolean;
  rx: number;
  ry: number;
  s?: boolean;
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

export interface VectorPoint {
  x: number;
  y: number;
}

export interface VectorLine {
  from: VectorPoint;
  to: VectorPoint;
}

export const vectorFromOutlineLines = (
  outline: VectorPoint[],
  lines?: VectorLine[],
): VectorShape => {
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
      f: true,
      s: true,
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
        s: true,
        t: "p",
      });
    }
  }
  return { items, v: 2 };
};
