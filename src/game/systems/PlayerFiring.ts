import type { MountedWeapon } from "../data/save";
import type { BulletSpec } from "../data/scripts";
import type { WeaponShot } from "../data/weaponTypes";
import type { EmitBullet } from "./FireScriptRunner";

import { DEFAULT_WEAPON_SHOTS } from "../data/weaponTypes";

interface PlayerChargeCue {
  color: number;
  progress: number;
  ready: boolean;
  weaponId: string;
  x: number;
  y: number;
}

const CHARGED_DAMAGE_MULTIPLIER = 2;
const CHARGE_IDLE_SEC = 1.3;
const FALLBACK_CHARGE_COLOR = 0x7df9ff;

export class PlayerFiring {
  private timers: Record<string, number> = {};
  private idleTimers: Record<string, number> = {};
  private chargedReady: Record<string, boolean> = {};
  private activeIds = new Set<string>();
  private burstIndices: Record<string, number> = {};

  reset(): void {
    this.timers = {};
    this.idleTimers = {};
    this.chargedReady = {};
    this.activeIds.clear();
    this.burstIndices = {};
  }

  update(
    delta: number,
    shipX: number,
    shipY: number,
    shipRadius: number,
    mountedWeapons: MountedWeapon[],
    emit: EmitBullet,
    shooting: boolean,
    onChargeCue?: (cue: PlayerChargeCue) => void,
    debugBulletSpec?: BulletSpec,
  ): void {
    if (mountedWeapons.length === 0) return;
    this.activeIds.clear();
    for (const mounted of mountedWeapons) {
      const weaponId = mounted.instanceId;
      this.activeIds.add(weaponId);
      const rate = Math.max(0.05, mounted.stats.fireRate);
      const interval = 1 / rate;
      const cueOrigin = this.getChargeCueOrigin(
        weaponId,
        mounted,
        shipX,
        shipY,
        shipRadius,
      );
      const cueColor = mounted.stats.bullet.color ?? FALLBACK_CHARGE_COLOR;
      if (!shooting) {
        const idleNext = (this.idleTimers[weaponId] ?? 0) + delta;
        this.idleTimers[weaponId] = idleNext;
        const progress = Math.min(1, idleNext / CHARGE_IDLE_SEC);
        if (progress >= 1) {
          this.chargedReady[weaponId] = true;
        }
        onChargeCue?.({
          color: cueColor,
          progress,
          ready: this.chargedReady[weaponId] ?? false,
          weaponId,
          x: cueOrigin.x,
          y: cueOrigin.y,
        });
        continue;
      }

      this.idleTimers[weaponId] = 0;
      const timer = (this.timers[weaponId] ?? 0) + delta;
      if (timer < interval) {
        this.timers[weaponId] = timer;
        continue;
      }
      this.timers[weaponId] = timer - interval;
      const resolvedBullet = {
        ...(debugBulletSpec ?? mounted.stats.bullet),
        speed: mounted.stats.speed,
      };
      const chargedShot = this.chargedReady[weaponId] ?? false;
      if (chargedShot) {
        this.chargedReady[weaponId] = false;
      }
      this.emitWeaponBurst(
        weaponId,
        mounted,
        shipX,
        shipY,
        shipRadius,
        resolvedBullet,
        emit,
        chargedShot,
      );
    }

    for (const id in this.timers) {
      if (!this.activeIds.has(id)) delete this.timers[id];
    }
    for (const id in this.idleTimers) {
      if (!this.activeIds.has(id)) delete this.idleTimers[id];
    }
    for (const id in this.chargedReady) {
      if (!this.activeIds.has(id)) delete this.chargedReady[id];
    }
    for (const id in this.burstIndices) {
      if (!this.activeIds.has(id)) delete this.burstIndices[id];
    }
  }

  private emitWeaponBurst(
    weaponId: string,
    mounted: MountedWeapon,
    shipX: number,
    shipY: number,
    shipRadius: number,
    bulletSpec: BulletSpec,
    emit: EmitBullet,
    chargedShot: boolean,
  ): void {
    const mount = mounted.mount;
    const stats = mounted.stats;
    const mountX = shipX + mount.offset.x * shipRadius;
    const mountY = shipY + mount.offset.y * shipRadius;
    const mirror = mount.offset.x < 0;
    const angleSign = mirror ? -1 : 1;
    const angleOffset = (stats.angleDeg ?? 0) * (Math.PI / 180) * angleSign;
    this.emitPattern(
      weaponId,
      stats.shots ?? DEFAULT_WEAPON_SHOTS,
      stats.multiShotMode,
      mountX,
      mountY,
      shipRadius,
      bulletSpec,
      emit,
      angleOffset,
      angleSign,
      chargedShot,
    );
  }

