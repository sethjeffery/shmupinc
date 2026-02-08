import { z } from "zod";

export const CONTENT_KINDS = [
  "beats",
  "bullets",
  "enemies",
  "guns",
  "hazards",
  "levels",
  "ships",
  "shops",
  "waves",
  "weapons",
] as const;

export type ContentKind = (typeof CONTENT_KINDS)[number];

const idSchema = z.string().min(1);
const idField = (description: string): z.ZodString =>
  idSchema.describe(description);
const idArray = (description: string): z.ZodArray<z.ZodString> =>
  z.array(idSchema).describe(description);

const colorSchema = z.number().int();
const colorField = (description: string): typeof colorSchema =>
  colorSchema.describe(`${description} (hex number, e.g. 0xffb067).`);

const vec2Schema = z.object({
  x: z.number().describe("Local X offset in pixels."),
  y: z.number().describe("Local Y offset in pixels."),
});

const gunPointSchema = z.object({
  x: z.number().describe("Normalized X (-1..1, 0 centered)."),
  y: z.number().describe("Normalized Y (-1..1, 0 centered)."),
});

const gunLineSchema = z.object({
  from: gunPointSchema.describe("Line start point."),
  to: gunPointSchema.describe("Line end point."),
});

const gunSchema = z.object({
  description: z.string().describe("Player-facing description."),
  fillColor: colorField("Optional fill color override.").optional(),
  id: idField("Unique gun id."),
  lineColor: colorField("Optional line color override.").optional(),
  lines: z.array(gunLineSchema).describe("Optional line accents.").optional(),
  name: z.string().describe("Display name."),
  outline: z
    .array(gunPointSchema)
    .describe("Closed outline points for the gun body."),
});

const weaponZoneSchema = z.enum(["front", "rear", "side"]);

const weaponSizeSchema = z.enum(["large", "small"]);

const pressureKindSchema = z.enum([
  "enemy",
  "focus",
  "space",
  "throughput",
  "time",
]);

const pressureProfileSchema = z.object({
  primary: pressureKindSchema.describe(
    "Dominant gameplay pressure for the level.",
  ),
  secondary: z
    .array(pressureKindSchema)
    .describe("Optional supporting pressures for pacing and theme.")
    .default([]),
});

const hazardMotionSchema = z.union([
  z.object({
    amplitude: z.number().describe("Normalized amplitude (0..1 of axis)."),
    axis: z.enum(["x", "y"]).describe("Axis to move along."),
    kind: z.literal("sine").describe("Sine motion."),
    periodMs: z.number().positive().describe("Full cycle duration in ms."),
    phase: z.number().describe("Phase offset in radians.").default(0),
  }),
  z.object({
    axis: z.enum(["x", "y"]).describe("Axis to move along."),
    durationMs: z
      .number()
      .positive()
      .describe("Time to move from from -> to (ms)."),
    from: z.number().describe("Start offset (normalized)."),
    kind: z.literal("lerp").describe("Linear motion."),
    to: z.number().describe("End offset (normalized)."),
    yoyo: z
      .boolean()
      .describe("Reverse back to from when done.")
      .default(false),
  }),
]);

const laneWallSchema = z.object({
  damageOnTouch: z.boolean().describe("Deal damage on contact.").default(false),
  fillColor: colorField("Fill color (kept subtle).").default(0x0b1220),
  id: idField("Unique hazard id."),
  lineColor: colorField("Outline color.").default(0x1b3149),
  motion: hazardMotionSchema
    .describe("Optional motion applied to the center.")
    .optional(),
  rect: z.object({
    h: z.number().describe("Normalized height (0..1 of playfield)."),
    w: z.number().describe("Normalized width (0..1 of playfield)."),
    x: z.number().describe("Normalized center X (0..1)."),
    y: z.number().describe("Normalized center Y (0..1)."),
  }),
  type: z.literal("laneWall").describe("Hazard type (lane wall)."),
});

