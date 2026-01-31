import type { EnemyDef } from "../game/data/enemyTypes";
import type { GunDefinition } from "../game/data/gunTypes";
import type {
  HazardScript,
  LevelDefinition,
  ShopRules,
} from "../game/data/levels/types";
import type {
  BulletAoe,
  BulletHoming,
  BulletSpec,
  FireScript,
  FireStep,
} from "../game/data/scripts";
import type { ShipDefinition } from "../game/data/shipTypes";
import type { StoryBeat } from "../game/data/storyBeatTypes";
import type { WaveDefinition } from "../game/data/waves";
import type {
  WeaponDefinition,
  WeaponShot,
  WeaponStats,
  WeaponZone,
} from "../game/data/weaponTypes";
import type {
  BeatContent,
  ContentKind,
  EnemyContent,
  GunContent,
  HazardContent,
  LevelContent,
  ShipContent,
  ShopContent,
  WaveContent,
  WeaponContent,
} from "./schemas";

import { DEFAULT_WEAPON_SHOTS } from "../game/data/weaponTypes";
import { contentSchemas } from "./schemas";

export type ContentErrorKind = "duplicate" | "parse" | "reference" | "schema";

export interface ContentError {
  kind: ContentErrorKind;
  message: string;
  path: string;
}

export interface ContentEntry {
  data: unknown;
  kind: ContentKind;
  path: string;
}

export interface ContentRegistry {
  beatsById: Record<string, StoryBeat>;
  enemiesById: Record<string, EnemyDef>;
  gunsById: Record<string, GunDefinition>;
  hazardsById: Record<string, HazardScript>;
  levelsById: Record<string, LevelDefinition>;
  shipsById: Record<string, ShipDefinition>;
  shopsById: Record<string, ShopRules>;
  wavesById: Record<string, WaveDefinition>;
  weaponsById: Record<string, WeaponDefinition>;
}

export interface ContentBuildResult {
  errors: ContentError[];
  registry: ContentRegistry;
}

const parseColor = (value: number | string | undefined): number | undefined => {
  if (typeof value === "number") return value;
  return undefined;
};

const resolveColor = (
  value: number | string | undefined,
): number | undefined => {
  if (typeof value === "undefined") return undefined;
  return parseColor(value);
};

type BulletTrailInput = Omit<NonNullable<BulletSpec["trail"]>, "color"> & {
  color?: number;
};

interface BulletVisualsInput {
  aoe?: BulletAoe;
  color?: number;
  homing?: BulletHoming;
  kind: BulletSpec["kind"];
  length?: number;
  lifetimeMs?: number;
  radius: number;
  thickness?: number;
  trail?: BulletTrailInput;
}

type BulletEffectsInput = Partial<
  Pick<BulletSpec, "aoe" | "homing" | "lifetimeMs" | "speed">
>;

const coerceBulletSpec = (
  visuals: BulletVisualsInput,
  damage: number,
  effects?: BulletEffectsInput,
): BulletSpec => {
  const rawColor = (visuals as { color?: number | string }).color;
  const trail = visuals.trail
    ? {
        ...visuals.trail,
        color:
          resolveColor((visuals.trail as { color?: number | string }).color) ??
          0xffffff,
      }
    : undefined;
  return {
    aoe: effects?.aoe ?? visuals.aoe,
    color: resolveColor(rawColor),
    damage,
    homing: effects?.homing ?? visuals.homing,
    kind: visuals.kind,
    length: visuals.length,
    lifetimeMs: effects?.lifetimeMs ?? visuals.lifetimeMs,
    radius: visuals.radius,
    speed: effects?.speed ?? 0,
    thickness: visuals.thickness,
    trail,
  };
};

type FireStepInput = FireStep & {
  aoe?: BulletAoe;
  damage?: number;
  homing?: BulletHoming;
  lifetimeMs?: number;
  speed?: number;
};

type FireScriptInput = Omit<FireScript, "steps"> & { steps: FireStepInput[] };

const coerceFireStep = (step: FireStepInput): FireStep => {
  if ("bullet" in step) {
    const { aoe, damage, homing, lifetimeMs, speed, ...rest } = step;
    const bulletDamage = damage ?? step.bullet.damage ?? 1;
    return {
      ...rest,
      bullet: coerceBulletSpec(step.bullet, bulletDamage, {
        aoe,
        homing,
        lifetimeMs,
        speed,
      }),
    };
  }
  return step;
};

const coerceFireScript = (script: FireScriptInput): FireScript => ({
  ...script,
  steps: script.steps.map((step) => coerceFireStep(step)),
});

