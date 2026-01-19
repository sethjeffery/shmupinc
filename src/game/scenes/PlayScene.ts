import type { BulletSpec } from "../data/scripts";
import type { SecondaryWeaponDefinition } from "../data/secondaryWeapons";
import type { EmitBullet } from "../systems/FireScriptRunner";

import Phaser from "phaser";

import { DEBUG_PLAYER_BULLETS } from "../data/bullets";
import { ENEMIES } from "../data/enemies";
import { bankGold, computePlayerStats } from "../data/save";
import {
  BOSS_WAVE_INTERVAL,
  WAVE_FACTORY_PACK,
  augmentWaveDefinition,
  buildBossWave,
  mirrorWaveDefinition,
  type WaveIntensity,
} from "../data/waveFactories";
import {
  WAVES,
  type EnemyOverride,
  type Spawn,
  type WaveDefinition,
} from "../data/waves";
import { STARTER_WEAPON_ID, WEAPONS, type WeaponId } from "../data/weapons";
import { Bullet, type BulletUpdateContext } from "../entities/Bullet";
import { Enemy } from "../entities/Enemy";
import { PickupGold } from "../entities/PickupGold";
import { Ship } from "../entities/Ship";
import { circleOverlap } from "../systems/Collision";
import { ParallaxBackground } from "../systems/Parallax";
import { ParticleSystem } from "../systems/Particles";
import { PlayerFiring } from "../systems/PlayerFiring";
import { HUD } from "../ui/HUD";
import { computePlayArea, PLAYFIELD_CORNER_RADIUS } from "../util/playArea";
import { ObjectPool } from "../util/pool";

const PADDING = 0.05;
const MAGNET_RADIUS = 120;
const FINISH_LINGER_MS = 2400;
const EXIT_DASH_MS = 700;
const SHIP_REGEN_PER_SEC = 0.1;
const LOW_HEALTH_THRESHOLD = 0.25;
const CRITICAL_HEALTH_THRESHOLD = 0.1;

export class PlayScene extends Phaser.Scene {
  private hud!: HUD;
  private ship!: Ship;
  private playArea = new Phaser.Geom.Rectangle();
  private playAreaFrame?: Phaser.GameObjects.Graphics;
  private pointerActive = false;
  private target = new Phaser.Math.Vector2();
  private defaultTarget = new Phaser.Math.Vector2();
  private playerBullets!: ObjectPool<Bullet>;
  private enemyBullets!: ObjectPool<Bullet>;
  private goldPickups!: ObjectPool<PickupGold>;
  private weaponId: WeaponId = STARTER_WEAPON_ID;
  private playerWeapon = WEAPONS[STARTER_WEAPON_ID];
  private secondaryWeapon: null | SecondaryWeaponDefinition = null;
  private magnetMultiplier = 1;
  private debugBulletSpec?: BulletSpec;
  private gameOverTimer?: Phaser.Time.TimerEvent;
  private overlayShown = false;
  private waveEvents: Spawn[] = [];
  private waveEventCursor = 0;
  private currentWaveDifficulty = 1;
  private lastFactoryIntensity?: WaveIntensity;

  private enemies: Enemy[] = [];
  private enemyPool: Enemy[] = [];
  private waveIndex = 0;
  private waveTimer = 0;
  private isGameOver = false;
  private gold = 0;
  private hitCooldown = 0;
  private goldBanked = false;
  private shipAlive = true;
  private bossTimerMs = 0;
  private bossActive = false;
  private healthPulseTime = 0;
  private healthPulseStrength = 0;
  private touchOffsetY = 0;
  private bulletContext: BulletUpdateContext = {
    enemies: [],
    playerAlive: false,
    playerX: 0,
    playerY: 0,
  };
  private emitPlayerBullet: EmitBullet = (x, y, angleRad, bullet) => {
    const playerBullet = this.playerBullets.acquire();
    playerBullet.spawn(x, y, angleRad, bullet);
  };
  private emitEnemyBullet: EmitBullet = (x, y, angleRad, bullet) => {
    const enemyBullet = this.enemyBullets.acquire();
    enemyBullet.spawn(x, y, angleRad, bullet);
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
    const damage = aoe?.damage ?? spec.damage;
    const color = spec.color ?? (owner === "player" ? 0x7df9ff : 0xff9f43);
    this.particles.spawnBurst(x, y, 24, color);
    this.particles.spawnRing(x, y, radius, color);
    if (owner === "player") {
      for (const enemy of this.enemies) {
        if (!enemy.active) continue;
        const dx = enemy.x - x;
        const dy = enemy.y - y;
        if (dx * dx + dy * dy <= radius * radius) {
          enemy.takeDamage(damage);
        }
      }
    } else if (this.shipAlive) {
      const dx = this.ship.x - x;
      const dy = this.ship.y - y;
      if (dx * dx + dy * dy <= radius * radius) {
        this.damagePlayer(damage);
      }
    }
  };

