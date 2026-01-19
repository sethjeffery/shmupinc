import type { SecondaryWeaponId } from './secondaryWeapons';
import type { ShipId } from './ships';
import type { WeaponId } from './weapons';

import { SECONDARY_WEAPONS } from './secondaryWeapons';
import { SHIPS, STARTER_SHIP_ID } from './ships';
import { STARTER_WEAPON_ID, WEAPONS } from './weapons';

const STORAGE_KEY = 'shmupinc-save-v1';

export const BASE_HP = 6;

export interface SaveData {
  gold: number;
  unlockedWeapons: WeaponId[];
  selectedWeaponId: WeaponId;
  unlockedSecondaryWeapons: SecondaryWeaponId[];
  selectedSecondaryWeaponId: null | SecondaryWeaponId;
  unlockedShips: ShipId[];
  selectedShipId: ShipId;
}

const defaultSave: SaveData = {
  gold: 0,
  selectedSecondaryWeaponId: null,
  selectedShipId: STARTER_SHIP_ID,
  selectedWeaponId: STARTER_WEAPON_ID,
  unlockedSecondaryWeapons: [],
  unlockedShips: [STARTER_SHIP_ID],
  unlockedWeapons: [STARTER_WEAPON_ID],
};

let cached: null | SaveData = null;

function getStorage(): null | Storage {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

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
  if (!cached.unlockedWeapons.includes(cached.selectedWeaponId)) {
    cached.unlockedWeapons = [...cached.unlockedWeapons, cached.selectedWeaponId];
  }
  if (!cached.unlockedSecondaryWeapons) cached.unlockedSecondaryWeapons = [];
  if (typeof cached.selectedSecondaryWeaponId === 'undefined') cached.selectedSecondaryWeaponId = null;
  if (cached.selectedSecondaryWeaponId && !SECONDARY_WEAPONS[cached.selectedSecondaryWeaponId]) {
    cached.selectedSecondaryWeaponId = null;
  }
  if (
    cached.selectedSecondaryWeaponId
    && !cached.unlockedSecondaryWeapons.includes(cached.selectedSecondaryWeaponId)
  ) {
    cached.unlockedSecondaryWeapons = [
      ...cached.unlockedSecondaryWeapons,
      cached.selectedSecondaryWeaponId,
    ];
  }
  if (!cached.unlockedShips.includes(cached.selectedShipId)) {
    cached.unlockedShips = [...cached.unlockedShips, cached.selectedShipId];
  }
  return { ...cached };
}

export function persistSave(data: SaveData): void {
  cached = { ...data };
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(cached));
}

export function mutateSave(mutator: (data: SaveData) => void): SaveData {
  const save = loadSave();
  mutator(save);
  persistSave(save);
  return save;
}

export function bankGold(amount: number): SaveData {
  return mutateSave((data) => {
    data.gold += Math.max(0, amount);
  });
}

export function computePlayerStats(baseHp: number = BASE_HP): {
  ship: (typeof SHIPS)[ShipId];
  weapon: (typeof WEAPONS)[WeaponId];
  secondaryWeapon: (typeof SECONDARY_WEAPONS)[SecondaryWeaponId] | null;
  save: SaveData;
} {
  const save = loadSave();
  const ship = SHIPS[save.selectedShipId] ?? SHIPS[STARTER_SHIP_ID];
  const weapon = WEAPONS[save.selectedWeaponId] ?? WEAPONS[STARTER_WEAPON_ID];
  const secondaryWeapon =
    save.selectedSecondaryWeaponId && SECONDARY_WEAPONS[save.selectedSecondaryWeaponId]
      ? SECONDARY_WEAPONS[save.selectedSecondaryWeaponId]
      : null;
  const fallbackHp = ship.maxHp || baseHp;
  return { save, secondaryWeapon, ship: { ...ship, maxHp: fallbackHp }, weapon };
}
