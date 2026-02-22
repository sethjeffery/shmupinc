import { getLevels, type LevelDefinition } from "./levels";

type LevelSessionRoute = "menu" | "progression";

interface LevelSessionSource {
  galaxyId?: string;
  nodeId?: string;
}

interface LevelSession {
  id: string;
  level: LevelDefinition;
  returnRoute: LevelSessionRoute;
  source?: LevelSessionSource;
  startedAt: number;
  tutorialMode?: boolean;
}

let activeSession: LevelSession | null = null;

export function startLevelSession(
  levelId: string,
  options?: {
    returnRoute?: LevelSessionRoute;
    source?: LevelSessionSource;
    tutorialMode?: boolean;
  },
): LevelSession | null {
  const level = getLevels()[levelId];
  if (!level) return null;
  activeSession = {
    id: levelId,
    level,
    returnRoute: options?.returnRoute ?? "menu",
    source: options?.source,
    startedAt: Date.now(),
    tutorialMode: options?.tutorialMode ?? false,
  };
  return activeSession;
}

export function clearActiveLevel(): void {
  activeSession = null;
}

export function getActiveLevelSession(): LevelSession | null {
  return activeSession;
}
