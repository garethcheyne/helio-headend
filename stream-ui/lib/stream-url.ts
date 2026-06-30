/**
 * Resolve a stream URL for playback/display in the browser.
 *
 * DVB-T HLS URLs are returned by the API as host-relative paths (e.g.
 * "/hls/tvnz1/index.m3u8") so the internal LAN IP is never sent to the client.
 * Here we populate the host from `window.location` — whatever domain/port the
 * user is browsing is the origin the streams are served from.
 *
 *   NEXT_PUBLIC_HLS_PORT empty  → same origin as the dashboard (incl. its port,
 *                                 e.g. https://host:8080/hls/...). Use this when
 *                                 nginx serves the app and /hls/ on one port.
 *   NEXT_PUBLIC_HLS_PORT="8080" → force this port (dev: app on :3000, HLS :8080).
 *
 * Absolute URLs (external internet streams) are returned unchanged.
 */
const HLS_PORT = process.env.NEXT_PUBLIC_HLS_PORT ?? "";

export function resolveStreamUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  if (!url.startsWith("/")) return url; // absolute (external) — leave as-is
  if (typeof window === "undefined") return url; // SSR fallback
  // window.location.host already includes the port (e.g. "host:8080").
  const host = HLS_PORT
    ? `${window.location.hostname}:${HLS_PORT}`
    : window.location.host;
  return `${window.location.protocol}//${host}${url}`;
}
