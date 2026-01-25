import { LEVELS, type LevelDefinition } from "./levels";

export interface LevelSession {
  id: string;
  level: LevelDefinition;
  startedAt: number;
}

let activeSession: LevelSession | null = null;

export function startLevelSession(levelId: string): LevelSession | null {
  const level = LEVELS[levelId];
  if (!level) return null;
  activeSession = {
    id: levelId,
    level,
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

export function getActiveLevel(): LevelDefinition | null {
  return activeSession?.level ?? null;
}
