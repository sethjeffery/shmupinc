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
    description: "Swap hulls and review core flight stats.",
    icon: "ship",
    label: "Ships",
    title: "Fleet",
  },
  {
    action: "show-armory",
    category: "armory",
    description: "Buy weapons and mods for your inventory.",
    icon: "weapon",
    label: "Armory",
    title: "Equipment",
  },
  {
    action: "show-loadout",
    category: "loadout",
    description: "Route weapons and mods onto mount nodes.",
    icon: "mount",
    label: "Loadout",
    title: "Workbench",
  },
] as const;

export const SHOP_CATEGORY_BY_ACTION: Readonly<Record<ShopTabAction, ShopCategory>> =
  {
    "show-armory": "armory",
    "show-loadout": "loadout",
    "show-ships": "ships",
  };

export const DEFAULT_SHOP_CATEGORY: ShopCategory = "loadout";

export const getShopTabByCategory = (
  category: ShopCategory,
): (typeof SHOP_TABS)[number] => {
  return SHOP_TABS.find((tab) => tab.category === category) ?? SHOP_TABS[0];
};
