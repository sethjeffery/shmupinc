import type { ModInstanceId } from "./modInstances";
import type { ModDefinition, ModId } from "./modTypes";
import type { ResourceId, RewardBundle, UnlockId } from "./objectiveTypes";
import type { ShipDefinition, ShipId, WeaponMount } from "./shipTypes";
import type { WeaponInstanceId } from "./weaponInstances";
import type { WeaponDefinition, WeaponId, WeaponStats } from "./weaponTypes";

import { getLevels } from "./levels";
import { MODS } from "./mods";
import { SHIPS, STARTER_SHIP_ID } from "./ships";
import { normalizeMountMods, resolveWeaponStatsWithMods } from "./weaponMods";
import { canMountWeapon } from "./weaponMounts";
import { STARTER_WEAPON_ID, WEAPONS } from "./weapons";

const STORAGE_KEY = "shmupinc-save-v4";
const GOLD_RESOURCE_ID: ResourceId = "gold";

export const BASE_HP = 6;

export interface WeaponInstance {
  id: WeaponInstanceId;
  weaponId: WeaponId;
}

export interface ModInstance {
  id: ModInstanceId;
  modId: ModId;
}

export interface MountAssignment {
  mountId: string;
  weaponInstanceId: null | WeaponInstanceId;
  modInstanceIds: ModInstanceId[];
}

export interface SaveData {
  claimedObjectiveIds: string[];
  levelStars: Record<string, number>;
  ownedWeapons: WeaponInstance[];
  ownedMods: ModInstance[];
  mountedWeapons: Record<string, MountAssignment[]>;
  nextWeaponInstanceId: number;
  nextModInstanceId: number;
  resources: Record<ResourceId, number>;
  unlocks: UnlockId[];
  unlockedShips: ShipId[];
  selectedShipId: ShipId;
}

export interface MountedWeapon {
  instanceId: WeaponInstanceId;
  mount: WeaponMount;
  mods: ModDefinition[];
  stats: WeaponStats;
  weapon: WeaponDefinition;
}

const defaultSave: SaveData = {
  claimedObjectiveIds: [],
  levelStars: {},
  mountedWeapons: {},
  nextModInstanceId: 1,
  nextWeaponInstanceId: 1,
  ownedMods: [],
  ownedWeapons: [],
  resources: { gold: 0 },
  selectedShipId: STARTER_SHIP_ID,
  unlockedShips: [STARTER_SHIP_ID],
  unlocks: [],
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
  const existing = save.ownedWeapons.find(
    (instance) => instance.weaponId === weaponId,
  );
  if (existing) return existing;
  const id = `w${save.nextWeaponInstanceId}`;
  save.nextWeaponInstanceId += 1;
  const instance = { id, weaponId };
  save.ownedWeapons.push(instance);
  return instance;
};

const createModInstance = (save: SaveData, modId: ModId): ModInstance => {
  const id = `m${save.nextModInstanceId}`;
  save.nextModInstanceId += 1;
  const instance = { id, modId };
  save.ownedMods.push(instance);
  return instance;
};

const buildMountAssignments = (ship: ShipDefinition): MountAssignment[] =>
  ship.mounts.map((mount) => ({
    modInstanceIds: [],
    mountId: mount.id,
    weaponInstanceId: null,
  }));

const getWeaponDefinition = (weaponId: WeaponId): null | WeaponDefinition =>
  WEAPONS[weaponId] ?? null;

const getModDefinition = (modId: ModId): ModDefinition | null =>
  MODS[modId] ?? null;

const normalizeOwnedWeapons = (save: SaveData): void => {
  const seenInstances = new Set<WeaponInstanceId>();
  const seenWeapons = new Set<WeaponId>();
  const unique: WeaponInstance[] = [];
  for (const instance of save.ownedWeapons) {
    if (seenInstances.has(instance.id)) continue;
    if (seenWeapons.has(instance.weaponId)) continue;
    seenInstances.add(instance.id);
    seenWeapons.add(instance.weaponId);
    unique.push(instance);
  }
  save.ownedWeapons = unique;
};

