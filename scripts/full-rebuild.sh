#!/usr/bin/env bash
# Full rebuild from an empty ("vierge") database:
#   1. Drop + recreate the `openings` database
#   2. Apply server/schema.sql
#   3. Load the FIDE rating list into `player`
#   4. Ingest Lumbra's Gigabase OTB (all year buckets, ~1.6 GB compressed)
#   5. Ensure partial player-filter indexes exist
#   6. Rebuild move_stats
#
# Logs append to data/full-rebuild.log. Exit 0 only if every step succeeds.
# Self-removes its one-shot scheduler entry on success (cron on Unix,
# Task Scheduler on Windows).
#
# Configuration: connection params via env or a local `.env`:
#   PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE  (libpq)
#   DATABASE_URL                                     (node scripts via pg)
# Defaults: localhost:5432, user=postgres, db=openings.

set -euo pipefail
cd "$(dirname "$0")/.."

LOG="data/full-rebuild.log"
mkdir -p data
exec >> "$LOG" 2>&1

echo
echo "================================================================"
echo " full rebuild from vierge db · start: $(date)"
echo "================================================================"

# OS-specific PATH additions so cron / Task Scheduler / detached shells
# can still find psql, 7z, etc.
case "$(uname -s)" in
  Darwin*)
    export PATH="/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/bin:$PATH"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    export PATH="/c/Program Files/PostgreSQL/16/bin:/c/Program Files/7-Zip:$PATH"
    ;;
esac

# Allow .env to provide credentials without committing them.
if [ -f .env ]; then set -a; . ./.env; set +a; fi

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=openings}"
export PGHOST PGPORT PGUSER PGDATABASE
[ -n "${PGPASSWORD:-}" ] && export PGPASSWORD

# DATABASE_URL drives the node scripts (pg client). Derive it from PG* if
# the caller didn't set it.
if [ -z "${DATABASE_URL:-}" ]; then
  if [ -n "${PGPASSWORD:-}" ]; then
    export DATABASE_URL="postgres://$PGUSER:$PGPASSWORD@$PGHOST:$PGPORT/$PGDATABASE"
  else
    export DATABASE_URL="postgres://$PGUSER@$PGHOST:$PGPORT/$PGDATABASE"
  fi
fi

echo
echo "[1/6] drop + recreate $PGDATABASE database"
dropdb --if-exists "$PGDATABASE"
createdb "$PGDATABASE"

echo
echo "[2/6] apply schema"
psql "$PGDATABASE" -v ON_ERROR_STOP=1 -f server/schema.sql

echo
echo "[3/6] load FIDE player roster"
npx tsx scripts/load-fide.ts

echo
echo "[4/6] Lumbra OTB ingest (all year buckets, skipping stats refresh until step 6)"
npx tsx scripts/lumbra-ingest.ts --no-stats

echo
echo "[5/6] ensure partial player-filter indexes exist"
psql "$PGDATABASE" <<'SQL'
CREATE INDEX IF NOT EXISTS idx_gm_parent_white_fide
  ON game_move(parent_fen, white_fide_id) WHERE white_fide_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gm_parent_black_fide
  ON game_move(parent_fen, black_fide_id) WHERE black_fide_id IS NOT NULL;
SQL

echo
echo "[6/6] rebuild move_stats"
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
    # Use // to keep MSYS from mangling the schtasks flags.
    schtasks //Delete //TN "OpeningTree-fullrebuild-oneshot" //F >/dev/null 2>&1 \
      && echo "scheduled task removed." \
      || echo "scheduled task not present (skipped)."
    ;;
esac
