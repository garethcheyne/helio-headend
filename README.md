# Helio Headend

A Proxmox LXC-based TV headend server using TVHeadend, serving NZ Freeview DVB-T channels via HLS, IPTV, Plex (HDHomeRun emulation), and HTSP.

---

## Architecture

```
[AVerMedia A835B USB Tuner] → [Proxmox Host] → [LXC Container 103]
                                                       │
                                    ┌──────────────────┼──────────────────┐
                                    │                  │                  │
                               TVHeadend:9981     nginx:8080         nginx:8080
                               TVHeadend:9982     HLS streams       M3U8 playlist
                                    │
                          ┌─────────┼──────────┐
                          │         │          │
                       Plex      LG TV      IPTV apps
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
| CPU Cores | 4 (minimum — needed for concurrent HLS segmentation) |
| RAM | 2048 MB |
| Disk | 8 GB (local-lvm) |
| TV Tuner | AVerMedia A835B (DVB-T) |
| Active Mux | 578 MHz |

---

## Step 1 — Create the LXC Container

In Proxmox UI or via CLI:

```bash
pct create 103 local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst \
  --hostname tvheadend \
  --cores 4 \
  --memory 2048 \
  --swap 512 \
  --rootfs local-lvm:8 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --features nesting=1 \
  --ostype debian
```

---

## Step 2 — DVB Passthrough

Verify the USB tuner is recognised on the Proxmox host:

```bash
lsusb | grep -i aver
# Bus 004 Device 005: ID 07ca:1835 AVerMedia Technologies, Inc. A835B

dmesg | grep -i averme
# found a 'Avermedia A835B(1835)' in warm state

ls /dev/dvb/adapter0/
# demux0  dvr0  frontend0  net0
```

Edit `/etc/pve/lxc/103.conf` and add these two lines:

```
lxc.cgroup2.devices.allow: c 212:* rwm
lxc.mount.entry: /dev/dvb dev/dvb none bind,optional,create=dir
```

This passes DVB character devices (major 212) into the container.  
See [config/lxc/103.conf](config/lxc/103.conf) for the full container config.

Start the container:

```bash
pct start 103
```

Verify DVB devices are visible inside:

```bash
pct exec 103 -- ls /dev/dvb/adapter0/
# demux0  dvr0  frontend0  net0
```

---

## Step 3 — Install TVHeadend

```bash
pct exec 103 -- bash -c "
  apt update && apt upgrade -y
  apt install -y curl
  curl -1sLf 'https://dl.cloudsmith.io/public/tvheadend/tvheadend/setup.deb.sh' | bash
  apt update
  DEBIAN_FRONTEND=noninteractive apt install -y tvheadend
"
```

---

## Step 4 — Configure TVHeadend Service

Edit `/etc/default/tvheadend` inside the container:

```bash
pct exec 103 -- bash -c "
  sed -i 's/OPTIONS=\"-u hts -g video\"/OPTIONS=\"-u hts -g video --noacl\"/' /etc/default/tvheadend
  systemctl restart tvheadend
"
```

> `--noacl` disables access control. This is safe for a LAN-only setup. Do not expose ports 9981 or 8080 to the internet. HTTP digest authentication in TVHeadend 4.3 has known issues in LXC environments — `--noacl` is the recommended workaround for home use.

Set the superuser credentials (admin/admin):

```bash
pct exec 103 -- bash -c "
  systemctl stop tvheadend
  cat > /var/lib/tvheadend/superuser << 'EOF'
{
\"username\": \"admin\",
\"password2\": \"YWRtaW4=\"
}
EOF
  systemctl start tvheadend
"
```

> `password2` is base64-encoded. `YWRtaW4=` = `admin`.

---

## Step 5 — Enable HDHomeRun Emulation (for Plex)

```bash
pct exec 103 -- bash -c "
  systemctl stop tvheadend
  python3 -c \"
import json
with open('/var/lib/tvheadend/config') as f:
    c = json.load(f)
c['hdhomerun_server_enable'] = True
c['hdhomerun_server_tuner_count'] = 1
with open('/var/lib/tvheadend/config', 'w') as f:
    json.dump(c, f, indent='\t')
print('HDHomeRun enabled')
\"
  systemctl start tvheadend
"
```

Verify:
```bash
curl -s http://192.168.0.115:9981/discover.json
# Should return: {"FriendlyName":"Tvheadend","ModelNumber":"HDTC-2US",...}
```

---

## Step 6 — Scan for Channels

Install DVB tools for signal testing:

```bash
pct exec 103 -- apt install -y dvb-tools dtv-scan-tables w-scan
```

Test signal on the known mux (578 MHz) — TVHeadend must be stopped first:

```bash
pct exec 103 -- bash -c "
  systemctl stop tvheadend
  cat > /tmp/578mhz.conf << 'EOF'
