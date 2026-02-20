import Phaser from "phaser";

import {
  applyVectorBevelFx,
  computeVectorBevelDepthPx,
} from "../render/vector/vectorBevelFx";

export class PickupGold {
  scene: Phaser.Scene;
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  value: number;
  radius: number;
  graphics: Phaser.GameObjects.Graphics;
  magnetSpeed: number;
  friction: number;
  gravity: number;
  lifetimeMs: number;
  lifeMs: number;
  private bobPhase: number;
  private bobSpeed: number;
  private bobAmp: number;
  private driftX: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 30;
    this.value = 1;
    this.radius = 6;
    this.active = false;
    this.magnetSpeed = 235;
    this.friction = 0.965;
    this.gravity = 7;
    this.bobPhase = 0;
    this.bobSpeed = 0;
    this.bobAmp = 0;
    this.driftX = 0;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(6);
    this.updateVectorBevel();
    this.redraw();
    this.graphics.setVisible(false);
    this.lifetimeMs = 9000;
    this.lifeMs = 0;
  }

  spawn(x: number, y: number, value: number): void {
    this.x = x;
    this.y = y;
    this.vx = Phaser.Math.Between(-14, 14);
    this.vy = Phaser.Math.Between(-12, 4);
    this.value = value;
    this.active = true;
    this.lifeMs = 0;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.bobSpeed = Phaser.Math.FloatBetween(4.2, 6.4);
    this.bobAmp = Phaser.Math.FloatBetween(1.8, 3.4);
    this.driftX = Phaser.Math.FloatBetween(-8, 8);
    this.graphics.setVisible(true);
    this.graphics.setPosition(x, y);
    this.graphics.setScale(1);
    this.graphics.setAlpha(1);
  }

  update(
    delta: number,
    bounds: Phaser.Geom.Rectangle,
    playerX: number,
    playerY: number,
    magnetRadius: number,
  ): void {
    if (!this.active) return;
    this.lifeMs += delta * 1000;
    if (this.lifeMs >= this.lifetimeMs) {
      this.deactivate();
      return;
    }
    const remaining = Math.max(0, this.lifetimeMs - this.lifeMs);
    if (remaining < 1200) {
      this.graphics.setAlpha(Phaser.Math.Clamp(remaining / 1200, 0, 1));
    }

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const distSq = dx * dx + dy * dy;
    const magnetR = magnetRadius * magnetRadius;
    if (distSq < magnetR) {
      const dist = Math.sqrt(distSq) || 1;
      const pull = this.magnetSpeed * delta * (1 - dist / magnetRadius) * 8;
      this.vx += (dx / dist) * pull;
      this.vy += (dy / dist) * pull;
    }
    this.vx += this.driftX * delta;
    this.vy +=
      (this.gravity + Math.sin(this.bobPhase * 1.1 + 0.9) * 16) * delta;

    const damping = Math.pow(this.friction, delta * 60);
    this.vx *= damping;
    this.vy *= damping;

    this.x += this.vx * delta;
    this.y += this.vy * delta;
    this.bobPhase += delta * this.bobSpeed;
    const bobOffset = Math.sin(this.bobPhase) * this.bobAmp;
    const scalePulse = 1 + Math.sin(this.bobPhase * 1.5 + 0.6) * 0.06;
    this.graphics.setPosition(this.x, this.y + bobOffset);
    this.graphics.setScale(scalePulse);

    if (this.y > bounds.y + bounds.height + 40) {
      this.deactivate();
    }
  }

  deactivate(): void {
    this.active = false;
    this.graphics.setScale(1);
    this.graphics.setVisible(false);
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private redraw(): void {
    this.graphics.clear();
    this.graphics.fillStyle(0xffd166, 0.22);
    this.graphics.fillCircle(0, 0, this.radius * 1.55);
    this.graphics.lineStyle(1.5, 0xffe4a3, 0.95);
    this.graphics.fillStyle(0x3a260f, 1);
    this.graphics.fillCircle(0, 0, this.radius);
    this.graphics.strokeCircle(0, 0, this.radius);
    this.graphics.fillStyle(0xffd166, 0.9);
    this.graphics.fillCircle(0, 0, this.radius * 0.5);
    this.graphics.fillStyle(0xffffff, 0.5);
    this.graphics.fillCircle(
      -this.radius * 0.28,
      -this.radius * 0.28,
      this.radius * 0.2,
    );
  }

  private updateVectorBevel(): void {
    applyVectorBevelFx(this.graphics, {
      depthPx: computeVectorBevelDepthPx(this.radius, 2, 4),
      samples: 6,
      shadeAlpha: 1,
      shadeColor: 0xffffff,
    });
  }
}