const moveStepSchema = z.union([
  z.object({
    durationMs: z.number().describe("Step duration (ms)."),
    ease: z
      .enum(["in", "inOut", "outIn", "linear", "out"])
      .describe("Easing curve.")
      .default("linear")
      .optional(),
    kind: z.literal("bezier").describe("Follow a bezier curve."),
    points: z
      .array(vec2Schema)
      .describe(
        "Bezier points relative to the step start (0,0 at current position).",
      ),
  }),
  z.object({
    durationMs: z.number().describe("Step duration (ms)."),
    ease: z
      .enum(["in", "inOut", "outIn", "linear", "out"])
      .describe("Easing curve.")
      .default("linear")
      .optional(),
    kind: z.literal("dashTo").describe("Dash by a local offset."),
    position: z
      .enum(["absolute", "relative"])
      .describe("Interpret the target as absolute (spawn anchor) or relative.")
      .default("relative")
      .optional(),
    to: vec2Schema.describe("Target offset from the step start."),
  }),
  z.object({
    durationMs: z.number().describe("Step duration (ms)."),
    kind: z.literal("hover").describe("Hold position."),
  }),
  z.object({
    amp: z.number().describe("Vertical amplitude."),
    durationMs: z.number().describe("Step duration (ms)."),
    freq: z.number().describe("Sine frequency."),
    kind: z.literal("sineDown").describe("Sine drift downward."),
    speed: z.number().describe("Downward speed."),
  }),
]);

const moveScriptSchema = z.object({
  loop: z
    .boolean()
    .describe("Loop steps after finishing.")
    .default(false)
    .optional(),
  steps: z.array(moveStepSchema).describe("Ordered movement steps."),
});

const aimSchema = z.union([
  z.object({
    kind: z.literal("atPlayer").describe("Aim at player at fire time."),
  }),
  z.object({
    angleDeg: z.number().describe("Fixed angle in degrees."),
    kind: z.literal("fixed").describe("Fire at a fixed angle."),
  }),
  z.object({
    fromDeg: z.number().describe("Sweep start angle."),
    kind: z.literal("sweep").describe("Sweep between angles."),
    periodMs: z.number().describe("Sweep period (ms)."),
    toDeg: z.number().describe("Sweep end angle."),
  }),
]);

const bulletHomingSchema = z.object({
  acquireRadius: z.number().describe("Acquire radius for homing."),
  turnRateRadPerSec: z.number().describe("Max turn rate (rad/s)."),
});

const bulletAoeSchema = z.object({
  damage: z.number().describe("AoE damage on detonation."),
  radius: z.number().describe("AoE radius in pixels."),
});

const bulletTrailSchema = z.object({
  color: colorField("Trail color."),
  count: z.number().describe("Trail segment count.").optional(),
  intervalMs: z.number().describe("Trail spawn interval (ms).").optional(),
  sizeMax: z.number().describe("Max trail size.").optional(),
  sizeMin: z.number().describe("Min trail size.").optional(),
});

export const bulletSchema = z.object({
  color: colorField("Bullet color.").optional(),
  id: idField("Unique bullet id."),
  kind: z.enum(["bomb", "dart", "missile", "orb"]).describe("Bullet kind."),
  length: z.number().describe("Visual length (for darts).").optional(),
  radius: z.number().describe("Collision radius in pixels."),
  thickness: z.number().describe("Stroke thickness in pixels.").optional(),
  trail: bulletTrailSchema.describe("Trail settings.").optional(),
});

