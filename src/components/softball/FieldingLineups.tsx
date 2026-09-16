import { useState } from "react";
import {
  DndContext,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useSoftballDndSensors } from "./useSoftballDndSensors";
import {
  inningsPlayed,
  menOnField,
  movePlayerInInning,
  unpreferredPlacements,
} from "../../lib/softball/fielding";
import {
  INNING_COUNT,
  MAX_MEN_ON_FIELD,
  POSITION_LABELS,
  POSITIONS,
  presentPlayers,
  playersById,
  type FieldingInning,
  type Player,
  type Position,
  type TeamState,
} from "../../lib/softball/types";

interface Props {
  state: TeamState;
  onInningsChange: (innings: FieldingInning[]) => void;
  onGenerate: () => void;
  generateWarnings: string[];
}

type FieldingView = "diamond" | "list";
const VIEW_KEY = "sb-fielding-view";

function readView(): FieldingView {
  try {
    const stored = localStorage.getItem(VIEW_KEY);
    if (stored === "list" || stored === "diamond") return stored;
  } catch {
    /* ignore quota / private mode */
  }
  if (typeof window !== "undefined" && window.matchMedia("(max-width: 700px)").matches) {
    return "list";
  }
  return "diamond";
}

/** Percent placement on the diamond, catcher's view looking out. */
const DIAMOND_SPOTS: Record<Position, { x: number; y: number }> = {
  LF: { x: 16, y: 13 },
  LC: { x: 38, y: 8 },
  RC: { x: 62, y: 8 },
  RF: { x: 84, y: 13 },
  SS: { x: 34, y: 36 },
  "2B": { x: 66, y: 36 },
  P: { x: 50, y: 56 },
  "3B": { x: 24, y: 61 },
  "1B": { x: 76, y: 61 },
  C: { x: 50, y: 83 },
};

function PlayerChip({ player, compact = false }: { player: Player; compact?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: player.id,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sb-chip${compact ? " is-compact" : ""} ${player.gender === "female" ? "is-f" : "is-m"}${isDragging ? " is-dragging" : ""}`}
    >
      <button
        type="button"
        className="sb-grip"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${player.name || "player"}`}
      >
        ::
      </button>
      <span>{player.name || "Unnamed"}</span>
      <small>{player.gender === "female" ? "F" : "M"}</small>
    </div>
  );
}

function DiamondField({ uid }: { uid: string }) {
  const grass = `${uid}-grass`;
  const dirt = `${uid}-dirt`;
  const stripe = `${uid}-stripe`;
  return (
    <svg className="sb-diamond__field" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={grass} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1f6a42" />
          <stop offset="100%" stopColor="#123322" />
        </linearGradient>
        <radialGradient id={dirt} cx="50%" cy="68%" r="55%">
          <stop offset="0%" stopColor="#c48a58" />
          <stop offset="100%" stopColor="#7a4c2c" />
        </radialGradient>
        <pattern id={stripe} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill={`url(#${grass})`} />
          <rect width="3" height="6" fill="#1a5a38" opacity="0.35" />
        </pattern>
      </defs>
      <path d="M50 92 L7 20 Q50 3 93 20 Z" fill={`url(#${stripe})`} />
      <path d="M7 20 Q50 3 93 20" fill="none" stroke="#d9cfc0" strokeWidth="0.7" />
      <path d="M50 92 L7 20 M50 92 L93 20" fill="none" stroke="#f4efe6" strokeWidth="0.35" />
      <polygon points="50,90 77,62 50,38 23,62" fill={`url(#${dirt})`} />
      <polygon points="50,82 68,64 50,48 32,64" fill="#165a38" />
      <circle cx="50" cy="62" r="6.2" fill={`url(#${dirt})`} />
      <circle cx="50" cy="61.5" r="1.35" fill="#efe6d6" />
      <polygon points="50,88 74,62 50,40 26,62" fill="none" stroke="#f4efe6" strokeWidth="0.4" />
      <rect x="72.6" y="60.2" width="3.1" height="3.1" rx="0.2" transform="rotate(45 74.15 61.75)" fill="#f7f3ea" />
      <rect x="48.45" y="38.2" width="3.1" height="3.1" rx="0.2" transform="rotate(45 50 39.75)" fill="#f7f3ea" />
      <rect x="24.25" y="60.2" width="3.1" height="3.1" rx="0.2" transform="rotate(45 25.8 61.75)" fill="#f7f3ea" />
      <path d="M47.5 87.2 50 90.6 52.5 87.2 52.5 84.8 47.5 84.8 Z" fill="#f7f3ea" />
    </svg>
  );
}

function PositionSlot({
  position,
  player,
  layout,
}: {
  position: Position;
  player: Player | undefined;
  layout: FieldingView;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `pos:${position}` });
  const spot = DIAMOND_SPOTS[position];
  return (
    <div
      ref={setNodeRef}
      data-pos={position}
      className={`sb-slot ${isOver ? "is-over" : ""}`}
      style={layout === "diamond" ? { left: `${spot.x}%`, top: `${spot.y}%` } : undefined}
      aria-label={`${POSITION_LABELS[position]}${player ? `: ${player.name}` : ", empty"}`}
    >
      <span className="sb-slot__pos">
        {position}
        <small>{POSITION_LABELS[position]}</small>
      </span>
      {player ? (
        <PlayerChip player={player} compact={layout === "diamond"} />
      ) : (
        <span className="sb-slot__empty">Empty</span>
      )}
    </div>
  );
}

