import type { Player } from "./types";
import { presentPlayers } from "./types";

export function generateBattingOrder(roster: Player[]): string[] {
  const present = presentPlayers(roster);
  const males = present.filter((player) => player.gender === "male");
  const females = present.filter((player) => player.gender === "female");

  if (present.length === 0) return [];
  if (females.length === 0) return males.map((player) => player.id);
  if (males.length === 0) return females.map((player) => player.id);

  // Enough 3-and-1 groups for every man to bat once, and every woman to bat
  // once before any woman is used a second time.
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
