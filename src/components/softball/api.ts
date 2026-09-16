import type { ClientTeamPayload, TeamPublic, TeamState } from "../../lib/softball/types";

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function listTeams(): Promise<TeamPublic[]> {
  const res = await fetch("/api/softball/teams", { credentials: "include" });
  if (!res.ok) throw new Error(await parseError(res));
  const body = (await res.json()) as { teams: TeamPublic[] };
  return body.teams;
}

export async function login(teamId: string, password: string): Promise<ClientTeamPayload> {
  const res = await fetch("/api/softball/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamId, password }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as ClientTeamPayload;
}

export async function createTeam(input: {
  name: string;
  season: string;
  password: string;
  adminPin: string;
}): Promise<ClientTeamPayload> {
  const res = await fetch("/api/softball/teams", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as ClientTeamPayload;
}

export async function loadState(): Promise<ClientTeamPayload | null> {
  const res = await fetch("/api/softball/state", { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as ClientTeamPayload;
}

export async function saveState(state: TeamState): Promise<ClientTeamPayload> {
  const res = await fetch("/api/softball/state", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as ClientTeamPayload;
}

export async function logout(): Promise<void> {
  await fetch("/api/softball/logout", { method: "POST", credentials: "include" });
}

export async function searchSongs(query: string): Promise<
  { id: string; name: string; artists: string; uri: string; albumArt?: string }[]
> {
  const url = new URL("/api/softball/spotify/search", window.location.origin);
  url.searchParams.set("q", query);
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(await parseError(res));
  const body = (await res.json()) as { tracks: { id: string; name: string; artists: string; uri: string; albumArt?: string }[] };
  return body.tracks;
}
