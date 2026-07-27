import type { Env, PublicationMode, SiteSummary } from "./types";
import { CatalogDO } from "./catalog-do";
import { SiteDO } from "./site-do";
import {
  clearSessionCookies,
  createSession,
  issuePreLoginCsrf,
  sessionCookies,
  sessionFromRequest,
  verifyAdminOrigin,
  verifyCsrf,
  verifyGoogleIdToken
} from "./auth";
import {
  adminCss,
  adminJs,
  adminPage,
  setupPage
} from "./ui";
import {
  escapeHtml,
  html,
  isValidSlug,
  json,
  readJson,
  requestId,
  text
} from "./utils";

export { CatalogDO, SiteDO };

const STATIC_CSP = [
  "default-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
  "script-src 'none'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "connect-src 'none'",
  "media-src data: blob:",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "sandbox"
].join("; ");

const INTERACTIVE_CSP = [
  "default-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "connect-src 'none'",
  "media-src data: blob:",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "sandbox allow-scripts"
].join("; ");

const ADMIN_CSP = [
  "default-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "script-src 'self' https://accounts.google.com/gsi/client",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "img-src 'self' data: https://*.googleusercontent.com",
  "font-src 'self'",
  "connect-src 'self' https://accounts.google.com/gsi/",
  "frame-src 'self' data: blob: https://accounts.google.com/"
].join("; ");


let sessionSecretCache: string | null = null;

async function sessionSecret(env: Env): Promise<string> {
  if (env.SESSION_SECRET && env.SESSION_SECRET.length >= 64) return env.SESSION_SECRET;
  if (sessionSecretCache) return sessionSecretCache;
  const response = await catalogStub(env).fetch("http://catalog/secret/session");
  if (!response.ok) throw new Error("SESSION_SECRET_UNAVAILABLE");
  const payload = await response.json<{ value?: string }>();
  if (!payload.value || payload.value.length < 64) throw new Error("SESSION_SECRET_INVALID");
  sessionSecretCache = payload.value;
  return payload.value;
}

function isSingleOriginHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".workers.dev");
}

function secureHeaders(headers: Headers, csp?: string): void {
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  if (csp) headers.set("content-security-policy", csp);
}

function siteStub(env: Env, slug: string): DurableObjectStub {
  return env.SITES.get(env.SITES.idFromName(slug));
}

function catalogStub(env: Env): DurableObjectStub {
  return env.CATALOG.get(env.CATALOG.idFromName("global"));
}

async function catalogUpsert(env: Env, site: SiteSummary): Promise<void> {
  const response = await catalogStub(env).fetch("http://catalog/upsert", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(site)
  });
  if (!response.ok) throw new Error("CATALOG_UPDATE_FAILED");
}

async function retryCatalogUpsert(env: Env, site: SiteSummary): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await catalogUpsert(env, site);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
  console.error("catalog_sync_failed", site.slug, lastError);
}

async function syncCatalog(env: Env, ctx: ExecutionContext, site: SiteSummary): Promise<boolean> {
  try {
    await catalogUpsert(env, site);
    return true;
  } catch {
    ctx.waitUntil(retryCatalogUpsert(env, site));
    return false;
  }
}

async function audit(env: Env, entry: {
  action: string;
  slug?: string;
  actor: string;
  detail?: string;
  requestId?: string;
}): Promise<void> {
  try {
    await catalogStub(env).fetch("http://catalog/audit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(entry)
    });
  } catch (error) {
    console.error("audit_failed", error);
  }
}

async function requireSession(request: Request, env: Env): Promise<ReturnType<typeof sessionFromRequest> extends Promise<infer T> ? T : never> {
  return sessionFromRequest(request, env, await sessionSecret(env));
}

function isMutating(request: Request): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase());
}

