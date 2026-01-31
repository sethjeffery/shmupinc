import type { EnemyDef } from "../data/enemies";
import type { MountedWeapon } from "../data/save";
import type { BulletSpec } from "../data/scripts";
import type { ShipDefinition, WeaponMount } from "../data/shipTypes";
import type { EnemyOverride, Spawn, WaveDefinition } from "../data/waves";
import type { WeaponDefinition, WeaponZone } from "../data/weaponTypes";
import type { EmitBullet } from "../systems/FireScriptRunner";

import Phaser from "phaser";

import { canMountWeapon, resolveWeaponStats } from "../data/weaponMounts";
import { Bullet, type BulletUpdateContext } from "../entities/Bullet";
import { Enemy } from "../entities/Enemy";
import { Ship } from "../entities/Ship";
import { ParallaxBackground } from "../systems/Parallax";
import { ParticleSystem } from "../systems/Particles";
import { PlayerFiring } from "../systems/PlayerFiring";
import { PLAYFIELD_BASE_HEIGHT, PLAYFIELD_BASE_WIDTH } from "../util/playArea";
import { ObjectPool } from "../util/pool";

type PreviewMode = "enemy" | "wave" | "weapon" | null;

const EXIT_MARGIN = 70;
const LOOP_DELAY_MS = 600;
const PLAYER_Y_RATIO = 0.84;
const WEAPON_PREVIEW_ZOOM = 2;
export class ContentPreviewScene extends Phaser.Scene {
  private bounds = new Phaser.Geom.Rectangle(
    0,
    0,
    PLAYFIELD_BASE_WIDTH,
    PLAYFIELD_BASE_HEIGHT,
  );
  private parallax!: ParallaxBackground;
  private particles!: ParticleSystem;
  private enemyBullets!: ObjectPool<Bullet>;
  private playerBullets!: ObjectPool<Bullet>;
  private enemies: Enemy[] = [];
  private enemyPool: Enemy[] = [];
  private playerMarker?: Phaser.GameObjects.Graphics;
  private playerShip?: Ship;
  private mountedWeapons: MountedWeapon[] = [];
  private shipDef: null | ShipDefinition = null;
  private playerFiring = new PlayerFiring();
  private bulletContext: BulletUpdateContext = {
    enemies: [],
    playerAlive: true,
    playerX: 0,
    playerY: 0,
  };
  private mode: PreviewMode = null;
  private enemyDef: EnemyDef | null = null;
  private waveSpawns: Spawn[] = [];
  private spawnCursor = 0;
  private elapsedMs = 0;
  private loopDelayMs = 0;
  private enemiesById: Record<string, EnemyDef> = {};
  private ready = false;
  private pendingParentSize: { height: number; width: number } | null = null;
  private enemyEntered = new WeakMap<Enemy, boolean>();
  private pendingPayload:
    | { def: EnemyDef; mode: "enemy" }
    | {
        enemiesById: Record<string, EnemyDef>;
        mode: "wave";
        wave: WaveDefinition;
      }
    | {
        mode: "weapon";
        weapon: WeaponDefinition;
        ship: ShipDefinition;
        zone?: WeaponZone;
      }
    | { mode: null }
    | null = null;

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

  private emitEnemyBullet: EmitBullet = (x, y, angleRad, bullet) => {
    const enemyBullet = this.enemyBullets.acquire();
    enemyBullet.spawn(x, y, angleRad, bullet);
  };

  private emitPlayerBullet: EmitBullet = (x, y, angleRad, bullet) => {
    const playerBullet = this.playerBullets.acquire();
    playerBullet.spawn(x, y, angleRad, bullet);
  };

