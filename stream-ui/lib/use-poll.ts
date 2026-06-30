"use client";

import { useEffect, useRef, useState } from "react";

interface PollState<T> {
  data: T | null;
  error: boolean;
  loading: boolean;
}

/**
 * Fetch a same-origin JSON endpoint immediately and then on an interval.
 * Used by the dashboard panels to poll /api/channels, /api/tuner, /api/health.
 */
export function usePoll<T>(url: string, intervalMs: number): PollState<T> {
  const [state, setState] = useState<PollState<T>>({
    data: null,
    error: false,
    loading: true,
  });
  // Keep latest interval without re-subscribing the effect.
  const intervalRef = useRef(intervalMs);
  intervalRef.current = intervalMs;

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        const json = (await res.json()) as T;
        if (cancelled) return;
        setState({ data: json, error: !res.ok, loading: false });
      } catch {
        if (cancelled) return;
        setState((prev) => ({ ...prev, error: true, loading: false }));
      }
    };

    tick();
    const id = setInterval(tick, intervalRef.current);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [url]);

  return state;
}
