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
    # Discard local churn (e.g. an npm-modified lockfile) so the pull stays clean.
    git -C "$APP_DIR" checkout -- package-lock.json 2>/dev/null || true
    git -C "$APP_DIR" pull --ff-only || echo "   (git pull skipped)"
fi

# Only NEXT_PUBLIC_* vars are needed at build time. Export them WITHOUT sourcing
# the file as shell — values contain spaces / | / : that aren't shell-safe.
# (All runtime vars are loaded by systemd's EnvironmentFile, not here.)
while IFS= read -r line; do
    case "$line" in
        NEXT_PUBLIC_*=*) export "${line%%=*}=${line#*=}" ;;
    esac
done < "$ENV_FILE"

# Prefer a clean reproducible install; fall back to npm install when the lockfile
# drifts across platforms (e.g. optional native/WASM deps differ on Linux).
echo "==> installing dependencies"
if ! npm ci --no-audit --no-fund 2>/dev/null; then
    echo "   npm ci couldn't use the lockfile — falling back to npm install"
    npm install --no-audit --no-fund
fi

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
