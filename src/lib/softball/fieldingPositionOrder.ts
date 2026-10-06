import { POSITIONS, type Player, type Position } from "./types";

export type FieldingPositionOrder = Record<string, Position[]>;

/** First this many listed spots are generation priorities; the rest are allowed fill. */
export const PRIORITY_LIMIT = 3;

const ALLOWED_RANK = 50;
const BANNED_RANK = 1000;

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

/** Every selected spot: allowed to play, in admin order. Unconfigured players may play anywhere. */
export function allowedSpots(player: Player, order: FieldingPositionOrder): Position[] {
  if (Object.prototype.hasOwnProperty.call(order, player.id)) {
    return order[player.id] ?? [];
  }
  return [...POSITIONS];
}

export function prioritySpots(player: Player, order: FieldingPositionOrder): Position[] {
  if (Object.prototype.hasOwnProperty.call(order, player.id)) {
    return (order[player.id] ?? []).slice(0, PRIORITY_LIMIT);
  }
  return player.positions.slice(0, PRIORITY_LIMIT);
}

export function isAllowed(player: Player, position: Position, order: FieldingPositionOrder): boolean {
  return allowedSpots(player, order).includes(position);
}

export function isPriority(player: Player, position: Position, order: FieldingPositionOrder): boolean {
  return prioritySpots(player, order).includes(position);
}

export function rankOf(player: Player, position: Position, order: FieldingPositionOrder): number {
  if (!isAllowed(player, position, order)) return BANNED_RANK;
  const pIndex = prioritySpots(player, order).indexOf(position);
  if (pIndex !== -1) return pIndex;
  const aIndex = allowedSpots(player, order).indexOf(position);
  return ALLOWED_RANK + Math.max(0, aIndex);
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
