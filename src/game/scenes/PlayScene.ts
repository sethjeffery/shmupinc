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
import { CombatVfxDispatcher } from "../systems/play/CombatVfxDispatcher";
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
const SHIP_REGEN_PER_SEC = 0.05;
const PLAYER_DEATH_HIDE_SHIP_MS = 180;
const PLAYER_DEATH_RETURN_DELAY_MS = 3200;
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
const FRAME_PULSE_COLOR = 0x7df9ff;
const FRAME_WARNING_COLOR = 0xff3b3b;
const FRAME_SUCCESS_COLOR = 0x4dffb6;
const SHAKE_COOLDOWN_MS = 80;
const DAMAGE_JOLT_WIDTH_SCALE = 0.11;
const DAMAGE_JOLT_MIN_ADD = 0.06;
const DAMAGE_JOLT_MAX_ADD = 3.4;
const DAMAGE_JOLT_MAX_AMP = 5.8;
const DAMAGE_JOLT_STOP_EPS = 0.008;
const DAMAGE_JOLT_DECAY = 9.5;
const DAMAGE_JOLT_FREQ_MIN = 9;
const DAMAGE_JOLT_FREQ_MAX = 17;
const DAMAGE_JOLT_FREQ_BLEND = 0.45;
const DAMAGE_JOLT_Y_RATIO = 0.14;
const CHARGE_CUE_COOLDOWN_MIN_MS = 34;
const CHARGE_CUE_COOLDOWN_MAX_MS = 165;

export class PlayScene extends Phaser.Scene {
  private hud!: HUD;
  private ship!: Ship;
  private playArea = new Phaser.Geom.Rectangle();
  private playAreaFrame?: Phaser.GameObjects.Graphics;
  private pointerActive = false;
  private firingInputActive = false;
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
  private healthPulseStrength = 0;
  private framePulseBoost = 0;
  private framePulseColor = FRAME_PULSE_COLOR;
  private shakeCooldownMs = 0;
  private damageJoltAmplitude = 0;
  private damageJoltPhase = 0;
  private damageJoltFreqHz = 12;
  private damageJoltX = 0;
  private damageJoltY = 0;
  private chargeCueCooldownMs: Record<string, number> = {};
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
  private vfx!: CombatVfxDispatcher;
  private emitPlayerBullet: EmitBullet = (x, y, angleRad, bullet) => {
    this.vfx.onShotEmit("player", x, y, bullet);
    const playerBullet = this.playerBullets.acquire();
    playerBullet.spawn(x, y, angleRad, bullet);
  };
  private emitEnemyBullet: EmitBullet = (x, y, angleRad, bullet) => {
    this.vfx.onShotEmit("enemy", x, y, bullet);
    const enemyBullet = this.enemyBullets.acquire();
    enemyBullet.spawn(x, y, angleRad, bullet);
  };
  private emitMissileTrail = (
    x: number,
    y: number,
    angleRad: number,
    spec: BulletSpec,
  ): void => {
    this.vfx.onBulletTrail(x, y, angleRad, spec);
  };
  private handleBulletExplosion = (
    x: number,
    y: number,
    spec: BulletSpec,
    owner: "enemy" | "player",
  ): void => {
    const explosion = this.vfx.onBulletExplosion(x, y, spec, owner);
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
    this.firingInputActive = false;
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
    this.framePulseBoost = 0;
    this.framePulseColor = FRAME_PULSE_COLOR;
    this.shakeCooldownMs = 0;
    this.damageJoltAmplitude = 0;
    this.damageJoltPhase = 0;
    this.damageJoltFreqHz = 12;
    this.damageJoltX = 0;
    this.damageJoltY = 0;
    this.chargeCueCooldownMs = {};
    if (this.vfx) {
      this.vfx.reset();
    }
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
    this.vfx = new CombatVfxDispatcher(this.particles);
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
    this.fpsText.setVisible(Boolean(import.meta.env.DEV));
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
        pushPlayer: (offsetX, offsetY, fxColor, fxX, fxY, allowBottomEject) =>
          this.applyPlayerPush(
            offsetX,
            offsetY,
            fxColor,
            fxX,
            fxY,
            allowBottomEject,
          ),
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
    this.vfx.update(deltaMs);
    this.decayChargeCueCooldowns(deltaMs);
    this.shakeCooldownMs = Math.max(0, this.shakeCooldownMs - deltaMs);
    this.updateDamageJolt(delta);
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
      if (!this.bossActive) {
        this.bossTimerMs = 0;
        this.triggerFramePulse(0.8, 0x5bd7ff);
      }
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
      lowHealthState: this.getLowHealthState(),
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
      this.firingInputActive,
      (cue) =>
        this.emitChargeCue(
          cue.weaponId,
          cue.x,
          cue.y,
          cue.progress,
          cue.ready,
          cue.color,
        ),
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
      onBulletImpact: (x, y, spec, owner) =>
        this.vfx.onBulletImpact(x, y, spec, owner),
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
      onEnemyCharging: (enemy) => this.vfx.onEnemyCharging(enemy, deltaMs),
      onEnemyContact: (index, enemy, push, contactDamage) => {
        const fxColor =
          enemy.def.style?.lineColor ?? enemy.def.style?.fillColor ?? 0xff6b6b;
        const contactX = this.ship.x - push.nx * this.ship.radius;
        const contactY = this.ship.y - push.ny * this.ship.radius;
        this.vfx.onPlayerContact(contactX, contactY, fxColor);
        this.applyPlayerPush(push.x, push.y, fxColor, contactX, contactY);
        this.applyContactDamage(contactDamage, contactX, contactY);
        if (!this.shipAlive || this.isGameOver) return;
        enemy.takeDamage(contactDamage * 2);
        if (!enemy.active) {
          this.releaseEnemy(index, true);
        }
      },
      onEnemyDying: (enemy) => this.vfx.onEnemyDying(enemy, deltaMs),
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
    allowBottomEject?: boolean,
  ): void {
    this.collisionResolver?.applyPush(offsetX, offsetY, fxColor, fxX, fxY, {
      allowBottomEject,
    });
  }

