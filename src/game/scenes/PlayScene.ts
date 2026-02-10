import type { ENEMIES } from "../data/enemies";
import type { EnemyHitbox } from "../data/enemyTypes";
import type { MountedWeapon } from "../data/save";
import type { BulletSpec } from "../data/scripts";
import type { Enemy } from "../entities/Enemy";
import type { EmitBullet } from "../systems/FireScriptRunner";

import Phaser from "phaser";

import { DEBUG_PLAYER_BULLETS } from "../data/bullets";
import { recordLevelCompletion } from "../data/levelProgress";
import { getActiveLevelSession } from "../data/levelState";
import { bankGold, computePlayerLoadout } from "../data/save";
import { type EnemyOverride } from "../data/waves";
import { Bullet, type BulletUpdateContext } from "../entities/Bullet";
import { PickupGold } from "../entities/PickupGold";
import { Ship } from "../entities/Ship";
import { CONTACT_DAMAGE_PER_SEC } from "../systems/combatConstants";
import {
  circleHitboxOverlap,
  resolveCircleHitboxPenetration,
} from "../systems/hitbox";
import { LevelRunner } from "../systems/LevelRunner";
import { ParallaxBackground } from "../systems/Parallax";
import { ParticleSystem } from "../systems/Particles";
import {
  updateEnemyBulletsRuntime,
  updatePlayerBulletsRuntime,
} from "../systems/play/BulletRuntime";
import {
  getBulletExplosionInfo,
  spawnBulletExplosionFx,
  spawnBulletTrail,
} from "../systems/play/BulletVisualFx";
import {
  spawnEnemyRuntime,
  updateEnemiesRuntime,
} from "../systems/play/EnemyRuntime";
import { updatePickupsRuntime } from "../systems/play/PickupRuntime";
import {
  bankRunGoldOnce,
  clearWaveEntitiesRuntime,
  emitGameOverEvent,
  emitVictoryRoute,
} from "../systems/play/RunOutcome";
import { PlayerCollisionResolver } from "../systems/PlayerCollision";
import { PlayerFiring } from "../systems/PlayerFiring";
import { HUD } from "../ui/HUD";
import { computePlayArea, PLAYFIELD_CORNER_RADIUS } from "../util/playArea";
import { setPlayfieldCssVars } from "../util/playfieldCssVars";
import { ObjectPool } from "../util/pool";

