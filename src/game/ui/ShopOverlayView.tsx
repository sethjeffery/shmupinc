import type { ComponentChild } from "preact";

import { type Signal } from "@preact/signals";
import clsx from "clsx";
import { useState } from "preact/hooks";

import { SHOP_TABS, type ShopCategory } from "./shop/shopTabs";

import styles from "./ShopOverlayView.module.css";

export interface ShopOverlaySignals {
  category: Signal<ShopCategory>;
  content: Signal<ComponentChild>;
  gold: Signal<string>;
  missionActive: Signal<boolean>;
  missionText: Signal<string>;
}

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

const ShopTabIcon = (props: { icon: "mount" | "ship" | "weapon" }) => {
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

export const ShopOverlayView = (props: {
  onDeploy: () => void;
  onQuit: () => void;
  onTabSelect: (category: ShopCategory) => void;
  signals: ShopOverlaySignals;
}) => {
  const category = props.signals.category.value;
  const missionClass = clsx(
    styles["shop-mission"],
    props.signals.missionActive.value ? styles["is-active"] : undefined,
  );
  const [confirmQuit, setConfirmQuit] = useState(false);

  return (
    <div className={styles["shop-panel"]}>
      <div className={styles["shop-shell"]}>
        <aside className={styles["shop-nav"]}>
          <button
            className={styles["shop-nav-start"]}
            onClick={() => props.onDeploy()}
            type="button"
          >
            Start
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
              <div className={missionClass}>
                {props.signals.missionText.value}
              </div>
            </div>
            <div className={styles["shop-gold"]} aria-label="Gold">
              <span className={styles["shop-gold-icon"]} />
              <span className={styles["shop-gold-value"]}>
                {props.signals.gold.value}
              </span>
            </div>
          </header>
          <div className={styles["shop-main-content"]}>
            {props.signals.content.value}
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
