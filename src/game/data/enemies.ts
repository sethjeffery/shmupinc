import type { FireScript, MoveScript } from "./scripts";

import {
  BULLET_DART_ENEMY,
  BULLET_MISSILE_ENEMY,
  BULLET_ORB_ENEMY,
  BULLET_ORB_HEAVY_ENEMY,
} from "./bullets";

export interface BossPhase {
  hpThreshold: number;
  move?: MoveScript;
  fire?: FireScript;
}

export type EnemyShape =
  | "asteroid"
  | "bomber"
  | "boss"
  | "crossfire"
  | "sine"
  | "skitter"
  | "snake"
  | "sniper"
  | "spinner"
  | "swooper";

export interface EnemyDef {
  id: string;
  hp: number;
  radius: number;
  goldDrop: { min: number; max: number };
  move: MoveScript;
  fire: FireScript;
  phases?: BossPhase[];
  rotation?: "fixed" | "movement";
  rotationDeg?: number;
  style?: {
    fillColor?: number;
    lineColor?: number;
    shape?: EnemyShape;
  };
}

const BULLET_LIGHT = BULLET_ORB_ENEMY;
const BULLET_FAST = BULLET_DART_ENEMY;
const BULLET_HEAVY = BULLET_ORB_HEAVY_ENEMY;
const BULLET_SNIPER = { ...BULLET_DART_ENEMY, damage: 2, speed: 300 };
const BULLET_BOSS_DART_FAST = {
  ...BULLET_DART_ENEMY,
  damage: 2,
  length: 12,
  speed: 440,
};
const BOSS_WING_OFFSETS = [
  { x: -28, y: 8 },
  { x: 28, y: 8 },
];

const FIRE_NONE: FireScript = { steps: [] };

const MOVE_SINE: MoveScript = {
  steps: [
    { amp: 70, durationMs: 4200, freq: 1.1, kind: "sineDown", speed: 90 },
    { durationMs: 900, kind: "dashTo", to: { x: 0, y: 680 } },
  ],
};

const MOVE_ASTEROID: MoveScript = {
  steps: [{ durationMs: 3200, kind: "dashTo", to: { x: 0, y: 860 } }],
};

const MOVE_SKITTER: MoveScript = {
  steps: [
    { durationMs: 240, kind: "dashTo", to: { x: 0, y: 140 } },
    { durationMs: 520, kind: "hover" },
    { durationMs: 240, kind: "dashTo", to: { x: 120, y: 80 } },
    { durationMs: 520, kind: "hover" },
    { durationMs: 240, kind: "dashTo", to: { x: -140, y: 210 } },
    { durationMs: 520, kind: "hover" },
    { durationMs: 600, kind: "dashTo", to: { x: 0, y: 780 } },
  ],
};

const MOVE_SWOOPER: MoveScript = {
  steps: [
    {
      durationMs: 1200,
      kind: "bezier",
      points: [
        { x: 0, y: 0 },
        { x: -80, y: 80 },
        { x: -30, y: 160 },
        { x: 0, y: 220 },
      ],
    },
    { durationMs: 900, kind: "hover" },
    {
      durationMs: 1400,
      kind: "bezier",
      points: [
        { x: 0, y: 220 },
        { x: 60, y: 260 },
        { x: 140, y: 200 },
        { x: 200, y: -120 },
      ],
    },
  ],
};

const MOVE_BOMBER: MoveScript = {
  steps: [
    { durationMs: 600, kind: "dashTo", to: { x: 0, y: 180 } },
    { durationMs: 1200, kind: "hover" },
    { durationMs: 900, kind: "dashTo", to: { x: 0, y: 720 } },
  ],
};

const MOVE_SNAKE_SEGMENT: MoveScript = {
  steps: [
    {
      durationMs: 3200,
      kind: "bezier",
      points: [
        { x: 0, y: 0 },
        { x: 80, y: 90 },
        { x: -80, y: 170 },
        { x: 60, y: 260 },
        { x: -60, y: 360 },
      ],
    },
    { durationMs: 900, kind: "dashTo", to: { x: 0, y: 740 } },
  ],
};

