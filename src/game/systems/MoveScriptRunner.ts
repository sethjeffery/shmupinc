import type { MoveScript, MoveStep, Vec2 } from "../data/scripts";

export class MoveScriptRunner {
  private script: MoveScript;
  private stepIndex = 0;
  private stepElapsedMs = 0;
  private stepStartLocalX = 0;
  private stepStartLocalY = 0;
  private anchorX = 0;
  private anchorY = 0;
  private currentLocalX = 0;
  private currentLocalY = 0;
  private currentWorldX = 0;
  private currentWorldY = 0;
  private playfieldWidth = 1;
  private playfieldHeight = 1;
  private finished = false;
  private tempX: number[] = [];
  private tempY: number[] = [];

  constructor(script: MoveScript) {
    this.script = script;
    this.prepareBuffers();
  }

  get x(): number {
    return this.currentWorldX;
  }

  get y(): number {
    return this.currentWorldY;
  }

  get localX(): number {
    return this.currentLocalX;
  }

  get localY(): number {
    return this.currentLocalY;
  }

  get isFinished(): boolean {
    return this.finished;
  }

  setScript(script: MoveScript): void {
    this.script = script;
    this.prepareBuffers();
  }

  setPlayfieldSize(width: number, height: number): void {
    this.playfieldWidth = Math.max(1, width);
    this.playfieldHeight = Math.max(1, height);
  }

  reset(anchorX: number, anchorY: number): void {
    this.anchorX = anchorX;
    this.anchorY = anchorY;
    this.stepIndex = 0;
    this.stepElapsedMs = 0;
    this.stepStartLocalX = 0;
    this.stepStartLocalY = 0;
    this.currentLocalX = 0;
    this.currentLocalY = 0;
    this.currentWorldX = anchorX;
    this.currentWorldY = anchorY;
    this.finished = false;
  }

  update(deltaMs: number): void {
    if (this.script.steps.length === 0 || this.finished) return;
    const lastIndex = this.script.steps.length - 1;
    if (!this.script.loop && this.stepIndex === lastIndex) {
      const lastStep = this.script.steps[lastIndex];
      if (
        lastStep.durationMs > 0 &&
        this.stepElapsedMs >= lastStep.durationMs
      ) {
        this.applyStep(lastStep, 1);
        this.finished = true;
        return;
      }
    }
    let remaining = deltaMs;
    while (remaining > 0) {
      const step = this.script.steps[this.stepIndex];
      if (step.durationMs <= 0) {
        this.applyStep(step, 1);
        if (this.advanceStep()) return;
        continue;
      }
      const timeLeft = step.durationMs - this.stepElapsedMs;
      if (timeLeft <= 0) {
        if (this.advanceStep()) return;
        continue;
      }
      const slice = Math.min(remaining, timeLeft);
      this.stepElapsedMs += slice;
      const t = Math.min(this.stepElapsedMs / step.durationMs, 1);
      this.applyStep(step, t);
      remaining -= slice;
      if (this.stepElapsedMs >= step.durationMs) {
        if (this.advanceStep()) return;
      }
      if (this.script.steps.length === 0) break;
    }
  }

  private advanceStep(): boolean {
    this.stepIndex += 1;
    if (this.stepIndex >= this.script.steps.length) {
      if (this.script.loop) {
        this.stepIndex = 0;
      } else {
        this.stepIndex = this.script.steps.length - 1;
        this.stepElapsedMs = this.script.steps[this.stepIndex]?.durationMs ?? 0;
        this.finished = true;
        return true;
      }
    }
    this.stepElapsedMs = 0;
    this.stepStartLocalX = this.currentLocalX;
    this.stepStartLocalY = this.currentLocalY;
    return false;
  }

  private applyStep(step: MoveStep, t: number): void {
    const easedT =
      step.kind === "bezier" || step.kind === "dashTo"
        ? this.applyEase(step.ease ?? "linear", t)
        : t;
    switch (step.kind) {
      case "bezier":
        this.evaluateBezier(step.points, easedT);
        break;
      case "sineDown": {
        // SineDown is local and based on the step start position.
        const elapsed = this.stepElapsedMs / 1000;
        this.currentLocalX =
          this.stepStartLocalX +
          Math.sin(elapsed * step.freq * Math.PI * 2) * step.amp;
        this.currentLocalY = this.stepStartLocalY + step.speed * elapsed;
        break;
      }
      case "hover":
        this.currentLocalX = this.stepStartLocalX;
        this.currentLocalY = this.stepStartLocalY;
        break;
      case "dashTo": {
        const targetLocalX = step.to.x * this.playfieldWidth;
        const targetLocalY = step.to.y * this.playfieldHeight;
        if (step.position === "absolute") {
          this.currentLocalX =
            this.stepStartLocalX +
            (targetLocalX - this.stepStartLocalX) * easedT;
          this.currentLocalY =
            this.stepStartLocalY +
            (targetLocalY - this.stepStartLocalY) * easedT;
        } else {
          this.currentLocalX = this.stepStartLocalX + targetLocalX * easedT;
          this.currentLocalY = this.stepStartLocalY + targetLocalY * easedT;
        }
        break;
      }
      default:
        break;
    }
    this.currentWorldX = this.anchorX + this.currentLocalX;
    this.currentWorldY = this.anchorY + this.currentLocalY;
  }

  private evaluateBezier(points: Vec2[], t: number): void {
    const count = points.length;
    if (count === 0) return;
    for (let i = 0; i < count; i += 1) {
      this.tempX[i] = points[i].x * this.playfieldWidth;
      this.tempY[i] = points[i].y * this.playfieldHeight;
    }
    for (let level = count - 1; level > 0; level -= 1) {
      for (let i = 0; i < level; i += 1) {
        this.tempX[i] += (this.tempX[i + 1] - this.tempX[i]) * t;
        this.tempY[i] += (this.tempY[i + 1] - this.tempY[i]) * t;
      }
    }
    this.currentLocalX = this.stepStartLocalX + this.tempX[0];
    this.currentLocalY = this.stepStartLocalY + this.tempY[0];
  }

  private applyEase(
    ease: "in" | "inOut" | "linear" | "out" | "outIn",
    t: number,
  ): number {
    switch (ease) {
      case "in":
        return t * t;
      case "out": {
        const inv = 1 - t;
        return 1 - inv * inv;
      }
      case "inOut":
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      case "outIn":
        return t < 0.5
          ? 0.5 * (1 - Math.pow(1 - 2 * t, 2))
          : 0.5 * (2 * t - 1) * (2 * t - 1) + 0.5;
      case "linear":
      default:
        return t;
    }
  }

  private prepareBuffers(): void {
    let max = 0;
    for (const step of this.script.steps) {
      if (step.kind === "bezier") {
        max = Math.max(max, step.points.length);
      }
    }
    if (max <= this.tempX.length) return;
    this.tempX = Array<number>(max).fill(0);
    this.tempY = Array<number>(max).fill(0);
  }
}
