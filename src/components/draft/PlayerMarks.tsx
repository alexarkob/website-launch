import {
  PLAYER_MARK_LABELS,
  PLAYER_MARKS,
  type PlayerMark,
} from "./types";

function MarkIcon({ mark }: { mark: PlayerMark }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (mark) {
    case "star":
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 20.6l1.2-6.5L2.5 9.5l6.6-.9L12 2.5z" />
        </svg>
      );
    case "target":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "dollar":
      return (
        <svg {...common}>
          <path d="M12 2v20" />
          <path d="M17 7.5c0-2-2-3.5-5-3.5s-5 1.4-5 3.5 2 3 5 3.5 5 1.5 5 3.5-2 3.5-5 3.5-5-1.5-5-3.5" />
        </svg>
      );
    case "caution":
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M12 3L22 20H2L12 3z" />
          <path d="M12 10v5" stroke="#fff" strokeWidth="2" fill="none" />
          <circle cx="12" cy="17.5" r="1.1" fill="#fff" />
        </svg>
      );
    case "stop":
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M8 3h8l5 5v8l-5 5H8l-5-5V8l5-5z" />
          <rect x="7" y="10.5" width="10" height="3" rx="0.5" fill="#fff" />
        </svg>
      );
  }
}

type Props = {
  marks: PlayerMark[];
  editable?: boolean;
  onToggle?: (mark: PlayerMark) => void;
  playerName?: string;
};

export function PlayerMarks({
  marks,
  editable = false,
  onToggle,
  playerName = "player",
}: Props) {
  if (!editable) {
    if (marks.length === 0) return null;
    return (
      <span className="player-marks inline-flex items-center gap-1">
        {PLAYER_MARKS.filter((m) => marks.includes(m)).map((mark) => (
          <span
            key={mark}
            className={`mark-chip is-on mark-${mark}`}
            title={PLAYER_MARK_LABELS[mark]}
          >
            <MarkIcon mark={mark} />
          </span>
        ))}
      </span>
    );
  }

  return (
    <span className="player-marks inline-flex items-center gap-0.5">
      {PLAYER_MARKS.map((mark) => {
        const active = marks.includes(mark);
        return (
          <button
            key={mark}
            type="button"
            className={`mark-chip mark-${mark} ${active ? "is-on" : ""}`}
            title={`${active ? "Remove" : "Add"} ${PLAYER_MARK_LABELS[mark]}`}
            aria-label={`${active ? "Remove" : "Add"} ${PLAYER_MARK_LABELS[mark]} for ${playerName}`}
            aria-pressed={active}
            onClick={() => onToggle?.(mark)}
          >
            <MarkIcon mark={mark} />
          </button>
        );
      })}
    </span>
  );
}
