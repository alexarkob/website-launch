import {
  generateThinkerReaction,
  parseReactRequest,
  ReactApiError,
} from "../../../src/lib/thinkers/react";
import type { ProviderSecrets } from "../../../src/lib/thinkers/providers/run";

type Env = ProviderSecrets;

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export const onRequestPost = async (context: {
  request: Request;
  env: Env;
}) => {
  try {
    const body = await context.request.json();
    const input = parseReactRequest(body);
    const result = await generateThinkerReaction(input, context.env);
    return json(result);
  } catch (error) {
    if (error instanceof ReactApiError) {
      return json({ error: error.message }, error.status);
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 502);
  }
};

export const onRequest = async (context: {
  request: Request;
  env: Env;
}) => {
  if (context.request.method === "POST") {
    return onRequestPost(context);
  }
  return json({ error: "Method not allowed" }, 405);
};
