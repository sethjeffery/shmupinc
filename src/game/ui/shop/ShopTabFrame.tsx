import type { ComponentChildren } from "preact";

import styles from "../../scenes/ShopScene.module.css";

export default function ShopTabFrame(props: {
  bodyClassName?: string;
  children: ComponentChildren;
  description: string;
  title: string;
}) {
  const bodyClass = props.bodyClassName
    ? `${styles["shop-content-body"]} ${styles[props.bodyClassName] ?? ""}`
    : styles["shop-content-body"];

  return (
    <section className={styles["shop-content"]}>
      <header className={styles["shop-content-header"]}>
        <h3 className={styles["shop-content-title"]}>{props.title}</h3>
        <p className={styles["shop-content-description"]}>
          {props.description}
        </p>
      </header>
      <div className={bodyClass}>{props.children}</div>
    </section>
  );
}
