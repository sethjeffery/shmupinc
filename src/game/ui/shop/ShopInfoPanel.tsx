import type { ComponentChildren } from "preact";

import clsx from "clsx";

import styles from "./ShopInfoPanel.module.css";

export default function ShopInfoPanel(props: {
  actions?: ComponentChildren;
  children?: ComponentChildren;
  className?: string;
  description: string;
  streamClassName?: string;
  title: string;
  titleClassName?: string;
  visibleDescription: string;
}) {
  const fullDescription = props.description.trim();
  const streamDone = props.visibleDescription.length >= fullDescription.length;

  return (
    <div className={clsx(styles.panel, props.className)}>
      <div className={styles.header}>
        <div className={clsx(styles.title, props.titleClassName)}>
          {props.title}
        </div>
        {props.actions ? (
          <div className={styles.actions}>{props.actions}</div>
        ) : null}
      </div>

      <div className={clsx(styles.stream, props.streamClassName)}>
        <p className={styles.description}>
          {props.visibleDescription}
          {!streamDone ? (
            <span aria-hidden="true" className={styles.cursor}>
              _
            </span>
          ) : null}
        </p>
      </div>

      {props.children}
    </div>
  );
}
