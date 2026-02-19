import type { ComponentChildren } from "preact";

import clsx from "clsx";

import ShopCanvasArea from "./ShopCanvasArea";
import ShopTopCarousel from "./ShopTopCarousel";
import ShopVectorIconButton from "./ShopVectorIconButton";

import sceneStyles from "../../scenes/ShopScene.module.css";
import styles from "./ReadyAreaView.module.css";

const formatColor = (color: number): string =>
  `#${color.toString(16).padStart(6, "0")}`;

export interface ReadyShipChoiceViewModel {
  accentColor: number;
  icon: ComponentChildren;
  id: string;
  isActive: boolean;
  name: string;
  onSelect: () => void;
}

export interface ReadySlotViewModel {
  disabled?: boolean;
  icon: ComponentChildren;
  id: string;
  isActive: boolean;
  isEmpty: boolean;
  kind: "mod" | "weapon";
  label: string;
  onSelect: () => void;
}

export interface ReadyMountRowViewModel {
  id: string;
  label: string;
  modSlots: readonly ReadySlotViewModel[];
  weaponSlot: ReadySlotViewModel;
}

export default function ReadyAreaView(props: {
  drawer: ComponentChildren;
  legacyContent?: ComponentChildren;
  mountRows: readonly ReadyMountRowViewModel[];
  onStartMission: () => void;
  previewRootRef: (element: HTMLDivElement | null) => void;
  shipChoices: readonly ReadyShipChoiceViewModel[];
  shipName: string;
}) {
  return (
    <div className={styles["ready-area"]}>
      <ShopTopCarousel carouselClassName={sceneStyles["shop-loadout-ship-strip"]}>
        {props.shipChoices.map((choice) => (
          <ShopVectorIconButton
            className={clsx(
              sceneStyles["shop-loadout-ship-button"],
              choice.isActive ? sceneStyles["is-active"] : undefined,
            )}
            icon={choice.icon}
            iconClassName={sceneStyles["shop-loadout-ship-icon"]}
            key={choice.id}
            label={choice.name}
            labelClassName={sceneStyles["shop-loadout-ship-name"]}
            onClick={choice.onSelect}
            style={
              {
                "--accent": formatColor(choice.accentColor),
              } as Record<string, string>
            }
          />
        ))}
      </ShopTopCarousel>

      <div
        className={clsx(
          sceneStyles["shop-preview-stage"],
          sceneStyles["shop-preview-stage--loadout"],
          sceneStyles["shop-loadout-stage"],
        )}
      >
        <ShopCanvasArea
          className={sceneStyles["shop-preview-canvas"]}
          previewRootRef={props.previewRootRef}
        />

        <button
          className={sceneStyles["shop-loadout-start-mission"]}
          onClick={props.onStartMission}
          type="button"
        >
          Start Mission
        </button>

        <section className={sceneStyles["shop-loadout-config"]}>
          <h2 className={sceneStyles["shop-loadout-config-title"]}>{props.shipName}</h2>
          <div className={sceneStyles["shop-loadout-mount-list"]}>
            {props.mountRows.map((mount) => (
              <div className={sceneStyles["shop-loadout-mount-row"]} key={mount.id}>
                <div className={sceneStyles["shop-loadout-mount-name"]}>{mount.label}</div>
                <div className={sceneStyles["shop-loadout-slot-row"]}>
                  <ShopVectorIconButton
                    className={clsx(
                      sceneStyles["shop-loadout-slot"],
                      sceneStyles["is-weapon"],
                      mount.weaponSlot.isActive
                        ? sceneStyles["is-active"]
                        : undefined,
                      mount.weaponSlot.isEmpty ? sceneStyles["is-empty"] : undefined,
                    )}
                    icon={mount.weaponSlot.icon}
                    iconClassName={sceneStyles["shop-loadout-slot-icon"]}
                    label={mount.weaponSlot.label}
                    labelClassName={sceneStyles["shop-loadout-slot-label"]}
                    onClick={mount.weaponSlot.onSelect}
                  />

                  {mount.modSlots.length > 0 ? (
                    <span
                      aria-hidden="true"
                      className={sceneStyles["shop-loadout-slot-link"]}
                    />
                  ) : null}

                  {mount.modSlots.map((modSlot) => (
                    <ShopVectorIconButton
                      className={clsx(
                        sceneStyles["shop-loadout-slot"],
                        sceneStyles["is-mod"],
                        modSlot.isActive ? sceneStyles["is-active"] : undefined,
                        modSlot.isEmpty ? sceneStyles["is-empty"] : undefined,
                        modSlot.disabled ? sceneStyles["is-disabled"] : undefined,
                      )}
                      disabled={modSlot.disabled}
                      icon={modSlot.icon}
                      iconClassName={sceneStyles["shop-loadout-slot-icon"]}
                      key={modSlot.id}
                      label={modSlot.label}
                      labelClassName={sceneStyles["shop-loadout-slot-label"]}
                      onClick={modSlot.onSelect}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {props.drawer}

        {props.legacyContent ? (
          <div className={sceneStyles["shop-loadout-legacy"]}>{props.legacyContent}</div>
        ) : null}
      </div>
    </div>
  );
}
