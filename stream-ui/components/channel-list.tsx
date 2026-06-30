"use client";

import { useState } from "react";
import { Eye, EyeOff, Globe, Play, Tv } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import {
  StreamPlayerDialog,
  type PlayerTarget,
} from "@/components/stream-player-dialog";
import { usePoll } from "@/lib/use-poll";
import { resolveStreamUrl } from "@/lib/stream-url";
import { cn } from "@/lib/utils";
import type { Channel } from "@/types";

type Tab = "dvb" | "internet";

const TABS: { id: Tab; label: string; icon: typeof Tv }[] = [
  { id: "dvb", label: "Freeview NZ", icon: Tv },
  { id: "internet", label: "Public Internet Streams", icon: Globe },
];

function StatusCell({ ch }: { ch: Channel }) {
  if (ch.source === "internet") {
    if (ch.status === "ok") return <Badge variant="success">OK</Badge>;
    if (ch.status === "error") return <Badge variant="destructive">Down</Badge>;
    return <Badge variant="secondary">Unchecked</Badge>;
  }
  return ch.hlsAvailable ? (
    <Badge variant="success">Live</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      No HLS
    </Badge>
  );
}

export function ChannelList() {
  const { data, error, loading } = usePoll<{ channels: Channel[] }>(
    "/api/channels",
    30_000,
  );
  const channels = data?.channels ?? [];

  const [tab, setTab] = useState<Tab>("dvb");
  const [player, setPlayer] = useState<PlayerTarget | null>(null);
  const [showUrls, setShowUrls] = useState(false);

  const counts = {
    dvb: channels.filter((c) => c.source === "dvb").length,
    internet: channels.filter((c) => c.source === "internet").length,
  };
  const rows = channels.filter((c) => c.source === tab);

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b p-2">
        <div className="flex gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
                <span
                  className={cn(
                    "rounded px-1.5 font-mono text-xs",
                    active ? "bg-primary-foreground/20" : "bg-muted",
                  )}
                >
                  {counts[t.id]}
                </span>
              </button>
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => setShowUrls((v) => !v)}
          title={showUrls ? "Hide stream URLs" : "Show stream URLs"}
        >
          {showUrls ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showUrls ? "Hide URLs" : "Show URLs"}
        </Button>
      </div>

      <CardContent className="p-0">
        {loading && channels.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Loading lineup…
          </p>
        ) : error && channels.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            TVHeadend unreachable — check the channel grid API.
          </p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {tab === "internet"
              ? "No internet streams yet. Add some from the Admin page."
              : "No Freeview channels found. Run a TVHeadend scan."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="w-14 px-4 py-2 text-left font-medium">Ch</th>
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Quality</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="w-16 px-4 py-2 text-center font-medium">Play</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((ch) => (
                <tr
                  key={ch.uuid || ch.number}
                  className="border-b transition-colors last:border-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-2 align-top font-mono text-muted-foreground">
                    {ch.number || "—"}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2 align-top font-medium",
                      !ch.enabled && "text-muted-foreground line-through",
                    )}
                  >
                    {ch.name}
                    {showUrls && ch.hlsUrl && (
                      <div className="mt-1 flex items-center gap-1">
                        <span className="max-w-[28rem] truncate font-mono text-xs font-normal text-muted-foreground">
                          {resolveStreamUrl(ch.hlsUrl)}
                        </span>
                        <CopyButton value={resolveStreamUrl(ch.hlsUrl)!} />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 align-top font-mono text-xs text-muted-foreground">
                    {ch.quality || "—"}
                  </td>
                  <td className="px-4 py-2 align-top">
                    <StatusCell ch={ch} />
                  </td>
                  <td className="px-4 py-2 text-center align-top">
                    {ch.hlsUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPlayer({
                            name: ch.name,
                            url: resolveStreamUrl(ch.hlsUrl)!,
                          })
                        }
                        title="Play stream"
                        aria-label={`Play ${ch.name}`}
                        className="inline-flex text-primary transition-colors hover:text-primary/80"
                      >
                        <Play className="mx-auto h-4 w-4" />
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>

      <StreamPlayerDialog stream={player} onClose={() => setPlayer(null)} />
    </Card>
  );
}
