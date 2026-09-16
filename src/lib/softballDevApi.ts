import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv } from "vite";
import { handleSoftballRequest, type SoftballEnv } from "./softball/api";
import { fileStore } from "./softball/fileStore";

type IncomingMessage = {
  url?: string;
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  on: (
    event: "data" | "end" | "error",
    cb: (chunk?: Buffer | Error) => void,
  ) => void;
};

type ServerResponse = {
  statusCode: number;
  setHeader: (k: string, v: string | number | readonly string[]) => void;
  end: (body?: string) => void;
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

function resolveEnv(): SoftballEnv {
  const root = process.cwd();
  const merged: Record<string, string> = {
    ...loadEnv("development", root, ""),
    ...parseEnvFile(resolve(root, ".env")),
    ...parseEnvFile(resolve(root, ".dev.vars")),
  };
  const pick = (key: string) => process.env[key]?.trim() || merged[key]?.trim() || undefined;
  return {
    SOFTBALL_ADMIN_PIN: pick("SOFTBALL_ADMIN_PIN") || "devpin",
    SOFTBALL_SESSION_SECRET:
      pick("SOFTBALL_SESSION_SECRET") || "dev-only-softball-session-secret",
    SPOTIFY_CLIENT_ID: pick("SPOTIFY_CLIENT_ID"),
    SPOTIFY_CLIENT_SECRET: pick("SPOTIFY_CLIENT_SECRET"),
  };
}

function toFetchRequest(req: IncomingMessage, body?: string): Request {
  const host = (Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host) || "localhost:4321";
  const url = new URL(req.url ?? "/", `http://${host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null || key === "host") continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else {
      headers.set(key, value);
    }
  }
  const method = (req.method ?? "GET").toUpperCase();
  return new Request(url, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : body,
  });
}

/**
 * Dev-only Vite plugin mirroring functions/api/softball/[[path]].ts
 */
export function softballDevApi() {
  const store = fileStore();
  return {
    name: "softball-dev-api",
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
        if (!req.url?.startsWith("/api/softball")) {
          next();
          return;
        }

        try {
          const method = (req.method ?? "GET").toUpperCase();
          const raw =
            method === "GET" || method === "HEAD" ? undefined : await readBody(req);
          const request = toFetchRequest(req, raw);
          const response = await handleSoftballRequest(request, resolveEnv(), store);
          res.statusCode = response.status;
          const cookies: string[] = [];
          response.headers.forEach((value, key) => {
            if (key.toLowerCase() === "set-cookie") cookies.push(value);
            else res.setHeader(key, value);
          });
          if (cookies.length === 1) res.setHeader("Set-Cookie", cookies[0]);
          if (cookies.length > 1) res.setHeader("Set-Cookie", cookies);
          const body = await response.text();
          res.end(body);
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : "Unknown error",
            }),
          );
        }
      });
    },
  };
}
