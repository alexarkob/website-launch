import type { Player, Position, PriorStats } from "../components/draft/types";

type FfcPlayer = {
  player_id: number | string;
  name: string;
  position: string;
  team: string;
  bye?: number;
  adp: number;
};

type SleeperRow = {
  player_id: string;
  team?: string | null;
  stats?: Record<string, number>;
  player?: {
    first_name?: string;
    last_name?: string;
    position?: string;
    team?: string | null;
    fantasy_positions?: string[];
  };
};

const POSITIONS_TO_FETCH = ["QB", "RB", "WR", "TE", "DEF", "K"] as const;
const PROJ_SEASON = "2026";
const STATS_SEASON = "2025";

export function mapPosition(pos: string): Position {
  const upper = pos.toUpperCase();
  if (upper === "DEF" || upper === "DST" || upper === "D/ST") return "DST";
  if (upper === "PK" || upper === "K") return "K";
  if (upper === "QB" || upper === "RB" || upper === "WR" || upper === "TE") {
    return upper;
  }
  return "WR";
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function defenseKey(team: string): string {
  return `dst:${team.toUpperCase()}`;
}

function playerKeys(name: string, team: string, position: Position): string[] {
  const n = normalizeName(name);
  const t = team.toUpperCase();
  const keys = [`${n}|${t}|${position}`, `${n}|${position}`, n];
  if (position === "DST") keys.unshift(defenseKey(t));
  return keys;
}

function sleeperDisplayName(row: SleeperRow): string {
  const first = row.player?.first_name ?? "";
  const last = row.player?.last_name ?? "";
  return `${first} ${last}`.trim();
}

function sleeperPosition(row: SleeperRow): Position {
  const raw =
    row.player?.position ||
    row.player?.fantasy_positions?.[0] ||
    (row.player_id.length <= 3 ? "DEF" : "WR");
  return mapPosition(raw);
}

function pickStats(stats: Record<string, number> | undefined): PriorStats | null {
  if (!stats) return null;
  const num = (k: string) =>
    typeof stats[k] === "number" ? Number(stats[k]) : undefined;
  return {
    pts: num("pts_ppr") ?? num("pts_std"),
    passYds: num("pass_yd"),
    passTd: num("pass_td"),
    passInt: num("pass_int"),
    rushYds: num("rush_yd"),
    rushTd: num("rush_td"),
    rushAtt: num("rush_att"),
    receptions: num("rec"),
    recYds: num("rec_yd"),
    recTd: num("rec_td"),
    targets: num("rec_tgt"),
    fgm: num("fgm"),
    xpm: num("xpm"),
    sacks: num("sack"),
    ints: num("int"),
    fumRec: num("fum_rec"),
    defTd: num("def_td") ?? num("td"),
  };
}

function headshotUrl(position: Position, sleeperId: string, team: string): string {
  if (position === "DST") {
    return `https://sleepercdn.com/images/team_logos/nfl/${team.toLowerCase()}.png`;
  }
  return `https://sleepercdn.com/content/nfl/players/thumb/${sleeperId}.jpg`;
}

async function fetchSleeper(
  kind: "projections" | "stats",
  season: string,
): Promise<SleeperRow[]> {
  const rows: SleeperRow[] = [];
  await Promise.all(
    POSITIONS_TO_FETCH.map(async (pos) => {
      const orderBy = pos === "DEF" || pos === "K" ? "pts_std" : "pts_ppr";
      const url = `https://api.sleeper.com/${kind}/nfl/${season}?season_type=regular&position[]=${pos}&order_by=${orderBy}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return;
      const data = (await res.json()) as SleeperRow[];
      rows.push(...data);
    }),
  );
  return rows;
}

function indexSleeper(rows: SleeperRow[]) {
  const byKey = new Map<string, SleeperRow>();
  for (const row of rows) {
    if (!row.stats) continue;
    const position = sleeperPosition(row);
    const team = (row.team || row.player?.team || "").toUpperCase();
    const name = sleeperDisplayName(row);

    if (position === "DST" && team) {
      byKey.set(defenseKey(team), row);
      continue;
    }

    for (const key of playerKeys(name, team, position)) {
      if (!byKey.has(key)) byKey.set(key, row);
    }
  }
  return byKey;
}

function lookup(index: Map<string, SleeperRow>, player: {
  name: string;
  team: string;
  position: Position;
}) {
  for (const key of playerKeys(player.name, player.team, player.position)) {
    const hit = index.get(key);
    if (hit) return hit;
  }
  // Defense name like "Denver Defense"
  if (player.position === "DST") {
    return index.get(defenseKey(player.team)) ?? null;
  }
  return null;
}

export async function buildAdpBundle() {
  const ffcUrl =
    "https://fantasyfootballcalculator.com/api/v1/adp/ppr?teams=8&position=all";

  const [ffcRes, projections, priorStats] = await Promise.all([
    fetch(ffcUrl, { headers: { Accept: "application/json" } }),
    fetchSleeper("projections", PROJ_SEASON),
    fetchSleeper("stats", STATS_SEASON),
  ]);

  if (!ffcRes.ok) {
    throw new Error(`Upstream ADP request failed (${ffcRes.status})`);
  }

  const ffcData = (await ffcRes.json()) as { players?: FfcPlayer[] };
  const projIndex = indexSleeper(projections);
  const statsIndex = indexSleeper(priorStats);

  const players: Player[] = (ffcData.players ?? []).map((p) => {
    const position = mapPosition(p.position);
    const team = p.team;
    const base = {
      name: p.name,
      team,
      position,
    };
    const proj = lookup(projIndex, base);
    const prior = lookup(statsIndex, base);
    const sleeperId = proj?.player_id || prior?.player_id || "";
    const projectedPoints =
      proj?.stats?.pts_ppr ?? proj?.stats?.pts_std ?? null;
    const lastYear = pickStats(prior?.stats);

    return {
      id: String(p.player_id),
      name: p.name,
      position,
      team,
      bye: typeof p.bye === "number" ? p.bye : 0,
      adp: p.adp,
      projectedPoints:
        typeof projectedPoints === "number" ? projectedPoints : null,
      headshotUrl: sleeperId
        ? headshotUrl(position, sleeperId, team)
        : null,
      lastYear,
    };
  });

  players.sort((a, b) => a.adp - b.adp);

  return {
    players,
    fetchedAt: new Date().toISOString(),
    source: "Fantasy Football Calculator + Sleeper",
    format: "8-team PPR",
    seasons: { projections: PROJ_SEASON, priorStats: STATS_SEASON },
  };
}