function Bench({ players }: { players: Player[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: "bench" });
  return (
    <div ref={setNodeRef} className={`sb-bench ${isOver ? "is-over" : ""}`}>
      <h3>Bench</h3>
      {players.length === 0 ? (
        <p className="sb-muted">No one sitting.</p>
      ) : (
        <div className="sb-chip-row">
          {players.map((player) => (
            <PlayerChip key={player.id} player={player} />
          ))}
        </div>
      )}
    </div>
  );
}

function InningBoard({
  index,
  inning,
  roster,
  layout,
  onChange,
}: {
  index: number;
  inning: FieldingInning;
  roster: Player[];
  layout: FieldingView;
  onChange: (next: FieldingInning) => void;
}) {
  const byId = playersById(roster);
  const { sensors, autoScroll } = useSoftballDndSensors();
  const men = menOnField(inning, roster);
  const unpreferred = unpreferredPlacements(inning, roster);

  function handleDragEnd(event: DragEndEvent) {
    const playerId = String(event.active.id);
    const over = event.over?.id ? String(event.over.id) : "";
    if (!over || over === playerId) return;
    if (over === "bench" || inning.bench.includes(over)) {
      onChange(movePlayerInInning(inning, roster, playerId, "bench"));
      return;
    }
    if (over.startsWith("pos:")) {
      const dest = over.slice(4) as Position;
      if ((POSITIONS as readonly string[]).includes(dest)) {
        onChange(movePlayerInInning(inning, roster, playerId, dest));
      }
      return;
    }
    const dest = POSITIONS.find((position) => inning.defense[position] === over);
    if (dest) onChange(movePlayerInInning(inning, roster, playerId, dest));
  }

  return (
    <section className="sb-inning">
      <header className="sb-inning__head">
        <h3>Inning {index + 1}</h3>
        {men > MAX_MEN_ON_FIELD && (
          <p className="sb-banner sb-banner--warn">
            {men} men on the field (max {MAX_MEN_ON_FIELD}).
          </p>
        )}
        {unpreferred.length > 0 && (
          <p className="sb-banner sb-banner--soft">
            Not a preferred spot:{" "}
            {unpreferred.map((item) => `${item.name} (${item.position})`).join(", ")}
          </p>
        )}
      </header>
      <DndContext sensors={sensors} autoScroll={autoScroll} onDragEnd={handleDragEnd}>
        <div className={`sb-diamond${layout === "list" ? " is-list" : ""}`}>
          {layout === "diamond" && <DiamondField uid={`inning-${index}`} />}
          {POSITIONS.map((position) => {
            const id = inning.defense[position];
            return (
              <PositionSlot
                key={position}
                position={position}
                layout={layout}
                player={id ? byId.get(id) : undefined}
              />
            );
          })}
        </div>
        <Bench
          players={inning.bench
            .map((id) => byId.get(id))
            .filter((player): player is Player => Boolean(player))}
        />
      </DndContext>
    </section>
  );
}

export function FieldingLineups({ state, onInningsChange, onGenerate, generateWarnings }: Props) {
  const present = presentPlayers(state.roster);
  const target = present.length === 0 ? 0 : Math.round((INNING_COUNT * 10) / present.length);
  const [view, setView] = useState<FieldingView>(readView);

  function setLayout(next: FieldingView) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* ignore quota / private mode */
    }
  }

  return (
    <div className="sb-fielding">
      <div className="sb-toolbar">
        <button type="button" className="sb-btn sb-btn--primary" onClick={onGenerate}>
          Generate 6-inning lineup
        </button>
        <div className="sb-view-toggle" role="group" aria-label="Fielding layout">
          <button
            type="button"
            className={view === "diamond" ? "is-active" : ""}
            aria-pressed={view === "diamond"}
            onClick={() => setLayout("diamond")}
          >
            Diamond
          </button>
          <button
            type="button"
            className={view === "list" ? "is-active" : ""}
            aria-pressed={view === "list"}
            onClick={() => setLayout("list")}
          >
            List
          </button>
        </div>
      </div>
      {generateWarnings.map((warning) => (
        <p key={warning} className="sb-banner sb-banner--soft">
          {warning}
        </p>
      ))}
      {present.length > 0 && (
        <div className="sb-fairness">
          <h3>Playing time</h3>
          <p className="sb-muted">Target about {target} innings each across the game.</p>
          <ul>
            {present.map((player) => {
              const played = inningsPlayed(state.innings, player.id);
              return (
                <li key={player.id}>
                  <span>{player.name || "Unnamed"}</span>
                  <b>
                    {played}/{INNING_COUNT}
                  </b>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {state.innings.map((inning, index) => (
        <InningBoard
          key={index}
          index={index}
          inning={inning}
          roster={state.roster}
          layout={view}
          onChange={(next) => {
            const innings = state.innings.map((row, i) => (i === index ? next : row));
            onInningsChange(innings);
          }}
        />
      ))}
    </div>
  );
}
