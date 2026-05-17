#!/usr/bin/env bash
# Full rebuild from an empty ("vierge") database, using a Docker-hosted
# Postgres so the host doesn't need a local pg install.
#
#   1. docker compose down -v / up -d (volume wipe → fresh db)
#   2. wait for the container's healthcheck
#   3. apply server/schema.sql
#   4. load the FIDE rating list into `player`
#   5. ingest Lumbra's Gigabase OTB (all year buckets, ~1.6 GB compressed)
#   6. ensure partial player-filter indexes exist
#   7. rebuild move_stats
#
# Logs append to data/full-rebuild.log. Exit 0 only if every step succeeds.
# Self-removes its one-shot scheduler entry on success (cron on Unix,
# Task Scheduler on Windows).

set -euo pipefail
cd "$(dirname "$0")/.."

LOG="data/full-rebuild.log"
mkdir -p data
exec >> "$LOG" 2>&1

echo
echo "================================================================"
echo " full rebuild from vierge db · start: $(date)"
echo "================================================================"

# OS-specific PATH additions for unzipping Lumbra archives.
case "$(uname -s)" in
  Darwin*) export PATH="/opt/homebrew/bin:$PATH" ;;
  MINGW*|MSYS*|CYGWIN*) export PATH="/c/Program Files/7-Zip:$PATH" ;;
esac

if [ -f .env ]; then set -a; . ./.env; set +a; fi

# Match docker-compose.yml. Override via .env if you like.
: "${DATABASE_URL:=postgres://openings:openings@127.0.0.1:5432/openings}"
export DATABASE_URL

DC="docker compose"
CONTAINER="openings-db"

echo
echo "[1/7] docker compose down -v && up -d  (vierge volume)"
$DC down -v
$DC up -d

echo
echo "[2/7] wait for postgres healthcheck"
for i in $(seq 1 60); do
  status=$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo "starting")
  if [ "$status" = "healthy" ]; then
    echo "  postgres healthy after ${i}s"
    break
  fi
  sleep 1
done
[ "$status" = "healthy" ] || { echo "postgres never became healthy"; exit 1; }

echo
echo "[3/7] apply schema"
docker exec -i "$CONTAINER" psql -U openings -d openings -v ON_ERROR_STOP=1 < server/schema.sql

echo
echo "[4/7] load FIDE player roster"
npx tsx scripts/load-fide.ts

echo
echo "[5/7] Lumbra OTB ingest (all year buckets, --no-stats; rebuilt in step 7)"
npx tsx scripts/lumbra-ingest.ts --no-stats

echo
echo "[6/7] ensure partial player-filter indexes exist"
docker exec -i "$CONTAINER" psql -U openings -d openings <<'SQL'
CREATE INDEX IF NOT EXISTS idx_gm_parent_white_fide
  ON game_move(parent_fen, white_fide_id) WHERE white_fide_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gm_parent_black_fide
  ON game_move(parent_fen, black_fide_id) WHERE black_fide_id IS NOT NULL;
SQL

echo
echo "[7/7] rebuild move_stats"
npx tsx scripts/rebuild-stats.ts

echo
echo "================================================================"
echo " full rebuild · done : $(date)"
echo "================================================================"

# Self-remove the one-shot scheduler entry so this never fires again.
case "$(uname -s)" in
  Darwin*|Linux*)
    if command -v crontab >/dev/null 2>&1; then
      ( crontab -l 2>/dev/null | grep -v "OpeningTree-fullrebuild-oneshot" ) | crontab -
      echo "cron entry removed."
    fi
    ;;
  MINGW*|MSYS*|CYGWIN*)
    schtasks //Delete //TN "OpeningTree-fullrebuild-oneshot" //F >/dev/null 2>&1 \
      && echo "scheduled task removed." \
      || echo "scheduled task not present (skipped)."
    ;;
esac
