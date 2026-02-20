import type { VectorShape } from "../../data/vectorShape";

import { ItemIcon } from "./ItemIcon";
import { ShopEffects } from "./ShopEffects";
import ShopInfoPanel from "./ShopInfoPanel";
import { ShopPreviewStage } from "./ShopPreviewStage";
import ShopSpinningMod from "./ShopSpinningMod";

import styles from "./ModPreviewStageView.module.css";

export default function ModPreviewStageView(props: {
  accentColor: number;
  action?: string;
  actionDisabled?: boolean;
  description: string;
  effects: string[];
  onAction?: () => void;
  shape: VectorShape;
  title: string;
  visibleDescription: string;
}) {
  return (
    <ShopPreviewStage>
      <ShopInfoPanel
        action={props.action}
        actionDisabled={props.actionDisabled}
        description={props.description}
        onAction={props.onAction}
        title={props.title}
        visibleDescription={props.visibleDescription}
      >
        <ShopEffects effects={props.effects} title="Effects" />
        {props.effects.length === 0 ? (
          <div className={styles.passive}>Passive</div>
        ) : null}
      </ShopInfoPanel>

      <ShopSpinningMod>
        {(rotationRad) => (
          <ItemIcon
            accentColor={props.accentColor}
            className={styles.icon}
            kind="mod"
            rotationRad={rotationRad}
            shape={props.shape}
            size={180}
          />
        )}
      </ShopSpinningMod>
    </ShopPreviewStage>
  );
}
