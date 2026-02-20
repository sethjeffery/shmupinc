import type { ModInstanceId } from "../../data/modInstances";
import type { ModId } from "../../data/mods";
import type { MountAssignment, SaveData } from "../../data/save";
import type { ShipDefinition, ShipId } from "../../data/ships";
import type { WeaponInstanceId } from "../../data/weaponInstances";
import type { WeaponId } from "../../data/weapons";

import { MODS } from "../../data/mods";
import {
  autoAttachWeaponsForShipInSave,
  createModInstanceInSave,
  createWeaponInstanceInSave,
  hasRequiredUnlocks,
  spendResourceInSave,
} from "../../data/save";
import { SHIPS } from "../../data/ships";
import { canMountWeapon } from "../../data/weaponMounts";
import { WEAPONS } from "../../data/weapons";
import { ensureMountAssignments } from "../../ui/shop/utils/weapons";

const PRIMARY_RESOURCE_ID = "gold";

interface ModMountPayload {
  instanceId: ModInstanceId;
  sourceMountId?: string;
}

interface WeaponMountPayload {
  instanceId: WeaponInstanceId;
  sourceMountId?: string;
}

const getSelectedShipAssignments = (
  save: SaveData,
): { assignments: MountAssignment[]; ship: ShipDefinition } | null => {
  const ship = SHIPS[save.selectedShipId];
  if (!ship) return null;
  return {
    assignments: ensureMountAssignments(save.mountedWeapons, ship),
    ship,
  };
};

export const selectOrPurchaseShipInSave = (
  save: SaveData,
  shipId: ShipId,
  canPurchase: boolean,
): void => {
  const ship = SHIPS[shipId];
  if (!ship) return;

  const owned = save.unlockedShips.includes(shipId);
  if (!owned) {
    if (!hasRequiredUnlocks(save, ship.requiresUnlocks)) return;
    if (!canPurchase) return;

    const selectedShip = SHIPS[save.selectedShipId];
    const selectedAssignments = selectedShip
      ? ensureMountAssignments(save.mountedWeapons, selectedShip)
      : [];
    const preferredWeaponIds = selectedAssignments
      .map((entry) => entry.weaponInstanceId)
      .filter((instanceId): instanceId is WeaponInstanceId =>
        Boolean(instanceId),
      );

    const resourceId = ship.costResource ?? PRIMARY_RESOURCE_ID;
    if (!spendResourceInSave(save, resourceId, ship.cost)) return;

    save.unlockedShips = [...save.unlockedShips, shipId];
    autoAttachWeaponsForShipInSave(save, ship, preferredWeaponIds);
  }

  save.selectedShipId = shipId;
};

export const purchaseWeaponInSave = (
  save: SaveData,
  weaponId: WeaponId,
): void => {
  const weapon = WEAPONS[weaponId];
  if (!weapon) return;

  const owned = save.ownedWeapons.some(
    (instance) => instance.weaponId === weaponId,
  );
  if (owned) return;
  if (!hasRequiredUnlocks(save, weapon.requiresUnlocks)) return;

  const resourceId = weapon.costResource ?? PRIMARY_RESOURCE_ID;
  if (!spendResourceInSave(save, resourceId, weapon.cost)) return;

  createWeaponInstanceInSave(save, weaponId);
};

export const purchaseModInSave = (save: SaveData, modId: ModId): void => {
  const mod = MODS[modId];
  if (!mod) return;

  const owned = save.ownedMods.some((instance) => instance.modId === modId);
  if (owned) return;
  if (!hasRequiredUnlocks(save, mod.requiresUnlocks)) return;

  const resourceId = mod.costResource ?? PRIMARY_RESOURCE_ID;
  if (!spendResourceInSave(save, resourceId, mod.cost)) return;

  createModInstanceInSave(save, modId);
};

export const detachWeaponFromMountInSave = (
  save: SaveData,
  mountId: string,
): void => {
  const selected = getSelectedShipAssignments(save);
  if (!selected) return;

  const entry = selected.assignments.find((item) => item.mountId === mountId);
  if (!entry) return;

  entry.weaponInstanceId = null;
  entry.modInstanceIds = [];
};

