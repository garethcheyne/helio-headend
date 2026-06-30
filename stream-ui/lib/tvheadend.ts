/**
 * Server-side helpers for talking to the headend. These run only in Next.js
 * route handlers (Node runtime) — never in the browser — so they can reach the
 * LAN containers directly without CORS/mixed-content issues.
 */
import "server-only";
import { config, tvheadendAuthHeader } from "@/lib/config";
import { listEnabledStreams } from "@/lib/streams";
import type { Channel, TunerInput } from "@/types";

const TIMEOUT_MS = 5000;

async function fetchJson<T>(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as T;
}

interface TvhChannelEntry {
  uuid: string;
  name: string;
  number?: number;
  enabled?: boolean;
}

/** One live HLS variant parsed from the master playlist. */
interface HlsVariant {
  chno: number | null;
  name: string;
  url: string;
}

/**
 * Parse a TVHeadend/nginx HLS master playlist (#EXTM3U) into its variants.
 * Lines look like:
 *   #EXTINF:-1 tvg-chno="1",TVNZ 1
 *   http://192.168.0.122:8080/hls/tvnz1/index.m3u8
 */
export function parseMasterPlaylist(text: string): HlsVariant[] {
  const lines = text.split(/\r?\n/);
  const variants: HlsVariant[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXTINF")) continue;
    const chnoMatch = line.match(/tvg-chno="(\d+)"/);
    const name = line.slice(line.indexOf(",") + 1).trim();
    // The URL is the next non-comment, non-empty line.
    let url = "";
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j].trim();
      if (!next || next.startsWith("#")) continue;
      url = next;
      break;
    }
    if (!url) continue;
    variants.push({
      chno: chnoMatch ? Number(chnoMatch[1]) : null,
      name,
      url,
    });
  }
  return variants;
}

/** Rewrite a playlist URL onto the configured HLS origin (handles localhost/IP drift). */
function normaliseHlsUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    return `${config.hlsUrl}${u.pathname}`;
  } catch {
    // Relative path in the playlist — prefix the origin.
    return `${config.hlsUrl}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
  }
}

/** Fetch + parse the HLS master playlist. Returns [] if the origin is unreachable. */
export async function getHlsVariants(): Promise<HlsVariant[]> {
  try {
    const res = await fetch(`${config.hlsUrl}/hls/channels.m3u8`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const text = await res.text();
    return parseMasterPlaylist(text).map((v) => ({
      ...v,
      url: normaliseHlsUrl(v.url),
    }));
  } catch {
    return [];
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The dynamic channel lineup: the real TVHeadend channel grid merged with the
 * live HLS variants from the master playlist (matched by channel number, then
 * by normalised name as a fallback).
 */
export async function getChannels(): Promise<Channel[]> {
  const [grid, variants] = await Promise.all([
    fetchJson<{ entries?: TvhChannelEntry[] }>(
      `${config.tvheadendUrl}/api/channel/grid?limit=400&sort_key=number`,
      tvheadendAuthHeader(),
    ),
    getHlsVariants(),
  ]);

  const byChno = new Map<number, HlsVariant>();
  const byName = new Map<string, HlsVariant>();
  for (const v of variants) {
    if (v.chno != null) byChno.set(v.chno, v);
    byName.set(norm(v.name), v);
  }

  const dvb: Channel[] = (grid.entries ?? [])
    .filter((e) => e.name)
    // Drop TVHeadend's auto-generated raw service entries
    // (e.g. "DVB-T Network/610MHz/{PMT:161}") — they aren't real channels.
    .filter((e) => !e.name.includes("{PMT:") && !/^DVB-[TCS]\b/.test(e.name))
    .map((e) => {
      const number = e.number ?? 0;
      const variant = byChno.get(number) ?? byName.get(norm(e.name));
      return {
        number,
        name: e.name,
        uuid: e.uuid,
        enabled: e.enabled ?? true,
        source: "dvb",
        hlsAvailable: Boolean(variant),
        hlsUrl: variant?.url ?? null,
        status: null,
      } satisfies Channel;
    });

  // Append operator-managed internet streams (validity comes from stream-check).
  const internet: Channel[] = listEnabledStreams().map((s) => ({
    number: s.number,
    name: s.name,
    uuid: `internet-${s.id}`,
    enabled: s.enabled,
    source: "internet",
    hlsAvailable: s.status === "ok",
    hlsUrl: s.resolvedUrl ?? s.sourceUrl,
    quality: s.quality,
    regions: s.regions,
    geoBlocked: s.geoBlocked,
    status: s.status,
  }));

  return [...dvb, ...internet].sort((a, b) => a.number - b.number);
}

interface TvhInputEntry {
  input: string;
  stream: string;
  bps?: number;
  signal?: number;
  signal_scale?: number;
  snr?: number;
  snr_scale?: number;
  ber?: number;
  unc?: number;
  subs?: number;
  weight?: number;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * TVHeadend reports signal/SNR with a scale flag:
 *   1 = RELATIVE (0..65535 maps to 0..100%)
 *   2 = DECIBEL  (value is milli-dB → dB = value / 1000)
 * Normalise to a dB reading (when available) plus a 0..100 quality bar.
 */
function normalise(
  value: number | undefined,
  scale: number | undefined,
  kind: "snr" | "signal",
): { db: number | null; pct: number } {
  if (value == null || !scale) return { db: null, pct: 0 };
  if (scale === 1) return { db: null, pct: clamp((value / 65535) * 100) };
  const db = value / 1000;
  // SNR quality: ~0..35 dB. Signal quality: ~ -90..-40 dBm.
  const pct =
    kind === "snr" ? clamp((db / 35) * 100) : clamp(((db + 90) / 50) * 100);
  return { db, pct };
}

/** Live tuner / input status from TVHeadend, with scale-corrected readings. */
export async function getTuner(): Promise<TunerInput[]> {
  const data = await fetchJson<{ entries?: TvhInputEntry[] }>(
    `${config.tvheadendUrl}/api/status/inputs`,
    tvheadendAuthHeader(),
  );
  return (data.entries ?? []).map((e) => {
    const snr = normalise(e.snr, e.snr_scale, "snr");
    const signal = normalise(e.signal, e.signal_scale, "signal");
    return {
      input: e.input,
      stream: e.stream,
      bps: e.bps ?? 0,
      snrDb: snr.db,
      snrPct: Math.round(snr.pct),
      signalDbm: signal.db,
      signalPct: Math.round(signal.pct),
      ber: e.ber ?? 0,
      unc: e.unc ?? 0,
      subs: e.subs ?? 0,
      weight: e.weight ?? 0,
    } satisfies TunerInput;
  });
}
