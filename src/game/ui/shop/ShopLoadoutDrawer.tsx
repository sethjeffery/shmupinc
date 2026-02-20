import type { VectorShape } from "../../data/vectorShape";
import type { CardIconKind } from "./iconPainter";

import clsx from "clsx";

import { ItemIcon } from "./ItemIcon";

import styles from "./ShopLoadoutDrawer.module.css";

const formatColor = (color: number): string =>
  `#${color.toString(16).padStart(6, "0")}`;

export interface ShopLoadoutDrawerChoice {
  accentColor: number;
  iconKind: CardIconKind;
  id: string;
  isCurrent: boolean;
  label: string;
  meta: string;
  onSelect: () => void;
  shape: VectorShape;
}

export default function ShopLoadoutDrawer(props: {
  blockedMessage: null | string;
  canClear: boolean;
  choices: readonly ShopLoadoutDrawerChoice[];
  clearLabel: string;
  emptyMessage: string;
  onClear: () => void;
  onClose: () => void;
  open: boolean;
  title: string;
}) {
  return (
    <>
      {props.open ? (
        <button
          aria-label="Close loadout drawer"
          className={styles["drawer-scrim"]}
          onClick={props.onClose}
          type="button"
        />
      ) : null}

      <aside
        className={clsx(
          styles.drawer,
          props.open ? styles["is-open"] : undefined,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.head}>
          <div className={styles.title}>{props.title}</div>
          <button
            className={styles.close}
            onClick={props.onClose}
            type="button"
          >
            Close
          </button>
        </div>

        {props.blockedMessage ? (
          <div className={styles.empty}>{props.blockedMessage}</div>
        ) : (
          <div className={styles.list}>
            {props.canClear ? (
              <button
                className={styles.item}
                disabled={!props.canClear}
                onClick={props.onClear}
                type="button"
              >
                <span className={styles.label}>{props.clearLabel}</span>
              </button>
            ) : null}
            {props.choices.length === 0 ? (
              <div className={styles.empty}>{props.emptyMessage}</div>
            ) : (
              props.choices.map((choice) => (
                <button
                  className={clsx(
                    styles.item,
                    choice.isCurrent ? styles["is-current"] : undefined,
                  )}
                  key={choice.id}
                  onClick={choice.onSelect}
                  style={
                    {
                      "--accent": formatColor(choice.accentColor),
                    } as Record<string, string>
                  }
                  type="button"
                >
                  <span className={styles.icon}>
                    <ItemIcon
                      accentColor={choice.accentColor}
                      className={styles["item-canvas"]}
                      kind={choice.iconKind}
                      shape={choice.shape}
                      size={88}
                    />
                  </span>
                  <span className={styles.copy}>
                    <span className={styles.label}>{choice.label}</span>
                    <span className={styles.meta}>{choice.meta}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </aside>
    </>
  );
}
