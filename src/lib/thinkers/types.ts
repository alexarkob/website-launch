import type { ModelProviderId } from "./providers/catalog";
import {
  DEFAULT_PROVIDER,
  isModelProviderId,
} from "./providers/catalog";

export type ThinkerId =
  | "packy-mccormick"
  | "ben-thompson"
  | "benedict-evans";

export type ReactionLength = "short" | "medium" | "long";

export type ThinkerProfile = {
  id: ThinkerId;
  displayName: string;
  bio: string;
  voice: string;
  styleNotes: string[];
  lengthGuidance: Record<ReactionLength, string>;
  sources: string[];
};

export type ThinkerChunk = {
  id: string;
  title: string;
  url?: string;
  date?: string;
  text: string;
};

export type ReactRequestBody = {
  thinkerId: ThinkerId;
  length: ReactionLength;
  text: string;
  provider?: ModelProviderId;
  keys?: Partial<{
    GEMINI_API_KEY: string;
    ANTHROPIC_API_KEY: string;
    CLOUDFLARE_ACCOUNT_ID: string;
    CLOUDFLARE_API_TOKEN: string;
  }>;
  images?: { mediaType: string; dataBase64: string }[];
  attachmentsText?: string;
};

export type ReactResponseBody = {
  reaction: string;
  sourcesUsed: { id: string; title: string; url?: string }[];
  thinkerId: ThinkerId;
  length: ReactionLength;
  provider: ModelProviderId;
};

export const THINKER_IDS: ThinkerId[] = [
  "packy-mccormick",
  "ben-thompson",
  "benedict-evans",
];

export const LENGTHS: ReactionLength[] = ["short", "medium", "long"];

export function isThinkerId(value: unknown): value is ThinkerId {
  return (
    typeof value === "string" &&
    (THINKER_IDS as string[]).includes(value)
  );
}

export function isReactionLength(value: unknown): value is ReactionLength {
  return typeof value === "string" && (LENGTHS as string[]).includes(value);
}

export { DEFAULT_PROVIDER, isModelProviderId };
