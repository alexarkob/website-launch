export type Position = "QB" | "RB" | "WR" | "TE" | "DST" | "K";

export type Tier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type PriorStats = {
  pts?: number;
  passYds?: number;
  passTd?: number;
  passInt?: number;
  rushYds?: number;
  rushTd?: number;
  rushAtt?: number;
  receptions?: number;
  recYds?: number;
  recTd?: number;
  targets?: number;
  fgm?: number;
  xpm?: number;
  sacks?: number;
  ints?: number;
  fumRec?: number;
  defTd?: number;
};

export type Player = {
  id: string;
  name: string;
  position: Position;
  team: string;
  bye: number;
  adp: number;
  projectedPoints: number | null;
  headshotUrl: string | null;
  lastYear: PriorStats | null;
};

export type NotesFolder = {
  id: string;
  name: string;
};

export type NotesTile = {
  id: string;
  title: string;
  body: string;
  folderId: string | null;
};

/** null = Unfiled, "all" = every note, otherwise a folder id */
export type NotesScope = "all" | "unfiled" | string;

export type NotesBoard = {
  folders: NotesFolder[];
  tiles: NotesTile[];
  activeTileId: string | null;
  scope: NotesScope;
};

export type DraftState = {
  tiers: Record<string, Tier>;
  notes: Record<string, string>;
  drafted: string[];
  marks: Record<string, PlayerMark[]>;
  /** @deprecated migrated into notesBoard */
  generalNotes?: string;
  notesBoard: NotesBoard;
};

export type AdpResponse = {
  players: Player[];
  fetchedAt: string;
  source: string;
  format: string;
  seasons?: { projections: string; priorStats: string };
};

export type ListTab = "ALL" | Position | "TIERS" | "NOTES";

export type PlayerMark = "star" | "target" | "dollar" | "caution" | "stop";

export const POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "DST", "K"];

export const POSITION_LABELS: Record<Position, string> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  DST: "D/ST",
  K: "K",
};

export const TIERS: Tier[] = [1, 2, 3, 4, 5, 6, 7, 8];

export const PLAYER_MARKS: PlayerMark[] = [
  "star",
  "target",
  "dollar",
  "caution",
  "stop",
];

export const PLAYER_MARK_LABELS: Record<PlayerMark, string> = {
  star: "Star",
  target: "Target",
  dollar: "Value",
  caution: "Caution",
  stop: "Avoid",
};

export const STORAGE_KEY = "ff-draft-2026";

export const EMPTY_NOTES_BOARD: NotesBoard = {
  folders: [],
  tiles: [],
  activeTileId: null,
  scope: "all",
};

export const EMPTY_STATE: DraftState = {
  tiers: {},
  notes: {},
  drafted: [],
  marks: {},
  notesBoard: EMPTY_NOTES_BOARD,
};

export function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
