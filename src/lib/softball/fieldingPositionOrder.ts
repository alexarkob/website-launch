import { POSITIONS, type Player, type Position } from "./types";

export type FieldingPositionOrder = Record<string, Position[]>;

const UNRANKED = 1000;

function isPosition(value: unknown): value is Position {
  return typeof value === "string" && (POSITIONS as readonly string[]).includes(value);
}

export function clipFieldingPositionOrder(
  value: unknown,
  rosterIds?: Iterable<string>,
): FieldingPositionOrder {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const allowed = rosterIds ? new Set(rosterIds) : null;
  const out: FieldingPositionOrder = {};
  for (const [id, spots] of Object.entries(value as Record<string, unknown>)) {
    if (!id || (allowed && !allowed.has(id))) continue;
    if (!Array.isArray(spots)) continue;
    const seen = new Set<Position>();
    const next: Position[] = [];
    for (const spot of spots) {
      if (!isPosition(spot) || seen.has(spot)) continue;
      seen.add(spot);
      next.push(spot);
    }
    if (next.length) out[id] = next;
  }
  return out;
}

export function seedFieldingPositionOrder(
  roster: Player[],
  stored: FieldingPositionOrder,
): FieldingPositionOrder {
  const next: FieldingPositionOrder = {};
  for (const player of roster) {
    const ranked = stored[player.id];
    next[player.id] = ranked?.length ? [...ranked] : [...player.positions];
  }
  return next;
}

export function preferredSpots(player: Player, order: FieldingPositionOrder): Position[] {
  const ranked = order[player.id];
  return ranked?.length ? ranked : player.positions;
}

export function rankOf(player: Player, position: Position, order: FieldingPositionOrder): number {
  const index = preferredSpots(player, order).indexOf(position);
  return index === -1 ? UNRANKED : index;
}

export function fieldingOrdersEqual(a: FieldingPositionOrder, b: FieldingPositionOrder): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const left = a[key] ?? [];
    const right = b[key] ?? [];
    if (left.length !== right.length) return false;
    if (left.some((spot, index) => spot !== right[index])) return false;
  }
  return true;
}