  private parallax!: ParallaxBackground;
  private particles!: ParticleSystem;
  private playerFiring = new PlayerFiring();

  constructor() {
    super("PlayScene");
  }

  private resetState(): void {
    this.pointerActive = false;
    this.target.set(0, 0);
    this.defaultTarget.set(0, 0);
    this.enemies.length = 0;
    this.enemyPool.length = 0;
    this.waveIndex = 0;
    this.waveTimer = 0;
    this.waveEvents = [];
    this.waveEventCursor = 0;
    this.currentWaveDifficulty = 1;
    this.lastFactoryIntensity = undefined;
    this.isGameOver = false;
    this.overlayShown = false;
    this.gold = 0;
    this.hitCooldown = 0;
    this.goldBanked = false;
    this.playerFiring.reset();
    this.shipAlive = true;
    this.magnetMultiplier = 1;
    this.bossTimerMs = 0;
    this.bossActive = false;
    if (this.playAreaFrame) {
      this.playAreaFrame.destroy();
      this.playAreaFrame = undefined;
    }
    if (this.gameOverTimer) {
      this.gameOverTimer.remove(false);
      this.gameOverTimer = undefined;
    }
  }

  create(): void {
    this.resetState();
    this.cameras.main.setBackgroundColor("#05060a");
    this.input.enabled = true;
    this.updatePlayArea();
    this.parallax = new ParallaxBackground(this, this.playArea);
    this.particles = new ParticleSystem(this);
    this.setupInput();
    this.scale.off("resize", this.onResize, this);
    this.scale.on("resize", this.onResize, this);

    const stats = computePlayerStats();
    this.weaponId = stats.weapon.id;
    this.playerWeapon = stats.weapon;
    this.secondaryWeapon = stats.secondaryWeapon;
    this.magnetMultiplier = stats.ship.magnetMultiplier ?? 1;

    this.ship = new Ship(this, {
      color: stats.ship.color,
      maxHp: stats.ship.maxHp,
      moveSpeed: stats.ship.moveSpeed,
      radius: 14 * (stats.ship.radiusMultiplier ?? 1),
      shape: stats.ship.shape,
    });

    this.gold = 0;
    this.goldBanked = false;
    this.ship.setPosition(this.defaultTarget.x, this.defaultTarget.y);
    this.target.copy(this.defaultTarget);

    this.playerBullets = new ObjectPool(
      () => new Bullet(this, { owner: "player" }),
      16,
    );
    this.enemyBullets = new ObjectPool(
      () => new Bullet(this, { owner: "enemy" }),
      24,
    );
    this.goldPickups = new ObjectPool(() => new PickupGold(this), 18);

    this.hud = new HUD(
      this,
      () => this.goToShop(),
      () => this.pauseGame(),
      this.playArea,
    );
    this.startWave(0);
  }

  update(_time: number, deltaMs: number): void {
    const delta = deltaMs / 1000;
    this.parallax.update(delta);
    this.particles.update(delta);
    if (this.overlayShown) return;
    this.hitCooldown = Math.max(0, this.hitCooldown - delta);
    this.waveTimer += deltaMs;

    this.updateShip(delta);
    this.updateLowHealthEffect(delta);
    this.updateFiring(delta);
    this.updatePlayerBullets(delta);
    this.updateEnemies(deltaMs);
    this.updateEnemyBullets(delta);
    this.updatePickups(delta);
    this.processWaves();
    const boss = this.getActiveBoss();
    const bossActiveNow = Boolean(boss);
    if (bossActiveNow) {
      if (!this.bossActive) this.bossTimerMs = 0;
      this.bossTimerMs += deltaMs;
    } else {
      this.bossTimerMs = 0;
    }
    this.bossActive = bossActiveNow;

    this.hud.setStatus({
      boss: boss
        ? {
            hp: boss.hp,
            maxHp: boss.maxHp,
            timeSec: this.bossTimerMs / 1000,
          }
        : undefined,
      gold: this.gold,
      hp: this.ship.hp,
      maxHp: this.ship.maxHp,
      wave: this.waveIndex + 1,
    });
  }

