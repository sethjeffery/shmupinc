import { render } from "preact";

import styles from "../scenes/ShopScene.module.css";

function getDragPreviewHost(): HTMLDivElement | null {
  const host = document.getElementById("shop-drag-preview-root");
  return host instanceof HTMLDivElement ? host : null;
}

export function clearDragPreview(): void {
  const host = getDragPreviewHost();
  if (host) render(null, host);
}

export function mountDragPreview(
  onCanvasReady: (canvas: HTMLCanvasElement) => void,
): HTMLDivElement | null {
  const host = getDragPreviewHost();
  if (!host) return null;
  let previewRef: HTMLDivElement | null = null;
  let canvasRef: HTMLCanvasElement | null = null;
  render(
    <div
      className={styles["shop-drag-preview"]}
      ref={(el) => {
        previewRef = el;
      }}
    >
      <canvas
        className={styles["shop-drag-preview-icon"]}
        height={36}
        ref={(el) => {
          canvasRef = el;
        }}
        width={36}
      />
    </div>,
    host,
  );
  if (!previewRef || !canvasRef) {
    render(null, host);
    return null;
  }
  onCanvasReady(canvasRef);
  return previewRef;
}
