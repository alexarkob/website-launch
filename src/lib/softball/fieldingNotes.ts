import { POSITION_LABELS, type Player, type Position } from "./types";

export const FIELDING_NOTES_MAX = 4000;

export type FieldingConstraint =
  | { type: "rotate"; playerIds: string[]; positions: Position[] }
  | { type: "only"; playerIds: string[]; positions: Position[] }
  | { type: "prefer"; playerIds: string[]; positions: Position[] }
  | { type: "avoid"; playerIds: string[]; positions: Position[] };

export interface ParsedFieldingNotes {
  constraints: FieldingConstraint[];
  warnings: string[];
  summaries: string[];
}

const POSITION_ALIASES: { pattern: RegExp; position: Position }[] = [
  { pattern: /\bleft[\s-]*center\b/gi, position: "LC" },
  { pattern: /\bright[\s-]*center\b/gi, position: "RC" },
  { pattern: /\bleft[\s-]*field\b/gi, position: "LF" },
  { pattern: /\bright[\s-]*field\b/gi, position: "RF" },
  { pattern: /\bfirst[\s-]*base\b/gi, position: "1B" },
  { pattern: /\bsecond[\s-]*base\b/gi, position: "2B" },
  { pattern: /\bthird[\s-]*base\b/gi, position: "3B" },
  { pattern: /\bshort[\s-]*stops?\b/gi, position: "SS" },
  { pattern: /\bcatchers?\b/gi, position: "C" },
  { pattern: /\bpitchers?\b/gi, position: "P" },
  { pattern: /\b1b\b/gi, position: "1B" },
  { pattern: /\b2b\b/gi, position: "2B" },
  { pattern: /\b3b\b/gi, position: "3B" },
  { pattern: /\bss\b/gi, position: "SS" },
  { pattern: /\blf\b/gi, position: "LF" },
  { pattern: /\blc\b/gi, position: "LC" },
  { pattern: /\brc\b/gi, position: "RC" },
  { pattern: /\brf\b/gi, position: "RF" },
  { pattern: /\bC\b/g, position: "C" },
  { pattern: /\bP\b/g, position: "P" },
];

