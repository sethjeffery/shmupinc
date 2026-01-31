import type { ShipDefinition, ShipId, WeaponMount } from "./shipTypes";
import type { WeaponInstanceId } from "./weaponInstances";
import type { WeaponDefinition, WeaponId, WeaponStats } from "./weaponTypes";

import { SHIPS, STARTER_SHIP_ID } from "./ships";
import { canMountWeapon, resolveWeaponStats } from "./weaponMounts";
import { STARTER_WEAPON_ID, WEAPONS } from "./weapons";

const STORAGE_KEY = "shmupinc-save-v2";

export const BASE_HP = 6;

export interface WeaponInstance {
  id: WeaponInstanceId;
  weaponId: WeaponId;
}

export interface MountAssignment {
  mountId: string;
  weaponInstanceId: null | WeaponInstanceId;
}

export interface SaveData {
  gold: number;
  ownedWeapons: WeaponInstance[];
  mountedWeapons: Record<string, MountAssignment[]>;
  nextWeaponInstanceId: number;
  unlockedShips: ShipId[];
  selectedShipId: ShipId;
}

export interface MountedWeapon {
  instanceId: WeaponInstanceId;
  mount: WeaponMount;
  stats: WeaponStats;
  weapon: WeaponDefinition;
}

const defaultSave: SaveData = {
  gold: 0,
  mountedWeapons: {},
  nextWeaponInstanceId: 1,
  ownedWeapons: [],
  selectedShipId: STARTER_SHIP_ID,
  unlockedShips: [STARTER_SHIP_ID],
};

let cached: null | SaveData = null;

function getStorage(): null | Storage {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

const createWeaponInstance = (
  save: SaveData,
  weaponId: WeaponId,
): WeaponInstance => {
  const id = `w${save.nextWeaponInstanceId}`;
  save.nextWeaponInstanceId += 1;
  const instance = { id, weaponId };
  save.ownedWeapons.push(instance);
  return instance;
};

const buildMountAssignments = (ship: ShipDefinition): MountAssignment[] =>
  ship.mounts.map((mount) => ({ mountId: mount.id, weaponInstanceId: null }));

const getWeaponDefinition = (weaponId: WeaponId): null | WeaponDefinition =>
  WEAPONS[weaponId] ?? null;

const normalizeNextWeaponInstanceId = (save: SaveData): void => {
  let maxId = 0;
  for (const instance of save.ownedWeapons) {
    const match = /^w(\\d+)$/.exec(instance.id);
    if (!match) continue;
    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isNaN(parsed)) {
      maxId = Math.max(maxId, parsed);
    }
  }
  const next = Math.max(save.nextWeaponInstanceId ?? 1, maxId + 1);
  save.nextWeaponInstanceId = next;
};

const findFirstCompatibleMount = (
  ship: ShipDefinition,
  weapon: WeaponDefinition,
  assignments: MountAssignment[],
): MountAssignment | null => {
  const candidates = ship.mounts.filter((mount) =>
    canMountWeapon(weapon, mount),
  );
  const preferred =
    candidates.find((mount) => mount.zone === "front") ?? candidates[0];
  if (!preferred) return null;
  return assignments.find((entry) => entry.mountId === preferred.id) ?? null;
};

const normalizeMountedWeapons = (save: SaveData): void => {
  const used = new Set<WeaponInstanceId>();
  const cleaned: Record<string, MountAssignment[]> = {};
  for (const [shipId, ship] of Object.entries(SHIPS)) {
    const assignments =
      save.mountedWeapons[shipId] ?? buildMountAssignments(ship);
    const normalized: MountAssignment[] = [];
    for (const mount of ship.mounts) {
      const entry = assignments.find((item) => item.mountId === mount.id);
      const instanceId = entry?.weaponInstanceId ?? null;
      if (!instanceId) {
        normalized.push({ mountId: mount.id, weaponInstanceId: null });
        continue;
      }
      if (used.has(instanceId)) {
        normalized.push({ mountId: mount.id, weaponInstanceId: null });
        continue;
      }
      const instance = save.ownedWeapons.find((item) => item.id === instanceId);
      const weapon = instance ? getWeaponDefinition(instance.weaponId) : null;
      if (!weapon || !canMountWeapon(weapon, mount)) {
        normalized.push({ mountId: mount.id, weaponInstanceId: null });
        continue;
      }
      used.add(instanceId);
      normalized.push({ mountId: mount.id, weaponInstanceId: instanceId });
    }
    cleaned[shipId] = normalized;
  }
  save.mountedWeapons = cleaned;
};

