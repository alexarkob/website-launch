import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  POSITION_LABELS,
  POSITIONS,
  TIERS,
  type DraftState,
  type Player,
  type Position,
} from "./types";

const TIER_RGB: Record<number, [number, number, number]> = {
  1: [26, 107, 154],
  2: [31, 138, 91],
  3: [107, 142, 35],
  4: [201, 162, 39],
  5: [217, 119, 6],
  6: [194, 65, 12],
  7: [185, 28, 92],
  8: [99, 102, 160],
};

function downloadStamp(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") +
    "_" +
    [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join(
      "",
    );
}

function header(doc: jsPDF, title: string) {
  const date = new Date().toLocaleDateString();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(`8-team PPR · Generated ${date} · ADP: Fantasy Football Calculator`, 14, 22);
  doc.setTextColor(0);
}

export function exportAdpPdf(
  players: Player[],
  state: DraftState,
  positionFilter: Position | "ALL" = "ALL",
) {
  const list =
    positionFilter === "ALL"
      ? players
      : players.filter((p) => p.position === positionFilter);

  const sorted = [...list].sort((a, b) => a.adp - b.adp);
  const label =
    positionFilter === "ALL" ? "All Players" : POSITION_LABELS[positionFilter];

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  header(doc, `Fantasy Draft Cheat Sheet — ${label}`);

  autoTable(doc, {
    startY: 28,
    head: [["#", "Player", "Pos", "Team", "Bye", "ADP", "Proj", "Tier", "Marks", "Notes"]],
    body: sorted.map((p, i) => [
      String(i + 1),
      p.name,
      POSITION_LABELS[p.position],
      p.team,
      p.bye ? String(p.bye) : "—",
      p.adp.toFixed(1),
      p.projectedPoints != null ? p.projectedPoints.toFixed(1) : "",
      state.tiers[p.id] ? `T${state.tiers[p.id]}` : "",
      (state.marks[p.id] ?? [])
        .map((m) =>
          m === "star"
            ? "Star"
            : m === "target"
              ? "Target"
              : m === "dollar"
                ? "Value"
                : m === "caution"
                  ? "Caution"
                  : "Avoid",
        )
        .join(", "),
      state.notes[p.id] ?? "",
    ]),
    styles: { fontSize: 8, cellPadding: 1.5, overflow: "linebreak" },
    headStyles: { fillColor: [12, 18, 34], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 34 },
      2: { cellWidth: 12 },
      3: { cellWidth: 12 },
      4: { cellWidth: 10 },
      5: { cellWidth: 12 },
      6: { cellWidth: 12 },
      7: { cellWidth: 10 },
      8: { cellWidth: 28 },
      9: { cellWidth: "auto" },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const player = sorted[data.row.index];
      const tier = state.tiers[player.id];
      if (tier && data.column.index !== 9) {
        const [r, g, b] = TIER_RGB[tier];
        data.cell.styles.fillColor = [
          Math.min(255, r + 180),
          Math.min(255, g + 180),
          Math.min(255, b + 180),
        ];
      }
    },
  });

  const suffix = positionFilter === "ALL" ? "all" : positionFilter.toLowerCase();
  doc.save(`fantasy-draft-cheat-sheet-${suffix}-${downloadStamp()}.pdf`);
}

export function exportTiersPdf(players: Player[], state: DraftState) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  header(doc, "Fantasy Draft Tier Sheet");

  let first = true;

  for (const position of POSITIONS) {
    const posPlayers = players
      .filter((p) => p.position === position)
      .sort((a, b) => a.adp - b.adp);

    if (posPlayers.length === 0) continue;

    if (!first) doc.addPage();
    first = false;

    let y = 28;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(POSITION_LABELS[position], 14, y);
    y += 4;

    for (const tier of [...TIERS, null] as const) {
      const group =
        tier === null
          ? posPlayers.filter((p) => !state.tiers[p.id])
          : posPlayers.filter((p) => state.tiers[p.id] === tier);

      if (group.length === 0) continue;

      const sectionTitle = tier === null ? "Unranked" : `Tier ${tier}`;

      autoTable(doc, {
        startY: y,
        head: [[sectionTitle, "Team", "Bye", "ADP", "Proj", "Notes"]],
        body: group.map((p) => [
          p.name,
          p.team,
          p.bye ? String(p.bye) : "—",
          p.adp.toFixed(1),
          p.projectedPoints != null ? p.projectedPoints.toFixed(1) : "",
          state.notes[p.id] ?? "",
        ]),
        styles: { fontSize: 8, cellPadding: 1.4, overflow: "linebreak" },
        headStyles: {
          fillColor: tier ? TIER_RGB[tier] : [92, 101, 120],
          textColor: 255,
          fontSize: 9,
        },
        columnStyles: {
          0: { cellWidth: 48 },
          1: { cellWidth: 16 },
          2: { cellWidth: 12 },
          3: { cellWidth: 14 },
          4: { cellWidth: 14 },
          5: { cellWidth: "auto" },
        },
        margin: { left: 14, right: 14 },
      });

      // jspdf-autotable attaches lastAutoTable on the doc instance
      const finalY =
        (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
          ?.finalY ?? y;
      y = finalY + 6;

      if (y > 250) {
        doc.addPage();
        y = 20;
      }
    }
  }

  doc.save(`fantasy-draft-tiers-${downloadStamp()}.pdf`);
}
