import { buildSystemPrompt, maxTokensForLength } from "./prompts";
import {
  DEFAULT_PROVIDER,
  isModelProviderId,
} from "./providers/catalog";
import {
  callModelProvider,
  type ProviderSecrets,
} from "./providers/run";
import { ReactApiError } from "./reactErrors";
import { retrieveChunks } from "./retrieve";
import type {
  ReactRequestBody,
  ReactResponseBody,
  ReactionLength,
  ThinkerId,
} from "./types";
import { isReactionLength, isThinkerId } from "./types";

export { ReactApiError } from "./reactErrors";

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES_APPROX = 4_000_000;
const MAX_KEY_LEN = 512;
const ALLOWED_MEDIA = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const KEY_FIELDS = [
  "GEMINI_API_KEY",
  "ANTHROPIC_API_KEY",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
] as const;

function parseVisitorKeys(
  rawKeys: unknown,
): ReactRequestBody["keys"] | undefined {
  if (rawKeys === undefined) return undefined;
  if (!rawKeys || typeof rawKeys !== "object" || Array.isArray(rawKeys)) {
    throw new ReactApiError(400, "keys must be an object");
  }
  const row = rawKeys as Record<string, unknown>;
  const out: NonNullable<ReactRequestBody["keys"]> = {};
  for (const field of KEY_FIELDS) {
    if (row[field] === undefined) continue;
    if (typeof row[field] !== "string") {
      throw new ReactApiError(400, `keys.${field} must be a string`);
    }
    const value = row[field].trim();
    if (!value) continue;
    if (value.length > MAX_KEY_LEN) {
      throw new ReactApiError(400, `keys.${field} is too long`);
    }
    out[field] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

export function parseReactRequest(body: unknown): ReactRequestBody {
  if (!body || typeof body !== "object") {
    throw new ReactApiError(400, "Request body must be a JSON object");
  }
  const raw = body as Record<string, unknown>;

  if (!isThinkerId(raw.thinkerId)) {
    throw new ReactApiError(400, "Invalid thinkerId");
  }
  if (!isReactionLength(raw.length)) {
    throw new ReactApiError(400, "Invalid length (use short|medium|long)");
  }

  let provider = DEFAULT_PROVIDER;
  if (raw.provider !== undefined) {
    if (!isModelProviderId(raw.provider)) {
      throw new ReactApiError(
        400,
        "Invalid provider (use gemini|claude|workers-ai)",
      );
    }
    provider = raw.provider;
  }

  const text = typeof raw.text === "string" ? raw.text : "";
  const attachmentsText =
    typeof raw.attachmentsText === "string" ? raw.attachmentsText : undefined;
  const keys = parseVisitorKeys(raw.keys);

  let images: ReactRequestBody["images"];
  if (raw.images !== undefined) {
    if (!Array.isArray(raw.images)) {
      throw new ReactApiError(400, "images must be an array");
    }
    if (raw.images.length > MAX_IMAGES) {
      throw new ReactApiError(400, `At most ${MAX_IMAGES} images allowed`);
    }
    images = raw.images.map((img, i) => {
      if (!img || typeof img !== "object") {
        throw new ReactApiError(400, `Invalid image at index ${i}`);
      }
      const row = img as Record<string, unknown>;
      const mediaType = row.mediaType;
      const dataBase64 = row.dataBase64;
      if (typeof mediaType !== "string" || !ALLOWED_MEDIA.has(mediaType)) {
        throw new ReactApiError(400, `Unsupported mediaType at index ${i}`);
      }
      if (typeof dataBase64 !== "string" || !dataBase64) {
        throw new ReactApiError(400, `Missing image data at index ${i}`);
      }
      if (dataBase64.length > MAX_IMAGE_BYTES_APPROX * 1.4) {
        throw new ReactApiError(400, `Image too large at index ${i}`);
      }
      return { mediaType, dataBase64 };
    });
  }

  if (!text.trim() && !attachmentsText?.trim() && !(images && images.length)) {
    throw new ReactApiError(400, "Provide text, attachments, or images");
  }

  return {
    thinkerId: raw.thinkerId,
    length: raw.length,
    provider,
    text,
    keys,
    attachmentsText,
    images,
  };
}

function buildUserText(input: ReactRequestBody): string {
  const bits: string[] = [];
  if (input.text.trim()) bits.push(input.text.trim());
  if (input.attachmentsText?.trim()) {
    bits.push(
      `Attached document text:\n${input.attachmentsText.trim().slice(0, 40000)}`,
    );
  }
  if (bits.length === 0) {
    bits.push(
      input.images?.length
        ? "React to the attached image(s) from your perspective."
        : "(No text provided — react briefly asking for more context.)",
    );
  }
  return bits.join("\n\n");
}

export function mergeProviderSecrets(
  base: ProviderSecrets,
  visitorKeys?: ReactRequestBody["keys"],
): ProviderSecrets {
  if (!visitorKeys) return base;
  return {
    ...base,
    ...(visitorKeys.GEMINI_API_KEY
      ? { GEMINI_API_KEY: visitorKeys.GEMINI_API_KEY }
      : {}),
    ...(visitorKeys.ANTHROPIC_API_KEY
      ? { ANTHROPIC_API_KEY: visitorKeys.ANTHROPIC_API_KEY }
      : {}),
    ...(visitorKeys.CLOUDFLARE_ACCOUNT_ID
      ? { CLOUDFLARE_ACCOUNT_ID: visitorKeys.CLOUDFLARE_ACCOUNT_ID }
      : {}),
    ...(visitorKeys.CLOUDFLARE_API_TOKEN
      ? { CLOUDFLARE_API_TOKEN: visitorKeys.CLOUDFLARE_API_TOKEN }
      : {}),
  };
}

export async function generateThinkerReaction(
  input: ReactRequestBody,
  secrets: ProviderSecrets,
): Promise<ReactResponseBody> {
  const thinkerId = input.thinkerId as ThinkerId;
  const length = input.length as ReactionLength;
  const provider = input.provider ?? DEFAULT_PROVIDER;
  const resolved = mergeProviderSecrets(secrets, input.keys);

  const query = [input.text, input.attachmentsText].filter(Boolean).join("\n");
  const chunks = retrieveChunks(thinkerId, query, 7);
  const system = buildSystemPrompt(thinkerId, length, chunks);

  const reaction = await callModelProvider(provider, resolved, {
    system,
    userText: buildUserText(input),
    images: input.images,
    maxTokens: maxTokensForLength(length),
  });

  return {
    reaction,
    thinkerId,
    length,
    provider,
    sourcesUsed: chunks.map((c) => ({
      id: c.id,
      title: c.title,
      url: c.url,
    })),
  };
}
