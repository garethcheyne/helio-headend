import { NextResponse } from "next/server";
import { getHlsVariants } from "@/lib/tvheadend";
import { listEnabledStreams } from "@/lib/streams";
import { isAuthenticated } from "@/lib/auth";
import { toPublicHlsUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Combined master playlist: the local DVB→HLS variants plus the operator's
 * enabled internet streams. A drop-in replacement for the static
 * config/tvheadend/channels.m3u8.
 *
 * It embeds internal LAN HLS URLs, so it is not public: requires an admin
 * session, or a `?token=` matching STREAM_CHECK_TOKEN (for LAN TVs / IPTV apps).
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const cronToken = process.env.STREAM_CHECK_TOKEN;
  const authorised =
    (cronToken && token && token === cronToken) || (await isAuthenticated());
  if (!authorised) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [variants, streams] = await Promise.all([
    getHlsVariants(),
    Promise.resolve(listEnabledStreams()),
  ]);

  const lines: string[] = ["#EXTM3U"];

  for (const v of variants) {
    const chno = v.chno != null ? ` tvg-chno="${v.chno}"` : "";
    lines.push(`#EXTINF:-1${chno},${v.name}`);
    // Publish DVB-T streams on the public HLS host (PUBLIC_HLS_URL).
    lines.push(toPublicHlsUrl(v.url) ?? v.url);
  }

  for (const s of streams) {
    const chno = s.number ? ` tvg-chno="${s.number}"` : "";
    const logo = s.logoUrl ? ` tvg-logo="${s.logoUrl}"` : "";
    lines.push(`#EXTINF:-1${chno}${logo},${s.name}`);
    // Point at the source URL — players follow the wrapper → origin redirect.
    lines.push(s.resolvedUrl ?? s.sourceUrl);
  }

  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": "no-cache",
    },
  });
}