[578MHz]
  DELIVERY_SYSTEM = DVBT
  FREQUENCY = 578000000
  BANDWIDTH_HZ = 8000000
  CODE_RATE_HP = 3/4
  MODULATION = QAM/64
  TRANSMISSION_MODE = 8K
  GUARD_INTERVAL = 1/16
  HIERARCHY = NONE
  INVERSION = AUTO
EOF
  dvbv5-scan -a 0 /tmp/578mhz.conf
  systemctl start tvheadend
"
# Should find: TVNZ 1, TVNZ 2, TVNZ DUKE, TVNZ 1+1, TVNZ 2+1, TVNZ DUKE+1
```

Trigger a full network scan via the TVHeadend API:

```bash
# Get the network UUID
NETWORK_UUID=$(curl -s "http://192.168.0.115:9981/api/mpegts/network/grid" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d['entries'][0]['uuid'])")

# Trigger scan
curl -s "http://192.168.0.115:9981/api/mpegts/network/scan" --data "uuid=$NETWORK_UUID"

# Wait and check results
sleep 60
curl -s "http://192.168.0.115:9981/api/mpegts/mux/grid?limit=20" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for m in d['entries']:
    result={0:'none',1:'OK',2:'FAIL',3:'PARTIAL'}.get(m.get('scan_result',0),'?')
    print(f\"{m['name']:>10}  result={result:<8} svcs={m['num_svc']}\")
"
```

---

## Step 7 — Assign NZ Freeview Channel Numbers

```bash
python3 << 'EOF'
import json, urllib.request, urllib.parse

numbering = {
    "TVNZ 1": 1, "TVNZ 2": 2, "Three": 3, "Whakaata Maori": 4,
    "TVNZ DUKE": 5, "Sky Open": 6, "Bravo": 7, "eden": 8,
    "Rush": 9, "Al Jazeera": 10, "Shine TV": 11, "HGTV": 12,
    "Hope Channel": 13, "Firstlight": 14, "C33": 15, "CH200": 16,
    "TVNZ 1 +1": 20, "ThreePlus1": 21, "TVNZ 2 +1": 22,
    "TVNZ DUKE+1": 23, "Bravo PLUS 1": 24, "Parliament": 30,
    "Trackside 1": 40, "Trackside 2": 41,
    "Radio NZ National": 50, "Radio NZ Concert": 51, "Radio Aotearoa": 52,
}

# Get channel list
resp = urllib.request.urlopen("http://192.168.0.115:9981/api/channel/grid?limit=100")
channels = {c['name']: c['uuid'] for c in json.load(resp)['entries']}

for name, num in sorted(numbering.items(), key=lambda x: x[1]):
    uuid = channels.get(name)
    if not uuid:
        print(f"  SKIP {name} (not found)")
        continue
    data = urllib.parse.urlencode({'node': json.dumps({"uuid": uuid, "number": num})}).encode()
    urllib.request.urlopen(
        urllib.request.Request("http://192.168.0.115:9981/api/idnode/save", data=data)
    )
    print(f"  Ch {num:>3}: {name}")
EOF
```

---

## Step 8 — Install nginx and ffmpeg for HLS

```bash
pct exec 103 -- apt install -y nginx ffmpeg
```

Configure nginx:

```bash
pct exec 103 -- bash -c "
  mkdir -p /var/www/html/hls
  cp /path/to/config/nginx/hls.conf /etc/nginx/sites-available/hls
  ln -sf /etc/nginx/sites-available/hls /etc/nginx/sites-enabled/hls
  nginx -t && systemctl reload nginx
"
```

See [config/nginx/hls.conf](config/nginx/hls.conf).

---

## Step 9 — Set Up HLS Streaming Services

Copy the systemd template:

```bash
pct exec 103 -- bash -c "
  cp /path/to/config/systemd/tvh-hls@.service /etc/systemd/system/
  systemctl daemon-reload
"
```

Create channel config files in `/etc/tvh-hls/`:

```bash
pct exec 103 -- bash -c "mkdir -p /etc/tvh-hls"
```

See [config/tvh-hls/](config/tvh-hls/) for all channel `.conf` files.

Enable and start the active 578 MHz channels:

```bash
for slug in tvnz1 tvnz2 tvnzduke tvnz1plus1 tvnz2plus1 tvnzdukeplus1; do
  pct exec 103 -- bash -c "
    mkdir -p /var/www/html/hls/${slug}
    systemctl enable --now tvh-hls@${slug}
  "
done
```

Copy the master playlist:

```bash
pct exec 103 -- cp /path/to/config/tvheadend/channels.m3u8 /var/www/html/hls/channels.m3u8
```

---

## NZ Freeview Channel Map

| Ch | Name | Mux | HLS |
|----|------|-----|-----|
| 1 | TVNZ 1 | 578 MHz | ✅ |
| 2 | TVNZ 2 | 578 MHz | ✅ |
| 3 | Three | 562 MHz | ❌ (different mux) |
| 4 | Whakaata Maori | — | ❌ |
| 5 | TVNZ DUKE | 578 MHz | ✅ |
| 6 | Sky Open | — | ❌ |
| 7 | Bravo | — | ❌ |
| 8 | eden | — | ❌ |
| 9 | Rush | — | ❌ |
| 10 | Al Jazeera | — | ❌ |
| 11 | Shine TV | — | ❌ |
| 12 | HGTV | — | ❌ |
| 13 | Hope Channel | — | ❌ |
| 14 | Firstlight | — | ❌ |
| 15 | C33 | — | ❌ |
| 16 | CH200 | — | ❌ |
| 20 | TVNZ 1 +1 | 578 MHz | ✅ |
| 21 | ThreePlus1 | 562 MHz | ❌ (different mux) |
| 22 | TVNZ 2 +1 | 578 MHz | ✅ |
| 23 | TVNZ DUKE+1 | 578 MHz | ✅ |
| 24 | Bravo PLUS 1 | — | ❌ |
| 30 | Parliament | — | ❌ |
| 40 | Trackside 1 | — | ❌ |
| 41 | Trackside 2 | — | ❌ |
| 50 | Radio NZ National | — | ❌ |
| 51 | Radio NZ Concert | — | ❌ |
| 52 | Radio Aotearoa | — | ❌ |

> To add more muxes, add a second USB tuner and repeat Step 2 for `/dev/dvb/adapter1`.

---

## Stream URLs

### HLS (m3u8) — LG Hospitality TV, VLC, compatible players

| Channel | URL |
|---------|-----|
| **Master playlist** | `http://192.168.0.115:8080/hls/channels.m3u8` |
| TVNZ 1 | `http://192.168.0.115:8080/hls/tvnz1/index.m3u8` |
| TVNZ 2 | `http://192.168.0.115:8080/hls/tvnz2/index.m3u8` |
| TVNZ DUKE | `http://192.168.0.115:8080/hls/tvnzduke/index.m3u8` |
| TVNZ 1 +1 | `http://192.168.0.115:8080/hls/tvnz1plus1/index.m3u8` |
| TVNZ 2 +1 | `http://192.168.0.115:8080/hls/tvnz2plus1/index.m3u8` |
| TVNZ DUKE+1 | `http://192.168.0.115:8080/hls/tvnzdukeplus1/index.m3u8` |

> Streams are H.264 1080p25 / AAC passthrough — no transcoding. Raw Freeview broadcast.

### IPTV (M3U) — SS IPTV, Smart IPTV, LG Live Channels

```
http://192.168.0.115:9981/playlist/channels
```

### EPG / XMLTV — Plex, Jellyfin, IPTV apps

```
http://192.168.0.115:9981/xmltv/channels
```

### Plex / HDHomeRun

Plex auto-discovers TVHeadend on the LAN. To add manually:
- **Device address:** `192.168.0.115:9981`
- **Discovery JSON:** `http://192.168.0.115:9981/discover.json`
- **Lineup JSON:** `http://192.168.0.115:9981/lineup.json`

### HTSP — Kodi, Jellyfin

```
192.168.0.115:9982
```

### TVHeadend Web UI

```
http://192.168.0.115:9981
```

---

## Health Check

```bash
# Check all HLS services
for s in tvnz1 tvnz2 tvnzduke tvnz1plus1 tvnz2plus1 tvnzdukeplus1; do
  status=$(pct exec 103 -- systemctl is-active tvh-hls@$s)
  segs=$(pct exec 103 -- bash -c "ls /var/www/html/hls/$s/*.ts 2>/dev/null | wc -l")
  echo "$s: $status ($segs segments)"
done

# Check load
pct exec 103 -- cat /proc/loadavg

# Check tuner is locked
curl -s http://192.168.0.115:9981/api/status/inputs | python3 -c "
import sys,json
d=json.load(sys.stdin)
for i in d['entries']:
    print(i['input'], '| bps:', i['bps'], '| snr:', i['snr'])
"
```

---

## Known Issues

| Issue | Detail |
|-------|--------|
| Single tuner limitation | AVerMedia A835B can only tune one mux at a time. 578 MHz channels stream simultaneously; mixing with other muxes (e.g. Three on 562 MHz) requires a second tuner. |
| Access control | TVHeadend 4.3 HTTP digest/basic auth does not work correctly in this LXC environment. `--noacl` is used. Do not expose to internet. |
| CPU requirement | HLS segmentation of 6 streams needs ≥4 vCPU. With 2 vCPU the system overloads. |
| LG TV 2013 profile | Use `webtv-h264-aac-mpegts` profile for older LG TVs that don't handle raw MPEG-TS. For HLS the `pass` profile works since the broadcast is already H.264. |
