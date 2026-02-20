import styles from "./ShopPreviewStage.module.css";

export function ShopPreviewStage(props: {
  children: preact.ComponentChildren;
}) {
  return <div className={styles.stage}>{props.children}</div>;
}
