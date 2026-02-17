import { useEffect } from "preact/hooks";

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
      className={props.className ?? "shop-node-icon"}
      height={size}
      ref={(el) => {
        canvasRef = el;
      }}
      width={size}
    />
  );
}
