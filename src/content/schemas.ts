import { z } from "zod";

export const CONTENT_KINDS = [
  "characters",
  "bullets",
  "enemies",
  "galaxies",
  "guns",
  "hazards",
  "mods",
  "objectives",
  "levels",
  "sounds",
  "tutorials",
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

const vectorPaintSchema = colorSchema.describe("Hex color for this paint.");

const vectorPathItemSchema = z.object({
  c: z
    .array(vectorPathCommandSchema)
    .describe("Path commands using M/L/Q/C/Z commands."),
  f: vectorPaintSchema
    .describe("Fill color for this primitive. Omit for no fill.")
    .optional(),
  s: vectorPaintSchema
    .describe("Stroke color for this primitive. Omit for no stroke.")
    .optional(),
  t: z.literal("p").describe("Path primitive."),
  w: z
    .number()
    .positive()
    .describe("Optional stroke width override.")
    .optional(),
});

const vectorCircleItemSchema = z.object({
  f: vectorPaintSchema
    .describe("Fill color for this primitive. Omit for no fill.")
    .optional(),
  r: z.number().positive().describe("Radius."),
  s: vectorPaintSchema
    .describe("Stroke color for this primitive. Omit for no stroke.")
    .optional(),
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
  f: vectorPaintSchema
    .describe("Fill color for this primitive. Omit for no fill.")
    .optional(),
  rx: z.number().positive().describe("Radius X."),
  ry: z.number().positive().describe("Radius Y."),
  s: vectorPaintSchema
    .describe("Stroke color for this primitive. Omit for no stroke.")
    .optional(),
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
  id: idField("Unique gun id."),
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

const panSchema = z
  .union([
    z.number().min(-1).max(1).describe("Stereo pan (-1..1)."),
    z
      .object({
        max: z.number().min(-1).max(1),
        min: z.number().min(-1).max(1),
      })
      .describe("Random pan range per play."),
  ])
  .optional();

const randomizeSchema = z
  .object({
    bandpassHz: z.number().min(0).max(2).optional(),
    endHz: z.number().min(0).max(2).optional(),
    gain: z
      .number()
      .min(0)
      .max(2)
      .optional()
      .describe("± multiplier amount (e.g. 0.12 => ±12%)."),
    highpassHz: z.number().min(0).max(2).optional(),
    lowpassHz: z.number().min(0).max(2).optional(),
    releaseMs: z.number().min(0).max(2).optional(),
    startHz: z.number().min(0).max(2).optional(),
  })
  .describe("Per-play randomization multipliers (all optional).")
  .optional();

const fxSchema = z
  .discriminatedUnion("type", [
    z.object({
      attackMs: z.number().min(0).optional(),
      kneeDb: z.number().min(0).optional(),
      makeupGain: z.number().min(0).optional(),
      ratio: z.number().min(1).optional(),
      releaseMs: z.number().min(0).optional(),
      thresholdDb: z.number().optional(),
      type: z.literal("compressor"),
    }),
    z.object({
      drive: z.number().min(0).max(2).optional(),
      mix: z.number().min(0).max(1).optional(),
      type: z.literal("waveshaper"),
    }),
    z.object({
      feedback: z.number().min(0).max(0.98).optional(),
      highpassHz: z.number().positive().optional(),
      lowpassHz: z.number().positive().optional(),
      mix: z.number().min(0).max(1).optional(),
      timeMs: z.number().min(0).max(1000).optional(),
      type: z.literal("delay"),
    }),
    z.object({
      damping: z.number().min(0).max(1).optional(),
      highpassHz: z.number().positive().optional(),
      lowpassHz: z.number().positive().optional(),
      mix: z.number().min(0).max(1).optional(),
      roomMs: z.number().min(30).max(2000).optional(),
      type: z.literal("reverb"),
    }),
    z.object({
      hz: z.number().positive(),
      q: z.number().positive().optional(),
      type: z.literal("lowpass"),
    }),
    z.object({
      hz: z.number().positive(),
      q: z.number().positive().optional(),
      type: z.literal("highpass"),
    }),
    z.object({
      hz: z.number().positive(),
      q: z.number().positive().optional(),
      type: z.literal("bandpass"),
    }),
  ])
  .describe("Optional effect to apply (layer-level or sound-level).");

const fxListSchema = z.array(fxSchema).max(8).optional();

const proceduralToneSoundLayerSchema = z.object({
  attackMs: z
    .number()
    .min(0)
    .describe("Attack envelope duration in milliseconds.")
    .default(2),
  effects: fxListSchema,
  endHz: z
    .number()
    .positive()
    .describe("End frequency for sweep. Defaults to startHz.")
    .optional(),
  gain: z
    .number()
    .min(0)
    .max(1)
    .describe("Layer gain scalar (0..1).")
    .default(0.1),
  holdMs: z
    .number()
    .min(0)
    .describe("Sustain duration in milliseconds.")
    .default(46),
  pan: panSchema,
  pitchCurve: z
    .enum(["linear", "expFast"])
    .describe("Sweep curve shaping.")
    .default("linear")
    .optional(),
  randomize: randomizeSchema,
  releaseMs: z
    .number()
    .min(0)
    .describe("Release envelope duration in milliseconds.")
    .default(64),

  startHz: z.number().positive().describe("Start frequency in Hertz."),
  startOffsetMs: z
    .number()
    .min(0)
    .describe("Delay before this layer starts, in milliseconds.")
    .default(0)
    .optional(),
  type: z.literal("tone").describe("Tonal oscillator layer."),
  wave: z
    .enum(["sawtooth", "sine", "square", "triangle"])
    .describe("Oscillator waveform.")
    .default("sine"),
});

const proceduralNoiseSoundLayerSchema = z.object({
  attackMs: z
    .number()
    .min(0)
    .describe("Attack envelope duration in milliseconds.")
    .default(2),
  bandpassHz: z
    .number()
    .positive()
    .describe("Optional band-pass center frequency in Hertz.")
    .optional(),
  bandpassQ: z
    .number()
    .positive()
    .describe("Band-pass Q (resonance).")
    .default(1)
    .optional(),
  effects: fxListSchema,
  gain: z
    .number()
    .min(0)
    .max(1)
    .describe("Layer gain scalar (0..1).")
    .default(0.08),
  highpassHz: z
    .number()
    .positive()
    .describe("Optional high-pass cutoff in Hertz.")
    .optional(),
  holdMs: z
    .number()
    .min(0)
    .describe("Sustain duration in milliseconds.")
    .default(24),
  lowpassHz: z
    .number()
    .positive()
    .describe("Optional low-pass cutoff in Hertz.")
    .optional(),

  pan: panSchema,
  randomize: randomizeSchema,
  releaseMs: z
    .number()
    .min(0)
    .describe("Release envelope duration in milliseconds.")
    .default(54),
  startOffsetMs: z
    .number()
    .min(0)
    .describe("Delay before this layer starts, in milliseconds.")
    .default(0)
    .optional(),
  type: z.literal("noise").describe("Noise layer."),
});

const proceduralEventGroupSoundLayerSchema = z.object({
  count: z.number().int().min(1).max(64).describe("Number of events to spawn."),
  event: z
    .union([proceduralToneSoundLayerSchema, proceduralNoiseSoundLayerSchema])
    .describe("Layer template for each event."),
  jitterMs: z
    .number()
    .min(0)
    .max(2000)
    .describe("Random jitter (+/-) applied per event in ms.")
    .default(0)
    .optional(),
  spacingMs: z
    .number()
    .min(1)
    .max(2000)
    .describe("Base spacing between events in ms."),
  startOffsetMs: z
    .number()
    .min(0)
    .describe("Delay before the group starts, in milliseconds.")
    .default(0)
    .optional(),
  type: z
    .literal("eventGroup")
    .describe("Repeated sub-events (e.g. debris ticks)."),
});

const proceduralSoundLayerSchema = z.union([
  proceduralToneSoundLayerSchema,
  proceduralNoiseSoundLayerSchema,
  proceduralEventGroupSoundLayerSchema,
]);

const proceduralSoundCategorySchema = z.enum([
  "enemy",
  "impact",
  "system",
  "ui",
  "weapon",
]);

export const proceduralSoundSchema = z.object({
  category: proceduralSoundCategorySchema
    .describe("Category used to group sounds in editor/runtime.")
    .default("weapon"),
  description: z
    .string()
    .describe("Optional notes about usage and intent.")
    .optional(),
  effects: fxListSchema,
  gain: z
    .number()
    .min(0)
    .max(1)
    .describe("Master gain scalar for the whole sound.")
    .default(0.2),
  id: idField("Unique sound id."),
  layers: z
    .array(proceduralSoundLayerSchema)
    .min(1)
    .max(12)
    .describe("Ordered synthesis layers."),

  name: z.string().describe("Display name in editor.").optional(),
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
  color: colorField("Enemy accent color, for effects and explosions."),
  fx: enemyStyleFxSchema,
  vector: vectorShapeSchema.describe("Enemy vector silhouette."),
});

const enemyStyleOverrideSchema = z.object({
  color: colorField("Override primary color.").optional(),
  fx: enemyStyleFxSchema,
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

const characterExpressionSchema = z.object({
  expression: idField("Expression key, such as neutral, focused, or angry."),
  image: z.string().min(1).describe("Avatar image path or URL."),
});

const characterSchema = z
  .object({
    avatars: z
      .array(characterExpressionSchema)
      .min(1)
      .describe("Available avatar images grouped by expression."),
    defaultExpression: idField("Default expression key when none is specified.")
      .optional()
      .default("neutral"),
    id: idField("Unique character id."),
    name: z.string().describe("Display name."),
  })
  .superRefine((character, ctx) => {
    const seen = new Set<string>();
    character.avatars.forEach((avatar, index) => {
      if (seen.has(avatar.expression)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate expression "${avatar.expression}".`,
          path: ["avatars", index, "expression"],
        });
        return;
      }
      seen.add(avatar.expression);
    });
    if (
      character.defaultExpression &&
      !character.avatars.some(
        (avatar) => avatar.expression === character.defaultExpression,
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `defaultExpression "${character.defaultExpression}" is not defined in avatars.`,
        path: ["defaultExpression"],
      });
    }
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

const winConditionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z
      .literal("clearWaves")
      .describe("Win when all scripted level events finish."),
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

const levelConversationMomentSchema = z.object({
  characterId: idField("Optional speaking character id.").optional(),
  durationMs: z
    .number()
    .positive()
    .describe("Optional override for message duration in ms.")
    .optional(),
  expression: idField("Optional character expression id.").optional(),
  placement: z
    .enum(["bottom", "top", "center"])
    .describe("Dialog placement.")
    .optional(),
  text: z.string().min(1).describe("Dialog line."),
  transition: z
    .enum(["smooth", "urgent", "wham"])
    .describe("Dialog transition style.")
    .optional(),
});

const uiTutorialConditionSchema = z.object({
  maxTimes: z
    .number()
    .int()
    .positive()
    .describe("Show no more than N times.")
    .optional(),
});

const uiTutorialRouteSchema = z.enum([
  "gameover",
  "hangar",
  "menu",
  "pause",
  "play",
  "progression",
  "startup",
]);

const uiRouteTutorialSchema = z.object({
  id: idField("Unique tutorial trigger id."),
  moments: z
    .array(levelConversationMomentSchema)
    .min(1)
    .describe("Ordered dialog moments."),
  route: uiTutorialRouteSchema
    .describe("UI route that triggers this tutorial.")
    .optional(),
  when: uiTutorialConditionSchema
    .describe("Optional conditions for showing this tutorial.")
    .optional(),
});

const levelEventConditionSchema = z.object({
  firstClearOnly: z
    .boolean()
    .describe("Only matches on first clear attempt.")
    .optional(),
  hpRatioGte: z
    .number()
    .min(0)
    .max(1)
    .describe("Require current HP ratio >= this value.")
    .optional(),
  hpRatioLte: z
    .number()
    .min(0)
    .max(1)
    .describe("Require current HP ratio <= this value.")
    .optional(),
  maxHpGte: z
    .number()
    .positive()
    .describe("Require max HP >= this value.")
    .optional(),
  maxHpLte: z
    .number()
    .positive()
    .describe("Require max HP <= this value.")
    .optional(),
  maxTimes: z
    .number()
    .int()
    .positive()
    .describe("Match this option no more than N total selections.")
    .optional(),
  repeatOnly: z.boolean().describe("Only matches on repeat clears.").optional(),
});

const levelEventActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("wave").describe("Run a wave."),
    waveId: idField("Wave id to run."),
  }),
  z.object({
    kind: z.literal("conversation").describe("Run a conversation sequence."),
    moments: z
      .array(levelConversationMomentSchema)
      .min(1)
      .describe("Ordered dialog moments."),
  }),
]);

const levelEventBranchOptionSchema = z.object({
  event: levelEventActionSchema.describe(
    "Event to run if this option matches.",
  ),
  when: levelEventConditionSchema
    .describe("Optional conditions for this option.")
    .optional(),
});

const levelEventBranchSchema = z.object({
  kind: z.literal("branch").describe("Pick the first matching branch option."),
  options: z
    .array(levelEventBranchOptionSchema)
    .min(1)
    .describe("Ordered branch options."),
});

const levelEventShorthandSchema = z
  .array(levelEventBranchOptionSchema)
  .min(1)
  .describe("Shorthand for branch options.");

const levelEventSchema = z.union([
  levelEventActionSchema,
  levelEventBranchSchema,
  levelEventShorthandSchema,
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
  events: z
    .array(levelEventSchema)
    .min(1)
    .describe("Ordered level events (combat and story)."),
  hazardIds: idArray("Hazards to spawn at level start.").default([]),
  id: idField("Unique level id."),
  objectiveSetId: idField(
    "Objective set to evaluate on level clear.",
  ).optional(),
  pressureProfile: pressureProfileSchema.describe("Intended pressure mix."),
  shopId: idField("Shop rules to apply before play.").optional(),
  title: z.string().describe("Level title shown in UI."),
  winCondition: winConditionSchema.describe("Primary victory condition."),
});

const galaxyMapPositionSchema = z.object({
  x: z.number().min(0).max(1).describe("Normalized map X (0..1)."),
  y: z.number().min(0).max(1).describe("Normalized map Y (0..1)."),
});

const galaxyDecorationSchema = z.object({
  id: idField("Optional decoration id.").optional(),
  kind: z
    .enum(["asteroidField", "nebula", "planet"])
    .describe("Decoration type."),
  label: z.string().describe("Optional map label.").optional(),
  pos: galaxyMapPositionSchema.describe("Decoration anchor position."),
  scale: z.number().positive().describe("Decoration scale factor.").optional(),
  tint: colorField("Optional tint for this decoration.").optional(),
});

const galaxyLevelSchema = z.object({
  levelId: idField("Level id launched by this node."),
  name: z.string().describe("Optional display label override.").optional(),
  pos: galaxyMapPositionSchema.describe("Node position in the campaign map."),
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
    id: idField("Unique galaxy id."),
    levels: z
      .array(galaxyLevelSchema)
      .min(1)
      .describe("Ordered campaign levels."),
    name: z.string().describe("Display name."),
  })
  .superRefine((galaxy, ctx) => {
    const levelIds = new Set<string>();
    for (let i = 0; i < galaxy.levels.length; i += 1) {
      const levelId = galaxy.levels[i].levelId;
      if (levelIds.has(levelId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate level id "${levelId}" in galaxy levels.`,
          path: ["levels", i, "levelId"],
        });
        continue;
      }
      levelIds.add(levelId);
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
            .number()
            .gte(2)
            .lte(4)
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
    color: colorField("Ship accent color, for effects and explosions."),
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
  bullets: bulletSchema,
  characters: characterSchema,
  enemies: enemySchema,
  galaxies: galaxySchema,
  guns: gunSchema,
  hazards: laneWallSchema,
  levels: levelSchema,
  mods: modSchema,
  objectives: objectiveSetSchema,
  ships: shipSchema,
  shops: shopSchema,
  sounds: proceduralSoundSchema,
  tutorials: uiRouteTutorialSchema,
  waves: waveSchema,
  weapons: weaponSchema,
} satisfies Record<ContentKind, z.ZodSchema>;

export type CharacterContent = z.infer<typeof characterSchema>;
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
export type SoundContent = z.infer<typeof proceduralSoundSchema>;
export type TutorialContent = z.infer<typeof uiRouteTutorialSchema>;
export type WaveContent = z.infer<typeof waveSchema>;
export type WeaponContent = z.infer<typeof weaponSchema>;
