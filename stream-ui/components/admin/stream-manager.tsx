"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Antenna,
  ArrowLeft,
  Globe,
  ListVideo,
  LogOut,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import {
  StreamPlayerDialog,
  type PlayerTarget,
} from "@/components/stream-player-dialog";
import { StreamStatusBadge } from "@/components/admin/stream-status-badge";
import type { InternetStream, StreamType } from "@/types";

interface FormState {
  id: number | null;
  name: string;
  number: string;
  sourceUrl: string;
  logoUrl: string;
  type: StreamType;
  quality: string;
  regions: string;
  enabled: boolean;
}

const EMPTY: FormState = {
  id: null,
  name: "",
  number: "",
  sourceUrl: "",
  logoUrl: "",
  type: "hls",
  quality: "",
  regions: "NZ",
  enabled: true,
};

function fmtChecked(iso: string | null) {
  if (!iso) return "never";
  const d = new Date(iso.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function StreamManager({
  initialStreams,
}: {
  initialStreams: InternetStream[];
}) {
  const router = useRouter();
  const [streams, setStreams] = useState(initialStreams);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);
  const [player, setPlayer] = useState<PlayerTarget | null>(null);

  async function refresh() {
    const res = await fetch("/api/streams", { cache: "no-store" });
    if (res.ok) setStreams((await res.json()).streams);
  }

  function startEdit(s: InternetStream) {
    setError("");
    setForm({
      id: s.id,
      name: s.name,
      number: String(s.number || ""),
      sourceUrl: s.sourceUrl,
      logoUrl: s.logoUrl ?? "",
      type: s.type,
      quality: s.quality,
      regions: s.regions.join(", "),
      enabled: s.enabled,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        number: Number(form.number || 0),
        sourceUrl: form.sourceUrl,
        logoUrl: form.logoUrl || null,
        type: form.type,
        quality: form.quality,
        regions: form.regions.split(",").map((r) => r.trim()).filter(Boolean),
        enabled: form.enabled,
      };
      const res = await fetch(
        form.id ? `/api/streams/${form.id}` : "/api/streams",
        {
          method: form.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Save failed");
        return;
      }
      setForm(EMPTY);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this stream?")) return;
    await fetch(`/api/streams/${id}`, { method: "DELETE" });
    await refresh();
  }

  async function toggleEnabled(s: InternetStream) {
    await fetch(`/api/streams/${s.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: s.name,
        number: s.number,
        sourceUrl: s.sourceUrl,
        logoUrl: s.logoUrl,
        type: s.type,
        enabled: !s.enabled,
      }),
    });
    await refresh();
  }

  async function checkOne(id: number) {
    await fetch(`/api/streams/check?id=${id}`, { method: "POST" });
    await refresh();
  }

  async function checkAll() {
    setCheckingAll(true);
    try {
      await fetch("/api/streams/check", { method: "POST" });
      await refresh();
    } finally {
      setCheckingAll(false);
    }
  }

  async function prune(kind: "geo" | "failed") {
    const msg =
      kind === "geo"
        ? "Validate all streams and permanently delete any that are geo-blocked from NZ?"
        : "Validate all streams and permanently delete every one that fails (geo-blocked or dead)?";
    if (!confirm(msg)) return;
    setCheckingAll(true);
    try {
      const res = await fetch(`/api/streams/check?prune=${kind}`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({ removed: [] }));
      await refresh();
      alert(`Removed ${data.removed?.length ?? 0} stream(s).`);
    } finally {
      setCheckingAll(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
      <header className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Antenna className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Internet Streams
          </h1>
          <p className="text-xs text-muted-foreground">
            Add and validate online streams merged into the headend lineup
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a
            href="/api/playlist.m3u8"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm hover:bg-accent"
          >
            <ListVideo className="h-4 w-4" /> Playlist
          </a>
          <a
            href="/"
            className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </a>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      {/* Add / edit form */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={save} className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              {form.id ? (
                <>
                  <Pencil className="h-4 w-4 text-primary" /> Edit stream
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 text-primary" /> Add internet stream
                </>
              )}
            </div>
            {error && (
              <p className="rounded-md border border-destructive/20 bg-destructive/10 p-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Sky Open"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="number">Channel number</Label>
                <Input
                  id="number"
                  type="number"
                  min={0}
                  value={form.number}
                  onChange={(e) => setForm({ ...form, number: e.target.value })}
                  placeholder="12"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sourceUrl">Source URL</Label>
              <Input
                id="sourceUrl"
                value={form.sourceUrl}
                onChange={(e) =>
                  setForm({ ...form, sourceUrl: e.target.value })
                }
                placeholder="https://i.mjh.nz/.r/sky-hgtv.m3u8"
                required
              />
              <p className="text-xs text-muted-foreground">
                A wrapper URL is fine — validation follows redirects and records
                the resolved origin.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="logoUrl">Logo URL (optional)</Label>
                <Input
                  id="logoUrl"
                  value={form.logoUrl}
                  onChange={(e) =>
                    setForm({ ...form, logoUrl: e.target.value })
                  }
                  placeholder="https://…/logo.png"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  title="Stream type"
                  value={form.type}
                  onChange={(e) =>
                    setForm({ ...form, type: e.target.value as StreamType })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="hls">HLS (.m3u8)</option>
                  <option value="ts">MPEG-TS</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="quality">Quality (auto-detected)</Label>
                <Input
                  id="quality"
                  value={form.quality}
                  onChange={(e) =>
                    setForm({ ...form, quality: e.target.value })
                  }
                  placeholder="1080p"
                />
                <p className="text-xs text-muted-foreground">
                  Measured from the highest variant on validation; override if needed.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="regions">Accepted regions (ISO)</Label>
                <Input
                  id="regions"
                  value={form.regions}
                  onChange={(e) =>
                    setForm({ ...form, regions: e.target.value })
                  }
                  placeholder="NZ"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated ISO country codes, e.g. <code>NZ, AU</code>.
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) =>
                  setForm({ ...form, enabled: e.target.checked })
                }
                className="h-4 w-4 accent-[hsl(var(--primary))]"
              />
              Enabled (included in lineup &amp; playlist)
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : form.id ? "Save changes" : "Add stream"}
              </Button>
              {form.id && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setForm(EMPTY)}
                >
                  <X className="h-4 w-4" /> Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Stream list */}
      <Card>
        <div className="flex items-center gap-2 border-b p-4">
          <h2 className="text-sm font-semibold">
            Streams{" "}
            <span className="font-mono text-muted-foreground">
              ({streams.length})
            </span>
          </h2>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={checkAll}
            disabled={checkingAll || streams.length === 0}
          >
            <RefreshCw
              className={`h-4 w-4 ${checkingAll ? "animate-spin" : ""}`}
            />
            {checkingAll ? "Checking…" : "Re-check all"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => prune("geo")}
            disabled={checkingAll || streams.length === 0}
            title="Validate, then delete anything geo-blocked from NZ"
          >
            <Globe className="h-4 w-4" /> Remove geo-blocked
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => prune("failed")}
            disabled={checkingAll || streams.length === 0}
            title="Validate, then delete every stream that fails (geo-blocked or dead)"
          >
            <Trash2 className="h-4 w-4" /> Remove failed
          </Button>
        </div>
        <CardContent className="p-0">
          {streams.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No internet streams yet. Add one above.
            </p>
          ) : (
            <div className="divide-y">
              {streams.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {s.number || "—"}
                      </span>
                      <span className="truncate font-medium">{s.name}</span>
                      {s.quality && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                          {s.quality}
                        </span>
                      )}
                      <StreamStatusBadge status={s.status} />
                      {s.geoBlocked && <Badge variant="warning">Geo-blocked</Badge>}
                      {s.regions.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Globe className="h-3 w-3" />
                          {s.regions.join(", ")}
                        </span>
                      )}
                      {!s.enabled && (
                        <span className="text-xs text-muted-foreground">
                          (disabled)
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                      {s.sourceUrl}
                    </p>
                    {s.resolvedUrl && s.resolvedUrl !== s.sourceUrl && (
                      <p className="truncate font-mono text-xs text-muted-foreground/70">
                        → {s.resolvedUrl}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Checked {fmtChecked(s.lastChecked)}
                      {s.lastLatencyMs != null && ` · ${s.lastLatencyMs} ms`}
                      {s.lastError && (
                        <span className="text-destructive">
                          {" "}
                          · {s.lastError}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setPlayer({
                          name: s.name,
                          url: s.resolvedUrl ?? s.sourceUrl,
                        })
                      }
                      title="Play stream"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <CopyButton value={s.resolvedUrl ?? s.sourceUrl} />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => checkOne(s.id)}
                      title="Validate now"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleEnabled(s)}
                    >
                      {s.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(s)}
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(s.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <StreamPlayerDialog stream={player} onClose={() => setPlayer(null)} />
    </div>
  );
}
