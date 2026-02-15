import { z } from "zod";

export const CONTENT_KINDS = [
  "beats",
  "bullets",
  "enemies",
  "galaxies",
  "guns",
  "hazards",
  "mods",
  "objectives",
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

const colorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, "Expected hex color in #RRGGBB format.");
const colorField = (description: string): typeof colorSchema =>
  colorSchema.describe(`${description} (hex string, e.g. #ffb067).`);

const vec2Schema = z.object({
  x: z.number().describe("Local X offset in pixels."),
  y: z.number().describe("Local Y offset in pixels."),
});

const vectorPathCommandSchema = z.union([
  z.tuple([
    z.literal("M"),
    z.number().describe("Move X."),
    z.number().describe("Move Y."),
  ]),
  z.tuple([
    z.literal("L"),
    z.number().describe("Line end X."),
    z.number().describe("Line end Y."),
  ]),
  z.tuple([
    z.literal("Q"),
    z.number().describe("Control X."),
    z.number().describe("Control Y."),
    z.number().describe("End X."),
    z.number().describe("End Y."),
  ]),
  z.tuple([
    z.literal("C"),
    z.number().describe("Control A X."),
    z.number().describe("Control A Y."),
    z.number().describe("Control B X."),
    z.number().describe("Control B Y."),
    z.number().describe("End X."),
    z.number().describe("End Y."),
  ]),
  z.tuple([z.literal("Z")]),
]);

const vectorPathItemSchema = z.object({
  c: z
    .array(vectorPathCommandSchema)
    .describe("Path commands using M/L/Q/C/Z commands."),
  f: z.boolean().describe("Fill this primitive.").optional(),
  s: z.boolean().describe("Stroke this primitive.").optional(),
  t: z.literal("p").describe("Path primitive."),
  w: z
    .number()
    .positive()
    .describe("Optional stroke width override.")
    .optional(),
});

const vectorCircleItemSchema = z.object({
  f: z.boolean().describe("Fill this primitive.").optional(),
  r: z.number().positive().describe("Radius."),
  s: z.boolean().describe("Stroke this primitive.").optional(),
  t: z.literal("c").describe("Circle primitive."),
  w: z
    .number()
    .positive()
    .describe("Optional stroke width override.")
    .optional(),
  x: z.number().describe("Center X."),
  y: z.number().describe("Center Y."),
});

const vectorEllipseItemSchema = z.object({
  f: z.boolean().describe("Fill this primitive.").optional(),
  rx: z.number().positive().describe("Radius X."),
  ry: z.number().positive().describe("Radius Y."),
  s: z.boolean().describe("Stroke this primitive.").optional(),
  t: z.literal("e").describe("Ellipse primitive."),
  w: z
    .number()
    .positive()
    .describe("Optional stroke width override.")
    .optional(),
  x: z.number().describe("Center X."),
  y: z.number().describe("Center Y."),
});

const vectorShapeSchema = z.object({
  items: z
    .array(
      z.union([
        vectorPathItemSchema,
        vectorCircleItemSchema,
        vectorEllipseItemSchema,
      ]),
    )
    .describe("Vector primitives."),
  v: z.literal(2).describe("Vector schema version."),
});

const gunSchema = z.object({
  description: z.string().describe("Player-facing description."),
  fillColor: colorField("Optional fill color override.").optional(),
  id: idField("Unique gun id."),
  lineColor: colorField("Optional line color override.").optional(),
  name: z.string().describe("Display name."),
  vector: vectorShapeSchema.describe("Gun vector shape."),
});

const weaponSizeSchema = z.enum(["large", "small"]);
const modIconKindSchema = z.enum(["aoe", "bounce", "homing", "multi", "power"]);

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
  z.object({
    durationMs: z
      .number()
      .positive()
      .describe("Time to move from start -> end (ms)."),
    from: z
      .object({
        x: z.number().describe("Start X offset (normalized)."),
        y: z.number().describe("Start Y offset (normalized)."),
      })
      .describe("Start offset from base center."),
    kind: z.literal("sweep").describe("Linear sweep in 2D."),
    loop: z
      .boolean()
      .describe("Restart from the beginning after reaching the end.")
      .default(false),
    to: z
      .object({
        x: z.number().describe("End X offset (normalized)."),
        y: z.number().describe("End Y offset (normalized)."),
      })
      .describe("End offset from base center."),
    yoyo: z.boolean().describe("Reverse direction at the end.").default(false),
  }),
]);