  private updateShip(delta: number): void {
    if (!this.shipAlive) return;
    if (this.ship.hp < this.ship.maxHp) {
      this.ship.hp = Math.min(
        this.ship.maxHp,
        this.ship.hp + SHIP_REGEN_PER_SEC * delta,
      );
    }
    if (!this.pointerActive) {
      // Ease back toward a relaxed position near the bottom center.
      this.target.lerp(this.defaultTarget, 0.02);
    }
    this.ship.update(
      delta,
      this.target.x,
      this.target.y,
      this.playArea,
      PADDING,
    );
  }

  private updateFiring(delta: number): void {
    if (!this.shipAlive) return;
    const weapon = this.playerWeapon ?? WEAPONS[this.weaponId];
    this.playerFiring.update(
      delta,
      this.ship.x,
      this.ship.y,
      this.ship.radius,
      weapon,
      this.secondaryWeapon,
      this.emitPlayerBullet,
      this.debugBulletSpec,
    );
  }

  private updatePlayerBullets(delta: number): void {
    this.bulletContext.enemies = this.enemies;
    this.bulletContext.playerX = this.ship.x;
    this.bulletContext.playerY = this.ship.y;
    this.bulletContext.playerAlive = this.shipAlive;
    this.playerBullets.forEachActive((bullet) => {
      bullet.update(
        delta,
        this.playArea,
        this.bulletContext,
        this.emitMissileTrail,
        this.handleBulletExplosion,
      );
      if (!bullet.active) return;

      for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
        const enemy = this.enemies[i];
        if (!enemy.active) continue;
        const hit = circleOverlap(
          bullet.x,
          bullet.y,
          bullet.radius,
          enemy.x,
          enemy.y,
          enemy.radius,
        );
        if (hit) {
          if (bullet.spec.kind === "bomb" || bullet.spec.aoe) {
            bullet.hit(this.handleBulletExplosion);
          } else {
            enemy.takeDamage(bullet.damage);
            bullet.deactivate();
            if (!enemy.active) {
              this.releaseEnemy(i, true);
            }
          }
          break;
        }
      }
    });
  }

  private updateEnemies(deltaMs: number): void {
    const bounds = this.playArea;
    const margin = 120;
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      if (!enemy.active) {
        this.releaseEnemy(i, true);
        continue;
      }
      enemy.update(
        deltaMs * this.currentWaveDifficulty,
        this.ship.x,
        this.ship.y,
        this.shipAlive,
        this.emitEnemyBullet,
      );
      if (enemy.def.id === "boss" && enemy.isCharging) {
        const color = enemy.def.style?.lineColor ?? 0xff6b6b;
        this.particles.spawnInward(
          enemy.x,
          enemy.y,
          4,
          color,
          enemy.radius * 2.8,
        );
        enemy.glow(0.22);
      }

      const offscreen =
        enemy.y >= bounds.y + bounds.height + margin ||
        enemy.y <= bounds.y - margin ||
        enemy.x <= bounds.x - margin ||
        enemy.x >= bounds.x + bounds.width + margin;
      if (
        (enemy.isMoveFinished && offscreen) ||
        enemy.y >= bounds.y + bounds.height + margin
      ) {
        this.releaseEnemy(i, false);
        continue;
      }
      if (enemy.isMoveFinished && enemy.finishedElapsedMs > FINISH_LINGER_MS) {
        const { height, width, x, y } = bounds;
        const leftDist = enemy.x - x;
        const rightDist = x + width - enemy.x;
        const topDist = enemy.y - y;
        const bottomDist = y + height - enemy.y;
        const marginExit = 120;
        let targetX = enemy.x;
        let targetY = enemy.y;
        const minDist = Math.min(leftDist, rightDist, topDist, bottomDist);
        if (minDist === leftDist) {
          targetX = x - marginExit;
        } else if (minDist === rightDist) {
          targetX = x + width + marginExit;
        } else if (minDist === topDist) {
          targetY = y - marginExit;
        } else {
          targetY = y + height + marginExit;
        }
        enemy.triggerExit(targetX, targetY, EXIT_DASH_MS);
      }

      if (this.shipAlive) {
        const collided = circleOverlap(
          enemy.x,
          enemy.y,
          enemy.radius,
          this.ship.x,
          this.ship.y,
          this.ship.radius,
        );
        if (collided) {
          if (enemy.def.id === "boss") {
            this.ship.hp = 0;
            this.handleShipDeath();
          } else {
            this.damagePlayer(1);
            this.releaseEnemy(i, true);
          }
        }
      }
    }
  }

  private updateEnemyBullets(delta: number): void {
    this.bulletContext.enemies = this.enemies;
    this.bulletContext.playerX = this.ship.x;
    this.bulletContext.playerY = this.ship.y;
    this.bulletContext.playerAlive = this.shipAlive;
    this.enemyBullets.forEachActive((bullet) => {
      bullet.update(
        delta,
        this.playArea,
        this.bulletContext,
        this.emitMissileTrail,
        this.handleBulletExplosion,
      );
      if (!bullet.active || !this.shipAlive) return;
      const hit = circleOverlap(
        bullet.x,
        bullet.y,
        bullet.radius,
        this.ship.x,
        this.ship.y,
        this.ship.radius,
      );
      if (hit) {
        if (bullet.spec.kind === "bomb" || bullet.spec.aoe) {
          bullet.hit(this.handleBulletExplosion);
        } else {
          bullet.deactivate();
          this.damagePlayer(bullet.damage);
        }
      }
    });
  }

  private updatePickups(delta: number): void {
    this.goldPickups.forEachActive((pickup) => {
      const magnetRadius = this.shipAlive
        ? MAGNET_RADIUS * this.magnetMultiplier
        : 0;
      pickup.update(
        delta,
        this.playArea,
        this.ship.x,
        this.ship.y,
        magnetRadius,
      );
      if (this.shipAlive) {
        const collected = circleOverlap(
          pickup.x,
          pickup.y,
          pickup.radius,
          this.ship.x,
          this.ship.y,
          this.ship.radius,
        );
        if (collected) {
          this.gold += pickup.value;
          pickup.deactivate();
        }
      }
    });
  }

  private processWaves(): void {
    while (
      this.waveEventCursor < this.waveEvents.length &&
      this.waveEvents[this.waveEventCursor].atMs <= this.waveTimer
    ) {
      const event = this.waveEvents[this.waveEventCursor];
      this.spawnEnemy(
        event.enemyId,
        event.x,
        event.y,
        this.currentWaveDifficulty,
        event.overrides,
      );
      this.waveEventCursor += 1;
    }

    const waveFinished =
      this.waveEventCursor >= this.waveEvents.length &&
      this.enemies.length === 0;
    if (waveFinished) {
      this.startWave(this.waveIndex + 1);
    }
  }

  private spawnEnemy(
    enemyId: keyof typeof ENEMIES,
    x: number,
    y: number,
    hpMultiplier: number,
    overrides?: EnemyOverride,
  ): void {
    const base = ENEMIES[enemyId];
    const def = overrides ? { ...base, ...overrides } : base;
    def.move ??= base.move;
    def.fire ??= base.fire;
    def.goldDrop ??= base.goldDrop;
    def.radius ??= base.radius;
    def.phases ??= base.phases;
    def.style ??= base.style;
    def.rotation ??= base.rotation;
    def.rotationDeg ??= base.rotationDeg;
    const worldX = this.playArea.x + x * this.playArea.width;
    const worldY = this.playArea.y + y * this.playArea.height;
    const enemy = this.enemyPool.pop() ?? new Enemy(this, def, worldX, worldY);
    enemy.reset(def, worldX, worldY, hpMultiplier);
    this.enemies.push(enemy);
  }

  private releaseEnemy(index: number, dropGold: boolean): void {
    const enemy = this.enemies[index];
    if (dropGold) {
      if (enemy.def.id === "boss") {
        this.particles.spawnBurst(enemy.x, enemy.y, 40, 0xff6b6b);
        this.particles.spawnBurst(enemy.x, enemy.y, 30, 0xff9fae);
        this.particles.spawnRing(enemy.x, enemy.y, enemy.radius * 6, 0xff6b6b, 5, 0.8);
        this.particles.spawnRing(enemy.x, enemy.y, enemy.radius * 3.5, 0xffa3b8, 3, 0.6);
      } else {
        this.particles.spawnBurst(enemy.x, enemy.y, 18, 0xff6b6b);
      }
      this.dropGold(enemy);
    } else {
      this.particles.spawnBurst(enemy.x, enemy.y, 6, 0x1f3c5e);
    }
    enemy.deactivate();
    this.enemies.splice(index, 1);
    this.enemyPool.push(enemy);
  }

  private damagePlayer(amount: number): void {
    if (this.hitCooldown > 0 || this.isGameOver || !this.shipAlive) return;
    this.ship.hp = Math.max(0, this.ship.hp - amount);
    this.hitCooldown = 0.5;
    this.ship.flash();
    this.particles.spawnBurst(this.ship.x, this.ship.y, 10, 0x7df9ff);
    if (this.ship.hp <= 0) {
      this.handleShipDeath();
    }
  }

  private dropGold(enemy: Enemy): void {
    const { max, min } = enemy.def.goldDrop;
    const total = Phaser.Math.Between(min, max);
    if (enemy.def.id !== "boss") {
      const pickup = this.goldPickups.acquire();
      pickup.spawn(enemy.x, enemy.y, Math.max(1, total));
      return;
    }

    const count = Phaser.Math.Clamp(Math.round(total / 2), 6, 12);
    const values = new Array<number>(count).fill(1);
    let remaining = Math.max(0, total - count);
    while (remaining > 0) {
      const index = Phaser.Math.Between(0, count - 1);
      values[index] += 1;
      remaining -= 1;
    }

    const radius = Math.max(10, enemy.radius * 0.9);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * radius;
      const offsetX = Math.cos(angle) * dist;
      const offsetY = Math.sin(angle) * dist;
      const speed = Phaser.Math.Between(40, 140);
      const vx = Math.cos(angle) * speed + Phaser.Math.Between(-20, 20);
      const vy = Math.sin(angle) * speed + Phaser.Math.Between(-10, 30);
      const pickup = this.goldPickups.acquire();
      pickup.spawn(enemy.x + offsetX, enemy.y + offsetY, values[i]);
      pickup.vx = vx;
      pickup.vy = vy;
    }
  }

  private bankRunGold(): void {
    if (this.goldBanked) return;
    bankGold(this.gold);
    this.goldBanked = true;
  }

  private startWave(index: number): void {
    this.waveIndex = index;
    this.waveTimer = 0;
    this.waveEventCursor = 0;
    this.playerFiring.reset();
    this.buildWaveEvents();
    this.hud.setStatus({
      gold: this.gold,
      hp: this.ship.hp,
      maxHp: this.ship.maxHp,
      wave: this.waveIndex + 1,
    });
  }

  private handleShipDeath(): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.shipAlive = false;
    this.pointerActive = false;
    this.bankRunGold();
    this.ship.graphics.setVisible(false);
    this.particles.spawnBurst(this.ship.x, this.ship.y, 80, 0xff8ba0);
    this.gameOverTimer = this.time.delayedCall(1000, () => {
      this.overlayShown = true;
      this.game.events.emit("ui:gameover", {
        gold: this.gold,
        wave: this.waveIndex + 1,
      });
    });
  }

  private buildWaveEvents(): void {
    let wave = this.selectWaveDefinition();
    if (!this.isBossWave(this.waveIndex)) {
      wave = augmentWaveDefinition(wave, {
        height: this.playArea.height,
        waveNumber: this.waveIndex,
        width: this.playArea.width,
      });
    }
    this.currentWaveDifficulty = this.getDifficultyFactor(this.waveIndex);
    this.waveEvents = [...wave.spawns].sort((a, b) => a.atMs - b.atMs);
    this.waveEventCursor = 0;
    console.info(`[Wave] ${wave.id}`);
  }

  private selectWaveDefinition(): WaveDefinition {
    const waveNumber = this.waveIndex;
    if (this.isBossWave(waveNumber)) {
      return buildBossWave(
        waveNumber,
        this.playArea.width,
        this.playArea.height,
      );
    }
    if (waveNumber < WAVES.length) {
      return WAVES[waveNumber];
    }

    const factoryIndex = waveNumber - WAVES.length;
    const entry = this.pickFactoryEntry(factoryIndex);
    this.lastFactoryIntensity = entry.intensity;

    const baseWave = entry.factory({
      height: this.playArea.height,
      waveNumber,
      width: this.playArea.width,
    });

    return Math.random() < 0.4 ? mirrorWaveDefinition(baseWave) : baseWave;
  }

  private isBossWave(waveNumber: number): boolean {
    return (waveNumber + 1) % BOSS_WAVE_INTERVAL === 0;
  }

  private pickFactoryEntry(
    factoryIndex: number,
  ): (typeof WAVE_FACTORY_PACK)[number] {
    const cycle: WaveIntensity[] = ["low", "medium", "high"];
    const desired = cycle[factoryIndex % cycle.length];

    let candidates = WAVE_FACTORY_PACK.filter(
      (entry) => entry.intensity === desired,
    );
    if (desired === "high" && this.lastFactoryIntensity === "high") {
      const fallback = WAVE_FACTORY_PACK.filter(
        (entry) => entry.intensity !== "high",
      );
      if (fallback.length > 0) candidates = fallback;
    }

    if (candidates.length === 0) {
      candidates = WAVE_FACTORY_PACK;
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private getDifficultyFactor(waveIndex: number): number {
    return Math.min(1 + waveIndex * 0.03, 1.8);
  }

  private clearWaveEntities(): void {
    for (const enemy of this.enemies) {
      enemy.deactivate();
      this.enemyPool.push(enemy);
    }
    this.enemies.length = 0;

    this.playerBullets.forEachActive((bullet) => bullet.deactivate());
    this.enemyBullets.forEachActive((bullet) => bullet.deactivate());
    this.goldPickups.forEachActive((pickup) => pickup.deactivate());
  }

  private skipWave(): void {
    if (this.isGameOver || this.overlayShown) return;
    this.clearWaveEntities();
    this.startWave(this.waveIndex + 1);
  }

  private goToShop(): void {
    this.bankRunGold();
    this.isGameOver = true;
    this.pointerActive = false;
    this.game.events.emit("ui:route", "hangar");
  }

  private pauseGame(): void {
    if (this.isGameOver || this.overlayShown) return;
    this.game.events.emit("ui:route", "pause");
  }

  private setupInput(): void {
    this.input.addPointer(2);
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.pointerActive = true;
      this.setTargetFromPointer(pointer);
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.pointerActive) return;
      this.setTargetFromPointer(pointer);
    });
    this.input.on("pointerup", () => {
      this.pointerActive = false;
      this.target.copy(this.defaultTarget);
    });
    this.input.on("pointerupoutside", () => {
      this.pointerActive = false;
      this.target.copy(this.defaultTarget);
    });

    const keyboard = this.input.keyboard;
    if (keyboard) {
      keyboard.on("keydown-N", () => this.skipWave());
      keyboard.on("keydown-ONE", () => this.setDebugBulletSpec("orb"));
      keyboard.on("keydown-TWO", () => this.setDebugBulletSpec("dart"));
      keyboard.on("keydown-THREE", () => this.setDebugBulletSpec("missile"));
      keyboard.on("keydown-FOUR", () => this.setDebugBulletSpec("bomb"));
    }
  }

  private setTargetFromPointer(pointer: Phaser.Input.Pointer): void {
    const nativeEvent = pointer.event as PointerEvent | TouchEvent;
    const isTouchEvent =
      (typeof TouchEvent !== "undefined" && nativeEvent instanceof TouchEvent)
      || (nativeEvent as PointerEvent).pointerType === "touch";
    const targetY = isTouchEvent
      ? pointer.worldY - this.touchOffsetY
      : pointer.worldY;
    this.target.set(pointer.worldX, targetY);
    if (isTouchEvent && nativeEvent instanceof TouchEvent) {
      nativeEvent.preventDefault();
    }
  }

  private setDebugBulletSpec(kind: keyof typeof DEBUG_PLAYER_BULLETS): void {
    this.debugBulletSpec = DEBUG_PLAYER_BULLETS[kind];
  }

  private getActiveBoss(): Enemy | undefined {
    return this.enemies.find(
      (enemy) => enemy.active && enemy.def.id === "boss",
    );
  }

  private updatePlayArea(): void {
    this.playArea = computePlayArea(this.scale.width, this.scale.height);
    const camera = this.cameras.main;
    camera.setViewport(
      this.playArea.x,
      this.playArea.y,
      this.playArea.width,
      this.playArea.height,
    );
    camera.setSize(this.playArea.width, this.playArea.height);
    camera.setScroll(this.playArea.x, this.playArea.y);
    this.defaultTarget.set(
      this.playArea.x + this.playArea.width * 0.5,
      this.playArea.y + this.playArea.height * 0.8,
    );
    if (!this.pointerActive) {
      this.target.copy(this.defaultTarget);
    }
    this.drawPlayAreaFrame(this.healthPulseStrength);
    this.updateOuterFrameVars();
    this.touchOffsetY = Math.round(
      Phaser.Math.Clamp(this.playArea.height * 0.12, 40, 120),
    );
    if (this.parallax) this.parallax.setBounds(this.playArea);
    if (this.hud) this.hud.setBounds(this.playArea);
  }

  private drawPlayAreaFrame(pulseStrength: number): void {
    if (!this.playAreaFrame) {
      this.playAreaFrame = this.add.graphics();
      this.playAreaFrame.setDepth(30);
    }
    const inset = 1;
    this.playAreaFrame.clear();
    if (pulseStrength > 0) {
      const glowAlpha = 0.12 + pulseStrength * 0.35;
      this.playAreaFrame.lineStyle(7, 0xff3b3b, glowAlpha);
      this.playAreaFrame.strokeRoundedRect(
        this.playArea.x + inset - 2,
        this.playArea.y + inset - 2,
        this.playArea.width - inset * 2 + 4,
        this.playArea.height - inset * 2 + 4,
        PLAYFIELD_CORNER_RADIUS + 2,
      );
    }
    this.playAreaFrame.lineStyle(2, 0x2b415f, 1);
    this.playAreaFrame.strokeRoundedRect(
      this.playArea.x + inset,
      this.playArea.y + inset,
      this.playArea.width - inset * 2,
      this.playArea.height - inset * 2,
      PLAYFIELD_CORNER_RADIUS,
    );
  }

  private updateLowHealthEffect(delta: number): void {
    if (!this.shipAlive) return;
    const ratio = this.ship.maxHp > 0 ? this.ship.hp / this.ship.maxHp : 1;
    let targetStrength = 0;
    if (ratio <= CRITICAL_HEALTH_THRESHOLD) targetStrength = 1;
    else if (ratio <= LOW_HEALTH_THRESHOLD) targetStrength = 0.5;

    if (targetStrength <= 0) {
      if (this.healthPulseStrength !== 0) {
        this.healthPulseStrength = 0;
        this.drawPlayAreaFrame(this.healthPulseStrength);
      }
      this.healthPulseTime = 0;
      return;
    }

    this.healthPulseTime += delta;
    const pulse = 0.5 + 0.5 * Math.sin(this.healthPulseTime * 3.2);
    const strength = targetStrength * pulse;
    if (Math.abs(strength - this.healthPulseStrength) > 0.02) {
      this.healthPulseStrength = strength;
      this.drawPlayAreaFrame(this.healthPulseStrength);
    }
  }

  private updateOuterFrameVars(): void {
    const root = document.documentElement;
    root.style.setProperty("--play-x", `${this.playArea.x}px`);
    root.style.setProperty("--play-y", `${this.playArea.y}px`);
    root.style.setProperty("--play-w", `${this.playArea.width}px`);
    root.style.setProperty("--play-h", `${this.playArea.height}px`);
    root.style.setProperty(
      "--play-cx",
      `${this.playArea.x + this.playArea.width / 2}px`,
    );
    root.style.setProperty(
      "--play-cy",
      `${this.playArea.y + this.playArea.height / 2}px`,
    );
    root.style.setProperty("--play-r", `${PLAYFIELD_CORNER_RADIUS}px`);
  }

  private onResize = (_gameSize: Phaser.Structs.Size): void => {
    this.updatePlayArea();
    if (this.ship) {
      this.ship.setPosition(this.defaultTarget.x, this.defaultTarget.y);
    }
  };
}
