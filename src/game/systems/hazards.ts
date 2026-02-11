import type {
  HazardMotion,
  HazardScript,
  LaneWallScript,
} from "../data/levels";
import type Phaser from "phaser";

export interface PlayerSnapshot {
  x: number;
  y: number;
  radius: number;
  alive: boolean;
}

export interface HazardImpact {
  contactX: number;
  contactY: number;
  damageOnTouch: boolean;
  deathOnBottomEject: boolean;
  fxColor: number;
  pushX: number;
  pushY: number;
}

export interface Hazard {
  update(elapsedMs: number): void;
  updateBounds(bounds: Phaser.Geom.Rectangle): void;
  getImpact(player: PlayerSnapshot): HazardImpact | null;
  getBounds(): Phaser.Geom.Rectangle;
  destroy(): void;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

interface SineMotionRuntime {
  kind: "sine";
  axis: "x" | "y";
  amplitudePx: number;
  periodMs: number;
  phase: number;
}

interface LerpMotionRuntime {
  kind: "lerp";
  axis: "x" | "y";
  durationMs: number;
  fromPx: number;
  toPx: number;
  yoyo: boolean;
}

interface SweepMotionRuntime {
  kind: "sweep";
  durationMs: number;
  fromX: number;
  fromY: number;
  loop: boolean;
  toX: number;
  toY: number;
  yoyo: boolean;
}

type MotionRuntime = LerpMotionRuntime | SineMotionRuntime | SweepMotionRuntime;

class LaneWallHazard implements Hazard {
  private script: LaneWallScript;
  private rect: Phaser.GameObjects.Rectangle;
  private baseX = 0;
  private baseY = 0;
  private width = 0;
  private height = 0;
  private motion?: MotionRuntime;
  private currentX = 0;
  private currentY = 0;
  private active = true;
  private lastElapsedMs = 0;
  private impact = {
    contactX: 0,
    contactY: 0,
    damageOnTouch: false,
    deathOnBottomEject: false,
    fxColor: 0,
    pushX: 0,
    pushY: 0,
  };

  constructor(
    scene: Phaser.Scene,
    script: LaneWallScript,
    bounds: Phaser.Geom.Rectangle,
  ) {
    this.script = script;
    this.rect = scene.add.rectangle(
      0,
      0,
      10,
      10,
      script.fillColor ?? 0x0b1220,
      0.85,
    );
    this.rect.setOrigin(0.5);
    this.rect.setDepth(2);
    this.rect.setStrokeStyle(2, script.lineColor ?? 0x1b3149, 0.65);
    this.updateBounds(bounds);
  }

  updateBounds(bounds: Phaser.Geom.Rectangle): void {
    this.baseX = bounds.x + this.script.x * bounds.width;
    this.baseY = bounds.y + this.script.y * bounds.height;
    this.width = bounds.width * this.script.w;
    this.height = bounds.height * this.script.h;
    this.rect.setSize(this.width, this.height);
    if (this.script.motion) {
      this.motion = this.buildMotionRuntime(this.script.motion, bounds);
    } else {
      this.motion = undefined;
    }
    this.update(this.lastElapsedMs);
  }

  update(elapsedMs: number): void {
    this.lastElapsedMs = elapsedMs;
    if (!this.isActiveAt(elapsedMs)) {
      this.active = false;
      this.rect.setVisible(false);
      return;
    }
    this.active = true;
    this.rect.setVisible(true);

    const motion = this.motion;
    const localElapsed = Math.max(0, elapsedMs - (this.script.startMs ?? 0));
    let offsetX = 0;
    let offsetY = 0;
    if (motion) {
      if (motion.kind === "sine") {
        const angle =
          (localElapsed / motion.periodMs) * Math.PI * 2 + motion.phase;
        const offset = Math.sin(angle) * motion.amplitudePx;
        if (motion.axis === "x") offsetX = offset;
        else offsetY = offset;
      } else if (motion.kind === "lerp") {
        const t = this.resolveMotionT(
          localElapsed,
          motion.durationMs,
          motion.yoyo,
          true,
        );
        const offset = motion.fromPx + (motion.toPx - motion.fromPx) * t;
        if (motion.axis === "x") offsetX = offset;
        else offsetY = offset;
      } else if (motion.kind === "sweep") {
        const t = this.resolveMotionT(
          localElapsed,
          motion.durationMs,
          motion.yoyo,
          motion.loop,
        );
        offsetX = motion.fromX + (motion.toX - motion.fromX) * t;
        offsetY = motion.fromY + (motion.toY - motion.fromY) * t;
      }
    }

    const nextX = this.baseX + offsetX;
    const nextY = this.baseY + offsetY;
    this.currentX = nextX;
    this.currentY = nextY;
    this.rect.setPosition(nextX, nextY);
  }

