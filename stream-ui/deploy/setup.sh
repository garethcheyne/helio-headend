#!/usr/bin/env bash
# One-time provisioning for stream-ui on the .122 container (Debian 12 LXC).
# Installs Node 24, nginx, certbot; creates the service user, dirs, env file and
# the systemd unit. Idempotent — safe to re-run. Does NOT build/start (use
# deploy.sh) and does NOT obtain a TLS cert (needs your domain).
#
#   sudo ./deploy/setup.sh
#
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Run as root: sudo $0"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE=/etc/helio/stream-ui.env
DATA_DIR=/var/lib/helio/stream-ui

echo "==> stream-ui setup (app dir: $APP_DIR)"

# 1) Base packages -----------------------------------------------------------
echo "==> Installing base packages"
apt-get update
apt-get install -y ca-certificates curl gnupg openssl

# 2) Node 24 (required for node:sqlite) --------------------------------------
need_node=1
if command -v node >/dev/null 2>&1; then
    major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
    [ "$major" -ge 24 ] && need_node=0
fi
if [ "$need_node" -eq 1 ]; then
    echo "==> Installing Node 24 (NodeSource)"
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
    apt-get install -y nodejs
else
    echo "==> Node $(node -v) already present"
fi

# 3) nginx + certbot ---------------------------------------------------------
echo "==> Installing nginx + certbot"
apt-get install -y nginx certbot python3-certbot-nginx

# 4) Service user + directories ----------------------------------------------
echo "==> Creating helio user + directories"
id -u helio >/dev/null 2>&1 || \
    useradd --system --home /opt/helio --shell /usr/sbin/nologin helio
mkdir -p /opt/helio "$DATA_DIR" /etc/helio /var/www/certbot
chown -R helio:helio /opt/helio "$DATA_DIR"
chown -R helio:helio "$APP_DIR" 2>/dev/null || true

# 5) Env file (seed once, generate the random secrets) -----------------------
if [ ! -f "$ENV_FILE" ]; then
    echo "==> Seeding $ENV_FILE"
    install -o helio -g helio -m 600 "$APP_DIR/.env.production.example" "$ENV_FILE"
    secret="$(openssl rand -base64 48)"
    token="$(openssl rand -hex 24)"
    sed -i "s|__generated_secret__|$secret|; s|__generated_token__|$token|" "$ENV_FILE"
    echo "    Generated AUTH_SECRET + STREAM_CHECK_TOKEN."
    echo "    !! Still set ADMIN_PASSWORD and PUBLIC_HLS_URL (your domain) in $ENV_FILE"
else
    echo "==> $ENV_FILE already exists — leaving as-is"
fi

# 6) systemd unit (point it at the actual app dir) ---------------------------
echo "==> Installing systemd unit"
sed "s|/opt/helio/stream-ui|$APP_DIR|g" \
    "$SCRIPT_DIR/helio-stream-ui.service" > /etc/systemd/system/helio-stream-ui.service
systemctl daemon-reload
systemctl enable helio-stream-ui >/dev/null

cat <<EOF

==> Provisioning complete. Next steps:
  1. Edit config:   sudo -e $ENV_FILE
                     (set ADMIN_PASSWORD + PUBLIC_HLS_URL=https://<your-domain>)
  2. Build + start: sudo $SCRIPT_DIR/deploy.sh
  3. nginx + TLS:
       sudo cp $SCRIPT_DIR/nginx-stream-ui.conf /etc/nginx/sites-available/helio-stream-ui
       sudo -e /etc/nginx/sites-available/helio-stream-ui   # set server_name + LAN range
       sudo ln -sf /etc/nginx/sites-available/helio-stream-ui /etc/nginx/sites-enabled/
       sudo certbot --nginx -d <your-domain>
       sudo nginx -t && sudo systemctl reload nginx

  Admin (/login, /admin) is restricted to the LAN range in the nginx config.
EOF
