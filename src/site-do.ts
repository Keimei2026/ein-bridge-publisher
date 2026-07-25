import { DurableObject } from "cloudflare:workers";
import type { Env, PublicationMode, RevisionSummary, SiteSummary } from "./types";
import {
  CHUNK_BYTES,
  DELETE_RETENTION_MS,
  MAX_FILE_BYTES,
  MAX_REVISIONS,
  UPLOAD_TTL_MS,
  json,
  readJson,
  sha256Hex
} from "./utils";

type SiteMetaRow = {
  slug: string;
  title: string;
  mode: string;
  current_revision: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  byte_size: number;
};

type UploadRow = {
  upload_id: string;
  slug: string;
  title: string;
  mode: string;
  expected_size: number;
  expected_chunks: number;
  created_at: number;
  expires_at: number;
  created_by: string;
};

type ChunkRow = { idx: number; sha256: string; byte_size: number; data?: ArrayBuffer };

type RevisionRow = {
  id: string;
  title: string;
  mode: string;
  byte_size: number;
  content_hash: string;
  created_at: number;
  created_by: string;
};

function normalizeMode(value: unknown): PublicationMode {
  return value === "interactive" ? "interactive" : "static";
}

function siteSummary(row: SiteMetaRow): SiteSummary {
  return {
    slug: row.slug,
    title: row.title,
    mode: normalizeMode(row.mode),
    currentRevision: row.current_revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    byteSize: row.byte_size
  };
}

