import type { ShopRules } from "../../data/levels";
import type { SaveData } from "../../data/save";
import type { ShipDefinition } from "../../data/ships";
import type { ShopCarouselItem as ShopCarouselItemModel } from "../../scenes/ShopScene";

import { useCallback, useEffect, useMemo, useState } from "preact/hooks";

import { MODS } from "../../data/mods";
import { hasRequiredUnlocks } from "../../data/save";
import { useTypewriter } from "./hooks/useTypewriter";
import ModPreviewStageView from "./ModPreviewStageView";
import ShopCarouselItem from "./ShopCarouselItem";
import ShopTopCarousel from "./ShopTopCarousel";
import { formatCost } from "./utils/formatting";
import {
  describeModEffectTags,
  getFilteredMods,
  getModAccentColor,
  getVisibleMods,
  isModEquipped,
} from "./utils/mods";

import styles from "./ModsAreaView.module.css";

function buildModCarouselItems(
  save: SaveData,
  selectedShip: ShipDefinition,
  shopRules?: ShopRules,
): readonly ShopCarouselItemModel[] {
  const allowedModIds = new Set(
    getFilteredMods(shopRules).map((item) => item.id),
  );

  return getVisibleMods(save.ownedMods, shopRules)
    .sort((a, b) => a.cost - b.cost)
    .filter((mod) => {
      const owned = save.ownedMods.some(
        (instance) => instance.modId === mod.id,
      );
      return owned || hasRequiredUnlocks(save, mod.requiresUnlocks);
    })
    .map((mod) => {
      const owned = save.ownedMods.some(
        (instance) => instance.modId === mod.id,
      );
      const accentColor = getModAccentColor(mod.iconKind);
      return {
        accentColor,
        cost: mod.cost,
        costLabel: owned
          ? undefined
          : formatCost(mod.cost, mod.costResource ?? "gold"),
        costResource: mod.costResource ?? "gold",
        description: mod.description,
        equipped: isModEquipped(
          selectedShip,
          mod.id,
          save.mountedWeapons,
          save.ownedMods,
        ),
        id: mod.id,
        kind: "mod",
        name: mod.name,
        owned,
        purchasable: !owned && allowedModIds.has(mod.id),
        shape: mod.icon,
      } satisfies ShopCarouselItemModel;
    });
}

export default function ModsAreaView({
  onAction,
  onItemClick,
  save,
  selectedShip,
  shopRules,
}: {
  onAction?: (item: ShopCarouselItemModel) => void;
  onItemClick?: (item: ShopCarouselItemModel) => void;
  save: SaveData;
  selectedShip: ShipDefinition;
  shopRules?: ShopRules;
}) {
  const items = useMemo(
    () => buildModCarouselItems(save, selectedShip, shopRules),
    [save, selectedShip, shopRules],
  );

  const [selectedItemId, setSelectedItemId] = useState<null | string>(
    () => (items.find((item) => item.equipped) ?? items[0])?.id ?? null,
  );

  useEffect(() => {
    if (items.length === 0) {
      if (selectedItemId !== null) setSelectedItemId(null);
      return;
    }
    if (selectedItemId && items.some((item) => item.id === selectedItemId)) {
      return;
    }
    setSelectedItemId(
      (items.find((item) => item.equipped) ?? items[0])?.id ?? null,
    );
  }, [items, selectedItemId]);

  const handleItemClick = useCallback(
    (item: ShopCarouselItemModel) => {
      setSelectedItemId(item.id);
      onItemClick?.(item);
    },
    [onItemClick],
  );

  const selectedItem =
    (selectedItemId
      ? items.find((item) => item.id === selectedItemId)
      : undefined) ??
    items.find((item) => item.equipped) ??
    items[0] ??
    null;

  const mod = selectedItem ? MODS[selectedItem.id] : undefined;
  const title = useTypewriter(mod?.name ?? "", 25, { restartKey: mod?.id });
  const visibleDescription = useTypewriter(mod?.description ?? "", 15, {
    offset: 500,
    restartKey: mod?.id,
  });

  if (!selectedItem) return null;

  const action = !selectedItem.owned
    ? "Buy"
    : selectedItem.equipped
      ? "Equipped"
      : "Equip";
  const actionDisabled = Boolean(selectedItem.owned && selectedItem.equipped);

  return (
    <div className={styles["mods-area"]}>
      <ShopTopCarousel>
        {items.map((item) => {
          return (
            <ShopCarouselItem
              accentColor={item.accentColor}
              equipped={item.equipped}
              kind="mod"
              key={`${item.kind}-${item.id}`}
              meta={item.owned ? "Owned" : item.costLabel}
              name={item.name}
              onClick={() => handleItemClick(item)}
              owned={item.owned}
              selected={item.id === selectedItem.id}
              shape={item.shape}
            />
          );
        })}
      </ShopTopCarousel>

      <ModPreviewStageView
        accentColor={selectedItem.accentColor}
        action={action}
        actionDisabled={actionDisabled}
        description={mod?.description ?? ""}
        effects={mod ? describeModEffectTags(mod) : []}
        onAction={() => onAction?.(selectedItem)}
        shape={selectedItem.shape}
        title={title}
        visibleDescription={visibleDescription}
      />
    </div>
  );
}
