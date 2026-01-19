import type {
  Aim,
  BulletSpec,
  FireScript,
  MoveScript,
  MoveStep,
} from "./scripts";
import type { EnemyOverride, Spawn, WaveDefinition } from "./waves";

import {
  BULLET_DART_ENEMY,
  BULLET_ORB_ENEMY,
  BULLET_ORB_HEAVY_ENEMY,
} from "./bullets";
import { ENEMIES, type EnemyId } from "./enemies";

/**
 * Wave factories generate spawns procedurally from reusable motifs.
 * This lets us create lots of interesting shmup waves without hand-authoring every one.
 *
 * Coordinate semantics: all MoveScript coordinates are LOCAL to spawn anchor (0,0 at spawn).
 */

export type WaveIntensity = "high" | "low" | "medium";

export type WaveFactory = (ctx: {
  waveNumber: number;
  width: number;
  height: number;
  seed?: number; // optional: if you later want deterministic RNG
}) => WaveDefinition;

export const BOSS_WAVE_INTERVAL = 5;

const BULLET_LIGHT: BulletSpec = BULLET_ORB_ENEMY;
const BULLET_FAST: BulletSpec = BULLET_DART_ENEMY;
const BULLET_HEAVY: BulletSpec = BULLET_ORB_HEAVY_ENEMY;

// --- helpers ---------------------------------------------------------------

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

const laneX = (width: number, lane: 0 | 1 | 2 | 3 | 4): number => {
  // 5 lanes incl edges; tweak as desired
  const padding = 40;
  const usable = width - padding * 2;
  return (padding + (usable * lane) / 4) / width;
};

const toNormX = (width: number, px: number): number => px / width;
const toNormY = (height: number, px: number): number => px / height;

const scaleHp = (baseHp: number, waveNumber: number): number => {
  // gentle scaling; you can tune
  const mul = 1 + waveNumber * 0.03;
  return Math.max(1, Math.round(baseHp * mul));
};

const scaleGold = (
  min: number,
  max: number,
  waveNumber: number,
): { min: number; max: number } => {
  // boost gold pacing so upgrades feel attainable
  const add = Math.floor(waveNumber / 2) + 1;
  return { max: max + add + 1, min: min + add };
};

const scaleBossHp = (baseHp: number, waveNumber: number): number => {
  const mul = 1 + waveNumber * 0.06;
  return Math.max(1, Math.round(baseHp * mul));
};

const scaleBossFire = (fire: FireScript, bossRank: number): FireScript => {
  const rateMul = 1 + bossRank * 0.12;
  const durationAdd = bossRank * 140;
  const missileBonus = Math.min(3, bossRank);
  return {
    ...fire,
    steps: fire.steps.map((step) => {
      if (step.kind === "spray") {
        return {
          ...step,
          durationMs: step.durationMs + durationAdd,
          ratePerSec: clamp(step.ratePerSec * rateMul, 2, 14),
        };
      }
      if (step.kind === "burst") {
        const isMissile = Boolean(step.bullet.homing);
        return {
          ...step,
          count: isMissile ? step.count + missileBonus : step.count,
          intervalMs: isMissile
            ? Math.max(90, step.intervalMs - bossRank * 12)
            : step.intervalMs,
        };
      }
      if (step.kind === "charge") {
        return { ...step, durationMs: step.durationMs + bossRank * 120 };
      }
      return step;
    }),
  };
};

const mirrorAimX = (aim: Aim): Aim => {
  // Mirror across vertical axis: angleDeg -> 180 - angleDeg
  switch (aim.kind) {
    case "fixed":
      return { angleDeg: 180 - aim.angleDeg, kind: "fixed" };
    case "sweep":
      return {
        fromDeg: 180 - aim.fromDeg,
        kind: "sweep",
        periodMs: aim.periodMs,
        toDeg: 180 - aim.toDeg,
      };
    case "atPlayer":
    default:
      return aim;
  }
};

const mirrorOffsetsX = (offsets?: Vec2[]): undefined | Vec2[] =>
  offsets
    ? offsets.map((offset) => ({ x: -offset.x, y: offset.y }))
    : undefined;

const mirrorFireX = (fire: FireScript): FireScript => {
  return {
    ...fire,
    steps: fire.steps.map((s) => {
      if (s.kind === "cooldown") return s;
      if (s.kind === "burst") {
        return {
          ...s,
          aim: mirrorAimX(s.aim),
          originOffsets: mirrorOffsetsX(s.originOffsets),
        };
      }
      if (s.kind === "spray") {
        return {
          ...s,
          aim: mirrorAimX(s.aim),
          originOffsets: mirrorOffsetsX(s.originOffsets),
        };
      }
      return s;
    }),
  };
};

