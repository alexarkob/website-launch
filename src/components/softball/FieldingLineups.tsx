import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { UnlockForm } from "./UnlockForm";
import { useSoftballDndSensors } from "./useSoftballDndSensors";
import {
  PRIORITY_LIMIT,
  fieldingOrdersEqual,
  seedFieldingPositionOrder,
  type FieldingPositionOrder,
} from "../../lib/softball/fieldingPositionOrder";
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
  orderOpen: boolean;
  fieldingPositionOrder: FieldingPositionOrder;
  orderLocking?: boolean;
  orderSubmitted?: boolean;
  onSaveOrder: (order: FieldingPositionOrder) => void | Promise<void>;
  onLockOrder: (order: FieldingPositionOrder) => void | Promise<void>;
  onOrderChange?: (order: FieldingPositionOrder) => void;
  onUnlock: (adminPin: string) => Promise<void>;
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

function PlayerChip({
  player,
  compact = false,
  preferred,
}: {
  player: Player;
  compact?: boolean;
  preferred?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: player.id,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.6 : 1,
  };
  const fitClass =
    preferred === true ? " is-preferred" : preferred === false ? " is-unpreferred" : "";
  const fitLabel =
    preferred === true
      ? "preferred position"
      : preferred === false
        ? "not a preferred position"
        : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sb-chip${compact ? " is-compact" : ""} ${player.gender === "female" ? "is-f" : "is-m"}${isDragging ? " is-dragging" : ""}${fitClass}`}
      title={fitLabel}
    >
      <button
        type="button"
        className="sb-grip"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${player.name || "player"}${fitLabel ? `, ${fitLabel}` : ""}`}
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
  const preferred = player ? player.positions.includes(position) : undefined;
  const fitClass =
    preferred === true ? " is-preferred" : preferred === false ? " is-unpreferred" : "";
  return (
    <div
      ref={setNodeRef}
      data-pos={position}
      className={`sb-slot ${isOver ? "is-over" : ""}${fitClass}`}
      style={layout === "diamond" ? { left: `${spot.x}%`, top: `${spot.y}%` } : undefined}
      aria-label={`${POSITION_LABELS[position]}${player ? `: ${player.name}` : ", empty"}${preferred === true ? ", preferred" : preferred === false ? ", not preferred" : ""}`}
    >
      <span className="sb-slot__pos">
        {position}
        <small>{POSITION_LABELS[position]}</small>
      </span>
      {player ? (
        <PlayerChip player={player} compact={layout === "diamond"} preferred={preferred} />
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

function rankDragId(playerId: string, position: Position): string {
  return `order:${playerId}:${position}`;
}

function parseRankDragId(value: string): { playerId: string; position: Position } | null {
  if (!value.startsWith("order:")) return null;
  const rest = value.slice(6);
  const split = rest.lastIndexOf(":");
  if (split <= 0) return null;
  const playerId = rest.slice(0, split);
  const position = rest.slice(split + 1);
  if (!(POSITIONS as readonly string[]).includes(position)) return null;
  return { playerId, position: position as Position };
}

function RankChip({
  playerId,
  position,
  allowed,
  priority,
  rosterPreferred,
  onToggle,
  onMove,
  dragMoved,
}: {
  playerId: string;
  position: Position;
  allowed: boolean;
  priority: number | null;
  rosterPreferred: boolean;
  onToggle: () => void;
  onMove?: (direction: -1 | 1) => void;
  dragMoved: { current: boolean };
}) {
  const selected = allowed;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: rankDragId(playerId, position),
    disabled: !selected,
  });
  const droppable = useDroppable({
    id: rankDragId(playerId, position),
    disabled: !selected,
  });
  const setRefs = (node: HTMLButtonElement | null) => {
    setNodeRef(node);
    droppable.setNodeRef(node);
  };
  const style = selected
    ? {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.55 : 1,
      }
    : undefined;

  return (
    <button
      ref={setRefs}
      type="button"
      data-pos={position}
      style={style}
      className={`${selected ? "is-on" : ""}${priority ? " is-priority" : ""}${rosterPreferred ? " is-roster-pref" : ""}${droppable.isOver ? " is-over" : ""}`}
      aria-pressed={selected}
      aria-label={
        selected
          ? `${POSITION_LABELS[position]}${priority ? `, priority ${priority}` : ", allowed"}${rosterPreferred ? ", on their roster card" : ""}. Drag to reorder, or activate to remove.`
          : `Not available at ${POSITION_LABELS[position]}${rosterPreferred ? ", on their roster card" : ""}. Activate to allow.`
      }
      title={
        rosterPreferred
          ? `${POSITION_LABELS[position]} (on their roster card)`
          : POSITION_LABELS[position]
      }
      {...(selected ? { ...attributes, ...listeners } : {})}
      onClick={() => {
        if (dragMoved.current) return;
        onToggle();
      }}
      onKeyDown={(event) => {
        if (!selected || !onMove) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          onMove(-1);
        }
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          onMove(1);
        }
      }}
    >
      {priority ? <small className="sb-rank">{priority}</small> : null}
      {position}
    </button>
  );
}

