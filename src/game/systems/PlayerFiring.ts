import type { BulletSpec } from '../data/scripts';
import type { SecondaryWeaponDefinition } from '../data/secondaryWeapons';
import type { WeaponPattern } from '../data/weaponPatterns';
import type { WeaponDefinition } from '../data/weapons';
import type { EmitBullet } from './FireScriptRunner';

import { resolveWeaponAngles } from '../data/weaponPatterns';

export class PlayerFiring {
  private primaryTimer = 0;
  private secondaryTimer = 0;

  reset(): void {
    this.primaryTimer = 0;
    this.secondaryTimer = 0;
  }

  update(
    delta: number,
    shipX: number,
    shipY: number,
    shipRadius: number,
    primary: null | WeaponDefinition,
    secondary: null | SecondaryWeaponDefinition,
    emit: EmitBullet,
    debugBulletSpec?: BulletSpec,
  ): void {
    if (!primary) return;
    this.primaryTimer += delta;
    const primaryInterval = 1 / primary.fireRate;
    if (this.primaryTimer >= primaryInterval) {
      this.primaryTimer -= primaryInterval;
      this.emitPrimaryBurst(
        primary,
        shipX,
        shipY - shipRadius,
        shipRadius,
        debugBulletSpec ?? primary.bullet,
        emit,
      );
    }

    if (!secondary) return;
    this.secondaryTimer += delta;
    const secondaryInterval = 1 / secondary.fireRate;
    if (this.secondaryTimer >= secondaryInterval) {
      this.secondaryTimer -= secondaryInterval;
      this.emitSecondaryBurst(
        secondary,
        shipX,
        shipY + shipRadius * 0.1,
        shipRadius,
        debugBulletSpec ?? secondary.bullet,
        emit,
      );
    }
  }

  private emitPrimaryBurst(
    weapon: WeaponDefinition,
    originX: number,
    originY: number,
    shipRadius: number,
    bulletSpec: BulletSpec,
    emit: EmitBullet,
  ): void {
    this.emitPattern(
      weapon.pattern,
      originX,
      originY,
      shipRadius,
      bulletSpec,
      emit,
      weapon.muzzleOffsets,
    );
  }

  private emitSecondaryBurst(
    weapon: SecondaryWeaponDefinition,
    originX: number,
    originY: number,
    shipRadius: number,
    bulletSpec: BulletSpec,
    emit: EmitBullet,
  ): void {
    this.emitPattern(
      weapon.pattern,
      originX,
      originY,
      shipRadius,
      bulletSpec,
      emit,
      weapon.muzzleOffsets,
    );
  }

  private emitPattern(
    pattern: WeaponPattern,
    originX: number,
    originY: number,
    shipRadius: number,
    bulletSpec: BulletSpec,
    emit: EmitBullet,
    muzzleOffsets?: { x: number; y: number }[],
  ): void {
    const baseAngle = -Math.PI / 2;
    const angles = resolveWeaponAngles(pattern);
    for (let i = 0; i < angles.length; i += 1) {
      const angle = baseAngle + (angles[i] * Math.PI) / 180;
      const offset = muzzleOffsets?.[i];
      const offsetX = (offset?.x ?? 0) * shipRadius;
      const offsetY = (offset?.y ?? 0) * shipRadius;
      emit(originX + offsetX, originY + offsetY, angle, bulletSpec);
    }
  }
}
