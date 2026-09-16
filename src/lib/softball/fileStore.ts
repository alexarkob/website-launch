import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { TeamPublic, TeamRecord } from "./types";
import type { SoftballStore } from "./store";

interface FileShape {
  index: TeamPublic[];
  teams: Record<string, TeamRecord>;
}

function empty(): FileShape {
  return { index: [], teams: {} };
}

export function fileStore(filePath = resolve(process.cwd(), ".softball-kv.json")): SoftballStore {
  const read = (): FileShape => {
    if (!existsSync(filePath)) return empty();
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8")) as FileShape;
      return {
        index: Array.isArray(parsed.index) ? parsed.index : [],
        teams: parsed.teams && typeof parsed.teams === "object" ? parsed.teams : {},
      };
    } catch {
      return empty();
    }
  };

  const write = (data: FileShape) => {
    writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  };

  return {
    async listTeams() {
      return read().index;
    },
    async getTeam(id) {
      return read().teams[id] ?? null;
    },
    async putTeam(team) {
      const data = read();
      data.teams[team.id] = team;
      data.index = [
        { id: team.id, name: team.name, season: team.season },
        ...data.index.filter((item) => item.id !== team.id),
      ];
      write(data);
    },
  };
}
