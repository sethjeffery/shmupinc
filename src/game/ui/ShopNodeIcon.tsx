import { useEffect } from "preact/hooks";
import { useRef } from "preact/hooks";

import styles from "../scenes/ShopScene.module.css";

export default function ShopNodeIcon(props: {
  className?: string;
  size?: number;
  onDraw: (canvas: HTMLCanvasElement) => void;
}) {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (canvasElRef.current) props.onDraw(canvasElRef.current);
  });
  const size = Math.max(24, Math.round(props.size ?? 100));
  return (
    <canvas
      className={props.className ?? styles["shop-node-icon"]}
      height={size}
      ref={(el) => {
        canvasElRef.current = el;
      }}
      width={size}
    />
  );
}