const laneWallSchema = z.object({
  damageOnTouch: z.boolean().describe("Deal damage on contact.").default(false),
  deathOnBottomEject: z
    .boolean()
    .describe(
      "Instantly defeat the player if this hazard ejects them below the playfield.",
    )
    .default(false),
  endMs: z
    .number()
    .nonnegative()
    .describe("Optional time when this hazard deactivates.")
    .optional(),
  fillColor: colorField("Fill color (kept subtle).").default("#0b1220"),
  id: idField("Unique hazard id."),
  lineColor: colorField("Outline color.").default("#1b3149"),
  motion: hazardMotionSchema
    .describe("Optional motion applied to the center.")
    .optional(),
  rect: z.object({
    h: z.number().describe("Normalized height (0..1 of playfield)."),
    w: z.number().describe("Normalized width (0..1 of playfield)."),
    x: z.number().describe("Normalized center X (0..1)."),
    y: z.number().describe("Normalized center Y (0..1)."),
  }),
  startMs: z
    .number()
    .nonnegative()
    .describe("Time when this hazard becomes active.")
    .default(0),
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
        "Bezier points in playfield fractions from step start (x=1 full width, y=1 full height).",
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
    to: vec2Schema.describe(
      "Target in playfield fractions (x=1 full width, y=1 full height).",
    ),
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
  kind: z
    .enum(["dot", "spark"])
    .describe("Trail particle primitive.")
    .optional(),
  sizeMax: z.number().describe("Max trail size.").optional(),
  sizeMin: z.number().describe("Min trail size.").optional(),
});

const bulletVfxSchema = z.object({
  detonation: z
    .object({
      burstCount: z
        .number()
        .describe("Burst particle count override.")
        .optional(),
      ringLifeMs: z
        .number()
        .describe("Detonation ring lifetime (ms).")
        .optional(),
      ringThickness: z
        .number()
        .describe("Detonation ring thickness override.")
        .optional(),
    })
    .describe("Explosion/detonation visuals.")
    .optional(),
  impact: z
    .object({
      color: colorField("Impact color override.").optional(),
      ringLifeMs: z.number().describe("Impact ring lifetime (ms).").optional(),
      ringRadius: z
        .number()
        .describe("Impact ring radius override.")
        .optional(),
      sparkCount: z
        .number()
        .describe("Impact spark count override.")
        .optional(),
    })
    .describe("On-hit visuals for non-explosive projectiles.")
    .optional(),
  muzzle: z
    .object({
      burstCount: z
        .number()
        .describe("Muzzle particle count override.")
        .optional(),
      color: colorField("Muzzle color override.").optional(),
      lifeMs: z.number().describe("Muzzle ring lifetime (ms).").optional(),
      radius: z.number().describe("Muzzle ring radius override.").optional(),
    })
    .describe("Muzzle flash visuals.")
    .optional(),
  trail: z
    .object({
      kind: z
        .enum(["dot", "spark"])
        .describe("Trail particle primitive override.")
        .optional(),
    })
    .describe("Trail rendering overrides.")
    .optional(),
});

