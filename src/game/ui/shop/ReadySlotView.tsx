import type { ReadySlotModel } from "./readyModels";

import clsx from "clsx";

import { ItemIcon } from "./ItemIcon";
import ShopVectorIconButton from "./ShopVectorIconButton";

import styles from "./ReadySlotView.module.css";

export default function ReadySlotView(props: {
  onSelect: (slot: ReadySlotModel) => void;
  slot: ReadySlotModel;
}) {
  const { slot } = props;
  const icon = slot.isEmpty ? (
    <span
      aria-hidden="true"
      className={
        slot.kind === "weapon"
          ? styles["empty-weapon-icon"]
          : styles["empty-mod-icon"]
      }
    />
  ) : (
    <ItemIcon
      accentColor={slot.accentColor}
      className={styles["slot-canvas"]}
      kind={slot.kind}
      shape={slot.shape}
      size={52}
    />
  );

  return (
    <ShopVectorIconButton
      className={clsx(
        styles.slot,
        slot.kind === "weapon" ? styles["is-weapon"] : styles["is-mod"],
        slot.isActive ? styles["is-active"] : undefined,
        slot.isEmpty ? styles["is-empty"] : undefined,
        slot.disabled ? styles["is-disabled"] : undefined,
      )}
      disabled={slot.disabled}
      icon={icon}
      iconClassName={styles["slot-icon"]}
      label={slot.label}
      labelClassName={styles["slot-label"]}
      onClick={() => props.onSelect(slot)}
    />
  );
}
