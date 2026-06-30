/**
 * Central service configuration, read from environment variables so the
 * container IPs can change without code edits (see .env.local.example).
 *
 * Three-host topology:
 *   TVHeadend  192.168.0.120:9981   (channel grid, tuner status, HTSP :9982)
 *   Packager   192.168.0.121        (HLS segmenter)
 *   nginx HLS  192.168.0.122:8080   (master playlist + per-channel index.m3u8)
 */

export interface HealthHost {
  id: string;
  name: string;
  url: string;
}

const stripTrailingSlash = (s: string) => s.replace(/\/+$/, "");

export const config = {
  tvheadendUrl: stripTrailingSlash(
    process.env.TVHEADEND_URL ?? "http://192.168.0.120:9981",
  ),
  packagerUrl: stripTrailingSlash(
    process.env.PACKAGER_URL ?? "http://192.168.0.121",
  ),
  hlsUrl: stripTrailingSlash(process.env.HLS_URL ?? "http://192.168.0.122:8080"),
  // Public-facing HLS origin used when exposing DVB-T stream URLs to anonymous
  // visitors, so the internal LAN IP is never published. Empty → fall back to hlsUrl.
  publicHlsUrl: stripTrailingSlash(process.env.PUBLIC_HLS_URL ?? ""),
  tvheadendUser: process.env.TVHEADEND_USER ?? "",
  tvheadendPass: process.env.TVHEADEND_PASS ?? "",
};

/**
 * Rewrite an internal HLS URL onto the public HLS origin (PUBLIC_HLS_URL, else
 * HLS_URL) keeping its path — the address we publish for DVB-T streams.
 */
export function toPublicHlsUrl(internalUrl: string | null): string | null {
  if (!internalUrl) return internalUrl;
  const base = config.publicHlsUrl || config.hlsUrl;
  try {
    return `${base}${new URL(internalUrl).pathname}`;
  } catch {
    return internalUrl;
  }
}

/** Optional HTTP Basic auth header for TVHeadend (empty when running --noacl). */
export function tvheadendAuthHeader(): Record<string, string> {
  if (!config.tvheadendUser) return {};
  const token = Buffer.from(
    `${config.tvheadendUser}:${config.tvheadendPass}`,
  ).toString("base64");
  return { Authorization: `Basic ${token}` };
}

const DEFAULT_HEALTH_HOSTS = [
  `101|TVHeadend|${config.tvheadendUrl}`,
  `102|Packager|${config.packagerUrl}`,
  `103|nginx HLS|${config.hlsUrl}`,
].join(",");

/** Parse the `id|name|url,...` HEALTH_HOSTS env list into structured hosts. */
export function healthHosts(): HealthHost[] {
  const raw = process.env.HEALTH_HOSTS ?? DEFAULT_HEALTH_HOSTS;
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [id, name, url] = entry.split("|").map((p) => p.trim());
      return { id, name, url: stripTrailingSlash(url ?? "") };
    })
    .filter((h) => h.id && h.name && h.url);
}
