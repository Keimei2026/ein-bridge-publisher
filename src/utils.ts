export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const CHUNK_BYTES = 128 * 1024;
export const MAX_REVISIONS = 10;
export const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
export const DELETE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  const output = new Headers(headers);
  output.set("content-type", "application/json; charset=UTF-8");
  output.set("cache-control", "no-store");
  output.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(data), { status, headers: output });
}

export function text(value: string, status = 200, headers: HeadersInit = {}): Response {
  const output = new Headers(headers);
  output.set("content-type", "text/plain; charset=UTF-8");
  output.set("x-content-type-options", "nosniff");
  return new Response(value, { status, headers: output });
}

export function html(value: string, status = 200, headers: HeadersInit = {}): Response {
  const output = new Headers(headers);
  output.set("content-type", "text/html; charset=UTF-8");
  output.set("x-content-type-options", "nosniff");
  return new Response(value, { status, headers: output });
}

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function isValidSlug(input: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(input);
}

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return map[char] ?? char;
  });
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += step) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + step));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function utf8ToBase64Url(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

export function base64UrlToUtf8(value: string): string {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

export async function sha256Hex(input: ArrayBuffer | Uint8Array | string): Promise<string> {
  let bytes: Uint8Array;
  if (typeof input === "string") bytes = new TextEncoder().encode(input);
  else bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get("cookie") ?? "";
  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

export function randomToken(bytes = 24): string {
  const output = new Uint8Array(bytes);
  crypto.getRandomValues(output);
  return bytesToBase64Url(output);
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a[i]! ^ b[i]!;
  return difference === 0;
}

export function requestId(request: Request): string {
  return request.headers.get("cf-ray") ?? crypto.randomUUID();
}

export async function readJson<T>(request: Request): Promise<T> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) throw new Error("JSON_REQUIRED");
  return (await request.json()) as T;
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function formatIso(timestampMs: number): string {
  return new Date(timestampMs).toISOString();
}
