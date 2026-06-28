import { useEffect, useState } from 'react'
import { Wifi, WifiOff, Server } from 'lucide-react'
import { pingService } from '@/lib/api'
import type { Container, ServiceStatus as IServiceStatus } from '@/types'

const CONTAINERS: Container[] = [
  { id: 101, name: 'TVHeadend',  ip: '192.168.0.120', service: 'tvheadend', port: 9981 },
  { id: 102, name: 'Packager',   ip: '192.168.0.121', service: 'packager',   port: 80   },
  { id: 103, name: 'Nginx',      ip: '192.168.0.122', service: 'nginx',      port: 8080 },
]

export function ServiceStatus() {
  const [statuses, setStatuses] = useState<IServiceStatus[]>([])

  const poll = async () => {
    const results = await Promise.all(
      CONTAINERS.map(async (c) => {
        const { online, latencyMs } = await pingService(c.ip, c.port)
        return { container: c, online, latencyMs }
      })
    )
    setStatuses(results)
  }

  useEffect(() => {
    poll()
    const id = setInterval(poll, 15_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="grid grid-cols-3 gap-4">
      {CONTAINERS.map((c) => {
        const s = statuses.find((x) => x.container.id === c.id)
        const online = s?.online
        return (
          <div key={c.id} className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Server className="h-4 w-4 text-muted-foreground" />
                CT {c.id} — {c.name}
              </div>
              {online === undefined ? (
                <span className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" />
              ) : online ? (
                <Wifi className="h-4 w-4 text-green-400" />
              ) : (
                <WifiOff className="h-4 w-4 text-destructive" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">{c.ip}:{c.port}</p>
            {s && (
              <p className="text-xs">
                <span className={online ? 'text-green-400' : 'text-destructive'}>
                  {online ? 'Online' : 'Offline'}
                </span>
                {online && s.latencyMs ? (
                  <span className="text-muted-foreground"> · {s.latencyMs}ms</span>
                ) : null}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
