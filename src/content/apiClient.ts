import type { ContentError, ContentRegistry } from "./validation";

import ky from "ky";

export interface ContentTreeNode {
  children?: ContentTreeNode[];
  name: string;
  path: string;
  type: "dir" | "file";
}

export interface ContentRegistryResponse {
  errors: ContentError[];
  registry: ContentRegistry;
}

interface ContentErrorResponse {
  error?: string;
}

interface ContentListResponse {
  root: string;
  tree: ContentTreeNode[];
}

interface ContentReadResponse {
  contents: string;
  path: string;
}

interface ContentWriteResponse {
  ok: boolean;
}

const contentApi = ky.create({
  retry: 0,
});

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as ContentErrorResponse;
    if (payload.error) {
      return payload.error;
    }
  } catch {
    // ignore invalid JSON and use fallback message
  }
  return `Request failed (${response.status}).`;
};

const requestJson = async <T>(request: Promise<Response>): Promise<T> => {
  const response = await request;
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as T;
};

export const listContentTree = async (): Promise<ContentTreeNode[]> => {
  const payload = await requestJson<ContentListResponse>(
    contentApi.get("/__content/list"),
  );
  return payload.tree;
};

export const readContentFile = async (
  relativePath: string,
): Promise<string> => {
  const payload = await requestJson<ContentReadResponse>(
    contentApi.get("/__content/read", {
      searchParams: { path: relativePath },
    }),
  );
  return payload.contents;
};

export const writeContentFile = async (
  relativePath: string,
  contents: string,
): Promise<void> => {
  const payload = await requestJson<ContentWriteResponse>(
    contentApi.post("/__content/write", {
      json: {
        contents,
        path: relativePath,
      },
    }),
  );
  if (!payload.ok) {
    throw new Error("Write failed.");
  }
};

export const fetchRegistry = async (): Promise<ContentRegistryResponse> =>
  requestJson<ContentRegistryResponse>(contentApi.get("/__content/registry"));
