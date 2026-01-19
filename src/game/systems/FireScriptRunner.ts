import type { Aim, BulletSpec, FireScript, Vec2 } from '../data/scripts';

export type EmitBullet = (x: number, y: number, angleRad: number, bullet: BulletSpec) => void;

export class FireScriptRunner {
  private script: FireScript;
  private stepIndex = 0;
  private stepElapsedMs = 0;
  private shotTimerMs = 0;
  private shotsFired = 0;
  private finished = false;
  private charging = false;

  constructor(script: FireScript) {
    this.script = script;
  }

  setScript(script: FireScript): void {
    this.script = script;
  }

  reset(): void {
    this.stepIndex = 0;
    this.stepElapsedMs = 0;
    this.shotTimerMs = 0;
    this.shotsFired = 0;
    this.finished = false;
    this.charging = false;
  }

  update(
    deltaMs: number,
    sourceX: number,
    sourceY: number,
    playerX: number,
    playerY: number,
    playerAlive: boolean,
    emit: EmitBullet,
  ): void {
    if (this.script.steps.length === 0 || this.finished) return;
    this.charging = false;
    let remaining = deltaMs;
    while (remaining > 0 && this.script.steps.length > 0) {
      const step = this.script.steps[this.stepIndex];
      if (step.kind === 'charge') {
        if (step.durationMs <= 0) {
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
        remaining -= slice;
        if (this.stepElapsedMs >= step.durationMs) {
          if (this.advanceStep()) return;
        }
        continue;
      }
      if (step.kind === 'cooldown') {
        if (step.durationMs <= 0) {
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
        remaining -= slice;
        if (this.stepElapsedMs >= step.durationMs) {
          if (this.advanceStep()) return;
        }
        continue;
      }

      if (step.kind === 'spray') {
        if (step.durationMs <= 0) {
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
        this.shotTimerMs += slice;
        const intervalMs = 1000 / Math.max(step.ratePerSec, 0.001);
        while (this.shotTimerMs >= intervalMs) {
          const angle = this.getAimAngle(step.aim, sourceX, sourceY, playerX, playerY, playerAlive, this.stepElapsedMs);
          this.emitShot(step.originOffsets, sourceX, sourceY, angle, step.bullet, emit);
          this.shotTimerMs -= intervalMs;
        }
        remaining -= slice;
        if (this.stepElapsedMs >= step.durationMs) {
          if (this.advanceStep()) return;
        }
        continue;
      }

      if (step.kind === 'burst') {
        const intervalMs = Math.max(step.intervalMs, 1);
        if (step.count <= 0) {
          if (this.advanceStep()) return;
          continue;
        }
        const slice = remaining;
        this.stepElapsedMs += slice;
        this.shotTimerMs -= slice;
        while (this.shotsFired < step.count && this.shotTimerMs <= 0) {
          const angle = this.getAimAngle(step.aim, sourceX, sourceY, playerX, playerY, playerAlive, this.stepElapsedMs);
          this.emitShot(step.originOffsets, sourceX, sourceY, angle, step.bullet, emit);
          this.shotsFired += 1;
          this.shotTimerMs += intervalMs;
        }
        remaining -= slice;
        if (this.shotsFired >= step.count) {
          if (this.advanceStep()) return;
        }
        continue;
      }

      remaining = 0;
    }
    if (this.script.steps.length > 0 && !this.finished) {
      this.charging = this.script.steps[this.stepIndex]?.kind === 'charge';
    }
  }

  private advanceStep(): boolean {
    this.stepIndex += 1;
    if (this.stepIndex >= this.script.steps.length) {
      if (this.script.loop) {
        this.stepIndex = 0;
      } else {
        this.finished = true;
        this.stepIndex = this.script.steps.length - 1;
        return true;
      }
    }
    this.stepElapsedMs = 0;
    this.shotTimerMs = 0;
    this.shotsFired = 0;
    this.charging = false;
    return false;
  }

  private getAimAngle(
    aim: Aim,
    sourceX: number,
    sourceY: number,
    playerX: number,
    playerY: number,
    playerAlive: boolean,
    elapsedMs: number,
  ): number {
    switch (aim.kind) {
      case 'fixed':
        return (aim.angleDeg * Math.PI) / 180;
      case 'sweep': {
        const period = Math.max(aim.periodMs, 1);
        const t = (elapsedMs % period) / period;
        const angle = aim.fromDeg + (aim.toDeg - aim.fromDeg) * t;
        return (angle * Math.PI) / 180;
      }
      case 'atPlayer':
      default: {
        if (!playerAlive) return Math.PI / 2;
        const dx = playerX - sourceX;
        const dy = playerY - sourceY;
        return Math.atan2(dy, dx);
      }
    }
  }

  private emitShot(
    offsets: undefined | Vec2[],
    sourceX: number,
    sourceY: number,
    angleRad: number,
    bullet: BulletSpec,
    emit: EmitBullet,
  ): void {
    if (!offsets || offsets.length === 0) {
      emit(sourceX, sourceY, angleRad, bullet);
      return;
    }
    for (const offset of offsets) {
      emit(sourceX + offset.x, sourceY + offset.y, angleRad, bullet);
    }
  }

  get isCharging(): boolean {
    return this.charging;
  }
}
