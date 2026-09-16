import { PROVIDERS, type ModelProviderId } from "./catalog";
import { ReactApiError } from "../reactErrors";

export type ProviderImage = { mediaType: string; dataBase64: string };

export type ProviderCallInput = {
  system: string;
  userText: string;
  images?: ProviderImage[];
  maxTokens: number;
};

export type ProviderSecrets = {
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  /** Optional Pages AI binding when deployed on Cloudflare */
  AI?: {
    run: (
      model: string,
      input: Record<string, unknown>,
    ) => Promise<unknown>;
  };
};

export function missingKeysForProvider(
  provider: ModelProviderId,
  secrets: ProviderSecrets,
): string[] {
  if (provider === "workers-ai" && secrets.AI) {
    // Production Pages AI binding — no REST token needed
    return [];
  }
  return PROVIDERS[provider].envKeys.filter((key) => {
    const value = secrets[key as keyof ProviderSecrets];
    return typeof value !== "string" || !value.trim();
  });
}

export function requireProviderSecrets(
  provider: ModelProviderId,
  secrets: ProviderSecrets,
): void {
  const missing = missingKeysForProvider(provider, secrets);
  if (missing.length === 0) return;

  const info = PROVIDERS[provider];
  throw new ReactApiError(
    500,
    `${info.label} needs ${missing.join(" + ")}. ${info.costNote} Add the missing value(s) in the API keys section on this page (saved in your browser), then try again.`,
  );
}

async function callClaude(
  secrets: ProviderSecrets,
  input: ProviderCallInput,
): Promise<string> {
  const apiKey = secrets.ANTHROPIC_API_KEY!;
  const content: Array<
    | { type: "text"; text: string }
    | {
        type: "image";
        source: { type: "base64"; media_type: string; data: string };
      }
  > = [{ type: "text", text: input.userText }];

  for (const image of input.images ?? []) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: image.mediaType,
        data: image.dataBase64,
      },
    });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: PROVIDERS.claude.model,
      max_tokens: input.maxTokens,
      temperature: 0.85,
      system:
        input.system +
        "\n\nWrite a robust, fully developed reaction that meets the length target.",
      messages: [{ role: "user", content }],
    }),
  });

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new ReactApiError(
      res.status >= 400 && res.status < 600 ? res.status : 502,
      data.error?.message || `Anthropic API error (${res.status})`,
    );
  }

  const text = (data.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!text) throw new ReactApiError(502, "Empty response from Claude");
  return text;
}

async function callGemini(
  secrets: ProviderSecrets,
  input: ProviderCallInput,
): Promise<string> {
  const apiKey = secrets.GEMINI_API_KEY!;
  const model = PROVIDERS.gemini.model;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const userParts: Array<Record<string, unknown>> = [
    {
      text:
        input.userText +
        "\n\nWrite a robust, fully developed reaction that meets the length target. Do not answer in a single short sentence.",
    },
  ];
  for (const image of input.images ?? []) {
    userParts.push({
      inline_data: {
        mime_type: image.mediaType,
        data: image.dataBase64,
      },
    });
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: input.system }],
      },
      contents: [{ role: "user", parts: userParts }],
      generationConfig: {
        maxOutputTokens: input.maxTokens,
        temperature: 0.9,
      },
    }),
  });

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new ReactApiError(
      res.status >= 400 && res.status < 600 ? res.status : 502,
      data.error?.message || `Gemini API error (${res.status})`,
    );
  }

  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("\n")
    .trim();

  if (!text) throw new ReactApiError(502, "Empty response from Gemini");
  return text;
}

type WorkersMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | {
            type: "image_url";
            image_url: { url: string };
          }
      >;
};

async function callWorkersAi(
  secrets: ProviderSecrets,
  input: ProviderCallInput,
): Promise<string> {
  const model = PROVIDERS["workers-ai"].model;
  const userContent: WorkersMessage["content"] =
    input.images && input.images.length > 0
      ? [
          { type: "text", text: input.userText },
          ...input.images.map((img) => ({
            type: "image_url" as const,
            image_url: {
              url: `data:${img.mediaType};base64,${img.dataBase64}`,
            },
          })),
        ]
      : input.userText;

  const messages: WorkersMessage[] = [
    {
      role: "system",
      content:
        input.system +
        "\n\nWrite a robust, fully developed reaction that meets the length target.",
    },
    { role: "user", content: userContent },
  ];

  const payload = {
    messages,
    max_tokens: input.maxTokens,
  };

  if (secrets.AI) {
    const result = await secrets.AI.run(model, payload);
    const text = extractWorkersText(result);
    if (!text) throw new ReactApiError(502, "Empty response from Workers AI");
    return text;
  }

  const accountId = secrets.CLOUDFLARE_ACCOUNT_ID!;
  const token = secrets.CLOUDFLARE_API_TOKEN!;
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const data = (await res.json()) as {
    success?: boolean;
    result?: unknown;
    errors?: Array<{ message?: string }>;
  };

  if (!res.ok || data.success === false) {
    const msg =
      data.errors?.map((e) => e.message).filter(Boolean).join("; ") ||
      `Workers AI error (${res.status})`;
    throw new ReactApiError(
      res.status >= 400 && res.status < 600 ? res.status : 502,
      msg,
    );
  }

  const text = extractWorkersText(data.result);
  if (!text) throw new ReactApiError(502, "Empty response from Workers AI");
  return text;
}

function extractWorkersText(result: unknown): string {
  if (!result) return "";
  if (typeof result === "string") return result.trim();
  if (typeof result === "object") {
    const row = result as Record<string, unknown>;
    if (typeof row.response === "string") return row.response.trim();
    if (typeof row.result === "string") return row.result.trim();
    if (typeof row.text === "string") return row.text.trim();
  }
  return "";
}

export async function callModelProvider(
  provider: ModelProviderId,
  secrets: ProviderSecrets,
  input: ProviderCallInput,
): Promise<string> {
  requireProviderSecrets(provider, secrets);

  switch (provider) {
    case "claude":
      return callClaude(secrets, input);
    case "gemini":
      return callGemini(secrets, input);
    case "workers-ai":
      return callWorkersAi(secrets, input);
    default: {
      const _exhaustive: never = provider;
      throw new ReactApiError(400, `Unknown provider: ${_exhaustive}`);
    }
  }
}
