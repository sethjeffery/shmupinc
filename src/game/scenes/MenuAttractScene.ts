import type { EnemyHitbox, EnemyId } from "../data/enemyTypes";
import type { BulletSpec } from "../data/scripts";
import type { Enemy } from "../entities/Enemy";

import Phaser from "phaser";

import { ENEMIES } from "../data/enemies";
import { SHIPS, STARTER_SHIP_ID } from "../data/ships";
import { resolveShipHitbox, resolveShipRadius } from "../data/shipTypes";
import { parseVectorColor } from "../data/vectorShape";
import { Bullet, type BulletUpdateContext } from "../entities/Bullet";
import { Ship } from "../entities/Ship";
import {
  circleHitboxOverlap,
  resolveHitboxHitboxPenetration,
} from "../systems/hitbox";
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
import { ObjectPool } from "../util/pool";

const MENU_ORB_BULLET: BulletSpec = {
  color: 0x7df9ff,
  damage: 1,
  kind: "orb",
  radius: 3,
  speed: 320,
};

const MENU_FIRE_INTERVAL_MS = 180;
const MENU_WAVE_INTERVAL_MIN_MS = 950;
const MENU_WAVE_INTERVAL_MAX_MS = 1900;
const MENU_MARGIN = 120;
const MENU_SHIP_PADDING = 0.08;
const MENU_CONTACT_DAMAGE_PER_SEC = 0;
const MENU_EXIT_DASH_MS = 640;
const MENU_FINISH_LINGER_MS = 2100;
const MENU_ENEMY_BULLET_CHANCE = 0.66;
const ALIGN_TARGET_MIN_MS = 480;
const ALIGN_TARGET_MAX_MS = 920;
const ALIGN_X_LERP = 0.82;

const MENU_ENEMY_CONTACT_COLOR = 0xff6b6b;

export class MenuAttractScene extends Phaser.Scene {
  private playArea = new Phaser.Geom.Rectangle();
  private target = new Phaser.Math.Vector2();
  private ship!: Ship;
  private parallax!: ParallaxBackground;
  private particles!: ParticleSystem;
  private vfx!: CombatVfxDispatcher;
  private playerBullets!: ObjectPool<Bullet>;
  private enemyBullets!: ObjectPool<Bullet>;
  private enemies: Enemy[] = [];
  private enemyPool: Enemy[] = [];
  private enemyEntered = new WeakMap<Enemy, boolean>();
  private enemyIds: EnemyId[] = [];
  private fireCooldownMs = 0;
  private waveCooldownMs = 0;
  private driftElapsedSec = 0;
  private alignCooldownMs = 0;
  private alignTargetX: null | number = null;
  private rosterIndex = 0;
  private collisionPush = {
    contactX: 0,
    contactY: 0,
    nx: 0,
    ny: 0,
    x: 0,
    y: 0,
  };
  private bulletContext: BulletUpdateContext = {
    enemies: [],
    playerAlive: false,
    playerX: 0,
    playerY: 0,
  };