const normalizeNextWeaponInstanceId = (save: SaveData): void => {
  let maxId = 0;
  for (const instance of save.ownedWeapons) {
    const match = /^w(\d+)$/.exec(instance.id);
    if (!match) continue;
    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isNaN(parsed)) {
      maxId = Math.max(maxId, parsed);
    }
  }
  const next = Math.max(save.nextWeaponInstanceId ?? 1, maxId + 1);
  save.nextWeaponInstanceId = next;
};

const normalizeNextModInstanceId = (save: SaveData): void => {
  let maxId = 0;
  for (const instance of save.ownedMods) {
    const match = /^m(\d+)$/.exec(instance.id);
    if (!match) continue;
    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isNaN(parsed)) {
      maxId = Math.max(maxId, parsed);
    }
  }
  const next = Math.max(save.nextModInstanceId ?? 1, maxId + 1);
  save.nextModInstanceId = next;
};

const findFirstCompatibleMount = (
  ship: ShipDefinition,
  weapon: WeaponDefinition,
  assignments: MountAssignment[],
): MountAssignment | null => {
  const preferred = ship.mounts.find((mount) => canMountWeapon(weapon, mount));
  if (!preferred) return null;
  return assignments.find((entry) => entry.mountId === preferred.id) ?? null;
};