export class SiteDO extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS site_meta (
        singleton INTEGER PRIMARY KEY CHECK(singleton=1),
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        mode TEXT NOT NULL,
        current_revision TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        byte_size INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS uploads (
        upload_id TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        mode TEXT NOT NULL,
        expected_size INTEGER NOT NULL,
        expected_chunks INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        created_by TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS upload_chunks (
        upload_id TEXT NOT NULL,
        idx INTEGER NOT NULL,
        data BLOB NOT NULL,
        sha256 TEXT NOT NULL,
        byte_size INTEGER NOT NULL,
        PRIMARY KEY(upload_id, idx)
      );
      CREATE TABLE IF NOT EXISTS completed_uploads (
        upload_id TEXT PRIMARY KEY,
        result_json TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS revisions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        mode TEXT NOT NULL,
        byte_size INTEGER NOT NULL,
        content_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        created_by TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_revisions_created ON revisions(created_at DESC);
      CREATE TABLE IF NOT EXISTS revision_chunks (
        revision_id TEXT NOT NULL,
        idx INTEGER NOT NULL,
        data BLOB NOT NULL,
        sha256 TEXT NOT NULL,
        byte_size INTEGER NOT NULL,
        PRIMARY KEY(revision_id, idx)
      );
    `);
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === "POST" && url.pathname === "/start") return this.startUpload(request);
      if (request.method === "PUT" && url.pathname.startsWith("/chunk/")) return this.putChunk(request, url);
      if (request.method === "GET" && url.pathname.startsWith("/upload-status/")) return this.uploadStatus(url);
      if (request.method === "POST" && url.pathname.startsWith("/finish/")) return this.finishUpload(url);
      if (request.method === "GET" && url.pathname === "/meta") return this.getMeta();
      if (request.method === "GET" && url.pathname === "/history") return this.getHistory();
      if (request.method === "GET" && url.pathname.startsWith("/revision-meta/")) return this.getRevisionMeta(url);
      if (request.method === "GET" && url.pathname.startsWith("/revision/")) return this.getRevision(url);
      if (request.method === "POST" && url.pathname.startsWith("/rollback/")) return this.rollback(url);
      if (request.method === "POST" && url.pathname === "/delete") return this.softDelete();
      if (request.method === "POST" && url.pathname === "/restore") return this.restore();
      if (request.method === "DELETE" && url.pathname === "/permanent") return this.permanentDelete();
      return json({ error: "NOT_FOUND" }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : "SITE_ERROR";
      console.error("site_error", message, error);
      if (message.includes("SQLITE_FULL")) return json({ error: "STORAGE_FULL" }, 507);
      return json({ error: message || "SITE_ERROR" }, 500);
    }
  }

  override async alarm(): Promise<void> {
    this.cleanupExpiredUploads();
    const meta = this.metaRow();
    if (meta?.deleted_at && Date.now() >= meta.deleted_at + DELETE_RETENTION_MS) {
      try {
        const catalog = this.env.CATALOG.get(this.env.CATALOG.idFromName("global"));
        const response = await catalog.fetch("http://catalog/remove", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug: meta.slug })
        });
        if (!response.ok) throw new Error("CATALOG_REMOVE_FAILED");
        await this.ctx.storage.deleteAll();
      } catch (error) {
        console.error("permanent_delete_retry", meta.slug, error);
        await this.ctx.storage.setAlarm(Date.now() + 60 * 60 * 1000);
      }
      return;
    }
    await this.scheduleNextAlarm();
  }

  private metaRow(): SiteMetaRow | null {
    return this.ctx.storage.sql.exec<SiteMetaRow>(`SELECT * FROM site_meta WHERE singleton=1`).toArray()[0] ?? null;
  }

  private uploadRow(uploadId: string): UploadRow | null {
    return this.ctx.storage.sql.exec<UploadRow>(`SELECT * FROM uploads WHERE upload_id=?`, uploadId).toArray()[0] ?? null;
  }

  private revisionRow(revisionId: string): RevisionRow | null {
    return this.ctx.storage.sql.exec<RevisionRow>(`SELECT * FROM revisions WHERE id=?`, revisionId).toArray()[0] ?? null;
  }

  private async startUpload(request: Request): Promise<Response> {
    this.cleanupExpiredUploads();
    const body = await readJson<{
      slug: string;
      title: string;
      mode: PublicationMode;
      byteSize: number;
      chunkCount: number;
      actor: string;
    }>(request);
    const mode = normalizeMode(body.mode);
    if (!body.slug || !body.title.trim()) return json({ error: "MISSING_FIELDS" }, 400);
    if (!Number.isInteger(body.byteSize) || body.byteSize <= 0 || body.byteSize > MAX_FILE_BYTES) {
      return json({ error: "FILE_SIZE_INVALID", maxBytes: MAX_FILE_BYTES }, 400);
    }
    const expected = Math.ceil(body.byteSize / CHUNK_BYTES);
    if (body.chunkCount !== expected) return json({ error: "CHUNK_COUNT_INVALID" }, 400);

    const uploadId = crypto.randomUUID();
    const createdAt = Date.now();
    const expiresAt = createdAt + UPLOAD_TTL_MS;
    this.ctx.storage.sql.exec(
      `INSERT INTO uploads(upload_id,slug,title,mode,expected_size,expected_chunks,created_at,expires_at,created_by)
       VALUES(?,?,?,?,?,?,?,?,?)`,
      uploadId,
      body.slug,
      body.title.trim().slice(0, 160),
      mode,
      body.byteSize,
      expected,
      createdAt,
      expiresAt,
      body.actor
    );
    await this.scheduleNextAlarm();
    return json({ uploadId, chunkBytes: CHUNK_BYTES, expiresAt });
  }

  private async putChunk(request: Request, url: URL): Promise<Response> {
    const uploadId = decodeURIComponent(url.pathname.slice("/chunk/".length));
    const index = Number(url.searchParams.get("index"));
    const expectedHash = request.headers.get("x-chunk-sha256")?.toLowerCase();
    const upload = this.uploadRow(uploadId);
    if (!upload || upload.expires_at <= Date.now()) return json({ error: "UPLOAD_NOT_FOUND" }, 404);
    if (!Number.isInteger(index) || index < 0 || index >= upload.expected_chunks) {
      return json({ error: "CHUNK_INDEX_INVALID" }, 400);
    }
    const bytes = new Uint8Array(await request.arrayBuffer());
    const maxForIndex = index === upload.expected_chunks - 1
      ? upload.expected_size - CHUNK_BYTES * (upload.expected_chunks - 1)
      : CHUNK_BYTES;
    if (bytes.byteLength <= 0 || bytes.byteLength !== maxForIndex) return json({ error: "CHUNK_SIZE_INVALID" }, 400);
    const actualHash = await sha256Hex(bytes);
    if (!expectedHash || expectedHash !== actualHash) return json({ error: "CHUNK_HASH_MISMATCH" }, 400);

    this.ctx.storage.sql.exec(
      `INSERT INTO upload_chunks(upload_id,idx,data,sha256,byte_size) VALUES(?,?,?,?,?)
       ON CONFLICT(upload_id,idx) DO UPDATE SET data=excluded.data,sha256=excluded.sha256,byte_size=excluded.byte_size`,
      uploadId,
      index,
      bytes,
      actualHash,
      bytes.byteLength
    );
    return json({ ok: true, index, sha256: actualHash });
  }

  private uploadStatus(url: URL): Response {
    const uploadId = decodeURIComponent(url.pathname.slice("/upload-status/".length));
    const upload = this.uploadRow(uploadId);
    if (!upload || upload.expires_at <= Date.now()) return json({ error: "UPLOAD_NOT_FOUND" }, 404);
    const chunks = this.ctx.storage.sql.exec<{ idx: number; sha256: string; byte_size: number }>(
      `SELECT idx,sha256,byte_size FROM upload_chunks WHERE upload_id=? ORDER BY idx`,
      uploadId
    ).toArray();
    return json({ upload, chunks });
  }

  private async finishUpload(url: URL): Promise<Response> {
    const uploadId = decodeURIComponent(url.pathname.slice("/finish/".length));
    const completed = this.ctx.storage.sql.exec<{ result_json: string; expires_at: number }>(
      `SELECT result_json,expires_at FROM completed_uploads WHERE upload_id=?`,
      uploadId
    ).toArray()[0];
    if (completed && completed.expires_at > Date.now()) {
      return json(JSON.parse(completed.result_json));
    }
    const upload = this.uploadRow(uploadId);
    if (!upload || upload.expires_at <= Date.now()) return json({ error: "UPLOAD_NOT_FOUND" }, 404);
    const chunks = this.ctx.storage.sql.exec<ChunkRow>(
      `SELECT idx,sha256,byte_size FROM upload_chunks WHERE upload_id=? ORDER BY idx`,
      uploadId
    ).toArray();
    if (chunks.length !== upload.expected_chunks) return json({ error: "UPLOAD_INCOMPLETE", received: chunks.length }, 409);
    const total = chunks.reduce((sum, chunk) => sum + chunk.byte_size, 0);
    if (total !== upload.expected_size || chunks.some((chunk, index) => chunk.idx !== index)) {
      return json({ error: "UPLOAD_INTEGRITY_FAILED" }, 409);
    }
    const manifest = chunks.map((chunk) => `${chunk.idx}:${chunk.byte_size}:${chunk.sha256}`).join("|");
    const contentHash = await sha256Hex(manifest);
    const duplicate = this.ctx.storage.sql.exec<RevisionRow>(
      `SELECT * FROM revisions WHERE content_hash=? AND title=? AND mode=? ORDER BY created_at DESC LIMIT 1`,
      contentHash,
      upload.title,
      upload.mode
    ).toArray()[0];

    const revisionId = duplicate?.id ?? crypto.randomUUID();
    const timestamp = Date.now();
    const existingMeta = this.metaRow();
    const completedSite: SiteSummary = {
      slug: upload.slug,
      title: upload.title,
      mode: normalizeMode(upload.mode),
      currentRevision: revisionId,
      createdAt: existingMeta?.created_at ?? timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      byteSize: upload.expected_size
    };
    const resultPayload = { ok: true, revisionId, deduplicated: Boolean(duplicate), site: completedSite };
    this.ctx.storage.transactionSync(() => {
      if (!duplicate) {
        this.ctx.storage.sql.exec(
          `INSERT INTO revisions(id,title,mode,byte_size,content_hash,created_at,created_by) VALUES(?,?,?,?,?,?,?)`,
          revisionId,
          upload.title,
          upload.mode,
          upload.expected_size,
          contentHash,
          timestamp,
          upload.created_by
        );
        this.ctx.storage.sql.exec(
          `INSERT INTO revision_chunks(revision_id,idx,data,sha256,byte_size)
           SELECT ?,idx,data,sha256,byte_size FROM upload_chunks WHERE upload_id=? ORDER BY idx`,
          revisionId,
          uploadId
        );
      }
      if (existingMeta) {
        this.ctx.storage.sql.exec(
          `UPDATE site_meta SET title=?,mode=?,current_revision=?,updated_at=?,deleted_at=NULL,byte_size=? WHERE singleton=1`,
          upload.title,
          upload.mode,
          revisionId,
          timestamp,
          upload.expected_size
        );
      } else {
        this.ctx.storage.sql.exec(
          `INSERT INTO site_meta(singleton,slug,title,mode,current_revision,created_at,updated_at,deleted_at,byte_size)
           VALUES(1,?,?,?,?,?,?,NULL,?)`,
          upload.slug,
          upload.title,
          upload.mode,
          revisionId,
          timestamp,
          timestamp,
          upload.expected_size
        );
      }
      this.ctx.storage.sql.exec(
        `INSERT OR REPLACE INTO completed_uploads(upload_id,result_json,expires_at) VALUES(?,?,?)`,
        uploadId,
        JSON.stringify(resultPayload),
        timestamp + UPLOAD_TTL_MS
      );
      this.ctx.storage.sql.exec(`DELETE FROM upload_chunks WHERE upload_id=?`, uploadId);
      this.ctx.storage.sql.exec(`DELETE FROM uploads WHERE upload_id=?`, uploadId);
      this.pruneRevisions();
    });

    await this.scheduleNextAlarm();
    return json(resultPayload);
  }

  private getMeta(): Response {
    const meta = this.metaRow();
    return meta ? json({ site: siteSummary(meta) }) : json({ error: "SITE_NOT_FOUND" }, 404);
  }

  private getHistory(): Response {
    const meta = this.metaRow();
    if (!meta) return json({ error: "SITE_NOT_FOUND" }, 404);
    const rows = this.ctx.storage.sql.exec<RevisionRow>(
      `SELECT * FROM revisions ORDER BY created_at DESC LIMIT ?`,
      MAX_REVISIONS
    ).toArray();
    const revisions: RevisionSummary[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      mode: normalizeMode(row.mode),
      byteSize: row.byte_size,
      contentHash: row.content_hash,
      createdAt: row.created_at,
      createdBy: row.created_by
    }));
    return json({ site: siteSummary(meta), revisions });
  }

  private getRevisionMeta(url: URL): Response {
    const revisionId = decodeURIComponent(url.pathname.slice("/revision-meta/".length));
    const revision = this.revisionRow(revisionId);
    if (!revision) return json({ error: "REVISION_NOT_FOUND" }, 404);
    const summary: RevisionSummary = {
      id: revision.id,
      title: revision.title,
      mode: normalizeMode(revision.mode),
      byteSize: revision.byte_size,
      contentHash: revision.content_hash,
      createdAt: revision.created_at,
      createdBy: revision.created_by
    };
    return json({ revision: summary });
  }

  private getRevision(url: URL): Response {
    const revisionId = decodeURIComponent(url.pathname.slice("/revision/".length));
    const revision = this.revisionRow(revisionId);
    if (!revision) return json({ error: "REVISION_NOT_FOUND" }, 404);
    const chunks = this.ctx.storage.sql.exec<{ data: ArrayBuffer; byte_size: number }>(
      `SELECT data,byte_size FROM revision_chunks WHERE revision_id=? ORDER BY idx`,
      revisionId
    ).toArray();
    const output = new Uint8Array(revision.byte_size);
    let offset = 0;
    for (const chunk of chunks) {
      const bytes = new Uint8Array(chunk.data);
      output.set(bytes, offset);
      offset += bytes.byteLength;
    }
    if (offset !== revision.byte_size) return json({ error: "REVISION_CORRUPT" }, 500);
    const headers = new Headers({
      "content-type": "text/html; charset=UTF-8",
      "x-revision-title": encodeURIComponent(revision.title),
      "x-revision-mode": revision.mode,
      "x-revision-id": revision.id,
      "x-revision-size": String(revision.byte_size),
      "x-content-type-options": "nosniff"
    });
    return new Response(output, { headers });
  }

  private rollback(url: URL): Response {
    const revisionId = decodeURIComponent(url.pathname.slice("/rollback/".length));
    const revision = this.revisionRow(revisionId);
    const meta = this.metaRow();
    if (!meta) return json({ error: "SITE_NOT_FOUND" }, 404);
    if (!revision) return json({ error: "REVISION_NOT_FOUND" }, 404);
    const timestamp = Date.now();
    this.ctx.storage.sql.exec(
      `UPDATE site_meta SET title=?,mode=?,current_revision=?,updated_at=?,deleted_at=NULL,byte_size=? WHERE singleton=1`,
      revision.title,
      revision.mode,
      revision.id,
      timestamp,
      revision.byte_size
    );
    const updated = this.metaRow();
    return json({ ok: true, site: updated ? siteSummary(updated) : null });
  }

  private async softDelete(): Promise<Response> {
    const meta = this.metaRow();
    if (!meta) return json({ error: "SITE_NOT_FOUND" }, 404);
    const deletedAt = meta.deleted_at ?? Date.now();
    this.ctx.storage.sql.exec(`UPDATE site_meta SET deleted_at=?,updated_at=? WHERE singleton=1`, deletedAt, Date.now());
    await this.scheduleNextAlarm();
    const updated = this.metaRow();
    return json({ ok: true, site: updated ? siteSummary(updated) : null, purgeAt: deletedAt + DELETE_RETENTION_MS });
  }

  private async restore(): Promise<Response> {
    const meta = this.metaRow();
    if (!meta) return json({ error: "SITE_NOT_FOUND" }, 404);
    if (meta.deleted_at && Date.now() >= meta.deleted_at + DELETE_RETENTION_MS) {
      return json({ error: "RESTORE_WINDOW_EXPIRED" }, 410);
    }
    const updatedAt = Date.now();
    this.ctx.storage.sql.exec(`UPDATE site_meta SET deleted_at=NULL,updated_at=? WHERE singleton=1`, updatedAt);
    await this.scheduleNextAlarm();
    const updated = this.metaRow();
    return json({ ok: true, site: updated ? siteSummary(updated) : null });
  }

  private async permanentDelete(): Promise<Response> {
    const meta = this.metaRow();
    if (!meta) return json({ ok: true, removed: false });
    await this.ctx.storage.deleteAll();
    return json({ ok: true, removed: true, slug: meta.slug });
  }

  private cleanupExpiredUploads(): void {
    const now = Date.now();
    this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec(
        `DELETE FROM upload_chunks WHERE upload_id IN (SELECT upload_id FROM uploads WHERE expires_at<=?)`,
        now
      );
      this.ctx.storage.sql.exec(`DELETE FROM uploads WHERE expires_at<=?`, now);
      this.ctx.storage.sql.exec(`DELETE FROM completed_uploads WHERE expires_at<=?`, now);
    });
  }

  private pruneRevisions(): void {
    const old = this.ctx.storage.sql.exec<{ id: string }>(
      `SELECT id FROM revisions ORDER BY created_at DESC LIMIT -1 OFFSET ?`,
      MAX_REVISIONS
    ).toArray();
    for (const row of old) {
      this.ctx.storage.sql.exec(`DELETE FROM revision_chunks WHERE revision_id=?`, row.id);
      this.ctx.storage.sql.exec(`DELETE FROM revisions WHERE id=?`, row.id);
    }
  }

  private async scheduleNextAlarm(): Promise<void> {
    const uploadExpiry = this.ctx.storage.sql.exec<{ expires_at: number }>(
      `SELECT MIN(expires_at) AS expires_at FROM uploads`
    ).toArray()[0]?.expires_at;
    const completedExpiry = this.ctx.storage.sql.exec<{ expires_at: number }>(
      `SELECT MIN(expires_at) AS expires_at FROM completed_uploads`
    ).toArray()[0]?.expires_at;
    const meta = this.metaRow();
    const deleteExpiry = meta?.deleted_at ? meta.deleted_at + DELETE_RETENTION_MS : undefined;
    const candidates = [uploadExpiry, completedExpiry, deleteExpiry].filter((value): value is number => typeof value === "number" && value > Date.now());
    if (candidates.length === 0) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(Math.min(...candidates));
  }
}
