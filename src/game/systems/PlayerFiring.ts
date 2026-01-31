import type { MountedWeapon } from "../data/save";
import type { BulletSpec } from "../data/scripts";
import type { WeaponShot } from "../data/weaponTypes";
import type { EmitBullet } from "./FireScriptRunner";

import { DEFAULT_WEAPON_SHOTS } from "../data/weaponTypes";

export class PlayerFiring {
  private timers: Record<string, number> = {};
  private activeIds: string[] = [];
  private burstIndices: Record<string, number> = {};

  reset(): void {
    this.timers = {};
    this.activeIds.length = 0;
    this.burstIndices = {};
  }

  update(
    delta: number,
    shipX: number,
    shipY: number,
    shipRadius: number,
    mountedWeapons: MountedWeapon[],
    emit: EmitBullet,
    debugBulletSpec?: BulletSpec,
  ): void {
    if (mountedWeapons.length === 0) return;
    this.activeIds.length = 0;
    for (const mounted of mountedWeapons) {
      const weaponId = mounted.instanceId;
      this.activeIds.push(weaponId);
      const rate = Math.max(0.05, mounted.stats.fireRate);
      const interval = 1 / rate;
      const timer = (this.timers[weaponId] ?? 0) + delta;
      if (timer >= interval) {
        this.timers[weaponId] = timer - interval;
        const resolvedBullet = {
          ...(debugBulletSpec ?? mounted.stats.bullet),
          speed: mounted.stats.speed,
        };
        this.emitWeaponBurst(
          weaponId,
          mounted,
          shipX,
          shipY,
          shipRadius,
          resolvedBullet,
          emit,
        );
      } else {
        this.timers[weaponId] = timer;
      }
    }

    for (const id in this.timers) {
      if (!this.activeIds.includes(id)) {
        delete this.timers[id];
        delete this.burstIndices[id];
      }
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
  ): void {
    const baseAngle = -Math.PI / 2;
    const count = Math.max(1, shots.length);
    if (multiShotMode === "roundRobin" && count > 1) {
      const index = this.burstIndices[weaponId] ?? 0;
      this.burstIndices[weaponId] = (index + 1) % count;
      this.emitSingleShot(
        shots,
        index,
        baseAngle,
        originX,
        originY,
        shipRadius,
        bulletSpec,
        emit,
        angleOffset,
        angleSign,
      );
      return;
    }
    for (let i = 0; i < count; i += 1) {
      this.emitSingleShot(
        shots,
        i,
        baseAngle,
        originX,
        originY,
        shipRadius,
        bulletSpec,
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
}