  constructor() {
    super("ContentPreviewScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#05060a");
    this.bounds.setTo(0, 0, PLAYFIELD_BASE_WIDTH, PLAYFIELD_BASE_HEIGHT);
    this.cameras.main.setBounds(0, 0, this.bounds.width, this.bounds.height);
    this.parallax = new ParallaxBackground(this, this.bounds);
    this.particles = new ParticleSystem(this);
    this.enemyBullets = new ObjectPool(
      () => new Bullet(this, { owner: "enemy" }),
      64,
    );
    this.playerBullets = new ObjectPool(
      () => new Bullet(this, { owner: "player" }),
      48,
    );
    this.playerMarker = this.add.graphics();
    this.playerMarker.setDepth(2);
    this.drawPlayerMarker();
    this.playerShip = new Ship(this, {
      color: 0x7df9ff,
      maxHp: 6,
      moveSpeed: 0,
      radius: 17,
      shape: "starling",
    });
    this.playerShip.graphics.setDepth(8);
    this.playerShip.graphics.setVisible(false);
    this.ready = true;
    if (this.pendingParentSize) {
      this.scale.setParentSize(
        this.pendingParentSize.width,
        this.pendingParentSize.height,
      );
      this.pendingParentSize = null;
    }
    if (this.pendingPayload) {
      const payload = this.pendingPayload;
      this.pendingPayload = null;
      if (payload.mode === "enemy") {
        this.setEnemy(payload.def);
      } else if (payload.mode === "wave") {
        this.setWave(payload.wave, payload.enemiesById);
      } else if (payload.mode === "weapon") {
        this.setWeapon(payload.weapon, payload.ship, payload.zone);
      } else {
        this.setMode(null);
      }
    }
  }

  update(_time: number, deltaMs: number): void {
    if (!this.mode) return;
    const delta = deltaMs / 1000;
    this.parallax.update(delta);
    this.particles.update(delta);
    this.updatePlayerMarker();

    if (this.loopDelayMs > 0) {
      this.loopDelayMs = Math.max(0, this.loopDelayMs - deltaMs);
      if (this.loopDelayMs === 0) {
        this.restartLoop();
      }
      return;
    }

    this.elapsedMs += deltaMs;
    if (this.mode === "weapon") {
      this.updateWeaponPreview(delta);
      this.updatePlayerBullets(delta);
      return;
    }

    if (this.mode === "wave") {
      this.spawnWave();
    }

    this.updateEnemies(deltaMs);
    this.updateEnemyBullets(delta);

    if (this.shouldLoop()) {
      this.loopDelayMs = LOOP_DELAY_MS;
    }
  }

  setEnemy(def: EnemyDef): void {
    if (!this.ready) {
      this.pendingPayload = { def, mode: "enemy" };
      return;
    }
    this.mode = "enemy";
    this.enemyDef = def;
    this.waveSpawns = [];
    this.spawnCursor = 0;
    this.elapsedMs = 0;
    this.loopDelayMs = 0;
    this.showWeaponPreview(false);
    this.clearEntities();
    this.spawnSingleEnemy();
    this.applyWeaponZoom();
  }

  setWave(wave: WaveDefinition, enemiesById: Record<string, EnemyDef>): void {
    if (!this.ready) {
      this.pendingPayload = { enemiesById, mode: "wave", wave };
      return;
    }
    this.mode = "wave";
    this.enemyDef = null;
    this.enemiesById = enemiesById;
    this.waveSpawns = [...wave.spawns].sort((a, b) => a.atMs - b.atMs);
    this.spawnCursor = 0;
    this.elapsedMs = 0;
    this.loopDelayMs = 0;
    this.showWeaponPreview(false);
    this.clearEntities();
    this.applyWeaponZoom();
  }

  setWeapon(
    weapon: WeaponDefinition,
    ship: ShipDefinition,
    zone?: WeaponZone,
  ): void {
    this.setWeaponPreview(weapon, ship, zone);
  }

  private setWeaponPreview(
    weapon: WeaponDefinition,
    ship: ShipDefinition,
    zone?: WeaponZone,
  ): void {
    if (!this.ready) {
      this.pendingPayload = {
        mode: "weapon",
        ship,
        weapon,
        zone,
      };
      return;
    }
    this.mode = "weapon";
    const mount = this.getPreviewMount(weapon, ship, zone);
    this.mountedWeapons = mount
      ? [
          {
            instanceId: "__preview__",
            mount,
            stats: resolveWeaponStats(weapon, mount.zone),
            weapon,
          },
        ]
      : [];
    this.shipDef = ship;
    this.enemyDef = null;
    this.waveSpawns = [];
    this.spawnCursor = 0;
    this.elapsedMs = 0;
    this.loopDelayMs = 0;
    this.playerFiring.reset();
    this.clearEntities();
    this.showWeaponPreview(true);
    this.applyWeaponZoom();
  }

