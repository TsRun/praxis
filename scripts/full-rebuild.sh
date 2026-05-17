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
# Self-removes its one-shot cron entry on success.

set -euo pipefail
cd "$(dirname "$0")/.."

LOG="data/full-rebuild.log"
mkdir -p data
exec >> "$LOG" 2>&1

echo
echo "================================================================"
echo " full rebuild from vierge db · start: $(date)"
echo "================================================================"

export PATH=/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/bin:$PATH

echo
echo "[1/6] drop + recreate openings database"
dropdb --if-exists openings
createdb openings

echo
echo "[2/6] apply schema"
psql openings -v ON_ERROR_STOP=1 -f server/schema.sql

echo
echo "[3/6] load FIDE player roster"
npx tsx scripts/load-fide.ts

echo
echo "[4/6] Lumbra OTB ingest (all year buckets, skipping stats refresh until step 6)"
npx tsx scripts/lumbra-ingest.ts --no-stats

echo
echo "[5/6] ensure partial player-filter indexes exist"
psql openings <<'SQL'
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

# Self-remove the one-shot cron entry so this never fires again.
( crontab -l 2>/dev/null | grep -v "OpeningTree-fullrebuild-oneshot" ) | crontab -
echo "cron entry removed."
