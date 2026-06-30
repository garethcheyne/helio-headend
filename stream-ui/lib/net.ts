/**
 * Is this URL an internal/LAN resource? Used to hide internal IPs and service
 * links from the public dashboard (only admins see them).
 */
export function isInternalUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  if (hostname === "localhost") return true;
  // Private / loopback / link-local IPv4 ranges.
  if (/^127\./.test(hostname)) return true;
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  if (/^169\.254\./.test(hostname)) return true;
  return false;
}
