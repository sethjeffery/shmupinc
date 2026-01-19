import type { ShipShape } from "../data/ships";

import Phaser from "phaser";

import { drawShipToGraphics } from "../render/shipShapes";

export interface ShipConfig {
  radius: number;
  maxHp: number;
  moveSpeed: number;
  color: number;
  shape: ShipShape;
}

export class Ship {
  scene: Phaser.Scene;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  moveSpeed: number;
  graphics: Phaser.GameObjects.Graphics;
  color: number;
  shape: ShipShape;
  private flashTimer = 0;

  constructor(scene: Phaser.Scene, config: ShipConfig) {
    this.scene = scene;
    this.radius = config.radius;
    this.maxHp = config.maxHp;
    this.hp = config.maxHp;
    this.moveSpeed = config.moveSpeed;
    this.color = config.color;
    this.shape = config.shape;

    this.x = scene.scale.width * 0.5;
    this.y = scene.scale.height * 0.8;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(10);
    this.redraw(0);
    this.setPosition(this.x, this.y);
  }

  update(
    deltaSeconds: number,
    targetX: number,
    targetY: number,
    bounds: Phaser.Geom.Rectangle,
    padding: number,
  ): void {
    this.updateFlash(deltaSeconds);
    const minX = bounds.x + bounds.width * padding;
    const maxX = bounds.x + bounds.width * (1 - padding);
    const minY = bounds.y + bounds.height * padding;
    const maxY = bounds.y + bounds.height * (1 - padding);
    const clampedX = Phaser.Math.Clamp(targetX, minX, maxX);
    const clampedY = Phaser.Math.Clamp(targetY, minY, maxY);

    const smoothing = Phaser.Math.Clamp(this.moveSpeed * deltaSeconds, 0, 1);
    const nextX = Phaser.Math.Linear(this.x, clampedX, smoothing);
    const nextY = Phaser.Math.Linear(this.y, clampedY, smoothing);
    this.setPosition(nextX, nextY);
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.graphics.setPosition(x, y);
  }

  setHealth(hp: number, maxHp: number): void {
    this.hp = hp;
    this.maxHp = maxHp;
  }

  setAppearance(color: number, shape: ShipShape): void {
    this.color = color;
    this.shape = shape;
    this.redraw(this.flashTimer);
  }

  setRadius(radius: number): void {
    this.radius = radius;
    this.redraw(this.flashTimer);
  }

  flash(duration = 0.25): void {
    this.flashTimer = Math.max(this.flashTimer, duration);
    this.redraw(this.flashTimer);
  }

  private updateFlash(deltaSeconds: number): void {
    if (this.flashTimer <= 0) return;
    this.flashTimer = Math.max(0, this.flashTimer - deltaSeconds);
    this.redraw(this.flashTimer);
  }

  private redraw(flashStrength: number): void {
    this.graphics.clear();
    const baseFill = this.scaleColor(this.color, 0.18);
    const flashColor = this.scaleColor(this.color, 1.1);
    const innerColor = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(baseFill),
      Phaser.Display.Color.ValueToColor(flashColor),
      1,
      Phaser.Math.Clamp(flashStrength, 0, 1),
    );
    const fill = Phaser.Display.Color.GetColor(
      innerColor.r,
      innerColor.g,
      innerColor.b,
    );

    this.graphics.lineStyle(2, this.color, 1);
    this.graphics.fillStyle(fill, 1);
    drawShipToGraphics(this.graphics, this.shape, this.radius);
  }

  private scaleColor(color: number, factor: number): number {
    const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
    const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
    const b = Math.min(255, Math.round((color & 0xff) * factor));
    return (r << 16) | (g << 8) | b;
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
