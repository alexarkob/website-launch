import { POSITION_LABELS, POSITIONS, type Player, type Position } from "../../lib/softball/types";
import { SongPicker } from "./SongPicker";

interface Props {
  roster: Player[];
  onChange: (roster: Player[]) => void;
  onAdd: () => void;
}

function MaleIcon() {
  return (
    <svg viewBox="0 0 24 40" aria-hidden="true">
      <circle cx="12" cy="5.5" r="4" />
      <rect x="8.1" y="10.5" width="7.8" height="12.2" rx="1.2" />
      <rect x="4.2" y="11.2" width="3.1" height="8.2" rx="1.1" />
      <rect x="16.7" y="11.2" width="3.1" height="8.2" rx="1.1" />
      <rect x="8.1" y="22.6" width="3.2" height="14.2" rx="1" />
      <rect x="12.7" y="22.6" width="3.2" height="14.2" rx="1" />
    </svg>
  );
}

function FemaleIcon() {
  return (
    <svg viewBox="0 0 24 40" aria-hidden="true">
      <circle cx="12" cy="5.5" r="4" />
      <path d="M5.2 24.2 12 10.8l6.8 13.4z" />
      <rect x="8.2" y="23.8" width="3.1" height="13.4" rx="1" />
      <rect x="12.7" y="23.8" width="3.1" height="13.4" rx="1" />
    </svg>
  );
}

function GenderToggle({
  value,
  onChange,
}: {
  value: Player["gender"];
  onChange: (gender: Player["gender"]) => void;
}) {
  return (
    <div className="sb-gender" role="group" aria-label="Gender">
      <button
        type="button"
        className={`sb-gender__btn is-f${value === "female" ? " is-on" : ""}`}
        aria-pressed={value === "female"}
        aria-label="Female"
        onClick={() => onChange("female")}
      >
        <FemaleIcon />
      </button>
      <button
        type="button"
        className={`sb-gender__btn is-m${value === "male" ? " is-on" : ""}`}
        aria-pressed={value === "male"}
        aria-label="Male"
        onClick={() => onChange("male")}
      >
        <MaleIcon />
      </button>
    </div>
  );
}

function togglePosition(player: Player, position: Position): Player {
  const has = player.positions.includes(position);
  return {
    ...player,
    positions: has
      ? player.positions.filter((item) => item !== position)
      : [...player.positions, position],
  };
}

function PresentToggle({
  player,
  onPatch,
}: {
  player: Player;
  onPatch: (next: Player) => void;
}) {
  return (
    <label className="sb-toggle sb-toggle--compact">
      <input
        type="checkbox"
        checked={player.present}
        onChange={(e) => onPatch({ ...player, present: e.target.checked })}
      />
      <span>In</span>
    </label>
  );
}

function NameInput({
  player,
  onPatch,
}: {
  player: Player;
  onPatch: (next: Player) => void;
}) {
  return (
    <input
      value={player.name}
      onChange={(e) => onPatch({ ...player, name: e.target.value })}
      placeholder="Name"
      aria-label="Player name"
    />
  );
}

function PositionChips({
  player,
  onPatch,
}: {
  player: Player;
  onPatch: (next: Player) => void;
}) {
  return (
    <div className="sb-pos-row">
      {POSITIONS.map((position) => (
        <label
          key={position}
          data-pos={position}
          className={player.positions.includes(position) ? "is-on" : ""}
          title={POSITION_LABELS[position]}
        >
          <input
            type="checkbox"
            checked={player.positions.includes(position)}
            onChange={() => onPatch(togglePosition(player, position))}
          />
          {position}
        </label>
      ))}
    </div>
  );
}

function PlayerRow({
  player,
  onPatch,
  onRemove,
}: {
  player: Player;
  onPatch: (next: Player) => void;
  onRemove: () => void;
}) {
  return (
    <tr className={player.present ? "" : "is-out"}>
      <td className="sb-col-present">
        <PresentToggle player={player} onPatch={onPatch} />
      </td>
      <td className="sb-col-name">
        <NameInput player={player} onPatch={onPatch} />
      </td>
      <td className="sb-col-gender">
        <GenderToggle
          value={player.gender}
          onChange={(gender) => onPatch({ ...player, gender })}
        />
      </td>
      <td className="sb-col-positions">
        <PositionChips player={player} onPatch={onPatch} />
      </td>
      <td className="sb-col-song">
        <SongPicker
          compact
          song={player.walkUpSong}
          onChange={(walkUpSong) => onPatch({ ...player, walkUpSong })}
        />
      </td>
      <td className="sb-col-remove">
        <button type="button" className="sb-btn sb-btn--ghost" onClick={onRemove} aria-label="Remove player">
          ×
        </button>
      </td>
    </tr>
  );
}

function PlayerCard({
  player,
  onPatch,
  onRemove,
}: {
  player: Player;
  onPatch: (next: Player) => void;
  onRemove: () => void;
}) {
  return (
    <article className={`sb-player-card${player.present ? "" : " is-out"}`}>
      <div className="sb-player-card__top">
        <PresentToggle player={player} onPatch={onPatch} />
        <NameInput player={player} onPatch={onPatch} />
        <GenderToggle
          value={player.gender}
          onChange={(gender) => onPatch({ ...player, gender })}
        />
        <button type="button" className="sb-btn sb-btn--ghost" onClick={onRemove} aria-label="Remove player">
          ×
        </button>
      </div>
      <PositionChips player={player} onPatch={onPatch} />
      <SongPicker
        compact
        song={player.walkUpSong}
        onChange={(walkUpSong) => onPatch({ ...player, walkUpSong })}
      />
    </article>
  );
}

export function RosterTable({ roster, onChange, onAdd }: Props) {
  const present = roster.filter((player) => player.present);
  const absent = roster.filter((player) => !player.present);

  function patchAt(id: string, next: Player) {
    onChange(roster.map((player) => (player.id === id ? next : player)));
  }

  function remove(id: string) {
    onChange(roster.filter((player) => player.id !== id));
  }

  function renderPlayers(players: Player[]) {
    return (
      <>
        <div className="sb-table-wrap sb-roster-desktop">
          <table className="sb-roster-table">
            <thead>
              <tr>
                <th>Here</th>
                <th>Name</th>
                <th>G</th>
                <th>Positions</th>
                <th>Walk-up song</th>
                <th>
                  <span className="sb-sr">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  onPatch={(next) => patchAt(player.id, next)}
                  onRemove={() => remove(player.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="sb-roster-cards">
          {players.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              onPatch={(next) => patchAt(player.id, next)}
              onRemove={() => remove(player.id)}
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="sb-roster">
      <div className="sb-toolbar">
        <p className="sb-muted">
          {present.length} present · {absent.length} out
        </p>
        <button type="button" className="sb-btn sb-btn--primary" onClick={onAdd}>
          Add player
        </button>
      </div>
      {present.length === 0 ? (
        <p className="sb-muted">Add players, then uncheck Here if someone is out this week.</p>
      ) : (
        renderPlayers(present)
      )}
      {absent.length > 0 && (
        <details className="sb-out" open={absent.length < 8}>
          <summary>Out this week ({absent.length})</summary>
          {renderPlayers(absent)}
        </details>
      )}
    </div>
  );
}
