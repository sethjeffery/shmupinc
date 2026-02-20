import styles from "./ShopLabel.module.css";

export function ShopLabel(props: { children: preact.ComponentChildren }) {
  return <div className={styles.label}>{props.children}</div>;
}
