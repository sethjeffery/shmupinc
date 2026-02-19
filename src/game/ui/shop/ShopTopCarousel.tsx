import type { ComponentChildren } from "preact";

import clsx from "clsx";

import styles from "./ShopTopCarousel.module.css";

export default function ShopTopCarousel(props: {
  carouselClassName?: string;
  children: ComponentChildren;
  className?: string;
  kind?: "mods" | "ships" | "weapons";
}) {
  return (
    <div className={clsx(styles["carousel-outer"], props.className)}>
      <div
        className={clsx(styles.carousel, props.carouselClassName)}
        data-kind={props.kind}
      >
        {props.children}
      </div>
    </div>
  );
}