export const bulletSchema = z.object({
  color: colorField("Bullet color.").optional(),
  id: idField("Unique bullet id."),
  kind: z.enum(["bomb", "dart", "missile", "orb"]).describe("Bullet kind."),
  length: z.number().describe("Visual length (for darts).").optional(),
  radius: z.number().describe("Collision radius in pixels."),
  thickness: z.number().describe("Stroke thickness in pixels.").optional(),
  trail: bulletTrailSchema.describe("Trail settings.").optional(),
  vfx: bulletVfxSchema.describe("Optional VFX overrides.").optional(),
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

const enemyStyleFxSchema = z
  .object({
    charge: z
      .object({
        inwardCountMinMax: z
          .tuple([
            z.number().describe("Minimum inward particle count."),
            z.number().describe("Maximum inward particle count."),
          ])
          .describe("Charge inward particle count range.")
          .optional(),
        ringIntervalMs: z
          .number()
          .describe("Base ring cadence while charging (ms).")
          .optional(),
        ringRadiusScale: z
          .number()
          .describe("Scale factor for charge ring radius.")
          .optional(),
      })
      .describe("Charging telegraph visuals.")
      .optional(),
    death: z
      .object({
        burstCount: z
          .number()
          .describe("Primary death burst count.")
          .optional(),
        ringRadiusScale: z
          .number()
          .describe("Scale factor for death ring radius.")
          .optional(),
        secondaryBurstCount: z
          .number()
          .describe("Secondary death burst count.")
          .optional(),
      })
      .describe("Death burst visuals.")
      .optional(),
  })
  .describe("Enemy VFX overrides.")
  .optional();

const enemyStyleSchema = z.object({
  fillColor: colorField("Fill color for the shape.").default("#1c0f1a"),
  fx: enemyStyleFxSchema,
  lineColor: colorField("Outline color for the shape.").default("#ff6b6b"),
  vector: vectorShapeSchema.describe("Enemy vector silhouette."),
});

const enemyStyleOverrideSchema = z.object({
  fillColor: colorField("Fill color for the shape.").default("#1c0f1a"),
  fx: enemyStyleFxSchema,
  lineColor: colorField("Outline color for the shape.").default("#ff6b6b"),
  vector: vectorShapeSchema.describe("Enemy vector silhouette.").optional(),
});

const enemyHitboxSchema = z.union([
  z.object({
    kind: z.literal("circle").describe("Circular hit area."),
    radius: z.number().positive().describe("Circle radius in pixels."),
  }),
  z.object({
    kind: z.literal("ellipse").describe("Axis-aligned ellipse hit area."),
    radiusX: z.number().positive().describe("Horizontal ellipse radius."),
    radiusY: z.number().positive().describe("Vertical ellipse radius."),
  }),
]);

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
  hitbox: enemyHitboxSchema.describe("Collision hit area."),
  hp: z.number().describe("Total hit points."),
  id: idField("Unique enemy id."),
  move: moveScriptSchema.describe("Base move script."),
  phases: z.array(bossPhaseSchema).describe("Optional boss phases.").optional(),
  radius: z.number().describe("Visual size radius in pixels."),
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
  hitbox: enemyHitboxSchema.describe("Override collision hit area.").optional(),
  hp: z.number().describe("Override hit points.").optional(),
  move: moveScriptSchema.describe("Override move script.").optional(),
  phases: z.array(bossPhaseSchema).describe("Override boss phases.").optional(),
  radius: z.number().describe("Override visual size radius.").optional(),
  rotation: z
    .enum(["fixed", "movement"])
    .describe("Override rotation mode.")
    .optional(),
  rotationDeg: z.number().describe("Override rotation angle.").optional(),
  style: enemyStyleOverrideSchema.describe("Override styling.").optional(),
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
  allowedMods: idArray(
    "Restrict to these mod ids (omit to allow all).",
  ).optional(),
  allowedShips: idArray(
    "Restrict to these ship ids (omit to allow all).",
  ).optional(),
  allowedWeapons: idArray(
    "Restrict to these weapon ids (omit to allow all).",
  ).optional(),
  caps: z
    .object({
      modCost: z
        .number()
        .min(0)
        .describe("Max cost allowed for mods.")
        .optional(),
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

const rewardBundleSchema = z.object({
  resources: z
    .record(idSchema, z.number())
    .describe("Resource deltas awarded when completed.")
    .default({})
    .optional(),
  unlocks: idArray("Unlock ids granted when completed.").default([]).optional(),
});

const objectiveRuleSchema = z.union([
  z.object({
    id: idField("Objective id unique within the set."),
    kind: z.literal("completeLevel").describe("Clear the level."),
    label: z.string().describe("Player-facing objective label."),
    reward: rewardBundleSchema
      .describe("Optional objective rewards.")
      .optional(),
    stars: z.number().int().min(1).max(3).describe("Stars awarded."),
  }),
  z.object({
    id: idField("Objective id unique within the set."),
    kind: z
      .literal("clearAllEnemies")
      .describe("Defeat every enemy spawned in the level."),
    label: z.string().describe("Player-facing objective label."),
    reward: rewardBundleSchema
      .describe("Optional objective rewards.")
      .optional(),
    stars: z.number().int().min(1).max(3).describe("Stars awarded."),
  }),
  z.object({
    id: idField("Objective id unique within the set."),
    kind: z.literal("finishUnderMs").describe("Finish within a time limit."),
    label: z.string().describe("Player-facing objective label."),
    maxMs: z.number().positive().describe("Max clear time in ms."),
    reward: rewardBundleSchema
      .describe("Optional objective rewards.")
      .optional(),
    stars: z.number().int().min(1).max(3).describe("Stars awarded."),
  }),
  z.object({
    id: idField("Objective id unique within the set."),
    kind: z
      .literal("takeDamageUnder")
      .describe("Take no more than this much total damage."),
    label: z.string().describe("Player-facing objective label."),
    maxDamage: z.number().min(0).describe("Maximum damage taken."),
    reward: rewardBundleSchema
      .describe("Optional objective rewards.")
      .optional(),
    stars: z.number().int().min(1).max(3).describe("Stars awarded."),
  }),
  z.object({
    id: idField("Objective id unique within the set."),
    kind: z
      .literal("finishWithHpRatio")
      .describe("Finish at or above this remaining HP ratio."),
    label: z.string().describe("Player-facing objective label."),
    minRatio: z
      .number()
      .min(0)
      .max(1)
      .describe("Minimum ending HP ratio (0..1)."),
    reward: rewardBundleSchema
      .describe("Optional objective rewards.")
      .optional(),
    stars: z.number().int().min(1).max(3).describe("Stars awarded."),
  }),
]);

const objectiveSetSchema = z.object({
  id: idField("Unique objective set id."),
  objectives: z
    .array(objectiveRuleSchema)
    .min(1)
    .describe("Objectives evaluated when the level is cleared."),
});

const levelSchema = z.object({
  endCondition: winConditionSchema
    .describe("Optional override that ends the level early.")
    .optional(),
  hazardIds: idArray("Hazards to spawn at level start.").default([]),
  id: idField("Unique level id."),
  objectiveSetId: idField(
    "Objective set to evaluate on level clear.",
  ).optional(),
  postBeatId: idField("Beat id shown after victory.").optional(),
  preBeatId: idField("Beat id shown before the shop.").optional(),
  pressureProfile: pressureProfileSchema.describe("Intended pressure mix."),
  shopId: idField("Shop rules to apply before play.").optional(),
  title: z.string().describe("Level title shown in UI."),
  waveIds: idArray("Ordered list of wave ids to run."),
  winCondition: winConditionSchema.describe("Primary victory condition."),
});

const galaxyNodePositionSchema = z.object({
  x: z.number().min(0).max(1).describe("Normalized map X (0..1)."),
  y: z.number().min(0).max(1).describe("Normalized map Y (0..1)."),
});

const galaxyNodeSchema = z.object({
  id: idField("Unique node id within this galaxy."),
  levelId: idField("Level id launched by this node."),
  name: z.string().describe("Optional display label override.").optional(),
  pos: galaxyNodePositionSchema,
});

const galaxyEdgeSchema = z.object({
  from: idField("Source node id."),
  to: idField("Destination node id."),
});

const galaxyDecorationSchema = z.object({
  id: idField("Optional decoration id.").optional(),
  kind: z
    .enum(["asteroidField", "nebula", "planet"])
    .describe("Decoration type."),
  label: z.string().describe("Optional map label.").optional(),
  pos: galaxyNodePositionSchema.describe("Decoration anchor position."),
  scale: z.number().positive().describe("Decoration scale factor.").optional(),
  tint: colorField("Optional tint for this decoration.").optional(),
});

const galaxySchema = z
  .object({
    decorations: z
      .array(galaxyDecorationSchema)
      .describe("Background map decorations.")
      .default([])
      .optional(),
    description: z
      .string()
      .describe("Optional campaign summary shown in the map UI.")
      .optional(),
    edges: z.array(galaxyEdgeSchema).describe("Directed connections."),
    id: idField("Unique galaxy id."),
    name: z.string().describe("Display name."),
    nodes: z.array(galaxyNodeSchema).min(1).describe("Playable map nodes."),
    startNodeId: idField("Node id where campaign progression starts."),
  })
  .superRefine((galaxy, ctx) => {
    const nodeIds = new Set<string>();
    const levelIds = new Set<string>();
    for (let i = 0; i < galaxy.nodes.length; i += 1) {
      const node = galaxy.nodes[i];
      if (nodeIds.has(node.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate node id "${node.id}".`,
          path: ["nodes", i, "id"],
        });
      }
      nodeIds.add(node.id);
      if (levelIds.has(node.levelId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate levelId "${node.levelId}" in galaxy nodes.`,
          path: ["nodes", i, "levelId"],
        });
      }
      levelIds.add(node.levelId);
    }

    if (!nodeIds.has(galaxy.startNodeId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `startNodeId "${galaxy.startNodeId}" is not defined in nodes.`,
        path: ["startNodeId"],
      });
    }

    for (let i = 0; i < galaxy.edges.length; i += 1) {
      const edge = galaxy.edges[i];
      if (!nodeIds.has(edge.from)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown edge source "${edge.from}".`,
          path: ["edges", i, "from"],
        });
      }
      if (!nodeIds.has(edge.to)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown edge destination "${edge.to}".`,
          path: ["edges", i, "to"],
        });
      }
    }

    if (nodeIds.has(galaxy.startNodeId)) {
      const outgoing = new Map<string, string[]>();
      for (const edge of galaxy.edges) {
        const list = outgoing.get(edge.from) ?? [];
        list.push(edge.to);
        outgoing.set(edge.from, list);
      }
      const seen = new Set<string>([galaxy.startNodeId]);
      const queue = [galaxy.startNodeId];
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) break;
        for (const to of outgoing.get(next) ?? []) {
          if (seen.has(to)) continue;
          seen.add(to);
          queue.push(to);
        }
      }
      galaxy.nodes.forEach((node, index) => {
        if (seen.has(node.id)) return;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Node "${node.id}" is unreachable from startNodeId.`,
          path: ["nodes", index, "id"],
        });
      });
    }
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

const modSchema = z.object({
  cost: z.number().min(0).describe("Shop cost."),
  costResource: idField("Resource id used to buy this mod.")
    .default("gold")
    .optional(),
  description: z.string().describe("Player-facing description."),
  effects: z
    .object({
      aoe: z
        .object({
          damageMultiplier: z
            .number()
            .describe("AoE damage multiplier.")
            .optional(),
          defaultDamageFactor: z
            .number()
            .describe("Default AoE damage factor when weapon has no AoE.")
            .optional(),
          defaultRadius: z
            .number()
            .describe("Default AoE radius when weapon has no AoE.")
            .optional(),
          radiusAdd: z.number().describe("AoE radius add.").optional(),
          radiusMultiplier: z
            .number()
            .describe("AoE radius multiplier.")
            .optional(),
        })
        .describe("AoE modifier settings.")
        .optional(),
      bounce: z
        .object({
          damageRetention: z.number().describe("Damage retained after bounce."),
          maxBounces: z.number().int().min(1).describe("Max bounces."),
          sameTargetCooldownMs: z
            .number()
            .min(0)
            .describe("Cooldown before re-hitting same target."),
          speedRetention: z.number().describe("Speed retained after bounce."),
        })
        .describe("Ricochet settings.")
        .optional(),
      damageMultiplier: z
        .number()
        .describe("Global projectile damage multiplier.")
        .optional(),
      homing: bulletHomingSchema
        .describe("Homing modifier settings.")
        .optional(),
      multi: z
        .object({
          count: z
            .literal(3)
            .describe("Number of shots to emit per base shot."),
          projectileDamageMultiplier: z
            .number()
            .describe("Per-projectile damage multiplier."),
          spreadDeg: z.number().describe("Spread angle in degrees."),
        })
        .describe("Spread modifier settings.")
        .optional(),
    })
    .describe("Stat effects applied to mounted weapon."),
  icon: vectorShapeSchema.describe("Vector icon geometry for this mod."),
  iconKind: modIconKindSchema.describe(
    "Icon category used for uniqueness and accent color.",
  ),
  id: idField("Unique mod id."),
  name: z.string().describe("Display name."),
  requiresUnlocks: idArray("Unlock ids required before this can be purchased.")
    .default([])
    .optional(),
});

const shipVectorSchema = vectorShapeSchema.describe("Ship vector silhouette.");

const weaponSchema = z.object({
  cost: z.number().min(0).describe("Shop cost."),
  costResource: idField("Resource id used to buy this weapon.")
    .default("gold")
    .optional(),
  description: z.string().describe("Player-facing description."),
  gunId: idField("Gun model id used for icon + mount render."),
  id: idField("Unique weapon id."),
  name: z.string().describe("Display name."),
  requiresUnlocks: idArray("Unlock ids required before this can be purchased.")
    .default([])
    .optional(),
  size: weaponSizeSchema.describe("Mount size required."),
  stats: weaponStatsSchema.describe("Base weapon stats."),
});

const shipSchema = z
  .object({
    color: colorField("Ship fill color."),
    cost: z.number().min(0).describe("Unlock cost."),
    costResource: idField("Resource id used to buy this ship.")
      .default("gold")
      .optional(),
    description: z.string().describe("Player-facing description."),
    hitbox: enemyHitboxSchema
      .describe("Collision hit area (circle or ellipse).")
      .optional(),
    id: idField("Unique ship id."),
    magnetMultiplier: z.number().describe("Pickup magnet multiplier."),
    maxHp: z.number().describe("Max HP."),
    mounts: z
      .array(
        z.object({
          id: idField("Unique mount id within this ship."),
          modSlots: z
            .int()
            .min(0)
            .max(2)
            .optional()
            .default(0)
            .describe("Number of mod sockets on this mount (max 2)."),
          offset: z
            .object({
              x: z.number().describe("Mount X offset in ship-radius units."),
              y: z.number().describe("Mount Y offset in ship-radius units."),
            })
            .describe("Offset from ship center."),
          size: weaponSizeSchema.describe("Mount size."),
        }),
      )
      .max(3, "Ships can define at most 3 weapon mounts.")
      .describe("Weapon mounts for this ship (max 3)."),
    moveSpeed: z.number().describe("Movement speed scalar."),
    name: z.string().describe("Display name."),
    radiusMultiplier: z.number().describe("Collision radius multiplier."),
    requiresUnlocks: idArray(
      "Unlock ids required before this can be purchased.",
    )
      .default([])
      .optional(),
    vector: shipVectorSchema.describe("Required ship vector silhouette."),
  })
  .superRefine((ship, ctx) => {
    const seen = new Set<string>();
    ship.mounts.forEach((mount, index) => {
      if (seen.has(mount.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate mount id "${mount.id}". Mount ids must be unique per ship.`,
          path: ["mounts", index, "id"],
        });
        return;
      }
      seen.add(mount.id);
    });
  });

