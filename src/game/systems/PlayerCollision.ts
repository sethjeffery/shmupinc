import type { Ship } from "../entities/Ship";
import type { ParticleSystem } from "./Particles";

interface CollisionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BumpFxConfig {
  burstCount: number;
  color: number;
  cooldownMs: number;
  ringLife: number;
  ringRadius: number;
  ringThickness: number;
}

interface DamageFxConfig {
  angleMax: number;
  angleMin: number;
  colors: number[];
  cooldownMs: number;
  drag: number;
  lengthMax: number;
  lengthMin: number;
  lifeMax: number;
  lifeMin: number;
  sparkCount: number;
  speedMax: number;
  speedMin: number;
  thicknessMax: number;
  thicknessMin: number;
}

interface PlayerCollisionConfig {
  bumpFx: BumpFxConfig;
  damageFx: DamageFxConfig;
  damageMultiplier: number;
  hitCooldownSec: number;
  padding: number;
}

interface PlayerCollisionContext {
  canDamage: () => boolean;
  getBounds: () => CollisionBounds;
  onDeath: () => void;
  particles: ParticleSystem;
  ship: Ship;
}

interface ApplyPushOptions {
  allowBottomEject?: boolean;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export class PlayerCollisionResolver {
  private config: PlayerCollisionConfig;
  private context: PlayerCollisionContext;
  private hitCooldown = 0;
  private bumpFxCooldownMs = 0;
  private damageFxCooldownMs = 0;

  constructor(config: PlayerCollisionConfig, context: PlayerCollisionContext) {
    this.config = config;
    this.context = context;
  }

  update(deltaMs: number): void {
    const deltaSec = deltaMs / 1000;
    this.hitCooldown = Math.max(0, this.hitCooldown - deltaSec);
    this.bumpFxCooldownMs = Math.max(0, this.bumpFxCooldownMs - deltaMs);
    this.damageFxCooldownMs = Math.max(0, this.damageFxCooldownMs - deltaMs);
  }

  applyPush(
    offsetX: number,
    offsetY: number,
    fxColor?: number,
    fxX?: number,
    fxY?: number,
    options?: ApplyPushOptions,
  ): void {
    if (!this.context.canDamage()) return;
    const bounds = this.context.getBounds();
    const minX = bounds.x + bounds.width * this.config.padding;
    const maxX = bounds.x + bounds.width * (1 - this.config.padding);
    const minY = bounds.y + bounds.height * this.config.padding;
    const maxY = bounds.y + bounds.height * (1 - this.config.padding);
    const bottom = bounds.y + bounds.height;
    const ship = this.context.ship;
    const nextX = clamp(ship.x + offsetX, minX, maxX);
    const targetY = ship.y + offsetY;
    const nextY = options?.allowBottomEject
      ? Math.max(targetY, minY)
      : clamp(targetY, minY, maxY);
    ship.setPosition(nextX, nextY);
    this.emitBumpFx(fxColor, fxX, fxY);
    if (options?.allowBottomEject && ship.y >= bottom) {
      ship.hp = 0;
      this.context.onDeath();
    }
  }

  applyContactDamage(amount: number, fxX?: number, fxY?: number): void {
    if (!this.context.canDamage() || amount <= 0) return;
    this.applyDamage(amount);
    this.emitDamageFx(fxX, fxY, false);
  }

  applyHitDamage(amount: number, fxX?: number, fxY?: number): void {
    if (!this.context.canDamage() || amount <= 0) return;
    if (this.hitCooldown > 0) return;
    this.hitCooldown = this.config.hitCooldownSec;
    this.applyDamage(amount);
    this.context.ship.flash();
    this.emitDamageFx(fxX, fxY, true);
  }

  private applyDamage(amount: number): void {
    const ship = this.context.ship;
    const scaled = amount * this.config.damageMultiplier;
    ship.hp = Math.max(0, ship.hp - scaled);
    if (ship.hp <= 0) {
      this.context.onDeath();
    }
  }

  private emitBumpFx(color?: number, fxX?: number, fxY?: number): void {
    if (this.bumpFxCooldownMs > 0) return;
    this.bumpFxCooldownMs = this.config.bumpFx.cooldownMs;
    const fxColor = color ?? this.config.bumpFx.color;
    const x = fxX ?? this.context.ship.x;
    const y = fxY ?? this.context.ship.y;
    this.context.particles.spawnBurst(
      x,
      y,
      this.config.bumpFx.burstCount,
      fxColor,
    );
    this.context.particles.spawnRing(
      x,
      y,
      this.config.bumpFx.ringRadius,
      fxColor,
      this.config.bumpFx.ringThickness,
      this.config.bumpFx.ringLife,
    );
  }

  private emitDamageFx(fxX?: number, fxY?: number, force = false): void {
    if (!force && this.damageFxCooldownMs > 0) return;
    this.damageFxCooldownMs = this.config.damageFx.cooldownMs;
    const x = fxX ?? this.context.ship.x;
    const y = fxY ?? this.context.ship.y;
    const fx = this.config.damageFx;
    this.context.particles.spawnSparks(x, y, fx.sparkCount, {
      angleMax: fx.angleMax,
      angleMin: fx.angleMin,
      colors: fx.colors,
      drag: fx.drag,
      lengthMax: fx.lengthMax,
      lengthMin: fx.lengthMin,
      lifeMax: fx.lifeMax,
      lifeMin: fx.lifeMin,
      speedMax: fx.speedMax,
      speedMin: fx.speedMin,
      thicknessMax: fx.thicknessMax,
      thicknessMin: fx.thicknessMin,
    });
  }
}