const PADDING = 0.05;
const MAGNET_RADIUS = 120;
const FINISH_LINGER_MS = 2400;
const EXIT_DASH_MS = 700;
const ENEMY_MARGIN = 120;
const SHIP_REGEN_PER_SEC = 0.1;
const PLAYER_DAMAGE_MULTIPLIER = 1.2;
const HIT_COOLDOWN_SEC = 0.5;
const BUMP_FX = {
  burstCount: 6,
  color: 0x7df9ff,
  cooldownMs: 120,
  ringLife: 0.24,
  ringRadius: 18,
  ringThickness: 2,
};
const DAMAGE_FX = {
  angleMax: Math.PI * 2,
  angleMin: 0,
  colors: [0xffffff, 0xfff3c4, 0xffd166],
  cooldownMs: 80,
  drag: 0.92,
  lengthMax: 14,
  lengthMin: 6,
  lifeMax: 0.35,
  lifeMin: 0.18,
  sparkCount: 12,
  speedMax: 260,
  speedMin: 120,
  thicknessMax: 1.6,
  thicknessMin: 1,
};
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
  private mountedWeapons: MountedWeapon[] = [];
  private magnetMultiplier = 1;
  private debugBulletSpec?: BulletSpec;
  private gameOverTimer?: Phaser.Time.TimerEvent;
  private overlayShown = false;
  private levelRunner?: LevelRunner;

  private enemies: Enemy[] = [];
  private enemyPool: Enemy[] = [];
  private isGameOver = false;
  private gold = 0;
  private goldBanked = false;
  private runDamageTaken = 0;
  private runElapsedMs = 0;
  private runEnemiesDefeated = 0;
  private runEnemiesSpawned = 0;
  private shipAlive = true;
  private bossTimerMs = 0;
  private bossActive = false;
  private enemyEntered = new WeakMap<Enemy, boolean>();
  private chargeRingCooldownMs = new WeakMap<Enemy, number>();
  private healthPulseTime = 0;
  private healthPulseStrength = 0;
  private touchOffsetY = 0;
  private collisionPush = { nx: 0, ny: 0, x: 0, y: 0 };
  private collisionResolver?: PlayerCollisionResolver;
  private fpsText?: Phaser.GameObjects.Text;
  private fpsTimerMs = 0;
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
    spawnBulletTrail(this.particles, x, y, spec);
  };
  private handleBulletExplosion = (
    x: number,
    y: number,
    spec: BulletSpec,
    owner: "enemy" | "player",
  ): void => {
    const explosion = getBulletExplosionInfo(spec, owner);
    spawnBulletExplosionFx(this.particles, x, y, explosion, 24);
    if (owner === "player") {
      for (const enemy of this.enemies) {
        if (!enemy.active) continue;
        if (
          circleHitboxOverlap(
            x,
            y,
            explosion.radius,
            enemy.x,
            enemy.y,
            enemy.hitbox,
          )
        ) {
          enemy.takeDamage(explosion.damage);
        }
      }
    } else if (this.shipAlive) {
      const dx = this.ship.x - x;
      const dy = this.ship.y - y;
      if (dx * dx + dy * dy <= explosion.radius * explosion.radius) {
        this.damagePlayer(explosion.damage, x, y);
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
    this.isGameOver = false;
    this.overlayShown = false;
    this.gold = 0;
    this.goldBanked = false;
    this.playerFiring.reset();
    this.shipAlive = true;
    this.magnetMultiplier = 1;
    this.mountedWeapons = [];
    this.runDamageTaken = 0;
    this.runElapsedMs = 0;
    this.runEnemiesDefeated = 0;
    this.runEnemiesSpawned = 0;
    this.bossTimerMs = 0;
    this.bossActive = false;
    this.enemyEntered = new WeakMap();
    this.chargeRingCooldownMs = new WeakMap();
    if (this.levelRunner) {
      this.levelRunner.destroy();
      this.levelRunner = undefined;
    }
    if (this.playAreaFrame) {
      this.playAreaFrame.destroy();
      this.playAreaFrame = undefined;
    }
    if (this.gameOverTimer) {
      this.gameOverTimer.remove(false);
      this.gameOverTimer = undefined;
    }
    this.collisionResolver = undefined;
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

    const stats = computePlayerLoadout();
    this.mountedWeapons = stats.mountedWeapons;
    this.magnetMultiplier = stats.ship.magnetMultiplier ?? 1;

    this.ship = new Ship(this, {
      color: stats.ship.color,
      maxHp: stats.ship.maxHp,
      moveSpeed: stats.ship.moveSpeed,
      radius: 17 * (stats.ship.radiusMultiplier ?? 1),
      vector: stats.ship.vector,
    });
    this.ship.setMountedWeapons(this.mountedWeapons);
    this.collisionResolver = new PlayerCollisionResolver(
      {
        bumpFx: BUMP_FX,
        damageFx: DAMAGE_FX,
        damageMultiplier: PLAYER_DAMAGE_MULTIPLIER,
        hitCooldownSec: HIT_COOLDOWN_SEC,
        padding: PADDING,
      },
      {
        canDamage: () => this.shipAlive && !this.isGameOver,
        getBounds: () => this.playArea,
        onDeath: () => this.handleShipDeath(),
        particles: this.particles,
        ship: this.ship,
      },
    );

    this.gold = 0;
    this.goldBanked = false;
    this.runDamageTaken = 0;
    this.runElapsedMs = 0;
    this.runEnemiesDefeated = 0;
    this.runEnemiesSpawned = 0;
    this.ship.setPosition(this.defaultTarget.x, this.defaultTarget.y);
    this.target.copy(this.defaultTarget);

    this.fpsText = this.add
      .text(0, 0, "FPS --", {
        backgroundColor: "#0f1624",
        color: "#8fa6c7",
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        padding: { x: 6, y: 3 },
      })
      .setOrigin(1, 0)
      .setDepth(40);
    this.positionFpsText();

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
    const activeSession = getActiveLevelSession();
    const activeLevel = activeSession?.level;
    if (activeLevel) {
      const playerState = { alive: true, radius: 0, x: 0, y: 0 };
      this.levelRunner = new LevelRunner(activeLevel, {
        applyContactDamage: (amount, fxX, fxY) =>
          this.applyContactDamage(amount, fxX, fxY),
        getEnemyCount: () => this.enemies.length,
        getPlayArea: () => this.playArea,
        getPlayerState: () => {
          playerState.alive = this.shipAlive;
          playerState.radius = this.ship.radius;
          playerState.x = this.ship.x;
          playerState.y = this.ship.y;
          return playerState;
        },
        isEnemyActive: (enemyId) =>
          this.enemies.some(
            (enemy) => enemy.active && enemy.def.id === enemyId,
          ),
        onVictory: () => this.handleLevelVictory(),
        pushPlayer: (offsetX, offsetY, fxColor, fxX, fxY) =>
          this.applyPlayerPush(offsetX, offsetY, fxColor, fxX, fxY),
        scene: this,
        spawnEnemy: (enemyId, x, y, hpMultiplier, overrides) =>
          this.spawnEnemy(enemyId, x, y, hpMultiplier, overrides),
      });
      this.levelRunner.start();
    } else {
      this.game.events.emit("ui:route", "menu");
      return;
    }
  }

  update(_time: number, deltaMs: number): void {
    const delta = deltaMs / 1000;
    this.parallax.update(delta);
    this.particles.update(delta);
    this.updateFps(deltaMs);
    if (this.overlayShown) return;
    this.runElapsedMs += deltaMs;
    this.collisionResolver?.update(deltaMs);
    this.updateShip(delta);
    this.updateLowHealthEffect(delta);
    this.updateFiring(delta);
    this.updatePlayerBullets(delta);
    this.updateEnemies(deltaMs);
    this.updateEnemyBullets(delta);
    this.updatePickups(delta);
    if (this.levelRunner) {
      this.levelRunner.update(deltaMs);
    }
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
      wave: this.getWaveDisplay(),
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
    this.playerFiring.update(
      delta,
      this.ship.x,
      this.ship.y,
      this.ship.radius,
      this.mountedWeapons,
      this.emitPlayerBullet,
      this.debugBulletSpec,
    );
  }

  private updatePlayerBullets(delta: number): void {
    updatePlayerBulletsRuntime(delta, {
      bulletContext: this.bulletContext,
      emitTrail: this.emitMissileTrail,
      enemies: this.enemies,
      enemyBullets: this.enemyBullets,
      handleExplosion: this.handleBulletExplosion,
      onDamagePlayer: (amount, fxX, fxY) => this.damagePlayer(amount, fxX, fxY),
      onEnemyKilled: (enemyIndex) => this.releaseEnemy(enemyIndex, true),
      playArea: this.playArea,
      playerAlive: this.shipAlive,
      playerBullets: this.playerBullets,
      playerRadius: this.ship.radius,
      playerX: this.ship.x,
      playerY: this.ship.y,
    });
  }

  private updateEnemies(deltaMs: number): void {
    updateEnemiesRuntime({
      bounds: this.playArea,
      contactDamagePerSec: CONTACT_DAMAGE_PER_SEC,
      deltaMs,
      emitEnemyBullet: this.emitEnemyBullet,
      enemies: this.enemies,
      exitDashMs: EXIT_DASH_MS,
      finishLingerMs: FINISH_LINGER_MS,
      getEnemyEntered: (enemy) => this.enemyEntered.get(enemy) ?? false,
      getEnemyPush: (enemyX, enemyY, enemyRadius) =>
        this.getEnemyPush(enemyX, enemyY, enemyRadius),
      margin: ENEMY_MARGIN,
      markEnemyEntered: (enemy) => {
        this.enemyEntered.set(enemy, true);
      },
      onEnemyCharging: (enemy) => {
        const progress = Phaser.Math.Clamp(enemy.chargeProgress, 0, 1);
        const color = enemy.def.style?.lineColor ?? 0xff6b6b;
        const inwardCount = Phaser.Math.Clamp(
          Math.round(2 + progress * 4),
          2,
          6,
        );
        this.particles.spawnInward(
          enemy.x,
          enemy.y,
          inwardCount,
          color,
          enemy.radius * (2.3 + progress * 0.9),
        );

        const ringCooldown = this.chargeRingCooldownMs.get(enemy) ?? 0;
        const remaining = ringCooldown - deltaMs;
        if (remaining <= 0) {
          this.particles.spawnRing(
            enemy.x,
            enemy.y,
            enemy.radius * (1.4 + progress * 1.2),
            color,
            2,
            0.22,
          );
          this.chargeRingCooldownMs.set(
            enemy,
            Phaser.Math.Linear(220, 70, progress),
          );
        } else {
          this.chargeRingCooldownMs.set(enemy, remaining);
        }
        enemy.glow(0.12 + progress * 0.32);
      },
      onEnemyContact: (index, enemy, push, contactDamage) => {
        const fxColor =
          enemy.def.style?.lineColor ?? enemy.def.style?.fillColor ?? 0xff6b6b;
        const contactX = this.ship.x - push.nx * this.ship.radius;
        const contactY = this.ship.y - push.ny * this.ship.radius;
        this.applyPlayerPush(push.x, push.y, fxColor, contactX, contactY);
        this.applyContactDamage(contactDamage, contactX, contactY);
        enemy.takeDamage(contactDamage * 2);
        if (!enemy.active) {
          this.releaseEnemy(index, true);
        }
      },
      onReleaseEnemy: (index, dropGold) => this.releaseEnemy(index, dropGold),
      playerAlive: this.shipAlive,
      playerX: this.ship.x,
      playerY: this.ship.y,
    });
  }

  private getEnemyPush(
    enemyX: number,
    enemyY: number,
    enemyHitbox: EnemyHitbox,
  ): { x: number; y: number; nx: number; ny: number } | null {
    const penetration = resolveCircleHitboxPenetration(
      this.ship.x,
      this.ship.y,
      this.ship.radius,
      enemyX,
      enemyY,
      enemyHitbox,
    );
    if (!penetration) return null;
    const out = this.collisionPush;
    out.nx = penetration.nx;
    out.ny = penetration.ny;
    out.x = penetration.nx * penetration.depth;
    out.y = penetration.ny * penetration.depth;
    return out;
  }

  private applyPlayerPush(
    offsetX: number,
    offsetY: number,
    fxColor?: number,
    fxX?: number,
    fxY?: number,
  ): void {
    this.collisionResolver?.applyPush(offsetX, offsetY, fxColor, fxX, fxY);
  }

  private applyContactDamage(amount: number, fxX?: number, fxY?: number): void {
    const beforeHp = this.ship?.hp ?? 0;
    this.collisionResolver?.applyContactDamage(amount, fxX, fxY);
    const afterHp = this.ship?.hp ?? beforeHp;
    if (beforeHp > afterHp) {
      this.runDamageTaken += beforeHp - afterHp;
    }
  }

  private updateEnemyBullets(delta: number): void {
    updateEnemyBulletsRuntime(delta, {
      bulletContext: this.bulletContext,
      emitTrail: this.emitMissileTrail,
      enemies: this.enemies,
      enemyBullets: this.enemyBullets,
      handleExplosion: this.handleBulletExplosion,
      onDamagePlayer: (amount, fxX, fxY) => this.damagePlayer(amount, fxX, fxY),
      onEnemyKilled: (enemyIndex) => this.releaseEnemy(enemyIndex, true),
      playArea: this.playArea,
      playerAlive: this.shipAlive,
      playerBullets: this.playerBullets,
      playerRadius: this.ship.radius,
      playerX: this.ship.x,
      playerY: this.ship.y,
    });
  }

  private updatePickups(delta: number): void {
    updatePickupsRuntime({
      delta,
      goldPickups: this.goldPickups,
      magnetRadius: MAGNET_RADIUS * this.magnetMultiplier,
      onCollected: (value) => {
        this.gold += value;
      },
      playArea: this.playArea,
      playerAlive: this.shipAlive,
      playerRadius: this.ship.radius,
      playerX: this.ship.x,
      playerY: this.ship.y,
    });
  }

  private spawnEnemy(
    enemyId: keyof typeof ENEMIES,
    x: number,
    y: number,
    hpMultiplier: number,
    overrides?: EnemyOverride,
  ): void {
    this.runEnemiesSpawned += 1;
    spawnEnemyRuntime(enemyId, {
      enemies: this.enemies,
      enemyPool: this.enemyPool,
      hpMultiplier,
      overrides,
      playArea: this.playArea,
      scene: this,
      spawnX: x,
      spawnY: y,
    });
    const spawned = this.enemies[this.enemies.length - 1];
    if (spawned) {
      this.enemyEntered.set(spawned, false);
    }
  }

  private releaseEnemy(index: number, dropGold: boolean): void {
    const enemy = this.enemies[index];
    if (dropGold) {
      this.runEnemiesDefeated += 1;
      if (enemy.def.id === "boss") {
        this.particles.spawnBurst(enemy.x, enemy.y, 40, 0xff6b6b);
        this.particles.spawnBurst(enemy.x, enemy.y, 30, 0xff9fae);
        this.particles.spawnRing(
          enemy.x,
          enemy.y,
          enemy.radius * 6,
          0xff6b6b,
          5,
          0.8,
        );
        this.particles.spawnRing(
          enemy.x,
          enemy.y,
          enemy.radius * 3.5,
          0xffa3b8,
          3,
          0.6,
        );
      } else {
        this.particles.spawnBurst(enemy.x, enemy.y, 18, 0xff6b6b);
      }
      this.dropGold(enemy);
    } else {
      this.particles.spawnBurst(enemy.x, enemy.y, 6, 0x1f3c5e);
    }
    enemy.deactivate();
    this.enemyEntered.delete(enemy);
    this.enemies.splice(index, 1);
    this.enemyPool.push(enemy);
  }

  private damagePlayer(amount: number, fxX?: number, fxY?: number): void {
    const beforeHp = this.ship?.hp ?? 0;
    this.collisionResolver?.applyHitDamage(amount, fxX, fxY);
    const afterHp = this.ship?.hp ?? beforeHp;
    if (beforeHp > afterHp) {
      this.runDamageTaken += beforeHp - afterHp;
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
    this.goldBanked = bankRunGoldOnce(this.gold, this.goldBanked, bankGold);
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
      emitGameOverEvent(this.game, {
        gold: this.gold,
        wave: this.getWaveDisplay(),
      });
    });
  }

  private clearWaveEntities(): void {
    clearWaveEntitiesRuntime({
      enemies: this.enemies,
      enemyBullets: this.enemyBullets,
      enemyPool: this.enemyPool,
      goldPickups: this.goldPickups,
      playerBullets: this.playerBullets,
    });
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
      keyboard.on("keydown-ONE", () => this.setDebugBulletSpec("orb"));
      keyboard.on("keydown-TWO", () => this.setDebugBulletSpec("dart"));
      keyboard.on("keydown-THREE", () => this.setDebugBulletSpec("missile"));
      keyboard.on("keydown-FOUR", () => this.setDebugBulletSpec("bomb"));
    }
  }

  private setTargetFromPointer(pointer: Phaser.Input.Pointer): void {
    const nativeEvent = pointer.event as PointerEvent | TouchEvent;
    const isTouchEvent =
      (typeof TouchEvent !== "undefined" &&
        nativeEvent instanceof TouchEvent) ||
      (nativeEvent as PointerEvent).pointerType === "touch";
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
    if (this.levelRunner) this.levelRunner.setBounds(this.playArea);
    for (const enemy of this.enemies) {
      enemy.setPlayfieldSize(this.playArea.width, this.playArea.height);
    }
    this.positionFpsText();
  }

  private updateFps(deltaMs: number): void {
    if (!this.fpsText) return;
    this.fpsTimerMs += deltaMs;
    if (this.fpsTimerMs < 250) return;
    this.fpsTimerMs = 0;
    const fps = Math.round(this.game.loop.actualFps);
    this.fpsText.setText(`FPS ${fps}`);
  }

  private positionFpsText(): void {
    if (!this.fpsText) return;
    const x = this.playArea.x + this.playArea.width - 12;
    const y = this.playArea.y + 36;
    this.fpsText.setPosition(x, y);
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
    const canvasBounds = this.game.canvas.getBoundingClientRect();
    const scaleX = canvasBounds.width / this.scale.width;
    const scaleY = canvasBounds.height / this.scale.height;
    setPlayfieldCssVars({
      cornerRadius: PLAYFIELD_CORNER_RADIUS * scaleX,
      height: this.playArea.height * scaleY,
      width: this.playArea.width * scaleX,
      x: canvasBounds.left + this.playArea.x * scaleX,
      y: canvasBounds.top + this.playArea.y * scaleY,
    });
  }

  private onResize = (_gameSize: Phaser.Structs.Size): void => {
    this.updatePlayArea();
    if (this.ship) {
      this.ship.setPosition(this.defaultTarget.x, this.defaultTarget.y);
    }
  };

  private handleLevelVictory(): void {
    if (this.isGameOver || this.overlayShown) return;
    this.overlayShown = true;
    this.pointerActive = false;
    this.clearWaveEntities();
    this.bankRunGold();
    const activeSession = getActiveLevelSession();
    if (activeSession?.id) {
      recordLevelCompletion(activeSession.id, {
        damageTaken: this.runDamageTaken,
        elapsedMs: this.runElapsedMs,
        enemiesDefeated: this.runEnemiesDefeated,
        enemiesSpawned: this.runEnemiesSpawned,
        hp: this.ship.hp,
        maxHp: this.ship.maxHp,
      });
    }
    const beatId = activeSession?.level.postBeatId;
    this.time.delayedCall(700, () => {
      emitVictoryRoute(this.game, beatId);
    });
  }

  private getWaveDisplay(): number {
    if (this.levelRunner) return this.levelRunner.getWaveNumber();
    return 0;
  }
}