const mirrorMoveX = (move: MoveScript): MoveScript => {
  const mirrorStep = (step: MoveStep): MoveStep => {
    switch (step.kind) {
      case "bezier":
        return {
          ...step,
          points: step.points.map((p) => ({ x: -p.x, y: p.y })),
        };
      case "dashTo":
        return { ...step, to: { x: -step.to.x, y: step.to.y } };
      case "sineDown":
        // sineDown x = sin(..)*amp; mirroring can be done by negating amp
        return { ...step, amp: -step.amp };
      case "hover":
      default:
        return step;
    }
  };
  return { ...move, steps: move.steps.map(mirrorStep) };
};

const mirrorSpawn = (spawn: Spawn): Spawn => {
  if (!spawn.overrides) {
    return { ...spawn, x: 1 - spawn.x };
  }
  const overrides: EnemyOverride = { ...spawn.overrides };
  if (spawn.overrides.move) {
    overrides.move = mirrorMoveX(spawn.overrides.move);
  }
  if (spawn.overrides.fire) {
    overrides.fire = mirrorFireX(spawn.overrides.fire);
  }
  if (spawn.overrides.phases) {
    overrides.phases = spawn.overrides.phases.map((phase) => ({
      ...phase,
      fire: phase.fire ? mirrorFireX(phase.fire) : undefined,
      move: phase.move ? mirrorMoveX(phase.move) : undefined,
    }));
  }
  return { ...spawn, overrides, x: 1 - spawn.x };
};

export const mirrorWaveDefinition = (wave: WaveDefinition): WaveDefinition => ({
  id: `${wave.id}-mirror`,
  spawns: wave.spawns.map(mirrorSpawn),
});

const makeSkitterMove = (width: number, height: number): MoveScript => {
  const xRange = width * 0.35;
  const yMin = 80;
  const yMax = 260;
  const waypoint = (): { x: number; y: number } => ({
    x: (Math.random() * 2 - 1) * xRange,
    y: yMin + Math.random() * (yMax - yMin),
  });
  return {
    steps: [
      { durationMs: 220, kind: "dashTo", to: { x: 0, y: 140 } },
      { durationMs: 520, kind: "hover" },
      { durationMs: 240, kind: "dashTo", to: waypoint() },
      { durationMs: 520, kind: "hover" },
      { durationMs: 240, kind: "dashTo", to: waypoint() },
      { durationMs: 520, kind: "hover" },
      { durationMs: 240, kind: "dashTo", to: waypoint() },
      { durationMs: 520, kind: "hover" },
      { durationMs: 700, kind: "dashTo", to: { x: 0, y: height + 260 } },
    ],
  };
};

const makeAsteroidMove = (
  height: number,
  drift: number,
  durationMs: number,
): MoveScript => ({
  steps: [{ durationMs, kind: "dashTo", to: { x: drift, y: height + 240 } }],
});

const buildSupportSpawns = (
  waveNumber: number,
  width: number,
  height: number,
  startAtMs: number,
): Spawn[] => {
  const spawns: Spawn[] = [];
  const pattern = waveNumber % 3;
  const spawnY = toNormY(height, -120);
  if (pattern === 0) {
    const count = clamp(5 + Math.floor(waveNumber / 6), 3, 6);
    for (let i = 0; i < count; i += 1) {
      spawns.push({
        atMs: startAtMs + i * 320,
        enemyId: "sine" as EnemyId,
        overrides: {
          goldDrop: scaleGold(3, 5, waveNumber),
          hp: scaleHp(4, waveNumber),
        },
        x: laneX(width, (i % 5) as 0 | 1 | 2 | 3 | 4),
        y: spawnY,
      });
    }
  } else if (pattern === 1) {
    const count = clamp(2 + Math.floor(waveNumber / 5), 2, 5);
    for (let i = 0; i < count; i += 1) {
      spawns.push({
        atMs: startAtMs + i * 420,
        enemyId: "skitter" as EnemyId,
        overrides: {
          fire: fireAimedDoubleBurst(BULLET_FAST),
          goldDrop: scaleGold(5, 7, waveNumber),
          hp: scaleHp(6, waveNumber),
          move: makeSkitterMove(width, height),
        },
        x: laneX(width, (i % 5) as 0 | 1 | 2 | 3 | 4),
        y: spawnY,
      });
    }
  } else {
    const count = clamp(6 + Math.floor(waveNumber / 4), 6, 12);
    for (let i = 0; i < count; i += 1) {
      const sizeRoll = Math.random();
      const radius = sizeRoll > 0.7 ? 18 : sizeRoll > 0.4 ? 14 : 10;
      const hp = sizeRoll > 0.7 ? 8 : sizeRoll > 0.4 ? 5 : 3;
      const drift = (Math.random() * 2 - 1) * 60;
      const durationMs = 2200 + Math.random() * 1200;
      spawns.push({
        atMs: startAtMs + i * 220,
        enemyId: "asteroid" as EnemyId,
        overrides: {
          goldDrop: scaleGold(1, 3, waveNumber),
          hp: scaleHp(hp, waveNumber),
          move: makeAsteroidMove(height, drift, durationMs),
          radius,
        },
        x: Math.random(),
        y: spawnY,
      });
    }
  }
  return spawns;
};

