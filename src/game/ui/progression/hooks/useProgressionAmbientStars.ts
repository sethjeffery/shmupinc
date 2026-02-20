import { useMemo } from "preact/hooks";

import {
  PROGRESSION_MAP_BASE_HEIGHT,
  PROGRESSION_MAP_STAR_COUNT,
  PROGRESSION_MAP_WIDTH,
} from "../constants";

export interface AmbientStar {
  cx: number;
  cy: number;
  delaySec: number;
  durationSec: number;
  opacity: number;
  r: number;
}

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createRng = (seedValue: number): (() => number) => {
  let seed = seedValue >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const buildAmbientStars = (
  galaxyId: string,
  mapWidth: number,
  mapHeight: number,
): AmbientStar[] => {
  const areaScale =
    (mapWidth * mapHeight) /
    (PROGRESSION_MAP_WIDTH * PROGRESSION_MAP_BASE_HEIGHT);
  const starCount = Math.round(PROGRESSION_MAP_STAR_COUNT * areaScale);
  const clampedCount = Math.max(
    PROGRESSION_MAP_STAR_COUNT,
    Math.min(460, starCount),
  );
  const rand = createRng(
    hashString(`stars:${galaxyId}:${mapWidth}:${mapHeight}`),
  );
  const stars: AmbientStar[] = [];
  for (let index = 0; index < clampedCount; index += 1) {
    stars.push({
      cx: rand() * mapWidth,
      cy: rand() * mapHeight,
      delaySec: rand() * 8,
      durationSec: 2.8 + rand() * 8.6,
      opacity: 0.2 + rand() * 0.7,
      r: rand() > 0.88 ? 2 + rand() * 2 : 0.7 + rand() * 1.4,
    });
  }
  return stars;
};

export const useProgressionAmbientStars = (
  galaxyId: string,
  mapWidth: number,
  mapHeight: number,
): AmbientStar[] =>
  useMemo(
    () => buildAmbientStars(galaxyId, mapWidth, mapHeight),
    [galaxyId, mapHeight, mapWidth],
  );
