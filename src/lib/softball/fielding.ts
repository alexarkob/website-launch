import { parseFieldingNotes, type FieldingConstraint } from "./fieldingNotes";
import {
  FIELD_SPOTS,
  INNING_COUNT,
  MAX_MEN_ON_FIELD,
  POSITIONS,
  emptyDefense,
  presentPlayers,
  type Defense,
  type FieldingInning,
  type Player,
  type Position,
} from "./types";

/** Always fill these before RC/RF, even if it means an off-preference placement. */
export const MUST_FILL_POSITIONS: Position[] = ["C", "P", "1B", "2B", "3B", "SS", "LF", "LC"];
const FLEX_POSITIONS: Position[] = ["RC", "RF"];

export interface FieldingGenerateResult {
  innings: FieldingInning[];
  warnings: string[];
  noteWarnings: string[];
}

function countMen(players: Player[]): number {
  return players.filter((player) => player.gender === "male").length;
}

function playedOf(played: Map<string, number>, id: string): number {
  return played.get(id) ?? 0;
}

function sortByPlayTime(players: Player[], played: Map<string, number>): Player[] {
  return [...players].sort(
    (a, b) =>
      playedOf(played, a.id) - playedOf(played, b.id) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}

function covers(player: Player, position: Position): boolean {
  return player.positions.includes(position);
}

function sortByScarcity(positions: Position[], remaining: Player[]): Position[] {
  return [...positions].sort((a, b) => {
    const aCount = remaining.filter((player) => covers(player, a)).length;
    const bCount = remaining.filter((player) => covers(player, b)).length;
    return aCount - bCount || positions.indexOf(a) - positions.indexOf(b);
  });
}

function avoids(player: Player, position: Position, constraints: FieldingConstraint[]): boolean {
  if (
    constraints.some(
      (constraint) =>
        constraint.type === "avoid" &&
        constraint.playerIds.includes(player.id) &&
        constraint.positions.includes(position),
    )
  ) {
    return true;
  }
  const limited = onlyPositions(player, constraints);
  return Boolean(limited && !limited.includes(position));
}

function prefers(player: Player, position: Position, constraints: FieldingConstraint[]): boolean {
  return constraints.some(
    (constraint) =>
      constraint.type === "prefer" &&
      constraint.playerIds.includes(player.id) &&
      constraint.positions.includes(position),
  );
}

function onlyPositions(player: Player, constraints: FieldingConstraint[]): Position[] | null {
  const hits = constraints.filter(
    (constraint) => constraint.type === "only" && constraint.playerIds.includes(player.id),
  );
  if (!hits.length) return null;
  return [...new Set(hits.flatMap((constraint) => constraint.positions))];
}

function rotatePlayerIds(constraints: FieldingConstraint[]): string[] {
  const ids = new Set<string>();
  for (const constraint of constraints) {
    if (constraint.type === "rotate") {
      for (const id of constraint.playerIds) ids.add(id);
    }
  }
  return [...ids];
}

function pickForPosition(
  remaining: Player[],
  position: Position,
  played: Map<string, number>,
  allowUnpreferred: boolean,
  constraints: FieldingConstraint[] = [],
): Player | null {
  const eligible = remaining.filter((player) => !avoids(player, position, constraints));
  const preferred = eligible.filter(
    (player) => covers(player, position) || prefers(player, position, constraints),
  );
  const pool = preferred.length ? preferred : allowUnpreferred ? eligible : [];
  if (!pool.length) return null;
  const sorted = [...pool].sort(
    (a, b) =>
      Number(prefers(b, position, constraints)) - Number(prefers(a, position, constraints)) ||
      playedOf(played, a.id) - playedOf(played, b.id) ||
      a.positions.length - b.positions.length ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  );
  return sorted[0] ?? null;
}

function placeRotations(
  defense: Defense,
  remaining: Player[],
  constraints: FieldingConstraint[],
  inningIndex: number,
): Player[] {
  let left = [...remaining];
  for (const constraint of constraints) {
    if (constraint.type !== "rotate") continue;
    const members = constraint.playerIds
      .map((id) => left.find((player) => player.id === id))
      .filter((player): player is Player => Boolean(player));
    const positions = constraint.positions.filter((position) => !defense[position]);
    if (!members.length || !positions.length) continue;

    if (members.length === positions.length) {
      for (let i = 0; i < members.length; i++) {
        const position = positions[(i + inningIndex) % positions.length];
        if (defense[position]) continue;
        defense[position] = members[i].id;
        left = left.filter((player) => player.id !== members[i].id);
      }
      continue;
    }

    const seats = Math.min(members.length, positions.length);
    const start = inningIndex % members.length;
    for (let i = 0; i < seats; i++) {
      const player = members[(start + i) % members.length];
      const position = positions[i % positions.length];
      if (!player || defense[position] || !left.some((item) => item.id === player.id)) continue;
      defense[position] = player.id;
      left = left.filter((item) => item.id !== player.id);
    }
  }
  return left;
}

function timesAt(history: Defense[], playerId: string, position: Position): number {
  let count = 0;
  for (const prior of history) {
    if (prior[position] === playerId) count += 1;
  }
  return count;
}

function pickLeastUsedAllowed(
  positions: Position[],
  defense: Defense,
  playerId: string,
  history: Defense[],
): Position | null {
  const empty = positions.filter((position) => !defense[position]);
  if (!empty.length) return null;
  return (
    [...empty].sort(
      (a, b) =>
        timesAt(history, playerId, a) - timesAt(history, playerId, b) ||
        positions.indexOf(a) - positions.indexOf(b),
    )[0] ?? null
  );
}

function placeOnly(
  defense: Defense,
  remaining: Player[],
  constraints: FieldingConstraint[],
  inningIndex: number,
  history: Defense[] = [],
): Player[] {
  let left = [...remaining];
  const rotateIds = new Set(rotatePlayerIds(constraints));

  for (const constraint of constraints) {
    if (constraint.type !== "only") continue;
    const members = constraint.playerIds
      .map((id) => left.find((player) => player.id === id))
      .filter((player): player is Player => Boolean(player));
    if (!members.length) continue;

    if (members.length === 1 && constraint.positions.length === 1) {
      const player = members[0];
      const position = constraint.positions[0];
      const occupantId = defense[position];
      if (!occupantId) {
        defense[position] = player.id;
        left = left.filter((item) => item.id !== player.id);
      } else if (occupantId !== player.id && !rotateIds.has(occupantId)) {
        defense[position] = player.id;
        left = left.filter((item) => item.id !== player.id);
        const occupant = remaining.find((item) => item.id === occupantId);
        if (occupant) left.push(occupant);
      }
      continue;
    }

    if (members.length === 1) {
      const player = members[0];
      const position = pickLeastUsedAllowed(constraint.positions, defense, player.id, history);
      if (!position) continue;
      defense[position] = player.id;
      left = left.filter((item) => item.id !== player.id);
      continue;
    }

    const start = inningIndex % members.length;
    const seats = Math.min(
      members.length,
      constraint.positions.filter((position) => !defense[position]).length,
    );
    for (let i = 0; i < seats; i++) {
      const player = members[(start + i) % members.length];
      if (!player || !left.some((item) => item.id === player.id)) continue;
      const position = pickLeastUsedAllowed(constraint.positions, defense, player.id, history);
      if (!position) continue;
      defense[position] = player.id;
      left = left.filter((item) => item.id !== player.id);
    }
  }
  return left;
}

function forceRotateOnField(
  selected: Player[],
  present: Player[],
  constraints: FieldingConstraint[],
  played: Map<string, number>,
): Player[] {
  const neededIds = rotatePlayerIds(constraints);
  if (!neededIds.length) return selected;
  const presentById = new Map(present.map((player) => [player.id, player]));
  let current = [...selected];

  for (const id of neededIds) {
    const player = presentById.get(id);
    if (!player || current.some((item) => item.id === player.id)) continue;
    if (current.length < FIELD_SPOTS) {
      if (player.gender === "male" && countMen(current) >= MAX_MEN_ON_FIELD) {
        const swapMen = [...current]
          .filter((item) => item.gender === "male" && !neededIds.includes(item.id))
          .sort((a, b) => playedOf(played, b.id) - playedOf(played, a.id));
        if (!swapMen[0]) continue;
        current = current.filter((item) => item.id !== swapMen[0].id).concat(player);
        continue;
      }
      current.push(player);
      continue;
    }
    const sitPool = [...current]
      .filter((item) => {
        if (neededIds.includes(item.id)) return false;
        if (player.gender === "male" && item.gender !== "male" && countMen(current) >= MAX_MEN_ON_FIELD) {
          return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          Number(uniqueMustFillCover(a, current)) - Number(uniqueMustFillCover(b, current)) ||
          playedOf(played, b.id) - playedOf(played, a.id) ||
          a.name.localeCompare(b.name),
      );
    if (!sitPool[0]) continue;
    current = current.filter((item) => item.id !== sitPool[0].id).concat(player);
  }

  return current;
}

function mustFillCovered(selected: Player[], position: Position): boolean {
  return selected.some((player) => covers(player, position));
}

function uniqueMustFillCover(player: Player, selected: Player[]): boolean {
  return MUST_FILL_POSITIONS.some((position) => {
    if (!covers(player, position)) return false;
    return !selected.some((other) => other.id !== player.id && covers(other, position));
  });
}

function assignDefense(
  selected: Player[],
  played: Map<string, number>,
  allowUnpreferred: boolean,
  constraints: FieldingConstraint[] = [],
  inningIndex = 0,
  history: Defense[] = [],
): Defense | null {
  const remainingStart = [...selected];
  const defense = emptyDefense();
  const remaining = placeOnly(
    defense,
    placeRotations(defense, remainingStart, constraints, inningIndex),
    constraints,
    inningIndex,
    history,
  );

  const fillGroup = (positions: Position[], unpreferred: boolean) => {
    for (const position of sortByScarcity(positions, remaining)) {
      if (defense[position]) continue;
      const pick = pickForPosition(remaining, position, played, unpreferred, constraints);
      if (!pick) continue;
      defense[position] = pick.id;
      remaining.splice(remaining.indexOf(pick), 1);
    }
  };

  fillGroup(MUST_FILL_POSITIONS, false);
  fillGroup(FLEX_POSITIONS, false);
  if (allowUnpreferred) {
    fillGroup(MUST_FILL_POSITIONS, true);
    fillGroup(FLEX_POSITIONS, true);
  }

  const filledMust = MUST_FILL_POSITIONS.filter((position) => defense[position]).length;
  const expectedMust = Math.min(MUST_FILL_POSITIONS.length, selected.length);
  if (!allowUnpreferred && filledMust < expectedMust) return null;
  if (!allowUnpreferred && remaining.length > 0) return null;
  return defense;
}

function pickByQuota(present: Player[], played: Map<string, number>): Player[] {
  const target = Math.min(FIELD_SPOTS, present.length);
  const mustFillTarget = Math.min(MUST_FILL_POSITIONS.length, present.length);
  const selected: Player[] = [];
  const taken = new Set<string>();
  const take = (player: Player) => {
    if (taken.has(player.id)) return;
    selected.push(player);
    taken.add(player.id);
  };

  for (const position of MUST_FILL_POSITIONS) {
    const coversForSpot = present.filter((player) => covers(player, position));
    if (coversForSpot.length === 1) take(coversForSpot[0]);
  }

  const women = sortByPlayTime(
    present.filter((player) => player.gender === "female" && !taken.has(player.id)),
    played,
  );
  const men = sortByPlayTime(
    present.filter((player) => player.gender === "male" && !taken.has(player.id)),
    played,
  );

  const menAvailable = present.filter((player) => player.gender === "male").length;
  const womenAvailable = present.filter((player) => player.gender === "female").length;
  const menWanted = Math.min(MAX_MEN_ON_FIELD, menAvailable, target);
  const womenWanted = Math.min(womenAvailable, Math.max(0, target - menWanted));

  for (const player of women) {
    if (selected.filter((item) => item.gender === "female").length >= womenWanted) break;
    if (selected.length >= target) break;
    take(player);
  }
  for (const player of women) {
    if (selected.length >= target) break;
    take(player);
  }
  for (const player of men) {
    if (selected.length >= target) break;
    if (countMen(selected) >= MAX_MEN_ON_FIELD && selected.length >= mustFillTarget) break;
    take(player);
  }

  return selected;
}

function ensureMustFillCoverage(
  selected: Player[],
  present: Player[],
  played: Map<string, number>,
): Player[] {
  let current = [...selected];

  for (const position of MUST_FILL_POSITIONS) {
    if (mustFillCovered(current, position)) continue;
    const bench = sortByPlayTime(
      present.filter((player) => !current.some((item) => item.id === player.id) && covers(player, position)),
      played,
    );
    if (!bench.length) continue;
    const incoming = bench[0];

    const sitPool = [...current]
      .filter((player) => {
        if (player.gender === "female" && incoming.gender === "male" && current.length < FIELD_SPOTS) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aUnique = uniqueMustFillCover(a, current) ? 1 : 0;
        const bUnique = uniqueMustFillCover(b, current) ? 1 : 0;
        const aFlex = a.positions.every((pos) => FLEX_POSITIONS.includes(pos)) ? 0 : 1;
        const bFlex = b.positions.every((pos) => FLEX_POSITIONS.includes(pos)) ? 0 : 1;
        return (
          aUnique - bUnique ||
          aFlex - bFlex ||
          playedOf(played, b.id) - playedOf(played, a.id) ||
          a.name.localeCompare(b.name)
        );
      });
    const sitting = sitPool[0];
    if (!sitting) continue;
    current = current.filter((player) => player.id !== sitting.id).concat(incoming);
  }

  return current;
}

function assignSelected(
  selected: Player[],
  played: Map<string, number>,
  constraints: FieldingConstraint[] = [],
  inningIndex = 0,
  history: Defense[] = [],
): { selected: Player[]; defense: Defense | null } {
  const preferred = assignDefense(selected, played, false, constraints, inningIndex, history);
  if (preferred) return { selected, defense: preferred };
  return { selected, defense: assignDefense(selected, played, true, constraints, inningIndex, history) };
}

function fillVacancies(
  defense: Defense,
  present: Player[],
  played: Map<string, number>,
  constraints: FieldingConstraint[] = [],
): Defense {
  const next = { ...defense };
  const onField = new Set(Object.values(next).filter((id): id is string => Boolean(id)));

  const menCount = () =>
    countMen(present.filter((player) => onField.has(player.id)));

  const fillPosition = (position: Position, allowMenOverCap: boolean) => {
    if (next[position]) return;
    const bench = present.filter((player) => !onField.has(player.id));
    const women = bench.filter((player) => player.gender === "female");
    const men = bench.filter((player) => player.gender === "male");
    let pool = women;
    if (!pool.length) {
      if (!allowMenOverCap && menCount() >= MAX_MEN_ON_FIELD) return;
      pool = men;
    }
    const pick = pickForPosition(pool, position, played, true, constraints);
    if (!pick) return;
    next[position] = pick.id;
    onField.add(pick.id);
  };

  for (const position of sortByScarcity(
    MUST_FILL_POSITIONS,
    present.filter((player) => !onField.has(player.id)),
  )) {
    fillPosition(position, true);
  }
  for (const position of FLEX_POSITIONS) {
    fillPosition(position, false);
  }
  return next;
}

function buildInning(
  present: Player[],
  played: Map<string, number>,
  constraints: FieldingConstraint[] = [],
  inningIndex = 0,
  history: Defense[] = [],
): FieldingInning {
  const selected = forceRotateOnField(
    ensureMustFillCoverage(pickByQuota(present, played), present, played),
    present,
    constraints,
    played,
  );
  const assigned = assignSelected(selected, played, constraints, inningIndex, history);
  const defense = fillVacancies(
    assigned.defense ??
      assignDefense(assigned.selected, played, true, constraints, inningIndex, history) ??
      emptyDefense(),
    present,
    played,
    constraints,
  );
  const onField = new Set(Object.values(defense).filter((id): id is string => Boolean(id)));
  const bench = present.filter((player) => !onField.has(player.id)).map((player) => player.id);
  return { defense, bench };
}

export function generateFielding(roster: Player[], notes = ""): FieldingGenerateResult {
  const present = presentPlayers(roster);
  const warnings: string[] = [];
  const parsedNotes = parseFieldingNotes(notes, roster);
  const constraints = parsedNotes.constraints;
  const played = new Map(present.map((player) => [player.id, 0]));

  if (present.length === 0) {
    return {
      innings: Array.from({ length: INNING_COUNT }, () => ({
        defense: emptyDefense(),
        bench: [],
      })),
      warnings: ["No players are marked present this week."],
      noteWarnings: [...parsedNotes.summaries, ...parsedNotes.warnings],
    };
  }

  if (present.filter((player) => player.gender === "female").length < 3 && present.length >= 10) {
    warnings.push("Fewer than 3 women present — keeping 7 or fewer men on the field may not be possible.");
  }

  if (present.some((player) => player.positions.length === 0)) {
    warnings.push("Some present players have no preferred positions and may stay on the bench.");
  }

  if (present.length < FIELD_SPOTS) {
    warnings.push(`Only ${present.length} players present — some positions will be empty.`);
  }

  const innings: FieldingInning[] = [];
  const history: Defense[] = [];
  for (let i = 0; i < INNING_COUNT; i++) {
    const inning = buildInning(present, played, constraints, i, history);
    for (const id of Object.values(inning.defense)) {
      if (id) played.set(id, playedOf(played, id) + 1);
    }
    innings.push(inning);
    history.push(inning.defense);
  }

  const menCounts = present
    .filter((player) => player.gender === "male")
    .map((player) => playedOf(played, player.id));
  const womenCounts = present
    .filter((player) => player.gender === "female")
    .map((player) => playedOf(played, player.id));
  const spread = (counts: number[]) =>
    counts.length ? Math.max(...counts) - Math.min(...counts) : 0;
  if (spread(menCounts) > 1 || spread(womenCounts) > 1) {
    warnings.push(
      "Playing time is uneven within a gender. Preferred-position limits may have blocked a fairer rotation.",
    );
  }

  const byId = new Map(present.map((player) => [player.id, player]));
  const holeNotes = innings.flatMap((inning, index) => {
    const missing = MUST_FILL_POSITIONS.filter((position) => !inning.defense[position]);
    return missing.length ? [`Inning ${index + 1}: ${missing.join(", ")}`] : [];
  });
  if (holeNotes.length) {
    warnings.push(`Could not fill every priority position (C, P, 1B, 2B, 3B, SS, LF, LC) — ${holeNotes.join("; ")}.`);
  }

  const womanSatWithHole = innings.some((inning) => {
    const hasHole = POSITIONS.some((position) => !inning.defense[position]);
    if (!hasHole) return false;
    return inning.bench.some((id) => byId.get(id)?.gender === "female");
  });
  if (womanSatWithHole) {
    warnings.push("A woman is on the bench while a fielding spot is empty.");
  }

  return { innings, warnings, noteWarnings: [...parsedNotes.summaries, ...parsedNotes.warnings] };
}

export function inningsPlayed(innings: FieldingInning[], playerId: string): number {
  return innings.reduce((total, inning) => {
    return total + (Object.values(inning.defense).includes(playerId) ? 1 : 0);
  }, 0);
}

export function menOnField(inning: FieldingInning, roster: Player[]): number {
  const byId = new Map(roster.map((player) => [player.id, player]));
  const ids = new Set(
    Object.values(inning.defense).filter((id): id is string => Boolean(id)),
  );
  let men = 0;
  for (const id of ids) {
    if (byId.get(id)?.gender === "male") men += 1;
  }
  return men;
}

export function unpreferredPlacements(
  inning: FieldingInning,
  roster: Player[],
): { position: Position; name: string }[] {
  const byId = new Map(roster.map((player) => [player.id, player]));
  const hits: { position: Position; name: string }[] = [];
  for (const position of POSITIONS) {
    const id = inning.defense[position];
    if (!id) continue;
    const player = byId.get(id);
    if (player && !player.positions.includes(position)) {
      hits.push({ position, name: player.name || "Unnamed player" });
    }
  }
  return hits;
}

export function rebuildBench(defense: Defense, roster: Player[]): string[] {
  const onField = new Set(
    Object.values(defense).filter((id): id is string => Boolean(id)),
  );
  return presentPlayers(roster)
    .filter((player) => !onField.has(player.id))
    .map((player) => player.id);
}

export function movePlayerInInning(
  inning: FieldingInning,
  roster: Player[],
  playerId: string,
  dest: Position | "bench",
): FieldingInning {
  const defense = { ...inning.defense };
  const fromPos = POSITIONS.find((position) => defense[position] === playerId) ?? null;

  if (dest === "bench") {
    if (fromPos) defense[fromPos] = null;
    return { defense, bench: rebuildBench(defense, roster) };
  }

  const occupant = defense[dest];
  if (fromPos) {
    defense[dest] = playerId;
    defense[fromPos] = occupant;
  } else {
    defense[dest] = playerId;
    if (occupant) {
      // occupant goes to bench automatically via rebuild
    }
  }

  return { defense, bench: rebuildBench(defense, roster) };
}