export const augmentWaveDefinition = (
  wave: WaveDefinition,
  ctx: { waveNumber: number; width: number; height: number },
): WaveDefinition => {
  if (wave.spawns.length === 0) return wave;
  const lastAt = Math.max(...wave.spawns.map((spawn) => spawn.atMs));
  const extra = buildSupportSpawns(
    ctx.waveNumber,
    ctx.width,
    ctx.height,
    lastAt + 600,
  );
  if (extra.length === 0) return wave;
  return { id: `${wave.id}-combo`, spawns: [...wave.spawns, ...extra] };
};

const makeSwoop = (dir: "left" | "mid" | "right"): MoveScript => {
  // Local coords. Start is (0,0) at spawn.
  // These are “swoop in -> hover -> exit up”
  const inCtrl =
    dir === "left"
      ? [
          { x: 0, y: 0 },
          { x: -140, y: 90 },
          { x: -90, y: 180 },
          { x: 0, y: 250 },
        ]
      : dir === "right"
        ? [
            { x: 0, y: 0 },
            { x: 140, y: 90 },
            { x: 90, y: 180 },
            { x: 0, y: 250 },
          ]
        : [
            { x: 0, y: 0 },
            { x: -60, y: 90 },
            { x: 60, y: 180 },
            { x: 0, y: 250 },
          ];

  const outCtrl =
    dir === "left"
      ? [
          { x: 0, y: 250 },
          { x: 120, y: 320 },
          { x: 240, y: 220 },
          { x: 340, y: -160 },
        ]
      : dir === "right"
        ? [
            { x: 0, y: 250 },
            { x: -120, y: 320 },
            { x: -240, y: 220 },
            { x: -340, y: -160 },
          ]
        : [
            { x: 0, y: 250 },
            { x: 120, y: 320 },
            { x: -120, y: 220 },
            { x: 0, y: -160 },
          ];

  return {
    steps: [
      { durationMs: 1100, kind: "bezier", points: inCtrl },
      { durationMs: 800, kind: "hover" },
      { durationMs: 1300, kind: "bezier", points: outCtrl },
    ],
  };
};

const fireAimedDoubleBurst = (bullet: BulletSpec): FireScript => ({
  steps: [
    { durationMs: 750, kind: "cooldown" },
    {
      aim: { kind: "atPlayer" },
      bullet,
      count: 3,
      intervalMs: 170,
      kind: "burst",
    },
    { durationMs: 260, kind: "cooldown" },
    {
      aim: { kind: "atPlayer" },
      bullet,
      count: 3,
      intervalMs: 170,
      kind: "burst",
    },
  ],
});

const fireDownSpray = (
  bullet: BulletSpec,
  rate: number,
  durationMs: number,
): FireScript => ({
  steps: [
    { durationMs: 400, kind: "cooldown" },
    {
      aim: { angleDeg: 90, kind: "fixed" },
      bullet,
      durationMs,
      kind: "spray",
      ratePerSec: rate,
    },
  ],
});

const fireSweep = (
  bullet: BulletSpec,
  rate: number,
  durationMs: number,
  fromDeg: number,
  toDeg: number,
): FireScript => ({
  steps: [
    { durationMs: 500, kind: "cooldown" },
    {
      aim: { fromDeg, kind: "sweep", periodMs: durationMs, toDeg },
      bullet,
      durationMs,
      kind: "spray",
      ratePerSec: rate,
    },
  ],
});

// --- factories -------------------------------------------------------------

/**
 * 1) Double Snake: two mirrored snake chains with offsets.
 * Medium intensity, good “signature” wave.
 */
export const waveDoubleSnake: WaveFactory = ({ height, waveNumber, width }) => {
  const baseInterval = clamp(170 - waveNumber * 2, 90, 170);
  const count = clamp(6 + Math.floor(waveNumber / 4), 6, 12);

  const makeSnakeMove = (): MoveScript => ({
    steps: [
      {
        durationMs: clamp(3200 - waveNumber * 25, 2000, 3200),
        kind: "bezier",
        points: [
          { x: 0, y: 0 },
          { x: 90, y: 110 },
          { x: -90, y: 220 },
          { x: 70, y: 340 },
          { x: -70, y: 480 },
        ],
      },
      { durationMs: 900, kind: "dashTo", to: { x: 0, y: 820 } },
    ],
  });

  const leftX = laneX(width, 1);
  const rightX = laneX(width, 3);
  const spawnY = toNormY(height, -90);

  const spawns: Spawn[] = [];
  for (let i = 0; i < count; i += 1) {
    const atMs = i * baseInterval;
    spawns.push({
      atMs,
      enemyId: "snake" as EnemyId,
      overrides: {
        goldDrop: scaleGold(2, 3, waveNumber),
        hp: scaleHp(3, waveNumber),
        move: makeSnakeMove(),
      },
      x: leftX,
      y: spawnY,
    });
    spawns.push({
      atMs: atMs + Math.floor(baseInterval / 2),
      enemyId: "snake" as EnemyId,
      overrides: {
        goldDrop: scaleGold(2, 3, waveNumber),
        hp: scaleHp(3, waveNumber),
        move: mirrorMoveX(makeSnakeMove()),
      },
      x: rightX,
      y: spawnY,
    });
  }

  return { id: `double-snake-${waveNumber}`, spawns };
};

