import type { EnemyDef } from "../game/data/enemyTypes";
import type { HazardScript, LevelDefinition, ShopRules } from "../game/data/levels/types";
import type { BulletSpec, FireScript, FireStep } from "../game/data/scripts";
import type { SecondaryWeaponDefinition } from "../game/data/secondaryWeaponTypes";
import type { ShipDefinition } from "../game/data/shipTypes";
import type { StoryBeat } from "../game/data/storyBeatTypes";
import type { WaveDefinition } from "../game/data/waves";
import type { WeaponDefinition } from "../game/data/weaponTypes";
import type {
  BeatContent,
  ContentKind,
  EnemyContent,
  HazardContent,
  LevelContent,
  SecondaryWeaponContent,
  ShipContent,
  ShopContent,
  WaveContent,
  WeaponContent,
} from "./schemas";

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
  hazardsById: Record<string, HazardScript>;
  levelsById: Record<string, LevelDefinition>;
  secondaryWeaponsById: Record<string, SecondaryWeaponDefinition>;
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
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.startsWith("#")) {
    return Number.parseInt(trimmed.slice(1), 16);
  }
  if (trimmed.startsWith("0x")) {
    return Number.parseInt(trimmed.slice(2), 16);
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const resolveColor = (value: number | string | undefined): number | undefined => {
  if (typeof value === "undefined") return undefined;
  return parseColor(value);
};

const coerceBulletSpec = (spec: BulletSpec): BulletSpec => {
  const rawColor = (spec as { color?: number | string }).color;
  const trail = spec.trail
    ? {
        ...spec.trail,
        color: resolveColor((spec.trail as { color?: number | string }).color) ?? 0xffffff,
      }
    : undefined;
  return {
    ...spec,
    color: resolveColor(rawColor),
    trail,
  };
};

const coerceFireStep = (step: FireStep): FireStep => {
  if ("bullet" in step) {
    return {
      ...step,
      bullet: coerceBulletSpec(step.bullet),
    };
  }
  return step;
};

const coerceFireScript = (script: FireScript): FireScript => ({
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

export const buildContentRegistry = (entries: ContentEntry[]): ContentBuildResult => {
  const errors: ContentError[] = [];

  const beatsById: Record<string, BeatContent> = {};
  const enemiesById: Record<string, EnemyContent> = {};
  const hazardsById: Record<string, HazardContent> = {};
  const levelsById: Record<string, LevelContent> = {};
  const secondaryWeaponsById: Record<string, SecondaryWeaponContent> = {};
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
        beatsById[id] = value as BeatContent;
        break;
      case "enemies":
        if (enemiesById[id]) {
          addDuplicateError(errors, entry.path, entry.kind, id);
          break;
        }
        enemiesById[id] = value as EnemyContent;
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
      case "secondaryWeapons":
        if (secondaryWeaponsById[id]) {
          addDuplicateError(errors, entry.path, entry.kind, id);
          break;
        }
        secondaryWeaponsById[id] = value as SecondaryWeaponContent;
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
      fire: coerceFireScript(enemy.fire as FireScript),
      phases: enemy.phases?.map((phase) => ({
        ...phase,
        fire: phase.fire ? coerceFireScript(phase.fire as FireScript) : undefined,
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

  const resolvedSecondaryWeapons: Record<string, SecondaryWeaponDefinition> = {};
  for (const [id, weapon] of Object.entries(secondaryWeaponsById)) {
    resolvedSecondaryWeapons[id] = {
      ...weapon,
      bullet: coerceBulletSpec(weapon.bullet as BulletSpec),
    };
  }

  const resolvedShips: Record<string, ShipDefinition> = {};
  for (const [id, ship] of Object.entries(shipsById)) {
    resolvedShips[id] = {
      ...ship,
      color: resolveColor(ship.color) ?? 0xffffff,
    };
  }

  const resolvedWeapons: Record<string, WeaponDefinition> = {};
  for (const [id, weapon] of Object.entries(weaponsById)) {
    resolvedWeapons[id] = {
      ...weapon,
      bullet: coerceBulletSpec(weapon.bullet as BulletSpec),
    };
  }

  const resolvedWaves: Record<string, WaveDefinition> = {};
  for (const [id, wave] of Object.entries(wavesById)) {
    resolvedWaves[id] = wave as unknown as WaveDefinition;
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
      allowedSecondaryWeapons: shop.allowedSecondaryWeapons,
      allowedShips: shop.allowedShips,
      allowedWeapons: shop.allowedWeapons,
      caps: shop.caps,
    };
    for (const weaponId of shop.allowedWeapons ?? []) {
      if (!resolvedWeapons[weaponId]) {
        addReferenceError(errors, `shops/${id}`, `Missing weapon "${weaponId}".`);
      }
    }
    for (const weaponId of shop.allowedSecondaryWeapons ?? []) {
      if (!resolvedSecondaryWeapons[weaponId]) {
        addReferenceError(
          errors,
          `shops/${id}`,
          `Missing secondary weapon "${weaponId}".`,
        );
      }
    }
    for (const shipId of shop.allowedShips ?? []) {
      if (!resolvedShips[shipId]) {
        addReferenceError(errors, `shops/${id}`, `Missing ship "${shipId}".`);
      }
    }
  }

  const resolvedLevels: Record<string, LevelDefinition> = {};
  for (const [id, level] of Object.entries(levelsById)) {
    const missingWaves = level.waveIds.filter((waveId) => !resolvedWaves[waveId]);
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
      addReferenceError(errors, `levels/${id}`, `Missing shop "${level.shopId}".`);
    }

    if (level.preBeatId && !beatsById[level.preBeatId]) {
      addReferenceError(errors, `levels/${id}`, `Missing beat "${level.preBeatId}".`);
    }
    if (level.postBeatId && !beatsById[level.postBeatId]) {
      addReferenceError(errors, `levels/${id}`, `Missing beat "${level.postBeatId}".`);
    }
    if (level.winCondition.kind === "defeatBoss" && !resolvedEnemies[level.winCondition.bossId]) {
      addReferenceError(
        errors,
        `levels/${id}`,
        `Missing boss "${level.winCondition.bossId}".`,
      );
    }
    if (level.endCondition?.kind === "defeatBoss" && !resolvedEnemies[level.endCondition.bossId]) {
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
      hazardsById: resolvedHazards,
      levelsById: resolvedLevels,
      secondaryWeaponsById: resolvedSecondaryWeapons,
      shipsById: resolvedShips,
      shopsById: resolvedShops,
      wavesById: resolvedWaves,
      weaponsById: resolvedWeapons,
    },
  };
};
