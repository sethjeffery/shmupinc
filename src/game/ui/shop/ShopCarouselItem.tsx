import type { VectorShape } from "../../data/vectorShape";
import type { CardIconKind } from "./iconPainter";

import clsx from "clsx";

import { ItemIcon } from "./ItemIcon";
import { formatColor } from "./utils/formatting";

import styles from "./ShopCarouselItem.module.css";

export default function ShopCarouselItem(props: {
  accentColor: number;
  equipped?: boolean;
  kind: CardIconKind;
  meta?: string;
  name: string;
  onClick: () => void;
  owned?: boolean;
  selected?: boolean;
  shape: VectorShape;
}) {
  return (
    <button
      className={clsx(
        styles.item,
        props.selected ? styles["is-selected"] : undefined,
        props.owned ? styles["is-owned"] : undefined,
        props.equipped ? styles["is-equipped"] : undefined,
      )}
      onClick={props.onClick}
      style={
        {
          "--accent": formatColor(props.accentColor),
        } as Record<string, string>
      }
      type="button"
    >
      <span className={styles.icon}>
        <ItemIcon
          accentColor={props.accentColor}
          className={styles.canvas}
          kind={props.kind}
          shape={props.shape}
        />
      </span>
      <span className={styles.name}>{props.name}</span>
      {props.meta ? <span className={styles.meta}>{props.meta}</span> : null}
    </button>
  );
}