const fireStepSchema = z.union([
  z.object({
    aim: aimSchema.describe("Aim definition."),
    aoe: bulletAoeSchema
      .describe("AoE settings (per burst bullet).")
      .optional(),
    bulletId: idField("Reference to a bullet definition.").optional(),
    count: z.number().describe("Shots per burst."),
    damage: z.number().describe("Damage per hit.").optional(),
    homing: bulletHomingSchema
      .describe("Homing settings (per burst bullet).")
      .optional(),
    intervalMs: z.number().describe("Burst interval (ms)."),
    kind: z.literal("burst").describe("Fire a short burst."),
    lifetimeMs: z
      .number()
      .describe("Bullet lifetime in ms (per burst bullet).")
      .optional(),
    originOffsets: z
      .array(vec2Schema)
      .describe("Local muzzle offsets.")
      .optional(),
    speed: z
      .number()
      .describe("Projectile speed (per burst bullet).")
      .optional(),
  }),
  z.object({
    durationMs: z.number().describe("Charge duration (ms)."),
    kind: z.literal("charge").describe("Pause before firing."),
  }),
  z.object({
    durationMs: z.number().describe("Cooldown duration (ms)."),
    kind: z.literal("cooldown").describe("Pause after firing."),
  }),
  z.object({
    aim: aimSchema.describe("Aim definition."),
    aoe: bulletAoeSchema
      .describe("AoE settings (per spray bullet).")
      .optional(),
    bulletId: idField("Reference to a bullet definition.").optional(),
    damage: z.number().describe("Damage per hit.").optional(),
    durationMs: z.number().describe("Spray duration (ms)."),
    homing: bulletHomingSchema
      .describe("Homing settings (per spray bullet).")
      .optional(),
    kind: z.literal("spray").describe("Continuous fire."),
    lifetimeMs: z
      .number()
      .describe("Bullet lifetime in ms (per spray bullet).")
      .optional(),
    originOffsets: z
      .array(vec2Schema)
      .describe("Local muzzle offsets.")
      .optional(),
    ratePerSec: z.number().describe("Shots per second."),
    speed: z
      .number()
      .describe("Projectile speed (per spray bullet).")
      .optional(),
  }),
]);

const fireScriptSchema = z.object({
  loop: z
    .boolean()
    .describe("Loop steps after finishing.")
    .default(false)
    .optional(),
  steps: z.array(fireStepSchema).describe("Ordered fire steps."),
});

const weaponShotSchema = z.object({
  angleDeg: z
    .number()
    .describe("Per-bullet angle offset (deg), added to the mount's angle.")
    .default(0),
  offset: vec2Schema
    .describe(
      "Local muzzle offset for this bullet (rotated by shot direction).",
    )
    .default({ x: 0, y: 0 }),
});

const enemyStyleSchema = z.object({
  fillColor: colorField("Fill color for the shape.").default(0x1c0f1a),
  lineColor: colorField("Outline color for the shape.").default(0xff6b6b),
  shape: z
    .enum([
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
      "sidesweeper",
    ])
    .describe("Enemy shape.")
    .default("swooper"),
  vector: z
    .object({
      lines: z
        .array(
          z.object({
            from: vec2Schema.describe("Line start point."),
            to: vec2Schema.describe("Line end point."),
          }),
        )
        .describe("Optional interior lines for detail.")
        .optional(),
      outline: z
        .array(vec2Schema)
        .describe("Closed outline points, relative to enemy radius."),
    })
    .describe("Custom vector shape (overrides built-in silhouette).")
    .optional(),
});

const bossPhaseSchema = z.object({
  fire: fireScriptSchema.describe("Fire script for this phase.").optional(),
  hpThreshold: z
    .number()
    .describe("HP ratio at or below which this phase starts."),
  move: moveScriptSchema.describe("Move script for this phase.").optional(),
});

const enemySchema = z.object({
  fire: fireScriptSchema.describe("Base fire script."),
  goldDrop: z.object({
    max: z.number().describe("Maximum gold drop."),
    min: z.number().describe("Minimum gold drop."),
  }),
  hp: z.number().describe("Total hit points."),
  id: idField("Unique enemy id."),
  move: moveScriptSchema.describe("Base move script."),
  phases: z.array(bossPhaseSchema).describe("Optional boss phases.").optional(),
  radius: z.number().describe("Collision radius in pixels."),
  rotation: z
    .enum(["fixed", "movement"])
    .describe("How the sprite rotates.")
    .default("movement"),
  rotationDeg: z.number().describe("Fixed rotation angle (deg).").default(0),
  style: enemyStyleSchema.describe("Visual styling overrides.").optional(),
});

