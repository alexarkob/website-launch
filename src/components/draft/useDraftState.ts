import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_NOTES_BOARD,
  EMPTY_STATE,
  PLAYER_MARKS,
  STORAGE_KEY,
  newId,
  type DraftState,
  type NotesBoard,
  type NotesFolder,
  type NotesScope,
  type NotesTile,
  type PlayerMark,
  type Tier,
} from "./types";

function normalizeMarks(
  raw: Partial<DraftState>["marks"],
): Record<string, PlayerMark[]> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, PlayerMark[]> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!Array.isArray(value)) continue;
    const cleaned = value.filter((m): m is PlayerMark =>
      PLAYER_MARKS.includes(m as PlayerMark),
    );
    if (cleaned.length) out[id] = cleaned;
  }
  return out;
}

function normalizeNotesBoard(parsed: Partial<DraftState>): NotesBoard {
  const board = parsed.notesBoard;
  if (board && Array.isArray(board.folders) && Array.isArray(board.tiles)) {
    return {
      folders: board.folders
        .filter((f): f is NotesFolder => !!f && typeof f.id === "string")
        .map((f) => ({
          id: f.id,
          name: typeof f.name === "string" && f.name.trim() ? f.name : "Folder",
        })),
      tiles: board.tiles
        .filter((t): t is NotesTile => !!t && typeof t.id === "string")
        .map((t) => ({
          id: t.id,
          title: typeof t.title === "string" && t.title.trim() ? t.title : "Untitled",
          body: typeof t.body === "string" ? t.body : "",
          folderId: typeof t.folderId === "string" ? t.folderId : null,
        })),
      activeTileId:
        typeof board.activeTileId === "string" ? board.activeTileId : null,
      scope:
        board.scope === "all" || board.scope === "unfiled" || typeof board.scope === "string"
          ? board.scope
          : "all",
    };
  }

  const legacy =
    typeof parsed.generalNotes === "string" ? parsed.generalNotes.trim() : "";
  if (legacy) {
    const id = newId();
    return {
      folders: [],
      tiles: [
        {
          id,
          title: "General notes",
          body: parsed.generalNotes ?? "",
          folderId: null,
        },
      ],
      activeTileId: id,
      scope: "all",
    };
  }

  return { ...EMPTY_NOTES_BOARD };
}

function loadState(): DraftState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<DraftState>;
    return {
      tiers: parsed.tiers ?? {},
      notes: parsed.notes ?? {},
      drafted: Array.isArray(parsed.drafted) ? parsed.drafted : [],
      marks: normalizeMarks(parsed.marks),
      notesBoard: normalizeNotesBoard(parsed),
    };
  } catch {
    return EMPTY_STATE;
  }
}

