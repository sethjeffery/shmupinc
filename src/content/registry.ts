import type { ContentEntry, ContentError, ContentRegistry } from "./validation";

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
  const modules = import.meta.glob("/content/**/*.{json,json5}", { eager: true });
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
let cachedErrors: ContentError[] = [];

const EMPTY_REGISTRY: ContentRegistry = {
  beatsById: {},
  enemiesById: {},
  hazardsById: {},
  levelsById: {},
  secondaryWeaponsById: {},
  shipsById: {},
  shopsById: {},
  wavesById: {},
  weaponsById: {},
};

export const getContentRegistry = (): ContentRegistry => {
  if (typeof import.meta.glob !== "function") return EMPTY_REGISTRY;
  if (!cachedRegistry) {
    const result = buildContentRegistry(loadContentEntries());
    cachedRegistry = result.registry;
    cachedErrors = result.errors;
  }
  return cachedRegistry;
};

export const getContentErrors = (): ContentError[] => cachedErrors;