const enemyOverrideSchema = z.object({
  fire: fireScriptSchema.describe("Override fire script.").optional(),
  goldDrop: z
    .object({
      max: z.number().describe("Override max gold drop."),
      min: z.number().describe("Override min gold drop."),
    })
    .describe("Override gold drop range.")
    .optional(),
  hp: z.number().describe("Override hit points.").optional(),
  move: moveScriptSchema.describe("Override move script.").optional(),
  phases: z.array(bossPhaseSchema).describe("Override boss phases.").optional(),
  radius: z.number().describe("Override collision radius.").optional(),
  rotation: z
    .enum(["fixed", "movement"])
    .describe("Override rotation mode.")
    .optional(),
  rotationDeg: z.number().describe("Override rotation angle.").optional(),
  style: enemyStyleSchema.describe("Override styling.").optional(),
});

const spawnSchema = z.object({
  atMs: z.number().min(0).describe("Spawn time since wave start (ms)."),
  enemyId: idField("Enemy id to spawn."),
  overrides: enemyOverrideSchema
    .describe("Partial overrides applied to the enemy definition.")
    .optional(),
  x: z
    .number()
    .describe(
      "Normalized X offset from center (-0.5..0.5 visible, 0 centered).",
    ),
  y: z
    .number()
    .describe("Normalized Y position (0..1 visible, negative spawns above)."),
});

const waveSchema = z.object({
  id: idField("Unique wave id."),
  spawns: z.array(spawnSchema).describe("Spawn events for this wave."),
});

const beatSchema = z.object({
  id: idField("Unique beat id."),
  lines: z.array(z.string()).describe("Story lines shown in the beat overlay."),
  title: z.string().describe("Headline for the beat overlay."),
});

const shopSchema = z.object({
  allowedShips: idArray(
    "Restrict to these ship ids (omit to allow all).",
  ).optional(),
  allowedWeapons: idArray(
    "Restrict to these weapon ids (omit to allow all).",
  ).optional(),
  caps: z
    .object({
      shipCost: z
        .number()
        .min(0)
        .describe("Max cost allowed for ships.")
        .optional(),
      weaponCost: z
        .number()
        .min(0)
        .describe("Max cost allowed for weapons.")
        .optional(),
    })
    .describe("Optional cost caps for shop items.")
    .optional(),
  id: idField("Unique shop id."),
});

const winConditionSchema = z.union([
  z.object({
    kind: z.literal("clearWaves").describe("Win when all waves finish."),
  }),
  z.object({
    bossId: idField("Boss enemy id."),
    kind: z.literal("defeatBoss").describe("Win when the boss is defeated."),
  }),
  z.object({
    durationMs: z.number().positive().describe("Required survival time (ms)."),
    kind: z.literal("survive").describe("Win by surviving the timer."),
  }),
]);

const levelSchema = z.object({
  endCondition: winConditionSchema
    .describe("Optional override that ends the level early.")
    .optional(),
  hazardIds: idArray("Hazards to spawn at level start.").default([]),
  id: idField("Unique level id."),
  postBeatId: idField("Beat id shown after victory.").optional(),
  preBeatId: idField("Beat id shown before the shop.").optional(),
  pressureProfile: pressureProfileSchema.describe("Intended pressure mix."),
  shopId: idField("Shop rules to apply before play.").optional(),
  title: z.string().describe("Level title shown in UI."),
  waveIds: idArray("Ordered list of wave ids to run."),
  winCondition: winConditionSchema.describe("Primary victory condition."),
});

const weaponStatsSchema = z.object({
  angleDeg: z
    .number()
    .describe("Angle offset from straight up (deg).")
    .default(0)
    .optional(),
  aoe: bulletAoeSchema
    .describe("AoE settings (applied to all bullets fired).")
    .optional(),
  bulletId: idField("Reference to a bullet definition.").optional(),
  damage: z.number().describe("Damage per hit."),
  fireRate: z.number().describe("Shots per second."),
  homing: bulletHomingSchema
    .describe("Homing settings (applied to all bullets fired).")
    .optional(),
  lifetimeMs: z
    .number()
    .describe("Bullet lifetime in ms (applied to all bullets fired).")
    .optional(),
  multiShotMode: z
    .enum(["simultaneous", "roundRobin"])
    .describe("How multi-shot patterns fire (all at once or cycling).")
    .default("simultaneous")
    .optional(),
  shots: z
    .array(weaponShotSchema)
    .describe("Per-bullet definitions (angle + offset).")
    .default([{ angleDeg: 0, offset: { x: 0, y: 0 } }]),
  speed: z
    .number()
    .describe("Projectile speed (applied to all bullets fired)."),
});