/**
 * 2) Zig-Zag Curtain: alternating side swoops with light downward spray.
 * Medium intensity, teaches movement + lane changes.
 */
export const waveZigZagCurtain: WaveFactory = ({
  height,
  waveNumber,
  width,
}) => {
  const n = clamp(6 + Math.floor(waveNumber / 3), 6, 14);
  const interval = clamp(420 - waveNumber * 6, 220, 420);
  const spawnY = toNormY(height, -120);

  const spawns: Spawn[] = [];
  for (let i = 0; i < n; i += 1) {
    const fromLeft = i % 2 === 0;
    const x = fromLeft ? laneX(width, 1) : laneX(width, 3);
    const move = fromLeft ? makeSwoop("left") : makeSwoop("right");
    const fire = fireDownSpray(
      BULLET_LIGHT,
      clamp(4 + waveNumber * 0.2, 4, 7),
      900,
    );

    spawns.push({
      atMs: i * interval,
      enemyId: "swooper" as EnemyId,
      overrides: {
        fire,
        goldDrop: scaleGold(3, 6, waveNumber),
        hp: scaleHp(5, waveNumber),
        move,
      },
      x,
      y: spawnY,
    });
  }
  return { id: `zigzag-curtain-${waveNumber}`, spawns };
};

/**
 * 3) V-Dive: classic V formation that enters, pauses, shoots aimed burst, then exits.
 * Medium/high intensity depending on waveNumber.
 */
export const waveVDive: WaveFactory = ({ height, waveNumber, width }) => {
  const center = laneX(width, 2);
  const spread = toNormX(width, clamp(70 + waveNumber * 2, 70, 110));
  const spawnY = toNormY(height, -90);

  const move: MoveScript = {
    steps: [
      { durationMs: 700, kind: "dashTo", to: { x: 0, y: 180 } },
      { durationMs: 700, kind: "hover" },
      { durationMs: 800, kind: "dashTo", to: { x: 0, y: 820 } },
    ],
  };

  const fire = fireAimedDoubleBurst(
    waveNumber < 8 ? BULLET_LIGHT : BULLET_FAST,
  );

  const spawns: Spawn[] = [
    {
      atMs: 0,
      enemyId: "bomber" as EnemyId,
      overrides: { fire, hp: scaleHp(7, waveNumber), move },
      x: center - spread,
      y: spawnY,
    },
    {
      atMs: 120,
      enemyId: "bomber" as EnemyId,
      overrides: { fire, hp: scaleHp(7, waveNumber), move },
      x: center,
      y: spawnY,
    },
    {
      atMs: 240,
      enemyId: "bomber" as EnemyId,
      overrides: { fire, hp: scaleHp(7, waveNumber), move },
      x: center + spread,
      y: spawnY,
    },
  ];

  return { id: `v-dive-${waveNumber}`, spawns };
};

/**
 * 4) Turret Wall: enemies dash into positions and become turrets for a while.
 * High intensity lane denial, but fair due to stationary patterns.
 */
export const waveTurretWall: WaveFactory = ({ height, waveNumber, width }) => {
  const holdMs = clamp(1800 + waveNumber * 80, 1800, 3200);
  const rate = clamp(3.5 + waveNumber * 0.15, 3.5, 7);
  const spawnY = toNormY(height, -120);

  const turretMove = (localX: number, y: number): MoveScript => ({
    steps: [
      { durationMs: 650, kind: "dashTo", to: { x: localX, y } },
      { durationMs: holdMs, kind: "hover" },
      { durationMs: 900, kind: "dashTo", to: { x: localX, y: 860 } },
    ],
  });

  const turretFire: FireScript = {
    loop: false,
    steps: [
      { durationMs: 450, kind: "cooldown" },
      {
        aim: { angleDeg: 90, kind: "fixed" },
        bullet: BULLET_LIGHT,
        durationMs: holdMs,
        kind: "spray",
        ratePerSec: rate,
      },
    ],
  };

  const positions = [laneX(width, 1), laneX(width, 2), laneX(width, 3)];
  const spawns: Spawn[] = positions.map((x, i) => ({
    atMs: i * 220,
    enemyId: "bomber" as EnemyId,
    overrides: {
      fire: turretFire,
      goldDrop: scaleGold(5, 9, waveNumber),
      hp: scaleHp(8, waveNumber),
      move: turretMove(0, 170 + i * 25),
    },
    x,
    y: spawnY,
  }));

  return { id: `turret-wall-${waveNumber}`, spawns };
};