const normalizeMountedWeapons = (save: SaveData): void => {
  const cleaned: Record<string, MountAssignment[]> = {};
  for (const [shipId, ship] of Object.entries(SHIPS)) {
    const usedWithinShip = new Set<WeaponInstanceId>();
    const assignments =
      save.mountedWeapons[shipId] ?? buildMountAssignments(ship);
    const normalized: MountAssignment[] = [];

    for (const mount of ship.mounts) {
      const entry = assignments.find((item) => item.mountId === mount.id);
      const instanceId = entry?.weaponInstanceId ?? null;

      if (!instanceId || usedWithinShip.has(instanceId)) {
        normalized.push({
          modInstanceIds: [],
          mountId: mount.id,
          weaponInstanceId: null,
        });
        continue;
      }

      const instance = save.ownedWeapons.find((item) => item.id === instanceId);
      const weapon = instance ? getWeaponDefinition(instance.weaponId) : null;
      if (!weapon || !canMountWeapon(weapon, mount)) {
        normalized.push({
          modInstanceIds: [],
          mountId: mount.id,
          weaponInstanceId: null,
        });
        continue;
      }

      usedWithinShip.add(instanceId);
      const modIds = Array.isArray(entry?.modInstanceIds)
        ? entry.modInstanceIds
        : [];
      const modInstances: ModInstance[] = [];
      const usedModInstances = new Set<ModInstanceId>();
      for (const modInstanceId of modIds) {
        if (usedModInstances.has(modInstanceId)) continue;
        const modInstance = save.ownedMods.find(
          (item) => item.id === modInstanceId,
        );
        const mod = modInstance ? getModDefinition(modInstance.modId) : null;
        if (!mod || !modInstance) continue;
        usedModInstances.add(modInstanceId);
        modInstances.push(modInstance);
      }

      const uniqueByType = normalizeMountMods(
        modInstances
          .map((instance) => getModDefinition(instance.modId))
          .filter((mod): mod is ModDefinition => Boolean(mod)),
      );
      const modInstancesByType = uniqueByType
        .map((mod) =>
          modInstances.find((instance) => instance.modId === mod.id),
        )
        .filter((instance): instance is ModInstance => Boolean(instance));

      normalized.push({
        modInstanceIds: modInstancesByType
          .slice(0, mount.modSlots)
          .map((instance) => instance.id),
        mountId: mount.id,
        weaponInstanceId: instanceId,
      });
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
  if (assignment) {
    assignment.weaponInstanceId = instance.id;
    assignment.modInstanceIds = [];
  }
};

const normalizeResources = (save: SaveData): void => {
  const normalized: Record<ResourceId, number> = {};
  const source = save.resources ?? {};
  for (const [resourceId, amount] of Object.entries(source)) {
    const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    normalized[resourceId] = safeAmount;
  }
  normalized[GOLD_RESOURCE_ID] = normalized[GOLD_RESOURCE_ID] ?? 0;
  save.resources = normalized;
};

const normalizeUnlocks = (save: SaveData): void => {
  const unlocks = new Set<UnlockId>();
  for (const unlockId of save.unlocks ?? []) {
    if (!unlockId || typeof unlockId !== "string") continue;
    unlocks.add(unlockId);
  }
  save.unlocks = [...unlocks];
};

const normalizeClaimedObjectives = (save: SaveData): void => {
  const claimed = new Set<string>();
  for (const objectiveId of save.claimedObjectiveIds ?? []) {
    if (!objectiveId || typeof objectiveId !== "string") continue;
    claimed.add(objectiveId);
  }
  save.claimedObjectiveIds = [...claimed];
};

const normalizeLevelStars = (save: SaveData): void => {
  const levels = getLevels();
  const normalized: Record<string, number> = {};
  for (const [levelId, stars] of Object.entries(save.levelStars ?? {})) {
    if (!levels[levelId]) continue;
    const safeStars = Number.isFinite(stars)
      ? Math.max(0, Math.min(3, Math.round(stars)))
      : 0;
    normalized[levelId] = safeStars;
  }
  save.levelStars = normalized;
};

const compareWeaponInstancesByPower = (
  a: WeaponInstance,
  b: WeaponInstance,
): number => {
  const aWeapon = getWeaponDefinition(a.weaponId);
  const bWeapon = getWeaponDefinition(b.weaponId);
  if (!aWeapon && !bWeapon) return 0;
  if (!aWeapon) return 1;
  if (!bWeapon) return -1;
  if (bWeapon.cost !== aWeapon.cost) return bWeapon.cost - aWeapon.cost;
  return aWeapon.name.localeCompare(bWeapon.name);
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
  normalizeResources(cached);
  normalizeUnlocks(cached);
  normalizeClaimedObjectives(cached);
  cached.ownedWeapons = cached.ownedWeapons.filter(
    (item) => WEAPONS[item.weaponId],
  );
  normalizeOwnedWeapons(cached);
  cached.ownedMods = cached.ownedMods.filter((item) => MODS[item.modId]);
  if (cached.ownedWeapons.length === 0 && WEAPONS[STARTER_WEAPON_ID]) {
    createWeaponInstance(cached, STARTER_WEAPON_ID);
  }
  normalizeNextWeaponInstanceId(cached);
  normalizeNextModInstanceId(cached);
  normalizeMountedWeapons(cached);
  normalizeLevelStars(cached);
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
  normalizeOwnedWeapons(save);
  normalizeResources(save);
  normalizeUnlocks(save);
  normalizeClaimedObjectives(save);
  normalizeLevelStars(save);
  normalizeMountedWeapons(save);
  if (!options?.allowEmptyLoadout) {
    ensureDefaultLoadout(save);
  }
  persistSave(save);
  return save;
}

export const getResourceAmount = (
  save: SaveData,
  resourceId: ResourceId,
): number => {
  const value = save.resources[resourceId] ?? 0;
  return Number.isFinite(value) ? Math.max(0, value) : 0;
};

export const addResourceInSave = (
  save: SaveData,
  resourceId: ResourceId,
  amount: number,
): void => {
  if (!Number.isFinite(amount) || amount <= 0) return;
  save.resources[resourceId] = getResourceAmount(save, resourceId) + amount;
};

export const spendResourceInSave = (
  save: SaveData,
  resourceId: ResourceId,
  amount: number,
): boolean => {
  if (!Number.isFinite(amount) || amount <= 0) return true;
  const balance = getResourceAmount(save, resourceId);
  if (balance < amount) return false;
  save.resources[resourceId] = balance - amount;
  return true;
};

export const hasUnlock = (save: SaveData, unlockId: UnlockId): boolean =>
  save.unlocks.includes(unlockId);

export const hasRequiredUnlocks = (
  save: SaveData,
  required: undefined | UnlockId[],
): boolean => {
  if (!required || required.length === 0) return true;
  return required.every((unlockId) => hasUnlock(save, unlockId));
};

export const getMissingUnlocks = (
  save: SaveData,
  required: undefined | UnlockId[],
): UnlockId[] => {
  if (!required || required.length === 0) return [];
  return required.filter((unlockId) => !hasUnlock(save, unlockId));
};

export const grantUnlockInSave = (save: SaveData, unlockId: UnlockId): void => {
  if (!unlockId) return;
  if (save.unlocks.includes(unlockId)) return;
  save.unlocks = [...save.unlocks, unlockId];
};

export const applyRewardBundleInSave = (
  save: SaveData,
  reward: RewardBundle | undefined,
): void => {
  if (!reward) return;
  if (reward.resources) {
    for (const [resourceId, amount] of Object.entries(reward.resources)) {
      if (!Number.isFinite(amount) || amount <= 0) continue;
      addResourceInSave(save, resourceId, amount);
    }
  }
  for (const unlockId of reward.unlocks ?? []) {
    grantUnlockInSave(save, unlockId);
  }
};

export function bankGold(amount: number): SaveData {
  return mutateSave((data) => {
    addResourceInSave(data, GOLD_RESOURCE_ID, Math.max(0, amount));
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

    const rawMods = assignment.modInstanceIds
      .map((modInstanceId) =>
        save.ownedMods.find((instance) => instance.id === modInstanceId),
      )
      .filter((instance): instance is ModInstance => Boolean(instance))
      .map((instance) => getModDefinition(instance.modId))
      .filter((mod): mod is ModDefinition => Boolean(mod));
    const mods = normalizeMountMods(rawMods).slice(0, mount.modSlots);
    const stats = resolveWeaponStatsWithMods(weapon, mods);

    mounted.push({
      instanceId: instance.id,
      mods,
      mount,
      stats,
      weapon,
    });
  }
  return mounted;
}

export const autoAttachWeaponsForShipInSave = (
  save: SaveData,
  ship: ShipDefinition,
  preferredWeaponInstanceIds: WeaponInstanceId[] = [],
): void => {
  const assignments =
    save.mountedWeapons[ship.id] ?? buildMountAssignments(ship);
  save.mountedWeapons[ship.id] = assignments;

  const assignmentByMountId = new Map(
    assignments.map((entry) => [entry.mountId, entry]),
  );
  for (const mount of ship.mounts) {
    if (assignmentByMountId.has(mount.id)) continue;
    const entry: MountAssignment = {
      modInstanceIds: [],
      mountId: mount.id,
      weaponInstanceId: null,
    };
    assignments.push(entry);
    assignmentByMountId.set(mount.id, entry);
  }

  const instanceById = new Map(
    save.ownedWeapons.map((instance) => [instance.id, instance]),
  );
  const orderedIds: WeaponInstanceId[] = [];
  const usedOrderIds = new Set<WeaponInstanceId>();
  for (const preferredId of preferredWeaponInstanceIds) {
    if (usedOrderIds.has(preferredId)) continue;
    if (!instanceById.has(preferredId)) continue;
    usedOrderIds.add(preferredId);
    orderedIds.push(preferredId);
  }

  const ranked = [...save.ownedWeapons].sort(compareWeaponInstancesByPower);
  for (const instance of ranked) {
    if (usedOrderIds.has(instance.id)) continue;
    usedOrderIds.add(instance.id);
    orderedIds.push(instance.id);
  }

  const assignedWeaponIds = new Set<WeaponInstanceId>();
  for (const mount of ship.mounts) {
    const entry = assignmentByMountId.get(mount.id);
    if (!entry) continue;
    entry.weaponInstanceId = null;
    entry.modInstanceIds = [];
    for (const instanceId of orderedIds) {
      if (assignedWeaponIds.has(instanceId)) continue;
      const instance = instanceById.get(instanceId);
      if (!instance) continue;
      const weapon = getWeaponDefinition(instance.weaponId);
      if (!weapon || !canMountWeapon(weapon, mount)) continue;
      entry.weaponInstanceId = instance.id;
      assignedWeaponIds.add(instance.id);
      break;
    }
  }
};

export const createModInstanceInSave = (
  save: SaveData,
  modId: ModId,
): ModInstance => createModInstance(save, modId);

export const createWeaponInstanceInSave = (
  save: SaveData,
  weaponId: WeaponId,
): WeaponInstance => createWeaponInstance(save, weaponId);
