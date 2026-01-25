import type { ShopRules } from "./levels";

export interface PricedItem {
  id: string;
  cost: number;
}

export function filterShopItems<T extends PricedItem>(
  items: T[],
  rules: null | ShopRules,
  allowed: string[] | undefined,
  cap: number | undefined,
): T[] {
  let filtered = items;
  if (rules && allowed && allowed.length > 0) {
    const allowSet = new Set(allowed);
    filtered = filtered.filter((item) => allowSet.has(item.id));
  }
  if (rules && typeof cap === "number") {
    filtered = filtered.filter((item) => item.cost <= cap);
  }
  return filtered.length > 0 ? filtered : items;
}

export function pickAllowedId<T extends { id: string }>(
  currentId: null | string,
  items: T[],
  options?: { allowNull?: boolean },
): null | string {
  if (items.length === 0) return currentId;
  if (currentId && items.some((item) => item.id === currentId)) {
    return currentId;
  }
  if (!currentId && options?.allowNull) return null;
  return items[0].id;
}
