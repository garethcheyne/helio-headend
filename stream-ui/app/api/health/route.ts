import { NextResponse } from "next/server";
import { healthHosts } from "@/lib/config";
import { isAuthenticated } from "@/lib/auth";
import type { ServiceHealth } from "@/types";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 3000;

async function ping(url: string): Promise<{ online: boolean; latencyMs: number | null }> {
  const start = performance.now();
  try {
    // A reachable host answers even with 401/404 — any HTTP response means "up".
    await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    return { online: true, latencyMs: Math.round(performance.now() - start) };
  } catch {
    try {
      // Some servers reject HEAD; fall back to a GET before declaring it down.
      await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      return { online: true, latencyMs: Math.round(performance.now() - start) };
    } catch {
      return { online: false, latencyMs: null };
    }
  }
}

export async function GET() {
  // Service health exposes internal IPs — admins only.
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hosts = healthHosts();
  const services: ServiceHealth[] = await Promise.all(
    hosts.map(async (h) => {
      const { online, latencyMs } = await ping(h.url);
      return { id: h.id, name: h.name, url: h.url, online, latencyMs };
    }),
  );
  return NextResponse.json({ services });
}