const AVOID_RE = /\b(avoid|never|don'?t|do not|keep off|sit out of|not at|stay off)\b/i;
const ROTATE_RE = /\b(rotat|variation|vary|across|share|cycle|shuffle|swap|mix|combin)\b/i;
const ONLY_RE =
  /\b(only|just|exclusively|restricted(?:\s+to)?|limit(?:ed)?\s+to|must only|should only|always)\b/i;
const IF_PLAYING_RE =
  /\bif\b[\s\S]{0,60}\b(play(?:ing|s)?|in|on the fields?)\b|\bwhen\b[\s\S]{0,60}\b(play(?:ing|s)?|on the fields?)\b/i;
const PREFERRED_FALLBACK_RE =
  /\b(certain|preferred|listed|those|their)\s+positions?\b|\bpositions they (?:know|prefer)\b/i;

const NAME_STOPWORDS = new Set([
  "the",
  "and",
  "or",
  "in",
  "at",
  "to",
  "of",
  "a",
  "an",
  "will",
  "be",
  "is",
  "are",
  "if",
  "when",
  "they",
  "them",
  "their",
  "should",
  "only",
  "just",
  "play",
  "plays",
  "playing",
  "player",
  "players",
  "ideally",
  "ideall",
  "ideal",
  "certain",
  "preferred",
  "listed",
  "those",
  "position",
  "positions",
  "across",
  "variation",
  "field",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function namesOf(roster: Player[], ids: string[]): string {
  const byId = new Map(roster.map((player) => [player.id, player.name.trim() || "Unnamed"]));
  return ids.map((id) => byId.get(id) || "player").join(", ");
}

function labelsFor(positions: Position[]): string {
  return positions.map((position) => `${position} (${POSITION_LABELS[position]})`).join(", ");
}

function findPositions(text: string): Position[] {
  const hits: { index: number; position: Position }[] = [];
  const seen = new Set<Position>();
  for (const { pattern, position } of POSITION_ALIASES) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match && !seen.has(position)) {
      seen.add(position);
      hits.push({ index: match.index, position });
    }
  }
  return hits.sort((a, b) => a.index - b.index).map((hit) => hit.position);
}

function nameKeys(player: Player): string[] {
  const name = player.name.trim();
  if (!name) return [];
  const keys = [name];
  const first = name.split(/\s+/)[0];
  if (first && first.length >= 2 && first.toLowerCase() !== name.toLowerCase()) {
    keys.push(first);
  }
  return keys;
}

function findPlayers(text: string, roster: Player[]): { players: Player[]; leftover: string[] } {
  const named = roster.filter((player) => player.name.trim());
  const firstCounts = new Map<string, number>();
  for (const player of named) {
    const first = player.name.trim().split(/\s+/)[0]?.toLowerCase();
    if (first) firstCounts.set(first, (firstCounts.get(first) ?? 0) + 1);
  }

  const matches: { player: Player; index: number }[] = [];
  const used = new Set<string>();
  const keys = named
    .flatMap((player) =>
      nameKeys(player).map((key) => ({
        player,
        key,
        allow: key.includes(" ") || (firstCounts.get(key.toLowerCase()) ?? 0) === 1,
      })),
    )
    .filter((row) => row.allow)
    .sort((a, b) => b.key.length - a.key.length);

  for (const row of keys) {
    if (used.has(row.player.id)) continue;
    const pattern = new RegExp(`\\b${escapeRegExp(row.key)}\\b`, "i");
    const match = pattern.exec(text);
    if (!match) continue;
    used.add(row.player.id);
    matches.push({ player: row.player, index: match.index });
  }

  matches.sort((a, b) => a.index - b.index);
  const players = matches.map((row) => row.player);

  const leftover: string[] = [];
  const mentioned = text.split(/\s*(?:,|&|\/| and )\s*/i).map((part) => part.trim()).filter(Boolean);
  for (const chunk of mentioned) {
    const token = chunk.replace(/[^A-Za-z0-9.'-].*$/, "").trim();
    if (token.length < 2 || NAME_STOPWORDS.has(token.toLowerCase())) continue;
    if (findPositions(token).length) continue;
    if (players.some((player) => nameKeys(player).some((key) => key.toLowerCase() === token.toLowerCase()))) {
      continue;
    }
    if (/^[A-Z][a-z]+/.test(token) && !named.some((player) => player.name.toLowerCase().includes(token.toLowerCase()))) {
      leftover.push(token);
    }
  }

  return { players, leftover: unique(leftover) };
}

function splitNotes(notes: string): string[] {
  return notes
    .split(/\n+|;+|(?<=[.!?])\s+|(?=\bIf\b)/)
    .map((chunk) => chunk.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s*/, "").trim())
    .filter((chunk) => chunk.length > 1);
}

function fallbackPositions(players: Player[]): Position[] {
  return unique(players.flatMap((player) => player.positions));
}

function summarize(constraint: FieldingConstraint, roster: Player[]): string {
  const who = namesOf(roster, constraint.playerIds);
  const where = labelsFor(constraint.positions);
  if (constraint.type === "rotate") return `Rotate ${who} across ${where}.`;
  if (constraint.type === "only") return `If ${who} ${constraint.playerIds.length === 1 ? "is" : "are"} playing, only ${where}.`;
  if (constraint.type === "avoid") return `Keep ${who} off ${where}.`;
  return `Prefer ${who} at ${where}.`;
}

function constraintFromLine(line: string, roster: Player[]): {
  constraints: FieldingConstraint[];
  warnings: string[];
} {
  const { players, leftover } = findPlayers(line, roster);
  const warnings = leftover.map((name) => `No roster match for “${name}”.`);
  if (!players.length) return { constraints: [], warnings };

  const playerIds = unique(players.map((player) => player.id));
  let positions = findPositions(line);
  const ifPlaying = IF_PLAYING_RE.test(line);
  const only = ONLY_RE.test(line) || ifPlaying;
  const rotate = ROTATE_RE.test(line);

  if (!positions.length && only && PREFERRED_FALLBACK_RE.test(line)) {
    const missing = players.filter((player) => player.positions.length === 0);
    if (missing.length) {
      warnings.push(
        `${missing.map((player) => player.name.trim() || "Unnamed").join(", ")} ${
          missing.length === 1 ? "has" : "have"
        } no preferred positions on the roster to limit to.`,
      );
    }
    const withSpots = players.filter((player) => player.positions.length > 0);
    return {
      constraints: withSpots.map((player) => ({
        type: "only" as const,
        playerIds: [player.id],
        positions: player.positions,
      })),
      warnings,
    };
  }

  if (!positions.length && only) {
    positions = fallbackPositions(players);
    if (!positions.length) {
      warnings.push("That note names players to limit, but no positions were listed.");
      return { constraints: [], warnings };
    }
  }

  if (!positions.length) return { constraints: [], warnings };

  if (AVOID_RE.test(line) && !only) {
    return { constraints: [{ type: "avoid", playerIds, positions }], warnings };
  }
  // "If they're playing, stay in these spots" is a limit, not a force-on-field rotation.
  if (only && !(rotate && !ifPlaying && playerIds.length >= 2 && positions.length >= 2)) {
    return { constraints: [{ type: "only", playerIds, positions }], warnings };
  }
  if (rotate || (playerIds.length >= 2 && positions.length >= 2 && !only)) {
    return { constraints: [{ type: "rotate", playerIds, positions }], warnings };
  }
  if (playerIds.length >= 1 && positions.length >= 2) {
    return { constraints: [{ type: "only", playerIds, positions }], warnings };
  }
  return { constraints: [{ type: "prefer", playerIds, positions }], warnings };
}

export function parseFieldingNotes(notes: string, roster: Player[]): ParsedFieldingNotes {
  const text = notes.trim().slice(0, FIELDING_NOTES_MAX);
  if (!text) return { constraints: [], warnings: [], summaries: [] };

  const constraints: FieldingConstraint[] = [];
  const warnings: string[] = [];
  for (const line of splitNotes(text)) {
    const parsed = constraintFromLine(line, roster);
    warnings.push(...parsed.warnings);
    constraints.push(...parsed.constraints);
  }

  if (text && !constraints.length) {
    warnings.push("Private notes did not match any roster players and positions.");
  }

  return {
    constraints,
    warnings: unique(warnings),
    summaries: unique(constraints.map((constraint) => summarize(constraint, roster))),
  };
}

export function clipFieldingNotes(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.slice(0, FIELDING_NOTES_MAX);
}
