import type { ModInstanceId } from "../../data/modInstances";
import type { MountAssignment, SaveData } from "../../data/save";
import type { ShipDefinition } from "../../data/shipTypes";
import type { WeaponInstanceId } from "../../data/weaponInstances";

import { MODS } from "../../data/mods";
import { canMountWeapon } from "../../data/weaponMounts";
import { WEAPONS } from "../../data/weapons";

type DragEligibilityPayload =
  | {
      kind: "mod";
      instanceId: ModInstanceId;
    }
  | {
      kind: "weapon";
      instanceId: WeaponInstanceId;
    };

export const getEligibleMountIdsForDrag = (
  save: SaveData,
  ship: ShipDefinition,
  assignments: MountAssignment[],
  payload: DragEligibilityPayload | null,
): Set<string> => {
  if (!payload) return new Set<string>();

  const assignmentById = new Map(
    assignments.map((entry) => [entry.mountId, entry]),
  );

  const eligibleMounts = new Set<string>();
  if (payload.kind === "weapon") {
    const instance = save.ownedWeapons.find(
      (item) => item.id === payload.instanceId,
    );
    const weapon = instance ? WEAPONS[instance.weaponId] : null;
    if (!weapon) return eligibleMounts;

    for (const mount of ship.mounts) {
      if (canMountWeapon(weapon, mount)) {
        eligibleMounts.add(mount.id);
      }
    }
    return eligibleMounts;
  }

  const modInstance = save.ownedMods.find(
    (item) => item.id === payload.instanceId,
  );
  const mod = modInstance ? MODS[modInstance.modId] : null;
  if (!mod) return eligibleMounts;

  for (const mount of ship.mounts) {
    const assignment = assignmentById.get(mount.id);
    if (!assignment?.weaponInstanceId) continue;

    if (assignment.modInstanceIds.includes(payload.instanceId)) {
      eligibleMounts.add(mount.id);
      continue;
    }
    if (assignment.modInstanceIds.length >= (mount.modSlots ?? 0)) continue;

    const hasSameType = assignment.modInstanceIds.some((modInstanceId) => {
      const existingInstance = save.ownedMods.find(
        (item) => item.id === modInstanceId,
      );
      const existing = existingInstance ? MODS[existingInstance.modId] : null;
      return existing?.iconKind === mod.iconKind;
    });
    if (!hasSameType) {
      eligibleMounts.add(mount.id);
    }
  }

  return eligibleMounts;
};
