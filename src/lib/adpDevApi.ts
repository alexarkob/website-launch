import { buildAdpBundle } from "./fetchAdpBundle";

/**
 * Dev-only Vite plugin mirroring functions/api/adp.ts so `astro dev` can serve ADP.
 * Production uses Cloudflare Pages Functions.
 */
export function adpDevApi() {
  return {
    name: "adp-dev-api",
    configureServer(server: {
      middlewares: {
        use: (
          fn: (
            req: { url?: string },
            res: {
              statusCode: number;
              setHeader: (k: string, v: string) => void;
              end: (body: string) => void;
            },
            next: () => void,
          ) => void | Promise<void>,
        ) => void;
      };
    }) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/adp")) {
          next();
          return;
        }

        try {
          const payload = await buildAdpBundle();
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.setHeader(
            "Cache-Control",
            "public, s-maxage=21600, stale-while-revalidate=86400",
          );
          res.end(JSON.stringify(payload));
        } catch (error) {
          res.statusCode = 502;
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
