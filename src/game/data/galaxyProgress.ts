import type {
  GalaxyDecorationDefinition,
  GalaxyDefinition,
} from "./galaxyTypes";
import type { SaveData } from "./save";

import { getFirstGalaxyId, getGalaxies } from "./galaxies";
import { getLevelStarCap, getLevelStars } from "./levelProgress";
import { getLevels } from "./levels";
import { loadSave, mutateSave } from "./save";

export interface GalaxyNodeView {
  id: string;
  isCompleted: boolean;
  isCurrent: boolean;
  isReplayable: boolean;
  isSelectable: boolean;
  isUnlocked: boolean;
  levelId: string;
  name: string;
  pos: { x: number; y: number };
  starCap: number;
  stars: number;
}

export interface GalaxyEdgeView {
  from: string;
  isCompleted: boolean;
  isUnlocked: boolean;
  to: string;
}

export interface GalaxyView {
  currentLevelId: null | string;
  decorations: GalaxyDecorationDefinition[];
  description?: string;
  edges: GalaxyEdgeView[];
  id: string;
  isComplete: boolean;
  name: string;
  nodes: GalaxyNodeView[];
}

interface GalaxyNodeLaunch {
  galaxyId: string;
  levelId: string;
  mode: "campaign" | "replay";
  nodeId: string;
}

interface GalaxyAdvanceResult {
  advanced: boolean;
  currentLevelId: null | string;
  galaxyId: null | string;
  isComplete: boolean;
}

const getActiveGalaxy = (
  save: SaveData,
): { galaxy: GalaxyDefinition; galaxyId: string } | null => {
  const galaxies = getGalaxies();
  const galaxyId = save.activeGalaxyId ?? getFirstGalaxyId();
  if (!galaxyId) return null;
  const galaxy = galaxies[galaxyId];
  if (!galaxy) return null;
  return { galaxy, galaxyId };
};

const isCampaignComplete = (
  galaxy: GalaxyDefinition,
  completedLevelIds: Set<string>,
): boolean =>
  galaxy.levels.every((entry) => completedLevelIds.has(entry.levelId));

export const ensureActiveGalaxy = (): null | string => {
  const galaxies = getGalaxies();
  if (Object.keys(galaxies).length === 0) return null;
  const save = mutateSave((saveData) => {
    if (saveData.activeGalaxyId && galaxies[saveData.activeGalaxyId]) return;
    saveData.activeGalaxyId = getFirstGalaxyId();
  });
  return save.activeGalaxyId;
};

export const buildActiveGalaxyView = (
  save: SaveData = loadSave(),
): GalaxyView | null => {
  const active = getActiveGalaxy(save);
  if (!active) return null;
  const { galaxy, galaxyId } = active;
  const campaign = save.galaxyCampaign[galaxyId];
  if (!campaign) return null;

  const levels = getLevels();
  const completedSet = new Set(campaign.completedLevelIds);

  const nodes: GalaxyNodeView[] = galaxy.levels.map((entry) => {
    const level = levels[entry.levelId];
    const isCompleted = completedSet.has(entry.levelId);
    const isCurrent = campaign.currentLevelId === entry.levelId;
    return {
      id: entry.levelId,
      isCompleted,
      isCurrent,
      isReplayable: isCompleted,
      isSelectable: isCurrent,
      isUnlocked: isCompleted || isCurrent,
      levelId: entry.levelId,
      name: entry.name ?? level?.title ?? entry.levelId,
      pos: entry.pos,
      starCap: getLevelStarCap(entry.levelId),
      stars: getLevelStars(entry.levelId, save),
    };
  });

  const edges: GalaxyEdgeView[] = [];
  for (let i = 0; i < galaxy.levels.length - 1; i += 1) {
    const from = galaxy.levels[i]?.levelId;
    const to = galaxy.levels[i + 1]?.levelId;
    if (!from || !to) continue;
    edges.push({
      from,
      isCompleted: completedSet.has(from) && completedSet.has(to),
      isUnlocked: completedSet.has(from) || campaign.currentLevelId === to,
      to,
    });
  }

  return {
    currentLevelId: campaign.currentLevelId,
    decorations: galaxy.decorations ?? [],
    description: "Select your next destination.",
    edges,
    id: galaxy.id,
    isComplete: isCampaignComplete(galaxy, completedSet),
    name: galaxy.name,
    nodes,
  };
};

export const launchGalaxyNode = (nodeId: string): GalaxyNodeLaunch | null => {
  const save = loadSave();
  const active = getActiveGalaxy(save);
  if (!active) return null;
  const { galaxy, galaxyId } = active;
  const campaign = save.galaxyCampaign[galaxyId];
  if (!campaign) return null;
  if (!galaxy.levels.some((entry) => entry.levelId === nodeId)) return null;

  if (campaign.completedLevelIds.includes(nodeId)) {
    return {
      galaxyId,
      levelId: nodeId,
      mode: "replay",
      nodeId,
    };
  }
  if (campaign.currentLevelId !== nodeId) return null;
  return {
    galaxyId,
    levelId: nodeId,
    mode: "campaign",
    nodeId,
  };
};

export const advanceActiveGalaxyOnLevelClear = (
  levelId: string,
): GalaxyAdvanceResult => {
  const result: GalaxyAdvanceResult = {
    advanced: false,
    currentLevelId: null,
    galaxyId: null,
    isComplete: false,
  };

  mutateSave((saveData) => {
    const active = getActiveGalaxy(saveData);
    if (!active) return;
    const { galaxy, galaxyId } = active;
    const campaign = saveData.galaxyCampaign[galaxyId];
    if (campaign?.currentLevelId !== levelId) return;
    const orderedLevelIds = galaxy.levels.map((entry) => entry.levelId);

    const completedSet = new Set(campaign.completedLevelIds);
    completedSet.add(levelId);

    const completedLevelIds: string[] = [];
    for (const candidateLevelId of orderedLevelIds) {
      if (!completedSet.has(candidateLevelId)) break;
      completedLevelIds.push(candidateLevelId);
    }
    const currentLevelId = orderedLevelIds[completedLevelIds.length] ?? null;

    campaign.completedLevelIds = completedLevelIds;
    campaign.currentLevelId = currentLevelId;

    result.advanced = true;
    result.currentLevelId = campaign.currentLevelId;
    result.galaxyId = galaxyId;
    result.isComplete = isCampaignComplete(galaxy, completedSet);
  });

  return result;
};
