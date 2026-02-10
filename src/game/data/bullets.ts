import type { BulletKind, BulletSpec } from "./scripts";

const DEBUG_BULLET_ORB: BulletSpec = {
  color: 0x7df9ff,
  damage: 1,
  kind: "orb",
  radius: 3,
  speed: 420,
};

const DEBUG_BULLET_DART: BulletSpec = {
  color: 0xffb86c,
  damage: 1,
  kind: "dart",
  length: 12,
  radius: 2,
  speed: 520,
  thickness: 2,
};

const DEBUG_BULLET_MISSILE: BulletSpec = {
  color: 0xffb86c,
  damage: 2,
  homing: { acquireRadius: 220, turnRateRadPerSec: 3.2 },
  kind: "missile",
  length: 10,
  lifetimeMs: 2200,
  radius: 3,
  speed: 320,
  thickness: 3,
  trail: {
    color: 0xff9b5e,
    count: 1,
    intervalMs: 70,
    sizeMax: 2,
    sizeMin: 1,
  },
};

const DEBUG_BULLET_BOMB: BulletSpec = {
  aoe: { damage: 2, radius: 70 },
  color: 0xff6b6b,
  damage: 2,
  kind: "bomb",
  lifetimeMs: 2000,
  radius: 6,
  speed: 220,
};

export const DEBUG_PLAYER_BULLETS: Record<BulletKind, BulletSpec> = {
  bomb: DEBUG_BULLET_BOMB,
  dart: DEBUG_BULLET_DART,
  missile: DEBUG_BULLET_MISSILE,
  orb: DEBUG_BULLET_ORB,
};
