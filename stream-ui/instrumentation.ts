/**
 * Optional background stream validation. When STREAM_CHECK_INTERVAL_MIN > 0 the
 * server re-validates every internet stream on that cadence, independent of any
 * dashboard traffic. Runs once per server process (Node runtime only).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const minutes = Number(process.env.STREAM_CHECK_INTERVAL_MIN ?? "0");
  if (!Number.isFinite(minutes) || minutes <= 0) return;

  const { checkAllStreams } = await import("@/lib/stream-check");
  const run = () =>
    checkAllStreams().catch((err) =>
      console.error("[stream-check] background run failed:", err),
    );

  // Kick off shortly after boot, then on the configured interval.
  setTimeout(run, 10_000);
  setInterval(run, minutes * 60_000);
}
