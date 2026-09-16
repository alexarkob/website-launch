import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { battingRuleWarning } from "../../lib/softball/batting";
import { playersById, type Player, type TeamState, type WalkUpSong } from "../../lib/softball/types";

interface Props {
  state: TeamState;
  onOrderChange: (order: string[]) => void;
  onGenerate: () => void;
}

function trackUrl(song: WalkUpSong): string {
  return `https://open.spotify.com/track/${song.spotifyId}`;
}

function SortableBatter({
  id,
  index,
  player,
}: {
  id: string;
  index: number;
  player: Player | undefined;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`sb-tile ${player?.gender === "female" ? "is-f" : "is-m"} ${isDragging ? "is-dragging" : ""}`}
    >
      <button type="button" className="sb-grip" {...attributes} {...listeners} aria-label="Drag">
        ::
      </button>
      <span className="sb-tile__num">{index + 1}</span>
      <span className="sb-tile__name">{player?.name || "Unnamed"}</span>
      <span className="sb-tile__tag">{player?.gender === "female" ? "F" : "M"}</span>
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
    </li>
  );
}

export function BattingOrder({
  state,
  onOrderChange,
  onGenerate,
}: Props) {
  const byId = playersById(state.roster);
  const ordered = state.battingOrder
    .map((id) => byId.get(id))
    .filter((player): player is Player => Boolean(player));
  const warning = battingRuleWarning(ordered, state.roster);
  const items = state.battingOrder.map((playerId, index) => `${playerId}::${index}`);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.indexOf(String(active.id));
    const newIndex = items.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onOrderChange(arrayMove(state.battingOrder, oldIndex, newIndex));
  }

  return (
    <div className="sb-batting">
      <div className="sb-toolbar">
        <button type="button" className="sb-btn sb-btn--primary" onClick={onGenerate}>
          Generate batting order
        </button>
      </div>
      {warning && <p className="sb-banner sb-banner--warn">{warning}</p>}
      {ordered.length === 0 ? (
        <p className="sb-muted">Generate an order from everyone marked present this week.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            <ol className="sb-order">
              {state.battingOrder.map((playerId, index) => (
                <SortableBatter
                  key={items[index]}
                  id={items[index]}
                  index={index}
                  player={byId.get(playerId)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