/**
 * 5) Crossfire Sweep: two anchored enemies sweep spray inward/outward.
 * Medium/high intensity; very “shmup” without huge bullet count.
 */
export const waveCrossfireSweep: WaveFactory = ({
  height,
  waveNumber,
  width,
}) => {
  const leftX = laneX(width, 1);
  const rightX = laneX(width, 3);
  const dur = clamp(1600 + waveNumber * 70, 1600, 2600);
  const rate = clamp(4 + waveNumber * 0.2, 4, 8);
  const spawnY = toNormY(height, -120);

  const move: MoveScript = {
    steps: [
      { durationMs: 650, kind: "dashTo", to: { x: 0, y: 150 } },
      { durationMs: dur, kind: "hover" },
      { durationMs: 850, kind: "dashTo", to: { x: 0, y: 860 } },
    ],
  };

  const leftFire = fireSweep(BULLET_LIGHT, rate, dur, 70, 110);
  const rightFire = mirrorFireX(leftFire);

  const spawns: Spawn[] = [
    {
      atMs: 0,
      enemyId: "swooper" as EnemyId,
      overrides: { fire: leftFire, hp: scaleHp(6, waveNumber), move },
      x: leftX,
      y: spawnY,
    },
    {
      atMs: 0,
      enemyId: "swooper" as EnemyId,
      overrides: { fire: rightFire, hp: scaleHp(6, waveNumber), move },
      x: rightX,
      y: spawnY,
    },
  ];

  return { id: `crossfire-sweep-${waveNumber}`, spawns };
};

/**
 * 6) Lane Denial: three turrets with staggered activation so the player must weave.
 * High intensity but “pattern readable.”
 */
export const waveLaneDenial: WaveFactory = ({ height, waveNumber, width }) => {
  const dur = clamp(1200 + waveNumber * 60, 1200, 2400);
  const rate = clamp(5 + waveNumber * 0.25, 5, 9);

  const mk = (lane: 0 | 2 | 4, delay: number, sweep: boolean): Spawn => {
    const x = laneX(width, lane);
    const move: MoveScript = {
      steps: [
        { durationMs: 650, kind: "dashTo", to: { x: 0, y: 140 } },
        { durationMs: dur + delay, kind: "hover" },
        { durationMs: 900, kind: "dashTo", to: { x: 0, y: 860 } },
      ],
    };

    const fire: FireScript = sweep
      ? {
          steps: [
            { durationMs: 450 + delay, kind: "cooldown" },
            {
              aim: { fromDeg: 82, kind: "sweep", periodMs: dur, toDeg: 98 },
              bullet: BULLET_LIGHT,
              durationMs: dur,
              kind: "spray",
              ratePerSec: rate,
            },
          ],
        }
      : {
          steps: [
            { durationMs: 450 + delay, kind: "cooldown" },
            {
              aim: { angleDeg: 90, kind: "fixed" },
              bullet: BULLET_LIGHT,
              durationMs: dur,
              kind: "spray",
              ratePerSec: rate,
            },
          ],
        };

    return {
      atMs: 0,
      enemyId: "bomber" as EnemyId,
      overrides: {
        fire,
        goldDrop: scaleGold(4, 8, waveNumber),
        hp: scaleHp(8, waveNumber),
        move,
      },
      x,
      y: toNormY(height, -120),
    };
  };

  return {
    id: `lane-denial-${waveNumber}`,
    spawns: [mk(0, 0, false), mk(2, 350, true), mk(4, 700, false)],
  };
};

/**
 * 7) Panic Dashers: lots of light enemies dash into the playfield and exit quickly.
 * High intensity spike, short wave.
 */