const MOVE_SNIPER: MoveScript = {
  steps: [
    { durationMs: 650, kind: "dashTo", to: { x: 0, y: 140 } },
    { durationMs: 1700, kind: "hover" },
    { durationMs: 850, kind: "dashTo", to: { x: 0, y: 760 } },
  ],
};

const MOVE_SPINNER: MoveScript = {
  steps: [
    {
      durationMs: 1200,
      kind: "bezier",
      points: [
        { x: 0, y: 0 },
        { x: -120, y: 110 },
        { x: 120, y: 220 },
        { x: 0, y: 320 },
      ],
    },
    { durationMs: 1400, kind: "hover" },
    { durationMs: 900, kind: "dashTo", to: { x: 0, y: 780 } },
  ],
};

const MOVE_CROSSFIRE: MoveScript = {
  steps: [
    { durationMs: 750, kind: "dashTo", to: { x: 0, y: 160 } },
    { durationMs: 1400, kind: "hover" },
    { durationMs: 900, kind: "dashTo", to: { x: 0, y: 760 } },
  ],
};

const MOVE_BOSS: MoveScript = {
  loop: true,
  steps: [
    { durationMs: 1400, ease: "out", kind: "dashTo", to: { x: 0, y: 160 } },
    { durationMs: 600, kind: "hover" },
    { durationMs: 700, ease: "inOut", kind: "dashTo", to: { x: 110, y: 190 } },
    { durationMs: 500, kind: "hover" },
    { durationMs: 700, ease: "inOut", kind: "dashTo", to: { x: -110, y: 190 } },
    { durationMs: 600, kind: "hover" },
  ],
};

const FIRE_SWOOPER: FireScript = {
  steps: [
    { durationMs: 1100, kind: "cooldown" },
    {
      aim: { kind: "atPlayer" },
      bullet: BULLET_LIGHT,
      count: 3,
      intervalMs: 180,
      kind: "burst",
    },
    { durationMs: 300, kind: "cooldown" },
    {
      aim: { kind: "atPlayer" },
      bullet: BULLET_LIGHT,
      count: 3,
      intervalMs: 180,
      kind: "burst",
    },
    { durationMs: 1200, kind: "cooldown" },
  ],
};

const FIRE_SINE: FireScript = {
  loop: true,
  steps: [
    { durationMs: 700, kind: "cooldown" },
    {
      aim: { angleDeg: 90, kind: "fixed" },
      bullet: BULLET_FAST,
      durationMs: 1200,
      kind: "spray",
      ratePerSec: 6,
    },
    { durationMs: 800, kind: "cooldown" },
  ],
};

const FIRE_BOMBER: FireScript = {
  steps: [
    { durationMs: 700, kind: "cooldown" },
    {
      aim: { angleDeg: 90, kind: "fixed" },
      bullet: BULLET_HEAVY,
      count: 4,
      intervalMs: 180,
      kind: "burst",
    },
  ],
};

const FIRE_SNIPER: FireScript = {
  loop: true,
  steps: [
    { durationMs: 700, kind: "cooldown" },
    {
      aim: { kind: "atPlayer" },
      bullet: BULLET_SNIPER,
      count: 1,
      intervalMs: 1,
      kind: "burst",
    },
    { durationMs: 900, kind: "cooldown" },
  ],
};

const FIRE_SPINNER: FireScript = {
  loop: true,
  steps: [
    { durationMs: 500, kind: "cooldown" },
    {
      aim: { fromDeg: 60, kind: "sweep", periodMs: 1400, toDeg: 120 },
      bullet: BULLET_LIGHT,
      durationMs: 1400,
      kind: "spray",
      ratePerSec: 5,
    },
    { durationMs: 300, kind: "cooldown" },
  ],
};

const FIRE_CROSSFIRE: FireScript = {
  loop: true,
  steps: [
    { durationMs: 500, kind: "cooldown" },
    {
      aim: { angleDeg: 75, kind: "fixed" },
      bullet: BULLET_FAST,
      count: 2,
      intervalMs: 140,
      kind: "burst",
    },
    {
      aim: { angleDeg: 90, kind: "fixed" },
      bullet: BULLET_FAST,
      count: 2,
      intervalMs: 140,
      kind: "burst",
    },
    {
      aim: { angleDeg: 105, kind: "fixed" },
      bullet: BULLET_FAST,
      count: 2,
      intervalMs: 140,
      kind: "burst",
    },
    { durationMs: 400, kind: "cooldown" },
  ],
};

