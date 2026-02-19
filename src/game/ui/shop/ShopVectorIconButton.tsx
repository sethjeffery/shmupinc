import type { ComponentChildren } from "preact";
import type { JSX } from "preact";

import clsx from "clsx";

import styles from "./ShopVectorIconButton.module.css";

export default function ShopVectorIconButton(props: {
  className?: string;
  disabled?: boolean;
  icon: ComponentChildren;
  iconClassName?: string;
  label: string;
  labelClassName?: string;
  onClick?: () => void;
  selected?: boolean;
  style?: JSX.CSSProperties;
}) {
  return (
    <button
      className={clsx(
        styles["vector-button"],
        props.selected ? styles["is-selected"] : undefined,
        props.className,
      )}
      disabled={props.disabled}
      onClick={props.onClick}
      style={props.style}
      type="button"
    >
      <span className={clsx(styles.icon, props.iconClassName)}>
        {props.icon}
      </span>
      <span className={clsx(styles.label, props.labelClassName)}>
        {props.label}
      </span>
    </button>
  );
}
