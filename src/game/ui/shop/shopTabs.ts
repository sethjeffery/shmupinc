export type ShopCategory = "armory" | "loadout" | "ships";

export type ShopTabAction = "show-armory" | "show-loadout" | "show-ships";

interface ShopTabDef {
  action: ShopTabAction;
  category: ShopCategory;
  description: string;
  icon: "mount" | "ship" | "weapon";
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
    action: "show-armory",
    category: "armory",
    description: "Browse weapons and mods.",
    icon: "weapon",
    label: "Weapons",
    title: "Weapons",
  },
  {
    action: "show-loadout",
    category: "loadout",
    description: "Adjust mounted gear.",
    icon: "mount",
    label: "Loadout",
    title: "Loadout",
  },
] as const;

export const SHOP_CATEGORY_BY_ACTION: Readonly<
  Record<ShopTabAction, ShopCategory>
> = {
  "show-armory": "armory",
  "show-loadout": "loadout",
  "show-ships": "ships",
};

export const DEFAULT_SHOP_CATEGORY: ShopCategory = "ships";

export const getShopTabByCategory = (
  category: ShopCategory,
): (typeof SHOP_TABS)[number] => {
  return SHOP_TABS.find((tab) => tab.category === category) ?? SHOP_TABS[0];
};
