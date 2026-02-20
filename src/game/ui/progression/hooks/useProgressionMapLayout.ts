import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import {
  PROGRESSION_MAP_BASE_ASPECT,
  PROGRESSION_MAP_BASE_HEIGHT,
  PROGRESSION_MAP_MAX_HEIGHT,
  PROGRESSION_MAP_MIN_WIDTH,
  PROGRESSION_MAP_WIDTH,
} from "../constants";

const clampUnit = (value: number): number => Math.max(0, Math.min(1, value));

export const useProgressionMapLayout = () => {
  const mapFrameRef = useRef<HTMLDivElement | null>(null);
  const [mapAspect, setMapAspect] = useState(PROGRESSION_MAP_BASE_ASPECT);
  const [mapFrameWidth, setMapFrameWidth] = useState(PROGRESSION_MAP_WIDTH);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const frame = mapFrameRef.current;
    if (!frame) return;

    const updateAspect = (): void => {
      const bounds = frame.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const nextAspect = bounds.width / bounds.height;
      setMapFrameWidth((previous) =>
        Math.abs(previous - bounds.width) > 0.5 ? bounds.width : previous,
      );
      setMapAspect((previous) =>
        Math.abs(previous - nextAspect) > 0.005 ? nextAspect : previous,
      );
    };

    updateAspect();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      updateAspect();
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const mapWidth = useMemo(() => {
    const target = Math.round(Math.max(0, mapFrameWidth) * 1.7);
    return Math.max(
      PROGRESSION_MAP_MIN_WIDTH,
      Math.min(PROGRESSION_MAP_WIDTH, target),
    );
  }, [mapFrameWidth]);

  const mapHeight = useMemo(() => {
    const aspect = Math.max(0.01, mapAspect);
    if (aspect >= PROGRESSION_MAP_BASE_ASPECT) {
      return PROGRESSION_MAP_BASE_HEIGHT;
    }
    const targetHeight = Math.round(mapWidth / aspect);
    return Math.min(PROGRESSION_MAP_MAX_HEIGHT, targetHeight);
  }, [mapAspect, mapWidth]);

  const projectX = (normalizedX: number): number => clampUnit(normalizedX) * mapWidth;
  const projectY = (normalizedY: number): number =>
    clampUnit(normalizedY) * mapHeight;

  const nodeRadius = mapWidth <= 760 ? 23 : 20;
  const nodePingRadius = nodeRadius + 4;
  const labelOffset = nodeRadius + 24;
  const starsOffset = labelOffset + 20;

  return {
    labelOffset,
    mapFrameRef,
    mapHeight,
    mapWidth,
    nodePingRadius,
    nodeRadius,
    projectX,
    projectY,
    starsOffset,
  };
};
