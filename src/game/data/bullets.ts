import type { BulletKind, BulletSpec } from "./scripts";

export const BULLET_ORB_PLAYER: BulletSpec = {
  color: 0x7df9ff,
  damage: 1,
  kind: "orb",
  radius: 3,
  speed: 420,
};

export const BULLET_ORB_PLAYER_PLUS: BulletSpec = {
  color: 0x7df9ff,
  damage: 0.8,
  kind: "orb",
  radius: 3,
  speed: 400,
};

export const BULLET_ORB_PLAYER_PLUSPLUS: BulletSpec = {
  color: 0x7df9ff,
  damage: 0.7,
  kind: "orb",
  radius: 3,
  speed: 380,
};

export const BULLET_ORB_PLAYER_PLUSPLUSPLUS: BulletSpec = {
  color: 0x7df9ff,
  damage: 0.7,
  kind: "orb",
  radius: 3,
  speed: 500,
};

export const BULLET_ORB_FLARE_PLAYER: BulletSpec = {
  color: 0xffd166,
  damage: 1,
  kind: "orb",
  radius: 3,
  speed: 380,
  trail: {
    color: 0xff7b3b,
    count: 1,
    intervalMs: 70,
    sizeMax: 2.2,
    sizeMin: 1.1,
  },
};

export const BULLET_ORB_PULSE_PLAYER: BulletSpec = {
  color: 0x6fe3ff,
  damage: 1.2,
  kind: "orb",
  radius: 3,
  speed: 460,
  trail: {
    color: 0x5ad3ff,
    count: 1,
    intervalMs: 80,
    sizeMax: 2.2,
    sizeMin: 1.2,
  },
};

export const BULLET_DART_PLAYER: BulletSpec = {
  color: 0xffb86c,
  damage: 1,
  kind: "dart",
  length: 12,
  radius: 2,
  speed: 520,
  thickness: 2,
};

export const BULLET_DART_SNIPER_PLAYER: BulletSpec = {
  color: 0xffd6a3,
  damage: 2.4,
  kind: "dart",
  length: 16,
  radius: 2,
  speed: 680,
  thickness: 2,
};

export const BULLET_GATLING_PLAYER: BulletSpec = {
  color: 0xffb86c,
  damage: 0.5,
  kind: "dart",
  length: 7,
  radius: 2,
  speed: 800,
  thickness: 2,
};

export const BULLET_DART_RAPID_PLAYER: BulletSpec = {
  color: 0xffc07a,
  damage: 1,
  kind: "dart",
  length: 12,
  radius: 2,
  speed: 640,
  thickness: 2,
};

export const BULLET_MISSILE_PLAYER: BulletSpec = {
  color: 0xffb86c,
  damage: 2,
  homing: { acquireRadius: 220, turnRateRadPerSec: 3.2 },
  kind: "missile",
  length: 10,
  lifetimeMs: 2200,
  radius: 3,
  speed: 320,
  thickness: 3,
  trail: { color: 0xff9b5e, count: 1, intervalMs: 70, sizeMax: 2, sizeMin: 1 },
};

export const BULLET_MISSILE_MINI_PLAYER: BulletSpec = {
  color: 0xffc993,
  damage: 1,
  homing: { acquireRadius: 180, turnRateRadPerSec: 3.4 },
  kind: "missile",
  length: 8,
  lifetimeMs: 1800,
  radius: 2,
  speed: 300,
  thickness: 2,
  trail: {
    color: 0xffa46b,
    count: 1,
    intervalMs: 80,
    sizeMax: 1.8,
    sizeMin: 0.9,
  },
};

export const BULLET_MISSILE_SWARM_PLAYER: BulletSpec = {
  color: 0xffc28b,
  damage: 1.4,
  homing: { acquireRadius: 220, turnRateRadPerSec: 3.1 },
  kind: "missile",
  length: 9,
  lifetimeMs: 2200,
  radius: 3,
  speed: 300,
  thickness: 3,
  trail: {
    color: 0xffa36c,
    count: 1,
    intervalMs: 75,
    sizeMax: 2,
    sizeMin: 1,
  },
};

export const BULLET_MISSILE_HEAVY_PLAYER: BulletSpec = {
  color: 0xff8a6b,
  damage: 4,
  homing: { acquireRadius: 240, turnRateRadPerSec: 4.2 },
  kind: "missile",
  length: 14,
  lifetimeMs: 3000,
  radius: 3,
  speed: 250,
  thickness: 5,
  trail: {
    color: 0xff6b3d,
    count: 2,
    intervalMs: 45,
    sizeMax: 2.6,
    sizeMin: 1.4,
  },
};

export const BULLET_ORB_SPREAD_PLAYER: BulletSpec = {
  color: 0x6fe3ff,
  damage: 1,
  kind: "orb",
  radius: 3,
  speed: 360,
};

export const BULLET_BOMB_PLAYER: BulletSpec = {
  aoe: { damage: 2, radius: 70 },
  color: 0xff6b6b,
  damage: 2,
  kind: "bomb",
  lifetimeMs: 2000,
  radius: 6,
  speed: 220,
};

export const BULLET_BOMB_MICRO_PLAYER: BulletSpec = {
  aoe: { damage: 1, radius: 50 },
  color: 0xff8ba0,
  damage: 1,
  kind: "bomb",
  lifetimeMs: 1800,
  radius: 5,
  speed: 200,
};

export const BULLET_BOMB_MICRO_GUIDED_PLAYER: BulletSpec = {
  aoe: { damage: 1, radius: 50 },
  color: 0xff9b6a,
  damage: 1,
  homing: { acquireRadius: 200, turnRateRadPerSec: 1.6 },
  kind: "bomb",
  lifetimeMs: 2000,
  radius: 5,
  speed: 190,
  trail: {
    color: 0xff6b3d,
    count: 1,
    intervalMs: 70,
    sizeMax: 2.2,
    sizeMin: 1.1,
  },
};

export const BULLET_BOMB_HEAVY_PLAYER: BulletSpec = {
  aoe: { damage: 3, radius: 90 },
  color: 0xff5c73,
  damage: 3,
  kind: "bomb",
  lifetimeMs: 2200,
  radius: 7,
  speed: 200,
};

export const BULLET_ORB_ENEMY: BulletSpec = {
  color: 0xff9f43,
  damage: 1,
  kind: "orb",
  radius: 3,
  speed: 200,
};

export const BULLET_DART_ENEMY: BulletSpec = {
  color: 0xffb067,
  damage: 1,
  kind: "dart",
  length: 10,
  radius: 2,
  speed: 260,
  thickness: 2,
};

export const BULLET_ORB_HEAVY_ENEMY: BulletSpec = {
  color: 0xff784f,
  damage: 2,
  kind: "orb",
  radius: 4,
  speed: 180,
};

export const BULLET_MISSILE_ENEMY: BulletSpec = {
  color: 0xff8c6c,
  damage: 2,
  homing: { acquireRadius: 260, turnRateRadPerSec: 2.6 },
  kind: "missile",
  length: 10,
  lifetimeMs: 2400,
  radius: 3,
  speed: 260,
  thickness: 3,
};

export const DEBUG_PLAYER_BULLETS: Record<BulletKind, BulletSpec> = {
  bomb: BULLET_BOMB_PLAYER,
  dart: BULLET_DART_PLAYER,
  missile: BULLET_MISSILE_PLAYER,
  orb: BULLET_ORB_PLAYER,
};
