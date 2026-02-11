import type { EnemyDef } from "../data/enemies";
import type { EnemyHitbox } from "../data/enemyTypes";
import type { MoveScript } from "../data/scripts";
import type { EmitBullet } from "../systems/FireScriptRunner";

import Phaser from "phaser";

import { drawEnemyToGraphics } from "../render/enemyShapes";
import { FireScriptRunner } from "../systems/FireScriptRunner";
import { MoveScriptRunner } from "../systems/MoveScriptRunner";
import { PLAYFIELD_BASE_HEIGHT, PLAYFIELD_BASE_WIDTH } from "../util/playArea";

const DYING_HP_RATIO = 0.25;

export class Enemy {
  scene: Phaser.Scene;
  def: EnemyDef;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  hitbox: EnemyHitbox;
  active: boolean;
  graphics: Phaser.GameObjects.Graphics;
  private flashTimer = 0;
  private finishedElapsedMsValue = 0;
  private exitTriggered = false;
  private phaseIndex = 0;
  private moveRunner: MoveScriptRunner;
  private fireRunner: FireScriptRunner;
  private fixedRotationRad = 0;
  private playfieldWidth = PLAYFIELD_BASE_WIDTH;
  private playfieldHeight = PLAYFIELD_BASE_HEIGHT;

  constructor(
    scene: Phaser.Scene,
    def: EnemyDef,
    x: number,
    y: number,
    playfieldWidth = PLAYFIELD_BASE_WIDTH,
    playfieldHeight = PLAYFIELD_BASE_HEIGHT,
  ) {
    this.scene = scene;
    this.def = def;
    this.x = x;
    this.y = y;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.radius = def.radius;
    this.hitbox = def.hitbox;
    this.active = true;
    this.moveRunner = new MoveScriptRunner(def.move);
    this.setPlayfieldSize(playfieldWidth, playfieldHeight);
    this.fireRunner = new FireScriptRunner(def.fire);
    this.moveRunner.reset(x, y);
    this.fireRunner.reset();

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(5);
    this.redraw(0);
    this.graphics.setPosition(this.x, this.y);
    this.applyRotationMode();
  }

  reset(def: EnemyDef, x: number, y: number, hpMultiplier = 1): void {
    this.def = def;
    this.x = x;
    this.y = y;
    this.hp = Math.max(1, Math.round(def.hp * hpMultiplier));
    this.maxHp = this.hp;
    this.radius = def.radius;
    this.hitbox = def.hitbox;
    this.active = true;
    this.flashTimer = 0;
    this.finishedElapsedMsValue = 0;
    this.exitTriggered = false;
    this.phaseIndex = 0;
    this.moveRunner.setPlayfieldSize(this.playfieldWidth, this.playfieldHeight);
    this.moveRunner.setScript(def.move);
    this.fireRunner.setScript(def.fire);
    this.moveRunner.reset(x, y);
    this.fireRunner.reset();
    this.x = this.moveRunner.x;
    this.y = this.moveRunner.y;
    this.graphics.setVisible(true);
    this.graphics.setPosition(this.x, this.y);
    this.redraw(0);
    this.applyRotationMode();
  }

  update(
    deltaMs: number,
    playerX: number,
    playerY: number,
    playerAlive: boolean,
    emitBullet: EmitBullet,
  ): void {
    if (!this.active) return;
    this.updateFlash(deltaMs / 1000);
    this.updatePhase();
    const previousX = this.x;
    const previousY = this.y;
    this.moveRunner.update(deltaMs);
    this.x = this.moveRunner.x;
    this.y = this.moveRunner.y;
    this.graphics.setPosition(this.x, this.y);
    this.updateRotation(previousX, previousY);
    this.fireRunner.update(
      deltaMs,
      this.x,
      this.y,
      playerX,
      playerY,
      playerAlive,
      emitBullet,
    );
    if (this.moveRunner.isFinished) {
      this.finishedElapsedMsValue += deltaMs;
    } else {
      this.finishedElapsedMsValue = 0;
    }
  }

  get isMoveFinished(): boolean {
    return this.moveRunner.isFinished;
  }

  get isCharging(): boolean {
    return this.fireRunner.isCharging;
  }

  get chargeProgress(): number {
    return this.fireRunner.chargeProgress;
  }

  get finishedElapsedMs(): number {
    return this.finishedElapsedMsValue;
  }

  get hpRatio(): number {
    if (this.maxHp <= 0) return 0;
    return Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
  }

  get isDying(): boolean {
    return this.active && this.hp > 0 && this.hpRatio <= DYING_HP_RATIO;
  }

  takeDamage(amount: number): void {
    this.hp -= amount;
    this.flashTimer = 0.42;
    this.redraw(this.flashTimer);
    if (this.hp <= 0) {
      this.hp = 0;
      this.active = false;
      this.graphics.setVisible(false);
    }
  }

