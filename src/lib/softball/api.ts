import {
  clearSessionCookie,
  hashPassword,
  parseCookie,
  readOAuthState,
  readSession,
  sessionCookie,
  signOAuthState,
  signSession,
  SoftballApiError,
  verifyPassword,
} from "./auth";
import { parseClientState } from "./parseState";
import {
  authorizeUrl,
  exchangeCode,
  searchTracks,
  upsertWalkUpPlaylist,
} from "./spotify";
import { newTeamRecord, type SoftballStore } from "./store";
import { toClientState, type TeamRecord } from "./types";

export interface SoftballEnv {
  SOFTBALL_ADMIN_PIN?: string;
  SOFTBALL_SESSION_SECRET?: string;
  SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;
}

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function requireSecret(env: SoftballEnv): string {
  const secret = env.SOFTBALL_SESSION_SECRET?.trim();
  if (!secret) {
    throw new SoftballApiError(500, "Team sessions are not configured.");
  }
  return secret;
}

function originOf(request: Request): string {
  const url = new URL(request.url);
  return url.origin;
}

function spotifyRedirectUri(request: Request): string {
  return `${originOf(request)}/api/softball/spotify/callback`;
}

function isSecure(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}

async function requireTeam(
  request: Request,
  env: SoftballEnv,
  store: SoftballStore,
): Promise<TeamRecord> {
  const secret = requireSecret(env);
  const token = parseCookie(request.headers.get("Cookie"));
  const session = await readSession(token, secret);
  if (!session) throw new SoftballApiError(401, "Sign in with the team password.");
  const team = await store.getTeam(session.teamId);
  if (!team) throw new SoftballApiError(401, "That team is no longer available.");
  return team;
}

function clientPayload(team: TeamRecord) {
  return {
    team: { id: team.id, name: team.name, season: team.season },
    state: toClientState(team),
  };
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") return {};
    return body as Record<string, unknown>;
  } catch {
    throw new SoftballApiError(400, "Invalid JSON body.");
  }
}

function walkUpUris(team: TeamRecord): string[] {
  const byId = new Map(team.state.roster.map((player) => [player.id, player]));
  const uris: string[] = [];
  for (const id of team.state.battingOrder) {
    const player = byId.get(id);
    if (!player?.present) continue;
    const uri = player.walkUpSong?.uri;
    if (uri) uris.push(uri);
  }
  return uris;
}

export async function handleSoftballRequest(
  request: Request,
  env: SoftballEnv,
  store: SoftballStore,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const route = path.replace(/^\/api\/softball/, "") || "/";
  const method = request.method.toUpperCase();

  try {
    if (route === "/teams" && method === "GET") {
      return json({ teams: await store.listTeams() });
    }

    if (route === "/teams" && method === "POST") {
      const body = await readJson(request);
      const adminPin = String(body.adminPin ?? "");
      const expected = env.SOFTBALL_ADMIN_PIN?.trim();
      if (!expected || adminPin !== expected) {
        throw new SoftballApiError(403, "Admin PIN is incorrect.");
      }
      const name = String(body.name ?? "").trim();
      const season = String(body.season ?? "").trim();
      const password = String(body.password ?? "");
      if (!name || !season) throw new SoftballApiError(400, "Team name and season are required.");
      if (password.length < 6) {
        throw new SoftballApiError(400, "Team password must be at least 6 characters.");
      }
      const { hash, salt } = await hashPassword(password);
      const team = newTeamRecord({
        name,
        season,
        passwordHash: hash,
        passwordSalt: salt,
      });
      await store.putTeam(team);
      const token = await signSession(team.id, requireSecret(env));
      return json(clientPayload(team), 201, {
        "Set-Cookie": sessionCookie(token, isSecure(request)),
      });
    }

    if (route === "/login" && method === "POST") {
      const body = await readJson(request);
      const teamId = String(body.teamId ?? "");
      const password = String(body.password ?? "");
      const team = await store.getTeam(teamId);
      if (!team || !(await verifyPassword(password, team.passwordSalt, team.passwordHash))) {
        throw new SoftballApiError(401, "Team or password is incorrect.");
      }
      const token = await signSession(team.id, requireSecret(env));
      return json(clientPayload(team), 200, {
        "Set-Cookie": sessionCookie(token, isSecure(request)),
      });
    }

    if (route === "/logout" && method === "POST") {
      return json(
        { ok: true },
        200,
        { "Set-Cookie": clearSessionCookie(isSecure(request)) },
      );
    }

    if (route === "/state" && method === "GET") {
      const team = await requireTeam(request, env, store);
      return json(clientPayload(team));
    }

    if (route === "/state" && method === "PUT") {
      const team = await requireTeam(request, env, store);
      const body = await readJson(request);
      team.state = parseClientState(body);
      await store.putTeam(team);
      return json(clientPayload(team));
    }

    if (route === "/spotify/search" && method === "GET") {
      await requireTeam(request, env, store);
      const q = url.searchParams.get("q")?.trim() ?? "";
      if (q.length < 2) return json({ tracks: [] });
      const tracks = await searchTracks(env, q);
      return json({ tracks });
    }

    if (route === "/spotify/connect" && method === "GET") {
      const team = await requireTeam(request, env, store);
      const state = await signOAuthState(team.id, requireSecret(env));
      return Response.redirect(authorizeUrl(env, spotifyRedirectUri(request), state), 302);
    }

    if (route === "/spotify/callback" && method === "GET") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");
      const appUrl = `${originOf(request)}/softball/`;
      if (error || !code) {
        return Response.redirect(`${appUrl}?spotify=error`, 302);
      }
      const parsed = await readOAuthState(state, requireSecret(env));
      if (!parsed) return Response.redirect(`${appUrl}?spotify=error`, 302);
      const team = await store.getTeam(parsed.teamId);
      if (!team) return Response.redirect(`${appUrl}?spotify=error`, 302);
      const tokens = await exchangeCode(env, code, spotifyRedirectUri(request));
      team.spotifyRefreshToken = tokens.refreshToken;
      await store.putTeam(team);
      return Response.redirect(`${appUrl}?spotify=connected`, 302);
    }

    if (route === "/spotify/playlist" && method === "POST") {
      const team = await requireTeam(request, env, store);
      if (!team.spotifyRefreshToken) {
        throw new SoftballApiError(400, "Connect Spotify before creating a playlist.");
      }
      const uris = walkUpUris(team);
      if (uris.length === 0) {
        throw new SoftballApiError(400, "No walk-up songs in the current batting order.");
      }
      const result = await upsertWalkUpPlaylist({
        env,
        refreshToken: team.spotifyRefreshToken,
        name: `${team.name} walk-up — ${team.season}`,
        uris,
        playlistId: team.spotifyPlaylistId,
      });
      team.spotifyPlaylistId = result.playlistId;
      team.spotifyPlaylistUrl = result.playlistUrl;
      await store.putTeam(team);
      return json({
        playlistId: result.playlistId,
        playlistUrl: result.playlistUrl,
        trackCount: uris.length,
      });
    }

    throw new SoftballApiError(404, "Not found.");
  } catch (error) {
    if (error instanceof SoftballApiError) {
      return json({ error: error.message }, error.status);
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
}
