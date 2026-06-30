"use client";

import * as React from "react";
import { ExternalLink, Play, TriangleAlert } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { CopyButton } from "@/components/copy-button";

export interface PlayerTarget {
  name: string;
  url: string;
}

export function StreamPlayerDialog({
  stream,
  onClose,
}: {
  stream: PlayerTarget | null;
  onClose: () => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    setError(null);
    setPaused(false);
    const video = videoRef.current;
    const url = stream?.url;
    if (!video || !url) return;

    let hls: { destroy: () => void } | null = null;
    let cancelled = false;
    const isHls = /\.m3u8(\?|$)/i.test(url);

    async function attach() {
      if (!video) return;
      if (!isHls || video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url!;
        video.play().catch(() => setPaused(true));
        return;
      }
      const { default: Hls } = await import("hls.js");
      if (cancelled || !video) return;
      if (Hls.isSupported()) {
        const instance = new Hls({ enableWorker: true });
        instance.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) {
            const detail = [data.type, data.details].filter(Boolean).join(" / ");
            setError(`Playback error: ${detail}. Try opening the raw URL below in VLC or another player.`);
          }
        });
        instance.loadSource(url!);
        instance.attachMedia(video);
        video.play().catch(() => setPaused(true));
        hls = instance;
      } else {
        setError("hls.js is not supported in this browser.");
      }
    }

    attach();
    return () => {
      cancelled = true;
      hls?.destroy();
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [stream]);

  return (
    <Dialog open={stream !== null} onClose={onClose} title={stream?.name} className="max-w-3xl">
      <div className="space-y-3 p-4">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            controls
            playsInline
            className="h-full w-full"
          />
          {paused && !error && (
            <button
              type="button"
              onClick={() => { videoRef.current?.play(); setPaused(false); }}
              className="absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity hover:bg-black/50"
              aria-label="Play"
            >
              <Play className="h-14 w-14 text-white drop-shadow" />
            </button>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-foreground">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {stream && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
              {stream.url}
            </span>
            <CopyButton value={stream.url} />
            <a
              href={stream.url}
              target="_blank"
              rel="noreferrer"
              title="Open raw stream URL"
              aria-label="Open raw stream URL"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </div>
    </Dialog>
  );
}
