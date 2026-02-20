import type { ShopRules } from "../../data/levels";
import type { SaveData } from "../../data/save";
import type { ShipDefinition } from "../../data/ships";
import type { ShopCarouselItem as ShopCarouselItemModel } from "../../scenes/ShopScene";

import { useEffect, useMemo, useState } from "preact/hooks";

import { buildMountedWeapons } from "../../data/save";
import { SHIPS } from "../../data/ships";
import { useTypewriter } from "./hooks/useTypewriter";
import ShipPreviewStageView from "./ShipPreviewStageView";
import ShopCarouselItem from "./ShopCarouselItem";
import ShopTopCarousel from "./ShopTopCarousel";
import { formatCost } from "./utils/formatting";
import {
  canShowShipInShop,
  getFilteredShips,
  getShipPreviewStats,
  getVisibleShips,
} from "./utils/ships";

import styles from "./ShipAreaView.module.css";

const SHIP_STAT_STEP_COUNT = 12;

function buildShipCarouselItems(
  save: SaveData,
  shopRules?: ShopRules,
): readonly ShopCarouselItemModel[] {
  const allowedIds = new Set(
    getFilteredShips(shopRules).map((ship) => ship.id),
  );

  return [...getVisibleShips(save, shopRules)]
    .sort((a, b) => a.cost - b.cost)
    .filter((ship) => canShowShipInShop(save, ship))
    .map((ship) => {
      const owned = save.unlockedShips.includes(ship.id);
      return {
        accentColor: ship.color,
        cost: ship.cost,
        costLabel: owned
          ? undefined
          : formatCost(ship.cost, ship.costResource ?? "gold"),
        costResource: ship.costResource ?? "gold",
        description: ship.description,
        equipped: save.selectedShipId === ship.id,
        id: ship.id,
        kind: "ship",
        name: ship.name,
        owned,
        purchasable: !owned && allowedIds.has(ship.id),
        shape: ship.vector,
      } satisfies ShopCarouselItemModel;
    });
}

export default function ShipAreaView(props: {
  onAction?: (item: ShopCarouselItemModel) => void;
  onItemClick?: (item: ShopCarouselItemModel) => void;
  save: SaveData;
  selectedShip: ShipDefinition;
  shopRules?: ShopRules;
}) {
  const items = useMemo(
    () => buildShipCarouselItems(props.save, props.shopRules),
    [props.save, props.shopRules],
  );

  const [selectedItemId, setSelectedItemId] = useState<null | string>(
    () =>
      (items.find((item) => item.id === props.selectedShip.id) ?? items[0])
        ?.id ?? null,
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
      (items.find((item) => item.id === props.selectedShip.id) ?? items[0])
        ?.id ?? null,
    );
  }, [items, props.selectedShip.id, selectedItemId]);

  const handleItemClick = (item: ShopCarouselItemModel) => {
    setSelectedItemId(item.id);
    props.onItemClick?.(item);
  };

  const selectedItem =
    (selectedItemId
      ? items.find((item) => item.id === selectedItemId)
      : undefined) ??
    items.find((item) => item.id === props.selectedShip.id) ??
    items[0] ??
    null;

  const ship = selectedItem ? SHIPS[selectedItem.id] : undefined;
  const previewLoadout = useMemo(() => {
    const previewShip = ship ?? props.selectedShip;
    return {
      mountedWeapons: buildMountedWeapons(props.save, previewShip),
      ship: previewShip,
    };
  }, [props.save, props.selectedShip, ship]);

  const title = useTypewriter(ship?.name ?? "", 25, {
    restartKey: ship?.id ?? "none",
  });
  const visibleDescription = useTypewriter(ship?.description ?? "", 15, {
    offset: 500,
    restartKey: ship?.id ?? "none",
  });

  if (!selectedItem) return null;

  const action = !selectedItem.owned
    ? "Buy"
    : selectedItem.equipped
      ? "Equipped"
      : "Select Ship";
  const actionDisabled = Boolean(selectedItem.owned && selectedItem.equipped);

  return (
    <div className={styles["ship-area"]}>
      <ShopTopCarousel>
        {items.map((item) => {
          return (
            <ShopCarouselItem
              accentColor={item.accentColor}
              equipped={item.equipped}
              kind="ship"
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

      <ShipPreviewStageView
        action={action}
        actionDisabled={actionDisabled}
        description={ship?.description ?? ""}
        onAction={() => props.onAction?.(selectedItem)}
        previewLoadout={previewLoadout}
        shipId={ship?.id ?? selectedItem.id}
        statStepCount={SHIP_STAT_STEP_COUNT}
        stats={ship ? getShipPreviewStats(ship) : []}
        title={title}
        visibleDescription={visibleDescription}
      />
    </div>
  );
}
