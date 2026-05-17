#!/usr/bin/env bash
# Overnight data pipeline:
#   1. Backfill denorm columns on game_move (id-range, partial indexes dropped)
#   2. Re-create the partial player-filter indexes
#   3. Ingest Lumbra's Gigabase OTB (all year buckets, ~1.6 GB compressed)
#      Lumbra includes TWIC, so this is our single OTB source.
#   4. Rebuild move_stats
#
# Logs append to data/overnight.log. Exit 0 only if every step succeeds.
# Self-removes its one-shot cron entry on success.

set -euo pipefail
cd "$(dirname "$0")/.."

LOG="data/overnight.log"
mkdir -p data
exec >> "$LOG" 2>&1

echo
echo "================================================================"
echo " overnight pipeline · start: $(date)"
echo "================================================================"

export PATH=/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/bin:$PATH

echo
echo "[1/4] backfill denorm columns on game_move"
npx tsx scripts/backfill-denorm.ts

echo
echo "[2/4] re-create partial player-filter indexes"
psql openings <<'SQL'
CREATE INDEX IF NOT EXISTS idx_gm_parent_white_fide
  ON game_move(parent_fen, white_fide_id) WHERE white_fide_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gm_parent_black_fide
  ON game_move(parent_fen, black_fide_id) WHERE black_fide_id IS NOT NULL;
SQL

echo
echo "[3/4] Lumbra OTB ingest (all year buckets, skipping stats refresh until step 4)"
npx tsx scripts/lumbra-ingest.ts --no-stats

echo
echo "[4/4] rebuild move_stats"
npx tsx scripts/rebuild-stats.ts

echo
echo "================================================================"
echo " overnight pipeline · done : $(date)"
echo "================================================================"

# Self-remove the one-shot cron entry so this never fires again.
( crontab -l 2>/dev/null | grep -v "OpeningTree-overnight-oneshot" ) | crontab -
echo "cron entry removed."
