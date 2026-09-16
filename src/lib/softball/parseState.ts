import {
  INNING_COUNT,
  POSITIONS,
  emptyDefense,
  emptyInning,
  type Defense,
  type FieldingInning,
  type Gender,
  type Player,
  type Position,
  type TeamState,
  type WalkUpSong,
} from "./types";

function isGender(value: unknown): value is Gender {
  return value === "female" || value === "male";
}

function isPosition(value: unknown): value is Position {
  return typeof value === "string" && (POSITIONS as readonly string[]).includes(value);
}

function parseSong(value: unknown): WalkUpSong | null {
  if (!value || typeof value !== "object") return null;
  const song = value as Record<string, unknown>;
  if (typeof song.spotifyId !== "string" || typeof song.name !== "string") return null;
  if (typeof song.artists !== "string" || typeof song.uri !== "string") return null;
  return {
    spotifyId: song.spotifyId,
    name: song.name,
    artists: song.artists,
    uri: song.uri,
    albumArt: typeof song.albumArt === "string" ? song.albumArt : undefined,
  };
}

function parsePlayer(value: unknown): Player | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.name !== "string") return null;
  if (!isGender(row.gender)) return null;
  const positions = Array.isArray(row.positions) ? row.positions.filter(isPosition) : [];
  return {
    id: row.id,
    name: row.name,
    gender: row.gender,
    positions,
    present: row.present !== false,
    walkUpSong: parseSong(row.walkUpSong),
  };
}

function parseDefense(value: unknown): Defense {
  const defense = emptyDefense();
  if (!value || typeof value !== "object") return defense;
  const row = value as Record<string, unknown>;
  for (const position of POSITIONS) {
    const id = row[position];
    defense[position] = typeof id === "string" && id ? id : null;
  }
  return defense;
}

function parseInning(value: unknown): FieldingInning {
  if (!value || typeof value !== "object") return emptyInning();
  const row = value as Record<string, unknown>;
  const defense = parseDefense(row.defense);
  const bench = Array.isArray(row.bench)
    ? row.bench.filter((id): id is string => typeof id === "string")
    : [];
  return { defense, bench };
}

export function parseClientState(value: unknown): Omit<TeamState, "spotify"> {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid team state");
  }
  const row = value as Record<string, unknown>;
  const roster = Array.isArray(row.roster)
    ? row.roster.map(parsePlayer).filter((player): player is Player => Boolean(player))
    : [];
  const battingOrder = Array.isArray(row.battingOrder)
    ? row.battingOrder.filter((id): id is string => typeof id === "string")
    : [];
  const parsedInnings = Array.isArray(row.innings) ? row.innings.map(parseInning) : [];
  const innings = Array.from(
    { length: INNING_COUNT },
    (_, index) => parsedInnings[index] ?? emptyInning(),
  );

  return {
    roster,
    battingOrder,
    innings,
    needsRegen: Boolean(row.needsRegen),
  };
}
