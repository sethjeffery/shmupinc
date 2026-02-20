import type { MountedWeapon } from "../../data/save";
import type { ShipDefinition } from "../../data/ships";

import clsx from "clsx";
import { useCallback, useEffect, useRef } from "preact/hooks";

import { PreviewScene } from "../../scenes/PreviewScene";

import styles from "./ShopCanvasArea.module.css";

const getDefaultPresentation = (): {
  fireEnabled: boolean;
  shipScale: number;
  shipX: number;
  shipY: number;
} => {
  const compactLayout =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 960px)").matches;
  return {
    fireEnabled: true,
    shipScale: 2.65,
    shipX: compactLayout ? 0.5 : 0.72,
    shipY: compactLayout ? 0.76 : 0.64,
  };
};

export default function ShopCanvasArea(props: {
  className?: string;
  previewLoadout?: {
    mountedWeapons: MountedWeapon[];
    ship: ShipDefinition;
  };
  previewRootRef?: (element: HTMLDivElement | null) => void;
}) {
  const {
    className,
    previewLoadout,
    previewRootRef: externalPreviewRootRef,
  } = props;
  const previewRootElRef = useRef<HTMLDivElement | null>(null);
  const previewGameRef = useRef<null | Phaser.Game>(null);
  const previewSceneRef = useRef<null | PreviewScene>(null);
  const resizeObserverRef = useRef<null | ResizeObserver>(null);
  const previewCanvasSizeRef = useRef<{ height: number; width: number }>({
    height: 0,
    width: 0,
  });

  const syncPreviewCanvasSize = useCallback(() => {
    if (!previewRootElRef.current) return;
    const cssWidth = Math.max(0, Math.round(previewRootElRef.current.clientWidth));
    const cssHeight = Math.max(
      0,
      Math.round(previewRootElRef.current.clientHeight),
    );
    if (cssWidth < 2 || cssHeight < 2) return;
    if (
      previewCanvasSizeRef.current?.width === cssWidth &&
      previewCanvasSizeRef.current?.height === cssHeight
    ) {
      return;
    }
    previewCanvasSizeRef.current = { height: cssHeight, width: cssWidth };
    if (previewGameRef.current) {
      previewGameRef.current.scale.resize(cssWidth, cssHeight);
    }
    previewSceneRef.current?.setPresentation(getDefaultPresentation());
    previewSceneRef.current?.resize(cssWidth, cssHeight);
  }, []);

  const attachPreviewCanvasToRoot = useCallback(() => {
    if (!previewRootElRef.current || !previewGameRef.current) return;
    const canvas = previewGameRef.current.canvas;
    if (!canvas) return;
    if (canvas.parentElement === previewRootElRef.current) return;
    previewRootElRef.current.appendChild(canvas);
  }, []);

  const applyDefaultPresentation = useCallback(() => {
    previewSceneRef.current?.setPresentation(getDefaultPresentation());
  }, []);

  const applyPreviewLoadout = useCallback(() => {
    if (!previewLoadout) return;
    previewSceneRef.current?.setLoadout(
      previewLoadout.mountedWeapons,
      previewLoadout.ship,
    );
  }, [previewLoadout]);

  const setupPreviewGame = useCallback(() => {
    if (!previewRootElRef.current) return;
    if (previewGameRef.current) {
      attachPreviewCanvasToRoot();
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      resizeObserverRef.current = new ResizeObserver(() =>
        syncPreviewCanvasSize(),
      );
      resizeObserverRef.current.observe(previewRootElRef.current);
      applyDefaultPresentation();
      applyPreviewLoadout();
      syncPreviewCanvasSize();
      return;
    }
    const rect = previewRootElRef.current?.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(rect.width));
    const cssHeight = Math.max(1, Math.round(rect.height));
    previewSceneRef.current = new PreviewScene();
    const resolution = Math.min(window.devicePixelRatio || 1, 2);
    const previewConfig: Phaser.Types.Core.GameConfig & {
      resolution?: number;
    } = {
      audio: { noAudio: true },
      backgroundColor: "#05060a",
      fps: { smoothStep: false },
      parent: previewRootElRef.current,
      render: { antialias: true },
      resolution,
      scale: {
        height: Math.max(2, cssHeight),
        mode: Phaser.Scale.NONE,
        width: Math.max(2, cssWidth),
      },
      scene: [previewSceneRef.current],
      type: Phaser.CANVAS,
    };
    previewGameRef.current = new Phaser.Game(previewConfig);
    // applyPreviewLoadout();
    resizeObserverRef.current = new ResizeObserver(() => syncPreviewCanvasSize());
    resizeObserverRef.current.observe(previewRootElRef.current);
    applyDefaultPresentation();
    applyPreviewLoadout();
    window.requestAnimationFrame(() => syncPreviewCanvasSize());
  }, [
    applyDefaultPresentation,
    applyPreviewLoadout,
    attachPreviewCanvasToRoot,
    syncPreviewCanvasSize,
  ]);

  const handlePreviewRootRef = useCallback(
    (element: HTMLDivElement | null) => {
      previewRootElRef.current = element;
      previewCanvasSizeRef.current = { height: 0, width: 0 };
      if (!element) return;
      setupPreviewGame();
      applyDefaultPresentation();
      applyPreviewLoadout();
      syncPreviewCanvasSize();
    },
    [
      applyDefaultPresentation,
      applyPreviewLoadout,
      setupPreviewGame,
      syncPreviewCanvasSize,
    ],
  );

  useEffect(() => {
    if (externalPreviewRootRef || !previewLoadout) return;
    applyPreviewLoadout();
  }, [applyPreviewLoadout, externalPreviewRootRef, previewLoadout]);

  useEffect(() => {
    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      previewGameRef.current?.destroy(true);
      previewGameRef.current = null;
      previewSceneRef.current = null;
      previewRootElRef.current = null;
    };
  }, []);

  if (externalPreviewRootRef) {
    return (
      <div
        className={clsx(styles["canvas-area"], className)}
        ref={externalPreviewRootRef}
      />
    );
  }

  return (
    <div
      className={clsx(styles["canvas-area"], className)}
      ref={handlePreviewRootRef}
    />
  );
}
