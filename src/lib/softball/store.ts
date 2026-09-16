import type { TeamPublic, TeamRecord } from "./types";
import { emptyStoredState } from "./types";

export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface SoftballStore {
  listTeams(): Promise<TeamPublic[]>;
  getTeam(id: string): Promise<TeamRecord | null>;
  putTeam(team: TeamRecord): Promise<void>;
}

const INDEX_KEY = "index";
const teamKey = (id: string) => `team:${id}`;

export function kvStore(kv: KvLike): SoftballStore {
  return {
    async listTeams() {
      const raw = await kv.get(INDEX_KEY);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw) as TeamPublic[];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
    async getTeam(id) {
      const raw = await kv.get(teamKey(id));
      if (!raw) return null;
      try {
        return JSON.parse(raw) as TeamRecord;
      } catch {
        return null;
      }
    },
    async putTeam(team) {
      await kv.put(teamKey(team.id), JSON.stringify(team));
      const raw = await kv.get(INDEX_KEY);
      let index: TeamPublic[] = [];
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as TeamPublic[];
          if (Array.isArray(parsed)) index = parsed;
        } catch {
          index = [];
        }
      }
      const next = [
        { id: team.id, name: team.name, season: team.season },
        ...index.filter((item) => item.id !== team.id),
      ];
      await kv.put(INDEX_KEY, JSON.stringify(next));
    },
  };
}

export function newTeamRecord(input: {
  name: string;
  season: string;
  passwordHash: string;
  passwordSalt: string;
}): TeamRecord {
  return {
    id: crypto.randomUUID(),
    name: input.name,
    season: input.season,
    passwordHash: input.passwordHash,
    passwordSalt: input.passwordSalt,
    state: emptyStoredState(),
    createdAt: new Date().toISOString(),
  };
}
