import { Antenna } from "lucide-react"
import { ServiceStatus } from "@/components/ServiceStatus"
import { ChannelList } from "@/components/ChannelList"
import { StreamStats } from "@/components/StreamStats"

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-6 py-4 flex items-center gap-3">
        <Antenna className="h-5 w-5 text-primary" />
        <h1 className="text-base font-semibold tracking-tight">Helio Headend</h1>
        <span className="text-xs text-muted-foreground">NZ Freeview DVB-T → HLS</span>
        <div className="ml-auto flex gap-4 text-xs text-muted-foreground">
          <a href="http://192.168.0.122:8080/hls/channels.m3u8" target="_blank" className="underline underline-offset-2">
            Master Playlist
          </a>
          <a href="http://192.168.0.120:9981/playlist/channels" target="_blank" className="underline underline-offset-2">
            IPTV M3U
          </a>
          <a href="http://192.168.0.120:9982" target="_blank" className="underline underline-offset-2">
            HTSP :9982
          </a>
        </div>
      </header>

      <main className="px-6 py-6 space-y-6 max-w-6xl mx-auto">
        <ServiceStatus />

        <div className="grid grid-cols-[1fr_340px] gap-6">
          <ChannelList />
          <StreamStats />
        </div>
      </main>
    </div>
  )
}
