export interface Container {
  id: number
  name: string
  ip: string
  service: string
  port: number
}

export interface ServiceStatus {
  container: Container
  online: boolean
  latencyMs?: number
}

export interface Channel {
  number: number
  name: string
  slug: string
  mux: string
  hlsAvailable: boolean
  hlsUrl: string
}

export interface TunerInput {
  input: string
  stream: string
  snr: number
  signal: number
  bps: number
  ber: number
  unc: number
  weight: number
}

export interface TunerStatus {
  inputs: TunerInput[]
}

export interface StreamSegmentStatus {
  channel: string
  segmentCount: number
  lastModified?: string
  healthy: boolean
}
