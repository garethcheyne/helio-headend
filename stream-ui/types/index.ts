export type ChannelSource = "dvb" | "internet";

export interface Channel {
  number: number;
  name: string;
  /** Stable id: TVHeadend uuid for DVB, `internet-<id>` for internet streams. */
  uuid: string;
  enabled: boolean;
  source: ChannelSource;
  hlsAvailable: boolean;
  /** Per-channel HLS URL (absolute), present when a live HLS variant exists. */
  hlsUrl: string | null;
  /** Resolution label, e.g. "1080p" (internet streams). */
  quality?: string;
  /** Validation status for internet streams (null for DVB). */
  status?: StreamStatus | null;
  /** ISO 3166-1 alpha-2 codes of accepted regions (internet streams). */
  regions?: string[];
  /** Whether validation found the stream geo-restricted from our location. */
  geoBlocked?: boolean;
}

export type StreamStatus = "unknown" | "ok" | "error";
export type StreamType = "hls" | "ts" | "other";

export interface InternetStream {
  id: number;
  name: string;
  number: number;
  sourceUrl: string;
  logoUrl: string | null;
  type: StreamType;
  enabled: boolean;
  /** Resolution label, e.g. "1080p" — measured from the highest variant or declared on import. */
  quality: string;
  /** ISO 3166-1 alpha-2 codes of the regions where this stream is licensed/available. */
  regions: string[];
  /** Set by validation when the stream appears geo-restricted from our location. */
  geoBlocked: boolean;
  status: StreamStatus;
  /** Origin URL after following redirects (e.g. the real fullscreen.nz manifest). */
  resolvedUrl: string | null;
  lastError: string | null;
  lastLatencyMs: number | null;
  lastChecked: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Fields accepted when creating/updating a stream. */
export interface StreamInput {
  name: string;
  number: number;
  sourceUrl: string;
  logoUrl?: string | null;
  type?: StreamType;
  enabled?: boolean;
  quality?: string;
  regions?: string[];
}

export interface TunerInput {
  input: string;
  stream: string;
  bps: number;
  /** Signal-to-noise ratio in dB (null when the tuner reports a relative scale). */
  snrDb: number | null;
  /** SNR as a 0–100 quality value for the meter. */
  snrPct: number;
  /** Signal strength in dBm (null when the tuner reports a relative scale). */
  signalDbm: number | null;
  /** Signal strength as a 0–100 quality value for the meter. */
  signalPct: number;
  ber: number;
  unc: number;
  subs: number;
  weight: number;
}

export interface ServiceHealth {
  id: string;
  name: string;
  url: string;
  online: boolean;
  latencyMs: number | null;
}
