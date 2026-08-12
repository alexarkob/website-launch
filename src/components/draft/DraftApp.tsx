import { useEffect, useMemo, useRef, useState } from "react";
import { GeneralNotesEditor } from "./GeneralNotesEditor";
import { PlayerAvatar } from "./PlayerAvatar";
import { PlayerList } from "./PlayerList";
import { PositionBadge } from "./PositionBadge";
import { TierBoard } from "./TierBoard";
import {
  POSITION_LABELS,
  POSITIONS,
  type AdpResponse,
  type ListTab,
  type Player,
} from "./types";
import { useDraftState } from "./useDraftState";
import { useDraftTheme } from "./useDraftTheme";

const SESSION_CACHE_KEY = "ff-adp-cache-2026-v2";

function normalizePlayer(p: Player): Player {
  return {
    ...p,
    position: p.position,
    projectedPoints: p.projectedPoints ?? null,
    headshotUrl: p.headshotUrl ?? null,
    lastYear: p.lastYear ?? null,
  };
}

export default function DraftApp() {
  const {
    state,
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
  } = useDraftState();

  const { theme, toggleTheme } = useDraftTheme();

  const [players, setPlayers] = useState<Player[]>([]);
  const [meta, setMeta] = useState<{ fetchedAt?: string; source?: string }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ListTab>("ALL");
  const [hideDrafted, setHideDrafted] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/adp");
        if (!res.ok) throw new Error(`Failed to load ADP (${res.status})`);
        const data = (await res.json()) as AdpResponse;
        if (cancelled) return;
        setPlayers(data.players.map(normalizePlayer));
        setMeta({ fetchedAt: data.fetchedAt, source: data.source });
        sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(data));
      } catch (err) {
        const cached = sessionStorage.getItem(SESSION_CACHE_KEY);
        if (cached) {
          const data = JSON.parse(cached) as AdpResponse;
          if (!cancelled) {
            setPlayers(data.players.map(normalizePlayer));
            setMeta({ fetchedAt: data.fetchedAt, source: data.source });
            setError("Using cached ADP — live refresh failed.");
          }
        } else if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load ADP");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!searchRef.current?.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filteredPlayers = useMemo(() => {
    if (tab === "ALL" || tab === "TIERS" || tab === "NOTES") return players;
    return players.filter((p) => p.position === tab);
  }, [players, tab]);

  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return players
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [players, query]);

  const draftedSet = useMemo(() => new Set(state.drafted), [state.drafted]);

  async function handlePdf() {
    if (tab === "NOTES") return;
    if (players.length === 0 || pdfBusy) return;
    setPdfBusy(true);
    try {
      const { exportAdpPdf, exportTiersPdf } = await import("./exportPdf");
      if (tab === "TIERS") exportTiersPdf(players, state);
      else if (tab === "ALL") exportAdpPdf(players, state, "ALL");
      else exportAdpPdf(players, state, tab);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? `PDF export failed: ${err.message}`
          : "PDF export failed",
      );
    } finally {
      setPdfBusy(false);
    }
  }

  const tabs: { id: ListTab; label: string }[] = [
    { id: "ALL", label: "All" },
    ...POSITIONS.map((p) => ({ id: p as ListTab, label: POSITION_LABELS[p] })),
    { id: "TIERS", label: "Tiers" },
    { id: "NOTES", label: "Notes" },
  ];

  return (
    <div className="draft-app min-h-screen bg-paper text-ink">
      <header className="border-b border-paper-deep bg-paper/90 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="mr-auto min-w-0">
            <a href="/" className="text-xs text-muted hover:text-signal">
              ← Arko Bhattacharyya
            </a>
            <h1 className="font-sans text-xl font-semibold tracking-tight sm:text-2xl">
              Fantasy Draft Helper
            </h1>
            <p className="text-xs text-muted">
              Free 8-team PPR draft board — ADP, tiers, notes, and printable
              cheat sheets
              {meta.fetchedAt
                ? ` · ADP updated ${new Date(meta.fetchedAt).toLocaleString()}`
                : null}
            </p>
            <p className="mt-0.5 text-[0.7rem] text-muted">
              Your tiers, notes, and marks stay on this device only. Nothing is
              uploaded.
            </p>
          </div>

          <div className="relative w-full sm:w-72" ref={searchRef}>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search player…"
              className="w-full rounded-md border border-paper-deep bg-paper px-3 py-2 text-sm outline-none focus:border-signal"
            />
            {searchOpen && searchHits.length > 0 ? (
              <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-md border border-paper-deep bg-paper shadow-lg">
                {searchHits.map((p) => {
                  const isDrafted = draftedSet.has(p.id);
                  return (
                    <li
                      key={p.id}
                      className="flex items-center gap-2 border-b border-paper-deep/60 px-3 py-2 text-sm last:border-0"
                    >
                      <PlayerAvatar player={p} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{p.name}</span>
                          <PositionBadge position={p.position} />
                        </div>
                        <div className="text-xs text-muted">
                          {p.team} · ADP {p.adp.toFixed(1)}
                          {p.projectedPoints != null
                            ? ` · Proj ${p.projectedPoints.toFixed(1)}`
                            : ""}
                          {state.tiers[p.id] ? ` · T${state.tiers[p.id]}` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded border border-ink/15 px-2 py-1 text-xs font-medium hover:bg-ink/5"
                        onClick={() => {
                          markDrafted(p.id, !isDrafted);
                          setQuery("");
                          setSearchOpen(false);
                        }}
                      >
                        {isDrafted ? "Undraft" : "Drafted"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <label className="flex items-center gap-2 text-xs sm:text-sm">
            <input
              type="checkbox"
              checked={hideDrafted}
              onChange={(e) => setHideDrafted(e.target.checked)}
            />
            Hide drafted
          </label>

          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-md border border-ink/15 px-3 py-1.5 text-sm hover:bg-ink/5"
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePdf}
              disabled={tab === "NOTES" || players.length === 0 || pdfBusy}
              className="rounded-md bg-signal px-3 py-1.5 text-sm font-medium text-paper hover:bg-signal-bright disabled:opacity-50"
            >
              {pdfBusy ? "Preparing PDF…" : "Download PDF"}
            </button>
            <button
              type="button"
              onClick={exportJson}
              className="rounded-md border border-ink/15 px-3 py-1.5 text-sm hover:bg-ink/5"
            >
              Export
            </button>
            <button
              type="button"
              onClick={() => importRef.current?.click()}
              className="rounded-md border border-ink/15 px-3 py-1.5 text-sm hover:bg-ink/5"
            >
              Import
            </button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) await importJson(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (confirm("Clear all drafted marks?")) resetDrafted();
              }}
              className="rounded-md border border-ink/15 px-3 py-1.5 text-sm hover:bg-ink/5"
            >
              Reset drafted
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    "Clear all prep on this device? This removes tiers, notes, marks, folders, and drafted marks.",
                  )
                ) {
                  clearAllPrep();
                }
              }}
              className="rounded-md border border-ink/15 px-3 py-1.5 text-sm hover:bg-ink/5"
            >
              Clear all prep
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                tab === t.id
                  ? "bg-ink text-paper"
                  : "text-muted hover:bg-paper-deep hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4">
        {loading && tab !== "NOTES" ? (
          <p className="py-16 text-center text-muted">Loading ADP rankings…</p>
        ) : null}

        {error ? (
          <p className="mb-4 rounded-md border border-tier-7/40 bg-tier-7/10 px-3 py-2 text-sm">
            {error}
          </p>
        ) : null}

        {tab === "NOTES" ? (
          <GeneralNotesEditor
            board={state.notesBoard}
            onScope={setNotesScope}
            onSelectTile={setActiveTile}
            onAddFolder={addFolder}
            onRenameFolder={renameFolder}
            onDeleteFolder={deleteFolder}
            onAddTile={addTile}
            onRenameTile={renameTile}
            onUpdateBody={updateTileBody}
            onMoveTile={moveTile}
            onDeleteTile={deleteTile}
          />
        ) : null}

        {!loading && players.length > 0 && tab !== "NOTES" ? (
          tab === "TIERS" ? (
            <TierBoard
              players={players}
              state={state}
              hideDrafted={hideDrafted}
              onSetTier={setTier}
              onToggleDrafted={toggleDrafted}
              onSetNote={setNote}
              onToggleMark={toggleMark}
            />
          ) : (
            <PlayerList
              players={filteredPlayers}
              state={state}
              hideDrafted={hideDrafted}
              showPriorStats
              onToggleDrafted={toggleDrafted}
              onSetNote={setNote}
              onSetTier={setTier}
              onToggleMark={toggleMark}
            />
          )
        ) : null}

        {!loading && !error && players.length === 0 && tab !== "NOTES" ? (
          <p className="py-16 text-center text-muted">No player data available.</p>
        ) : null}
      </main>

      <footer className="border-t border-paper-deep px-4 py-6 text-center text-xs text-muted">
        <p className="mx-auto max-w-2xl">
          Free product for your own 8-team PPR draft. Prep stays in this browser
          — use Export to back it up, Import to restore, or Download PDF for a
          printable cheat sheet. Nothing is uploaded to a server.
        </p>
        <p className="mt-2">
          ADP from{" "}
          <a
            href="https://fantasyfootballcalculator.com"
            className="text-signal hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Fantasy Football Calculator
          </a>
          . Projections, 2025 stats, and headshots via Sleeper.
        </p>
      </footer>
    </div>
  );
}
