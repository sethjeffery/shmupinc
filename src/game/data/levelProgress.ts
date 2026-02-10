import type { LevelRunStats } from "./objectiveTypes";
import type { SaveData } from "./save";

import { getLevels } from "./levels";
import { MAX_LEVEL_STARS, evaluateObjectiveRule } from "./objectiveTypes";
import { applyRewardBundleInSave, loadSave, mutateSave } from "./save";

const levelOrderInfo = (
  levelId: string,
): { hasOrder: boolean; order: number } => {
  const match = /^L(\d+)_/i.exec(levelId);
  if (!match) return { hasOrder: false, order: Number.MAX_SAFE_INTEGER };
  const parsed = Number.parseInt(match[1], 10);
  if (Number.isNaN(parsed)) {
    return { hasOrder: false, order: Number.MAX_SAFE_INTEGER };
  }
  return { hasOrder: true, order: parsed };
};

const compareLevelIds = (a: string, b: string): number => {
  const aInfo = levelOrderInfo(a);
  const bInfo = levelOrderInfo(b);
  if (aInfo.hasOrder && bInfo.hasOrder && aInfo.order !== bInfo.order) {
    return aInfo.order - bInfo.order;
  }
  if (aInfo.hasOrder !== bInfo.hasOrder) {
    return aInfo.hasOrder ? -1 : 1;
  }
  return a.localeCompare(b);
};

export const getStoryLevelOrder = (): string[] =>
  Object.keys(getLevels()).sort(compareLevelIds);

const getSavedStars = (levelId: string, save: SaveData): number =>
  Math.max(0, save.levelStars[levelId] ?? 0);

const getConfiguredStarCap = (levelId: string): number => {
  const level = getLevels()[levelId];
  if (!level?.objectiveSet) return 1;
  const total = level.objectiveSet.objectives.reduce(
    (sum, objective) => sum + objective.stars,
    0,
  );
  return Math.max(1, Math.min(MAX_LEVEL_STARS, Math.round(total)));
};

export const getLevelStarCap = (levelId: string): number =>
  getConfiguredStarCap(levelId);

export const getLevelStars = (
  levelId: string,
  save: SaveData = loadSave(),
): number =>
  Math.min(getConfiguredStarCap(levelId), getSavedStars(levelId, save));

const isLevelUnlockedWithSave = (levelId: string, save: SaveData): boolean => {
  const order = getStoryLevelOrder();
  const index = order.indexOf(levelId);
  if (index < 0) return false;
  if (index === 0) return true;
  const previousLevel = order[index - 1];
  return getSavedStars(previousLevel, save) >= 1;
};

export const isLevelUnlocked = (
  levelId: string,
  save: SaveData = loadSave(),
): boolean => isLevelUnlockedWithSave(levelId, save);

export const getFirstUnlockedLevelId = (
  save: SaveData = loadSave(),
): null | string => {
  const order = getStoryLevelOrder();
  for (const levelId of order) {
    if (isLevelUnlockedWithSave(levelId, save)) {
      return levelId;
    }
  }
  return order[0] ?? null;
};

export interface LevelCompletionResult {
  completedObjectiveIds: string[];
  newlyClaimedObjectiveIds: string[];
  save: SaveData;
  starsAwarded: number;
  starsBest: number;
}

export const recordLevelCompletion = (
  levelId: string,
  runStats?: LevelRunStats,
): LevelCompletionResult => {
  let starsAwarded = 0;
  let starsBest = 0;
  const completedObjectiveIds: string[] = [];
  const newlyClaimedObjectiveIds: string[] = [];

  const save = mutateSave((saveData) => {
    const level = getLevels()[levelId];
    if (!level) return;

    const objectiveSet = level.objectiveSet;
    let earnedStars = 1;

    if (objectiveSet && runStats) {
      earnedStars = 0;
      const claimedIds = new Set(saveData.claimedObjectiveIds);
      for (const objective of objectiveSet.objectives) {
        if (!evaluateObjectiveRule(objective, runStats)) continue;
        completedObjectiveIds.push(objective.id);
        earnedStars += objective.stars;
        const claimedId = `${levelId}:${objective.id}`;
        if (claimedIds.has(claimedId)) continue;
        claimedIds.add(claimedId);
        newlyClaimedObjectiveIds.push(claimedId);
        applyRewardBundleInSave(saveData, objective.reward);
      }
      saveData.claimedObjectiveIds = [...claimedIds];
      earnedStars = Math.max(1, earnedStars);
    }

    const starCap = getConfiguredStarCap(levelId);
    starsAwarded = Math.max(1, Math.min(starCap, Math.round(earnedStars)));
    const previousBest = getSavedStars(levelId, saveData);
    starsBest = Math.max(previousBest, starsAwarded);
    saveData.levelStars[levelId] = starsBest;
  });

  return {
    completedObjectiveIds,
    newlyClaimedObjectiveIds,
    save,
    starsAwarded,
    starsBest,
  };
};
