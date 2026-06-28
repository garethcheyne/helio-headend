import type { TunerStatus, StreamSegmentStatus } from '@/types'

const TVH = '/api/tvh'
const HLS_BASE = 'http://192.168.0.122:8080/hls'

export async function fetchTunerStatus(): Promise<TunerStatus> {
  const res = await fetch(`${TVH}/api/status/inputs`)
  if (!res.ok) throw new Error('TVHeadend unreachable')
  const data = await res.json()
  return { inputs: data.entries ?? [] }
}

export async function fetchChannels() {
  const res = await fetch(`${TVH}/api/channel/grid?limit=100&sort_key=number`)
  if (!res.ok) throw new Error('TVHeadend unreachable')
  const data = await res.json()
  return data.entries ?? []
}

export async function checkStreamHealth(slug: string): Promise<StreamSegmentStatus> {
  try {
    const res = await fetch(`${HLS_BASE}/${slug}/index.m3u8`, { method: 'HEAD' })
    return { channel: slug, segmentCount: 0, healthy: res.ok }
  } catch {
    return { channel: slug, segmentCount: 0, healthy: false }
  }
}

export async function pingService(ip: string, port: number): Promise<{ online: boolean; latencyMs: number }> {
  const start = performance.now()
  try {
    await fetch(`http://${ip}:${port}/`, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
    return { online: true, latencyMs: Math.round(performance.now() - start) }
  } catch {
    return { online: false, latencyMs: 0 }
  }
}
