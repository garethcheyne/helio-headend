#!/usr/bin/env bash
# Build + (re)start stream-ui. Auto-detects its own location, so it works from
# any clone path. Run as root (or a sudo-capable user) — needs systemctl.
#
#   sudo ./deploy/deploy.sh        (run setup.sh once first)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(dirname "$SCRIPT_DIR")}"
ENV_FILE="${ENV_FILE:-/etc/helio/stream-ui.env}"
SERVICE="helio-stream-ui"
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"

echo "==> Deploying stream-ui from $APP_DIR"
cd "$APP_DIR"

if [ ! -f "$ENV_FILE" ]; then
    echo "!! Missing $ENV_FILE — run '$SCRIPT_DIR/setup.sh' first."; exit 1
fi

# Pull latest if this is a git checkout.
if git -C "$APP_DIR" rev-parse --git-dir >/dev/null 2>&1; then
    git -C "$APP_DIR" pull --ff-only || echo "   (git pull skipped)"
fi

# NEXT_PUBLIC_* must be present during the build — source the env file.
set -a; # shellcheck disable=SC1090
source "$ENV_FILE"; set +a

echo "==> npm ci";    npm ci
echo "==> next build"; npm run build

# The service runs as 'helio' — make sure it owns what it serves.
if [ "$(id -u)" -eq 0 ] && id -u helio >/dev/null 2>&1; then
    chown -R helio:helio "$APP_DIR"
fi

echo "==> restart $SERVICE"
$SUDO systemctl restart "$SERVICE"
sleep 2
$SUDO systemctl --no-pager --lines=15 status "$SERVICE" || true

echo "==> done. Health check: curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/"
