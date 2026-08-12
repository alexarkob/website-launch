import { useMemo, useState } from "react";
import { PlayerAvatar } from "./PlayerAvatar";
import { PlayerMarks } from "./PlayerMarks";
import { PositionBadge } from "./PositionBadge";
import {
  POSITION_LABELS,
  POSITIONS,
  TIERS,
  type DraftState,
  type Player,
  type PlayerMark,
  type Position,
  type Tier,
} from "./types";

type Props = {
  players: Player[];
  state: DraftState;
  hideDrafted: boolean;
  onSetTier: (id: string, tier: Tier | null) => void;
  onToggleDrafted: (id: string) => void;
  onSetNote: (id: string, note: string) => void;
  onToggleMark: (id: string, mark: PlayerMark) => void;
};

export function TierBoard({
  players,
  state,
  hideDrafted,
  onSetTier,
  onToggleDrafted,
  onSetNote,
  onToggleMark,
}: Props) {
  const [position, setPosition] = useState<Position>("RB");
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const drafted = useMemo(() => new Set(state.drafted), [state.drafted]);

  const posPlayers = useMemo(() => {
    return players
      .filter((p) => p.position === position)
      .filter((p) => !(hideDrafted && drafted.has(p.id)))
      .sort((a, b) => {
        const aDrafted = drafted.has(a.id) ? 1 : 0;
        const bDrafted = drafted.has(b.id) ? 1 : 0;
        if (aDrafted !== bDrafted) return aDrafted - bDrafted;
        return a.adp - b.adp;
      });
  }, [players, position, drafted, hideDrafted]);

  const byTier = useMemo(() => {
    const map: Record<Tier | 0, Player[]> = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
      8: [],
    };
    for (const p of posPlayers) {
      const t = state.tiers[p.id];
      if (t) map[t].push(p);
      else map[0].push(p);
    }
    return map;
  }, [posPlayers, state.tiers]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {POSITIONS.map((pos) => (
          <button
            key={pos}
            type="button"
            onClick={() => setPosition(pos)}
            className={`rounded px-3 py-1.5 text-sm font-medium transition ${
              position === pos
                ? "bg-signal text-paper"
                : "bg-paper-deep text-ink hover:bg-ink/10"
            }`}
          >
            {POSITION_LABELS[pos]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        <span>Click marks on a player:</span>
        {(
          [
            ["star", "Star"],
            ["target", "Target"],
            ["dollar", "Value"],
            ["caution", "Caution"],
            ["stop", "Avoid"],
          ] as const
        ).map(([mark, label]) => (
          <span key={mark} className="inline-flex items-center gap-1.5">
            <PlayerMarks marks={[mark]} />
            {label}
          </span>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {TIERS.map((tier) => (
          <section
            key={tier}
            className="rounded-lg border border-paper-deep bg-paper/60 p-3"
            style={{ borderTop: `3px solid var(--tier-${tier})` }}
          >
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <span className="tier-badge" data-tier={tier}>
                T{tier}
              </span>
              Tier {tier}
              <span className="ml-auto text-xs font-normal text-muted">
                {byTier[tier].length}
              </span>
            </h3>
            <ul className="space-y-1.5">
              {byTier[tier].map((player) => (
                <TierPlayerRow
                  key={player.id}
                  player={player}
                  state={state}
                  isDrafted={drafted.has(player.id)}
                  noteOpen={expandedNote === player.id}
                  onToggleNote={() =>
                    setExpandedNote(expandedNote === player.id ? null : player.id)
                  }
                  onSetTier={onSetTier}
                  onToggleDrafted={onToggleDrafted}
                  onSetNote={onSetNote}
                  onToggleMark={onToggleMark}
                />
              ))}
              {byTier[tier].length === 0 ? (
                <li className="text-xs text-muted">Drop or assign players here</li>
              ) : null}
            </ul>
          </section>
        ))}
      </div>

      <section className="rounded-lg border border-dashed border-muted/40 p-3">
        <h3 className="mb-2 text-sm font-semibold text-muted">
          Unranked{" "}
          <span className="font-normal">({byTier[0].length})</span>
        </h3>
        <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {byTier[0].map((player) => (
            <TierPlayerRow
              key={player.id}
              player={player}
              state={state}
              isDrafted={drafted.has(player.id)}
              noteOpen={expandedNote === player.id}
              onToggleNote={() =>
                setExpandedNote(expandedNote === player.id ? null : player.id)
              }
              onSetTier={onSetTier}
              onToggleDrafted={onToggleDrafted}
              onSetNote={onSetNote}
              onToggleMark={onToggleMark}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function TierPlayerRow({
  player,
  state,
  isDrafted,
  noteOpen,
  onToggleNote,
  onSetTier,
  onToggleDrafted,
  onSetNote,
  onToggleMark,
}: {
  player: Player;
  state: DraftState;
  isDrafted: boolean;
  noteOpen: boolean;
  onToggleNote: () => void;
  onSetTier: (id: string, tier: Tier | null) => void;
  onToggleDrafted: (id: string) => void;
  onSetNote: (id: string, note: string) => void;
  onToggleMark: (id: string, mark: PlayerMark) => void;
}) {
  const tier = state.tiers[player.id];
  const note = state.notes[player.id] ?? "";
  const marks = state.marks[player.id] ?? [];

  return (
    <li
      className={`player-row rounded px-2 py-1.5 text-sm ${isDrafted ? "is-drafted" : ""}`}
      data-tier={tier ?? undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <PlayerAvatar player={player} size={28} />
        <span className="min-w-0 flex-1 font-medium">{player.name}</span>
        <PositionBadge position={player.position} />
        <span className="text-xs text-muted">
          {player.team} · ADP {player.adp.toFixed(1)}
          {player.projectedPoints != null
            ? ` · ${player.projectedPoints.toFixed(1)}`
            : ""}
        </span>
        <select
          className="rounded border border-paper-deep bg-paper px-1 py-0.5 text-xs"
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
        <PlayerMarks
          marks={marks}
          editable
          playerName={player.name}
          onToggle={(mark) => onToggleMark(player.id, mark)}
        />
        <button
          type="button"
          className="text-xs text-signal hover:underline"
          onClick={onToggleNote}
        >
          {note ? "Note" : "+"}
        </button>
        <button
          type="button"
          onClick={() => onToggleDrafted(player.id)}
          className="rounded border border-ink/15 px-1.5 py-0.5 text-xs hover:bg-ink/5"
        >
          {isDrafted ? "Undo" : "Out"}
        </button>
      </div>
      {noteOpen ? (
        <textarea
          className="mt-1.5 w-full rounded border border-paper-deep bg-paper p-1.5 text-[11px] leading-snug"
          rows={4}
          value={note}
          autoFocus
          onChange={(e) => onSetNote(player.id, e.target.value)}
          placeholder="Notes…"
        />
      ) : note ? (
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-[11px] leading-snug text-muted">
          {note}
        </p>
      ) : null}
    </li>
  );
}
