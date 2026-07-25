import { DurableObject } from "cloudflare:workers";
import type { Env, SiteSummary } from "./types";
import { json, readJson } from "./utils";

type AuditInput = {
  action: string;
  slug?: string;
  actor: string;
  detail?: string;
  requestId?: string;
};

export class CatalogDO extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS sites (
        slug TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        mode TEXT NOT NULL,
        current_revision TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        byte_size INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_sites_updated ON sites(updated_at DESC);
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        slug TEXT,
        actor TEXT NOT NULL,
        detail TEXT,
        request_id TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
    `);
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === "GET" && url.pathname === "/list") {
        const rows = this.ctx.storage.sql.exec<{
          slug: string;
          title: string;
          mode: string;
          current_revision: string | null;
          created_at: number;
          updated_at: number;
          deleted_at: number | null;
          byte_size: number;
        }>(`SELECT * FROM sites ORDER BY deleted_at IS NOT NULL, updated_at DESC`).toArray();
        const sites: SiteSummary[] = rows.map((row) => ({
          slug: row.slug,
          title: row.title,
          mode: row.mode === "interactive" ? "interactive" : "static",
          currentRevision: row.current_revision,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          deletedAt: row.deleted_at,
          byteSize: row.byte_size
        }));
        return json({ sites });
      }

      if (request.method === "POST" && url.pathname === "/upsert") {
        const site = await readJson<SiteSummary>(request);
        this.ctx.storage.sql.exec(
          `INSERT INTO sites(slug,title,mode,current_revision,created_at,updated_at,deleted_at,byte_size)
           VALUES(?,?,?,?,?,?,?,?)
           ON CONFLICT(slug) DO UPDATE SET
             title=excluded.title,
             mode=excluded.mode,
             current_revision=excluded.current_revision,
             updated_at=excluded.updated_at,
             deleted_at=excluded.deleted_at,
             byte_size=excluded.byte_size`,
          site.slug,
          site.title,
          site.mode,
          site.currentRevision,
          site.createdAt,
          site.updatedAt,
          site.deletedAt,
          site.byteSize
        );
        return json({ ok: true });
      }

      if (request.method === "POST" && url.pathname === "/remove") {
        const body = await readJson<{ slug: string }>(request);
        this.ctx.storage.sql.exec(`DELETE FROM sites WHERE slug=?`, body.slug);
        return json({ ok: true });
      }

      if (request.method === "POST" && url.pathname === "/audit") {
        const entry = await readJson<AuditInput>(request);
        this.ctx.storage.sql.exec(
          `INSERT INTO audit_log(action,slug,actor,detail,request_id,created_at) VALUES(?,?,?,?,?,?)`,
          entry.action,
          entry.slug ?? null,
          entry.actor,
          entry.detail ?? null,
          entry.requestId ?? null,
          Date.now()
        );
        return json({ ok: true });
      }

      if (request.method === "GET" && url.pathname === "/audit") {
        const rows = this.ctx.storage.sql.exec(
          `SELECT action,slug,actor,detail,request_id,created_at FROM audit_log ORDER BY created_at DESC LIMIT 200`
        ).toArray();
        return json({ entries: rows });
      }

      return json({ error: "NOT_FOUND" }, 404);
    } catch (error) {
      console.error("catalog_error", error);
      return json({ error: "CATALOG_ERROR" }, 500);
    }
  }
}
