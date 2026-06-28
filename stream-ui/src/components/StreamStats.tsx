import { useEffect, useState } from "react"
import { Signal, Activity, Tv2 } from "lucide-react"
import { fetchTunerStatus } from "@/lib/api"
import type { TunerInput } from "@/types"

function Bar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100)
  const color = pct > 60 ? "bg-green-400" : pct > 30 ? "bg-yellow-400" : "bg-destructive"
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function fmt(bps: number) {
  if (bps > 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`
  if (bps > 1_000) return `${(bps / 1_000).toFixed(0)} kbps`
  return `${bps} bps`
}

export function StreamStats() {
  const [inputs, setInputs] = useState<TunerInput[]>([])
  const [error, setError] = useState(false)

  useEffect(() => {
    const poll = async () => {
      try {
        const { inputs } = await fetchTunerStatus()
        setInputs(inputs)
        setError(false)
      } catch {
        setError(true)
      }
    }
    poll()
    const id = setInterval(poll, 5_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Activity className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Tuner / Stream Stats</h2>
        <span className="ml-auto text-xs text-muted-foreground">live · 5s</span>
      </div>

      {error && (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          TVHeadend unreachable
        </p>
      )}

      {!error && inputs.length === 0 && (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          No active tuner inputs
        </p>
      )}

      <div className="divide-y">
        {inputs.map((inp, i) => (
          <div key={i} className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Tv2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">{inp.stream || inp.input}</span>
              <span className="ml-auto font-mono text-primary">{fmt(inp.bps)}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="flex items-center gap-1"><Signal className="h-3 w-3" /> SNR</span>
                  <span>{inp.snr}%</span>
                </div>
                <Bar value={inp.snr} />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Signal</span>
                  <span>{inp.signal}%</span>
                </div>
                <Bar value={inp.signal} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t px-4 py-2 flex gap-4 text-xs text-muted-foreground">
        <a href="http://192.168.0.120:9981" target="_blank" className="underline underline-offset-2">TVHeadend UI</a>
        <a href="http://192.168.0.120:9981/xmltv/channels" target="_blank" className="underline underline-offset-2">XMLTV EPG</a>
        <a href="http://192.168.0.120:9981/discover.json" target="_blank" className="underline underline-offset-2">HDHomeRun</a>
      </div>
    </div>
  )
}
