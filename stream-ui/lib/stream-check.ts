/**
 * Stream validation — the operator's own process for keeping public/internet
 * stream URLs healthy.
 *
 * For each stream we:
 *   1. Fetch the source URL, following redirects (e.g. an i.mjh.nz wrapper →
 *      the real fullscreen.nz origin) and capturing the resolved origin.
 *   2. Confirm the response is OK and, for HLS, that the body is a real
 *      `#EXTM3U` playlist (not an error page / dead host).
 *   3. Return a status + resolved origin + latency that gets persisted so the
 *      admin can see which streams are still good and catch breakage early.
 */
import "server-only";
import {
  deleteStream,
  getStream,
  listStreams,
  recordCheck,
} from "@/lib/streams";
import type { InternetStream, StreamStatus } from "@/types";

const CHECK_TIMEOUT_MS = 8000;

export interface CheckResult {
  status: StreamStatus;
  resolvedUrl: string | null;
  lastError: string | null;
  latencyMs: number | null;
  /** Heuristic: the stream looks geo-restricted from our (NZ) location. */
  geoBlocked: boolean;
  /** Measured resolution of the chosen variant ("1080p"), or "" if unknown. */
  quality: string;
}

// HTTP statuses CDNs return when blocking by region (akamai/9now/etc).
const GEO_STATUSES = new Set([400, 403, 451]);

/**
 * Given an HLS master/multivariant playlist, return the highest-BANDWIDTH
 * variant URL (resolved absolute against the master URL). Returns null when the
 * playlist is already a media playlist (no #EXT-X-STREAM-INF variants), so the
 * caller keeps the original URL.
 */
export function pickHighestVariant(
  master: string,
  baseUrl: string,
): { url: string; bandwidth: number; quality: string } | null {
  const lines = master.split(/\r?\n/);
  let best: { url: string; bandwidth: number; quality: string } | null = null;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith("#EXT-X-STREAM-INF")) continue;
    const bandwidth = Number(lines[i].match(/BANDWIDTH=(\d+)/)?.[1] ?? 0);
    // RESOLUTION=1920x1080 → "1080p"
    const height = lines[i].match(/RESOLUTION=\d+x(\d+)/)?.[1];
    const quality = height ? `${height}p` : "";
    let uri = "";
    for (let j = i + 1; j < lines.length; j++) {
      const n = lines[j].trim();
      if (!n || n.startsWith("#")) continue;
      uri = n;
      break;
    }
    if (!uri) continue;
    if (!best || bandwidth > best.bandwidth) {
      try {
        best = { url: new URL(uri, baseUrl).href, bandwidth, quality };
      } catch {
        // ignore unparseable variant URI
      }
    }
  }
  return best;
}

export async function validateUrl(
  url: string,
  type: InternetStream["type"],
): Promise<CheckResult> {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      cache: "no-store",
      headers: { "User-Agent": "helio-headend/1.0" },
    });
    const latencyMs = Math.round(performance.now() - start);
    // res.url is the final URL after any redirects — the true origin.
    let resolvedUrl = res.url || url;

    if (!res.ok) {
      return {
        status: "error",
        resolvedUrl,
        lastError: `HTTP ${res.status}`,
        latencyMs,
        geoBlocked: GEO_STATUSES.has(res.status),
        quality: "",
      };
    }

    let quality = "";
    if (type === "hls") {
      const body = await res.text();
      if (!body.includes("#EXTM3U")) {
        // A 200 that isn't a playlist is almost always a geo/landing redirect page.
        return {
          status: "error",
          resolvedUrl,
          lastError: "Response is not a valid HLS playlist (#EXTM3U missing)",
          latencyMs,
          geoBlocked: true,
          quality: "",
        };
      }
      // Resolve to the highest-bitrate rendition (per "highest stream rate only").
      const best = pickHighestVariant(body, resolvedUrl);
      if (best) {
        resolvedUrl = best.url;
        quality = best.quality;
      }
    }

    return {
      status: "ok",
      resolvedUrl,
      lastError: null,
      latencyMs,
      geoBlocked: false,
      quality,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    const message =
      err instanceof Error
        ? err.name === "TimeoutError"
          ? "Timed out"
          : err.message
        : "Unreachable";
    // Network failures / timeouts are "dead", not geo-blocked.
    return {
      status: "error",
      resolvedUrl: null,
      lastError: message,
      latencyMs,
      geoBlocked: false,
      quality: "",
    };
  }
}

/** Validate one stream and persist the result. */
export async function checkStream(id: number): Promise<InternetStream | null> {
  const stream = getStream(id);
  if (!stream) return null;
  const result = await validateUrl(stream.sourceUrl, stream.type);
  recordCheck(id, result);
  return getStream(id);
}

/** Validate every stream (used by the admin "re-check all" button and cron). */
export async function checkAllStreams(): Promise<InternetStream[]> {
  const streams = listStreams();
  await Promise.all(
    streams.map(async (s) => {
      const result = await validateUrl(s.sourceUrl, s.type);
      recordCheck(s.id, result);
    }),
  );
  return listStreams();
}

/**
 * Validate everything, then DELETE any stream that is geo-blocked from our
 * (NZ) location — we only support New Zealand. Returns the removed streams and
 * the surviving lineup.
 */
export async function checkAndPruneGeoBlocked(): Promise<{
  removed: InternetStream[];
  remaining: InternetStream[];
}> {
  const checked = await checkAllStreams();
  const removed = checked.filter((s) => s.geoBlocked);
  for (const s of removed) deleteStream(s.id);
  return { removed, remaining: listStreams() };
}

/**
 * Validate everything, then DELETE every stream that failed validation
 * (geo-blocked AND dead/unreachable). Returns removed + survivors.
 */
export async function checkAndPruneFailed(): Promise<{
  removed: InternetStream[];
  remaining: InternetStream[];
}> {
  const checked = await checkAllStreams();
  const removed = checked.filter((s) => s.status === "error");
  for (const s of removed) deleteStream(s.id);
  return { removed, remaining: listStreams() };
}

/** Re-validate only streams whose last check is older than the TTL (on-read upkeep). */
export async function revalidateStale(): Promise<void> {
  const ttlMin = Number(process.env.STREAM_CHECK_TTL_MIN ?? "15");
  if (!Number.isFinite(ttlMin) || ttlMin <= 0) return;
  const cutoff = Date.now() - ttlMin * 60_000;

  const stale = listStreams().filter((s) => {
    if (!s.lastChecked) return true;
    // SQLite datetime('now') is UTC; treat it as such.
    const ts = Date.parse(s.lastChecked.replace(" ", "T") + "Z");
    return Number.isNaN(ts) || ts < cutoff;
  });

  await Promise.all(
    stale.map(async (s) => {
      const result = await validateUrl(s.sourceUrl, s.type);
      recordCheck(s.id, result);
    }),
  );
}