const FIRE_SKITTER: FireScript = {
  loop: true,
  steps: [
    { durationMs: 420, kind: "cooldown" },
    {
      aim: { kind: "atPlayer" },
      bullet: BULLET_FAST,
      count: 2,
      intervalMs: 120,
      kind: "burst",
    },
    { durationMs: 520, kind: "cooldown" },
  ],
};

const FIRE_BOSS_PHASE1: FireScript = {
  loop: true,
  steps: [
    { durationMs: 500, kind: "cooldown" },
    {
      aim: { angleDeg: 90, kind: "fixed" },
      bullet: BULLET_FAST,
      durationMs: 900,
      kind: "spray",
      originOffsets: BOSS_WING_OFFSETS,
      ratePerSec: 6,
    },
    { durationMs: 300, kind: "cooldown" },
    {
      aim: { fromDeg: 60, kind: "sweep", periodMs: 1800, toDeg: 120 },
      bullet: BULLET_HEAVY,
      durationMs: 1800,
      kind: "spray",
      ratePerSec: 6,
    },
    { durationMs: 400, kind: "cooldown" },
    {
      aim: { kind: "atPlayer" },
      bullet: BULLET_FAST,
      count: 4,
      intervalMs: 160,
      kind: "burst",
    },
    { durationMs: 400, kind: "cooldown" },
  ],
};

