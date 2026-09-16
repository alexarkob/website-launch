import { type FormEvent, useEffect, useRef, useState } from "react";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { battingRuleWarning, ensureIdealOrder } from "../../lib/softball/batting";
import { playersById, type Player, type TeamState, type WalkUpSong } from "../../lib/softball/types";
import { useSoftballDndSensors } from "./useSoftballDndSensors";

interface Props {
  state: TeamState;
  canEditIdeal: boolean;
  onIdealChange: (order: string[]) => void;
  onWeekChange: (order: string[]) => void;
  onGenerate: () => void;
  onUnlock: (adminPin: string) => Promise<void>;
  onLock: () => void;
}

function trackUrl(song: WalkUpSong): string {
  return `https://open.spotify.com/track/${song.spotifyId}`;
}

function duplicateAt(order: string[], index: number): string[] {
  const next = [...order];
  next.splice(index + 1, 0, order[index]);
  return next;
}

function TileMenu({
  id,
  openId,
  onToggle,
  onClose,
  onDuplicate,
  onDelete,
}: {
  id: string;
  openId: string | null;
  onToggle: () => void;
  onClose: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const open = openId === id;
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: PointerEvent) {
      if (!boxRef.current?.contains(event.target as Node)) onClose();
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open, onClose]);

  return (
    <div className="sb-tile-menu" ref={boxRef}>
      <button
        type="button"
        className="sb-tile-menu__btn"
        aria-label="Player actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onToggle}
      >
        <span aria-hidden="true">⋮</span>
      </button>
      {open && (
        <div
          className="sb-tile-menu__list"
          role="menu"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onDuplicate();
              onClose();
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            className="is-danger"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
              onClose();
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function SortableBatter({
  id,
  index,
  player,
  canDrag,
  showMenu,
  showOut,
  openMenuId,
  onToggleMenu,
  onCloseMenu,
  onDuplicate,
  onDelete,
}: {
  id: string;
  index: number;
  player: Player | undefined;
  canDrag: boolean;
  showMenu: boolean;
  showOut?: boolean;
  openMenuId: string | null;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !canDrag,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: openMenuId === id ? 20 : undefined,
  };
  const absent = showOut && player && !player.present;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`sb-tile ${player?.gender === "female" ? "is-f" : "is-m"} ${isDragging ? "is-dragging" : ""}${absent ? " is-out" : ""}${showMenu ? " has-menu" : ""}`}
    >
      {canDrag ? (
        <button type="button" className="sb-grip" {...attributes} {...listeners} aria-label="Drag">
          ::
        </button>
      ) : (
        <span className="sb-grip is-static" aria-hidden="true">
          ::
        </span>
      )}
      <span className="sb-tile__num">{index + 1}</span>
      <span className="sb-tile__name">{player?.name || "Unnamed"}</span>
      <span className="sb-tile__tag">
        {player?.gender === "female" ? "F" : "M"}
        {absent ? " · Out" : ""}
      </span>
      {player?.walkUpSong ? (
        <a
          className="sb-tile__song"
          href={trackUrl(player.walkUpSong)}
          target="_blank"
          rel="noreferrer"
          title={`${player.walkUpSong.name} — ${player.walkUpSong.artists}`}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34c-.24.36-.66.48-1.02.24-2.82-1.74-6.36-2.1-10.56-1.14-.42.12-.78-.18-.9-.54-.12-.42.18-.78.54-.9 4.56-1.02 8.52-.6 11.64 1.32.42.18.48.66.3 1.02zm1.44-3.18c-.3.42-.84.6-1.26.3-3.24-1.98-8.16-2.58-11.94-1.38-.48.12-.96-.18-1.08-.66-.12-.48.18-.96.66-1.08 4.38-1.32 9.78-.66 13.44 1.62.42.24.54.84.18 1.2zm.12-3.3c-3.9-2.34-10.32-2.52-14.04-1.38-.54.18-1.14-.18-1.32-.72-.18-.54.18-1.14.72-1.32 4.26-1.32 11.34-1.08 15.78 1.56.54.3.72 1.02.42 1.56-.3.48-1.02.66-1.56.3z" />
          </svg>
          <span>{player.walkUpSong.name}</span>
        </a>
      ) : (
        <span className="sb-tile__song is-empty">No walk-up</span>
      )}
      {showMenu && (
        <TileMenu
          id={id}
          openId={openMenuId}
          onToggle={onToggleMenu}
          onClose={onCloseMenu}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      )}
    </li>
  );
}

function UnlockForm({ onUnlock }: { onUnlock: (adminPin: string) => Promise<void> }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onUnlock(pin);
      setPin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="sb-unlock" onSubmit={(event) => void handleSubmit(event)}>
      <label className="sb-sr" htmlFor="sb-admin-pin">
        Admin PIN
      </label>
      <input
        id="sb-admin-pin"
        type="password"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        placeholder="Admin PIN"
        autoComplete="off"
        required
      />
      <button type="submit" className="sb-btn" disabled={busy || !pin}>
        Unlock
      </button>
      {error && <p className="sb-tiny-warn">{error}</p>}
    </form>
  );
}

