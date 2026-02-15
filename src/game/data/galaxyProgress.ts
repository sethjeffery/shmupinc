import type {
  GalaxyDecorationDefinition,
  GalaxyDefinition,
  GalaxyEdgeDefinition,
  GalaxyNodeDefinition,
} from "./galaxyTypes";
import type { SaveData } from "./save";

import { getFirstGalaxyId, getGalaxies } from "./galaxies";
import { getLevelStarCap, getLevelStars } from "./levelProgress";
import { getLevels } from "./levels";
import { loadSave, mutateSave } from "./save";

export interface GalaxyNodeView {
  id: string;
  isBranchChoice: boolean;
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

export interface GalaxyEdgeView extends GalaxyEdgeDefinition {
  isCompleted: boolean;
  isUnlocked: boolean;
}

export interface GalaxyView {
  branchChoiceNodeIds: string[];
  currentNodeId: null | string;
  decorations: GalaxyDecorationDefinition[];
  description?: string;
  edges: GalaxyEdgeView[];
  id: string;
  isComplete: boolean;
  name: string;
  nodes: GalaxyNodeView[];
}

export interface GalaxyNodeLaunch {
  galaxyId: string;
  levelId: string;
  mode: "campaign" | "replay";
  nodeId: string;
}

export interface GalaxyAdvanceResult {
  advanced: boolean;
  branchChoiceNodeIds: string[];
  currentNodeId: null | string;
  galaxyId: null | string;
  isComplete: boolean;
}

const findNode = (
  galaxy: GalaxyDefinition,
  nodeId: string,
): GalaxyNodeDefinition | null =>
  galaxy.nodes.find((node) => node.id === nodeId) ?? null;

const getOutgoingNodeIds = (
  galaxy: GalaxyDefinition,
  nodeId: string,
): string[] => {
  const validIds = new Set(galaxy.nodes.map((node) => node.id));
  return galaxy.edges
    .filter((edge) => edge.from === nodeId && validIds.has(edge.to))
    .map((edge) => edge.to);
};

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
  completedNodeIds: Set<string>,
): boolean => galaxy.nodes.every((node) => completedNodeIds.has(node.id));

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
  const completedSet = new Set(campaign.completedNodeIds);
  const unlockedSet = new Set(campaign.unlockedNodeIds);
  const branchSet = new Set(campaign.branchChoiceNodeIds);

  const nodes: GalaxyNodeView[] = galaxy.nodes.map((node) => {
    const level = levels[node.levelId];
    const isCompleted = completedSet.has(node.id);
    const isCurrent = campaign.currentNodeId === node.id;
    const isBranchChoice = !campaign.currentNodeId && branchSet.has(node.id);
    const isUnlocked = isCompleted || unlockedSet.has(node.id);
    return {
      id: node.id,
      isBranchChoice,
      isCompleted,
      isCurrent,
      isReplayable: isCompleted,
      isSelectable: isCurrent || isBranchChoice,
      isUnlocked,
      levelId: node.levelId,
      name: node.name ?? level?.title ?? node.levelId,
      pos: node.pos,
      starCap: getLevelStarCap(node.levelId),
      stars: getLevelStars(node.levelId, save),
    };
  });

  const edges: GalaxyEdgeView[] = galaxy.edges.map((edge) => ({
    ...edge,
    isCompleted: completedSet.has(edge.from) && completedSet.has(edge.to),
    isUnlocked: completedSet.has(edge.from) || unlockedSet.has(edge.to),
  }));

  return {
    branchChoiceNodeIds: campaign.branchChoiceNodeIds,
    currentNodeId: campaign.currentNodeId,
    decorations: galaxy.decorations ?? [],
    description: galaxy.description,
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

  const node = findNode(galaxy, nodeId);
  if (!node) return null;

  const isCompleted = campaign.completedNodeIds.includes(nodeId);
  if (isCompleted) {
    return {
      galaxyId,
      levelId: node.levelId,
      mode: "replay",
      nodeId,
    };
  }

  if (campaign.currentNodeId === nodeId) {
    return {
      galaxyId,
      levelId: node.levelId,
      mode: "campaign",
      nodeId,
    };
  }

  if (
    campaign.currentNodeId ||
    !campaign.branchChoiceNodeIds.includes(nodeId) ||
    !campaign.unlockedNodeIds.includes(nodeId)
  ) {
    return null;
  }

  mutateSave((saveData) => {
    const activeGalaxyId = saveData.activeGalaxyId;
    if (!activeGalaxyId || activeGalaxyId !== galaxyId) return;
    const state = saveData.galaxyCampaign[activeGalaxyId];
    if (!state) return;
    const branchChoices = new Set(state.branchChoiceNodeIds);
    state.currentNodeId = nodeId;
    state.branchChoiceNodeIds = [];
    state.unlockedNodeIds = state.unlockedNodeIds.filter(
      (entry) => !branchChoices.has(entry) || entry === nodeId,
    );
    if (!state.unlockedNodeIds.includes(nodeId)) {
      state.unlockedNodeIds.push(nodeId);
    }
  });

  return {
    galaxyId,
    levelId: node.levelId,
    mode: "campaign",
    nodeId,
  };
};

export const advanceActiveGalaxyOnLevelClear = (
  levelId: string,
): GalaxyAdvanceResult => {
  const result: GalaxyAdvanceResult = {
    advanced: false,
    branchChoiceNodeIds: [],
    currentNodeId: null,
    galaxyId: null,
    isComplete: false,
  };

  mutateSave((saveData) => {
    const active = getActiveGalaxy(saveData);
    if (!active) return;
    const { galaxy, galaxyId } = active;
    const campaign = saveData.galaxyCampaign[galaxyId];
    if (!campaign?.currentNodeId) return;

    const currentNode = findNode(galaxy, campaign.currentNodeId);
    if (currentNode?.levelId !== levelId) return;

    const completed = new Set(campaign.completedNodeIds);
    const unlocked = new Set(campaign.unlockedNodeIds);
    completed.add(currentNode.id);
    unlocked.delete(currentNode.id);

    const nextNodeIds = getOutgoingNodeIds(galaxy, currentNode.id);
    for (const nodeId of nextNodeIds) {
      if (!completed.has(nodeId)) unlocked.add(nodeId);
    }

    campaign.completedNodeIds = [...completed];
    campaign.unlockedNodeIds = [...unlocked];

    if (nextNodeIds.length === 0) {
      campaign.currentNodeId = null;
      campaign.branchChoiceNodeIds = [];
    } else if (nextNodeIds.length === 1) {
      campaign.currentNodeId = nextNodeIds[0];
      campaign.branchChoiceNodeIds = [];
      if (!campaign.unlockedNodeIds.includes(nextNodeIds[0])) {
        campaign.unlockedNodeIds.push(nextNodeIds[0]);
      }
    } else {
      campaign.currentNodeId = null;
      campaign.branchChoiceNodeIds = nextNodeIds;
    }

    result.advanced = true;
    result.branchChoiceNodeIds = campaign.branchChoiceNodeIds;
    result.currentNodeId = campaign.currentNodeId;
    result.galaxyId = galaxyId;
    result.isComplete = isCampaignComplete(galaxy, completed);
  });

  return result;
};
