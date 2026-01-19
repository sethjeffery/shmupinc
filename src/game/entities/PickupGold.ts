import Phaser from "phaser";

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

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 30;
    this.value = 1;
    this.radius = 6;
    this.active = false;
    this.magnetSpeed = 220;
    this.friction = 0.9;
    this.gravity = 28;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(6);
    this.redraw();
    this.graphics.setVisible(false);
    this.lifetimeMs = 9000;
    this.lifeMs = 0;
  }

  spawn(x: number, y: number, value: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.value = value;
    this.active = true;
    this.lifeMs = 0;
    this.graphics.setVisible(true);
    this.graphics.setPosition(x, y);
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
    this.vy += this.gravity * delta;

    const damping = Math.pow(this.friction, delta * 60);
    this.vx *= damping;
    this.vy *= damping;

    this.x += this.vx * delta;
    this.y += this.vy * delta;
    this.graphics.setPosition(this.x, this.y);

    if (this.y > bounds.y + bounds.height + 40) {
      this.deactivate();
    }
  }

  deactivate(): void {
    this.active = false;
    this.graphics.setVisible(false);
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private redraw(): void {
    this.graphics.clear();
    this.graphics.lineStyle(2, 0xffd166, 1);
    this.graphics.fillStyle(0x2b1c0e, 1);
    this.graphics.fillCircle(0, 0, this.radius);
    this.graphics.strokeCircle(0, 0, this.radius);
  }
}
