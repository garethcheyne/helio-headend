"use client";

import { Server, Wifi, WifiOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePoll } from "@/lib/use-poll";
import type { ServiceHealth } from "@/types";

export function ServiceStatus() {
  const { data, loading } = usePoll<{ services: ServiceHealth[] }>(
    "/api/health",
    15_000,
  );
  const services = data?.services ?? [];

  if (loading && services.length === 0) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="h-[92px] animate-pulse bg-muted/40" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((s) => (
        <Card key={s.id} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Server className="h-4 w-4 text-muted-foreground" />
              <span>
                CT {s.id} — {s.name}
              </span>
            </div>
            {s.online ? (
              <Badge variant="success">
                <Wifi className="h-3 w-3" /> Online
              </Badge>
            ) : (
              <Badge variant="destructive">
                <WifiOff className="h-3 w-3" /> Offline
              </Badge>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate font-mono">
              {s.url.replace(/^https?:\/\//, "")}
            </span>
            {s.online && s.latencyMs != null && (
              <span className="shrink-0">{s.latencyMs} ms</span>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
