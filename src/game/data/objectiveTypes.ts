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

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const mergeRewards = (
  target: RewardBundle,
  incoming: RewardBundle | undefined,
): void => {
  if (!incoming) return;
  if (incoming.resources) {
    const resources = target.resources ?? {};
    for (const [resourceId, amount] of Object.entries(incoming.resources)) {
      resources[resourceId] = (resources[resourceId] ?? 0) + amount;
    }
    target.resources = resources;
  }
  if (incoming.unlocks?.length) {
    const unlocks = new Set(target.unlocks ?? []);
    for (const unlockId of incoming.unlocks) {
      unlocks.add(unlockId);
    }
    target.unlocks = [...unlocks];
  }
};

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

export const evaluateObjectiveSet = (
  objectiveSet: ObjectiveSetDefinition,
  run: LevelRunStats,
): {
  completedObjectiveIds: string[];
  rewards: RewardBundle;
  stars: number;
} => {
  const completedObjectiveIds: string[] = [];
  const rewards: RewardBundle = {};
  let stars = 0;
  for (const objective of objectiveSet.objectives) {
    const completed = evaluateObjectiveRule(objective, run);
    if (!completed) continue;
    completedObjectiveIds.push(objective.id);
    stars += objective.stars;
    mergeRewards(rewards, objective.reward);
  }
  return {
    completedObjectiveIds,
    rewards,
    stars: clamp(Math.round(stars), 0, MAX_LEVEL_STARS),
  };
};