  setMode(_mode = null): void {
    if (!this.ready) {
      this.pendingPayload = { mode: null };
      return;
    }
    this.mode = null;
    this.enemyDef = null;
    this.mountedWeapons = [];
    this.shipDef = null;
    this.waveSpawns = [];
    this.spawnCursor = 0;
    this.elapsedMs = 0;
    this.loopDelayMs = 0;
    this.clearEntities();
    this.showWeaponPreview(false);
    this.applyWeaponZoom();
  }

  setParentSize(width: number, height: number): void {
    if (width < 2 || height < 2) return;
    if (!this.ready) {
      this.pendingParentSize = { height, width };
      return;
    }
    this.scale.setParentSize(width, height);
    this.applyWeaponZoom();
  }

  private getPreviewMount(
    weapon: WeaponDefinition,
    ship: ShipDefinition,
    zone?: WeaponZone,
  ): null | WeaponMount {
    if (zone) {
      const match = ship.mounts.find(
        (mount) => mount.zone === zone && canMountWeapon(weapon, mount),
      );
      if (match) return match;
    }
    const compatible = ship.mounts.find((mount) =>
      canMountWeapon(weapon, mount),
    );
    if (compatible) return compatible;
    const fallbackZone = zone ?? weapon.zones[0] ?? "front";
    return {
      id: "__preview_mount__",
      offset: { x: 0, y: -0.4 },
      size: weapon.size,
      zone: fallbackZone,
    };
  }

  private drawPlayerMarker(): void {
    if (!this.playerMarker) return;
    this.playerMarker.clear();
    this.playerMarker.lineStyle(1, 0x7df9ff, 0.35);
    this.playerMarker.strokeCircle(0, 0, 12);
    this.playerMarker.strokeLineShape(new Phaser.Geom.Line(-18, 0, 18, 0));
  }

  private updatePlayerMarker(): void {
    if (!this.playerMarker) return;
    const playerX = this.bounds.width * 0.5;
    const playerY = this.bounds.height * PLAYER_Y_RATIO;
    this.playerMarker.setPosition(playerX, playerY);
  }