const weaponZoneStatsSchema = weaponStatsSchema
  .partial()
  .describe("Overrides applied when mounted in a specific zone.");

const shipVectorSchema = z.object({
  lines: z
    .array(
      z.object({
        from: vec2Schema.describe("Line start point."),
        to: vec2Schema.describe("Line end point."),
      }),
    )
    .describe("Optional interior lines for detail.")
    .optional(),
  outline: z
    .array(vec2Schema)
    .describe("Closed outline points, relative to ship radius."),
});

const weaponSchema = z.object({
  cost: z.number().min(0).describe("Shop cost."),
  description: z.string().describe("Player-facing description."),
  gunId: idField("Gun model id used for icon + mount render."),
  id: idField("Unique weapon id."),
  name: z.string().describe("Display name."),
  size: weaponSizeSchema.describe("Mount size required."),
  stats: weaponStatsSchema.describe("Base weapon stats."),
  zones: z.array(weaponZoneSchema).describe("Supported mount zones."),
  zoneStats: z
    .object({
      front: weaponZoneStatsSchema.optional(),
      rear: weaponZoneStatsSchema.optional(),
      side: weaponZoneStatsSchema.optional(),
    })
    .describe("Per-zone stat overrides.")
    .optional(),
});

const shipSchema = z.object({
  color: colorField("Ship fill color."),
  cost: z.number().min(0).describe("Unlock cost."),
  description: z.string().describe("Player-facing description."),
  id: idField("Unique ship id."),
  magnetMultiplier: z.number().describe("Pickup magnet multiplier."),
  maxHp: z.number().describe("Max HP."),
  mounts: z
    .array(
      z.object({
        id: idField("Unique mount id within this ship."),
        offset: z
          .object({
            x: z.number().describe("Mount X offset in ship-radius units."),
            y: z.number().describe("Mount Y offset in ship-radius units."),
          })
          .describe("Offset from ship center."),
        size: weaponSizeSchema.describe("Mount size."),
        zone: weaponZoneSchema.describe("Mount zone."),
      }),
    )
    .describe("Weapon mounts for this ship."),
  moveSpeed: z.number().describe("Movement speed scalar."),
  name: z.string().describe("Display name."),
  radiusMultiplier: z.number().describe("Collision radius multiplier."),
  shape: z
    .enum(["bulwark", "interceptor", "scout", "starling"])
    .describe("Ship silhouette."),
  vector: shipVectorSchema
    .describe("Custom vector shape (overrides built-in silhouette).")
    .optional(),
});

export const contentSchemas = {
  beats: beatSchema,
  bullets: bulletSchema,
  enemies: enemySchema,
  guns: gunSchema,
  hazards: laneWallSchema,
  levels: levelSchema,
  ships: shipSchema,
  shops: shopSchema,
  waves: waveSchema,
  weapons: weaponSchema,
} satisfies Record<ContentKind, z.ZodSchema>;

export type BeatContent = z.infer<typeof beatSchema>;
export type BulletContent = z.infer<typeof bulletSchema>;
export type EnemyContent = z.infer<typeof enemySchema>;
export type GunContent = z.infer<typeof gunSchema>;
export type HazardContent = z.infer<typeof laneWallSchema>;
export type LevelContent = z.infer<typeof levelSchema>;
export type ShipContent = z.infer<typeof shipSchema>;
export type ShopContent = z.infer<typeof shopSchema>;
export type WaveContent = z.infer<typeof waveSchema>;
export type WeaponContent = z.infer<typeof weaponSchema>;
