import type { ShopRules } from "../../../data/levels";
import type { ModDefinition, ModId } from "../../../data/modTypes";
import type { MountAssignment, ModInstance } from "../../../data/save";
import type { ShipDefinition } from "../../../data/shipTypes";

import { MODS } from "../../../data/mods";
import { filterShopItems } from "../../../data/shopRules";

export function getModAccentColor(iconKind: ModDefinition["iconKind"]): number {
  switch (iconKind) {
    case "aoe":
      return 0xff5f57;
    case "bounce":
      return 0x7df9ff;
    case "homing":
      return 0x6df2ff;
    case "multi":
      return 0xb794ff;
    case "power":
      return 0xffd166;
    default:
      return 0x7df9ff;
  }
}

export function getFilteredMods(shopRules?: ShopRules): (typeof MODS)[ModId][] {
  const mods = Object.values(MODS);
  return filterShopItems(
    mods,
    shopRules,
    shopRules?.allowedMods,
    shopRules?.caps?.modCost,
  );
}

export function getVisibleMods(
  ownedMods: ModInstance[],
  shopRules?: ShopRules,
): ModDefinition[] {
  if (!shopRules) return Object.values(MODS);
  const byId = new Map<string, ModDefinition>();

  for (const mod of getFilteredMods(shopRules)) {
    byId.set(mod.id, mod);
  }
  for (const instance of ownedMods) {
    const mod = MODS[instance.modId];
    if (mod) byId.set(mod.id, mod);
  }

  return [...byId.values()];
}

export function isModEquipped(
  ship: ShipDefinition,
  modId: string,
  mountedWeapons: Record<string, MountAssignment[]>,
  ownedMods: ModInstance[],
): boolean {
  const assignments = mountedWeapons[ship.id] ?? [];
  return assignments.some((assignment) =>
    assignment.modInstanceIds.some((instanceId) => {
      const instance = ownedMods.find((entry) => entry.id === instanceId);
      return instance?.modId === modId;
    }),
  );
}

export function describeModEffectTags(mod: ModDefinition): string[] {
  const tags: string[] = [];
  if (mod.effects.homing) tags.push("Homing");
  if (mod.effects.aoe) tags.push("Explosive");
  if (mod.effects.multi) tags.push("Multi-shot");
  if (mod.effects.damageMultiplier) {
    const delta = Math.round((mod.effects.damageMultiplier - 1) * 100);
    if (delta !== 0) {
      tags.push(`Damage ${delta >= 0 ? "+" : ""}${delta}%`);
    }
  }
  if (mod.effects.bounce) tags.push("Ricochet");
  return tags;
}
