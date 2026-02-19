import type { ShopCategory } from "./shopTabs";
import type { ComponentChild } from "preact";

import { type Signal } from "@preact/signals";

import ShopOverlayView from "../ShopOverlayView";

import styles from "./ShopRootView.module.css";

export interface ShopRootSignals {
  category: Signal<ShopCategory>;
  content: Signal<ComponentChild>;
  gold: Signal<string>;
  missionActive: Signal<boolean>;
  missionText: Signal<string>;
}

export default function ShopRootView(props: {
  onQuit: () => void;
  onTabSelect: (category: ShopCategory) => void;
  signals: ShopRootSignals;
}) {
  return (
    <div className={styles["shop-root"]}>
      <ShopOverlayView
        onQuit={props.onQuit}
        onTabSelect={props.onTabSelect}
        signals={props.signals}
      />
    </div>
  );
}
