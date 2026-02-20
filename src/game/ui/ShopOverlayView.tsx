import type { ShopRules } from "../data/levels";
import type { SaveData } from "../data/save";
import type { ShipDefinition } from "../data/shipTypes";
import type { ShopCarouselItem } from "../scenes/ShopScene";
import type { CardIconKind } from "./shop/iconPainter";
import type { ComponentChild } from "preact";

import clsx from "clsx";
import { useState } from "preact/hooks";

import ModsAreaView from "./shop/ModsAreaView";
import ShipAreaView from "./shop/ShipAreaView";
import { SHOP_TABS, type ShopCategory } from "./shop/shopTabs";
import WeaponsAreaView from "./shop/WeaponsAreaView";

import styles from "./ShopOverlayView.module.css";

const tabClass = (
  activeCategory: ShopCategory,
  tabCategory: ShopCategory,
): string =>
  [
    styles["shop-nav-tab"],
    activeCategory === tabCategory ? styles["is-active"] : "",
  ]
    .filter(Boolean)
    .join(" ");

const ShopTabIcon = (props: { icon: CardIconKind }) => {
  if (props.icon === "ship") {
    return (
      <span
        className={clsx(
          styles["shop-nav-tab-icon"],
          styles["shop-nav-tab-icon--ship"],
        )}
      >
        <svg className={styles["shop-nav-tab-icon-svg"]} viewBox="0 0 24 24">
          <path d="M12 2 L17.5 8.5 L21 7.8 L21 18.8 L12 17 L3 18.8 L3 7.8 L6.5 8.5 Z" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={clsx(
        styles["shop-nav-tab-icon"],
        styles[`shop-nav-tab-icon--${props.icon}`],
      )}
    />
  );
};

const ShopOverlayView = (props: {
  onQuit: () => void;
  onTabSelect: (category: ShopCategory) => void;
  missionActive: boolean;
  category: ShopCategory;
  gold: string;
  missionText: string;
  save: SaveData;
  selectedShip: ShipDefinition;
  shopRules?: ShopRules;
  content: ComponentChild;
  onItemAction: (item: ShopCarouselItem) => void;
  onItemClick: (item: ShopCarouselItem) => void;
}) => {
  const category = props.category;
  const missionClass = clsx(
    styles["shop-mission"],
    props.missionActive ? styles["is-active"] : undefined,
  );
  const [confirmQuit, setConfirmQuit] = useState(false);

  return (
    <div className={styles["shop-panel"]}>
      <div className={styles["shop-shell"]}>
        <aside className={styles["shop-nav"]}>
          <button
            className={clsx(
              styles["shop-nav-start"],
              category === "loadout" ? styles["is-active"] : undefined,
            )}
            onClick={() => props.onTabSelect("loadout")}
            type="button"
          >
            Ready
          </button>
          <div className={styles["shop-nav-tabs"]}>
            {SHOP_TABS.map((tab) => (
              <button
                className={tabClass(category, tab.category)}
                key={tab.category}
                onClick={() => props.onTabSelect(tab.category)}
                type="button"
              >
                <ShopTabIcon icon={tab.icon} />
                <span className={styles["shop-nav-tab-label"]}>
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className={styles["shop-main"]}>
          <header className={styles["shop-main-header"]}>
            <div className={styles["shop-header-meta"]}>
              <div className={styles["shop-title"]}>Hangar Exchange</div>
              <div className={missionClass}>{props.missionText}</div>
            </div>
            <div className={styles["shop-gold"]} aria-label="Gold">
              <span className={styles["shop-gold-icon"]} />
              <span className={styles["shop-gold-value"]}>{props.gold}</span>
            </div>
          </header>
          <div className={styles["shop-main-content"]}>
            {category === "ships" ? (
              <ShipAreaView
                onAction={props.onItemAction}
                onItemClick={props.onItemClick}
                save={props.save}
                selectedShip={props.selectedShip}
                shopRules={props.shopRules}
              />
            ) : null}
            {category === "weapons" ? (
              <WeaponsAreaView
                onAction={props.onItemAction}
                onItemClick={props.onItemClick}
                save={props.save}
                selectedShip={props.selectedShip}
                shopRules={props.shopRules}
              />
            ) : null}
            {category === "mods" ? (
              <ModsAreaView
                onAction={props.onItemAction}
                onItemClick={props.onItemClick}
                save={props.save}
                selectedShip={props.selectedShip}
                shopRules={props.shopRules}
              />
            ) : null}
            {category === "loadout" ? props.content : null}
          </div>
        </section>

        <button
          className={styles["shop-nav-quit"]}
          onClick={() => setConfirmQuit(true)}
          type="button"
        >
          Quit
        </button>
      </div>

      {confirmQuit ? (
        <div
          className={styles["shop-dialog-backdrop"]}
          role="dialog"
          aria-modal="true"
        >
          <div className={styles["shop-dialog"]}>
            <div className={styles["shop-dialog-title"]}>Quit to Menu?</div>
            <div className={styles["shop-dialog-text"]}>
              Leave the hangar and return to the main menu.
            </div>
            <div className={styles["shop-dialog-actions"]}>
              <button
                className={styles["shop-dialog-btn"]}
                onClick={() => setConfirmQuit(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className={clsx(styles["shop-dialog-btn"], styles["is-danger"])}
                onClick={() => {
                  setConfirmQuit(false);
                  props.onQuit();
                }}
                type="button"
              >
                Quit
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ShopOverlayView;
