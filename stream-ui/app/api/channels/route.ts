import { NextResponse } from "next/server";
import { getChannels } from "@/lib/tvheadend";
import { revalidateStale } from "@/lib/stream-check";

export const dynamic = "force-dynamic";

const toPath = (url: string) => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

export async function GET() {
  // Keep internet-stream validity fresh (only re-checks entries past the TTL).
  try {
    await revalidateStale();
  } catch {
    // validation upkeep is best-effort; never block the lineup on it
  }

  try {
    // DVB-T URLs are sent host-relative so the LAN IP never leaves the server;
    // the client resolves the host from window.location. External internet
    // stream URLs are public and passed through unchanged.
    const channels = (await getChannels()).map((c) =>
      c.source === "dvb" && c.hlsUrl ? { ...c, hlsUrl: toPath(c.hlsUrl) } : c,
    );
    return NextResponse.json({ channels });
  } catch {
    return NextResponse.json(
      { channels: [], error: "TVHeadend unreachable" },
      { status: 502 },
    );
  }
}