async function handleAdmin(request: Request, env: Env, ctx: ExecutionContext, publicOrigin: string): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/") {
    const csrf = issuePreLoginCsrf(request);
    const headers = new Headers({
      "cache-control": "no-store",
      "cross-origin-opener-policy": "same-origin-allow-popups",
      "cross-origin-resource-policy": "same-origin"
    });
    secureHeaders(headers, ADMIN_CSP);
    if (csrf.cookie) headers.append("set-cookie", csrf.cookie);
    return html(adminPage(env, publicOrigin), 200, headers);
  }

  if (request.method === "GET" && url.pathname === "/styles.css") {
    const headers = new Headers({ "content-type": "text/css; charset=UTF-8", "cache-control": "public,max-age=3600" });
    secureHeaders(headers);
    return new Response(adminCss(), { headers });
  }

  if (request.method === "GET" && url.pathname === "/admin.js") {
    const headers = new Headers({ "content-type": "application/javascript; charset=UTF-8", "cache-control": "public,max-age=3600" });
    secureHeaders(headers);
    return new Response(adminJs(), { headers });
  }

  if (request.method === "POST" && url.pathname === "/auth/google") {
    if (!verifyAdminOrigin(request) || !verifyCsrf(request)) return json({ error: "CSRF_FAILED" }, 403);
    try {
      const body = await readJson<{ credential?: string }>(request);
      if (!body.credential) return json({ error: "GOOGLE_CREDENTIAL_REQUIRED" }, 400);
      const claims = await verifyGoogleIdToken(body.credential, env);
      const csrf = request.headers.get("x-csrf-token")!;
      const token = await createSession({ sub: claims.sub!, email: claims.email!, csrf }, await sessionSecret(env));
      const headers = new Headers();
      for (const cookie of sessionCookies(token, csrf)) headers.append("set-cookie", cookie);
      ctx.waitUntil(audit(env, { action: "login", actor: claims.sub!, detail: claims.email, requestId: requestId(request) }));
      return json({ ok: true }, 200, headers);
    } catch (error) {
      const code = error instanceof Error ? error.message : "LOGIN_FAILED";
      console.warn("login_failed", code, requestId(request));
      return json({ error: code }, code === "ACCOUNT_NOT_ALLOWED" ? 403 : 401);
    }
  }

  if (request.method === "POST" && url.pathname === "/auth/logout") {
    const session = await requireSession(request, env);
    if (!session) return json({ error: "UNAUTHORIZED" }, 401);
    if (!verifyAdminOrigin(request) || !verifyCsrf(request, session)) return json({ error: "CSRF_FAILED" }, 403);
    const headers = new Headers();
    for (const cookie of clearSessionCookies()) headers.append("set-cookie", cookie);
    ctx.waitUntil(audit(env, { action: "logout", actor: session.sub, requestId: requestId(request) }));
    return json({ ok: true }, 200, headers);
  }

  if (!url.pathname.startsWith("/api/")) return json({ error: "NOT_FOUND" }, 404);

  const session = await requireSession(request, env);
  if (!session) return json({ error: "UNAUTHORIZED" }, 401);
  if (isMutating(request) && (!verifyAdminOrigin(request) || !verifyCsrf(request, session))) {
    return json({ error: "CSRF_FAILED" }, 403);
  }

  if (request.method === "GET" && url.pathname === "/api/session") {
    return json({ user: { sub: session.sub, email: session.email }, limits: { maxBytes: 5 * 1024 * 1024, revisions: 10 } });
  }

  if (request.method === "GET" && url.pathname === "/api/sites") {
    return catalogStub(env).fetch("http://catalog/list");
  }

  if (request.method === "POST" && url.pathname === "/api/uploads/start") {
    const body = await readJson<{
      slug?: string;
      title?: string;
      mode?: PublicationMode;
      byteSize?: number;
      chunkCount?: number;
    }>(request);
    const slug = (body.slug ?? "").trim().toLowerCase();
    if (!isValidSlug(slug)) return json({ error: "SLUG_INVALID" }, 400);
    const payload = {
      slug,
      title: (body.title ?? "").trim(),
      mode: body.mode === "interactive" ? "interactive" : "static",
      byteSize: body.byteSize,
      chunkCount: body.chunkCount,
      actor: session.sub
    };
    return siteStub(env, slug).fetch("http://site/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  const chunkMatch = url.pathname.match(/^\/api\/uploads\/([^/]+)\/chunks\/(\d+)$/);
  if (request.method === "PUT" && chunkMatch) {
    const slug = (url.searchParams.get("slug") ?? "").toLowerCase();
    if (!isValidSlug(slug)) return json({ error: "SLUG_INVALID" }, 400);
    const uploadId = decodeURIComponent(chunkMatch[1]!);
    const index = Number(chunkMatch[2]);
    return siteStub(env, slug).fetch(`http://site/chunk/${encodeURIComponent(uploadId)}?index=${index}`, {
      method: "PUT",
      headers: {
        "content-type": "application/octet-stream",
        "x-chunk-sha256": request.headers.get("x-chunk-sha256") ?? ""
      },
      body: request.body
    });
  }

  const finishMatch = url.pathname.match(/^\/api\/uploads\/([^/]+)\/finish$/);
  if (request.method === "POST" && finishMatch) {
    const slug = (url.searchParams.get("slug") ?? "").toLowerCase();
    if (!isValidSlug(slug)) return json({ error: "SLUG_INVALID" }, 400);
    const uploadId = decodeURIComponent(finishMatch[1]!);
    const result = await siteStub(env, slug).fetch(`http://site/finish/${encodeURIComponent(uploadId)}`, { method: "POST" });
    const payload = await result.json<any>();
    if (!result.ok) return json(payload, result.status);
    const catalogSynced = await syncCatalog(env, ctx, payload.site as SiteSummary);
    ctx.waitUntil(audit(env, { action: "publish", slug, actor: session.sub, detail: payload.revisionId, requestId: requestId(request) }));
    return json({ ...payload, catalogSynced, warning: catalogSynced ? undefined : "CATALOG_SYNC_PENDING" });
  }

  const historyMatch = url.pathname.match(/^\/api\/sites\/([a-z0-9-]+)\/history$/);
  if (request.method === "GET" && historyMatch) {
    return siteStub(env, historyMatch[1]!).fetch("http://site/history");
  }

  const downloadMatch = url.pathname.match(/^\/api\/sites\/([a-z0-9-]+)\/revisions\/([^/]+)\/download$/);
  if (request.method === "GET" && downloadMatch) {
    const slug = downloadMatch[1]!;
    const revisionId = decodeURIComponent(downloadMatch[2]!);
    const response = await siteStub(env, slug).fetch(`http://site/revision/${encodeURIComponent(revisionId)}`);
    if (!response.ok) return response;
    const headers = new Headers(response.headers);
    headers.set("content-disposition", `attachment; filename="${slug}-${revisionId}.html"`);
    headers.set("cache-control", "no-store");
    return new Response(response.body, { status: response.status, headers });
  }

  const rollbackMatch = url.pathname.match(/^\/api\/sites\/([a-z0-9-]+)\/rollback$/);
  if (request.method === "POST" && rollbackMatch) {
    const slug = rollbackMatch[1]!;
    const body = await readJson<{ revisionId?: string }>(request);
    if (!body.revisionId) return json({ error: "REVISION_REQUIRED" }, 400);
    const response = await siteStub(env, slug).fetch(`http://site/rollback/${encodeURIComponent(body.revisionId)}`, { method: "POST" });
    const payload = await response.json<any>();
    if (!response.ok) return json(payload, response.status);
    const catalogSynced = await syncCatalog(env, ctx, payload.site as SiteSummary);
    ctx.waitUntil(audit(env, { action: "rollback", slug, actor: session.sub, detail: body.revisionId, requestId: requestId(request) }));
    return json({ ...payload, catalogSynced, warning: catalogSynced ? undefined : "CATALOG_SYNC_PENDING" });
  }

  const deleteMatch = url.pathname.match(/^\/api\/sites\/([a-z0-9-]+)\/delete$/);
  if (request.method === "POST" && deleteMatch) {
    const slug = deleteMatch[1]!;
    const response = await siteStub(env, slug).fetch("http://site/delete", { method: "POST" });
    const payload = await response.json<any>();
    if (!response.ok) return json(payload, response.status);
    const catalogSynced = await syncCatalog(env, ctx, payload.site as SiteSummary);
    ctx.waitUntil(audit(env, { action: "delete", slug, actor: session.sub, requestId: requestId(request) }));
    return json({ ...payload, catalogSynced, warning: catalogSynced ? undefined : "CATALOG_SYNC_PENDING" });
  }

  const restoreMatch = url.pathname.match(/^\/api\/sites\/([a-z0-9-]+)\/restore$/);
  if (request.method === "POST" && restoreMatch) {
    const slug = restoreMatch[1]!;
    const response = await siteStub(env, slug).fetch("http://site/restore", { method: "POST" });
    const payload = await response.json<any>();
    if (!response.ok) return json(payload, response.status);
    const catalogSynced = await syncCatalog(env, ctx, payload.site as SiteSummary);
    ctx.waitUntil(audit(env, { action: "restore", slug, actor: session.sub, requestId: requestId(request) }));
    return json({ ...payload, catalogSynced, warning: catalogSynced ? undefined : "CATALOG_SYNC_PENDING" });
  }

  return json({ error: "NOT_FOUND" }, 404);
}

async function handlePublic(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const canonical = url.pathname.match(/^\/p\/([a-z0-9-]+)\/?$/);
  if (request.method === "GET" && canonical) {
    const slug = canonical[1]!;
    const metaResponse = await siteStub(env, slug).fetch("http://site/meta");
    if (!metaResponse.ok) return text("このページは存在しません。", 404);
    const metaPayload = await metaResponse.json<{ site: SiteSummary }>();
    const site = metaPayload.site;
    if (site.deletedAt || !site.currentRevision) return text("このページは公開されていません。", 404);

    // 公開URLから保存済みHTMLを直接返す。iframeを挟まないため、
    // URLは /p/<slug> のまま保たれ、ブラウザ互換性の問題も起きにくい。
    const response = await siteStub(env, slug).fetch(
      `http://site/revision/${encodeURIComponent(site.currentRevision)}`
    );
    if (!response.ok) return response;
    const mode = response.headers.get("x-revision-mode") === "interactive" ? "interactive" : "static";
    const headers = new Headers(response.headers);
    headers.delete("x-revision-title");
    headers.delete("x-revision-mode");
    headers.delete("x-revision-id");
    headers.delete("x-revision-size");
    headers.set("cache-control", "no-store");
    headers.set("content-disposition", "inline");
    headers.set("cross-origin-resource-policy", "same-origin");
    secureHeaders(headers, mode === "interactive" ? INTERACTIVE_CSP : STATIC_CSP);
    return new Response(response.body, { status: 200, headers });
  }

  // RC5以前の版固有URLを開いた場合も、利用者には安定した公開URLを表示する。
  const revisionPage = url.pathname.match(/^\/p\/([a-z0-9-]+)\/r\/([^/]+)\/?$/);
  if (request.method === "GET" && revisionPage) {
    const slug = revisionPage[1]!;
    const location = `/p/${encodeURIComponent(slug)}`;
    const headers = new Headers({ location, "cache-control": "no-store" });
    secureHeaders(headers);
    return new Response(null, { status: 302, headers });
  }

  const content = url.pathname.match(/^\/p\/([a-z0-9-]+)\/content\/([^/]+)$/);
  if (request.method === "GET" && content) {
    const slug = content[1]!;
    const revisionId = decodeURIComponent(content[2]!);
    const metaResponse = await siteStub(env, slug).fetch("http://site/meta");
    if (!metaResponse.ok) return text("Not found", 404);
    const metaPayload = await metaResponse.json<{ site: SiteSummary }>();
    if (metaPayload.site.deletedAt) return text("Not found", 404);
    const response = await siteStub(env, slug).fetch(`http://site/revision/${encodeURIComponent(revisionId)}`);
    if (!response.ok) return response;
    const mode = response.headers.get("x-revision-mode") === "interactive" ? "interactive" : "static";
    const headers = new Headers(response.headers);
    headers.delete("x-revision-title");
    headers.delete("x-revision-mode");
    headers.delete("x-revision-id");
    headers.delete("x-revision-size");
    headers.set("cache-control", "public,max-age=31536000,immutable");
    headers.set("cross-origin-resource-policy", "same-origin");
    secureHeaders(headers, mode === "interactive" ? INTERACTIVE_CSP : STATIC_CSP);
    return new Response(response.body, { status: 200, headers });
  }

  return text("Not found", 404);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();

    if (url.pathname === "/health") {
      const configured = Boolean(
        env.ADMIN_EMAIL && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_ID !== "REPLACE_DURING_DEPLOY"
      );
      return json({
        ok: true,
        configured,
        runtimeMode: isSingleOriginHost(host) ? "single-origin" : "custom-domains",
        adminHost: env.ADMIN_HOST,
        publicHost: env.PUBLIC_HOST,
        sessionKey: env.SESSION_SECRET && env.SESSION_SECRET.length >= 64 ? "environment" : "durable-object"
      });
    }

    try {
      const adminHost = (env.ADMIN_HOST ?? "").toLowerCase();
      const publicHost = (env.PUBLIC_HOST ?? "").toLowerCase();
      if (host === adminHost) return handleAdmin(request, env, ctx, `https://${env.PUBLIC_HOST}`);
      if (host === publicHost) return handlePublic(request, env);

      if (isSingleOriginHost(host)) {
        if (url.pathname.startsWith("/p/")) return handlePublic(request, env);
        return handleAdmin(request, env, ctx, url.origin);
      }

      const headers = new Headers({ "cache-control": "no-store" });
      secureHeaders(headers, "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'");
      return html(setupPage(env, host), 200, headers);
    } catch (error) {
      const id = requestId(request);
      console.error("request_failed", id, error);
      return html(`<!doctype html><html lang="ja"><meta charset="utf-8"><title>エラー</title><body><h1>処理に失敗しました</h1><p>Request ID: <code>${escapeHtml(id)}</code></p></body></html>`, 500, { "cache-control": "no-store" });
    }
  }
};
