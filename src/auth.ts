import type { Env, SessionPayload } from "./types";
import {
  base64UrlToBytes,
  base64UrlToUtf8,
  bytesToBase64Url,
  constantTimeEqual,
  nowSeconds,
  parseCookies,
  randomToken,
  utf8ToBase64Url
} from "./utils";

const SESSION_COOKIE = "__Host-ebp_session";
const CSRF_COOKIE = "__Host-ebp_csrf";
const SESSION_SECONDS = 8 * 60 * 60;

type GoogleClaims = {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  email?: string;
  email_verified?: boolean;
  exp?: number;
  iat?: number;
  azp?: string;
};

type GoogleJwk = JsonWebKey & { kid?: string };
type JwkSet = { keys: GoogleJwk[] };
let jwksCache: { expiresAt: number; keys: GoogleJwk[] } | null = null;


async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSession(payload: Omit<SessionPayload, "iat" | "exp">, secret: string): Promise<string> {
  const now = nowSeconds();
  const complete: SessionPayload = { ...payload, iat: now, exp: now + SESSION_SECONDS };
  const encoded = utf8ToBase64Url(JSON.stringify(complete));
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(encoded)));
  return `${encoded}.${bytesToBase64Url(signature)}`;
}

export async function verifySession(token: string | undefined, secret: string): Promise<SessionPayload | null> {
  if (!token || !secret || secret.length < 64) return null;
  const [encoded, signaturePart, extra] = token.split(".");
  if (!encoded || !signaturePart || extra) return null;
  try {
    const expected = new Uint8Array(
      await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(encoded))
    );
    const actual = base64UrlToBytes(signaturePart);
    if (!constantTimeEqual(expected, actual)) return null;
    const payload = JSON.parse(base64UrlToUtf8(encoded)) as SessionPayload;
    const now = nowSeconds();
    if (!payload.sub || !payload.email || !payload.csrf || !payload.iat || !payload.exp) return null;
    if (payload.iat > now + 120 || payload.exp <= now || payload.exp - payload.iat > SESSION_SECONDS + 60) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function sessionFromRequest(request: Request, env: Env): Promise<SessionPayload | null> {
  const cookies = parseCookies(request);
  const session = await verifySession(cookies[SESSION_COOKIE], env.SESSION_SECRET);
  if (!session || session.email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) return null;
  return session;
}

export function issuePreLoginCsrf(request: Request): { token: string; cookie?: string } {
  const existing = parseCookies(request)[CSRF_COOKIE];
  if (existing && existing.length >= 20) return { token: existing };
  const token = randomToken(24);
  return {
    token,
    cookie: `${CSRF_COOKIE}=${encodeURIComponent(token)}; Path=/; Secure; SameSite=Strict; Max-Age=3600`
  };
}

export function verifyCsrf(request: Request, session?: SessionPayload | null): boolean {
  const cookies = parseCookies(request);
  const cookie = cookies[CSRF_COOKIE];
  const header = request.headers.get("x-csrf-token");
  if (!cookie || !header || cookie !== header) return false;
  return !session || session.csrf === header;
}

export function verifyAdminOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get("origin");
  const protocol = new URL(request.url).protocol;
  return origin === `${protocol}//${env.ADMIN_HOST}`;
}

export function sessionCookies(token: string, csrf: string): string[] {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`,
    `${CSRF_COOKIE}=${encodeURIComponent(csrf)}; Path=/; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`
  ];
}

export function clearSessionCookies(): string[] {
  return [
    `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    `${CSRF_COOKIE}=; Path=/; Secure; SameSite=Strict; Max-Age=0`
  ];
}

async function getGoogleKeys(): Promise<GoogleJwk[]> {
  if (jwksCache && jwksCache.expiresAt > Date.now()) return jwksCache.keys;
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs", {
    headers: { accept: "application/json" }
  });
  if (!response.ok) throw new Error("GOOGLE_KEYS_UNAVAILABLE");
  const body = (await response.json()) as JwkSet;
  const cacheControl = response.headers.get("cache-control") ?? "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  jwksCache = { keys: body.keys, expiresAt: Date.now() + Math.max(300, maxAge) * 1000 };
  return body.keys;
}

export async function verifyGoogleIdToken(token: string, env: Env): Promise<GoogleClaims> {
  const parsed = parseGoogleToken(token);
  let keys = await getGoogleKeys();
  let jwk = keys.find((candidate) => candidate.kid === parsed.header.kid);
  if (!jwk) {
    jwksCache = null;
    keys = await getGoogleKeys();
    jwk = keys.find((candidate) => candidate.kid === parsed.header.kid);
  }
  if (!jwk) throw new Error("INVALID_GOOGLE_TOKEN");
  return verifyWithKey(jwk, parsed.headerPart, parsed.payloadPart, parsed.signaturePart, parsed.claims, env);
}

export async function verifyGoogleIdTokenWithKeys(
  token: string,
  env: Env,
  keys: GoogleJwk[]
): Promise<GoogleClaims> {
  const parsed = parseGoogleToken(token);
  const jwk = keys.find((candidate) => candidate.kid === parsed.header.kid);
  if (!jwk) throw new Error("INVALID_GOOGLE_TOKEN");
  return verifyWithKey(jwk, parsed.headerPart, parsed.payloadPart, parsed.signaturePart, parsed.claims, env);
}

function parseGoogleToken(token: string): {
  header: { alg?: string; kid?: string };
  claims: GoogleClaims;
  headerPart: string;
  payloadPart: string;
  signaturePart: string;
} {
  const [headerPart, payloadPart, signaturePart, extra] = token.split(".");
  if (!headerPart || !payloadPart || !signaturePart || extra) throw new Error("INVALID_GOOGLE_TOKEN");
  const header = JSON.parse(base64UrlToUtf8(headerPart)) as { alg?: string; kid?: string };
  const claims = JSON.parse(base64UrlToUtf8(payloadPart)) as GoogleClaims;
  if (header.alg !== "RS256" || !header.kid) throw new Error("INVALID_GOOGLE_TOKEN");
  return { header, claims, headerPart, payloadPart, signaturePart };
}

async function verifyWithKey(
  jwk: GoogleJwk,
  headerPart: string,
  payloadPart: string,
  signaturePart: string,
  claims: GoogleClaims,
  env: Env
): Promise<GoogleClaims> {
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const validSignature = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(signaturePart),
    new TextEncoder().encode(`${headerPart}.${payloadPart}`)
  );
  if (!validSignature) throw new Error("INVALID_GOOGLE_TOKEN");

  const now = nowSeconds();
  const audienceValid = Array.isArray(claims.aud)
    ? claims.aud.includes(env.GOOGLE_CLIENT_ID)
    : claims.aud === env.GOOGLE_CLIENT_ID;
  if (!audienceValid) throw new Error("INVALID_GOOGLE_AUDIENCE");
  if ((Array.isArray(claims.aud) || claims.azp) && claims.azp !== env.GOOGLE_CLIENT_ID) {
    throw new Error("INVALID_GOOGLE_AUTHORIZED_PARTY");
  }
  if (claims.iss !== "accounts.google.com" && claims.iss !== "https://accounts.google.com") {
    throw new Error("INVALID_GOOGLE_ISSUER");
  }
  if (!claims.exp || !claims.iat || claims.exp <= now || claims.iat > now + 120) throw new Error("EXPIRED_GOOGLE_TOKEN");
  if (!claims.sub || !claims.email || claims.email_verified !== true) throw new Error("UNVERIFIED_GOOGLE_ACCOUNT");
  if (claims.email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) throw new Error("ACCOUNT_NOT_ALLOWED");
  return claims;
}
