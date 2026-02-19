import type { ComponentChildren } from "preact";

import ShopCanvasArea from "./ShopCanvasArea";
import ShopInfoPanel from "./ShopInfoPanel";

import styles from "../../scenes/ShopScene.module.css";

interface ShipPreviewStatViewModel {
  fill: number;
  label: "Armor" | "Magnet" | "Speed" | "Weaponry";
}

export default function ShipPreviewStageView(props: {
  action: ComponentChildren;
  description: string;
  previewRootRef: (element: HTMLDivElement | null) => void;
  shipId: string;
  statStepCount: number;
  stats: ShipPreviewStatViewModel[];
  statusLabel: string;
  title: string;
  visibleDescription: string;
}) {
  const fullDescription = props.description.trim();

  return (
    <div className={`${styles["shop-preview-stage"]} ${styles["is-ship"]}`}>
      <div className={styles["shop-ship-preview-grid"]}>
        <ShopInfoPanel
          actions={
            <>
              {props.statusLabel ? (
                <span className={styles["shop-preview-status"]}>
                  {props.statusLabel}
                </span>
              ) : null}
              {props.action}
            </>
          }
          className={styles["shop-ship-preview-info"]}
          description={props.description}
          streamClassName={styles["shop-ship-preview-stream"]}
          title={props.title}
          titleClassName={styles["shop-ship-preview-name"]}
          visibleDescription={props.visibleDescription}
        >
          <div className={styles["shop-ship-stats"]} key={props.shipId}>
            {props.stats.map((stat, index) => {
              const baseDelayMs = Math.max(140, fullDescription.length * 5);
              const statDelay = (baseDelayMs + index * 110) / 1000;
              const filledSteps = Math.max(
                1,
                Math.min(
                  props.statStepCount,
                  Math.round(stat.fill * props.statStepCount),
                ),
              );
              return (
                <div
                  className={styles["shop-ship-stat"]}
                  key={stat.label}
                  style={
                    {
                      "--ship-stat-delay": `${statDelay.toFixed(2)}s`,
                    } as Record<string, string>
                  }
                >
                  <div className={styles["shop-ship-stat-head"]}>
                    <span className={styles["shop-ship-stat-label"]}>
                      {stat.label}
                    </span>
                  </div>
                  <span className={styles["shop-ship-stat-rail"]}>
                    {Array.from({ length: filledSteps }, (_, step) => (
                      <span
                        className={styles["shop-ship-stat-step"]}
                        key={`${stat.label}-step-${step}`}
                        style={
                          {
                            "--ship-step-delay": `${(
                              statDelay +
                              0.04 * step
                            ).toFixed(2)}s`,
                          } as Record<string, string>
                        }
                      />
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        </ShopInfoPanel>
        <div className={styles["shop-ship-preview-visual"]}>
          <ShopCanvasArea
            className={styles["shop-preview-canvas"]}
            previewRootRef={props.previewRootRef}
          />
        </div>
      </div>
    </div>
  );
}