  private emitPattern(
    weaponId: string,
    shots: WeaponShot[],
    multiShotMode: MountedWeapon["stats"]["multiShotMode"] | undefined,
    originX: number,
    originY: number,
    shipRadius: number,
    bulletSpec: BulletSpec,
    emit: EmitBullet,
    angleOffset = 0,
    angleSign = 1,
    chargedShot = false,
  ): void {
    const baseAngle = -Math.PI / 2;
    const count = Math.max(1, shots.length);
    let chargePending = chargedShot;
    if (multiShotMode === "roundRobin" && count > 1) {
      const index = this.burstIndices[weaponId] ?? 0;
      this.burstIndices[weaponId] = (index + 1) % count;
      const shotSpec = chargePending
        ? this.createChargedBullet(bulletSpec)
        : bulletSpec;
      this.emitSingleShot(
        shots,
        index,
        baseAngle,
        originX,
        originY,
        shipRadius,
        shotSpec,
        emit,
        angleOffset,
        angleSign,
      );
      return;
    }
    for (let i = 0; i < count; i += 1) {
      const shotSpec = chargePending
        ? this.createChargedBullet(bulletSpec)
        : bulletSpec;
      chargePending = false;
      this.emitSingleShot(
        shots,
        i,
        baseAngle,
        originX,
        originY,
        shipRadius,
        shotSpec,
        emit,
        angleOffset,
        angleSign,
      );
    }
  }

  private emitSingleShot(
    shots: WeaponShot[],
    index: number,
    baseAngle: number,
    originX: number,
    originY: number,
    shipRadius: number,
    bulletSpec: BulletSpec,
    emit: EmitBullet,
    angleOffset: number,
    angleSign: number,
  ): void {
    const shot = shots[index] ?? DEFAULT_WEAPON_SHOTS[0];
    const shotAngle = (shot.angleDeg ?? 0) * angleSign;
    const relativeAngle = angleOffset + (shotAngle * Math.PI) / 180;
    const angle = baseAngle + relativeAngle;
    const localX = (shot.offset?.x ?? 0) * shipRadius * angleSign;
    const localY = (shot.offset?.y ?? 0) * shipRadius;
    const cos = Math.cos(relativeAngle);
    const sin = Math.sin(relativeAngle);
    const offsetX = localX * cos - localY * sin;
    const offsetY = localX * sin + localY * cos;
    emit(originX + offsetX, originY + offsetY, angle, bulletSpec);
  }

  private getChargeCueOrigin(
    weaponId: string,
    mounted: MountedWeapon,
    shipX: number,
    shipY: number,
    shipRadius: number,
  ): { x: number; y: number } {
    const mount = mounted.mount;
    const stats = mounted.stats;
    const originX = shipX + mount.offset.x * shipRadius;
    const originY = shipY + mount.offset.y * shipRadius;
    const shots = stats.shots ?? DEFAULT_WEAPON_SHOTS;
    if (shots.length === 0) {
      return { x: originX, y: originY };
    }
    const shotIndex =
      stats.multiShotMode === "roundRobin" && shots.length > 1
        ? (this.burstIndices[weaponId] ?? 0) % shots.length
        : 0;
    const shot = shots[shotIndex] ?? DEFAULT_WEAPON_SHOTS[0];
    const mirror = mount.offset.x < 0;
    const angleSign = mirror ? -1 : 1;
    const angleOffset = (stats.angleDeg ?? 0) * (Math.PI / 180) * angleSign;
    const shotAngle = (shot.angleDeg ?? 0) * angleSign;
    const relativeAngle = angleOffset + (shotAngle * Math.PI) / 180;
    const localX = (shot.offset?.x ?? 0) * shipRadius * angleSign;
    const localY = (shot.offset?.y ?? 0) * shipRadius;
    const cos = Math.cos(relativeAngle);
    const sin = Math.sin(relativeAngle);
    const offsetX = localX * cos - localY * sin;
    const offsetY = localX * sin + localY * cos;
    return { x: originX + offsetX, y: originY + offsetY };
  }

  private createChargedBullet(spec: BulletSpec): BulletSpec {
    const baseColor = spec.color ?? FALLBACK_CHARGE_COLOR;
    const chargedColor = this.boostColor(baseColor, 1.4);
    const baseTrail = spec.trail;
    const baseVfx = spec.vfx;
    return {
      ...spec,
      color: chargedColor,
      damage: spec.damage * CHARGED_DAMAGE_MULTIPLIER,
      length: spec.length ? spec.length * 1.2 : spec.length,
      radius: spec.radius * 1.15,
      thickness: spec.thickness ? spec.thickness * 1.25 : spec.thickness,
      trail: {
        ...(baseTrail ?? {}),
        color: chargedColor,
        count: Math.max(baseTrail?.count ?? 1, 2),
        intervalMs: Math.min(baseTrail?.intervalMs ?? 60, 55),
        kind: "spark",
        sizeMax: baseTrail?.sizeMax ?? 2.2,
        sizeMin: baseTrail?.sizeMin ?? 1.1,
      },
      vfx: {
        ...baseVfx,
        impact: {
          ...baseVfx?.impact,
          color: chargedColor,
          sparkCount: Math.max(baseVfx?.impact?.sparkCount ?? 6, 11),
        },
        muzzle: {
          ...baseVfx?.muzzle,
          burstCount: Math.max(baseVfx?.muzzle?.burstCount ?? 0, 4),
          color: chargedColor,
          lifeMs: Math.max(baseVfx?.muzzle?.lifeMs ?? 90, 125),
          radius: Math.max(
            baseVfx?.muzzle?.radius ?? spec.radius * 2,
            spec.radius * 2.4,
          ),
        },
      },
    };
  }

  private boostColor(color: number, factor: number): number {
    const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
    const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
    const b = Math.min(255, Math.round((color & 0xff) * factor));
    return (r << 16) | (g << 8) | b;
  }
}
