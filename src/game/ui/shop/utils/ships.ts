import type { ShopRules } from "../../../data/levels";
import type { SaveData } from "../../../data/save";
import type { ShipDefinition, ShipId } from "../../../data/ships";

import { hasRequiredUnlocks } from "../../../data/save";
import { SHIPS } from "../../../data/ships";
import { filterShopItems } from "../../../data/shopRules";
import { normalizeMetric } from "./metrics";

interface ShipPreviewStat {
  fill: number;
  label: "Armor" | "Magnet" | "Speed" | "Weaponry";
}

export function getFilteredShips(
  shopRules?: ShopRules,
): (typeof SHIPS)[ShipId][] {
  const ships = Object.values(SHIPS);
  return filterShopItems(
    ships,
    shopRules,
    shopRules?.allowedShips,
    shopRules?.caps?.shipCost,
  );
}

export function getVisibleShips(
  save: SaveData,
  shopRules?: ShopRules,
): ShipDefinition[] {
  const ships = Object.values(SHIPS);
  if (!shopRules) return ships;

  const allowedIds = new Set(
    getFilteredShips(shopRules).map((ship) => ship.id),
  );
  const ownedIds = new Set(save.unlockedShips);
  const selectedId = save.selectedShipId;

  return ships.filter(
    (ship) =>
      allowedIds.has(ship.id) ||
      ownedIds.has(ship.id) ||
      ship.id === selectedId,
  );
}

export function getShipPreviewStats(ship: ShipDefinition): ShipPreviewStat[] {
  const allShips = Object.values(SHIPS);
  const hpValues = allShips.map((entry) => entry.maxHp);
  const thrustValues = allShips.map((entry) => entry.moveSpeed);
  const magnetValues = allShips.map((entry) => entry.magnetMultiplier ?? 1);
  const weaponryValues = allShips.map((entry) => getShipWeaponryScore(entry));
  const weaponryScore = getShipWeaponryScore(ship);

  return [
    {
      fill: normalizeMetric(
        ship.maxHp,
        Math.min(...hpValues),
        Math.max(...hpValues),
      ),
      label: "Armor",
    },
    {
      fill: normalizeMetric(
        ship.moveSpeed,
        Math.min(...thrustValues),
        Math.max(...thrustValues),
      ),
      label: "Speed",
    },
    {
      fill: normalizeMetric(
        ship.magnetMultiplier ?? 1,
        Math.min(...magnetValues),
        Math.max(...magnetValues),
      ),
      label: "Magnet",
    },
    {
      fill: normalizeMetric(
        weaponryScore,
        Math.min(...weaponryValues),
        Math.max(...weaponryValues),
      ),
      label: "Weaponry",
    },
  ];
}

export function canShowShipInShop(
  save: SaveData,
  ship: ShipDefinition,
): boolean {
  const owned = save.unlockedShips.includes(ship.id);
  return owned || hasRequiredUnlocks(save, ship.requiresUnlocks);
}

function getShipWeaponryScore(ship: ShipDefinition): number {
  const mountCount = ship.mounts.length;
  const modSlotCount = ship.mounts.reduce(
    (sum, mount) => sum + Math.max(0, mount.modSlots),
    0,
  );
  return mountCount + modSlotCount;
}
