import type { MountedWeapon } from "../../data/save";
import type { ShipDefinition } from "../../data/ships";

import ShopCanvasArea from "./ShopCanvasArea";
import ShopInfoPanel from "./ShopInfoPanel";
import { ShopPreviewStage } from "./ShopPreviewStage";
import { ShopStats } from "./ShopStats";

interface ShipPreviewStatViewModel {
  fill: number;
  label: "Armor" | "Magnet" | "Speed" | "Weaponry";
}

export default function ShipPreviewStageView(props: {
  action?: string;
  actionDisabled?: boolean;
  description: string;
  onAction?: () => void;
  previewLoadout: {
    mountedWeapons: MountedWeapon[];
    ship: ShipDefinition;
  };
  shipId: string;
  statStepCount: number;
  stats: ShipPreviewStatViewModel[];
  title: string;
  visibleDescription: string;
}) {
  const fullDescription = props.description.trim();
  const baseDelayMs = Math.max(140, fullDescription.length * 5);

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
        <div key={props.shipId}>
          <ShopStats
            baseDelayMs={baseDelayMs}
            stats={props.stats}
            stepCount={props.statStepCount}
          />
        </div>
      </ShopInfoPanel>

      <ShopCanvasArea previewLoadout={props.previewLoadout} />
    </ShopPreviewStage>
  );
}
