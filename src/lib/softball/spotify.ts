import { SoftballApiError } from "./auth";
import type { WalkUpSong } from "./types";

export interface SpotifyEnv {
  SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;
}

interface Token {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
}

let clientToken: { token: string; exp: number } | null = null;

function requireSpotify(env: SpotifyEnv): { id: string; secret: string } {
  const id = env.SPOTIFY_CLIENT_ID?.trim();
  const secret = env.SPOTIFY_CLIENT_SECRET?.trim();
  if (!id || !secret) {
    throw new SoftballApiError(503, "Spotify is not configured on the server.");
  }
  return { id, secret };
}

function basicAuth(id: string, secret: string): string {
  return `Basic ${btoa(`${id}:${secret}`)}`;
}

async function tokenRequest(body: URLSearchParams, env: SpotifyEnv): Promise<Token> {
  const { id, secret } = requireSpotify(env);
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: basicAuth(id, secret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = (await res.json()) as Token & { error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new SoftballApiError(
      502,
      json.error_description || json.error || "Spotify token request failed.",
    );
  }
  return json;
}

export async function clientCredentialsToken(env: SpotifyEnv): Promise<string> {
  if (clientToken && clientToken.exp > Date.now() + 10_000) return clientToken.token;
  const json = await tokenRequest(new URLSearchParams({ grant_type: "client_credentials" }), env);
  clientToken = {
    token: json.access_token,
    exp: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

export async function exchangeCode(
  env: SpotifyEnv,
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const json = await tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
    env,
  );
  if (!json.refresh_token) {
    throw new SoftballApiError(502, "Spotify did not return a refresh token.");
  }
  return { accessToken: json.access_token, refreshToken: json.refresh_token };
}

export async function refreshAccessToken(env: SpotifyEnv, refreshToken: string): Promise<string> {
  const json = await tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    env,
  );
  return json.access_token;
}

export function authorizeUrl(env: SpotifyEnv, redirectUri: string, state: string): string {
  const { id } = requireSpotify(env);
  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", id);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "playlist-modify-public playlist-modify-private");
  url.searchParams.set("state", state);
  return url.toString();
}

export interface SpotifyTrackHit {
  id: string;
  name: string;
  artists: string;
  uri: string;
  albumArt?: string;
}

export async function searchTracks(env: SpotifyEnv, query: string): Promise<SpotifyTrackHit[]> {
  const token = await clientCredentialsToken(env);
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", "8");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new SoftballApiError(502, "Spotify search failed.");
  }
  const json = (await res.json()) as {
    tracks?: {
      items?: {
        id: string;
        name: string;
        uri: string;
        artists?: { name: string }[];
        album?: { images?: { url: string }[] };
      }[];
    };
  };
  return (json.tracks?.items ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    artists: (item.artists ?? []).map((artist) => artist.name).join(", "),
    uri: item.uri,
    albumArt: item.album?.images?.[item.album.images.length - 1]?.url,
  }));
}

export function songFromHit(hit: SpotifyTrackHit): WalkUpSong {
  return {
    spotifyId: hit.id,
    name: hit.name,
    artists: hit.artists,
    uri: hit.uri,
    albumArt: hit.albumArt,
  };
}

async function spotifyJson(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = json as { error?: { message?: string } };
    throw new SoftballApiError(502, err.error?.message || "Spotify request failed.");
  }
  return json;
}

export async function upsertWalkUpPlaylist(input: {
  env: SpotifyEnv;
  refreshToken: string;
  name: string;
  uris: string[];
  playlistId?: string;
}): Promise<{ playlistId: string; playlistUrl: string }> {
  const token = await refreshAccessToken(input.env, input.refreshToken);
  const me = (await spotifyJson(token, "/me")) as { id: string };
  let playlistId = input.playlistId;
  let playlistUrl = "";

  if (playlistId) {
    try {
      const existing = (await spotifyJson(token, `/playlists/${playlistId}`)) as {
        external_urls?: { spotify?: string };
      };
      playlistUrl = existing.external_urls?.spotify ?? `https://open.spotify.com/playlist/${playlistId}`;
      await spotifyJson(token, `/playlists/${playlistId}`, {
        method: "PUT",
        body: JSON.stringify({ name: input.name, description: "Walk-up songs in batting order" }),
      });
    } catch {
      playlistId = undefined;
    }
  }

  if (!playlistId) {
    const created = (await spotifyJson(token, `/users/${me.id}/playlists`, {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        description: "Walk-up songs in batting order",
        public: false,
      }),
    })) as { id: string; external_urls?: { spotify?: string } };
    playlistId = created.id;
    playlistUrl = created.external_urls?.spotify ?? `https://open.spotify.com/playlist/${playlistId}`;
  }

  await spotifyJson(token, `/playlists/${playlistId}/tracks`, {
    method: "PUT",
    body: JSON.stringify({ uris: input.uris.slice(0, 100) }),
  });

  return { playlistId, playlistUrl };
}
