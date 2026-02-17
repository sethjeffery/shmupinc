import type { ComponentChild } from "preact";

import { type Signal } from "@preact/signals";

import {
  getShopTabByCategory,
  SHOP_TABS,
  type ShopCategory,
} from "./shop/shopTabs";

export interface ShopOverlaySignals {
  category: Signal<ShopCategory>;
  content: Signal<ComponentChild>;
  gold: Signal<string>;
  missionActive: Signal<boolean>;
  missionText: Signal<string>;
  stats: Signal<{ hull: string; magnet: string; speed: string }>;
}

const tabClass = (
  activeCategory: ShopCategory,
  tabCategory: ShopCategory,
): string => `shop-tab${activeCategory === tabCategory ? " is-active" : ""}`;

const ShopTabIcon = (props: { icon: "mount" | "ship" | "weapon" }) => {
  if (props.icon === "ship") {
    return (
      <span className="shop-tab-icon shop-tab-icon--ship">
        <svg className="shop-tab-icon-svg" viewBox="0 0 24 24">
          <path d="M12 2 L17.5 8.5 L21 7.8 L21 18.8 L12 17 L3 18.8 L3 7.8 L6.5 8.5 Z" />
        </svg>
      </span>
    );
  }
  return <span className={`shop-tab-icon shop-tab-icon--${props.icon}`} />;
};

export const ShopOverlayView = (props: {
  onDeploy: () => void;
  onPreviewRootRef: (element: HTMLDivElement | null) => void;
  onTabSelect: (category: ShopCategory) => void;
  signals: ShopOverlaySignals;
}) => {
  const category = props.signals.category.value;
  const activeTab = getShopTabByCategory(category);
  const missionClass = `shop-mission${
    props.signals.missionActive.value ? " is-active" : ""
  }`;
  const deckClass = `shop-deck${
    category === "loadout" ? " is-loadout-focus" : ""
  }`;
  const stats = props.signals.stats.value;

  return (
    <div className="shop-panel">
      <div className="shop-header">
        <div className="shop-header-meta">
          <div className="shop-title">Hangar Exchange</div>
          <div className={missionClass}>{props.signals.missionText.value}</div>
        </div>
        <button
          className="shop-header-start"
          onClick={() => props.onDeploy()}
          type="button"
        >
          Start
        </button>
        <div className="shop-gold">{props.signals.gold.value}</div>
      </div>

      <div className={deckClass}>
        <div className="shop-left">
          <div className="shop-preview-card">
            <div className="shop-preview-canvas" ref={props.onPreviewRootRef} />
          </div>

          <div className="shop-stats">
            <div className="shop-stat">
              <strong>Hull</strong>
              <span>{stats.hull}</span>
            </div>
            <div className="shop-stat">
              <strong>Thrust</strong>
              <span>{stats.speed}</span>
            </div>
            <div className="shop-stat">
              <strong>Magnet</strong>
              <span>{stats.magnet}</span>
            </div>
          </div>

          <div className="shop-cta">
            <button
              className="shop-play"
              onClick={() => props.onDeploy()}
              type="button"
            >
              <span className="shop-play-icon" />
              <span className="shop-play-label">Start Mission</span>
            </button>
            <div className="shop-cta-meta">
              <span className="shop-cta-gold">{props.signals.gold.value}</span>
              <span className="shop-cta-hint">
                Configure mounts before deploying.
              </span>
            </div>
          </div>
        </div>

        <div className="shop-right">
          <div className="shop-tabs">
            {SHOP_TABS.map((tab) => (
              <button
                className={tabClass(category, tab.category)}
                key={tab.category}
                onClick={() => props.onTabSelect(tab.category)}
                type="button"
              >
                <ShopTabIcon icon={tab.icon} />
                <span className="shop-tab-label">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="shop-tab-summary" aria-live="polite">
            <div className="shop-tab-summary-title">{activeTab.title}</div>
            <div className="shop-tab-summary-desc">{activeTab.description}</div>
          </div>

          <div className="shop-tab-content">{props.signals.content.value}</div>
        </div>
      </div>
    </div>
  );
};

export default ShopOverlayView;
