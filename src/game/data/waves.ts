import type { EnemyDef, EnemyId } from "./enemyTypes";
import type { MoveScript } from "./scripts";

export type EnemyOverride = Partial<
  Pick<
    EnemyDef,
    | "fire"
    | "goldDrop"
    | "hp"
    | "move"
    | "phases"
    | "radius"
    | "rotation"
    | "rotationDeg"
  >
>;

export interface Spawn {
  atMs: number;
  enemyId: EnemyId;
  x: number; // normalized 0..1 across viewport width
  y: number; // normalized 0..1 across viewport height (can be negative to spawn above)
  overrides?: EnemyOverride;
}

export interface WaveDefinition {
  id: string;
  spawns: Spawn[];
}

const buildSnakeMove = (offsetX: number): MoveScript => ({
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
    { durationMs: 900, kind: "dashTo", to: { x: offsetX, y: 740 } },
  ],
});

const buildSnakeRun = (): Spawn[] => {
  const spawns: Spawn[] = [];
  const count = 7;
  const startX = 0.45;
  const spreadStep = 40;
  for (let i = 0; i < count; i += 1) {
    const offsetX = (i - (count - 1) / 2) * spreadStep;
    spawns.push({
      atMs: i * 170,
      enemyId: "snake",
      overrides: { move: buildSnakeMove(offsetX) },
      x: startX,
      y: -0.15,
    });
  }
  return spawns;
};

const SWOOP_LEFT: MoveScript = {
  steps: [
    {
      durationMs: 1200,
      kind: "bezier",
      points: [
        { x: 0, y: 0 },
        { x: -120, y: 80 },
        { x: -80, y: 170 },
        { x: 0, y: 230 },
      ],
    },
    { durationMs: 900, kind: "hover" },
    {
      durationMs: 1400,
      kind: "bezier",
      points: [
        { x: 0, y: 230 },
        { x: 90, y: 280 },
        { x: 160, y: 200 },
        { x: 220, y: -120 },
      ],
    },
  ],
};

const SWOOP_RIGHT: MoveScript = {
  steps: [
    {
      durationMs: 1200,
      kind: "bezier",
      points: [
        { x: 0, y: 0 },
        { x: 120, y: 90 },
        { x: 80, y: 170 },
        { x: 0, y: 230 },
      ],
    },
    { durationMs: 900, kind: "hover" },
    {
      durationMs: 1400,
      kind: "bezier",
      points: [
        { x: 0, y: 230 },
        { x: -90, y: 280 },
        { x: -160, y: 200 },
        { x: -220, y: -120 },
      ],
    },
  ],
};

const SWOOP_MID: MoveScript = {
  steps: [
    {
      durationMs: 1100,
      kind: "bezier",
      points: [
        { x: 0, y: 0 },
        { x: -40, y: 90 },
        { x: 40, y: 170 },
        { x: 0, y: 230 },
      ],
    },
    { durationMs: 1000, kind: "hover" },
    {
      durationMs: 1300,
      kind: "bezier",
      points: [
        { x: 0, y: 230 },
        { x: 60, y: 280 },
        { x: -60, y: 200 },
        { x: 0, y: -120 },
      ],
    },
  ],
};

const buildSwoopTrio = (): Spawn[] => [
  {
    atMs: 0,
    enemyId: "swooper",
    overrides: { move: SWOOP_LEFT },
    x: 0.22,
    y: -0.18,
  },
  {
    atMs: 400,
    enemyId: "swooper",
    overrides: { move: SWOOP_MID },
    x: 0.5,
    y: -0.18,
  },
  {
    atMs: 800,
    enemyId: "swooper",
    overrides: { move: SWOOP_RIGHT },
    x: 0.78,
    y: -0.18,
  },
  {
    atMs: 1300,
    enemyId: "sine",
    x: 0.5,
    y: -0.12,
  },
];

const buildBombingPressure = (): Spawn[] => {
  const spawns: Spawn[] = [
    { atMs: 0, enemyId: "bomber", x: 0.3, y: -0.12 },
    { atMs: 700, enemyId: "bomber", x: 0.65, y: -0.12 },
    { atMs: 1400, enemyId: "bomber", x: 0.45, y: -0.12 },
  ];
  for (let i = 0; i < 6; i += 1) {
    spawns.push({
      atMs: 300 + i * 450,
      enemyId: "sine",
      x: 0.15 + (i % 5) * 0.17,
      y: -0.1,
    });
  }
  return spawns;
};

export const WAVES: WaveDefinition[] = [
  { id: "snake-run", spawns: buildSnakeRun() },
  { id: "swoop-trio", spawns: buildSwoopTrio() },
  { id: "bombing-pressure", spawns: buildBombingPressure() },
];
