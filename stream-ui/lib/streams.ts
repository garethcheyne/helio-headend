/** CRUD repository for operator-managed internet streams. */
import "server-only";
import { getDb } from "@/lib/db";
import type { InternetStream, StreamInput, StreamStatus } from "@/types";

interface StreamRow {
  id: number;
  name: string;
  number: number;
  source_url: string;
  logo_url: string | null;
  type: string;
  enabled: number;
  quality: string | null;
  regions: string | null;
  geo_blocked: number;
  status: string;
  resolved_url: string | null;
  last_error: string | null;
  last_latency_ms: number | null;
  last_checked: string | null;
  created_at: string;
  updated_at: string;
}

function parseRegions(csv: string | null): string[] {
  return (csv ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

function mapRow(r: StreamRow): InternetStream {
  return {
    id: r.id,
    name: r.name,
    number: r.number,
    sourceUrl: r.source_url,
    logoUrl: r.logo_url,
    type: (r.type as InternetStream["type"]) ?? "hls",
    enabled: r.enabled === 1,
    quality: r.quality ?? "",
    regions: parseRegions(r.regions),
    geoBlocked: r.geo_blocked === 1,
    status: (r.status as StreamStatus) ?? "unknown",
    resolvedUrl: r.resolved_url,
    lastError: r.last_error,
    lastLatencyMs: r.last_latency_ms,
    lastChecked: r.last_checked,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const regionsToCsv = (regions: string[] | undefined): string =>
  (regions ?? []).map((s) => s.trim().toUpperCase()).filter(Boolean).join(",");

export function listStreams(): InternetStream[] {
  const rows = getDb()
    .prepare("SELECT * FROM internet_streams ORDER BY number = 0, number, name")
    .all() as unknown as StreamRow[];
  return rows.map(mapRow);
}

export function listEnabledStreams(): InternetStream[] {
  return listStreams().filter((s) => s.enabled);
}

export function getStream(id: number): InternetStream | null {
  const row = getDb()
    .prepare("SELECT * FROM internet_streams WHERE id = ?")
    .get(id) as unknown as StreamRow | undefined;
  return row ? mapRow(row) : null;
}

export function createStream(input: StreamInput): InternetStream {
  const info = getDb()
    .prepare(
      `INSERT INTO internet_streams
         (name, number, source_url, logo_url, type, enabled, quality, regions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.name,
      input.number ?? 0,
      input.sourceUrl,
      input.logoUrl ?? null,
      input.type ?? "hls",
      input.enabled === false ? 0 : 1,
      input.quality ?? "",
      regionsToCsv(input.regions),
    );
  return getStream(Number(info.lastInsertRowid))!;
}

export function updateStream(
  id: number,
  input: StreamInput,
): InternetStream | null {
  const existing = getStream(id);
  if (!existing) return null;
  getDb()
    .prepare(
      `UPDATE internet_streams
         SET name=?, number=?, source_url=?, logo_url=?, type=?, enabled=?,
             quality=?, regions=?, updated_at=datetime('now')
       WHERE id=?`,
    )
    .run(
      input.name,
      input.number ?? 0,
      input.sourceUrl,
      input.logoUrl ?? null,
      input.type ?? existing.type,
      input.enabled === false ? 0 : 1,
      input.quality ?? existing.quality,
      regionsToCsv(input.regions ?? existing.regions),
      id,
    );
  return getStream(id);
}

export function deleteStream(id: number): boolean {
  const info = getDb()
    .prepare("DELETE FROM internet_streams WHERE id = ?")
    .run(id);
  return info.changes > 0;
}

/** Persist the outcome of a validation run (see lib/stream-check.ts). */
export function recordCheck(
  id: number,
  result: {
    status: StreamStatus;
    resolvedUrl: string | null;
    lastError: string | null;
    latencyMs: number | null;
    geoBlocked: boolean;
    /** Measured resolution of the chosen variant, "" to keep the existing value. */
    quality: string | null;
  },
): void {
  getDb()
    .prepare(
      `UPDATE internet_streams
         SET status=?, resolved_url=?, last_error=?, last_latency_ms=?,
             geo_blocked=?, quality=COALESCE(NULLIF(?, ''), quality),
             last_checked=datetime('now')
       WHERE id=?`,
    )
    .run(
      result.status,
      result.resolvedUrl,
      result.lastError,
      result.latencyMs,
      result.geoBlocked ? 1 : 0,
      result.quality ?? "",
      id,
    );
}
