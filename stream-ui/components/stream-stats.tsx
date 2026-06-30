"use client";

import { Activity, Signal, Tv2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { usePoll } from "@/lib/use-poll";
import type { TunerInput } from "@/types";

function Bar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color =
    pct > 60 ? "bg-success" : pct > 30 ? "bg-warning" : "bg-destructive";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function fmtBps(bps: number) {
  if (bps > 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps > 1_000) return `${(bps / 1_000).toFixed(0)} kbps`;
  return `${bps} bps`;
}

export function StreamStats() {
  const { data, error, loading } = usePoll<{ inputs: TunerInput[] }>(
    "/api/tuner",
    5_000,
  );
  const inputs = data?.inputs ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 border-b p-4">
        <Activity className="h-4 w-4 text-primary" />
        <CardTitle className="text-sm">Tuner / Stream Stats</CardTitle>
        <span className="ml-auto text-xs text-muted-foreground">live · 5s</span>
      </CardHeader>
      <CardContent className="p-0">
        {error && inputs.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-muted-foreground">
            TVHeadend unreachable
          </p>
        ) : loading && inputs.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-muted-foreground">
            Connecting…
          </p>
        ) : inputs.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-muted-foreground">
            No active tuner inputs
          </p>
        ) : (
          <div className="divide-y">
            {inputs.map((inp, i) => (
              <div key={i} className="space-y-2 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Tv2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">{inp.stream || inp.input}</span>
                  <span className="ml-auto font-mono text-primary">
                    {fmtBps(inp.bps)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1">
                        <Signal className="h-3 w-3" /> SNR
                      </span>
                      <span>
                        {inp.snrDb != null
                          ? `${inp.snrDb.toFixed(1)} dB`
                          : `${inp.snrPct}%`}
                      </span>
                    </div>
                    <Bar value={inp.snrPct} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Signal</span>
                      <span>
                        {inp.signalDbm != null
                          ? `${inp.signalDbm.toFixed(1)} dBm`
                          : `${inp.signalPct}%`}
                      </span>
                    </div>
                    <Bar value={inp.signalPct} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
