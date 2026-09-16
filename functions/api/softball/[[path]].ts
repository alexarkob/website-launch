import { handleSoftballRequest } from "../../../src/lib/softball/api";
import { kvStore, type KvLike } from "../../../src/lib/softball/store";
import type { SoftballEnv } from "../../../src/lib/softball/api";

interface Env extends SoftballEnv {
  SOFTBALL?: KvLike;
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export const onRequest = async (context: { request: Request; env: Env }) => {
  if (!context.env.SOFTBALL) {
    return json(
      {
        error:
          "SOFTBALL KV is not bound. Create a KV namespace and add it to wrangler.toml.",
      },
      500,
    );
  }
  return handleSoftballRequest(
    context.request,
    context.env,
    kvStore(context.env.SOFTBALL),
  );
};
