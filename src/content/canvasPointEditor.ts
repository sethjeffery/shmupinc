import { pointer, select } from "d3-selection";
import {
  zoom,
  zoomIdentity,
  type D3ZoomEvent,
  type ZoomTransform,
} from "d3-zoom";

export interface CanvasEditorPoint {
  id: string;
  x: number;
  y: number;
}

export interface CanvasEditorBezier {
  pointIds: string[];
  samples?: number;
  stroke?: string;
  width?: number;
}

export type CanvasEditorPathCommand =
  | ["C", string, string, string]
  | ["L", string]
  | ["M", string]
  | ["Q", string, string]
  | ["Z"];

export interface CanvasEditorPath {
  commands?: CanvasEditorPathCommand[];
  closed?: boolean;
  fill?: string;
  pointIds?: string[];
  stroke?: null | string;
  width?: number;
}

export type CanvasEditorGuide =
  | {
      kind: "circle";
      r: number;
      stroke?: string;
      width?: number;
      x: number;
      y: number;
    }
  | {
      kind: "ellipse";
      rx: number;
      ry: number;
      stroke?: string;
      width?: number;
      x: number;
      y: number;
    };

export interface CanvasEditorScene {
  axisX?: number;
  axisY?: number;
  beziers?: CanvasEditorBezier[];
  guides?: CanvasEditorGuide[];
  paths?: CanvasEditorPath[];
  points: CanvasEditorPoint[];
}

interface CanvasPointEditorOptions {
  background?: string;
  maxZoom?: number;
  minZoom?: number;
  pointRadius?: number;
  snapStep?: number;
}

export interface CanvasPointUpdate {
  id: string;
  x: number;
  y: number;
}

