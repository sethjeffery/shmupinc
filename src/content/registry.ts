import type { ContentEntry, ContentRegistry } from "./validation";

import { CONTENT_KINDS, type ContentKind } from "./schemas";
import { buildContentRegistry } from "./validation";

const extractKind = (filePath: string): ContentKind | null => {
  const parts = filePath.split("/");
  const contentIndex = parts.indexOf("content");
  if (contentIndex < 0 || contentIndex + 1 >= parts.length) return null;
  const kind = parts[contentIndex + 1] as ContentKind;
  return CONTENT_KINDS.includes(kind) ? kind : null;
};

const toRelativePath = (filePath: string): string => {
  const marker = "/content/";
  const index = filePath.indexOf(marker);
  if (index >= 0) {
    return filePath.slice(index + marker.length);
  }
  return filePath;
};

const loadContentEntries = (): ContentEntry[] => {
  const modules = import.meta.glob("/content/**/*.{json,json5}", {
    eager: true,
  });
  const entries: ContentEntry[] = [];
  for (const [path, module] of Object.entries(modules)) {
    const kind = extractKind(path);
    if (!kind) continue;
    const data = (module as { default: unknown }).default;
    entries.push({
      data,
      kind,
      path: toRelativePath(path),
    });
  }
  return entries;
};

let cachedRegistry: ContentRegistry | null = null;

const EMPTY_REGISTRY: ContentRegistry = {
  beatsById: {},
  bulletsById: {},
  enemiesById: {},
  galaxiesById: {},
  gunsById: {},
  hazardsById: {},
  levelsById: {},
  modsById: {},
  objectivesById: {},
  shipsById: {},
  shopsById: {},
  soundsById: {},
  wavesById: {},
  weaponsById: {},
};

export const getContentRegistry = (): ContentRegistry => {
  if (typeof window === "undefined") return EMPTY_REGISTRY;
  if (import.meta.env.DEV) {
    const result = buildContentRegistry(loadContentEntries());
    cachedRegistry = result.registry;
    return cachedRegistry;
  }
  if (!cachedRegistry) {
    const result = buildContentRegistry(loadContentEntries());
    cachedRegistry = result.registry;
  }
  return cachedRegistry;
};
