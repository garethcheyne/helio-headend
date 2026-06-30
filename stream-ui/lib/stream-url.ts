/**
 * Resolve a stream URL for playback/display in the browser.
 *
 * DVB-T HLS URLs are returned by the API as host-relative paths (e.g.
 * "/hls/tvnz1/index.m3u8") so the internal LAN IP is never sent to the client.
 * Here we populate the host from `window.location` — whatever domain the user is
 * browsing (e.g. weinfoed.local) is the domain the streams are served from —
 * keeping the configured HLS port.
 *
 * Absolute URLs (external internet streams) are returned unchanged.
 */
const HLS_PORT = process.env.NEXT_PUBLIC_HLS_PORT ?? "8080";

export function resolveStreamUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  if (!url.startsWith("/")) return url; // absolute (external) — leave as-is
  if (typeof window === "undefined") return url; // SSR fallback
  const port = HLS_PORT ? `:${HLS_PORT}` : "";
  return `${window.location.protocol}//${window.location.hostname}${port}${url}`;
}
