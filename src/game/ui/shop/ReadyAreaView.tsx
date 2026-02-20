import type {
  ReadyMountRowModel,
  ReadyShipChoiceModel,
  ReadySlotModel,
} from "./readyModels";
import type { ComponentChildren } from "preact";

import ReadyMountRowView from "./ReadyMountRowView";
import ShopCanvasArea from "./ShopCanvasArea";
import ShopCarouselItem from "./ShopCarouselItem";
import { ShopInfoOverlay } from "./ShopInfoOverlay";
import { ShopPreviewStage } from "./ShopPreviewStage";
import ShopTopCarousel from "./ShopTopCarousel";

import styles from "./ReadyAreaView.module.css";

export default function ReadyAreaView(props: {
  drawer: ComponentChildren;
  mountRows: readonly ReadyMountRowModel[];
  onSelectShip: (shipId: string) => void;
  onSelectSlot: (slot: ReadySlotModel) => void;
  onStartMission: () => void;
  previewRootRef: (element: HTMLDivElement | null) => void;
  shipChoices: readonly ReadyShipChoiceModel[];
  shipName: string;
}) {
  return (
    <div className={styles["ready-area"]}>
      <ShopTopCarousel>
        {props.shipChoices.map((item) => {
          return (
            <ShopCarouselItem
              accentColor={item.accentColor}
              equipped={item.isActive}
              kind="ship"
              key={`ship-${item.id}`}
              name={item.name}
              onClick={() => props.onSelectShip(item.id)}
              selected={item.isActive}
              shape={item.shape}
            />
          );
        })}
      </ShopTopCarousel>

      <ShopPreviewStage>
        <ShopCanvasArea previewRootRef={props.previewRootRef} />

        <button
          className={styles["start-mission"]}
          onClick={props.onStartMission}
          type="button"
        >
          Start Mission
        </button>

        <ShopInfoOverlay>
          <h2 className={styles["config-title"]}>{props.shipName}</h2>
          <div className={styles["mount-list"]}>
            {props.mountRows.map((mount) => (
              <ReadyMountRowView
                key={mount.id}
                mountRow={mount}
                onSlotSelect={props.onSelectSlot}
              />
            ))}
          </div>
        </ShopInfoOverlay>

        {props.drawer}
      </ShopPreviewStage>
    </div>
  );
}