const FIRE_BOSS_PHASE2: FireScript = {
  loop: true,
  steps: [
    { durationMs: 400, kind: "cooldown" },
    { durationMs: 1200, kind: "charge" },
    { aim: { angleDeg: 0, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 15, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 30, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 45, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 60, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 75, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 90, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 105, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 120, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 135, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 150, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 165, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 180, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 195, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 210, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 225, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 240, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 255, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 270, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 285, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 300, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 315, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 330, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 345, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { durationMs: 120, kind: "cooldown" },
    { aim: { angleDeg: 7.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 22.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 37.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 52.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 67.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 82.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 97.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 112.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 127.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 142.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 157.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 172.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 187.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 202.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 217.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 232.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 247.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 262.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 277.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 292.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 307.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 322.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 337.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 352.5, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { durationMs: 260, kind: "cooldown" },
    {
      aim: { angleDeg: 90, kind: "fixed" },
      bullet: BULLET_LIGHT,
      durationMs: 1200,
      kind: "spray",
      originOffsets: BOSS_WING_OFFSETS,
      ratePerSec: 6,
    },
    { durationMs: 200, kind: "cooldown" },
    {
      aim: { kind: "atPlayer" },
      bullet: BULLET_MISSILE_ENEMY,
      count: 2,
      intervalMs: 320,
      kind: "burst",
      originOffsets: BOSS_WING_OFFSETS,
    },
    { durationMs: 500, kind: "cooldown" },
  ],
};

const FIRE_BOSS_PHASE3: FireScript = {
  loop: true,
  steps: [
    { durationMs: 300, kind: "cooldown" },
    { durationMs: 1000, kind: "charge" },
    { aim: { angleDeg: 0, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 20, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 40, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 60, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 80, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 100, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 120, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 140, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 160, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 180, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 200, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 220, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 240, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 260, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 280, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 300, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 320, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 340, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { durationMs: 160, kind: "cooldown" },
    { aim: { angleDeg: 10, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 30, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 50, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 70, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 90, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 110, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 130, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 150, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 170, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 190, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 210, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 230, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 250, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 270, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 290, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 310, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 330, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { aim: { angleDeg: 350, kind: "fixed" }, bullet: BULLET_BOSS_DART_FAST, count: 1, intervalMs: 1, kind: "burst" },
    { durationMs: 220, kind: "cooldown" },
    {
      aim: { fromDeg: 50, kind: "sweep", periodMs: 1400, toDeg: 130 },
      bullet: BULLET_HEAVY,
      durationMs: 1400,
      kind: "spray",
      ratePerSec: 8,
    },
    { durationMs: 200, kind: "cooldown" },
    {
      aim: { kind: "atPlayer" },
      bullet: BULLET_FAST,
      count: 4,
      intervalMs: 120,
      kind: "burst",
      originOffsets: BOSS_WING_OFFSETS,
    },
    { durationMs: 400, kind: "cooldown" },
  ],
};

type EnemyType =
  | "asteroid"
  | "bomber"
  | "boss"
  | "crossfire"
  | "sine"
  | "skitter"
  | "snake"
  | "sniper"
  | "spinner"
  | "swooper";

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  asteroid: {
    fire: FIRE_NONE,
    goldDrop: { max: 3, min: 1 },
    hp: 3,
    id: "asteroid",
    move: MOVE_ASTEROID,
    radius: 12,
    style: { fillColor: 0x1b2028, lineColor: 0xa7b3c2, shape: "asteroid" },
  },
  bomber: {
    fire: FIRE_BOMBER,
    goldDrop: { max: 10, min: 6 },
    hp: 8,
    id: "bomber",
    move: MOVE_BOMBER,
    radius: 16,
    style: { fillColor: 0x2a140f, lineColor: 0xffa07a, shape: "bomber" },
  },
  boss: {
    fire: FIRE_BOSS_PHASE1,
    goldDrop: { max: 36, min: 24 },
    hp: 60,
    id: "boss",
    move: MOVE_BOSS,
    phases: [
      { fire: FIRE_BOSS_PHASE2, hpThreshold: 0.66 },
      { fire: FIRE_BOSS_PHASE3, hpThreshold: 0.33 },
    ],
    radius: 44,
    rotation: "fixed",
    rotationDeg: 180,
    style: { fillColor: 0x161018, lineColor: 0xff6b6b, shape: "boss" },
  },
  crossfire: {
    fire: FIRE_CROSSFIRE,
    goldDrop: { max: 7, min: 5 },
    hp: 7,
    id: "crossfire",
    move: MOVE_CROSSFIRE,
    radius: 14,
    style: { fillColor: 0x14162e, lineColor: 0x8ecbff, shape: "crossfire" },
  },
  sine: {
    fire: FIRE_SINE,
    goldDrop: { max: 6, min: 4 },
    hp: 5,
    id: "sine",
    move: MOVE_SINE,
    radius: 13,
    style: { fillColor: 0x0f1a2b, lineColor: 0x6cf2ff, shape: "sine" },
  },
  skitter: {
    fire: FIRE_SKITTER,
    goldDrop: { max: 7, min: 5 },
    hp: 6,
    id: "skitter",
    move: MOVE_SKITTER,
    radius: 13,
    style: { fillColor: 0x10192b, lineColor: 0x7ff0ff, shape: "skitter" },
  },
  snake: {
    fire: FIRE_NONE,
    goldDrop: { max: 4, min: 2 },
    hp: 3,
    id: "snake",
    move: MOVE_SNAKE_SEGMENT,
    radius: 12,
    style: { fillColor: 0x1b1022, lineColor: 0xff6b6b, shape: "snake" },
  },
  sniper: {
    fire: FIRE_SNIPER,
    goldDrop: { max: 7, min: 5 },
    hp: 5,
    id: "sniper",
    move: MOVE_SNIPER,
    radius: 12,
    style: { fillColor: 0x141a14, lineColor: 0xb8ff7a, shape: "sniper" },
  },
  spinner: {
    fire: FIRE_SPINNER,
    goldDrop: { max: 8, min: 6 },
    hp: 7,
    id: "spinner",
    move: MOVE_SPINNER,
    radius: 15,
    style: { fillColor: 0x1a0f22, lineColor: 0xffb86c, shape: "spinner" },
  },
  swooper: {
    fire: FIRE_SWOOPER,
    goldDrop: { max: 8, min: 5 },
    hp: 6,
    id: "swooper",
    move: MOVE_SWOOPER,
    radius: 14,
    style: { fillColor: 0x1b0f1c, lineColor: 0xff8cda, shape: "swooper" },
  },
};

export type EnemyId = keyof typeof ENEMIES;
