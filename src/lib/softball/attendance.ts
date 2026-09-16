import { POSITIONS, presentPlayers, type Player, type TeamState } from "./types";
import { rebuildBench } from "./fielding";

export function syncAttendance(state: TeamState, roster: Player[]): TeamState {
  const presentIds = new Set(presentPlayers(roster).map((player) => player.id));
  let dropped = false;

  const battingOrder = state.battingOrder.filter((id) => {
    if (!presentIds.has(id)) {
      dropped = true;
      return false;
    }
    return true;
  });

  const inOrder = new Set(battingOrder);
  const missingPresent = [...presentIds].some((id) => !inOrder.has(id));

  const innings = state.innings.map((inning) => {
    const defense = { ...inning.defense };
    for (const position of POSITIONS) {
      const id = defense[position];
      if (id && !presentIds.has(id)) {
        defense[position] = null;
        dropped = true;
      }
    }
    return { defense, bench: rebuildBench(defense, roster) };
  });

  return {
    ...state,
    roster,
    battingOrder,
    innings,
    needsRegen: state.needsRegen || dropped || missingPresent,
  };
}

export function newPlayer(): Player {
  return {
    id: crypto.randomUUID(),
    name: "",
    gender: "male",
    positions: [],
    present: true,
    walkUpSong: null,
  };
}
