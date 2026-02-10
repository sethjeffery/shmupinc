import { promises as fs } from "node:fs";
import path from "node:path";

import fg from "fast-glob";

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

interface MutableTreeNode {
  children: Map<string, MutableTreeNode>;
  files: Set<string>;
  name: string;
  path: string;
}

const CONTENT_ROOT = path.resolve(process.cwd(), "content");
const CONTENT_FILE_PATTERNS = CONTENT_KINDS.map(
  (kind) => `${kind}/**/*.{json,json5}`,
);

const normalizePath = (value: string): string =>
  value.split(path.sep).join("/");

const ensureInsideContentRoot = (relativePath: string): string => {
  const resolved = path.resolve(CONTENT_ROOT, relativePath);
  if (!resolved.startsWith(CONTENT_ROOT)) {
    throw new Error("Path escapes content root.");
  }
  return resolved;
};

const listContentFiles = async (): Promise<string[]> => {
  const files = await fg(CONTENT_FILE_PATTERNS, {
    cwd: CONTENT_ROOT,
    dot: false,
    followSymbolicLinks: false,
    onlyFiles: true,
    unique: true,
  });
  return files.map((filePath) => normalizePath(filePath)).sort();
};

const createMutableTreeNode = (
  name: string,
  nodePath: string,
): MutableTreeNode => ({
  children: new Map<string, MutableTreeNode>(),
  files: new Set<string>(),
  name,
  path: nodePath,
});

const buildTree = (filePaths: string[]): ContentTreeNode[] => {
  const root = createMutableTreeNode("", "");

  for (const filePath of filePaths) {
    const parts = filePath.split("/").filter(Boolean);
    if (parts.length === 0) continue;

    let current = root;
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current.files.add(part);
        continue;
      }
      const childPath = current.path ? `${current.path}/${part}` : part;
      let child = current.children.get(part);
      if (!child) {
        child = createMutableTreeNode(part, childPath);
        current.children.set(part, child);
      }
      current = child;
    }
  }

  const toTreeNodes = (node: MutableTreeNode): ContentTreeNode[] => {
    const directories = Array.from(node.children.values())
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((child) => ({
        children: toTreeNodes(child),
        name: child.name,
        path: child.path,
        type: "dir" as const,
      }));

    const files = Array.from(node.files)
      .sort((left, right) => left.localeCompare(right))
      .map((fileName) => ({
        name: fileName,
        path: node.path ? `${node.path}/${fileName}` : fileName,
        type: "file" as const,
      }));

    return [...directories, ...files];
  };

  return toTreeNodes(root);
};

export const listContentTree = async (): Promise<ContentTreeNode[]> => {
  const files = await listContentFiles();
  return buildTree(files);
};

export const readContentFile = async (
  relativePath: string,
): Promise<string> => {
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
  const files = await listContentFiles();

  for (const relativePath of files) {
    const [kindPart] = relativePath.split("/");
    if (!kindPart || !CONTENT_KINDS.includes(kindPart as ContentKind)) {
      continue;
    }

    const absolutePath = path.join(CONTENT_ROOT, relativePath);
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
      kind: kindPart as ContentKind,
      path: relativePath,
    });
  }

  return { entries, errors };
};
