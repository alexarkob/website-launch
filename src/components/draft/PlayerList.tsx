import { Fragment, useMemo, useState } from "react";
import { PlayerAvatar } from "./PlayerAvatar";
import { PlayerMarks } from "./PlayerMarks";
import { PositionBadge } from "./PositionBadge";
import { PriorStatsPanel } from "./PriorStatsPanel";
import {
  TIERS,
  type DraftState,
  type Player,
  type PlayerMark,
  type Tier,
} from "./types";

type Props = {
  players: Player[];
  state: DraftState;
  hideDrafted: boolean;
  showPriorStats: boolean;
  onToggleDrafted: (id: string) => void;
  onSetNote: (id: string, note: string) => void;
  onSetTier: (id: string, tier: Tier | null) => void;
  onToggleMark: (id: string, mark: PlayerMark) => void;
};

function sortPlayers(
  players: Player[],
  drafted: Set<string>,
  hideDrafted: boolean,
) {
  const byAdp = [...players].sort((a, b) => a.adp - b.adp);
  const rankById = new Map(byAdp.map((p, i) => [p.id, i + 1]));
  const available = byAdp.filter((p) => !drafted.has(p.id));
  const taken = hideDrafted ? [] : byAdp.filter((p) => drafted.has(p.id));
  return { rows: [...available, ...taken], rankById };
}

function fmtProj(n: number | null) {
  if (n == null) return "—";
  return n.toFixed(1);
}

export function PlayerList({
  players,
  state,
  hideDrafted,
  showPriorStats,
  onToggleDrafted,
  onSetNote,
  onSetTier,
  onToggleMark,
}: Props) {
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const [expandedStats, setExpandedStats] = useState<Set<string>>(new Set());
  const drafted = useMemo(() => new Set(state.drafted), [state.drafted]);
  const { rows, rankById } = useMemo(
    () => sortPlayers(players, drafted, hideDrafted),
    [players, drafted, hideDrafted],
  );

  function toggleStats(id: string) {
    setExpandedStats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const colSpan = showPriorStats ? 11 : 10;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-paper-deep text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Player</th>
            <th className="px-3 py-2 font-medium">Team</th>
            <th className="px-3 py-2 font-medium">Bye</th>
            <th className="px-3 py-2 font-medium">ADP</th>
            <th className="px-3 py-2 font-medium">Proj</th>
            <th className="px-3 py-2 font-medium">Tier</th>
            <th className="px-3 py-2 font-medium">Marks</th>
            <th className="px-3 py-2 font-medium">Notes</th>
            {showPriorStats ? (
              <th className="px-3 py-2 font-medium">2025</th>
            ) : null}
            <th className="px-3 py-2 font-medium">Draft</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((player) => {
            const isDrafted = drafted.has(player.id);
            const tier = state.tiers[player.id];
            const note = state.notes[player.id] ?? "";
            const noteOpen = expandedNote === player.id;
            const statsOpen = expandedStats.has(player.id);

            return (
              <Fragment key={player.id}>
                <tr
                  className={`player-row border-b border-paper-deep/80 ${isDrafted ? "is-drafted" : ""}`}
                  data-tier={tier ?? undefined}
                >
                  <td className="px-3 py-2 tabular-nums text-muted">
                    {rankById.get(player.id)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <PlayerAvatar player={player} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{player.name}</span>
                          <PositionBadge position={player.position} />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">{player.team}</td>
                  <td className="px-3 py-2 tabular-nums">{player.bye || "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{player.adp.toFixed(1)}</td>
                  <td className="px-3 py-2 tabular-nums font-medium">
                    {fmtProj(player.projectedPoints)}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className={`tier-select ${tier ? "tier-badge is-set" : ""}`}
                      data-tier={tier ?? undefined}
                      value={tier ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        onSetTier(player.id, v ? (Number(v) as Tier) : null);
                      }}
                      aria-label={`Tier for ${player.name}`}
                    >
                      <option value="">—</option>
                      {TIERS.map((t) => (
                        <option key={t} value={t}>
                          T{t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <PlayerMarks
                      marks={state.marks[player.id] ?? []}
                      editable
                      playerName={player.name}
                      onToggle={(mark) => onToggleMark(player.id, mark)}
                    />
                  </td>
                  <td className="px-2 py-2 min-w-[16rem] max-w-[22rem]">
                    <button
                      type="button"
                      className="w-full text-left text-[11px] leading-snug text-signal hover:underline"
                      onClick={() =>
                        setExpandedNote(noteOpen ? null : player.id)
                      }
                    >
                      {note ? (
                        <span className="line-clamp-3 whitespace-pre-wrap break-words text-ink">
                          {note}
                        </span>
                      ) : (
                        "Add note"
                      )}
                    </button>
                    {noteOpen ? (
                      <textarea
                        className="mt-1 w-full rounded border border-paper-deep bg-paper p-1.5 text-[11px] leading-snug"
                        rows={4}
                        value={note}
                        autoFocus
                        onChange={(e) => onSetNote(player.id, e.target.value)}
                        onBlur={() => setExpandedNote(null)}
                        placeholder="Notes…"
                      />
                    ) : null}
                  </td>
                  {showPriorStats ? (
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleStats(player.id)}
                        className="rounded border border-ink/15 px-2 py-1 text-xs hover:bg-ink/5"
                        aria-expanded={statsOpen}
                      >
                        {statsOpen ? "Hide" : "Stats"}
                      </button>
                    </td>
                  ) : null}
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onToggleDrafted(player.id)}
                      className="rounded border border-ink/15 px-2 py-1 text-xs font-medium hover:bg-ink/5"
                    >
                      {isDrafted ? "Undo" : "Drafted"}
                    </button>
                  </td>
                </tr>
                {showPriorStats && statsOpen ? (
                  <tr className="border-b border-paper-deep/80 bg-paper-deep/40">
                    <td colSpan={colSpan}>
                      <PriorStatsPanel player={player} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-muted">No players to show.</p>
      ) : null}
    </div>
  );
}
