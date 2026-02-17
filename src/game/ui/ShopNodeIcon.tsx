import { useEffect } from "preact/hooks";

import styles from "../scenes/ShopScene.module.css";

export default function ShopNodeIcon(props: {
  className?: string;
  size?: number;
  onDraw: (canvas: HTMLCanvasElement) => void;
}) {
  let canvasRef: HTMLCanvasElement | null = null;
  useEffect(() => {
    if (canvasRef) props.onDraw(canvasRef);
  });
  const size = Math.max(24, Math.round(props.size ?? 100));
  return (
    <canvas
      className={props.className ?? styles["shop-node-icon"]}
      height={size}
      ref={(el) => {
        canvasRef = el;
      }}
      width={size}
    />
  );
}
