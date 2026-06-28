# Helio Headend

A Proxmox LXC-based TV headend server using TVHeadend, serving NZ Freeview DVB-T channels via IPTV, HLS, HDHomeRun emulation (Plex), and HTSP.

---

## Architecture

```
[AVerMedia A835B USB Tuner] → [Proxmox Host] → [LXC Container 103]
                                                      │
                                   ┌──────────────────┼──────────────────┐
                                   │                  │                  │
                              TVHeadend           nginx:8080         nginx:8080
                              :9981/:9982         HLS streams        M3U8 playlist
                                   │
                         ┌─────────┼─────────┐
                         │         │         │
                      Plex      LG TV     IPTV apps
                   (HDHomeRun)  (HLS)    (M3U playlist)
```

---

## Container Details

| Property | Value |
|----------|-------|
| Container ID | 103 |
| Hostname | tvheadend |
| IP Address | 192.168.0.115 |
| OS | Debian 12 (Bookworm) |
| CPU Cores | 4 |
| RAM | 2048 MB |
| Disk | 8 GB (local-lvm) |
| TV Tuner | AVerMedia A835B (DVB-T, 578MHz locked) |

---

## Installation

### 1. Create the LXC Container

In Proxmox, create a Debian 12 LXC container with:
- **ID:** 103
- **Hostname:** tvheadend
- **CPU:** 4 cores (minimum — required for concurrent HLS segmentation)
- **RAM:** 2048 MB
- **Disk:** 8 GB
- **Network:** DHCP on vmbr0

### 2. Configure USB DVB Passthrough

Edit `/etc/pve/lxc/103.conf` and add:

```
lxc.cgroup2.devices.allow: c 212:* rwm
lxc.mount.entry: /dev/dvb dev/dvb none bind,optional,create=dir
```

This passes `/dev/dvb/adapter0` (DVB character devices, major 212) into the container.

Verify the tuner is detected on the host:
```bash
dmesg | grep -i averme
# Should show: found a 'Avermedia A835B(1835)' in warm state
ls /dev/dvb/adapter0/
# demux0  dvr0  frontend0  net0
```

### 3. Install TVHeadend

Inside the container:

```bash
apt update && apt upgrade -y
apt install -y curl

# Add TVHeadend repository
curl -1sLf 'https://dl.cloudsmith.io/public/tvheadend/tvheadend/setup.deb.sh' | bash

apt update
apt install -y tvheadend
```

### 4. Configure TVHeadend Access

TVHeadend runs with `--noacl` (no access control) since this is a LAN-only setup. The container is not exposed to the internet.

Edit `/etc/default/tvheadend`:
```
OPTIONS="-u hts -g video --noacl"
```

Restart:
```bash
systemctl restart tvheadend
```

### 5. Configure DVB-T Network & Scan

After TVHeadend starts, trigger a scan via the API:
```bash
# Get network UUID
curl -s "http://192.168.0.115:9981/api/mpegts/network/grid"

# Trigger scan (replace UUID with your network UUID)
curl -s "http://192.168.0.115:9981/api/mpegts/network/scan" \
  --data "uuid=<network-uuid>"
```

Or use the web UI at `http://192.168.0.115:9981` → Configuration → DVB Inputs → Networks → Force Scan.

**Known working mux:** 578 MHz (TVNZ 1, 2, DUKE and +1 variants — all on same mux)

### 6. Install nginx and ffmpeg (HLS)

```bash
apt install -y nginx ffmpeg
```

See [config/nginx/hls.conf](config/nginx/hls.conf) for nginx configuration.

---

## NZ Freeview Channel Map

| Ch | Name | Mux |
|----|------|-----|
| 1 | TVNZ 1 | 578 MHz |
| 2 | TVNZ 2 | 578 MHz |
| 3 | Three | 562 MHz |
| 4 | Whakaata Maori | — |
| 5 | TVNZ DUKE | 578 MHz |
| 6 | Sky Open | — |
| 7 | Bravo | — |
| 8 | eden | — |
| 9 | Rush | — |
| 10 | Al Jazeera | — |
| 11 | Shine TV | — |
| 12 | HGTV | — |
| 13 | Hope Channel | — |
| 14 | Firstlight | — |
| 15 | C33 | — |
| 16 | CH200 | — |
| 20 | TVNZ 1 +1 | 578 MHz |
| 21 | ThreePlus1 | 562 MHz |
| 22 | TVNZ 2 +1 | 578 MHz |
| 23 | TVNZ DUKE+1 | 578 MHz |
| 24 | Bravo PLUS 1 | — |
| 30 | Parliament | — |
| 40 | Trackside 1 | — |
| 41 | Trackside 2 | — |
| 50 | Radio NZ National | — |
| 51 | Radio NZ Concert | — |
| 52 | Radio Aotearoa | — |

> **Note:** Only channels on the same mux can be streamed simultaneously with a single tuner. HLS streaming is configured for 578 MHz channels only (TVNZ 1, 2, DUKE, +1 variants).

---

## Stream URLs

### HLS (m3u8) — for LG Hospitality TV and compatible players

| Channel | URL |
|---------|-----|
| Master playlist | `http://192.168.0.115:8080/hls/channels.m3u8` |
| TVNZ 1 | `http://192.168.0.115:8080/hls/tvnz1/index.m3u8` |
| TVNZ 2 | `http://192.168.0.115:8080/hls/tvnz2/index.m3u8` |
| TVNZ DUKE | `http://192.168.0.115:8080/hls/tvnzduke/index.m3u8` |
| TVNZ 1 +1 | `http://192.168.0.115:8080/hls/tvnz1plus1/index.m3u8` |
| TVNZ 2 +1 | `http://192.168.0.115:8080/hls/tvnz2plus1/index.m3u8` |
| TVNZ DUKE+1 | `http://192.168.0.115:8080/hls/tvnzdukeplus1/index.m3u8` |

> HLS segments are H.264/AAC passthrough (no transcoding) at 1080p25.

### IPTV (M3U) — for SS IPTV, Smart IPTV, LG Live Channels

```
http://192.168.0.115:9981/playlist/channels
```

### EPG / XMLTV — for Plex, Jellyfin, IPTV apps

```
http://192.168.0.115:9981/xmltv/channels
```

### Plex / HDHomeRun

TVHeadend emulates an HDHomeRun device. Plex auto-discovers it, or add manually:
- **Device address:** `192.168.0.115:9981`
- **Lineup:** `http://192.168.0.115:9981/lineup.json`
- **Discovery:** `http://192.168.0.115:9981/discover.json`

### HTSP — for Kodi, Jellyfin

```
192.168.0.115:9982
```

---

## Known Issues & Notes

- **Single tuner limitation:** The AVerMedia A835B is a single-tuner device. Only one DVB-T mux (frequency) can be received at a time. All 578 MHz channels can stream simultaneously; mixing with channels from other muxes (e.g. Three on 562 MHz) is not supported without a second tuner.
- **Access control:** TVHeadend runs with `--noacl`. Do not expose port 9981 or 8080 to the internet. HTTP digest authentication in this version of TVHeadend (4.3-2715) has known issues with the LXC environment — LAN-only `--noacl` is the recommended workaround.
- **CPU:** HLS segmentation of 6 simultaneous streams requires at least 4 vCPUs. With 2 vCPUs the system becomes overloaded.
- **Three / other muxes:** Three (562 MHz) cannot be HLS-streamed simultaneously with TVNZ channels (578 MHz). It is available via the TVHeadend IPTV playlist when TVNZ channels are not being tuned.
