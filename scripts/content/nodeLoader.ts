import { promises as fs } from "node:fs";
import path from "node:path";

import { parseJsonWithLocation } from "../../src/content/parseJson";
import { CONTENT_KINDS, type ContentKind } from "../../src/content/schemas";
import type { ContentEntry, ContentError } from "../../src/content/validation";

export interface ContentTreeNode {
  children?: ContentTreeNode[];
  name: string;
  path: string;
  type: "dir" | "file";
}

export interface LoadContentResult {
  entries: ContentEntry[];
  errors: ContentError[];
}

const CONTENT_ROOT = path.resolve(process.cwd(), "content");

const normalizePath = (value: string): string => value.split(path.sep).join("/");

const ensureInsideContentRoot = (relativePath: string): string => {
  const resolved = path.resolve(CONTENT_ROOT, relativePath);
  if (!resolved.startsWith(CONTENT_ROOT)) {
    throw new Error("Path escapes content root.");
  }
  return resolved;
};

export const listContentTree = async (): Promise<ContentTreeNode[]> => {
  const readDir = async (dir: string, basePath: string): Promise<ContentTreeNode[]> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const nodes: ContentTreeNode[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const absolutePath = path.join(dir, entry.name);
      const relativePath = normalizePath(path.join(basePath, entry.name));
      if (entry.isDirectory()) {
        const children = await readDir(absolutePath, relativePath);
        nodes.push({
          children,
          name: entry.name,
          path: relativePath,
          type: "dir",
        });
      } else if (entry.isFile()) {
        nodes.push({
          name: entry.name,
          path: relativePath,
          type: "file",
        });
      }
    }
    return nodes;
  };

  return readDir(CONTENT_ROOT, "");
};

export const readContentFile = async (relativePath: string): Promise<string> => {
  const safePath = ensureInsideContentRoot(relativePath);
  return fs.readFile(safePath, "utf-8");
};

export const writeContentFile = async (
  relativePath: string,
  contents: string,
): Promise<void> => {
  const safePath = ensureInsideContentRoot(relativePath);
  await fs.mkdir(path.dirname(safePath), { recursive: true });
  await fs.writeFile(safePath, contents, "utf-8");
};

export const loadContentEntries = async (): Promise<LoadContentResult> => {
  const entries: ContentEntry[] = [];
  const errors: ContentError[] = [];

  for (const kind of CONTENT_KINDS) {
    const dirPath = path.join(CONTENT_ROOT, kind);
    let files: string[] = [];
    try {
      files = await fs.readdir(dirPath);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith(".json") && !file.endsWith(".json5")) continue;
      const absolutePath = path.join(dirPath, file);
      const relativePath = normalizePath(path.join(kind, file));
      const raw = await fs.readFile(absolutePath, "utf-8");
      const parsed = parseJsonWithLocation(raw);
      if (parsed.error) {
        errors.push({
          kind: "parse",
          message: `${parsed.error.message} (line ${parsed.error.line}, col ${parsed.error.column})`,
          path: relativePath,
        });
        continue;
      }
      entries.push({
        data: parsed.data,
        kind: kind as ContentKind,
        path: relativePath,
      });
    }
  }

  return { entries, errors };
};
