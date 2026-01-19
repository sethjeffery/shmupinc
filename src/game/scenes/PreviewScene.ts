import type { BulletSpec } from "../data/scripts";
import type { SecondaryWeaponDefinition } from "../data/secondaryWeapons";
import type { ShipDefinition } from "../data/ships";
import type { WeaponDefinition } from "../data/weapons";
import type { EmitBullet } from "../systems/FireScriptRunner";

import Phaser from "phaser";

import { Bullet, type BulletUpdateContext } from "../entities/Bullet";
import { Ship } from "../entities/Ship";
import { ParallaxBackground } from "../systems/Parallax";
import { ParticleSystem } from "../systems/Particles";
import { PlayerFiring } from "../systems/PlayerFiring";
import { ObjectPool } from "../util/pool";

export class PreviewScene extends Phaser.Scene {
  private ship!: Ship;
  private baseRadius = 14;
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
  private primaryWeapon: null | WeaponDefinition = null;
  private secondaryWeapon: null | SecondaryWeaponDefinition = null;
  private playerFiring = new PlayerFiring();
  private ready = false;
  private pendingLoadout?: {
    primary: WeaponDefinition;
    secondary: null | SecondaryWeaponDefinition;
    ship: ShipDefinition;
  };

  private emitMissileTrail = (
    x: number,
    y: number,
    _angleRad: number,
    spec: BulletSpec,
  ): void => {
    const trail = spec.trail;
    if (!trail) return;
    this.particles.spawnTrail(
      x,
      y,
      trail.color ?? spec.color ?? 0x7df9ff,
      trail.sizeMin,
      trail.sizeMax,
      trail.count,
    );
  };

  private handleBulletExplosion = (
    x: number,
    y: number,
    spec: BulletSpec,
    owner: "enemy" | "player",
  ): void => {
    const aoe = spec.aoe;
    const radius = aoe?.radius ?? spec.radius * 3;
    const color = spec.color ?? (owner === "player" ? 0x7df9ff : 0xff9f43);
    this.particles.spawnBurst(x, y, 18, color);
    this.particles.spawnRing(x, y, radius, color);
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
      shape: "starling",
    });
    this.ship.setPosition(this.scale.width * 0.5, this.scale.height * 0.72);
    this.bullets = new ObjectPool(
      () => new Bullet(this, { owner: "player" }),
      24,
    );
    this.ready = true;
    if (this.pendingLoadout) {
      this.setLoadout(
        this.pendingLoadout.primary,
        this.pendingLoadout.secondary,
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
    if (!this.ready || !this.primaryWeapon) return;
    const delta = deltaMs / 1000;
    this.parallax.update(delta);
    this.particles.update(delta);
    this.ship.setPosition(this.scale.width * 0.5, this.scale.height * 0.72);
    this.updateFiring(delta);
    this.updateBullets(delta);
  }

  setLoadout(
    primary: WeaponDefinition,
    secondary: null | SecondaryWeaponDefinition,
    ship: ShipDefinition,
  ): void {
    if (!this.ready) {
      this.pendingLoadout = { primary, secondary, ship };
      return;
    }
    this.primaryWeapon = primary;
    this.secondaryWeapon = secondary;
    this.currentShip = ship;
    this.ship.setAppearance(ship.color, ship.shape);
    this.ship.setRadius(this.baseRadius * (ship.radiusMultiplier ?? 1));
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
      this.ship.setRadius(this.baseRadius * (this.currentShip.radiusMultiplier ?? 1));
    } else {
      this.ship.setRadius(this.baseRadius);
    }
    this.ship.setPosition(width * 0.5, height * 0.72);
  }

  private updateFiring(delta: number): void {
    if (!this.primaryWeapon) return;
    this.playerFiring.update(
      delta,
      this.ship.x,
      this.ship.y,
      this.ship.radius,
      this.primaryWeapon,
      this.secondaryWeapon,
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
