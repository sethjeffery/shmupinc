import type { MountedWeapon } from "../data/save";
import type { ShipHitbox, ShipVector } from "../data/shipTypes";

import Phaser from "phaser";

import { GUNS } from "../data/guns";
import { drawGunToGraphics } from "../render/gunShapes";
import { drawShipToGraphics } from "../render/shipShapes";

interface GunAttachment {
  color: number;
  gunId: string;
  mirror: boolean;
  offset: { x: number; y: number };
  rotationRad: number;
  sizeMultiplier: number;
}

export interface ShipConfig {
  radius: number;
  hitbox: ShipHitbox;
  maxHp: number;
  moveSpeed: number;
  vector: ShipVector;
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
  vector: ShipVector;
  hitbox: ShipHitbox;
  private flashTimer = 0;
  private gunAttachments: GunAttachment[] = [];

  constructor(scene: Phaser.Scene, config: ShipConfig) {
    this.scene = scene;
    this.radius = config.radius;
    this.maxHp = config.maxHp;
    this.hp = config.maxHp;
    this.moveSpeed = config.moveSpeed;
    this.vector = config.vector;
    this.hitbox = config.hitbox;

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

  setAppearance(vector: ShipVector): void {
    this.vector = vector;
    this.redraw(this.flashTimer);
  }

  setRadius(radius: number): void {
    this.radius = radius;
    this.redraw(this.flashTimer);
  }

  setHitbox(hitbox: ShipHitbox): void {
    this.hitbox = hitbox;
  }

  setMountedWeapons(mountedWeapons: MountedWeapon[]): void {
    this.gunAttachments = mountedWeapons
      .map((mounted) => {
        const gunId = mounted.weapon.gunId;
        if (!GUNS[gunId]) return null;
        const sizeMultiplier = 0.5;
        const color = mounted.stats.bullet.color ?? 0x7df9ff;
        const angleSign = mounted.mount.offset.x < 0 ? -1 : 1;
        const rotationRad =
          (((mounted.stats.angleDeg ?? 0) * Math.PI) / 180) * angleSign;
        return {
          color,
          gunId,
          mirror: mounted.mount.offset.x < 0,
          offset: mounted.mount.offset,
          rotationRad,
          sizeMultiplier,
        };
      })
      .filter((item): item is GunAttachment => Boolean(item));
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
    this.drawGuns();
    drawShipToGraphics(this.graphics, this.vector, this.radius);
    if (flashStrength > 0.03) {
      const intensity = Phaser.Math.Clamp(flashStrength, 0, 1);
      this.graphics.lineStyle(
        1.2 + intensity * 0.9,
        0xe8f3ff,
        intensity * 0.52,
      );
      this.graphics.strokeCircle(0, 0, this.radius * (1.05 + intensity * 0.08));
    }
  }

  private drawGuns(): void {
    if (!this.gunAttachments.length) return;
    for (const attachment of this.gunAttachments) {
      const gun = GUNS[attachment.gunId];
      if (!gun) continue;
      const size = this.radius * attachment.sizeMultiplier;
      const x = attachment.offset.x * this.radius;
      const y = attachment.offset.y * this.radius;
      drawGunToGraphics(
        this.graphics,
        gun,
        x,
        y,
        size,
        attachment.color,
        attachment.mirror,
        attachment.rotationRad,
      );
    }
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
