import type { ComponentChildren } from "preact";

import styles from "./ShopSpinningMod.module.css";

export default function ShopSpinningMod(props: {
  children: ComponentChildren;
}) {
  return <div className={styles.rotator}>{props.children}</div>;
}
