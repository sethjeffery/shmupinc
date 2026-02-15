import type { ContentKind } from "./schemas";

import { CONTENT_KINDS } from "./schemas";

export const getKindForPath = (filePath: string): ContentKind | null => {
  const [kind] = filePath.split("/");
  if (!kind) return null;
  return CONTENT_KINDS.includes(kind as ContentKind)
    ? (kind as ContentKind)
    : null;
};

export const debounce = (
  callback: () => void,
  delayMs: number,
): (() => void) => {
  let handle = 0;
  return (): void => {
    window.clearTimeout(handle);
    handle = window.setTimeout(callback, delayMs);
  };
};

export const scaleColor = (color: number, factor: number): number => {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
};

export const toRgba = (color: number, alpha: number): string => {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
