import type { MountedWeapon } from "../data/save";
import type { BulletSpec } from "../data/scripts";
import type { ShipDefinition } from "../data/ships";
import type { EmitBullet } from "../systems/FireScriptRunner";

import Phaser from "phaser";

import { resolveShipHitbox, resolveShipRadius } from "../data/shipTypes";
import { Bullet, type BulletUpdateContext } from "../entities/Bullet";
import { Ship } from "../entities/Ship";
import { DEFAULT_SHIP_VECTOR } from "../render/shipShapes";
import { ParallaxBackground } from "../systems/Parallax";
import { ParticleSystem } from "../systems/Particles";
import {
  getBulletExplosionInfo,
  spawnBulletExplosionFx,
  spawnBulletTrail,
} from "../systems/play/BulletVisualFx";
import { PlayerFiring } from "../systems/PlayerFiring";
import { ObjectPool } from "../util/pool";

interface PreviewPresentation {
  fireEnabled: boolean;
  shipScale: number;
  shipX: number;
  shipY: number;
}

const DEFAULT_PRESENTATION: PreviewPresentation = {
  fireEnabled: true,
  shipScale: 1,
  shipX: 0.5,
  shipY: 0.72,
};

export class PreviewScene extends Phaser.Scene {
  private ship!: Ship;
  private baseRadius = 17;
  private currentShip?: ShipDefinition;
  private pendingResize?: { height: number; width: number };
  private bullets!: ObjectPool<Bullet>;
  private parallax!: ParallaxBackground;
  private particles!: ParticleSystem;
  private bounds = new Phaser.Geom.Rectangle();
  private bulletContext: BulletUpdateContext = {
    enemies: [],
    playerAlive: true,
    playerX: 0,
    playerY: 0,
  };
  private mountedWeapons: MountedWeapon[] = [];
  private playerFiring = new PlayerFiring();
  private ready = false;
  private pendingLoadout?: {
    mountedWeapons: MountedWeapon[];
    ship: ShipDefinition;
  };
  private presentation: PreviewPresentation = { ...DEFAULT_PRESENTATION };
  private pendingPresentation?: PreviewPresentation;

  private emitMissileTrail = (
    x: number,
    y: number,
    _angleRad: number,
    spec: BulletSpec,
  ): void => {
    spawnBulletTrail(this.particles, x, y, spec);
  };

  private handleBulletExplosion = (
    x: number,
    y: number,
    spec: BulletSpec,
    owner: "enemy" | "player",
  ): void => {
    const explosion = getBulletExplosionInfo(spec, owner);
    spawnBulletExplosionFx(this.particles, x, y, explosion, 18);
  };

  private emitPlayerBullet: EmitBullet = (x, y, angleRad, bullet) => {
    const playerBullet = this.bullets.acquire();
    playerBullet.spawn(x, y, angleRad, bullet);
  };

  constructor() {
    super("PreviewScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#05060a");
    this.bounds.setTo(0, 0, this.scale.width, this.scale.height);
    this.parallax = new ParallaxBackground(this, this.bounds);
    this.particles = new ParticleSystem(this);
    this.ship = new Ship(this, {
      hitbox: { kind: "circle", radius: this.baseRadius },
      maxHp: 6,
      moveSpeed: 0,
      radius: this.baseRadius,
      vector: DEFAULT_SHIP_VECTOR,
    });
    this.ship.setPosition(this.scale.width * 0.5, this.scale.height * 0.72);
    this.bullets = new ObjectPool(
      () => new Bullet(this, { owner: "player" }),
      24,
    );
    this.ready = true;
    if (this.pendingPresentation) {
      this.applyPresentation(this.pendingPresentation);
      this.pendingPresentation = undefined;
    }
    if (this.pendingLoadout) {
      this.setLoadout(
        this.pendingLoadout.mountedWeapons,
        this.pendingLoadout.ship,
      );
      this.pendingLoadout = undefined;
    }
    if (this.pendingResize) {
      this.resize(this.pendingResize.width, this.pendingResize.height);
      this.pendingResize = undefined;
    }
  }

  update(_time: number, deltaMs: number): void {
    if (!this.ready) return;
    const delta = deltaMs / 1000;
    this.parallax.update(delta);
    this.particles.update(delta);
    this.ship.setPosition(
      this.scale.width * this.presentation.shipX,
      this.scale.height * this.presentation.shipY,
    );
    this.updateFiring(delta);
    this.updateBullets(delta);
  }