  private updateEnemies(deltaMs: number): void {
    const playerX = this.bounds.width * 0.5;
    const playerY = this.bounds.height * PLAYER_Y_RATIO;
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      enemy.update(deltaMs, playerX, playerY, true, this.emitEnemyBullet);
      const entered =
        enemy.x >= this.bounds.x &&
        enemy.x <= this.bounds.x + this.bounds.width &&
        enemy.y >= this.bounds.y &&
        enemy.y <= this.bounds.y + this.bounds.height;
      if (entered) {
        this.enemyEntered.set(enemy, true);
      }
      if (!enemy.active) {
        this.releaseEnemy(i);
        continue;
      }
      const offscreen =
        enemy.x < -EXIT_MARGIN ||
        enemy.x > this.bounds.width + EXIT_MARGIN ||
        enemy.y < -EXIT_MARGIN ||
        enemy.y > this.bounds.height + EXIT_MARGIN;
      const finished = enemy.isMoveFinished && enemy.finishedElapsedMs > 600;
      if ((this.enemyEntered.get(enemy) && offscreen) || finished) {
        this.releaseEnemy(i);
      }
    }
  }

  private updateEnemyBullets(delta: number): void {
    this.bulletContext.playerX = this.bounds.width * 0.5;
    this.bulletContext.playerY = this.bounds.height * PLAYER_Y_RATIO;
    this.bulletContext.enemies = this.enemies;
    this.enemyBullets.forEachActive((bullet) => {
      bullet.update(
        delta,
        this.bounds,
        this.bulletContext,
        this.emitMissileTrail,
        (x, y, spec, owner) => this.handleBulletExplosion(x, y, spec, owner),
      );
    });
  }

  private updatePlayerBullets(delta: number): void {
    const ship = this.playerShip;
    if (!ship) return;
    this.bulletContext.playerX = ship.x;
    this.bulletContext.playerY = ship.y;
    this.bulletContext.enemies = [];
    this.playerBullets.forEachActive((bullet) => {
      bullet.update(
        delta,
        this.bounds,
        this.bulletContext,
        this.emitMissileTrail,
        (x, y, spec, owner) => this.handleBulletExplosion(x, y, spec, owner),
      );
    });
  }

  private updateWeaponPreview(delta: number): void {
    const ship = this.playerShip;
    if (!ship || this.mountedWeapons.length === 0) return;
    const playerX = this.bounds.width * 0.5;
    const playerY = this.bounds.height * PLAYER_Y_RATIO;
    ship.setPosition(playerX, playerY);
    this.playerFiring.update(
      delta,
      ship.x,
      ship.y,
      ship.radius,
      this.mountedWeapons,
      this.emitPlayerBullet,
    );
  }

  private getPreviewSpawn(_def: EnemyDef): { x: number; y: number } {
    return { x: 0, y: -0.1 };
  }

  private spawnSingleEnemy(): void {
    if (!this.enemyDef) return;
    const spawn = this.getPreviewSpawn(this.enemyDef);
    this.spawnEnemy(this.enemyDef, spawn.x, spawn.y);
  }

  private spawnWave(): void {
    while (this.spawnCursor < this.waveSpawns.length) {
      const spawn = this.waveSpawns[this.spawnCursor];
      if (spawn.atMs > this.elapsedMs) break;
      const def = this.enemiesById[spawn.enemyId];
      if (def) {
        this.spawnEnemy(def, spawn.x, spawn.y, spawn.overrides);
      }
      this.spawnCursor += 1;
    }
  }

  private spawnEnemy(
    base: EnemyDef,
    xNorm: number,
    yNorm: number,
    overrides?: EnemyOverride,
  ): void {
    const def = overrides ? { ...base, ...overrides } : base;
    def.move ??= base.move;
    def.fire ??= base.fire;
    def.goldDrop ??= base.goldDrop;
    def.radius ??= base.radius;
    def.phases ??= base.phases;
    def.style ??= base.style;
    def.rotation ??= base.rotation;
    def.rotationDeg ??= base.rotationDeg;
    const x = this.bounds.x + (0.5 + xNorm) * this.bounds.width;
    const y = this.bounds.y + yNorm * this.bounds.height;
    const enemy = this.enemyPool.pop() ?? new Enemy(this, def, x, y);
    enemy.reset(def, x, y, 1);
    this.enemyEntered.set(enemy, false);
    this.enemies.push(enemy);
  }

  private releaseEnemy(index: number): void {
    const enemy = this.enemies[index];
    enemy.deactivate();
    this.enemyEntered.delete(enemy);
    this.enemies.splice(index, 1);
    this.enemyPool.push(enemy);
  }

  private clearEntities(): void {
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      this.releaseEnemy(i);
    }
    this.enemyBullets.forEachActive((bullet) => bullet.deactivate());
    this.playerBullets.forEachActive((bullet) => bullet.deactivate());
  }

  private hasActiveBullets(): boolean {
    let active = false;
    this.enemyBullets.forEachActive(() => {
      active = true;
    });
    this.playerBullets.forEachActive(() => {
      active = true;
    });
    return active;
  }

  private shouldLoop(): boolean {
    if (this.enemies.length > 0) return false;
    if (this.hasActiveBullets()) return false;
    if (this.mode === "enemy") {
      return this.elapsedMs > 0;
    }
    return this.spawnCursor >= this.waveSpawns.length;
  }

  private restartLoop(): void {
    this.elapsedMs = 0;
    this.spawnCursor = 0;
    this.clearEntities();
    if (this.mode === "enemy") {
      this.spawnSingleEnemy();
    }
  }

  private showWeaponPreview(show: boolean): void {
    if (this.playerMarker) {
      this.playerMarker.setVisible(!show);
    }
    if (this.playerShip) {
      this.playerShip.graphics.setVisible(show);
      if (show && this.shipDef) {
        const radius = 17 * (this.shipDef.radiusMultiplier ?? 1);
        this.playerShip.setAppearance(
          this.shipDef.color,
          this.shipDef.vector ?? this.shipDef.shape,
        );
        this.playerShip.setRadius(radius);
        this.playerShip.setMountedWeapons(this.mountedWeapons);
      }
    }
  }

  private applyWeaponZoom(): void {
    const camera = this.cameras.main;
    if (this.mode !== "weapon") {
      camera.setZoom(1);
      camera.scrollX = 0;
      camera.scrollY = 0;
      return;
    }
    const zoom = WEAPON_PREVIEW_ZOOM;
    camera.setZoom(zoom);
    const ship = this.playerShip;
    const worldX = ship?.x ?? this.bounds.width * 0.5;
    const worldY = ship?.y ?? this.bounds.height * PLAYER_Y_RATIO;
    camera.centerOn(worldX, worldY);
  }
}
