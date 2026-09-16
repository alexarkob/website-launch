import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv } from "vite";
import {
  generateThinkerReaction,
  parseReactRequest,
  ReactApiError,
} from "./thinkers/react";
import type { ProviderSecrets } from "./thinkers/providers/run";

type IncomingMessage = {
  url?: string;
  method?: string;
  on: (
    event: "data" | "end" | "error",
    cb: (chunk?: Buffer | Error) => void,
  ) => void;
};

type ServerResponse = {
  statusCode: number;
  setHeader: (k: string, v: string) => void;
  end: (body: string) => void;
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      if (chunk && !(chunk instanceof Error)) chunks.push(chunk);
    });
    req.on("end", () => {
      resolvePromise(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", (err) => {
      reject(err instanceof Error ? err : new Error("Request stream error"));
    });
  });
}

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function resolveSecrets(): ProviderSecrets {
  const root = process.cwd();
  const merged: Record<string, string> = {
    ...loadEnv("development", root, ""),
    ...parseEnvFile(resolve(root, ".env")),
    ...parseEnvFile(resolve(root, ".dev.vars")),
  };

  const pick = (key: keyof ProviderSecrets & string) =>
    (process.env[key]?.trim() || merged[key]?.trim() || undefined);

  return {
    ANTHROPIC_API_KEY: pick("ANTHROPIC_API_KEY"),
    GEMINI_API_KEY: pick("GEMINI_API_KEY"),
    CLOUDFLARE_ACCOUNT_ID: pick("CLOUDFLARE_ACCOUNT_ID"),
    CLOUDFLARE_API_TOKEN: pick("CLOUDFLARE_API_TOKEN"),
  };
}

/**
 * Dev-only Vite plugin mirroring functions/api/thinkers/react.ts
 */
export function thinkersDevApi() {
  return {
    name: "thinkers-dev-api",
    configureServer(server: {
      middlewares: {
        use: (
          fn: (
            req: IncomingMessage,
            res: ServerResponse,
            next: () => void,
          ) => void | Promise<void>,
        ) => void;
      };
    }) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/thinkers/react")) {
          next();
          return;
        }

        if ((req.method ?? "GET").toUpperCase() !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        try {
          const raw = await readBody(req);
          const body = raw ? JSON.parse(raw) : {};
          const input = parseReactRequest(body);
          const result = await generateThinkerReaction(input, resolveSecrets());
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(result));
        } catch (error) {
          const status =
            error instanceof ReactApiError
              ? error.status
              : error instanceof SyntaxError
                ? 400
                : 502;
          const message =
            error instanceof Error ? error.message : "Unknown error";
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}
