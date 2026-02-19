import type { LevelRunStats } from "./objectiveTypes";
import type { SaveData } from "./save";

import { getLevels } from "./levels";
import { MAX_LEVEL_STARS, evaluateObjectiveRule } from "./objectiveTypes";
import { applyRewardBundleInSave, loadSave, mutateSave } from "./save";

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

interface LevelCompletionResult {
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
