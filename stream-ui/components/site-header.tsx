import { Antenna, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { config } from "@/lib/config";

// Internal service links — only shown to signed-in admins (they expose LAN IPs).
const internalLinks = [
  { label: "Combined Playlist", href: "/api/playlist.m3u8" },
  { label: "IPTV M3U", href: `${config.tvheadendUrl}/playlist/channels` },
  { label: "XMLTV EPG", href: `${config.tvheadendUrl}/xmltv/channels` },
  { label: "TVHeadend UI", href: config.tvheadendUrl },
];

export function SiteHeader({ isAdmin }: { isAdmin: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-6">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
          <Antenna className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">
            Helio Headend
          </span>
          <span className="text-xs text-muted-foreground">
            NZ Freeview + Internet TV
          </span>
        </div>

        {isAdmin && (
          <nav className="ml-auto hidden items-center gap-4 text-xs text-muted-foreground md:flex">
            {internalLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </nav>
        )}

        <div className={`flex items-center gap-1 ${isAdmin ? "md:ml-2" : "ml-auto"}`}>
          <a href={isAdmin ? "/admin" : "/login"} title={isAdmin ? "Manage internet streams" : "Admin sign in"}>
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" /> {isAdmin ? "Admin" : "Sign in"}
            </Button>
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
