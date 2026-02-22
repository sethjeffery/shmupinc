import type { GunDefinition } from "../data/gunTypes";
import type { ModDefinition } from "../data/modTypes";
import type { MountedWeapon } from "../data/save";
import type { BulletSpec } from "../data/scripts";
import type { ShipDefinition, WeaponMount } from "../data/shipTypes";
import type { EnemyOverride, Spawn, WaveDefinition } from "../data/waves";
import type { WeaponDefinition } from "../data/weaponTypes";
import type { EmitBullet } from "../systems/FireScriptRunner";

import Phaser from "phaser";

import { resolveEnemyDefinition, type EnemyDef } from "../data/enemies";
import { resolveShipHitbox, resolveShipRadius } from "../data/shipTypes";
import {
  normalizeMountMods,
  resolveWeaponStatsWithMods,
} from "../data/weaponMods";
import { canMountWeapon } from "../data/weaponMounts";
import { Bullet, type BulletUpdateContext } from "../entities/Bullet";
import { Enemy } from "../entities/Enemy";
import { Ship } from "../entities/Ship";
import { DEFAULT_ENEMY_VECTOR } from "../render/enemyShapes";
import { drawGunToGraphics } from "../render/gunShapes";
import { DEFAULT_SHIP_VECTOR } from "../render/shipShapes";
import { ParallaxBackground } from "../systems/Parallax";
import { ParticleSystem } from "../systems/Particles";
import { updatePlayerBulletsRuntime } from "../systems/play/BulletRuntime";
import {
  getBulletExplosionInfo,
  spawnBulletExplosionFx,
  spawnBulletTrail,
} from "../systems/play/BulletVisualFx";
import { PlayerFiring } from "../systems/PlayerFiring";
import { PLAYFIELD_BASE_HEIGHT, PLAYFIELD_BASE_WIDTH } from "../util/playArea";
import { ObjectPool } from "../util/pool";

type PreviewMode = "enemy" | "wave" | "weapon" | null;

const EXIT_MARGIN = 70;
const LOOP_DELAY_MS = 600;
const PLAYER_Y_RATIO = 0.84;
const WEAPON_PREVIEW_ZOOM = 2;
const WEAPON_PREVIEW_DUMMY_HP = 14;
const WEAPON_PREVIEW_GUN_RADIUS = 17;
const WEAPON_PREVIEW_GUN_SIZE = WEAPON_PREVIEW_GUN_RADIUS * 0.58;
const WEAPON_PREVIEW_GUN_COLOR = 0x7df9ff;

const createWeaponPreviewDummy = (id: string): EnemyDef => ({
  fire: { loop: false, steps: [] },
  goldDrop: { max: 0, min: 0 },
  hitbox: { kind: "circle", radius: 14 },
  hp: WEAPON_PREVIEW_DUMMY_HP,
  id,
  move: {
    loop: true,
    steps: [{ durationMs: 2400, kind: "hover" }],
  },
  radius: 14,
  style: {
    vector: DEFAULT_ENEMY_VECTOR,
  },
});

