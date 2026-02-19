import type { ComponentChildren } from "preact";

import ShopCanvasArea from "./ShopCanvasArea";
import ShopInfoPanel from "./ShopInfoPanel";

import styles from "../../scenes/ShopScene.module.css";

interface WeaponPreviewStatViewModel {
  fill: number;
  label: "Damage" | "Speed";
}

export default function WeaponPreviewStageView(props: {
  action: ComponentChildren;
  description: string;
  effects: string[];
  fitsCurrentShip: boolean;
  previewRootRef: (element: HTMLDivElement | null) => void;
  sizeLabel: string;
  statStepCount: number;
  stats: WeaponPreviewStatViewModel[];
  title: string;
  visibleDescription: string;
}) {
  return (
    <div className={`${styles["shop-preview-stage"]} ${styles["is-weapon"]}`}>
      <div className={styles["shop-item-preview-grid"]}>
        <ShopInfoPanel
          actions={props.action}
          className={styles["shop-item-preview-info"]}
          description={props.description}
          streamClassName={styles["shop-item-preview-stream"]}
          title={props.title}
          titleClassName={styles["shop-item-preview-name"]}
          visibleDescription={props.visibleDescription}
        >
          <div className={styles["shop-weapon-size"]}>
            <div className={styles["shop-item-section-label"]}>Size</div>
            <div className={styles["shop-weapon-size-value"]}>
              {props.sizeLabel}
            </div>
            {!props.fitsCurrentShip ? (
              <div className={styles["shop-weapon-size-warning"]}>
                Will not fit on your ship
              </div>
            ) : null}
          </div>

          <div className={styles["shop-item-stats"]}>
            {props.stats.map((stat) => {
              const filledSteps = Math.max(
                0,
                Math.min(
                  props.statStepCount,
                  Math.round(stat.fill * props.statStepCount),
                ),
              );
              return (
                <div className={styles["shop-item-stat"]} key={stat.label}>
                  <div className={styles["shop-item-stat-head"]}>
                    <span className={styles["shop-item-stat-label"]}>
                      {stat.label}
                    </span>
                  </div>
                  <span className={styles["shop-item-stat-rail"]}>
                    {Array.from({ length: filledSteps }, (_, step) => (
                      <span
                        className={styles["shop-item-stat-step"]}
                        key={`${stat.label}-step-${step}`}
                      />
                    ))}
                  </span>
                </div>
              );
            })}
          </div>

          <div className={styles["shop-item-effects"]}>
            <div className={styles["shop-item-section-label"]}>Effects</div>
            <div className={styles["shop-item-effect-list"]}>
              {props.effects.length > 0 ? (
                props.effects.map((effect) => (
                  <span className={styles["shop-item-effect"]} key={effect}>
                    {effect}
                  </span>
                ))
              ) : (
                <span className={styles["shop-item-effect-muted"]}>None</span>
              )}
            </div>
          </div>
        </ShopInfoPanel>

        <div className={styles["shop-item-preview-visual"]}>
          <ShopCanvasArea
            className={styles["shop-preview-canvas"]}
            previewRootRef={props.previewRootRef}
          />
        </div>
      </div>
    </div>
  );
}
