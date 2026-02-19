export const MAX_LEVEL_STARS = 3;

export type ResourceId = string;

export type UnlockId = string;

export interface RewardBundle {
  resources?: Record<ResourceId, number>;
  unlocks?: UnlockId[];
}

interface ObjectiveBase {
  id: string;
  label: string;
  reward?: RewardBundle;
  stars: number;
}

export type ObjectiveRule =
  | (ObjectiveBase & {
      kind: "clearAllEnemies";
    })
  | (ObjectiveBase & {
      kind: "completeLevel";
    })
  | (ObjectiveBase & {
      kind: "finishUnderMs";
      maxMs: number;
    })
  | (ObjectiveBase & {
      kind: "finishWithHpRatio";
      minRatio: number;
    })
  | (ObjectiveBase & {
      kind: "takeDamageUnder";
      maxDamage: number;
    });

export interface ObjectiveSetDefinition {
  id: string;
  objectives: ObjectiveRule[];
}

export interface LevelRunStats {
  damageTaken: number;
  enemiesDefeated: number;
  enemiesSpawned: number;
  elapsedMs: number;
  hp: number;
  maxHp: number;
}

export const evaluateObjectiveRule = (
  rule: ObjectiveRule,
  run: LevelRunStats,
): boolean => {
  switch (rule.kind) {
    case "completeLevel":
      return true;
    case "clearAllEnemies":
      return (
        run.enemiesSpawned > 0 && run.enemiesDefeated >= run.enemiesSpawned
      );
    case "finishUnderMs":
      return run.elapsedMs <= rule.maxMs;
    case "finishWithHpRatio": {
      const hpRatio = run.maxHp > 0 ? run.hp / run.maxHp : 0;
      return hpRatio >= rule.minRatio;
    }
    case "takeDamageUnder":
      return run.damageTaken <= rule.maxDamage;
    default:
      return false;
  }
};
