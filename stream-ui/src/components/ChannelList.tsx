import { useEffect, useState } from 'react'
import { Play, Radio } from 'lucide-react'
import { checkStreamHealth } from '@/lib/api'
import type { Channel } from '@/types'

const HLS_BASE = 'http://192.168.0.122:8080/hls'

const CHANNELS: Channel[] = [
  { number: 1,  name: 'TVNZ 1',        slug: 'tvnz1',        mux: '578 MHz', hlsAvailable: false, hlsUrl: `${HLS_BASE}/tvnz1/index.m3u8` },
  { number: 2,  name: 'TVNZ 2',        slug: 'tvnz2',        mux: '578 MHz', hlsAvailable: false, hlsUrl: `${HLS_BASE}/tvnz2/index.m3u8` },
  { number: 3,  name: 'Three',          slug: '',             mux: '562 MHz', hlsAvailable: false, hlsUrl: '' },
  { number: 4,  name: 'Whakaata Maori', slug: '',             mux: '—',       hlsAvailable: false, hlsUrl: '' },
  { number: 5,  name: 'TVNZ DUKE',     slug: 'tvnzduke',     mux: '578 MHz', hlsAvailable: false, hlsUrl: `${HLS_BASE}/tvnzduke/index.m3u8` },
  { number: 6,  name: 'Sky Open',      slug: '',             mux: '—',       hlsAvailable: false, hlsUrl: '' },
  { number: 7,  name: 'Bravo',         slug: '',             mux: '—',       hlsAvailable: false, hlsUrl: '' },
  { number: 20, name: 'TVNZ 1 +1',     slug: 'tvnz1plus1',   mux: '578 MHz', hlsAvailable: false, hlsUrl: `${HLS_BASE}/tvnz1plus1/index.m3u8` },
  { number: 22, name: 'TVNZ 2 +1',     slug: 'tvnz2plus1',   mux: '578 MHz', hlsAvailable: false, hlsUrl: `${HLS_BASE}/tvnz2plus1/index.m3u8` },
  { number: 23, name: 'TVNZ DUKE+1',   slug: 'tvnzdukeplus1', mux: '578 MHz', hlsAvailable: false, hlsUrl: `${HLS_BASE}/tvnzdukeplus1/index.m3u8` },
  { number: 50, name: 'ABC Kids',       slug: '',             mux: 'Internet', hlsAvailable: false, hlsUrl: 'https://c.mjh.nz/abc-kids.m3u8' },
]

export function ChannelList() {
  const [channels, setChannels] = useState<Channel[]>(CHANNELS)

  useEffect(() => {
    const check = async () => {
      const updated = await Promise.all(
        channels.map(async (ch) => {
          if (!ch.slug) return ch
          const { healthy } = await checkStreamHealth(ch.slug)
          return { ...ch, hlsAvailable: healthy }
        })
      )
      setChannels(updated)
    }
    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Radio className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">NZ Freeview Channels</h2>
        <span className="ml-auto text-xs text-muted-foreground">
          <a href="http://192.168.0.120:9981/playlist/channels" target="_blank" className="underline underline-offset-2">
            IPTV M3U
          </a>
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="px-4 py-2 text-left w-12">Ch</th>
            <th className="px-4 py-2 text-left">Name</th>
            <th className="px-4 py-2 text-left">Mux</th>
            <th className="px-4 py-2 text-center">HLS</th>
          </tr>
        </thead>
        <tbody>
          {channels.map((ch) => (
            <tr key={ch.number} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-2 text-muted-foreground font-mono">{ch.number}</td>
              <td className="px-4 py-2 font-medium">{ch.name}</td>
              <td className="px-4 py-2 text-xs text-muted-foreground">{ch.mux}</td>
              <td className="px-4 py-2 text-center">
                {ch.slug ? (
                  ch.hlsAvailable ? (
                    <a href={ch.hlsUrl} target="_blank" title="Open stream">
                      <Play className="h-3.5 w-3.5 text-green-400 mx-auto" />
                    </a>
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-destructive inline-block" />
                  )
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
