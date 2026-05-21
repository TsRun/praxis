#!/usr/bin/env bash
# Keep a Pinggy SSH tunnel pointing pg.<random>.pinggy-free.link:<random>
# at our local Docker postgres, and re-publish the new DATABASE_URL to the
# Railway `praxis` service whenever the URL rotates (free tier rotates
# every ~60 min). Idempotent and safe to relaunch.
#
# Requirements: openssh client, railway CLI logged in + linked to the
# Praxis project, $PGUSER / $PGPASSWORD / $PGDATABASE exported (or .env
# loaded). One ssh process at a time.
#
# Logs append to data/tunnel.log.

set -euo pipefail
cd "$(dirname "$0")/.."

LOG="data/tunnel.log"
mkdir -p data
exec >> "$LOG" 2>&1

if [ -f .env ]; then set -a; . ./.env; set +a; fi
: "${PGUSER:=openings}"
: "${PGDATABASE:=openings}"
: "${PGPASSWORD:?PGPASSWORD required (set in .env)}"
: "${RAILWAY_SERVICE:=praxis}"

echo "================ tunnel keepalive · start $(date) ================"

# RAILWAY_TOKEN (project token from Railway dashboard) is non-interactive and
# survives idle; if set, the railway CLI will use it instead of the cached
# OAuth refresh token (which expires and silently breaks DATABASE_URL pushes).
[ -n "${RAILWAY_TOKEN:-}" ] && echo "[railway] using RAILWAY_TOKEN (non-interactive)"

prev_database_url=""

while true; do
  echo
  echo "[ssh] opening pinggy tunnel ($(date))"
  # -R0 lets pinggy assign a free remote port. ServerAliveInterval keeps
  # the conn warm. -tt forces a tty so pinggy prints the URL.
  tmp=$(mktemp)
  ssh -p 443 \
      -o StrictHostKeyChecking=no \
      -o UserKnownHostsFile=/dev/null \
      -o ServerAliveInterval=30 \
      -o ExitOnForwardFailure=yes \
      -R0:127.0.0.1:5432 \
      tcp@a.pinggy.io > "$tmp" 2>&1 &
  ssh_pid=$!

  # Wait up to 20s for pinggy to print the public URL
  url=""
  for i in $(seq 1 20); do
    url=$(grep -oE "tcp://[^ ]+pinggy[^ ]+" "$tmp" | head -1 || true)
    [ -n "$url" ] && break
    sleep 1
  done

  if [ -z "$url" ]; then
    echo "[ssh] no URL after 20s — killing and retrying in 10s"
    kill "$ssh_pid" 2>/dev/null || true
    wait "$ssh_pid" 2>/dev/null || true
    rm -f "$tmp"
    sleep 10
    continue
  fi

  host=$(echo "$url" | sed -E 's@tcp://([^:]+):.*@\1@')
  port=$(echo "$url" | sed -E 's@.*:([0-9]+).*@\1@')
  database_url="postgresql://$PGUSER:$PGPASSWORD@$host:$port/$PGDATABASE"
  echo "[ssh] tunnel up: $host:$port"

  if [ "$database_url" = "$prev_database_url" ]; then
    echo "[railway] URL unchanged — skipping publish (no redeploy)"
  else
    echo "[railway] publishing DATABASE_URL to $RAILWAY_SERVICE"
    if railway variables --service "$RAILWAY_SERVICE" --set "DATABASE_URL=$database_url" >/dev/null 2>&1; then
      echo "[railway] ok"
      prev_database_url="$database_url"
    else
      echo "[railway] FAILED — re-login (railway login) or set RAILWAY_TOKEN in .env"
    fi
  fi

  echo "[ssh] waiting on tunnel (pid $ssh_pid)…"
  wait "$ssh_pid" || true
  echo "[ssh] tunnel exited at $(date); reconnecting in 5s"
  rm -f "$tmp"
  sleep 5
done
