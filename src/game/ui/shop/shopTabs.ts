import type { CardIconKind } from "./iconPainter";

export type ShopCategory = "loadout" | "mods" | "ships" | "weapons";

type ShopTabAction = "show-mods" | "show-ships" | "show-weapons";

interface ShopTabDef {
  action: ShopTabAction;
  category: ShopCategory;
  description: string;
  icon: CardIconKind;
  label: string;
  title: string;
}

export const SHOP_TABS: readonly ShopTabDef[] = [
  {
    action: "show-ships",
    category: "ships",
    description: "Select and preview ships.",
    icon: "ship",
    label: "Ship",
    title: "Ship",
  },
  {
    action: "show-weapons",
    category: "weapons",
    description: "Browse and test weapons.",
    icon: "weapon",
    label: "Weapons",
    title: "Weapons",
  },
  {
    action: "show-mods",
    category: "mods",
    description: "Browse and apply mods.",
    icon: "mod",
    label: "Mods",
    title: "Mods",
  },
] as const;

export const DEFAULT_SHOP_CATEGORY: ShopCategory = "loadout";
