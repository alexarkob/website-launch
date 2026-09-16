import { retrieveChunks } from "../src/lib/thinkers/retrieve.ts";
import {
  parseReactRequest,
  ReactApiError,
} from "../src/lib/thinkers/react.ts";
import { listThinkerProfiles } from "../src/lib/thinkers/profiles.ts";
import { buildSystemPrompt } from "../src/lib/thinkers/prompts.ts";
import {
  DEFAULT_PROVIDER,
  listProviders,
} from "../src/lib/thinkers/providers/catalog.ts";
import { missingKeysForProvider } from "../src/lib/thinkers/providers/run.ts";

const profiles = listThinkerProfiles();
console.log("profiles", profiles.map((p) => p.id).join(", "));
console.log("default provider", DEFAULT_PROVIDER);
for (const p of listProviders()) {
  console.log(
    `provider ${p.id}: ${p.costBadge} | needs ${p.envKeys.join("+")}`,
  );
}

for (const id of [
  "packy-mccormick",
  "ben-thompson",
  "benedict-evans",
] as const) {
  const hits = retrieveChunks(id, "AI platforms aggregation mobile", 3);
  console.log(id, "→", hits.map((h) => h.id).join(", "));
  console.log("  system chars", buildSystemPrompt(id, "short", hits).length);
}

try {
  parseReactRequest({ thinkerId: "nope", length: "short", text: "hi" });
} catch (e) {
  console.log("bad thinker:", e instanceof ReactApiError ? e.message : e);
}

const ok = parseReactRequest({
  thinkerId: "benedict-evans",
  length: "long",
  provider: "gemini",
  text: "What changes with AI agents?",
});
console.log("parsed ok", ok.thinkerId, ok.provider);

console.log(
  "gemini missing",
  missingKeysForProvider("gemini", {}).join(",") || "(none)",
);
console.log(
  "claude missing",
  missingKeysForProvider("claude", {}).join(",") || "(none)",
);
console.log("smoke OK");
