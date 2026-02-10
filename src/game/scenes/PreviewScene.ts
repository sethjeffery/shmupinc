import type { MountedWeapon } from "../data/save";
import type { BulletSpec } from "../data/scripts";
import type { ShipDefinition } from "../data/ships";
import type { EmitBullet } from "../systems/FireScriptRunner";

import Phaser from "phaser";

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
      color: 0x7df9ff,
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
    this.ship.setPosition(this.scale.width * 0.5, this.scale.height * 0.72);
    this.updateFiring(delta);
    this.updateBullets(delta);
  }

  setLoadout(mountedWeapons: MountedWeapon[], ship: ShipDefinition): void {
    if (!this.ready) {
      this.pendingLoadout = { mountedWeapons, ship };
      return;
    }
    this.mountedWeapons = mountedWeapons;
    this.currentShip = ship;
    this.ship.setAppearance(ship.color, ship.vector);
    this.ship.setRadius(this.baseRadius * (ship.radiusMultiplier ?? 1));
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
    if (this.currentShip) {
      this.ship.setRadius(
        this.baseRadius * (this.currentShip.radiusMultiplier ?? 1),
      );
    } else {
      this.ship.setRadius(this.baseRadius);
    }
    this.ship.setPosition(width * 0.5, height * 0.72);
  }

  private updateFiring(delta: number): void {
    this.playerFiring.update(
      delta,
      this.ship.x,
      this.ship.y,
      this.ship.radius,
      this.mountedWeapons,
      this.emitPlayerBullet,
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
}