export const wavePanicDashers: WaveFactory = ({
  height,
  waveNumber,
  width,
}) => {
  const n = clamp(6 + Math.floor(waveNumber / 2), 6, 16);
  const interval = clamp(220 - waveNumber * 2, 110, 220);
  const spawnY = toNormY(height, -90);

  const spawns: Spawn[] = [];
  for (let i = 0; i < n; i += 1) {
    const lane = (i % 5) as 0 | 1 | 2 | 3 | 4;
    const x = laneX(width, lane);

    const move: MoveScript = {
      steps: [
        { durationMs: 450, kind: "dashTo", to: { x: 0, y: 110 } },
        { durationMs: 240, kind: "hover" },
        { durationMs: 650, kind: "dashTo", to: { x: 0, y: 880 } },
      ],
    };

    // mostly no fire; occasional surprise burst every 3rd enemy
    const fire: FireScript =
      i % 3 === 0
        ? {
            steps: [
              { durationMs: 420, kind: "cooldown" },
              {
                aim: { kind: "atPlayer" },
                bullet: BULLET_LIGHT,
                count: 2,
                intervalMs: 120,
                kind: "burst",
              },
            ],
          }
        : { steps: [] };

    spawns.push({
      atMs: i * interval,
      enemyId: "snake" as EnemyId, // low HP type in your defs; change to a dedicated 'darter' later
      overrides: {
        fire,
        goldDrop: scaleGold(1, 2, waveNumber),
        hp: scaleHp(2, waveNumber),
        move,
      },
      x,
      y: spawnY,
    });
  }

  return { id: `panic-dashers-${waveNumber}`, spawns };
};

/**
 * 8) Breather Loopers: pretty movement, low threat. Great for pacing.
 */
export const waveBreatherLoopers: WaveFactory = ({
  height,
  waveNumber,
  width,
}) => {
  const count = 5;
  const interval = 320;
  const spawnY = toNormY(height, -120);

  const spawns: Spawn[] = [];
  for (let i = 0; i < count; i += 1) {
    const x = laneX(width, (i % 5) as 0 | 1 | 2 | 3 | 4);
    const move: MoveScript = {
      steps: [
        {
          durationMs: 1600,
          kind: "bezier",
          points: [
            { x: 0, y: 0 },
            { x: i % 2 === 0 ? -120 : 120, y: 160 },
            { x: i % 2 === 0 ? 120 : -120, y: 320 },
            { x: 0, y: 520 },
          ],
        },
        { durationMs: 900, kind: "dashTo", to: { x: 0, y: 900 } },
      ],
    };

    spawns.push({
      atMs: i * interval,
      enemyId: "sine" as EnemyId,
      overrides: {
        fire: { steps: [] },
        goldDrop: scaleGold(2, 4, waveNumber),
        hp: scaleHp(3, waveNumber),
        move,
      },
      x,
      y: spawnY,
    });
  }

  return { id: `breather-loopers-${waveNumber}`, spawns };
};

/**
 * 9) Exit Fire Swoopers: enemies only shoot as they leave (deceptive).
 */
export const waveExitFireSwoopers: WaveFactory = ({
  height,
  waveNumber,
  width,
}) => {
  const count = clamp(4 + Math.floor(waveNumber / 4), 4, 9);
  const interval = clamp(420 - waveNumber * 5, 220, 420);
  const spawnY = toNormY(height, -140);

  const spawns: Spawn[] = [];
  for (let i = 0; i < count; i += 1) {
    const dir = i % 3 === 0 ? "left" : i % 3 === 1 ? "mid" : "right";
    const x =
      dir === "left"
        ? laneX(width, 1)
        : dir === "right"
          ? laneX(width, 3)
          : laneX(width, 2);

    const move = makeSwoop(dir);

    const fire: FireScript = {
      steps: [
        { durationMs: 1300, kind: "cooldown" },
        {
          aim: { kind: "atPlayer" },
          bullet: waveNumber < 10 ? BULLET_LIGHT : BULLET_FAST,
          count: 3,
          intervalMs: 140,
          kind: "burst",
        },
      ],
    };

    spawns.push({
      atMs: i * interval,
      enemyId: "swooper" as EnemyId,
      overrides: {
        fire,
        goldDrop: scaleGold(3, 7, waveNumber),
        hp: scaleHp(5, waveNumber),
        move,
      },
      x,
      y: spawnY,
    });
  }

  return { id: `exit-fire-swoopers-${waveNumber}`, spawns };
};

/**
 * 10) Bombing Gauntlet: alternating bombers + sine pressure.
 * High intensity “signature” pattern.
 */
