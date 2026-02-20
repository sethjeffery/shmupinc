import type { ReadyMountRowModel, ReadySlotModel } from "./readyModels";

import clsx from "clsx";

import ReadySlotView from "./ReadySlotView";

import styles from "./ReadyMountRowView.module.css";

export default function ReadyMountRowView(props: {
  mountRow: ReadyMountRowModel;
  onSlotSelect: (slot: ReadySlotModel) => void;
}) {
  const { mountRow, onSlotSelect } = props;
  return (
    <div className={styles.mountRow}>
      <div className={styles.mountName}>{mountRow.label}</div>
      <div className={styles.slots}>
        <ReadySlotView onSelect={onSlotSelect} slot={mountRow.weaponSlot} />
        {mountRow.modSlots.length > 0 ? (
          <span
            aria-hidden="true"
            className={clsx(
              styles.link,
              mountRow.weaponSlot.isEmpty && styles.disabled,
            )}
          />
        ) : null}
        {mountRow.modSlots.map((modSlot) => (
          <ReadySlotView
            key={modSlot.id}
            onSelect={onSlotSelect}
            slot={modSlot}
          />
        ))}
      </div>
    </div>
  );
}
