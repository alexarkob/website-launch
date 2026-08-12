import { useEffect, useMemo, useRef, type ReactNode } from "react";
import type {
  NotesBoard,
  NotesFolder,
  NotesScope,
  NotesTile,
} from "./types";

type Props = {
  board: NotesBoard;
  onScope: (scope: NotesScope) => void;
  onSelectTile: (id: string | null) => void;
  onAddFolder: () => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onAddTile: () => void;
  onRenameTile: (id: string, title: string) => void;
  onUpdateBody: (id: string, body: string) => void;
  onMoveTile: (id: string, folderId: string | null) => void;
  onDeleteTile: (id: string) => void;
};

type Command =
  | "bold"
  | "italic"
  | "underline"
  | "insertUnorderedList"
  | "insertOrderedList"
  | "justifyLeft"
  | "justifyCenter"
  | "formatBlock";

function runCommand(command: Command, value?: string) {
  document.execCommand(command, false, value);
}

function plainPreview(html: string) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || "Empty note";
}

export function GeneralNotesEditor({
  board,
  onScope,
  onSelectTile,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
  onAddTile,
  onRenameTile,
  onUpdateBody,
  onMoveTile,
  onDeleteTile,
}: Props) {
  const activeTile =
    board.tiles.find((t) => t.id === board.activeTileId) ?? null;

  const visibleTiles = useMemo(() => {
    if (board.scope === "all") return board.tiles;
    if (board.scope === "unfiled")
      return board.tiles.filter((t) => t.folderId == null);
    return board.tiles.filter((t) => t.folderId === board.scope);
  }, [board.tiles, board.scope]);

  const scopeLabel =
    board.scope === "all"
      ? "All notes"
      : board.scope === "unfiled"
        ? "Unfiled"
        : board.folders.find((f) => f.id === board.scope)?.name ?? "Folder";

  return (
    <div className="general-notes">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">General notes</h2>
          <p className="text-xs text-muted">
            Folders and labeled tiles for pick strategies — autosaves here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAddFolder}
            className="rounded-md border border-ink/15 px-3 py-1.5 text-sm hover:bg-ink/5"
          >
            New folder
          </button>
          <button
            type="button"
            onClick={() => onAddTile()}
            className="rounded-md bg-signal px-3 py-1.5 text-sm font-medium text-paper hover:bg-signal-bright"
          >
            New note
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="rounded-lg border border-paper-deep bg-paper-deep/30 p-2">
          <nav className="space-y-1">
            <ScopeButton
              active={board.scope === "all"}
              onClick={() => onScope("all")}
              label="All notes"
              count={board.tiles.length}
            />
            <ScopeButton
              active={board.scope === "unfiled"}
              onClick={() => onScope("unfiled")}
              label="Unfiled"
              count={board.tiles.filter((t) => t.folderId == null).length}
            />
            <p className="px-2 pb-1 pt-3 text-[0.65rem] font-semibold uppercase tracking-wide text-muted">
              Folders
            </p>
            {board.folders.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted">No folders yet</p>
            ) : null}
            {board.folders.map((folder) => (
              <FolderRow
                key={folder.id}
                folder={folder}
                active={board.scope === folder.id}
                count={board.tiles.filter((t) => t.folderId === folder.id).length}
                onSelect={() => onScope(folder.id)}
                onRename={(name) => onRenameFolder(folder.id, name)}
                onDelete={() => {
                  if (
                    confirm(
                      `Delete folder “${folder.name}”? Notes inside move to Unfiled.`,
                    )
                  ) {
                    onDeleteFolder(folder.id);
                  }
                }}
              />
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-3">
          {activeTile ? (
            <TileEditor
              tile={activeTile}
              folders={board.folders}
              onBack={() => onSelectTile(null)}
              onRename={(title) => onRenameTile(activeTile.id, title)}
              onUpdateBody={(body) => onUpdateBody(activeTile.id, body)}
              onMove={(folderId) => onMoveTile(activeTile.id, folderId)}
              onDelete={() => {
                if (confirm(`Delete note “${activeTile.title}”?`)) {
                  onDeleteTile(activeTile.id);
                }
              }}
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{scopeLabel}</h3>
                <span className="text-xs text-muted">
                  {visibleTiles.length} note
                  {visibleTiles.length === 1 ? "" : "s"}
                </span>
              </div>
              {visibleTiles.length === 0 ? (
                <div className="rounded-lg border border-dashed border-muted/40 px-4 py-12 text-center text-sm text-muted">
                  No notes here yet. Create a labeled tile for a pick strategy.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleTiles.map((tile) => (
                    <button
                      key={tile.id}
                      type="button"
                      onClick={() => onSelectTile(tile.id)}
                      className="note-tile rounded-lg border border-paper-deep bg-paper p-3 text-left transition hover:border-signal/40 hover:shadow-sm"
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <span className="font-medium leading-snug">
                          {tile.title}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          className="shrink-0 rounded px-1.5 py-0.5 text-[0.65rem] text-muted hover:bg-ink/5 hover:text-ink"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete note “${tile.title}”?`)) {
                              onDeleteTile(tile.id);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              if (confirm(`Delete note “${tile.title}”?`)) {
                                onDeleteTile(tile.id);
                              }
                            }
                          }}
                        >
                          Delete
                        </span>
                      </div>
                      <p className="line-clamp-4 text-[11px] leading-snug text-muted">
                        {plainPreview(tile.body)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ScopeButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm ${
        active ? "bg-ink text-paper" : "text-ink hover:bg-ink/5"
      }`}
    >
      <span>{label}</span>
      <span className={`text-xs ${active ? "text-paper/70" : "text-muted"}`}>
        {count}
      </span>
    </button>
  );
}

function FolderRow({
  folder,
  active,
  count,
  onSelect,
  onRename,
  onDelete,
}: {
  folder: NotesFolder;
  active: boolean;
  count: number;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`group rounded-md ${active ? "bg-ink text-paper" : "hover:bg-ink/5"}`}
    >
      <div className="flex items-center gap-1 px-1 py-0.5">
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 truncate px-1.5 py-1 text-left text-sm"
        >
          {folder.name}
        </button>
        <span
          className={`pr-1 text-xs ${active ? "text-paper/70" : "text-muted"}`}
        >
          {count}
        </span>
      </div>
      <div
        className={`flex gap-1 px-2 pb-1.5 ${active ? "" : "opacity-0 group-hover:opacity-100"}`}
      >
        <button
          type="button"
          className={`text-[0.65rem] ${active ? "text-paper/80 hover:text-paper" : "text-muted hover:text-ink"}`}
          onClick={() => {
            const name = prompt("Rename folder", folder.name);
            if (name != null) onRename(name);
          }}
        >
          Rename
        </button>
        <button
          type="button"
          className={`text-[0.65rem] ${active ? "text-paper/80 hover:text-paper" : "text-muted hover:text-ink"}`}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function TileEditor({
  tile,
  folders,
  onBack,
  onRename,
  onUpdateBody,
  onMove,
  onDelete,
}: {
  tile: NotesTile;
  folders: NotesFolder[];
  onBack: () => void;
  onRename: (title: string) => void;
  onUpdateBody: (body: string) => void;
  onMove: (folderId: string | null) => void;
  onDelete: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const seededFor = useRef<string | null>(null);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (seededFor.current === tile.id) return;
    el.innerHTML = tile.body || "";
    seededFor.current = tile.id;
  }, [tile.id, tile.body]);

  function handleInput() {
    const el = editorRef.current;
    if (!el) return;
    onUpdateBody(el.innerHTML);
  }

  function apply(command: Command, arg?: string) {
    editorRef.current?.focus();
    runCommand(command, arg);
    handleInput();
  }

  return (
    <div className="overflow-hidden rounded-lg border border-paper-deep bg-paper">
      <div className="flex flex-wrap items-center gap-2 border-b border-paper-deep px-3 py-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded border border-ink/10 px-2 py-1 text-xs hover:bg-ink/5"
        >
          ← Tiles
        </button>
        <input
          className="min-w-[12rem] flex-1 rounded border border-paper-deep bg-paper px-2 py-1 text-sm font-medium outline-none focus:border-signal"
          value={tile.title}
          onChange={(e) => onRename(e.target.value)}
          aria-label="Note title"
        />
        <select
          className="rounded border border-paper-deep bg-paper px-2 py-1 text-xs"
          value={tile.folderId ?? ""}
          onChange={(e) => onMove(e.target.value || null)}
          aria-label="Move to folder"
        >
          <option value="">Unfiled</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onDelete}
          className="rounded border border-ink/10 px-2 py-1 text-xs text-muted hover:bg-ink/5 hover:text-ink"
        >
          Delete
        </button>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-paper-deep bg-paper-deep/50 p-2">
        <ToolbarButton label="Bold" onClick={() => apply("bold")}>
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton label="Italic" onClick={() => apply("italic")}>
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton label="Underline" onClick={() => apply("underline")}>
          <span className="underline">U</span>
        </ToolbarButton>
        <span className="mx-1 w-px self-stretch bg-ink/15" aria-hidden />
        <ToolbarButton
          label="Bulleted list"
          onClick={() => apply("insertUnorderedList")}
        >
          • List
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          onClick={() => apply("insertOrderedList")}
        >
          1. List
        </ToolbarButton>
        <span className="mx-1 w-px self-stretch bg-ink/15" aria-hidden />
        <ToolbarButton
          label="Heading"
          onClick={() => apply("formatBlock", "h3")}
        >
          H
        </ToolbarButton>
        <ToolbarButton
          label="Paragraph"
          onClick={() => apply("formatBlock", "p")}
        >
          ¶
        </ToolbarButton>
        <ToolbarButton label="Align left" onClick={() => apply("justifyLeft")}>
          Left
        </ToolbarButton>
        <ToolbarButton
          label="Align center"
          onClick={() => apply("justifyCenter")}
        >
          Center
        </ToolbarButton>
      </div>

      <div
        ref={editorRef}
        className="general-notes-editor min-h-[24rem] px-4 py-3 text-sm leading-relaxed outline-none"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label={`Notes for ${tile.title}`}
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
      />
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded border border-ink/10 bg-paper px-2.5 py-1 text-xs font-medium text-ink hover:bg-ink/5"
    >
      {children}
    </button>
  );
}
