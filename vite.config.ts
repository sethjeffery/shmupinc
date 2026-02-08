import type { Connect } from "vite";
import JSON5 from "json5";
import { defineConfig } from "vite";
import { buildContentRegistry } from "./src/content/validation";
import {
  listContentTree,
  loadContentEntries,
  readContentFile,
  writeContentFile,
} from "./scripts/content/nodeLoader";
import { ServerResponse } from "node:http";

const parseBody = async (req: Connect.IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
};

const sendJson = (
  res: ServerResponse,
  status: number,
  payload: unknown,
): void => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};

export default defineConfig({
  server: {
    watch: {
      ignored: ["**/content/**"],
    },
  },
  plugins: [
    {
      name: "content-json5",
      transform(code, id) {
        if (!id.endsWith(".json5")) return null;
        const data = JSON5.parse(code);
        return {
          code: `export default ${JSON.stringify(data)};`,
          map: null,
        };
      },
    },
    {
      name: "content-server",
      configureServer(server) {
        server.middlewares.use("/__content/list", async (req, res, next) => {
          if (req.method !== "GET") {
            next();
            return;
          }
          try {
            const tree = await listContentTree();
            sendJson(res, 200, { root: "content", tree });
          } catch (error) {
            sendJson(res, 500, { error: (error as Error).message });
          }
        });

        server.middlewares.use("/__content/read", async (req, res, next) => {
          if (req.method !== "GET") {
            next();
            return;
          }
          const url = new URL(req.url ?? "", "http://localhost");
          const relativePath = url.searchParams.get("path");
          if (!relativePath) {
            sendJson(res, 400, { error: "Missing path." });
            return;
          }
          try {
            const contents = await readContentFile(relativePath);
            sendJson(res, 200, { path: relativePath, contents });
          } catch (error) {
            sendJson(res, 400, { error: (error as Error).message });
          }
        });

        server.middlewares.use("/__content/write", async (req, res, next) => {
          if (req.method !== "POST") {
            next();
            return;
          }
          try {
            const raw = await parseBody(req);
            const payload = JSON.parse(raw) as {
              contents?: string;
              path?: string;
            };
            if (!payload.path || typeof payload.contents !== "string") {
              sendJson(res, 400, { error: "Missing path or contents." });
              return;
            }
            await writeContentFile(payload.path, payload.contents);
            sendJson(res, 200, { ok: true });
          } catch (error) {
            sendJson(res, 400, { error: (error as Error).message });
          }
        });

        server.middlewares.use(
          "/__content/registry",
          async (req, res, next) => {
            if (req.method !== "GET") {
              next();
              return;
            }
            try {
              const { entries, errors } = await loadContentEntries();
              const result = buildContentRegistry(entries);
              sendJson(res, 200, {
                errors: [...errors, ...result.errors],
                registry: result.registry,
              });
            } catch (error) {
              sendJson(res, 500, { error: (error as Error).message });
            }
          },
        );
      },
    },
  ],
});