export const waveBombingGauntlet: WaveFactory = ({
  height,
  waveNumber,
  width,
}) => {
  const bomberCount = clamp(4 + Math.floor(waveNumber / 5), 4, 8);
  const bomberInterval = clamp(700 - waveNumber * 6, 420, 700);
  const bomberY = toNormY(height, -120);
  const pressureY = toNormY(height, -90);

  const spawns: Spawn[] = [];
  for (let i = 0; i < bomberCount; i += 1) {
    const isLeft = i % 2 === 0;
    const x = isLeft ? laneX(width, 1) : laneX(width, 3);

    const move: MoveScript = {
      steps: [
        { durationMs: 520, kind: "dashTo", to: { x: 0, y: 170 } },
        { durationMs: 1100, kind: "hover" },
        { durationMs: 900, kind: "dashTo", to: { x: 0, y: 880 } },
      ],
    };

    const fire: FireScript = {
      steps: [
        { durationMs: 650, kind: "cooldown" },
        {
          aim: { angleDeg: 90, kind: "fixed" },
          bullet: waveNumber < 10 ? BULLET_HEAVY : BULLET_FAST,
          count: 4,
          intervalMs: 180,
          kind: "burst",
        },
      ],
    };

    spawns.push({
      atMs: i * bomberInterval,
      enemyId: "bomber" as EnemyId,
      overrides: {
        fire,
        goldDrop: scaleGold(5, 9, waveNumber),
        hp: scaleHp(7, waveNumber),
        move,
      },
      x,
      y: bomberY,
    });

    // add “pressure” sine enemies during the hover windows
    const pressureN = 2;
    const pressureLanes: (0 | 1 | 2 | 3 | 4)[] = [0, 2, 4, 1, 3];
    for (let p = 0; p < pressureN; p += 1) {
      const lane = pressureLanes[(i + p) % pressureLanes.length];
      spawns.push({
        atMs: i * bomberInterval + 260 + p * 240,
        enemyId: "sine" as EnemyId,
        overrides: {
          goldDrop: scaleGold(2, 4, waveNumber),
          hp: scaleHp(3, waveNumber),
        },
        x: laneX(width, lane),
        y: pressureY,
      });
    }
  }

  return { id: `bombing-gauntlet-${waveNumber}`, spawns };
};

/**
 * 11) Sniper Pickets: precision shooters that hold the lanes.
 * Medium intensity, forces micro-movement.
 */
export const waveSniperPickets: WaveFactory = ({
  height,
  waveNumber,
  width,
}) => {
  const spawnY = toNormY(height, -120);
  const count = clamp(2 + Math.floor(waveNumber / 6), 2, 4);
  const interval = clamp(500 - waveNumber * 4, 280, 500);
  const lanes: (0 | 1 | 2 | 3 | 4)[] = [1, 3, 0, 4];

  const spawns: Spawn[] = [];
  for (let i = 0; i < count; i += 1) {
    const lane = lanes[i % lanes.length];
    spawns.push({
      atMs: i * interval,
      enemyId: "sniper" as EnemyId,
      overrides: {
        goldDrop: scaleGold(4, 6, waveNumber),
        hp: scaleHp(4, waveNumber),
      },
      x: laneX(width, lane),
      y: spawnY,
    });
  }

  return { id: `sniper-pickets-${waveNumber}`, spawns };
};

/**
 * 12) Spinner Sweep: sweeping arcs that encourage lane changes.
 * Medium/high intensity, visually distinct.
 */
export const waveSpinnerSweep: WaveFactory = ({
  height,
  waveNumber,
  width,
}) => {
  const spawnY = toNormY(height, -130);
  const interval = clamp(360 - waveNumber * 4, 220, 360);
  const count = clamp(3 + Math.floor(waveNumber / 5), 3, 6);

  const spawns: Spawn[] = [];
  for (let i = 0; i < count; i += 1) {
    const lane = (i % 5) as 0 | 1 | 2 | 3 | 4;
    spawns.push({
      atMs: i * interval,
      enemyId: "spinner" as EnemyId,
      overrides: {
        goldDrop: scaleGold(5, 7, waveNumber),
        hp: scaleHp(6, waveNumber),
      },
      x: laneX(width, lane),
      y: spawnY,
    });
  }

  return { id: `spinner-sweep-${waveNumber}`, spawns };
};

/**
 * 13) Crossfire Triptych: staggered crossfire turrets.
 * High intensity, clear readable pattern.
 */
export const waveCrossfireTriptych: WaveFactory = ({
  height,
  waveNumber,
  width,
}) => {
  const spawnY = toNormY(height, -120);
  const interval = 260;
  const lanes: (0 | 1 | 2 | 3 | 4)[] = [1, 2, 3];

  const spawns: Spawn[] = [];
  for (let i = 0; i < lanes.length; i += 1) {
    spawns.push({
      atMs: i * interval,
      enemyId: "crossfire" as EnemyId,
      overrides: {
        goldDrop: scaleGold(5, 8, waveNumber),
        hp: scaleHp(6, waveNumber),
      },
      x: laneX(width, lanes[i]),
      y: spawnY,
    });
  }

  return { id: `crossfire-triptych-${waveNumber}`, spawns };
};

/**
 * 14) Skitter Blitz: fast darting ships hopping across lanes.
 * High intensity, short pauses between dashes.
 */
export const waveSkitterBlitz: WaveFactory = ({
  height,
  waveNumber,
  width,
}) => {
  const spawnY = toNormY(height, -120);
  const count = clamp(3 + Math.floor(waveNumber / 4), 3, 7);
  const interval = clamp(520 - waveNumber * 4, 260, 520);

  const spawns: Spawn[] = [];
  for (let i = 0; i < count; i += 1) {
    spawns.push({
      atMs: i * interval,
      enemyId: "skitter" as EnemyId,
      overrides: {
        goldDrop: scaleGold(5, 7, waveNumber),
        hp: scaleHp(6, waveNumber),
        move: makeSkitterMove(width, height),
      },
      x: laneX(width, (i % 5) as 0 | 1 | 2 | 3 | 4),
      y: spawnY,
    });
  }

  return { id: `skitter-blitz-${waveNumber}`, spawns };
};

