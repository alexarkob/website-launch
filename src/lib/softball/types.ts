export const POSITIONS = [
  "C",
  "P",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "LC",
  "RC",
  "RF",
] as const;

export type Position = (typeof POSITIONS)[number];

export const POSITION_LABELS: Record<Position, string> = {
  C: "Catcher",
  P: "Pitcher",
  "1B": "First Base",
  "2B": "Second Base",
  "3B": "Third Base",
  SS: "Short Stop",
  LF: "Left Field",
  LC: "Left Center",
  RC: "Right Center",
  RF: "Right Field",
};

export type Gender = "female" | "male";

export const INNING_COUNT = 6;
export const FIELD_SPOTS = 10;
export const MAX_MEN_ON_FIELD = 7;

export interface WalkUpSong {
  spotifyId: string;
  name: string;
  artists: string;
  uri: string;
  albumArt?: string;
}

export interface Player {
  id: string;
  name: string;
  gender: Gender;
  positions: Position[];
  present: boolean;
  walkUpSong: WalkUpSong | null;
}

export type Defense = Record<Position, string | null>;

export interface FieldingInning {
  defense: Defense;
  bench: string[];
}

export interface TeamState {
  roster: Player[];
  battingOrder: string[];
  innings: FieldingInning[];
  needsRegen: boolean;
  spotify: {
    connected: boolean;
    playlistId?: string;
    playlistUrl?: string;
  };
}

export interface TeamPublic {
  id: string;
  name: string;
  season: string;
}

export interface TeamRecord {
  id: string;
  name: string;
  season: string;
  passwordHash: string;
  passwordSalt: string;
  spotifyRefreshToken?: string;
  spotifyPlaylistId?: string;
  spotifyPlaylistUrl?: string;
  state: Omit<TeamState, "spotify">;
  createdAt: string;
}

export interface ClientTeamPayload {
  team: TeamPublic;
  state: TeamState;
}

export function emptyDefense(): Defense {
  return {
    C: null,
    P: null,
    "1B": null,
    "2B": null,
    "3B": null,
    SS: null,
    LF: null,
    LC: null,
    RC: null,
    RF: null,
  };
}

export function emptyInning(): FieldingInning {
  return { defense: emptyDefense(), bench: [] };
}

export function emptyStoredState(): Omit<TeamState, "spotify"> {
  return {
    roster: [],
    battingOrder: [],
    innings: Array.from({ length: INNING_COUNT }, emptyInning),
    needsRegen: false,
  };
}

export function toClientState(team: TeamRecord): TeamState {
  return {
    ...team.state,
    innings:
      team.state.innings.length === INNING_COUNT
        ? team.state.innings
        : Array.from({ length: INNING_COUNT }, (_, i) => team.state.innings[i] ?? emptyInning()),
    spotify: {
      connected: Boolean(team.spotifyRefreshToken),
      playlistId: team.spotifyPlaylistId,
      playlistUrl: team.spotifyPlaylistUrl,
    },
  };
}

export function presentPlayers(roster: Player[]): Player[] {
  return roster.filter((player) => player.present);
}

export function playersById(roster: Player[]): Map<string, Player> {
  return new Map(roster.map((player) => [player.id, player]));
}
