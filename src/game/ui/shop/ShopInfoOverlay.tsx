import type { ComponentChildren } from "preact";

import styles from "./ShopInfoOverlay.module.css";

export function ShopInfoOverlay(props: { children?: ComponentChildren }) {
  return <section className={styles.overlay}>{props.children}</section>;
}
