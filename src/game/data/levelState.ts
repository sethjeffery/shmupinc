import { getLevels, type LevelDefinition } from "./levels";

export type LevelSessionRoute = "menu" | "progression";

export interface LevelSessionSource {
  galaxyId?: string;
  nodeId?: string;
}

export interface LevelSession {
  id: string;
  level: LevelDefinition;
  returnRoute: LevelSessionRoute;
  source?: LevelSessionSource;
  startedAt: number;
}

let activeSession: LevelSession | null = null;

export function startLevelSession(
  levelId: string,
  options?: {
    returnRoute?: LevelSessionRoute;
    source?: LevelSessionSource;
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
  };
  return activeSession;
}

export function clearActiveLevel(): void {
  activeSession = null;
}

export function getActiveLevelSession(): LevelSession | null {
  return activeSession;
}