  private applyContactDamage(amount: number, fxX?: number, fxY?: number): void {
    const beforeHp = this.ship?.hp ?? 0;
    this.collisionResolver?.applyContactDamage(amount, fxX, fxY);
    const afterHp = this.ship?.hp ?? beforeHp;
    if (beforeHp > afterHp) {
      const damageTaken = beforeHp - afterHp;
      this.runDamageTaken += damageTaken;
      this.vfx.onPlayerDamage(fxX ?? this.ship.x, fxY ?? this.ship.y);
      this.registerDamageJolt(damageTaken);
    }
  }

  private updateEnemyBullets(delta: number): void {
    updateEnemyBulletsRuntime(delta, {
      bulletContext: this.bulletContext,
      emitTrail: this.emitMissileTrail,
      enemies: this.enemies,
      enemyBullets: this.enemyBullets,
      handleExplosion: this.handleBulletExplosion,
      onBulletImpact: (x, y, spec, owner) =>
        this.vfx.onBulletImpact(x, y, spec, owner),
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
      this.vfx.onEnemySpawn(spawned);
    }
  }

  private releaseEnemy(index: number, dropGold: boolean): void {
    const enemy = this.enemies[index];
    if (!enemy) return;
    this.vfx.onEnemyDeath(enemy, dropGold);
    if (dropGold) {
      this.runEnemiesDefeated += 1;
      if (enemy.def.id === "boss") {
        this.triggerFramePulse(0.95, FRAME_SUCCESS_COLOR);
        this.triggerImpactShake(0.0032, 140);
      }
      this.dropGold(enemy);
    }
    enemy.deactivate();
    this.enemyEntered.delete(enemy);
    this.vfx.onEnemyReleased(enemy);
    this.enemies.splice(index, 1);
    this.enemyPool.push(enemy);
  }

  private damagePlayer(amount: number, fxX?: number, fxY?: number): void {
    const beforeHp = this.ship?.hp ?? 0;
    this.collisionResolver?.applyHitDamage(amount, fxX, fxY);
    const afterHp = this.ship?.hp ?? beforeHp;
    if (beforeHp > afterHp) {
      const damageTaken = beforeHp - afterHp;
      this.runDamageTaken += damageTaken;
      this.vfx.onPlayerDamage(fxX ?? this.ship.x, fxY ?? this.ship.y);
      this.registerDamageJolt(damageTaken);
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
    const deathX = this.ship.x;
    const deathY = this.ship.y;
    this.bankRunGold();
    this.clearWaveEntities();
    this.ship.flash(0.32);
    this.particles.spawnRing(
      deathX,
      deathY,
      this.ship.radius * 2.2,
      0xffffff,
      3.2,
      0.36,
      true,
    );
    this.particles.spawnSparks(deathX, deathY, 22, {
      colors: [0xffffff, 0xfff0cc, 0xff8ba0],
      drag: 0.9,
      lengthMax: 16,
      lengthMin: 8,
      lifeMax: 0.45,
      lifeMin: 0.2,
      priority: true,
      speedMax: 360,
      speedMin: 140,
      thicknessMax: 2,
      thicknessMin: 1.2,
    });
    this.particles.spawnDebris(deathX, deathY, 18, 0xffc477, {
      drag: 0.95,
      lifeMax: 1.2,
      lifeMin: 0.55,
      priority: true,
      sizeMax: 4.8,
      sizeMin: 1.8,
      speedMax: 290,
      speedMin: 110,
    });
    this.triggerFramePulse(1, FRAME_WARNING_COLOR);
    this.triggerImpactShake(0.0072, 460);
    this.registerDamageJolt(this.ship.maxHp * 0.75);
    this.time.delayedCall(PLAYER_DEATH_HIDE_SHIP_MS, () => {
      this.ship.graphics.setVisible(false);
      this.particles.spawnBurst(deathX, deathY, 92, 0xff8ba0, true);
      this.particles.spawnRing(
        deathX,
        deathY,
        this.ship.radius * 4.6,
        0xff8ba0,
        4.2,
        0.78,
        true,
      );
    });
    this.time.delayedCall(650, () => {
      this.particles.spawnDebris(deathX, deathY, 14, 0xffd59f, {
        drag: 0.96,
        lifeMax: 1.25,
        lifeMin: 0.65,
        priority: true,
        sizeMax: 4.1,
        sizeMin: 1.6,
        speedMax: 240,
        speedMin: 90,
      });
      this.particles.spawnSparks(deathX, deathY, 12, {
        colors: [0xffd59f, 0xffffff, 0xff8ba0],
        drag: 0.92,
        lengthMax: 11,
        lengthMin: 5,
        lifeMax: 0.36,
        lifeMin: 0.18,
        priority: true,
        speedMax: 220,
        speedMin: 80,
      });
    });
    this.gameOverTimer = this.time.delayedCall(
      PLAYER_DEATH_RETURN_DELAY_MS,
      () => {
        this.overlayShown = true;
        emitGameOverEvent(this.game, {
          gold: this.gold,
          wave: this.getWaveDisplay(),
        });
      },
    );
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
      const touch = this.isTouchPointer(pointer);
      if (touch) {
        this.pointerActive = true;
      }
      this.firingInputActive = true;
      this.setTargetFromPointer(pointer);
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const touch = this.isTouchPointer(pointer);
      if (touch && !this.pointerActive) return;
      this.setTargetFromPointer(pointer);
    });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (this.isTouchPointer(pointer)) {
        this.pointerActive = false;
      }
      this.firingInputActive = false;
    });
    this.input.on("pointerupoutside", (pointer: Phaser.Input.Pointer) => {
      if (this.isTouchPointer(pointer)) {
        this.pointerActive = false;
      }
      this.firingInputActive = false;
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
    const isTouchEvent = this.isTouchPointer(pointer);
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
    this.damageJoltX = 0;
    this.damageJoltY = 0;
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
    if (!import.meta.env.DEV) return;
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
      this.playAreaFrame.lineStyle(7, this.framePulseColor, glowAlpha);
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
    this.framePulseBoost = Math.max(0, this.framePulseBoost - delta * 0.65);
    const strength = this.framePulseBoost;
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
    this.triggerFramePulse(0.9, FRAME_SUCCESS_COLOR);
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

  private triggerFramePulse(strength: number, color: number): void {
    this.framePulseBoost = Math.max(
      this.framePulseBoost,
      Phaser.Math.Clamp(strength, 0, 1),
    );
    this.framePulseColor = color;
    this.drawPlayAreaFrame(
      Math.max(this.healthPulseStrength, this.framePulseBoost),
    );
  }

  private triggerImpactShake(intensity: number, durationMs: number): void {
    if (this.shakeCooldownMs > 0) return;
    this.shakeCooldownMs = SHAKE_COOLDOWN_MS;
    this.cameras.main.shake(durationMs, intensity, true);
  }

  private registerDamageJolt(damageTaken: number): void {
    if (!this.ship || damageTaken <= 0) return;
    const maxHp = Math.max(this.ship.maxHp, 1);
    const ratio = Phaser.Math.Clamp(damageTaken / maxHp, 0, 1);
    const rawAdd = Phaser.Math.Clamp(
      this.playArea.width * ratio * DAMAGE_JOLT_WIDTH_SCALE,
      DAMAGE_JOLT_MIN_ADD,
      DAMAGE_JOLT_MAX_ADD,
    );
    const headroom = Math.max(
      0,
      DAMAGE_JOLT_MAX_AMP - this.damageJoltAmplitude,
    );
    const ampAdd = Math.min(rawAdd, headroom * 0.65 + DAMAGE_JOLT_MIN_ADD);
    this.damageJoltAmplitude = Math.min(
      DAMAGE_JOLT_MAX_AMP,
      this.damageJoltAmplitude + ampAdd,
    );
    const targetFreq = Phaser.Math.Linear(
      DAMAGE_JOLT_FREQ_MIN,
      DAMAGE_JOLT_FREQ_MAX,
      Phaser.Math.Clamp(ratio * 6, 0, 1),
    );
    this.damageJoltFreqHz = Phaser.Math.Linear(
      this.damageJoltFreqHz,
      targetFreq,
      DAMAGE_JOLT_FREQ_BLEND,
    );
  }

  private updateDamageJolt(delta: number): void {
    const camera = this.cameras.main;
    if (this.damageJoltAmplitude <= DAMAGE_JOLT_STOP_EPS) {
      if (this.damageJoltX !== 0 || this.damageJoltY !== 0) {
        this.damageJoltX = 0;
        this.damageJoltY = 0;
        camera.setScroll(this.playArea.x, this.playArea.y);
      }
      return;
    }

    this.damageJoltPhase += delta * this.damageJoltFreqHz * Math.PI * 2;
    this.damageJoltX =
      Math.sin(this.damageJoltPhase) * this.damageJoltAmplitude;
    this.damageJoltY =
      Math.sin(this.damageJoltPhase * 0.5 + 0.7) *
      this.damageJoltAmplitude *
      DAMAGE_JOLT_Y_RATIO;
    camera.setScroll(
      this.playArea.x + this.damageJoltX,
      this.playArea.y + this.damageJoltY,
    );
    this.damageJoltAmplitude *= Math.exp(-delta * DAMAGE_JOLT_DECAY);
  }

  private getLowHealthState(): "critical" | "warning" | undefined {
    if (!this.shipAlive || this.ship.maxHp <= 0) return undefined;
    const ratio = this.ship.hp / this.ship.maxHp;
    if (ratio <= CRITICAL_HEALTH_THRESHOLD) return "critical";
    if (ratio <= LOW_HEALTH_THRESHOLD) return "warning";
    return undefined;
  }

  private getWaveDisplay(): number {
    if (this.levelRunner) return this.levelRunner.getWaveNumber();
    return 0;
  }

  private isTouchPointer(pointer: Phaser.Input.Pointer): boolean {
    const nativeEvent = pointer.event as PointerEvent | TouchEvent | undefined;
    if (
      typeof TouchEvent !== "undefined" &&
      nativeEvent instanceof TouchEvent
    ) {
      return true;
    }
    return (nativeEvent as PointerEvent | undefined)?.pointerType === "touch";
  }

  private decayChargeCueCooldowns(deltaMs: number): void {
    for (const weaponId of Object.keys(this.chargeCueCooldownMs)) {
      const next = this.chargeCueCooldownMs[weaponId] - deltaMs;
      if (next <= 0) {
        delete this.chargeCueCooldownMs[weaponId];
      } else {
        this.chargeCueCooldownMs[weaponId] = next;
      }
    }
  }

  private emitChargeCue(
    weaponId: string,
    x: number,
    y: number,
    progress: number,
    ready: boolean,
    color: number,
  ): void {
    if (progress <= 0) return;
    const cooldown = this.chargeCueCooldownMs[weaponId] ?? 0;
    if (cooldown > 0) return;
    this.chargeCueCooldownMs[weaponId] = Phaser.Math.Linear(
      CHARGE_CUE_COOLDOWN_MAX_MS,
      CHARGE_CUE_COOLDOWN_MIN_MS,
      Phaser.Math.Clamp(progress, 0, 1),
    );

    const cueColor = ready ? 0xc4f7ff : color;
    const pullRadius = this.ship.radius * (0.6 + progress * 0.7);
    const inwardCount = Math.round(1 + progress * 4 + (ready ? 1 : 0));
    this.particles.spawnInward(x, y, inwardCount, cueColor, pullRadius);
    if (ready) {
      this.particles.spawnRing(
        x,
        y,
        this.ship.radius * 0.58,
        cueColor,
        1.8,
        0.23,
      );
      this.particles.spawnSparks(x, y, 2, {
        colors: [cueColor, 0xffffff],
        drag: 0.9,
        lengthMax: 7,
        lengthMin: 3,
        lifeMax: 0.2,
        lifeMin: 0.11,
        speedMax: 110,
        speedMin: 45,
      });
      return;
    }
    if (progress >= 0.45) {
      this.particles.spawnRing(
        x,
        y,
        this.ship.radius * (0.28 + progress * 0.16),
        cueColor,
        1.2,
        0.12,
      );
    }
  }
}
