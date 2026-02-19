interface DebugFlags {
  showHazardBounds: boolean;
  showSpawnPoints: boolean;
}

const STORAGE_KEY = "shmupinc_debug_flags";

const DEFAULT_FLAGS: DebugFlags = {
  showHazardBounds: false,
  showSpawnPoints: false,
};

export const getDebugFlags = (): DebugFlags => {
  if (typeof window === "undefined") return DEFAULT_FLAGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FLAGS;
    const parsed = JSON.parse(raw) as Partial<DebugFlags>;
    return {
      ...DEFAULT_FLAGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_FLAGS;
  }
};

export const setDebugFlags = (next: Partial<DebugFlags>): DebugFlags => {
  const merged = { ...getDebugFlags(), ...next };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // ignore
  }
  return merged;
};