  setPresentation(presentation: Partial<PreviewPresentation>): void {
    const next = this.mergePresentation(this.presentation, presentation);
    if (!this.ready) {
      this.pendingPresentation = next;
      return;
    }
    this.applyPresentation(next);
  }

  setLoadout(mountedWeapons: MountedWeapon[], ship: ShipDefinition): void {
    if (!this.ready) {
      this.pendingLoadout = { mountedWeapons, ship };
      return;
    }
    this.mountedWeapons = mountedWeapons;
    this.currentShip = ship;
    this.ship.setAppearance(ship.vector);
    const scaledBaseRadius = this.getScaledBaseRadius();
    this.ship.setRadius(resolveShipRadius(ship, scaledBaseRadius));
    this.ship.setHitbox(resolveShipHitbox(ship, scaledBaseRadius));
    this.ship.setMountedWeapons(this.mountedWeapons);
    this.playerFiring.reset();
    this.bullets.forEachActive((bullet) => bullet.deactivate());
  }

  resize(width: number, height: number): void {
    if (!this.ready) {
      this.pendingResize = { height, width };
      return;
    }
    this.scale.resize(width, height);
    this.cameras.main.setSize(width, height);
    this.bounds.setTo(0, 0, width, height);
    this.parallax.setBounds(this.bounds);
    const scaledBaseRadius = this.getScaledBaseRadius();
    if (this.currentShip) {
      this.ship.setRadius(
        resolveShipRadius(this.currentShip, scaledBaseRadius),
      );
      this.ship.setHitbox(
        resolveShipHitbox(this.currentShip, scaledBaseRadius),
      );
    } else {
      this.ship.setRadius(scaledBaseRadius);
      this.ship.setHitbox({ kind: "circle", radius: scaledBaseRadius });
    }
    this.ship.setPosition(
      width * this.presentation.shipX,
      height * this.presentation.shipY,
    );
  }

  private updateFiring(delta: number): void {
    if (!this.presentation.fireEnabled) return;
    this.playerFiring.update(
      delta,
      this.ship.x,
      this.ship.y,
      this.ship.radius,
      this.mountedWeapons,
      this.emitPlayerBullet,
      true,
    );
  }

  private updateBullets(delta: number): void {
    this.bulletContext.playerX = this.ship.x;
    this.bulletContext.playerY = this.ship.y;
    this.bullets.forEachActive((bullet) => {
      bullet.update(
        delta,
        this.bounds,
        this.bulletContext,
        this.emitMissileTrail,
        this.handleBulletExplosion,
      );
    });
  }

  private applyPresentation(presentation: PreviewPresentation): void {
    const modeChanged =
      this.presentation.fireEnabled !== presentation.fireEnabled ||
      this.presentation.shipScale !== presentation.shipScale;
    this.presentation = presentation;
    this.ship.setStrokeWidth(
      Math.max(1, 0.5 + this.presentation.shipScale * 0.5),
    );
    const scaledBaseRadius = this.getScaledBaseRadius();
    if (this.currentShip) {
      this.ship.setRadius(
        resolveShipRadius(this.currentShip, scaledBaseRadius),
      );
      this.ship.setHitbox(
        resolveShipHitbox(this.currentShip, scaledBaseRadius),
      );
    } else {
      this.ship.setRadius(scaledBaseRadius);
      this.ship.setHitbox({ kind: "circle", radius: scaledBaseRadius });
    }
    this.ship.setPosition(
      this.scale.width * this.presentation.shipX,
      this.scale.height * this.presentation.shipY,
    );
    if (modeChanged) {
      this.playerFiring.reset();
      this.bullets.forEachActive((bullet) => bullet.deactivate());
    }
  }

  private mergePresentation(
    current: PreviewPresentation,
    next: Partial<PreviewPresentation>,
  ): PreviewPresentation {
    return {
      fireEnabled: next.fireEnabled ?? current.fireEnabled,
      shipScale: Math.max(0.2, next.shipScale ?? current.shipScale),
      shipX: Phaser.Math.Clamp(next.shipX ?? current.shipX, 0.1, 0.9),
      shipY: Phaser.Math.Clamp(next.shipY ?? current.shipY, 0.2, 0.9),
    };
  }

  private getScaledBaseRadius(): number {
    return this.baseRadius * this.presentation.shipScale;
  }
}
