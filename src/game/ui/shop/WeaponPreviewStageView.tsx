import type { MountedWeapon } from "../../data/save";
import type { ShipDefinition } from "../../data/ships";

import ShopCanvasArea from "./ShopCanvasArea";
import { ShopEffects } from "./ShopEffects";
import ShopInfoPanel from "./ShopInfoPanel";
import { ShopLabel } from "./ShopLabel";
import { ShopPreviewStage } from "./ShopPreviewStage";
import { ShopStats } from "./ShopStats";

import styles from "./WeaponPreviewStageView.module.css";

interface WeaponPreviewStatViewModel {
  fill: number;
  label: "Damage" | "Speed";
}

export default function WeaponPreviewStageView(props: {
  action?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
  description: string;
  effects: string[];
  fitsCurrentShip: boolean;
  previewLoadout: {
    mountedWeapons: MountedWeapon[];
    ship: ShipDefinition;
  };
  sizeLabel: string;
  stats: WeaponPreviewStatViewModel[];
  title: string;
  visibleDescription: string;
}) {
  return (
    <ShopPreviewStage>
      <ShopInfoPanel
        action={props.action}
        actionDisabled={props.actionDisabled}
        onAction={props.onAction}
        description={props.description}
        title={props.title}
        visibleDescription={props.visibleDescription}
      >
        <div className={styles.size}>
          <ShopLabel>Size</ShopLabel>
          <div className={styles.sizeValue}>{props.sizeLabel}</div>
          {!props.fitsCurrentShip ? (
            <div className={styles.sizeWarning}>Will not fit on your ship</div>
          ) : null}
        </div>

        <ShopStats stats={props.stats} key={props.title} />
        <ShopEffects effects={props.effects} key={props.title} />
      </ShopInfoPanel>

      <ShopCanvasArea previewLoadout={props.previewLoadout} />
    </ShopPreviewStage>
  );
}