const DEFAULT_BACKGROUND = "rgba(8, 12, 20, 0.9)";

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export class CanvasPointEditor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private width = 1;
  private height = 1;
  private hover = false;
  private draggingPointId: null | string = null;
  private scene: CanvasEditorScene = { points: [] };
  private transform: ZoomTransform = zoomIdentity;
  private readonly zoomBehavior = zoom<HTMLCanvasElement, unknown>();
  private options: Required<CanvasPointEditorOptions>;
  private onPointUpdate?: (update: CanvasPointUpdate) => void;
  private readonly resizeObserver: ResizeObserver;
  private readonly pointerDown = (event: PointerEvent): void =>
    this.handlePointerDown(event);
  private readonly pointerMove = (event: PointerEvent): void =>
    this.handlePointerMove(event);
  private readonly pointerUp = (event: PointerEvent): void =>
    this.handlePointerUp(event);
  private readonly mouseEnter = (): void => {
    this.hover = true;
    this.draw();
  };
  private readonly mouseLeave = (): void => {
    if (this.draggingPointId) return;
    this.hover = false;
    this.draw();
  };

  constructor(
    canvas: HTMLCanvasElement,
    options?: CanvasPointEditorOptions,
    onPointUpdate?: (update: CanvasPointUpdate) => void,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("CanvasPointEditor requires a 2D canvas context.");
    }
    this.canvas = canvas;
    this.ctx = ctx;
    this.options = {
      background: options?.background ?? DEFAULT_BACKGROUND,
      maxZoom: options?.maxZoom ?? 540,
      minZoom: options?.minZoom ?? 40,
      pointRadius: options?.pointRadius ?? 6,
      snapStep: options?.snapStep ?? 0.1,
    };
    this.onPointUpdate = onPointUpdate;
    this.resizeObserver = new ResizeObserver(() => {
      this.syncCanvasSize();
      this.draw();
    });
    this.resizeObserver.observe(this.canvas);
    this.installZoom();
    this.installPointerHandlers();
    this.syncCanvasSize();
    this.draw();
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("pointerdown", this.pointerDown);
    this.canvas.removeEventListener("pointermove", this.pointerMove);
    this.canvas.removeEventListener("pointerup", this.pointerUp);
    this.canvas.removeEventListener("pointercancel", this.pointerUp);
    this.canvas.removeEventListener("mouseenter", this.mouseEnter);
    this.canvas.removeEventListener("mouseleave", this.mouseLeave);
    select(this.canvas).on(".zoom", null);
  }

  fitToScene(): void {
    const bounds = this.getSceneBounds();
    const pad = Math.min(this.width, this.height) * 0.14;
    const axisX = this.scene.axisX;
    const axisY = this.scene.axisY;
    const centerX =
      typeof axisX === "number" ? axisX : (bounds.minX + bounds.maxX) * 0.5;
    const centerY =
      typeof axisY === "number" ? axisY : (bounds.minY + bounds.maxY) * 0.5;
    const halfSpanX =
      typeof axisX === "number"
        ? Math.max(Math.abs(bounds.minX - axisX), Math.abs(bounds.maxX - axisX))
        : (bounds.maxX - bounds.minX) * 0.5;
    const halfSpanY =
      typeof axisY === "number"
        ? Math.max(Math.abs(bounds.minY - axisY), Math.abs(bounds.maxY - axisY))
        : (bounds.maxY - bounds.minY) * 0.5;
    const spanX = Math.max(0.001, halfSpanX * 2);
    const spanY = Math.max(0.001, halfSpanY * 2);
    const scale = clamp(
      Math.min((this.width - pad * 2) / spanX, (this.height - pad * 2) / spanY),
      this.options.minZoom,
      this.options.maxZoom,
    );
    const transform = zoomIdentity
      .translate(
        this.width * 0.5 - centerX * scale,
        this.height * 0.5 - centerY * scale,
      )
      .scale(scale);
    this.applyTransform(transform);
  }

  setOnPointUpdate(callback?: (update: CanvasPointUpdate) => void): void {
    this.onPointUpdate = callback;
  }

  isDraggingPoint(): boolean {
    return this.draggingPointId !== null;
  }

  setScene(scene: CanvasEditorScene, options?: { fit?: boolean }): void {
    this.scene = scene;
    if (options?.fit) {
      this.fitToScene();
      return;
    }
    this.draw();
  }

  private applyTransform(transform: ZoomTransform): void {
    const selection = select(this.canvas);
    this.zoomBehavior.transform(selection, transform);
    this.transform = transform;
    this.draw();
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.fillStyle = this.options.background;
    ctx.fillRect(0, 0, this.width, this.height);

    this.drawAxes();
    this.drawPaths();
    this.drawBeziers();
    this.drawGuides();
    this.drawPoints();
  }

  private drawGuides(): void {
    if (!this.scene.guides?.length) return;
    const ctx = this.ctx;
    for (const guide of this.scene.guides) {
      ctx.save();
      ctx.strokeStyle = guide.stroke ?? "rgba(143, 166, 199, 0.45)";
      ctx.lineWidth = guide.width ?? 1.5;
      ctx.beginPath();
      if (guide.kind === "circle") {
        const centerX = this.transform.applyX(guide.x);
        const centerY = this.transform.applyY(guide.y);
        const radius = Math.abs(this.transform.k * guide.r);
        if (radius <= 0) {
          ctx.restore();
          continue;
        }
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      } else {
        const centerX = this.transform.applyX(guide.x);
        const centerY = this.transform.applyY(guide.y);
        const radiusX = Math.abs(this.transform.k * guide.rx);
        const radiusY = Math.abs(this.transform.k * guide.ry);
        if (radiusX <= 0 || radiusY <= 0) {
          ctx.restore();
          continue;
        }
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawAxes(): void {
    const ctx = this.ctx;
    const axisX = this.scene.axisX;
    const axisY = this.scene.axisY;
    ctx.save();
    ctx.strokeStyle = "rgba(143, 166, 199, 0.2)";
    ctx.lineWidth = 1;
    if (typeof axisY === "number") {
      const y = this.transform.applyY(axisY);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
    if (typeof axisX === "number") {
      const x = this.transform.applyX(axisX);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBeziers(): void {
    if (!this.scene.beziers?.length) return;
    const pointById = new Map(
      this.scene.points.map((point) => [point.id, point]),
    );
    const ctx = this.ctx;
    for (const bezier of this.scene.beziers) {
      const points = bezier.pointIds
        .map((id) => pointById.get(id))
        .filter((point): point is CanvasEditorPoint => Boolean(point));
      if (points.length < 2) continue;
      const samples = Math.max(4, bezier.samples ?? 64);
      ctx.save();
      ctx.strokeStyle = bezier.stroke ?? "rgba(255, 255, 255, 0.75)";
      ctx.lineWidth = bezier.width ?? 1.5;
      ctx.beginPath();
      for (let i = 0; i <= samples; i += 1) {
        const t = i / samples;
        const local = this.evaluateBezier(points, t);
        const x = this.transform.applyX(local.x);
        const y = this.transform.applyY(local.y);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawPaths(): void {
    if (!this.scene.paths?.length) return;
    const pointById = new Map(
      this.scene.points.map((point) => [point.id, point]),
    );
    const ctx = this.ctx;
    const getPoint = (id: string): CanvasEditorPoint | null =>
      pointById.get(id) ?? null;
    for (const path of this.scene.paths) {
      ctx.save();
      ctx.beginPath();
      let hasGeometry = false;
      if (path.commands?.length) {
        for (const command of path.commands) {
          if (command[0] === "M") {
            const point = getPoint(command[1]);
            if (!point) continue;
            ctx.moveTo(
              this.transform.applyX(point.x),
              this.transform.applyY(point.y),
            );
            hasGeometry = true;
            continue;
          }
          if (command[0] === "L") {
            const point = getPoint(command[1]);
            if (!point) continue;
            ctx.lineTo(
              this.transform.applyX(point.x),
              this.transform.applyY(point.y),
            );
            hasGeometry = true;
            continue;
          }
          if (command[0] === "Q") {
            const control = getPoint(command[1]);
            const point = getPoint(command[2]);
            if (!control || !point) continue;
            ctx.quadraticCurveTo(
              this.transform.applyX(control.x),
              this.transform.applyY(control.y),
              this.transform.applyX(point.x),
              this.transform.applyY(point.y),
            );
            hasGeometry = true;
            continue;
          }
          if (command[0] === "C") {
            const controlA = getPoint(command[1]);
            const controlB = getPoint(command[2]);
            const point = getPoint(command[3]);
            if (!controlA || !controlB || !point) continue;
            ctx.bezierCurveTo(
              this.transform.applyX(controlA.x),
              this.transform.applyY(controlA.y),
              this.transform.applyX(controlB.x),
              this.transform.applyY(controlB.y),
              this.transform.applyX(point.x),
              this.transform.applyY(point.y),
            );
            hasGeometry = true;
            continue;
          }
          if (command[0] === "Z") {
            ctx.closePath();
          }
        }
      } else {
        const points = (path.pointIds ?? [])
          .map((id) => pointById.get(id))
          .filter((point): point is CanvasEditorPoint => Boolean(point));
        if (points.length < 2) {
          ctx.restore();
          continue;
        }
        const first = points[0];
        ctx.moveTo(
          this.transform.applyX(first.x),
          this.transform.applyY(first.y),
        );
        for (let i = 1; i < points.length; i += 1) {
          const point = points[i];
          ctx.lineTo(
            this.transform.applyX(point.x),
            this.transform.applyY(point.y),
          );
        }
        hasGeometry = true;
        if (path.closed) {
          ctx.closePath();
        }
      }
      if (!hasGeometry) {
        ctx.restore();
        continue;
      }
      if (path.fill) {
        ctx.fillStyle = path.fill;
        ctx.fill();
      }
      if (path.stroke !== null) {
        ctx.strokeStyle = path.stroke ?? "rgba(125, 214, 255, 0.82)";
        ctx.lineWidth = path.width ?? 2;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawPoints(): void {
    if (!this.hover && !this.draggingPointId) return;
    const ctx = this.ctx;
    for (const point of this.scene.points) {
      const x = this.transform.applyX(point.x);
      const y = this.transform.applyY(point.y);
      const active = this.draggingPointId === point.id;
      ctx.save();
      ctx.fillStyle = active
        ? "rgba(125, 255, 200, 0.9)"
        : "rgba(255, 255, 255, 0.82)";
      ctx.strokeStyle = "rgba(15, 20, 30, 0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, this.options.pointRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  private evaluateBezier(
    points: CanvasEditorPoint[],
    t: number,
  ): { x: number; y: number } {
    const temp = points.map((point) => ({ x: point.x, y: point.y }));
    for (let level = temp.length - 1; level > 0; level -= 1) {
      for (let i = 0; i < level; i += 1) {
        temp[i].x += (temp[i + 1].x - temp[i].x) * t;
        temp[i].y += (temp[i + 1].y - temp[i].y) * t;
      }
    }
    return temp[0] ?? { x: 0, y: 0 };
  }

  private getPointById(id: string): CanvasEditorPoint | null {
    return this.scene.points.find((point) => point.id === id) ?? null;
  }

  private getSceneBounds(): {
    maxX: number;
    maxY: number;
    minX: number;
    minY: number;
  } {
    if (this.scene.points.length === 0) {
      return { maxX: 1, maxY: 1, minX: -1, minY: -1 };
    }
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const point of this.scene.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    if (minX === maxX) {
      minX -= 1;
      maxX += 1;
    }
    if (minY === maxY) {
      minY -= 1;
      maxY += 1;
    }
    return { maxX, maxY, minX, minY };
  }

  private hitTestPoint(screenX: number, screenY: number): null | string {
    const radius = this.options.pointRadius + 2;
    const radiusSq = radius * radius;
    for (let i = this.scene.points.length - 1; i >= 0; i -= 1) {
      const point = this.scene.points[i];
      const x = this.transform.applyX(point.x);
      const y = this.transform.applyY(point.y);
      const dx = screenX - x;
      const dy = screenY - y;
      if (dx * dx + dy * dy <= radiusSq) return point.id;
    }
    return null;
  }

  private installPointerHandlers(): void {
    this.canvas.addEventListener("pointerdown", this.pointerDown);
    this.canvas.addEventListener("pointermove", this.pointerMove);
    this.canvas.addEventListener("pointerup", this.pointerUp);
    this.canvas.addEventListener("pointercancel", this.pointerUp);
    this.canvas.addEventListener("mouseenter", this.mouseEnter);
    this.canvas.addEventListener("mouseleave", this.mouseLeave);
  }

  private installZoom(): void {
    this.zoomBehavior
      .scaleExtent([this.options.minZoom, this.options.maxZoom])
      .filter((event: MouseEvent | TouchEvent | WheelEvent) => {
        if (this.draggingPointId) return false;
        if (event.type === "wheel") return true;
        if (event.type === "touchstart") {
          const [screenX, screenY] = pointer(event, this.canvas);
          return this.hitTestPoint(screenX, screenY) === null;
        }
        if (event.type !== "mousedown") return false;
        const mouse = event as MouseEvent;
        if (mouse.button !== 0) return false;
        const [screenX, screenY] = pointer(event, this.canvas);
        return this.hitTestPoint(screenX, screenY) === null;
      })
      .on("zoom", (event: D3ZoomEvent<HTMLCanvasElement, unknown>) => {
        this.transform = event.transform;
        this.draw();
      });
    select(this.canvas).call(this.zoomBehavior).on("dblclick.zoom", null);
  }

  private handlePointerDown(event: PointerEvent): void {
    const pointId = this.hitTestPoint(event.offsetX, event.offsetY);
    if (!pointId) return;
    this.draggingPointId = pointId;
    this.hover = true;
    this.canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
    this.draw();
  }

  private handlePointerMove(event: PointerEvent): void {
    this.hover = true;
    if (!this.draggingPointId) {
      this.draw();
      return;
    }
    const point = this.getPointById(this.draggingPointId);
    if (!point) return;
    const world = this.transform.invert([event.offsetX, event.offsetY]);
    const nextX = this.snap(world[0]);
    const nextY = this.snap(world[1]);
    if (nextX === point.x && nextY === point.y) {
      this.draw();
      return;
    }
    point.x = nextX;
    point.y = nextY;
    this.onPointUpdate?.({ id: point.id, x: nextX, y: nextY });
    this.draw();
  }

  private handlePointerUp(event: PointerEvent): void {
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    this.draggingPointId = null;
    this.draw();
  }

  private snap(value: number): number {
    const step = Math.max(0.0001, this.options.snapStep);
    return Math.round(value / step) * step;
  }

  private syncCanvasSize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, Math.round(rect.width));
    this.height = Math.max(1, Math.round(rect.height));
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
  }
}
