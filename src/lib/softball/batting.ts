import type { Player } from "./types";
import { presentPlayers } from "./types";

export function generateBattingOrder(roster: Player[]): string[] {
  const present = presentPlayers(roster);
  const males = present.filter((player) => player.gender === "male");
  const females = present.filter((player) => player.gender === "female");

  if (present.length === 0) return [];
  if (females.length === 0) return males.map((player) => player.id);
  if (males.length === 0) return females.map((player) => player.id);

  const order: string[] = [];
  const seen = new Set<string>();
  let maleIndex = 0;
  let femaleIndex = 0;
  const cap = Math.max(present.length * 4, 8);

  while (order.length < cap) {
    for (let slot = 0; slot < 3; slot++) {
      const player = males[maleIndex % males.length];
      order.push(player.id);
      seen.add(player.id);
      maleIndex += 1;
    }
    const woman = females[femaleIndex % females.length];
    order.push(woman.id);
    seen.add(woman.id);
    femaleIndex += 1;
    if (present.every((player) => seen.has(player.id))) break;
  }

  return order;
}

export function battingRuleWarning(order: Player[]): string | null {
  if (order.length === 0) return null;

  const females = order.filter((player) => player.gender === "female").length;
  if (females === 0) {
    return "No women in the batting order — a woman should hit every 4 at-bats.";
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
