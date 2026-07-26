export type PublicationMode = "static" | "interactive";

export interface Env {
  CATALOG: DurableObjectNamespace;
  SITES: DurableObjectNamespace;
  ADMIN_EMAIL: string;
  ADMIN_HOST: string;
  PUBLIC_HOST: string;
  GOOGLE_CLIENT_ID: string;
  SESSION_SECRET?: string;
}

export interface SiteSummary {
  slug: string;
  title: string;
  mode: PublicationMode;
  currentRevision: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  byteSize: number;
}

export interface RevisionSummary {
  id: string;
  title: string;
  mode: PublicationMode;
  byteSize: number;
  contentHash: string;
  createdAt: number;
  createdBy: string;
}

export interface SessionPayload {
  sub: string;
  email: string;
  csrf: string;
  iat: number;
  exp: number;
}
