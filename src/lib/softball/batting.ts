import type { Player } from "./types";
import { presentPlayers } from "./types";

/** First occurrence of each id, in order. Used when seeding an empty ideal list. */
export function uniqueFirst(ids: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  return next;
}
export function ensureIdealOrder(roster: Player[], ideal: string[] = []): string[] {
  const ids = new Set(roster.map((player) => player.id));
  const next = ideal.filter((id) => ids.has(id));
  const seen = new Set(next);
  for (const player of roster) {
    if (seen.has(player.id)) continue;
    seen.add(player.id);
    next.push(player.id);
  }
  return next;
}

function byIdealRank(idealOrder: string[]) {
  const rank = new Map<string, number>();
  for (const [index, id] of idealOrder.entries()) {
    if (!rank.has(id)) rank.set(id, index);
  }
  return (a: Player, b: Player) => {
    const ai = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bi = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  };
}

export function generateBattingOrder(roster: Player[], idealOrder: string[] = []): string[] {
  const present = presentPlayers(roster);
  const compare = byIdealRank(idealOrder);
  const males = present.filter((player) => player.gender === "male").sort(compare);
  const females = present.filter((player) => player.gender === "female").sort(compare);

  if (present.length === 0) return [];
  if (females.length === 0) return males.map((player) => player.id);
  if (males.length === 0) return females.map((player) => player.id);

  // Enough 3-and-1 groups for every man to bat once, and every woman to bat
  // once before any woman is used a second time. Men/women keep ideal relative order.
  const groups = Math.max(Math.ceil(males.length / 3), females.length);
  const order: string[] = [];
  for (let group = 0; group < groups; group++) {
    for (let slot = 0; slot < 3; slot++) {
      order.push(males[(group * 3 + slot) % males.length].id);
    }
    order.push(females[group % females.length].id);
  }
  return order;
}

export function battingRuleWarning(order: Player[], roster: Player[] = order): string | null {
  if (order.length === 0) return null;

  const presentWomen = presentPlayers(roster).filter((player) => player.gender === "female");
  const females = order.filter((player) => player.gender === "female").length;
  if (females === 0) {
    return "No women in the batting order — a woman should hit every 4 at-bats.";
  }

  const seenWomen = new Set<string>();
  for (const player of order) {
    if (player.gender !== "female") continue;
    const missingWoman = presentWomen.some((woman) => !seenWomen.has(woman.id));
    if (seenWomen.has(player.id) && missingWoman) {
      return "A woman repeats before every present woman has batted.";
    }
    seenWomen.add(player.id);
  }

  for (let i = 0; i < order.length; i += 4) {
    const chunk = order.slice(i, i + 4);
    const men = chunk.filter((player) => player.gender === "male").length;
    const women = chunk.filter((player) => player.gender === "female").length;
    if (chunk.length === 4) {
      if (men !== 3 || women !== 1) {
        return "This order does not follow 3 men then 1 woman in each group of 4.";
      }
    } else if (men > 3) {
      return "Too many men at the end of the batting order.";
    }
  }

  return null;
}
