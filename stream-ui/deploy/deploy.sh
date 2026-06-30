#!/usr/bin/env bash
# Build + (re)start stream-ui on the .122 container.
# Run ON the container (or over ssh) as a user with sudo for systemctl.
#
#   sudo ./deploy.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/helio/stream-ui}"
ENV_FILE="${ENV_FILE:-/etc/helio/stream-ui.env}"
SERVICE="helio-stream-ui"

echo "==> Deploying stream-ui from $APP_DIR"
cd "$APP_DIR"

# Pull latest (if this is a git checkout). Otherwise rsync the source here first.
if [ -d .git ]; then
    git pull --ff-only
fi

# NEXT_PUBLIC_* must be present during the build — source the env file.
if [ ! -f "$ENV_FILE" ]; then
    echo "!! Missing $ENV_FILE (copy from .env.production.example)"; exit 1
fi
set -a; # shellcheck disable=SC1090
source "$ENV_FILE"; set +a

echo "==> npm ci"
npm ci

echo "==> next build"
npm run build

echo "==> restart $SERVICE"
sudo systemctl restart "$SERVICE"
sleep 2
sudo systemctl --no-pager --lines=15 status "$SERVICE" || true

echo "==> done. Health: curl -s localhost:3000/ -o /dev/null -w '%{http_code}\\n'"