const ensureDefaultLoadout = (save: SaveData): void => {
  const ship = SHIPS[save.selectedShipId] ?? SHIPS[STARTER_SHIP_ID];
  if (!save.mountedWeapons[ship.id]) {
    save.mountedWeapons[ship.id] = buildMountAssignments(ship);
  }
  const assignments = save.mountedWeapons[ship.id];
  const hasWeapon = assignments.some((entry) => entry.weaponInstanceId);
  if (hasWeapon) return;
  const instance =
    save.ownedWeapons[0] ?? createWeaponInstance(save, STARTER_WEAPON_ID);
  const weapon = getWeaponDefinition(instance.weaponId);
  if (!weapon) return;
  const assignment = findFirstCompatibleMount(ship, weapon, assignments);
  if (assignment) assignment.weaponInstanceId = instance.id;
};

export function loadSave(): SaveData {
  if (cached) return { ...cached };
  const storage = getStorage();
  if (!storage) return { ...defaultSave };

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      cached = { ...defaultSave, ...parsed };
    } else {
      cached = { ...defaultSave };
    }
  } catch {
    cached = { ...defaultSave };
  }

  if (!cached.unlockedShips.includes(cached.selectedShipId)) {
    cached.unlockedShips = [...cached.unlockedShips, cached.selectedShipId];
  }
  cached.ownedWeapons = cached.ownedWeapons.filter(
    (item) => WEAPONS[item.weaponId],
  );
  if (cached.ownedWeapons.length === 0 && WEAPONS[STARTER_WEAPON_ID]) {
    createWeaponInstance(cached, STARTER_WEAPON_ID);
  }
  normalizeNextWeaponInstanceId(cached);
  normalizeMountedWeapons(cached);
  ensureDefaultLoadout(cached);

  return { ...cached };
}

export function persistSave(data: SaveData): void {
  cached = { ...data };
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(cached));
}

export function mutateSave(
  mutator: (data: SaveData) => void,
  options?: { allowEmptyLoadout?: boolean },
): SaveData {
  const save = loadSave();
  mutator(save);
  normalizeMountedWeapons(save);
  if (!options?.allowEmptyLoadout) {
    ensureDefaultLoadout(save);
  }
  persistSave(save);
  return save;
}

export function bankGold(amount: number): SaveData {
  return mutateSave((data) => {
    data.gold += Math.max(0, amount);
  });
}

export function computePlayerLoadout(baseHp: number = BASE_HP): {
  mountedWeapons: MountedWeapon[];
  save: SaveData;
  ship: ShipDefinition;
} {
  const save = loadSave();
  const ship = SHIPS[save.selectedShipId] ?? SHIPS[STARTER_SHIP_ID];
  const fallbackHp = ship.maxHp || baseHp;
  const mounted = buildMountedWeapons(save, ship);
  return {
    mountedWeapons: mounted,
    save,
    ship: { ...ship, maxHp: fallbackHp },
  };
}

export function buildMountedWeapons(
  save: SaveData,
  ship: ShipDefinition,
): MountedWeapon[] {
  const assignments =
    save.mountedWeapons[ship.id] ?? buildMountAssignments(ship);
  const mounted: MountedWeapon[] = [];
  for (const assignment of assignments) {
    if (!assignment.weaponInstanceId) continue;
    const instance = save.ownedWeapons.find(
      (item) => item.id === assignment.weaponInstanceId,
    );
    if (!instance) continue;
    const weapon = getWeaponDefinition(instance.weaponId);
    if (!weapon) continue;
    const mount = ship.mounts.find((entry) => entry.id === assignment.mountId);
    if (!mount) continue;
    const stats = resolveWeaponStats(weapon, mount.zone);
    mounted.push({
      instanceId: instance.id,
      mount,
      stats,
      weapon,
    });
  }
  return mounted;
}