export function BattingOrder({
  state,
  canEditIdeal,
  onIdealChange,
  onWeekChange,
  onGenerate,
  onUnlock,
  onLock,
}: Props) {
  const byId = playersById(state.roster);
  const idealIds = ensureIdealOrder(state.roster, state.idealBattingOrder);
  const weekPlayers = state.battingOrder
    .map((id) => byId.get(id))
    .filter((player): player is Player => Boolean(player));
  const warning = battingRuleWarning(weekPlayers, state.roster);
  const idealItems = idealIds.map((playerId, index) => `ideal:${playerId}::${index}`);
  const weekItems = state.battingOrder.map((playerId, index) => `week:${playerId}::${index}`);
  const [idealDeleteWarn, setIdealDeleteWarn] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const idealSensors = useSoftballDndSensors();
  const weekSensors = useSoftballDndSensors();

  function handleIdealDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!canEditIdeal || !over || active.id === over.id) return;
    const oldIndex = idealItems.indexOf(String(active.id));
    const newIndex = idealItems.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onIdealChange(arrayMove(idealIds, oldIndex, newIndex));
  }

  function handleWeekDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = weekItems.indexOf(String(active.id));
    const newIndex = weekItems.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onWeekChange(arrayMove(state.battingOrder, oldIndex, newIndex));
  }

  function handleIdealDelete(index: number) {
    const playerId = idealIds[index];
    const copies = idealIds.filter((id) => id === playerId).length;
    if (copies <= 1) {
      const name = byId.get(playerId)?.name || "This player";
      setIdealDeleteWarn(
        `${name} has to stay in the ideal order at least once. Duplicate them first if you want extra at-bats, but you cannot remove them entirely.`,
      );
      return;
    }
    setIdealDeleteWarn(null);
    const next = [...idealIds];
    next.splice(index, 1);
    onIdealChange(next);
  }

  return (
    <div className="sb-batting">
      <section className="sb-batting-section">
        <div className="sb-toolbar">
          <div>
            <h2>Ideal batting order</h2>
            <p className="sb-muted">
              Season lineup for every player. Unlock with the admin PIN to reorder, then lock it.
              {canEditIdeal ? " Use the three-dot menu on the right to duplicate or delete a slot." : ""}
            </p>
          </div>
          {canEditIdeal ? (
            <button type="button" className="sb-btn sb-btn--primary" onClick={onLock}>
              Lock
            </button>
          ) : (
            <UnlockForm onUnlock={onUnlock} />
          )}
        </div>
        {idealDeleteWarn && <p className="sb-banner sb-banner--warn">{idealDeleteWarn}</p>}
        {idealIds.length === 0 ? (
          <p className="sb-muted">Add players on the roster tab to build an ideal order.</p>
        ) : (
          <DndContext
            sensors={idealSensors.sensors}
            collisionDetection={closestCenter}
            autoScroll={idealSensors.autoScroll}
            onDragEnd={handleIdealDragEnd}
          >
            <SortableContext items={idealItems} strategy={verticalListSortingStrategy}>
              <ol className="sb-order">
                {idealIds.map((playerId, index) => (
                  <SortableBatter
                    key={idealItems[index]}
                    id={idealItems[index]}
                    index={index}
                    player={byId.get(playerId)}
                    canDrag={canEditIdeal}
                    showMenu={canEditIdeal}
                    showOut
                    openMenuId={openMenuId}
                    onToggleMenu={() => setOpenMenuId((current) => (current === idealItems[index] ? null : idealItems[index]))}
                    onCloseMenu={() => setOpenMenuId(null)}
                    onDuplicate={() => onIdealChange(duplicateAt(idealIds, index))}
                    onDelete={() => handleIdealDelete(index)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </section>

      <section className="sb-batting-section">
        <div className="sb-toolbar">
          <div>
            <h2>This week’s order</h2>
            <p className="sb-muted">
              Present players only, 3 men then 1 woman, as close as possible to the ideal lineup.
              Use the three-dot menu on the right to duplicate or delete a slot.
            </p>
          </div>
          <button type="button" className="sb-btn sb-btn--primary" onClick={onGenerate}>
            Generate this week’s order
          </button>
        </div>
        {warning && <p className="sb-banner sb-banner--warn">{warning}</p>}
        {weekPlayers.length === 0 ? (
          <p className="sb-muted">Generate an order from everyone marked present this week.</p>
        ) : (
          <DndContext
            sensors={weekSensors.sensors}
            collisionDetection={closestCenter}
            autoScroll={weekSensors.autoScroll}
            onDragEnd={handleWeekDragEnd}
          >
            <SortableContext items={weekItems} strategy={verticalListSortingStrategy}>
              <ol className="sb-order">
                {state.battingOrder.map((playerId, index) => (
                  <SortableBatter
                    key={weekItems[index]}
                    id={weekItems[index]}
                    index={index}
                    player={byId.get(playerId)}
                    canDrag
                    showMenu
                    openMenuId={openMenuId}
                    onToggleMenu={() => setOpenMenuId((current) => (current === weekItems[index] ? null : weekItems[index]))}
                    onCloseMenu={() => setOpenMenuId(null)}
                    onDuplicate={() => onWeekChange(duplicateAt(state.battingOrder, index))}
                    onDelete={() => {
                      const next = [...state.battingOrder];
                      next.splice(index, 1);
                      onWeekChange(next);
                    }}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </section>
    </div>
  );
}
