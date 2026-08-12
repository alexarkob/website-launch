import type { Player, PriorStats } from "./types";

function fmt(n: number | undefined, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

function statsFor(player: Player): { label: string; value: string }[] {
  const s = player.lastYear;
  if (!s) return [];

  switch (player.position) {
    case "QB":
      return [
        { label: "PPR", value: fmt(s.pts, 1) },
        { label: "Pass Yds", value: fmt(s.passYds) },
        { label: "Pass TD", value: fmt(s.passTd) },
        { label: "INT", value: fmt(s.passInt) },
        { label: "Rush Yds", value: fmt(s.rushYds) },
        { label: "Rush TD", value: fmt(s.rushTd) },
      ];
    case "RB":
      return [
        { label: "PPR", value: fmt(s.pts, 1) },
        { label: "Rush Yds", value: fmt(s.rushYds) },
        { label: "Rush TD", value: fmt(s.rushTd) },
        { label: "Rec", value: fmt(s.receptions) },
        { label: "Rec Yds", value: fmt(s.recYds) },
        { label: "Rec TD", value: fmt(s.recTd) },
      ];
    case "WR":
    case "TE":
      return [
        { label: "PPR", value: fmt(s.pts, 1) },
        { label: "Rec", value: fmt(s.receptions) },
        { label: "Targets", value: fmt(s.targets) },
        { label: "Rec Yds", value: fmt(s.recYds) },
        { label: "Rec TD", value: fmt(s.recTd) },
        { label: "Rush Yds", value: fmt(s.rushYds) },
      ];
    case "DST":
      return [
        { label: "Pts", value: fmt(s.pts, 1) },
        { label: "Sacks", value: fmt(s.sacks) },
        { label: "INT", value: fmt(s.ints) },
        { label: "Fum Rec", value: fmt(s.fumRec) },
        { label: "TD", value: fmt(s.defTd) },
      ];
    case "K":
      return [
        { label: "Pts", value: fmt(s.pts, 1) },
        { label: "FGM", value: fmt(s.fgm) },
        { label: "XPM", value: fmt(s.xpm) },
      ];
    default:
      return [{ label: "PPR", value: fmt((s as PriorStats).pts, 1) }];
  }
}

export function PriorStatsPanel({ player }: { player: Player }) {
  const rows = statsFor(player);
  if (rows.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-muted">No 2025 stats available.</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-3 px-3 py-2 text-xs">
      <span className="font-semibold text-muted">2025 season</span>
      {rows.map((row) => (
        <span key={row.label} className="tabular-nums">
          <span className="text-muted">{row.label}: </span>
          <span className="font-medium text-ink">{row.value}</span>
        </span>
      ))}
    </div>
  );
}