  getImpact(player: PlayerSnapshot): HazardImpact | null {
    if (!this.active) return null;
    const halfW = this.width * 0.5;
    const halfH = this.height * 0.5;
    const dx = player.x - this.currentX;
    const dy = player.y - this.currentY;
    const clampedX = clamp(dx, -halfW, halfW);
    const clampedY = clamp(dy, -halfH, halfH);
    const closestX = this.currentX + clampedX;
    const closestY = this.currentY + clampedY;
    const offsetX = player.x - closestX;
    const offsetY = player.y - closestY;
    const distSq = offsetX * offsetX + offsetY * offsetY;
    const radiusSq = player.radius * player.radius;
    if (distSq > radiusSq) return null;

    const out = this.impact;
    out.contactX = closestX;
    out.contactY = closestY;
    out.damageOnTouch = Boolean(this.script.damageOnTouch);
    out.deathOnBottomEject = Boolean(this.script.deathOnBottomEject);
    out.fxColor = this.script.lineColor ?? this.script.fillColor ?? 0x1b3149;

    if (distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      const push = player.radius - dist;
      out.pushX = (offsetX / dist) * push;
      out.pushY = (offsetY / dist) * push;
      return out;
    }

    const penX = halfW - Math.abs(dx);
    const penY = halfH - Math.abs(dy);
    if (penX < penY) {
      const dir = dx >= 0 ? 1 : -1;
      out.pushX = (penX + player.radius) * dir;
      out.pushY = 0;
      out.contactX = this.currentX + dir * halfW;
      out.contactY = player.y;
      return out;
    }
    const dir = dy >= 0 ? 1 : -1;
    out.pushX = 0;
    out.pushY = (penY + player.radius) * dir;
    out.contactX = player.x;
    out.contactY = this.currentY + dir * halfH;
    return out;
  }

  getBounds(): Phaser.Geom.Rectangle {
    return this.rect.getBounds();
  }

  destroy(): void {
    this.rect.destroy();
  }

  private buildMotionRuntime(
    motion: HazardMotion,
    bounds: Phaser.Geom.Rectangle,
  ): MotionRuntime {
    if (motion.kind === "sine") {
      return {
        amplitudePx:
          motion.amplitude *
          (motion.axis === "x" ? bounds.width : bounds.height),
        axis: motion.axis,
        kind: motion.kind,
        periodMs: Math.max(motion.periodMs, 1),
        phase: motion.phase ?? 0,
      };
    }
    if (motion.kind === "lerp") {
      const axisScale = motion.axis === "x" ? bounds.width : bounds.height;
      return {
        axis: motion.axis,
        durationMs: Math.max(motion.durationMs, 1),
        fromPx: motion.from * axisScale,
        kind: motion.kind,
        toPx: motion.to * axisScale,
        yoyo: Boolean(motion.yoyo),
      };
    }
    return {
      durationMs: Math.max(motion.durationMs, 1),
      fromX: motion.from.x * bounds.width,
      fromY: motion.from.y * bounds.height,
      kind: motion.kind,
      loop: Boolean(motion.loop),
      toX: motion.to.x * bounds.width,
      toY: motion.to.y * bounds.height,
      yoyo: Boolean(motion.yoyo),
    };
  }

  private isActiveAt(elapsedMs: number): boolean {
    const startMs = this.script.startMs ?? 0;
    if (elapsedMs < startMs) return false;
    const endMs = this.script.endMs;
    if (endMs !== undefined && elapsedMs >= endMs) return false;
    return true;
  }

  private resolveMotionT(
    elapsedMs: number,
    durationMs: number,
    yoyo: boolean,
    loop: boolean,
  ): number {
    const duration = Math.max(durationMs, 1);
    if (loop) {
      let t = (elapsedMs % duration) / duration;
      if (yoyo) {
        t = t <= 0.5 ? t * 2 : 2 - t * 2;
      }
      return t;
    }
    if (!yoyo) {
      return clamp(elapsedMs / duration, 0, 1);
    }
    const cycle = clamp(elapsedMs / (duration * 2), 0, 1);
    return cycle <= 0.5 ? cycle * 2 : 2 - cycle * 2;
  }
}

export function createHazard(
  script: HazardScript,
  scene: Phaser.Scene,
  bounds: Phaser.Geom.Rectangle,
): Hazard | null {
  switch (script.type) {
    case "laneWall":
      return new LaneWallHazard(scene, script, bounds);
    default:
      return null;
  }
}