export const assignWeaponToMountInSave = (
  save: SaveData,
  payload: WeaponMountPayload,
  mountId: string,
): void => {
  if (payload.sourceMountId && payload.sourceMountId === mountId) return;

  const selected = getSelectedShipAssignments(save);
  if (!selected) return;

  const target = selected.assignments.find((item) => item.mountId === mountId);
  if (!target) return;

  const instance = save.ownedWeapons.find(
    (item) => item.id === payload.instanceId,
  );
  if (!instance) return;

  const weapon = WEAPONS[instance.weaponId];
  const mount = selected.ship.mounts.find((entry) => entry.id === mountId);
  if (!weapon || !mount) return;
  if (!canMountWeapon(weapon, mount)) return;

  for (const entry of selected.assignments) {
    if (entry.weaponInstanceId === payload.instanceId) {
      entry.weaponInstanceId = null;
    }
  }

  if (payload.sourceMountId) {
    const source = selected.assignments.find(
      (item) => item.mountId === payload.sourceMountId,
    );
    const swapped = target.weaponInstanceId;
    target.weaponInstanceId = payload.instanceId;
    if (source) {
      source.weaponInstanceId = swapped ?? null;
    }
    return;
  }

  target.weaponInstanceId = payload.instanceId;
};

export const assignModToMountInSave = (
  save: SaveData,
  payload: ModMountPayload,
  mountId: string,
): null | number => {
  const selected = getSelectedShipAssignments(save);
  if (!selected) return null;

  const target = selected.assignments.find((item) => item.mountId === mountId);
  const mount = selected.ship.mounts.find((entry) => entry.id === mountId);
  if (!target || !mount || !target.weaponInstanceId) return null;

  const modInstance = save.ownedMods.find(
    (item) => item.id === payload.instanceId,
  );
  const mod = modInstance ? MODS[modInstance.modId] : null;
  if (!mod) return null;

  if (target.modInstanceIds.includes(payload.instanceId)) return null;

  const hasSameType = target.modInstanceIds.some((instanceId) => {
    const existing = save.ownedMods.find((item) => item.id === instanceId);
    const existingMod = existing ? MODS[existing.modId] : null;
    return existingMod?.iconKind === mod.iconKind;
  });
  if (hasSameType) return null;
  if (target.modInstanceIds.length >= (mount.modSlots ?? 0)) return null;

  for (const entry of selected.assignments) {
    entry.modInstanceIds = entry.modInstanceIds.filter(
      (instanceId) => instanceId !== payload.instanceId,
    );
  }

  target.modInstanceIds = [...target.modInstanceIds, payload.instanceId];
  return Math.max(0, target.modInstanceIds.length - 1);
};

export const clearModSlotInSave = (
  save: SaveData,
  mountId: string,
  slotIndex: number,
): void => {
  const selected = getSelectedShipAssignments(save);
  if (!selected) return;

  const mount = selected.ship.mounts.find((entry) => entry.id === mountId);
  if (!mount) return;

  const entry = selected.assignments.find((item) => item.mountId === mountId);
  if (!entry) return;
  if (slotIndex < 0 || slotIndex >= entry.modInstanceIds.length) return;

  entry.modInstanceIds.splice(slotIndex, 1);
  entry.modInstanceIds = entry.modInstanceIds.slice(0, mount.modSlots);
};

export const assignModToSlotInSave = (
  save: SaveData,
  mountId: string,
  slotIndex: number,
  modInstanceId: ModInstanceId,
): void => {
  const selected = getSelectedShipAssignments(save);
  if (!selected) return;

  const mount = selected.ship.mounts.find((entry) => entry.id === mountId);
  if (!mount || mount.modSlots <= 0) return;

  const entry = selected.assignments.find((item) => item.mountId === mountId);
  if (!entry?.weaponInstanceId) return;

  const modInstance = save.ownedMods.find((item) => item.id === modInstanceId);
  const mod = modInstance ? MODS[modInstance.modId] : null;
  if (!mod) return;

  for (const assignment of selected.assignments) {
    assignment.modInstanceIds = assignment.modInstanceIds.filter(
      (instanceId) => instanceId !== modInstanceId,
    );
  }

  const maxSlots = Math.max(0, mount.modSlots);
  const targetIndex = Math.min(
    Math.max(0, slotIndex),
    Math.max(0, maxSlots - 1),
  );
  const current = [...entry.modInstanceIds].slice(0, maxSlots);
  if (targetIndex < current.length) {
    current.splice(targetIndex, 1);
  }

  const sameTypeIndex = current.findIndex((instanceId) => {
    const existing = save.ownedMods.find((item) => item.id === instanceId);
    const existingMod = existing ? MODS[existing.modId] : null;
    return existingMod?.iconKind === mod.iconKind;
  });
  if (sameTypeIndex >= 0) {
    current.splice(sameTypeIndex, 1);
  }

  const insertIndex = Math.min(targetIndex, current.length);
  current.splice(insertIndex, 0, modInstanceId);
  entry.modInstanceIds = current.slice(0, maxSlots);
};