  constructor() {
    super("MenuAttractScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#04060a");
    this.enemyIds = this.buildMenuEnemyRoster();

    this.updatePlayArea();
    this.parallax = new ParallaxBackground(this, this.playArea);
    this.particles = new ParticleSystem(this);
    this.vfx = new CombatVfxDispatcher(this.particles);

    const shipDef = SHIPS[STARTER_SHIP_ID] ?? Object.values(SHIPS)[0];
    if (!shipDef) {
      throw new Error("No ship definitions are available for menu simulation.");
    }

    this.ship = new Ship(this, {
      hitbox: resolveShipHitbox(shipDef),
      maxHp: shipDef.maxHp,
      moveSpeed: shipDef.moveSpeed,
      radius: resolveShipRadius(shipDef),
      vector: shipDef.vector,
    });
    this.ship.setStrokeWidth(1.1);

    this.playerBullets = new ObjectPool(
      () => new Bullet(this, { owner: "player" }),
      22,
    );
    this.enemyBullets = new ObjectPool(
      () => new Bullet(this, { owner: "enemy" }),
      30,
    );

    this.repositionShip();
    this.fireCooldownMs = MENU_FIRE_INTERVAL_MS;
    this.waveCooldownMs = 420;
    this.alignCooldownMs = Phaser.Math.Between(
      ALIGN_TARGET_MIN_MS,
      ALIGN_TARGET_MAX_MS,
    );

    this.scale.off("resize", this.onResize, this);
    this.scale.on("resize", this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.onResize, this);
      this.enemies.length = 0;
      this.enemyPool.length = 0;
      this.enemyEntered = new WeakMap();
      if (this.vfx) {
        this.vfx.reset();
      }
    });
  }

  update(_time: number, deltaMs: number): void {
    const delta = deltaMs / 1000;
    this.driftElapsedSec += delta;

    this.parallax.update(delta);
    this.particles.update(delta);
    this.vfx.update(deltaMs);
    this.updateShipAutopilot(delta);
    this.updateAutoFire(deltaMs);
    this.updateWaveSpawner(deltaMs);
    this.updateEnemies(deltaMs);
    this.updatePlayerBullets(delta);
    this.updateEnemyBullets(delta);
  }

  private updateShipAutopilot(delta: number): void {
    this.alignCooldownMs -= delta * 1000;
    if (this.alignCooldownMs <= 0) {
      this.alignCooldownMs = Phaser.Math.Between(
        ALIGN_TARGET_MIN_MS,
        ALIGN_TARGET_MAX_MS,
      );
      this.alignTargetX = this.findNearestEnemyX();
    }

    const centerX = this.playArea.x + this.playArea.width * 0.5;
    const xSpan = this.playArea.width * 0.34;
    const driftWave =
      Math.sin(this.driftElapsedSec * 0.57) * 0.72 +
      Math.sin(this.driftElapsedSec * 0.19 + 1.1) * 0.28;
    const driftTargetX = centerX + driftWave * xSpan;
    const targetX =
      this.alignTargetX === null
        ? driftTargetX
        : Phaser.Math.Linear(driftTargetX, this.alignTargetX, ALIGN_X_LERP);
    const targetY = this.playArea.y + this.playArea.height * 0.82;
    this.target.set(targetX, targetY);
    this.ship.update(
      delta,
      this.target.x,
      this.target.y,
      this.playArea,
      MENU_SHIP_PADDING,
    );
  }

  private updateAutoFire(deltaMs: number): void {
    this.fireCooldownMs -= deltaMs;
    while (this.fireCooldownMs <= 0) {
      this.fireCooldownMs += MENU_FIRE_INTERVAL_MS;
      const jitter = Phaser.Math.FloatBetween(-0.015, 0.015);
      const muzzleY = this.ship.y - this.ship.radius * 1.18;
      const muzzleOffset = this.ship.radius * 0.52;
      const leftX = this.ship.x - muzzleOffset;
      const rightX = this.ship.x + muzzleOffset;
      const leftAngle = -Math.PI / 2 - 0.018 + jitter;
      const rightAngle = -Math.PI / 2 + 0.018 - jitter;
      this.vfx.onShotEmit("player", leftX, muzzleY, MENU_ORB_BULLET);
      const leftBullet = this.playerBullets.acquire();
      leftBullet.spawn(leftX, muzzleY, leftAngle, MENU_ORB_BULLET);
      this.vfx.onShotEmit("player", rightX, muzzleY, MENU_ORB_BULLET);
      const rightBullet = this.playerBullets.acquire();
      rightBullet.spawn(rightX, muzzleY, rightAngle, MENU_ORB_BULLET);
    }
  }

  private updateWaveSpawner(deltaMs: number): void {
    this.waveCooldownMs -= deltaMs;
    if (this.waveCooldownMs > 0) return;

    this.spawnWave();
    this.waveCooldownMs = Phaser.Math.Between(
      MENU_WAVE_INTERVAL_MIN_MS,
      MENU_WAVE_INTERVAL_MAX_MS,
    );
  }

  private spawnWave(): void {
    if (this.enemyIds.length === 0) return;

    const count = Phaser.Math.Between(2, 5);
    const formation = Phaser.Math.Between(0, 2);
    const baseX = Phaser.Math.FloatBetween(-0.22, 0.22);
    const spacing = Phaser.Math.FloatBetween(0.13, 0.19);

    for (let i = 0; i < count; i += 1) {
      const enemyId = this.enemyIds[this.rosterIndex % this.enemyIds.length];
      this.rosterIndex += 1;

      let spawnX = baseX + (i - (count - 1) * 0.5) * spacing;
      if (formation === 1) {
        spawnX += Math.sin(i * 1.4) * 0.08;
      } else if (formation === 2) {
        spawnX += (i % 2 === 0 ? -1 : 1) * Phaser.Math.FloatBetween(0.02, 0.08);
      }
      spawnX = Phaser.Math.Clamp(spawnX, -0.45, 0.45);
      const spawnY = -Phaser.Math.FloatBetween(0.06, 0.16);

      spawnEnemyRuntime(enemyId, {
        enemies: this.enemies,
        enemyPool: this.enemyPool,
        hpMultiplier: 0.8,
        playArea: this.playArea,
        scene: this,
        spawnX,
        spawnY,
      });

      const spawned = this.enemies[this.enemies.length - 1];
      if (spawned) {
        this.enemyEntered.set(spawned, false);
        this.vfx.onEnemySpawn(spawned);
      }
    }
  }

  private updatePlayerBullets(delta: number): void {
    updatePlayerBulletsRuntime(delta, {
      bulletContext: this.bulletContext,
      emitTrail: (x, y, angleRad, spec) => {
        this.vfx.onBulletTrail(x, y, angleRad, spec);
      },
      enemies: this.enemies,
      enemyBullets: this.enemyBullets,
      handleExplosion: (x, y, spec, owner) =>
        this.handleBulletExplosion(x, y, spec, owner),
      onBulletImpact: (x, y, spec, owner) => {
        this.vfx.onBulletImpact(x, y, spec, owner);
      },
      onEnemyKilled: (enemyIndex) =>
        this.releaseEnemy(enemyIndex, { defeated: true }),
      playArea: this.playArea,
      playerAlive: false,
      playerBullets: this.playerBullets,
      playerHitbox: this.ship.hitbox,
      playerRadius: this.ship.radius,
      playerX: this.ship.x,
      playerY: this.ship.y,
    });
  }

  private updateEnemyBullets(delta: number): void {
    updateEnemyBulletsRuntime(delta, {
      bulletContext: this.bulletContext,
      emitTrail: (x, y, angleRad, spec) => {
        this.vfx.onBulletTrail(x, y, angleRad, spec);
      },
      enemies: this.enemies,
      enemyBullets: this.enemyBullets,
      handleExplosion: (x, y, spec, owner) =>
        this.handleBulletExplosion(x, y, spec, owner),
      onBulletImpact: (x, y, spec, owner) => {
        this.vfx.onBulletImpact(x, y, spec, owner);
        this.vfx.onBulletExplosion(x, y, spec, owner);
      },
      onDamagePlayer: (_amount, fxX, fxY) => {
        this.vfx.onPlayerContact(
          fxX ?? this.ship.x,
          fxY ?? this.ship.y,
          MENU_ENEMY_CONTACT_COLOR,
        );
      },
      onEnemyKilled: (enemyIndex) =>
        this.releaseEnemy(enemyIndex, { defeated: true }),
      playArea: this.playArea,
      playerAlive: true,
      playerBullets: this.playerBullets,
      playerHitbox: this.ship.hitbox,
      playerRadius: this.ship.radius,
      playerX: this.ship.x,
      playerY: this.ship.y,
    });
  }

  private updateEnemies(deltaMs: number): void {
    updateEnemiesRuntime({
      bounds: this.playArea,
      contactDamagePerSec: MENU_CONTACT_DAMAGE_PER_SEC,
      deltaMs,
      emitEnemyBullet: (x, y, angleRad, bulletSpec) => {
        if (Math.random() > MENU_ENEMY_BULLET_CHANCE) return;
        this.vfx.onShotEmit("enemy", x, y, bulletSpec);
        const bullet = this.enemyBullets.acquire();
        bullet.spawn(x, y, angleRad, bulletSpec);
      },
      enemies: this.enemies,
      exitDashMs: MENU_EXIT_DASH_MS,
      finishLingerMs: MENU_FINISH_LINGER_MS,
      getEnemyEntered: (enemy) => this.enemyEntered.get(enemy) ?? false,
      getEnemyPush: (enemyX, enemyY, enemyHitbox) =>
        this.getEnemyPush(enemyX, enemyY, enemyHitbox),
      margin: MENU_MARGIN,
      markEnemyEntered: (enemy) => {
        this.enemyEntered.set(enemy, true);
      },
      onEnemyCharging: (enemy) => this.vfx.onEnemyCharging(enemy, deltaMs),
      onEnemyContact: (enemyIndex, enemy, push) => {
        const enemyColor =
          parseVectorColor(enemy.def.style?.color) ?? MENU_ENEMY_CONTACT_COLOR;
        this.vfx.onPlayerContact(push.contactX, push.contactY, enemyColor);
        this.releaseEnemy(enemyIndex, { defeated: true });
      },
      onEnemyDying: (enemy) => this.vfx.onEnemyDying(enemy, deltaMs),
      onReleaseEnemy: (enemyIndex) => this.releaseEnemy(enemyIndex),
      playerAlive: true,
      playerX: this.ship.x,
      playerY: this.ship.y,
    });
  }

  private releaseEnemy(index: number, options?: { defeated?: boolean }): void {
    const enemy = this.enemies[index];
    if (!enemy) return;
    if (options?.defeated) {
      this.vfx.onEnemyDeath(enemy, true);
    }
    enemy.deactivate();
    this.vfx.onEnemyReleased(enemy);
    this.enemyEntered.delete(enemy);
    this.enemies.splice(index, 1);
    this.enemyPool.push(enemy);
  }

  private handleBulletExplosion(
    x: number,
    y: number,
    spec: BulletSpec,
    owner: "enemy" | "player",
  ): void {
    const explosion = this.vfx.onBulletExplosion(x, y, spec, owner);
    if (owner !== "player") return;
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      if (!enemy?.active) continue;
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
        if (!enemy.active) {
          this.releaseEnemy(i, { defeated: true });
        }
      }
    }
  }

  private getEnemyPush(
    enemyX: number,
    enemyY: number,
    enemyHitbox: EnemyHitbox,
  ): {
    contactX: number;
    contactY: number;
    nx: number;
    ny: number;
    x: number;
    y: number;
  } | null {
    const penetration = resolveHitboxHitboxPenetration(
      this.ship.x,
      this.ship.y,
      this.ship.hitbox,
      enemyX,
      enemyY,
      enemyHitbox,
    );
    if (!penetration) return null;
    const out = this.collisionPush;
    out.contactX = penetration.contactX;
    out.contactY = penetration.contactY;
    out.nx = penetration.nx;
    out.ny = penetration.ny;
    out.x = penetration.nx * penetration.depth;
    out.y = penetration.ny * penetration.depth;
    return out;
  }

  private updatePlayArea(): void {
    this.playArea.setTo(0, 0, this.scale.width, this.scale.height);
    const camera = this.cameras.main;
    camera.setViewport(0, 0, this.playArea.width, this.playArea.height);
    camera.setSize(this.playArea.width, this.playArea.height);
    camera.setScroll(0, 0);
    this.parallax?.setBounds(this.playArea);
    for (const enemy of this.enemies) {
      enemy.setPlayfieldSize(this.playArea.width, this.playArea.height);
    }
  }

  private repositionShip(): void {
    const nextX = Phaser.Math.Clamp(
      this.ship.x || this.playArea.x + this.playArea.width * 0.5,
      this.playArea.x + this.playArea.width * MENU_SHIP_PADDING,
      this.playArea.x + this.playArea.width * (1 - MENU_SHIP_PADDING),
    );
    const nextY = this.playArea.y + this.playArea.height * 0.82;
    this.ship.setPosition(nextX, nextY);
    this.target.set(nextX, nextY);
  }

  private buildMenuEnemyRoster(): EnemyId[] {
    const ids = Object.entries(ENEMIES)
      .filter(([_, enemy]) => enemy.hp < 10 && enemy.fire)
      .map(([id]) => id);

    return ids.length > 3 ? ids : Object.keys(ENEMIES);
  }

  private findNearestEnemyX(): null | number {
    let nearestDistance = Number.POSITIVE_INFINITY;
    let nearestX: null | number = null;
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      const distance = Phaser.Math.Distance.Between(
        this.ship.x,
        this.ship.y,
        enemy.x,
        enemy.y,
      );
      if (distance >= nearestDistance) continue;
      nearestDistance = distance;
      nearestX = enemy.x;
    }
    return nearestX;
  }

  private onResize = (_gameSize: Phaser.Structs.Size): void => {
    this.updatePlayArea();
    if (this.ship) {
      this.repositionShip();
    }
  };
}
