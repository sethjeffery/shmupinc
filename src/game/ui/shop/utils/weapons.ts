import type { ShopRules } from "../../../data/levels";
import type { MountAssignment, WeaponInstance } from "../../../data/save";
import type { ShipDefinition } from "../../../data/shipTypes";
import type { WeaponDefinition, WeaponId } from "../../../data/weaponTypes";

import { filterShopItems } from "../../../data/shopRules";
import { canMountWeapon, resolveWeaponStats } from "../../../data/weaponMounts";
import { WEAPONS } from "../../../data/weapons";
import { normalizeMetric } from "./metrics";

interface WeaponPreviewStat {
  fill: number;
  label: "Damage" | "Speed";
}

export function getWeaponPreviewStats(
  weapon: WeaponDefinition,
): WeaponPreviewStat[] {
  const allWeapons = Object.values(WEAPONS).map((entry) =>
    resolveWeaponStats(entry),
  );
  const resolved = resolveWeaponStats(weapon);
  const damageValues = allWeapons.map((entry) => {
    const shots = Math.max(1, entry.shots?.length ?? 1);
    return Math.max(0, entry.bullet.damage * shots);
  });
  const speedValues = allWeapons.map((entry) => Math.max(0, entry.speed));
  const damageValue =
    Math.max(0, resolved.bullet.damage) *
    Math.max(1, resolved.shots?.length ?? 1);
  const speedValue = Math.max(0, resolved.speed);
  return [
    {
      fill: normalizeMetric(
        damageValue,
        Math.min(...damageValues),
        Math.max(...damageValues),
      ),
      label: "Damage",
    },
    {
      fill: normalizeMetric(
        speedValue,
        Math.min(...speedValues),
        Math.max(...speedValues),
      ),
      label: "Speed",
    },
  ];
}

export function getFilteredWeapons(
  shopRules?: ShopRules,
): (typeof WEAPONS)[WeaponId][] {
  const weapons = Object.values(WEAPONS);
  return filterShopItems(
    weapons,
    shopRules,
    shopRules?.allowedWeapons,
    shopRules?.caps?.weaponCost,
  );
}

export function getVisibleWeapons(
  ownedWeapons: WeaponInstance[],
  shopRules?: ShopRules,
): WeaponDefinition[] {
  if (!shopRules) return Object.values(WEAPONS);
  const byId = new Map<string, WeaponDefinition>();
  for (const weapon of getFilteredWeapons(shopRules)) {
    byId.set(weapon.id, weapon);
  }
  for (const instance of ownedWeapons) {
    const weapon = WEAPONS[instance.weaponId];
    if (weapon) byId.set(weapon.id, weapon);
  }
  return [...byId.values()];
}

export function ensureMountAssignments(
  mountedWeapons: Record<string, MountAssignment[]>,
  ship: ShipDefinition,
): MountAssignment[] {
  if (!mountedWeapons[ship.id]) {
    mountedWeapons[ship.id] = ship.mounts.map((mount) => ({
      modInstanceIds: [],
      mountId: mount.id,
      weaponInstanceId: null,
    }));
  }
  return mountedWeapons[ship.id];
}

function getAssignmentsForShip(
  ship: ShipDefinition,
  mountedWeapons: Record<string, MountAssignment[]>,
): MountAssignment[] {
  return (
    mountedWeapons[ship.id] ?? ensureMountAssignments(mountedWeapons, ship)
  );
}

export function isWeaponEquipped(
  ship: ShipDefinition,
  weaponId: string,
  mountedWeapons: Record<string, MountAssignment[]>,
  ownedWeapons: WeaponInstance[],
): boolean {
  const assignments = getAssignmentsForShip(ship, mountedWeapons);
  return assignments.some((assignment) => {
    if (!assignment.weaponInstanceId) return false;
    const instance = ownedWeapons.find(
      (entry) => entry.id === assignment.weaponInstanceId,
    );
    return instance?.weaponId === weaponId;
  });
}

export function getEmptyWeaponStats(): WeaponPreviewStat[] {
  return [
    { fill: 0, label: "Damage" },
    { fill: 0, label: "Speed" },
  ];
}

export function canWeaponFitShip(
  weapon: undefined | WeaponDefinition,
  ship: ShipDefinition,
): boolean {
  return Boolean(
    weapon && ship.mounts.some((mount) => canMountWeapon(weapon, mount)),
  );
}

export function getWeaponSizeLabel(weapon: WeaponDefinition): string {
  return weapon.size === "large" ? "Large" : "Small";
}