  glow(duration = 0.2): void {
    this.flashTimer = Math.max(this.flashTimer, duration);
    this.redraw(this.flashTimer);
  }

  triggerExit(targetX: number, targetY: number, durationMs: number): void {
    if (this.exitTriggered) return;
    this.exitTriggered = true;
    this.finishedElapsedMsValue = 0;
    const move: MoveScript = {
      steps: [
        {
          durationMs: Math.max(durationMs, 1),
          ease: "in",
          kind: "dashTo",
          to: {
            x: (targetX - this.x) / this.playfieldWidth,
            y: (targetY - this.y) / this.playfieldHeight,
          },
        },
      ],
    };
    this.moveRunner.setScript(move);
    this.moveRunner.reset(this.x, this.y);
    this.fireRunner.setScript({ steps: [] });
    this.fireRunner.reset();
  }

  setPlayfieldSize(width: number, height: number): void {
    this.playfieldWidth = Math.max(1, width);
    this.playfieldHeight = Math.max(1, height);
    this.moveRunner.setPlayfieldSize(this.playfieldWidth, this.playfieldHeight);
  }

  deactivate(): void {
    this.active = false;
    this.graphics.setVisible(false);
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private updateFlash(deltaSeconds: number): void {
    if (this.flashTimer <= 0) return;
    this.flashTimer = Math.max(0, this.flashTimer - deltaSeconds);
    this.redraw(this.flashTimer);
  }

  private updatePhase(): void {
    const phases = this.def.phases;
    if (
      !phases ||
      this.phaseIndex >= phases.length ||
      this.maxHp <= 0 ||
      this.hp <= 0
    )
      return;
    const next = phases[this.phaseIndex];
    const ratio = this.hp / this.maxHp;
    if (ratio > next.hpThreshold) return;
    if (next.move) {
      this.moveRunner.setScript(next.move);
      this.moveRunner.reset(this.x, this.y);
      this.finishedElapsedMsValue = 0;
      this.exitTriggered = false;
    }
    if (next.fire) {
      this.fireRunner.setScript(next.fire);
      this.fireRunner.reset();
    }
    this.phaseIndex += 1;
  }

  private redraw(flashStrength: number): void {
    this.graphics.clear();
    const style = this.def.style ?? {};
    const baseFill = style.fillColor ?? 0x1c0f1a;
    const baseLine = style.lineColor ?? 0xff6b6b;
    const flashBlend = Phaser.Math.Clamp(flashStrength * 1.55, 0, 1);
    const dyingProgress = Phaser.Math.Clamp(
      (DYING_HP_RATIO - this.hpRatio) / DYING_HP_RATIO,
      0,
      1,
    );
    const flash = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(baseFill),
      Phaser.Display.Color.ValueToColor(0xffe7b6),
      1,
      flashBlend,
    );
    const fill = Phaser.Display.Color.GetColor(flash.r, flash.g, flash.b);
    const lineBlend = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(baseLine),
      Phaser.Display.Color.ValueToColor(0xffffff),
      1,
      Phaser.Math.Clamp(dyingProgress * 0.6 + flashBlend * 0.9, 0, 1),
    );
    const lineColor = Phaser.Display.Color.GetColor(
      lineBlend.r,
      lineBlend.g,
      lineBlend.b,
    );

    this.graphics.lineStyle(
      2 + dyingProgress * 0.7 + flashBlend * 0.7,
      lineColor,
      1,
    );
    this.graphics.fillStyle(fill, 0.92 + flashBlend * 0.08);
    drawEnemyToGraphics(
      this.graphics,
      style.vector ?? style.shape ?? "swooper",
      this.radius,
    );
    if (flashBlend > 0.04) {
      this.graphics.lineStyle(
        1.4 + flashBlend * 0.8,
        lineColor,
        flashBlend * 0.5,
      );
      this.graphics.strokeCircle(
        0,
        0,
        this.radius * (1.08 + flashBlend * 0.12),
      );
    }
    this.graphics.setScale(1 + flashBlend * 0.05);
  }

  private applyRotationMode(): void {
    if (this.def.rotation === "fixed") {
      this.fixedRotationRad = ((this.def.rotationDeg ?? 0) * Math.PI) / 180;
      this.graphics.setRotation(this.fixedRotationRad);
      return;
    }
    this.graphics.setRotation(0);
  }

  private updateRotation(previousX: number, previousY: number): void {
    if (this.def.rotation === "fixed") return;
    const dx = this.x - previousX;
    const dy = this.y - previousY;
    if (dx * dx + dy * dy < 0.0001) return;
    this.graphics.setRotation(Math.atan2(dy, dx) + Math.PI / 2);
  }
}