const addDuplicateError = (
  errors: ContentError[],
  path: string,
  kind: ContentKind,
  id: string,
): void => {
  errors.push({
    kind: "duplicate",
    message: `Duplicate ${kind} id "${id}".`,
    path,
  });
};

const addSchemaError = (
  errors: ContentError[],
  path: string,
  message: string,
): void => {
  errors.push({
    kind: "schema",
    message,
    path,
  });
};

const addReferenceError = (
  errors: ContentError[],
  path: string,
  message: string,
): void => {
  errors.push({
    kind: "reference",
    message,
    path,
  });
};

const coerceWinCondition = (
  condition: LevelContent["winCondition"],
): LevelDefinition["winCondition"] => {
  if (condition.kind === "defeatBoss") {
    return {
      bossId: condition.bossId,
      kind: "defeatBoss",
    };
  }
  return condition;
};

const coerceEndCondition = (
  condition: LevelContent["endCondition"] | undefined,
): LevelDefinition["endCondition"] | undefined => {
  if (!condition) return undefined;
  if (condition.kind === "defeatBoss") {
    return {
      bossId: condition.bossId,
      kind: "defeatBoss",
    };
  }
  return condition;
};

export const buildContentRegistry = (
  entries: ContentEntry[],
): ContentBuildResult => {
  const errors: ContentError[] = [];

  const beatsById: Record<string, StoryBeat> = {};
  const enemiesById: Record<string, EnemyContent> = {};
  const gunsById: Record<string, GunContent> = {};
  const hazardsById: Record<string, HazardContent> = {};
  const levelsById: Record<string, LevelContent> = {};
  const shipsById: Record<string, ShipContent> = {};
  const shopsById: Record<string, ShopContent> = {};
  const wavesById: Record<string, WaveContent> = {};
  const weaponsById: Record<string, WeaponContent> = {};

  for (const entry of entries) {
    const schema = contentSchemas[entry.kind];
    const result = schema.safeParse(entry.data);
    if (!result.success) {
      addSchemaError(
        errors,
        entry.path,
        result.error.issues
          .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
          .join("; "),
      );
      continue;
    }
    const value = result.data;
    const id = (value as { id: string }).id;
    switch (entry.kind) {
      case "beats":
        if (beatsById[id]) {
          addDuplicateError(errors, entry.path, entry.kind, id);
          break;
        }
        {
          const beat = value as BeatContent;
          beatsById[id] = {
            id: beat.id,
            lines: beat.lines,
            title: beat.title,
          };
        }
        break;
      case "enemies":
        if (enemiesById[id]) {
          addDuplicateError(errors, entry.path, entry.kind, id);
          break;
        }
        enemiesById[id] = value as EnemyContent;
        break;
      case "guns":
        if (gunsById[id]) {
          addDuplicateError(errors, entry.path, entry.kind, id);
          break;
        }
        gunsById[id] = value as GunContent;
        break;
      case "hazards":
        if (hazardsById[id]) {
          addDuplicateError(errors, entry.path, entry.kind, id);
          break;
        }
        hazardsById[id] = value as HazardContent;
        break;
      case "levels":
        if (levelsById[id]) {
          addDuplicateError(errors, entry.path, entry.kind, id);
          break;
        }
        levelsById[id] = value as LevelContent;
        break;
      case "ships":
        if (shipsById[id]) {
          addDuplicateError(errors, entry.path, entry.kind, id);
          break;
        }
        shipsById[id] = value as ShipContent;
        break;
      case "shops":
        if (shopsById[id]) {
          addDuplicateError(errors, entry.path, entry.kind, id);
          break;
        }
        shopsById[id] = value as ShopContent;
        break;
      case "waves":
        if (wavesById[id]) {
          addDuplicateError(errors, entry.path, entry.kind, id);
          break;
        }
        wavesById[id] = value as WaveContent;
        break;
      case "weapons":
        if (weaponsById[id]) {
          addDuplicateError(errors, entry.path, entry.kind, id);
          break;
        }
        weaponsById[id] = value as WeaponContent;
        break;
      default:
        break;
    }
  }

  const resolvedHazards: Record<string, HazardScript> = {};
  for (const [id, hazard] of Object.entries(hazardsById)) {
    resolvedHazards[id] = {
      damageOnTouch: hazard.damageOnTouch,
      fillColor: parseColor(hazard.fillColor),
      h: hazard.rect.h,
      lineColor: parseColor(hazard.lineColor),
      motion: hazard.motion,
      type: "laneWall",
      w: hazard.rect.w,
      x: hazard.rect.x,
      y: hazard.rect.y,
    };
  }

  const resolvedEnemies: Record<string, EnemyDef> = {};
  for (const [id, enemy] of Object.entries(enemiesById)) {
    resolvedEnemies[id] = {
      ...enemy,
      fire: coerceFireScript(enemy.fire as FireScriptInput),
      phases: enemy.phases?.map((phase) => ({
        ...phase,
        fire: phase.fire
          ? coerceFireScript(phase.fire as FireScriptInput)
          : undefined,
      })),
      style: enemy.style
        ? {
            ...enemy.style,
            fillColor: resolveColor(enemy.style.fillColor),
            lineColor: resolveColor(enemy.style.lineColor),
          }
        : undefined,
    };
  }

  const resolvedShips: Record<string, ShipDefinition> = {};
  for (const [id, ship] of Object.entries(shipsById)) {
    resolvedShips[id] = {
      ...ship,
      color: resolveColor(ship.color) ?? 0xffffff,
    };
  }

  const resolvedGuns: Record<string, GunDefinition> = {};
  for (const [id, gun] of Object.entries(gunsById)) {
    resolvedGuns[id] = {
      ...gun,
      fillColor: resolveColor(gun.fillColor),
      lineColor: resolveColor(gun.lineColor),
    };
  }

  const normalizeWeaponShots = (shots?: WeaponShot[]): WeaponShot[] => {
    const source = shots && shots.length > 0 ? shots : DEFAULT_WEAPON_SHOTS;
    return source.map((shot) => ({
      angleDeg: shot.angleDeg ?? 0,
      offset: shot.offset ?? { x: 0, y: 0 },
    }));
  };

  const resolveWeaponStats = (
    stats: Partial<WeaponStats> & { damage?: number },
  ): WeaponStats => {
    const legacyBullet = stats.bullet;
    const fallbackSpeed = stats.speed ?? legacyBullet?.speed ?? 0;
    const fallbackDamage = stats.damage ?? legacyBullet?.damage ?? 1;
    const homing = stats.homing ?? legacyBullet?.homing;
    const aoe = stats.aoe ?? legacyBullet?.aoe;
    const lifetimeMs = stats.lifetimeMs ?? legacyBullet?.lifetimeMs;
    const bullet = coerceBulletSpec(
      (stats.bullet ?? {
        kind: "orb",
        radius: 3,
      }) as unknown as BulletVisualsInput,
      fallbackDamage,
      {
        aoe,
        homing,
        lifetimeMs,
        speed: fallbackSpeed,
      },
    );
    return {
      angleDeg: stats.angleDeg ?? 0,
      aoe,
      bullet,
      fireRate: stats.fireRate ?? 1,
      homing,
      lifetimeMs,
      multiShotMode: stats.multiShotMode ?? "simultaneous",
      shots: normalizeWeaponShots(stats.shots),
      speed: fallbackSpeed,
    };
  };

  const resolvedWeapons: Record<string, WeaponDefinition> = {};
  for (const [id, weapon] of Object.entries(weaponsById)) {
    const zoneStats = weapon.zoneStats ?? {};
    const resolvedZoneStats: Partial<Record<WeaponZone, Partial<WeaponStats>>> =
      {};
    for (const [zone, override] of Object.entries(zoneStats)) {
      if (!override) continue;
      const { bullet, damage, shots, ...rest } =
        override as Partial<WeaponStats> & { damage?: number };
      const resolvedOverride: Partial<WeaponStats> = {
        ...rest,
        shots: shots ? normalizeWeaponShots(shots) : undefined,
      };
      if (bullet) {
        resolvedOverride.bullet = coerceBulletSpec(bullet, damage ?? 1);
      }
      resolvedZoneStats[zone as WeaponZone] = resolvedOverride;
    }
    resolvedWeapons[id] = {
      ...weapon,
      stats: resolveWeaponStats(
        weapon.stats as WeaponStats & { damage?: number },
      ),
      zoneStats: Object.keys(resolvedZoneStats).length
        ? resolvedZoneStats
        : undefined,
    };
  }

  const resolvedWaves: Record<string, WaveDefinition> = {};
  for (const [id, wave] of Object.entries(wavesById)) {
    resolvedWaves[id] = {
      ...wave,
      spawns: wave.spawns.map((spawn) => {
        if (!spawn.overrides) return spawn as WaveDefinition["spawns"][number];
        const overrides = { ...spawn.overrides };
        if (overrides.fire) {
          overrides.fire = coerceFireScript(overrides.fire as FireScriptInput);
        }
        if (overrides.phases) {
          overrides.phases = overrides.phases.map((phase) => ({
            ...phase,
            fire: phase.fire
              ? coerceFireScript(phase.fire as FireScriptInput)
              : undefined,
          }));
        }
        return {
          ...spawn,
          overrides,
        } as WaveDefinition["spawns"][number];
      }),
    };
  }

  for (const [id, wave] of Object.entries(wavesById)) {
    for (const spawn of wave.spawns) {
      if (!resolvedEnemies[spawn.enemyId]) {
        addReferenceError(
          errors,
          `waves/${id}`,
          `Missing enemy "${spawn.enemyId}".`,
        );
      }
    }
  }

  const resolvedShops: Record<string, ShopRules> = {};
  for (const [id, shop] of Object.entries(shopsById)) {
    resolvedShops[id] = {
      allowedShips: shop.allowedShips,
      allowedWeapons: shop.allowedWeapons,
      caps: shop.caps,
    };
    for (const weaponId of shop.allowedWeapons ?? []) {
      if (!resolvedWeapons[weaponId]) {
        addReferenceError(
          errors,
          `shops/${id}`,
          `Missing weapon "${weaponId}".`,
        );
      }
    }
    for (const shipId of shop.allowedShips ?? []) {
      if (!resolvedShips[shipId]) {
        addReferenceError(errors, `shops/${id}`, `Missing ship "${shipId}".`);
      }
    }
  }

  for (const [id, weapon] of Object.entries(resolvedWeapons)) {
    if (!resolvedGuns[weapon.gunId]) {
      addReferenceError(
        errors,
        `weapons/${id}`,
        `Missing gun "${weapon.gunId}".`,
      );
    }
  }

  const resolvedLevels: Record<string, LevelDefinition> = {};
  for (const [id, level] of Object.entries(levelsById)) {
    const missingWaves = level.waveIds.filter(
      (waveId) => !resolvedWaves[waveId],
    );
    for (const missing of missingWaves) {
      addReferenceError(errors, `levels/${id}`, `Missing wave "${missing}".`);
    }
    const waves = level.waveIds
      .map((waveId) => resolvedWaves[waveId])
      .filter(Boolean);

    const missingHazards = (level.hazardIds ?? []).filter(
      (hazardId) => !resolvedHazards[hazardId],
    );
    for (const missing of missingHazards) {
      addReferenceError(errors, `levels/${id}`, `Missing hazard "${missing}".`);
    }
    const hazards = (level.hazardIds ?? [])
      .map((hazardId) => resolvedHazards[hazardId])
      .filter(Boolean);

    const shopRules = level.shopId ? resolvedShops[level.shopId] : undefined;
    if (level.shopId && !shopRules) {
      addReferenceError(
        errors,
        `levels/${id}`,
        `Missing shop "${level.shopId}".`,
      );
    }

    if (level.preBeatId && !beatsById[level.preBeatId]) {
      addReferenceError(
        errors,
        `levels/${id}`,
        `Missing beat "${level.preBeatId}".`,
      );
    }
    if (level.postBeatId && !beatsById[level.postBeatId]) {
      addReferenceError(
        errors,
        `levels/${id}`,
        `Missing beat "${level.postBeatId}".`,
      );
    }
    if (
      level.winCondition.kind === "defeatBoss" &&
      !resolvedEnemies[level.winCondition.bossId]
    ) {
      addReferenceError(
        errors,
        `levels/${id}`,
        `Missing boss "${level.winCondition.bossId}".`,
      );
    }
    if (
      level.endCondition?.kind === "defeatBoss" &&
      !resolvedEnemies[level.endCondition.bossId]
    ) {
      addReferenceError(
        errors,
        `levels/${id}`,
        `Missing boss "${level.endCondition.bossId}".`,
      );
    }

    resolvedLevels[id] = {
      endCondition: coerceEndCondition(level.endCondition),
      hazards: hazards.length ? hazards : undefined,
      id: level.id,
      postBeatId: level.postBeatId,
      preBeatId: level.preBeatId,
      pressureProfile: level.pressureProfile,
      shopRules,
      title: level.title,
      waves,
      winCondition: coerceWinCondition(level.winCondition),
    };
  }

  return {
    errors,
    registry: {
      beatsById,
      enemiesById: resolvedEnemies,
      gunsById: resolvedGuns,
      hazardsById: resolvedHazards,
      levelsById: resolvedLevels,
      shipsById: resolvedShips,
      shopsById: resolvedShops,
      wavesById: resolvedWaves,
      weaponsById: resolvedWeapons,
    },
  };
};