/**
 * 15) Asteroid Field: chunky debris rain with varied sizes.
 * Low/medium intensity, keeps the player moving.
 */
export const waveAsteroidField: WaveFactory = ({
  height,
  waveNumber,
  width,
}) => {
  const spawnY = toNormY(height, -140);
  const count = clamp(8 + Math.floor(waveNumber / 3), 8, 18);
  const interval = clamp(180 - waveNumber * 2, 120, 180);

  const spawns: Spawn[] = [];
  for (let i = 0; i < count; i += 1) {
    const sizeRoll = Math.random();
    const radius = sizeRoll > 0.7 ? 20 : sizeRoll > 0.4 ? 14 : 10;
    const baseHp = sizeRoll > 0.7 ? 9 : sizeRoll > 0.4 ? 5 : 3;
    const drift = (Math.random() * 2 - 1) * 80;
    const durationMs = 2200 + Math.random() * 1400;
    spawns.push({
      atMs: i * interval,
      enemyId: "asteroid" as EnemyId,
      overrides: {
        goldDrop: scaleGold(1, 3, waveNumber),
        hp: scaleHp(baseHp, waveNumber),
        move: makeAsteroidMove(height, drift, durationMs),
        radius,
      },
      x: Math.random(),
      y: spawnY,
    });
  }

  return { id: `asteroid-field-${waveNumber}`, spawns };
};

export const buildBossWave = (
  waveNumber: number,
  width: number,
  height: number,
): WaveDefinition => {
  const spawnY = toNormY(height, -30);
  const bossRank = Math.max(
    1,
    Math.floor((waveNumber + 1) / BOSS_WAVE_INTERVAL),
  );
  const baseBoss = ENEMIES.boss;
  const scaledFire = scaleBossFire(baseBoss.fire, bossRank);
  const scaledPhases = baseBoss.phases
    ? baseBoss.phases.map((phase) => ({
        ...phase,
        fire: phase.fire ? scaleBossFire(phase.fire, bossRank) : undefined,
      }))
    : undefined;

  const supportInterval = clamp(2400 - bossRank * 200, 1600, 2400);
  const supportCount = clamp(2 + bossRank, 2, 6);
  const supportY = toNormY(height, -120);
  const spawns: Spawn[] = [
    {
      atMs: 0,
      enemyId: "boss" as EnemyId,
      overrides: {
        fire: scaledFire,
        goldDrop: scaleGold(20, 32, waveNumber),
        hp: scaleBossHp(60, waveNumber),
        phases: scaledPhases,
      },
      x: 0.5,
      y: spawnY,
    },
  ];
  for (let i = 0; i < supportCount; i += 1) {
    const enemyId = bossRank > 2 && i % 2 === 1 ? "skitter" : "sine";
    spawns.push({
      atMs: 1600 + i * supportInterval,
      enemyId: enemyId as EnemyId,
      overrides: {
        goldDrop: scaleGold(3, 6, waveNumber),
        hp: scaleHp(enemyId === "skitter" ? 6 : 4, waveNumber),
        move:
          enemyId === "skitter" ? makeSkitterMove(width, height) : undefined,
      },
      x: laneX(width, (i % 5) as 0 | 1 | 2 | 3 | 4),
      y: supportY,
    });
  }
  return {
    id: `boss-${waveNumber + 1}`,
    spawns,
  };
};

// --- export pack ------------------------------------------------------------

export const WAVE_FACTORY_PACK: {
  intensity: WaveIntensity;
  factory: WaveFactory;
}[] = [
  { factory: waveDoubleSnake, intensity: "medium" },
  { factory: waveZigZagCurtain, intensity: "medium" },
  { factory: waveVDive, intensity: "medium" },
  { factory: waveTurretWall, intensity: "high" },
  { factory: waveCrossfireSweep, intensity: "high" },
  { factory: waveLaneDenial, intensity: "high" },
  { factory: wavePanicDashers, intensity: "high" },
  { factory: waveBreatherLoopers, intensity: "low" },
  { factory: waveExitFireSwoopers, intensity: "medium" },
  { factory: waveBombingGauntlet, intensity: "high" },
  { factory: waveSniperPickets, intensity: "medium" },
  { factory: waveSpinnerSweep, intensity: "medium" },
  { factory: waveCrossfireTriptych, intensity: "high" },
  { factory: waveSkitterBlitz, intensity: "high" },
  { factory: waveAsteroidField, intensity: "low" },
];
