import { z } from "zod";

export const CONTENT_KINDS = [
  "beats",
  "enemies",
  "hazards",
  "levels",
  "secondaryWeapons",
  "ships",
  "shops",
  "waves",
  "weapons",
] as const;

export type ContentKind = (typeof CONTENT_KINDS)[number];

const idSchema = z.string().min(1);

const colorSchema = z.union([
  z.number(),
  z.string().regex(/^(#|0x)?[0-9a-fA-F]{6}$/),
]);

const vec2Schema = z.object({
  x: z.number(),
  y: z.number(),
});

const pressureKindSchema = z.enum([
  "enemy",
  "focus",
  "space",
  "throughput",
  "time",
]);

const pressureProfileSchema = z.object({
  primary: pressureKindSchema,
  secondary: z.array(pressureKindSchema).optional(),
});

const hazardMotionSchema = z.union([
  z.object({
    amplitude: z.number(),
    axis: z.enum(["x", "y"]),
    kind: z.literal("sine"),
    periodMs: z.number().positive(),
    phase: z.number().optional(),
  }),
  z.object({
    axis: z.enum(["x", "y"]),
    durationMs: z.number().positive(),
    from: z.number(),
    kind: z.literal("lerp"),
    to: z.number(),
    yoyo: z.boolean().optional(),
  }),
]);

const laneWallSchema = z.object({
  damageOnTouch: z.boolean().optional(),
  fillColor: colorSchema.optional(),
  id: idSchema,
  lineColor: colorSchema.optional(),
  motion: hazardMotionSchema.optional(),
  rect: z.object({
    h: z.number(),
    w: z.number(),
    x: z.number(),
    y: z.number(),
  }),
  type: z.literal("laneWall"),
});

const moveStepSchema = z.union([
  z.object({
    durationMs: z.number(),
    ease: z.enum(["in", "inOut", "linear", "out"]).optional(),
    kind: z.literal("bezier"),
    points: z.array(vec2Schema),
  }),
  z.object({
    durationMs: z.number(),
    ease: z.enum(["in", "inOut", "linear", "out"]).optional(),
    kind: z.literal("dashTo"),
    to: vec2Schema,
  }),
  z.object({
    durationMs: z.number(),
    kind: z.literal("hover"),
  }),
  z.object({
    amp: z.number(),
    durationMs: z.number(),
    freq: z.number(),
    kind: z.literal("sineDown"),
    speed: z.number(),
  }),
]);

const moveScriptSchema = z.object({
  loop: z.boolean().optional(),
  steps: z.array(moveStepSchema),
});

const aimSchema = z.union([
  z.object({
    kind: z.literal("atPlayer"),
  }),
  z.object({
    angleDeg: z.number(),
    kind: z.literal("fixed"),
  }),
  z.object({
    fromDeg: z.number(),
    kind: z.literal("sweep"),
    periodMs: z.number(),
    toDeg: z.number(),
  }),
]);

const bulletHomingSchema = z.object({
  acquireRadius: z.number(),
  turnRateRadPerSec: z.number(),
});

const bulletAoeSchema = z.object({
  damage: z.number(),
  radius: z.number(),
});

const bulletTrailSchema = z.object({
  color: colorSchema,
  count: z.number().optional(),
  intervalMs: z.number().optional(),
  sizeMax: z.number().optional(),
  sizeMin: z.number().optional(),
});

const bulletSpecSchema = z.object({
  aoe: bulletAoeSchema.optional(),
  color: colorSchema.optional(),
  damage: z.number(),
  homing: bulletHomingSchema.optional(),
  kind: z.enum(["bomb", "dart", "missile", "orb"]),
  length: z.number().optional(),
  lifetimeMs: z.number().optional(),
  radius: z.number(),
  speed: z.number(),
  thickness: z.number().optional(),
  trail: bulletTrailSchema.optional(),
});

const fireStepSchema = z.union([
  z.object({
    aim: aimSchema,
    bullet: bulletSpecSchema,
    count: z.number(),
    intervalMs: z.number(),
    kind: z.literal("burst"),
    originOffsets: z.array(vec2Schema).optional(),
  }),
  z.object({
    durationMs: z.number(),
    kind: z.literal("charge"),
  }),
  z.object({
    durationMs: z.number(),
    kind: z.literal("cooldown"),
  }),
  z.object({
    aim: aimSchema,
    bullet: bulletSpecSchema,
    durationMs: z.number(),
    kind: z.literal("spray"),
    originOffsets: z.array(vec2Schema).optional(),
    ratePerSec: z.number(),
  }),
]);

const fireScriptSchema = z.object({
  loop: z.boolean().optional(),
  steps: z.array(fireStepSchema),
});

const weaponPatternSchema = z.union([
  z.object({
    anglesDeg: z.array(z.number()),
    kind: z.literal("angles"),
  }),
  z.object({
    count: z.number(),
    kind: z.literal("fan"),
    spreadDeg: z.number(),
  }),
]);

const enemyStyleSchema = z.object({
  fillColor: colorSchema.optional(),
  lineColor: colorSchema.optional(),
  shape: z.enum([
    "asteroid",
    "bomber",
    "boss",
    "crossfire",
    "sine",
    "skitter",
    "snake",
    "sniper",
    "spinner",
    "swooper",
  ]).optional(),
});

const bossPhaseSchema = z.object({
  fire: fireScriptSchema.optional(),
  hpThreshold: z.number(),
  move: moveScriptSchema.optional(),
});

const enemySchema = z.object({
  fire: fireScriptSchema,
  goldDrop: z.object({
    max: z.number(),
    min: z.number(),
  }),
  hp: z.number(),
  id: idSchema,
  move: moveScriptSchema,
  phases: z.array(bossPhaseSchema).optional(),
  radius: z.number(),
  rotation: z.enum(["fixed", "movement"]).optional(),
  rotationDeg: z.number().optional(),
  style: enemyStyleSchema.optional(),
});

const spawnSchema = z.object({
  atMs: z.number().min(0),
  enemyId: idSchema,
  overrides: z.record(z.string(), z.unknown()).optional(),
  x: z.number(),
  y: z.number(),
});

const waveSchema = z.object({
  id: idSchema,
  spawns: z.array(spawnSchema),
});

const beatSchema = z.object({
  id: idSchema,
  lines: z.array(z.string()),
  title: z.string(),
});

const shopSchema = z.object({
  allowedSecondaryWeapons: z.array(idSchema).optional(),
  allowedShips: z.array(idSchema).optional(),
  allowedWeapons: z.array(idSchema).optional(),
  caps: z
    .object({
      primaryCost: z.number().min(0).optional(),
      secondaryCost: z.number().min(0).optional(),
      shipCost: z.number().min(0).optional(),
    })
    .optional(),
  id: idSchema,
});

const winConditionSchema = z.union([
  z.object({ kind: z.literal("clearWaves") }),
  z.object({ bossId: idSchema, kind: z.literal("defeatBoss") }),
  z.object({ durationMs: z.number().positive(), kind: z.literal("survive") }),
]);

const levelSchema = z.object({
  endCondition: winConditionSchema.optional(),
  hazardIds: z.array(idSchema).optional(),
  id: idSchema,
  postBeatId: idSchema.optional(),
  preBeatId: idSchema.optional(),
  pressureProfile: pressureProfileSchema,
  shopId: idSchema.optional(),
  title: z.string(),
  waveIds: z.array(idSchema),
  winCondition: winConditionSchema,
});

const weaponSchema = z.object({
  bullet: bulletSpecSchema,
  cost: z.number().min(0),
  description: z.string(),
  fireRate: z.number(),
  icon: z.enum(["bomb", "dart", "missile", "orb"]),
  id: idSchema,
  muzzleOffsets: z.array(vec2Schema).optional(),
  name: z.string(),
  pattern: weaponPatternSchema,
});

const secondaryWeaponSchema = z.object({
  bullet: bulletSpecSchema,
  cost: z.number().min(0),
  description: z.string(),
  fireRate: z.number(),
  id: idSchema,
  muzzleOffsets: z.array(vec2Schema).optional(),
  name: z.string(),
  pattern: weaponPatternSchema,
});

const shipSchema = z.object({
  color: colorSchema,
  cost: z.number().min(0),
  description: z.string(),
  id: idSchema,
  magnetMultiplier: z.number(),
  maxHp: z.number(),
  moveSpeed: z.number(),
  name: z.string(),
  radiusMultiplier: z.number(),
  shape: z.enum(["bulwark", "interceptor", "scout", "starling"]),
});

export const contentSchemas = {
  beats: beatSchema,
  enemies: enemySchema,
  hazards: laneWallSchema,
  levels: levelSchema,
  secondaryWeapons: secondaryWeaponSchema,
  ships: shipSchema,
  shops: shopSchema,
  waves: waveSchema,
  weapons: weaponSchema,
} satisfies Record<ContentKind, z.ZodSchema>;

export type BeatContent = z.infer<typeof beatSchema>;
export type EnemyContent = z.infer<typeof enemySchema>;
export type HazardContent = z.infer<typeof laneWallSchema>;
export type LevelContent = z.infer<typeof levelSchema>;
export type SecondaryWeaponContent = z.infer<typeof secondaryWeaponSchema>;
export type ShipContent = z.infer<typeof shipSchema>;
export type ShopContent = z.infer<typeof shopSchema>;
export type WaveContent = z.infer<typeof waveSchema>;
export type WeaponContent = z.infer<typeof weaponSchema>;
