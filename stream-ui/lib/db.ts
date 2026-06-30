/**
 * SQLite handle using Node's built-in node:sqlite (stable in Node 24).
 * Single-host, file-backed store for the operator-managed internet streams.
 * Synchronous API — only ever called from Node route handlers, never the browser.
 */
import "server-only";
import path from "node:path";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;

  const file = process.env.DATABASE_PATH ?? "./data/headend.db";
  const resolved = path.resolve(process.cwd(), file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  db = new DatabaseSync(resolved);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS internet_streams (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      number       INTEGER NOT NULL DEFAULT 0,
      source_url   TEXT    NOT NULL,
      logo_url     TEXT,
      type         TEXT    NOT NULL DEFAULT 'hls',
      enabled      INTEGER NOT NULL DEFAULT 1,
      quality      TEXT    NOT NULL DEFAULT '',
      -- geo metadata
      regions      TEXT    NOT NULL DEFAULT '',
      geo_blocked  INTEGER NOT NULL DEFAULT 0,
      -- validation state, maintained by the stream-check process
      status       TEXT    NOT NULL DEFAULT 'unknown',
      resolved_url TEXT,
      last_error   TEXT,
      last_latency_ms INTEGER,
      last_checked TEXT,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Idempotent migrations for databases created before a column existed.
  addColumnIfMissing(db, "internet_streams", "quality", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, "internet_streams", "regions", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, "internet_streams", "geo_blocked", "INTEGER NOT NULL DEFAULT 0");

  seedIfEmpty(db);

  return db;
}

interface SeedStream {
  name: string;
  number?: number;
  sourceUrl: string;
  logoUrl?: string | null;
  type?: string;
  quality?: string;
  regions?: string[];
  enabled?: boolean;
}

/**
 * On a brand-new database, populate the curated internet streams from
 * seed/streams.json (shipped with the app). Runs only when the table is empty,
 * so it never duplicates or disturbs an existing deployment.
 */
function seedIfEmpty(database: DatabaseSync): void {
  const { count } = database
    .prepare("SELECT COUNT(*) AS count FROM internet_streams")
    .get() as unknown as { count: number };
  if (count > 0) return;

  const seedFile = path.resolve(process.cwd(), "seed/streams.json");
  if (!fs.existsSync(seedFile)) return;

  let streams: SeedStream[];
  try {
    streams = JSON.parse(fs.readFileSync(seedFile, "utf8"));
  } catch {
    return; // bad/empty seed — leave the DB empty
  }
  if (!Array.isArray(streams) || streams.length === 0) return;

  const insert = database.prepare(
    `INSERT INTO internet_streams (name, number, source_url, logo_url, type, enabled, quality, regions)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  database.exec("BEGIN");
  try {
    for (const s of streams) {
      if (!s?.name || !s?.sourceUrl) continue;
      insert.run(
        s.name,
        s.number ?? 0,
        s.sourceUrl,
        s.logoUrl ?? null,
        s.type ?? "hls",
        s.enabled === false ? 0 : 1,
        s.quality ?? "",
        (s.regions ?? []).join(","),
      );
    }
    database.exec("COMMIT");
  } catch {
    database.exec("ROLLBACK");
  }
}

function addColumnIfMissing(
  database: DatabaseSync,
  table: string,
  column: string,
  definition: string,
): void {
  const cols = database
    .prepare(`PRAGMA table_info(${table})`)
    .all() as unknown as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
