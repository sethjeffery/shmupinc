import type { ComponentChildren } from "preact";

export type ShopMarketItemKind = "mod" | "ship" | "weapon";

export interface ShopMarketAreaItem {
  accentColor: number;
  costLabel: null | string;
  equipped: boolean;
  id: string;
  kind: ShopMarketItemKind;
  name: string;
  owned: boolean;
}

export type ShopMarketItemIconRenderer = (
  item: ShopMarketAreaItem,
) => ComponentChildren;
