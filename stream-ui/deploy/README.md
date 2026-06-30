# Deploying stream-ui (production)

Target: the **nginx container `192.168.0.122`**. Runs as a native Node service
behind nginx (TLS), internet-facing on your domain. The app reaches TVHeadend
(`.120`) and the packager (`.121`) server-side over the LAN.

```
Internet ──HTTPS :8080──> nginx (.122, your domain)
                      ├── /hls/  → /var/www/html/hls   (DVB-T segments, same origin)
                      └── /      → 127.0.0.1:3000       (Next.js app)
                                     └── server-side → TVHeadend .120 / Packager .121 (LAN)
```

Everything is served on a single HTTPS port (`:8080`) — no 80/443. Because of
that, TLS certs use a **DNS-01** challenge (see step 5).

## First deploy

The scripts auto-detect their own location, so you can clone the repo anywhere.
Below assumes `/opt/helio-headend` — adjust if you cloned elsewhere.

1. **Get the code** — clone the repo on the box:
   ```bash
   sudo git clone https://github.com/garethcheyne/helio-headend /opt/helio-headend
   cd /opt/helio-headend/stream-ui
   ```
2. **Provision** — installs Node 24, nginx, certbot; creates the `helio` user,
   directories, the systemd unit, and seeds `/etc/helio/stream-ui.env` with
   generated `AUTH_SECRET` + `STREAM_CHECK_TOKEN` (idempotent):
   ```bash
   sudo ./deploy/setup.sh
   ```
3. **Finish the env** — set `ADMIN_PASSWORD` and `PUBLIC_HLS_URL=https://<domain>`:
   ```bash
   sudo -e /etc/helio/stream-ui.env
   ```
4. **Build + start** (sources the env so the build picks up `NEXT_PUBLIC_*`):
   ```bash
   sudo ./deploy/deploy.sh
   curl -s localhost:3000/ -o /dev/null -w '%{http_code}\n'   # 200
   ```
5. **TLS cert (DNS-01)** — there's no port 80/443, so use a DNS challenge. Add the
   `_acme-challenge` TXT record it prints (or use a DNS plugin for auto-renew):
   ```bash
   sudo certbot certonly --manual --preferred-challenges dns -d stream.err403.com
   # (Cloudflare etc.: apt install python3-certbot-dns-cloudflare and use --dns-cloudflare)
   ```
6. **nginx (single HTTPS port 8080)** — disable the old plain-HTTP :8080 HLS
   site, install this one, set `server_name` + cert paths + LAN range:
   ```bash
   sudo rm -f /etc/nginx/sites-enabled/hls          # old plain :8080 HLS server
   sudo cp ./deploy/nginx-stream-ui.conf /etc/nginx/sites-available/helio-stream-ui
   sudo -e /etc/nginx/sites-available/helio-stream-ui   # server_name, ssl_certificate*, allow CIDR
   sudo ln -s /etc/nginx/sites-available/helio-stream-ui /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```
   Open it at `https://stream.err403.com:8080/`. Forward **8080** on the router → `.122`.

## Seed data

The curated internet streams ship in [`seed/streams.json`](../seed/streams.json)
and are **auto-imported on first run** (only when the DB is empty — existing
installs are untouched). They load with status `unknown` and are validated by the
normal process (background interval / first lineup load / **Re-check all**).

To refresh the seed from a running instance after curating the list:
```bash
curl -s http://127.0.0.1:3000/api/streams \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s).streams.map(x=>({name:x.name,number:x.number,sourceUrl:x.sourceUrl,logoUrl:x.logoUrl,type:x.type,quality:x.quality,regions:x.regions,enabled:x.enabled}));process.stdout.write(JSON.stringify(a,null,2))})' \
  > seed/streams.json
```

## First run

- Open `https://<your-domain>/` — public sees the lineup (Freeview NZ + Internet tabs),
  pre-populated from the seed.
- Click **Sign in** → `/login` (LAN only) with `ADMIN_USER` / `ADMIN_PASSWORD`.
- In **Admin**, **Re-check all** to validate the seeded streams, add more, or
  **Remove geo-blocked** / **Remove failed** to clean the list.
- LAN TVs / IPTV apps: `https://<your-domain>/api/playlist.m3u8?token=<STREAM_CHECK_TOKEN>`.

## Updates

```bash
sudo -u helio /opt/helio/stream-ui/deploy/deploy.sh     # pull, build, restart
```

## Optional: scheduled re-validation

Either set `STREAM_CHECK_INTERVAL_MIN` in the env (in-process), or a cron/systemd
timer on the box hitting the app directly (localhost bypasses the LAN allowlist):

```bash
curl -fsS -X POST "http://127.0.0.1:3000/api/streams/check?prune=geo&token=<STREAM_CHECK_TOKEN>"
```

## Verify / health

```bash
sudo systemctl status helio-stream-ui
journalctl -u helio-stream-ui -f
curl -s https://<your-domain>/api/channels | head -c 300   # DVB urls are /hls/... (host-relative)
```

## Notes / cautions (internet-facing)

- **Forward only `:8080` to `.122`.** That's the single public port. TVHeadend
  `:9981`/`:9982`, the packager, and the app's own `:3000` stay LAN-only (the app
  calls upstreams server-side). Don't forward or proxy those off the WAN.
- **Admin is LAN-only.** `/login`, `/admin`, `/api/auth`, `/api/streams`,
  `/api/health`, `/api/tuner` are restricted to the LAN range in the nginx config
  — public hits get 403. Set the correct `allow` CIDR for your network, and still
  use a strong `ADMIN_PASSWORD` (second factor for LAN users).
- **Back up** `/var/lib/helio/stream-ui/headend.db` (it holds your internet streams).
- **Licensing**: publicly re-streaming broadcast/third-party channels over the
  internet may have copyright/licensing implications — that's your call to confirm.
