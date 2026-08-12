import { POSITION_LABELS, type Position } from "./types";

const POS_CLASS: Record<Position, string> = {
  QB: "pos-qb",
  RB: "pos-rb",
  WR: "pos-wr",
  TE: "pos-te",
  DST: "pos-dst",
  K: "pos-k",
};

export function PositionBadge({ position }: { position: Position }) {
  return (
    <span className={`pos-badge ${POS_CLASS[position]}`}>
      {POSITION_LABELS[position]}
    </span>
  );
}