export function useDraftState() {
  const [state, setState] = useState<DraftState>(EMPTY_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const setTier = useCallback((playerId: string, tier: Tier | null) => {
    setState((prev) => {
      const tiers = { ...prev.tiers };
      if (tier === null) delete tiers[playerId];
      else tiers[playerId] = tier;
      return { ...prev, tiers };
    });
  }, []);

  const setNote = useCallback((playerId: string, note: string) => {
    setState((prev) => {
      const notes = { ...prev.notes };
      const trimmed = note.trim();
      if (!trimmed) delete notes[playerId];
      else notes[playerId] = note;
      return { ...prev, notes };
    });
  }, []);

  const toggleMark = useCallback((playerId: string, mark: PlayerMark) => {
    setState((prev) => {
      const current = prev.marks[playerId] ?? [];
      const nextMarks = current.includes(mark)
        ? current.filter((m) => m !== mark)
        : [...current, mark];
      const marks = { ...prev.marks };
      if (nextMarks.length === 0) delete marks[playerId];
      else marks[playerId] = nextMarks;
      return { ...prev, marks };
    });
  }, []);

  const setNotesScope = useCallback((scope: NotesScope) => {
    setState((prev) => ({
      ...prev,
      notesBoard: { ...prev.notesBoard, scope, activeTileId: null },
    }));
  }, []);

  const setActiveTile = useCallback((tileId: string | null) => {
    setState((prev) => ({
      ...prev,
      notesBoard: { ...prev.notesBoard, activeTileId: tileId },
    }));
  }, []);

  const addFolder = useCallback(() => {
    const folder: NotesFolder = { id: newId(), name: "New folder" };
    setState((prev) => ({
      ...prev,
      notesBoard: {
        ...prev.notesBoard,
        folders: [...prev.notesBoard.folders, folder],
        scope: folder.id,
        activeTileId: null,
      },
    }));
  }, []);

  const renameFolder = useCallback((folderId: string, name: string) => {
    setState((prev) => ({
      ...prev,
      notesBoard: {
        ...prev.notesBoard,
        folders: prev.notesBoard.folders.map((f) =>
          f.id === folderId ? { ...f, name: name.trim() || "Folder" } : f,
        ),
      },
    }));
  }, []);

  const deleteFolder = useCallback((folderId: string) => {
    setState((prev) => {
      const board = prev.notesBoard;
      return {
        ...prev,
        notesBoard: {
          ...board,
          folders: board.folders.filter((f) => f.id !== folderId),
          tiles: board.tiles.map((t) =>
            t.folderId === folderId ? { ...t, folderId: null } : t,
          ),
          scope: board.scope === folderId ? "all" : board.scope,
          activeTileId:
            board.tiles.find((t) => t.id === board.activeTileId)?.folderId ===
            folderId
              ? null
              : board.activeTileId,
        },
      };
    });
  }, []);

  const addTile = useCallback((folderId?: string | null) => {
    setState((prev) => {
      const scopeFolder =
        prev.notesBoard.scope !== "all" && prev.notesBoard.scope !== "unfiled"
          ? prev.notesBoard.scope
          : null;
      const explicitFolder = typeof folderId === "string" ? folderId : null;
      const useExplicit = folderId !== undefined;
      const targetFolder = useExplicit
        ? explicitFolder
        : prev.notesBoard.scope === "unfiled"
          ? null
          : scopeFolder;
      const created: NotesTile = {
        id: newId(),
        title: "Untitled note",
        body: "",
        folderId: targetFolder,
      };
      return {
        ...prev,
        notesBoard: {
          ...prev.notesBoard,
          tiles: [...prev.notesBoard.tiles, created],
          activeTileId: created.id,
        },
      };
    });
  }, []);

  const renameTile = useCallback((tileId: string, title: string) => {
    setState((prev) => ({
      ...prev,
      notesBoard: {
        ...prev.notesBoard,
        tiles: prev.notesBoard.tiles.map((t) =>
          t.id === tileId ? { ...t, title: title.trim() || "Untitled note" } : t,
        ),
      },
    }));
  }, []);

  const updateTileBody = useCallback((tileId: string, body: string) => {
    setState((prev) => ({
      ...prev,
      notesBoard: {
        ...prev.notesBoard,
        tiles: prev.notesBoard.tiles.map((t) =>
          t.id === tileId ? { ...t, body } : t,
        ),
      },
    }));
  }, []);

  const moveTile = useCallback((tileId: string, folderId: string | null) => {
    setState((prev) => ({
      ...prev,
      notesBoard: {
        ...prev.notesBoard,
        tiles: prev.notesBoard.tiles.map((t) =>
          t.id === tileId ? { ...t, folderId } : t,
        ),
      },
    }));
  }, []);

  const deleteTile = useCallback((tileId: string) => {
    setState((prev) => {
      const tiles = prev.notesBoard.tiles.filter((t) => t.id !== tileId);
      return {
        ...prev,
        notesBoard: {
          ...prev.notesBoard,
          tiles,
          activeTileId:
            prev.notesBoard.activeTileId === tileId
              ? null
              : prev.notesBoard.activeTileId,
        },
      };
    });
  }, []);

  const toggleDrafted = useCallback((playerId: string) => {
    setState((prev) => {
      const drafted = prev.drafted.includes(playerId)
        ? prev.drafted.filter((id) => id !== playerId)
        : [...prev.drafted, playerId];
      return { ...prev, drafted };
    });
  }, []);

  const markDrafted = useCallback((playerId: string, drafted: boolean) => {
    setState((prev) => {
      const has = prev.drafted.includes(playerId);
      if (drafted && !has) return { ...prev, drafted: [...prev.drafted, playerId] };
      if (!drafted && has)
        return { ...prev, drafted: prev.drafted.filter((id) => id !== playerId) };
      return prev;
    });
  }, []);

  const resetDrafted = useCallback(() => {
    setState((prev) => ({ ...prev, drafted: [] }));
  }, []);

  const clearAllPrep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      tiers: {},
      notes: {},
      drafted: [],
      marks: {},
      notesBoard: {
        folders: [],
        tiles: [],
        activeTileId: null,
        scope: "all",
      },
    }));
  }, []);

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${STORAGE_KEY}-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const importJson = useCallback(async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as Partial<DraftState>;
    setState({
      tiers: parsed.tiers ?? {},
      notes: parsed.notes ?? {},
      drafted: Array.isArray(parsed.drafted) ? parsed.drafted : [],
      marks: normalizeMarks(parsed.marks),
      notesBoard: normalizeNotesBoard(parsed),
    });
  }, []);

  return {
    state,
    hydrated,
    setTier,
    setNote,
    toggleMark,
    setNotesScope,
    setActiveTile,
    addFolder,
    renameFolder,
    deleteFolder,
    addTile,
    renameTile,
    updateTileBody,
    moveTile,
    deleteTile,
    toggleDrafted,
    markDrafted,
    resetDrafted,
    clearAllPrep,
    exportJson,
    importJson,
  };
}
