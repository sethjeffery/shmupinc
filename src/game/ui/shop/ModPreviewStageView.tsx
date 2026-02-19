import type { ComponentChildren } from "preact";

import ShopInfoPanel from "./ShopInfoPanel";
import ShopSpinningMod from "./ShopSpinningMod";

import styles from "../../scenes/ShopScene.module.css";

export default function ModPreviewStageView(props: {
  action: ComponentChildren;
  description: string;
  effects: string[];
  title: string;
  visual: ComponentChildren;
  visibleDescription: string;
}) {
  return (
    <div className={`${styles["shop-preview-stage"]} ${styles["is-mod"]}`}>
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
          <div className={styles["shop-item-effects"]}>
            <div className={styles["shop-item-section-label"]}>Effects</div>
            <div className={styles["shop-item-effect-list"]}>
              {props.effects.length > 0
                ? props.effects.map((effect) => (
                    <span className={styles["shop-item-effect"]} key={effect}>
                      {effect}
                    </span>
                  ))
                : (
                    <span className={styles["shop-item-effect-muted"]}>Passive</span>
                  )}
            </div>
          </div>
        </ShopInfoPanel>

        <div className={styles["shop-item-preview-visual"]}>
          <ShopSpinningMod>{props.visual}</ShopSpinningMod>
        </div>
      </div>
    </div>
  );
}
