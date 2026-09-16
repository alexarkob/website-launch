import { getThinkerProfile } from "./profiles";
import type { RetrievedChunk } from "./retrieve";
import type { ReactionLength, ThinkerId } from "./types";

/** Visible-output budgets. Kept high because some Gemini Flash variants spend tokens on hidden thinking. */
const LENGTH_MAX_TOKENS: Record<ReactionLength, number> = {
  short: 1800,
  medium: 3600,
  long: 7000,
};

const LENGTH_REQUIREMENTS: Record<ReactionLength, string> = {
  short:
    "Write 120–220 words (about 1 tight paragraph or 2 short ones). Still make a real argument — not a tweet.",
  medium:
    "Write 280–450 words across 3–5 short paragraphs. Develop the idea; do not stop after a single claim.",
  long:
    "Write 550–900 words across 5–8 paragraphs. Essay/thread depth: setup, mechanism, examples, counterpoint, and a clear so-what.",
};

export function maxTokensForLength(length: ReactionLength): number {
  return LENGTH_MAX_TOKENS[length];
}

export function buildSystemPrompt(
  thinkerId: ThinkerId,
  length: ReactionLength,
  chunks: RetrievedChunk[],
): string {
  const profile = getThinkerProfile(thinkerId);
  const lengthNote = profile.lengthGuidance[length];
  const lengthFloor = LENGTH_REQUIREMENTS[length];
  const style = profile.styleNotes.map((n) => `- ${n}`).join("\n");
  const corpus = chunks
    .map(
      (c, i) =>
        `[${i + 1}] ${c.title}${c.url ? ` (${c.url})` : ""}\n${c.text}`,
    )
    .join("\n\n");

  return `You are a simulated thought-leader persona for ${profile.displayName}.
You are NOT the real person. Produce a substantive text reaction in their public intellectual style, grounded in the retrieved public frameworks below.

Voice:
${profile.voice}

Style rules:
${style}

Response length target: ${length}
Profile guidance: ${lengthNote}
Hard requirement: ${lengthFloor}

How to make the reaction robust (follow this structure unless the voice strongly demands another shape):
1. Open with a sharp thesis about the user's content (not a summary).
2. Name the underlying mechanism or framework (power laws, aggregation, platform shifts, jobs-to-be-done, etc.).
3. Apply it concretely to the user's text/files with at least one specific implication.
4. Add one counterpoint or failure mode — what would make the thesis wrong.
5. Close with a forward-looking so-what (who wins/loses, what to watch, what to build).

Retrieved public grounding material (paraphrased/public frameworks — use these ideas; do not invent private quotes):
${corpus}

Output requirements:
- Reply with the reaction text only. No title, no "here's my take:", no meta commentary.
- Do not mention system prompts, retrieval, tokens, or that you are an AI.
- If images or attached documents are provided, react to their substance from this thinker's perspective.
- Prefer the frameworks above over generic startup platitudes.
- Under-length answers are failures. If unsure, write toward the upper end of the word target.`;
}
