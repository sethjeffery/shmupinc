import clsx from "clsx";

import styles from "./ShopCanvasArea.module.css";

export default function ShopCanvasArea(props: {
  className?: string;
  previewRootRef: (element: HTMLDivElement | null) => void;
}) {
  return (
    <div
      className={clsx(styles["canvas-area"], props.className)}
      ref={props.previewRootRef}
    />
  );
}
