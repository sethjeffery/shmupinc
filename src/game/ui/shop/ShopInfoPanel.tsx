import type { ComponentChildren } from "preact";

import { ShopInfoOverlay } from "./ShopInfoOverlay";

import styles from "./ShopInfoPanel.module.css";

export default function ShopInfoPanel(props: {
  action?: string;
  actionDisabled?: boolean;
  children?: ComponentChildren;
  description: string;
  onAction?: () => void;
  title: string;
  visibleDescription: string;
}) {
  const fullDescription = props.description.trim();
  const streamDone = props.visibleDescription.length >= fullDescription.length;

  return (
    <ShopInfoOverlay>
      <div className={styles.header}>
        <div className={styles.title}>{props.title}</div>
        {props.action ? (
          <div className={styles.actions}>
            <button
              className={styles.action}
              disabled={props.actionDisabled}
              onClick={() => props.onAction?.()}
            >
              {props.action}
            </button>
          </div>
        ) : null}
      </div>

      <div className={styles.content}>
        <div className={styles.stream}>
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
    </ShopInfoOverlay>
  );
}
