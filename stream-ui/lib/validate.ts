import type { StreamInput, StreamType } from "@/types";

const STREAM_TYPES: StreamType[] = ["hls", "ts", "other"];

/** Validate + normalise a stream payload from the admin form / API. Throws on bad input. */
export function parseStreamInput(body: unknown): StreamInput {
  if (typeof body !== "object" || body === null) {
    throw new Error("Expected a JSON object");
  }
  const b = body as Record<string, unknown>;

  const name = String(b.name ?? "").trim();
  if (!name) throw new Error("Name is required");

  const sourceUrl = String(b.sourceUrl ?? "").trim();
  if (!sourceUrl) throw new Error("Source URL is required");
  try {
    const u = new URL(sourceUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error("Source URL must be http(s)");
    }
  } catch {
    throw new Error("Source URL is not a valid URL");
  }

  const number = Number(b.number ?? 0);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error("Channel number must be a non-negative integer");
  }

  const type = STREAM_TYPES.includes(b.type as StreamType)
    ? (b.type as StreamType)
    : "hls";

  const logoUrl = b.logoUrl ? String(b.logoUrl).trim() || null : null;
  const quality = b.quality ? String(b.quality).trim() : "";

  // regions: accept an array or a comma-separated string of ISO 3166-1 alpha-2 codes.
  const rawRegions = Array.isArray(b.regions)
    ? b.regions
    : String(b.regions ?? "").split(",");
  const regions = rawRegions
    .map((r) => String(r).trim().toUpperCase())
    .filter((r) => /^[A-Z]{2}$/.test(r));

  return {
    name,
    number,
    sourceUrl,
    logoUrl,
    type,
    quality,
    regions,
    enabled: b.enabled === undefined ? true : Boolean(b.enabled),
  };
}
