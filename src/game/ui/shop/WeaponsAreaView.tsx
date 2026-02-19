import type {
  ShopMarketAreaItem,
  ShopMarketItemIconRenderer,
} from "./ShopMarketArea.types";
import type { ComponentChildren } from "preact";

import clsx from "clsx";

import ShopTopCarousel from "./ShopTopCarousel";

import sceneStyles from "../../scenes/ShopScene.module.css";
import styles from "./WeaponsAreaView.module.css";

const formatColor = (color: number): string =>
  `#${color.toString(16).padStart(6, "0")}`;

export default function WeaponsAreaView(props: {
  items: readonly ShopMarketAreaItem[];
  onItemClick: (item: ShopMarketAreaItem) => void;
  previewContent: ComponentChildren;
  renderItemIcon: ShopMarketItemIconRenderer;
  selectedKey: null | string;
}) {
  return (
    <div className={styles["weapons-area"]}>
      <ShopTopCarousel kind="weapons">
        {props.items.map((item) => {
          const selected = `${item.kind}-${item.id}` === props.selectedKey;
          return (
            <button
              className={clsx(
                sceneStyles["shop-carousel-item"],
                selected ? sceneStyles["is-selected"] : undefined,
                item.owned ? sceneStyles["is-owned"] : undefined,
                item.kind === "ship"
                  ? sceneStyles["is-ship"]
                  : item.kind === "weapon"
                    ? sceneStyles["is-weapon"]
                    : sceneStyles["is-mod"],
                item.equipped ? sceneStyles["is-equipped"] : undefined,
              )}
              key={`${item.kind}-${item.id}`}
              onClick={() => props.onItemClick(item)}
              style={
                {
                  "--accent": formatColor(item.accentColor),
                } as Record<string, string>
              }
              type="button"
            >
              <span className={sceneStyles["shop-carousel-item-icon"]}>
                {props.renderItemIcon(item)}
              </span>
              <span className={sceneStyles["shop-carousel-item-name"]}>
                {item.name}
              </span>
              <span className={sceneStyles["shop-carousel-item-cost"]}>
                {item.owned ? "Owned" : item.costLabel}
              </span>
            </button>
          );
        })}
      </ShopTopCarousel>
      {props.previewContent}
    </div>
  );
}