export const contentSchemas = {
  beats: beatSchema,
  bullets: bulletSchema,
  enemies: enemySchema,
  galaxies: galaxySchema,
  guns: gunSchema,
  hazards: laneWallSchema,
  levels: levelSchema,
  mods: modSchema,
  objectives: objectiveSetSchema,
  ships: shipSchema,
  shops: shopSchema,
  waves: waveSchema,
  weapons: weaponSchema,
} satisfies Record<ContentKind, z.ZodSchema>;

export type BeatContent = z.infer<typeof beatSchema>;
export type BulletContent = z.infer<typeof bulletSchema>;
export type EnemyContent = z.infer<typeof enemySchema>;
export type GalaxyContent = z.infer<typeof galaxySchema>;
export type GunContent = z.infer<typeof gunSchema>;
export type HazardContent = z.infer<typeof laneWallSchema>;
export type ModContent = z.infer<typeof modSchema>;
export type ObjectiveContent = z.infer<typeof objectiveSetSchema>;
export type LevelContent = z.infer<typeof levelSchema>;
export type ShipContent = z.infer<typeof shipSchema>;
export type ShopContent = z.infer<typeof shopSchema>;
export type WaveContent = z.infer<typeof waveSchema>;
export type WeaponContent = z.infer<typeof weaponSchema>;