const WEAPON_PREVIEW_DUMMIES: { def: EnemyDef; x: number; y: number }[] = [
  {
    def: createWeaponPreviewDummy("previewDummyA"),
    x: -0.24,
    y: 0.33,
  },
  {
    def: createWeaponPreviewDummy("previewDummyB"),
    x: 0.02,
    y: 0.36,
  },
  {
    def: createWeaponPreviewDummy("previewDummyC"),
    x: 0.18,
    y: 0.34,
  },
];
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
  private weaponPreviewGun?: Phaser.GameObjects.Graphics;
  private mountedWeapons: MountedWeapon[] = [];
  private weaponPreviewType: "gun" | "ship" = "ship";
  private weaponGunDef: GunDefinition | null = null;
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
        mountId?: string;
        mods?: ModDefinition[];
      }
    | {
        mode: "weaponGun";
        weapon: WeaponDefinition;
        gun: GunDefinition;
        mods?: ModDefinition[];
      }
    | { mode: null }
    | null = null;

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
      hitbox: { kind: "circle", radius: 17 },
      maxHp: 6,
      moveSpeed: 0,
      radius: 17,
      vector: DEFAULT_SHIP_VECTOR,
    });
    this.playerShip.graphics.setDepth(8);
    this.playerShip.graphics.setVisible(false);
    this.weaponPreviewGun = this.add.graphics();
    this.weaponPreviewGun.setDepth(8);
    this.weaponPreviewGun.setVisible(false);
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
        this.setWeapon(
          payload.weapon,
          payload.ship,
          payload.mountId,
          payload.mods,
        );
      } else if (payload.mode === "weaponGun") {
        this.setWeaponGun(payload.weapon, payload.gun, payload.mods);
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
      this.updateEnemies(deltaMs);
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
    mountId?: string,
    mods?: ModDefinition[],
  ): void {
    this.setWeaponPreview(weapon, ship, mountId, mods);
  }

  setWeaponGun(
    weapon: WeaponDefinition,
    gun: GunDefinition,
    mods?: ModDefinition[],
  ): void {
    this.setWeaponGunPreview(weapon, gun, mods);
  }

  private setWeaponPreview(
    weapon: WeaponDefinition,
    ship: ShipDefinition,
    mountId?: string,
    mods?: ModDefinition[],
  ): void {
    if (!this.ready) {
      this.pendingPayload = {
        mode: "weapon",
        mods,
        mountId,
        ship,
        weapon,
      };
      return;
    }
    this.mode = "weapon";
    this.weaponPreviewType = "ship";
    this.weaponGunDef = null;
    const mount = this.getPreviewMount(weapon, ship, mountId);
    const normalizedMods = normalizeMountMods(mods ?? []).slice(
      0,
      mount?.modSlots ?? 0,
    );
    this.mountedWeapons = mount
      ? [
          {
            instanceId: "__preview__",
            mods: normalizedMods,
            mount,
            stats: resolveWeaponStatsWithMods(weapon, normalizedMods),
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
    this.spawnWeaponPreviewDummies();
    this.showWeaponPreview(true);
    this.applyWeaponZoom();
  }

  private setWeaponGunPreview(
    weapon: WeaponDefinition,
    gun: GunDefinition,
    mods?: ModDefinition[],
  ): void {
    if (!this.ready) {
      this.pendingPayload = {
        gun,
        mode: "weaponGun",
        mods,
        weapon,
      };
      return;
    }
    this.mode = "weapon";
    this.weaponPreviewType = "gun";
    this.weaponGunDef = gun;
    const normalizedMods = normalizeMountMods(mods ?? []);
    const mount: WeaponMount = {
      id: "__preview_mount__",
      modSlots: normalizedMods.length,
      offset: { x: 0, y: 0 },
      size: weapon.size,
    };
    this.mountedWeapons = [
      {
        instanceId: "__preview__",
        mods: normalizedMods,
        mount,
        stats: resolveWeaponStatsWithMods(weapon, normalizedMods),
        weapon,
      },
    ];
    this.shipDef = null;
    this.enemyDef = null;
    this.waveSpawns = [];
    this.spawnCursor = 0;
    this.elapsedMs = 0;
    this.loopDelayMs = 0;
    this.playerFiring.reset();
    this.clearEntities();
    this.spawnWeaponPreviewDummies();
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
    this.weaponPreviewType = "ship";
    this.weaponGunDef = null;
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
    mountId?: string,
  ): null | WeaponMount {
    if (mountId) {
      const match = ship.mounts.find(
        (mount) => mount.id === mountId && canMountWeapon(weapon, mount),
      );
      if (match) return match;
    }
    const compatible = ship.mounts.find((mount) =>
      canMountWeapon(weapon, mount),
    );
    if (compatible) return compatible;
    return {
      id: "__preview_mount__",
      modSlots: 0,
      offset: { x: 0, y: -0.4 },
      size: weapon.size,
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
    const origin = this.getWeaponPreviewOrigin();
    this.playerMarker.setPosition(origin.x, origin.y);
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
    const origin = this.getWeaponPreviewOrigin();
    const ship = this.playerShip;
    const playerRadius =
      this.weaponPreviewType === "ship" && ship
        ? ship.radius
        : WEAPON_PREVIEW_GUN_RADIUS;
    const playerHitbox =
      this.weaponPreviewType === "ship" && ship
        ? ship.hitbox
        : { kind: "circle" as const, radius: WEAPON_PREVIEW_GUN_RADIUS };
    updatePlayerBulletsRuntime(delta, {
      bulletContext: this.bulletContext,
      emitTrail: this.emitMissileTrail,
      enemies: this.enemies,
      enemyBullets: this.enemyBullets,
      handleExplosion: (x, y, spec, owner) =>
        this.handleBulletExplosion(x, y, spec, owner),
      onDamagePlayer: () => undefined,
      onEnemyKilled: (enemyIndex) => this.releaseEnemy(enemyIndex),
      playArea: this.bounds,
      playerAlive: true,
      playerBullets: this.playerBullets,
      playerHitbox,
      playerRadius,
      playerX: origin.x,
      playerY: origin.y,
    });
  }

  private updateWeaponPreview(delta: number): void {
    if (this.mountedWeapons.length === 0) return;
    const origin = this.getWeaponPreviewOrigin();
    const ship = this.playerShip;
    const playerRadius =
      this.weaponPreviewType === "ship" && ship
        ? ship.radius
        : WEAPON_PREVIEW_GUN_RADIUS;
    if (this.weaponPreviewType === "ship" && ship) {
      ship.setPosition(origin.x, origin.y);
    } else {
      this.drawWeaponPreviewGun(origin.x, origin.y);
    }
    this.playerFiring.update(
      delta,
      origin.x,
      origin.y,
      playerRadius,
      this.mountedWeapons,
      this.emitPlayerBullet,
      true,
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

  private spawnWeaponPreviewDummies(): void {
    if (this.mode !== "weapon") return;
    for (const dummy of WEAPON_PREVIEW_DUMMIES) {
      this.spawnEnemy(dummy.def, dummy.x, dummy.y);
    }
  }

  private spawnEnemy(
    base: EnemyDef,
    xNorm: number,
    yNorm: number,
    overrides?: EnemyOverride,
  ): void {
    const def = resolveEnemyDefinition(base, overrides);
    const x = this.bounds.x + (0.5 + xNorm) * this.bounds.width;
    const y = this.bounds.y + yNorm * this.bounds.height;
    const enemy =
      this.enemyPool.pop() ??
      new Enemy(this, def, x, y, this.bounds.width, this.bounds.height);
    enemy.setPlayfieldSize(this.bounds.width, this.bounds.height);
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
    if (this.mode === "weapon") {
      return this.enemies.length === 0 && !this.hasActiveBullets();
    }
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
      return;
    }
    if (this.mode === "weapon") {
      this.spawnWeaponPreviewDummies();
    }
  }

  private getWeaponPreviewOrigin(): { x: number; y: number } {
    return {
      x: this.bounds.width * 0.5,
      y: this.bounds.height * PLAYER_Y_RATIO,
    };
  }

  private drawWeaponPreviewGun(x: number, y: number): void {
    if (!this.weaponPreviewGun || !this.weaponGunDef) return;
    const mounted = this.mountedWeapons[0];
    const color = mounted?.stats.bullet.color ?? WEAPON_PREVIEW_GUN_COLOR;
    const angleRad = ((mounted?.stats.angleDeg ?? 0) * Math.PI) / 180;
    this.weaponPreviewGun.clear();
    drawGunToGraphics(
      this.weaponPreviewGun,
      this.weaponGunDef,
      0,
      0,
      WEAPON_PREVIEW_GUN_SIZE,
      color,
      false,
      angleRad,
    );
    this.weaponPreviewGun.setPosition(x, y);
  }

  private showWeaponPreview(show: boolean): void {
    if (this.playerMarker) {
      this.playerMarker.setVisible(!show);
    }
    if (this.playerShip) {
      const showShip = show && this.weaponPreviewType === "ship";
      this.playerShip.graphics.setVisible(showShip);
      if (showShip && this.shipDef) {
        const radius = resolveShipRadius(this.shipDef);
        this.playerShip.setAppearance(this.shipDef.vector);
        this.playerShip.setHitbox(resolveShipHitbox(this.shipDef));
        this.playerShip.setRadius(radius);
        this.playerShip.setMountedWeapons(this.mountedWeapons);
      }
    }
    if (this.weaponPreviewGun) {
      const showGun = show && this.weaponPreviewType === "gun";
      this.weaponPreviewGun.setVisible(showGun);
      if (showGun) {
        const origin = this.getWeaponPreviewOrigin();
        this.drawWeaponPreviewGun(origin.x, origin.y);
      } else {
        this.weaponPreviewGun.clear();
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
    const origin = this.getWeaponPreviewOrigin();
    camera.centerOn(origin.x, origin.y);
  }
}
