const SESSION_COOKIE = "softball_session";
const SESSION_DAYS = 30;

export class SoftballApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "SoftballApiError";
  }
}

function bytesToB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64UrlToBytes(value: string): Uint8Array {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

async function hmacSign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    utf8(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, utf8(payload));
  return bytesToB64Url(new Uint8Array(sig));
}

async function hmacVerify(secret: string, payload: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(secret, payload);
  return expected === signature;
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", utf8(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 },
    key,
    256,
  );
  return { hash: bytesToB64Url(new Uint8Array(bits)), salt: bytesToB64Url(salt) };
}

export async function verifyPassword(
  password: string,
  saltB64: string,
  hashB64: string,
): Promise<boolean> {
  const salt = b64UrlToBytes(saltB64);
  const key = await crypto.subtle.importKey("raw", utf8(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 },
    key,
    256,
  );
  return bytesToB64Url(new Uint8Array(bits)) === hashB64;
}

export async function signSession(teamId: string, secret: string): Promise<string> {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = bytesToB64Url(utf8(JSON.stringify({ teamId, exp })));
  const sig = await hmacSign(secret, payload);
  return `${payload}.${sig}`;
}

export async function readSession(
  token: string | null,
  secret: string,
): Promise<{ teamId: string } | null> {
  if (!token || !secret) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (!(await hmacVerify(secret, payload, sig))) return null;
  try {
    const json = JSON.parse(new TextDecoder().decode(b64UrlToBytes(payload))) as {
      teamId?: string;
      exp?: number;
    };
    if (!json.teamId || typeof json.exp !== "number" || json.exp < Date.now()) return null;
    return { teamId: json.teamId };
  } catch {
    return null;
  }
}

export function parseCookie(header: string | null, name = SESSION_COOKIE): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function sessionCookie(token: string, secure: boolean): string {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export async function signOAuthState(teamId: string, secret: string): Promise<string> {
  const exp = Date.now() + 15 * 60 * 1000;
  const payload = bytesToB64Url(utf8(JSON.stringify({ teamId, exp })));
  const sig = await hmacSign(secret, payload);
  return `${payload}.${sig}`;
}

export async function readOAuthState(
  state: string | null,
  secret: string,
): Promise<{ teamId: string } | null> {
  return readSession(state, secret);
}
