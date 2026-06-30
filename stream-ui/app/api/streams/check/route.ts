import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  checkAllStreams,
  checkAndPruneFailed,
  checkAndPruneGeoBlocked,
  checkStream,
} from "@/lib/stream-check";

export const dynamic = "force-dynamic";

/**
 * Trigger the validation process.
 *   POST /api/streams/check            → re-check all (admin session)
 *   POST /api/streams/check?id=3        → re-check one
 *   POST /api/streams/check?prune=geo    → re-check all, then delete geo-blocked (NZ-only)
 *   POST /api/streams/check?prune=failed → re-check all, then delete every failed stream
 *   POST /api/streams/check?token=…      → allow an unauthenticated cron job
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const cronToken = process.env.STREAM_CHECK_TOKEN;
  const authorised =
    (cronToken && token && token === cronToken) || (await isAuthenticated());

  if (!authorised) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idParam = url.searchParams.get("id");
  if (idParam) {
    const stream = await checkStream(Number(idParam));
    if (!stream)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ stream });
  }

  const prune = url.searchParams.get("prune");
  if (prune === "geo") {
    const { removed, remaining } = await checkAndPruneGeoBlocked();
    return NextResponse.json({ streams: remaining, removed });
  }
  if (prune === "failed") {
    const { removed, remaining } = await checkAndPruneFailed();
    return NextResponse.json({ streams: remaining, removed });
  }

  const streams = await checkAllStreams();
  return NextResponse.json({ streams });
}