function PositionOrderEditor({
  roster,
  draft,
  onChange,
}: {
  roster: Player[];
  draft: FieldingPositionOrder;
  onChange: (next: FieldingPositionOrder) => void;
}) {
  const { sensors, autoScroll } = useSoftballDndSensors();
  const dragMoved = useRef(false);
  const display = seedFieldingPositionOrder(roster, draft);

  function spotsFor(player: Player): Position[] {
    return display[player.id] ?? [];
  }

  function setSpots(playerId: string, spots: Position[]) {
    onChange({ ...draft, [playerId]: spots });
  }

  function toggle(player: Player, position: Position) {
    const spots = spotsFor(player);
    setSpots(
      player.id,
      spots.includes(position) ? spots.filter((item) => item !== position) : [...spots, position],
    );
  }

  function move(player: Player, position: Position, direction: -1 | 1) {
    const spots = [...spotsFor(player)];
    const index = spots.indexOf(position);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= spots.length) return;
    const swap = spots[index];
    spots[index] = spots[nextIndex];
    spots[nextIndex] = swap;
    setSpots(player.id, spots);
  }

  function handleDragEnd(event: DragEndEvent) {
    const from = parseRankDragId(String(event.active.id));
    const to = event.over ? parseRankDragId(String(event.over.id)) : null;
    if (!from || !to || from.playerId !== to.playerId || from.position === to.position) return;
    const player = roster.find((item) => item.id === from.playerId);
    if (!player) return;
    const spots = [...spotsFor(player)];
    const fromIndex = spots.indexOf(from.position);
    const toIndex = spots.indexOf(to.position);
    if (fromIndex < 0 || toIndex < 0) return;
    spots.splice(fromIndex, 1);
    spots.splice(toIndex, 0, from.position);
    setSpots(player.id, spots);
  }

  return (
    <DndContext
      sensors={sensors}
      autoScroll={autoScroll}
      onDragStart={() => {
        dragMoved.current = false;
      }}
      onDragEnd={(event) => {
        const moved = Math.abs(event.delta.x) > 4 || Math.abs(event.delta.y) > 4;
        dragMoved.current = moved;
        if (moved) handleDragEnd(event);
        window.setTimeout(() => {
          dragMoved.current = false;
        }, 0);
      }}
    >
      <ul className="sb-pos-order">
        {roster.map((player) => {
          const spots = spotsFor(player);
          return (
            <li key={player.id} className={player.present ? "" : "is-out"}>
              <div className="sb-pos-order__name">
                {player.name || "Unnamed"}
                {!player.present && <span className="sb-pos-order__out">Out this week</span>}
              </div>
              <div className="sb-pos-row sb-pos-row--ranked">
                {POSITIONS.map((position) => {
                  const rankIndex = spots.indexOf(position);
                  return (
                    <RankChip
                      key={position}
                      playerId={player.id}
                      position={position}
                      allowed={rankIndex !== -1}
                      priority={
                        rankIndex >= 0 && rankIndex < PRIORITY_LIMIT ? rankIndex + 1 : null
                      }
                      rosterPreferred={player.positions.includes(position)}
                      dragMoved={dragMoved}
                      onToggle={() => toggle(player, position)}
                      onMove={(direction) => move(player, position, direction)}
                    />
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </DndContext>
  );
}
export function FieldingLineups({
  state,
  orderOpen,
  fieldingPositionOrder,
  orderLocking = false,
  orderSubmitted = false,
  onSaveOrder,
  onLockOrder,
  onOrderChange,
  onUnlock,
  onInningsChange,
  onGenerate,
  generateWarnings,
}: Props) {
  const present = presentPlayers(state.roster);
  const target = present.length === 0 ? 0 : Math.round((INNING_COUNT * 10) / present.length);
  const [view, setView] = useState<FieldingView>(readView);
  const [draftOrder, setDraftOrder] = useState(fieldingPositionOrder);
  const dirty = !fieldingOrdersEqual(draftOrder, fieldingPositionOrder);

  useEffect(() => {
    setDraftOrder(fieldingPositionOrder);
  }, [fieldingPositionOrder, orderOpen]);

  function updateDraft(next: FieldingPositionOrder) {
    setDraftOrder(next);
    onOrderChange?.(next);
  }

  function setLayout(next: FieldingView) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* ignore quota / private mode */
    }
  }

  function handleGenerate() {
    void (async () => {
      if (orderOpen && dirty) {
        try {
          await onSaveOrder(draftOrder);
        } catch {
          return;
        }
      }
      onGenerate();
    })();
  }

  return (
    <div className="sb-fielding">
      <div className="sb-toolbar">
        <button type="button" className="sb-btn sb-btn--primary" onClick={handleGenerate}>
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
      <section className="sb-admin-notes">
        <div className="sb-toolbar">
          <div>
            <h2>Admin Position Order</h2>
            {orderOpen ? (
              <p className="sb-muted">
                Only you can see this after the admin PIN. Tap every position they may play; the
                first three are priorities. Generation tries those first and will not put them on
                an unmarked spot. An underline is a position they listed on their roster card. Lock
                to hide it and apply it to lineup generation.
              </p>
            ) : orderSubmitted ? (
              <p className="sb-banner sb-banner--soft">
                Your notes have been submitted into the logic.
              </p>
            ) : (
              <p className="sb-muted">
                Unlock with the admin PIN to choose allowed spots and a top-3 priority. Nobody else
                can see this. It steers how lineups are generated.
              </p>
            )}
          </div>
          {orderOpen ? (
            <button
              type="button"
              className="sb-btn sb-btn--primary"
              disabled={orderLocking}
              onClick={() => void onLockOrder(draftOrder).catch(() => {})}
            >
              {orderLocking ? "Locking…" : "Lock"}
            </button>
          ) : (
            <UnlockForm inputId="sb-fielding-admin-pin" onUnlock={onUnlock} />
          )}
        </div>
        {orderOpen &&
          (state.roster.length === 0 ? (
            <p className="sb-muted">Add players on the Roster tab first.</p>
          ) : (
            <PositionOrderEditor
              roster={state.roster}
              draft={draftOrder}
              onChange={updateDraft}
            />
          ))}
      </section>
    </div>
  );
}
