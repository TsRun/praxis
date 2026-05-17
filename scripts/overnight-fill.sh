#!/usr/bin/env bash
# Overnight data pipeline:
#   1. Backfill denorm columns on game_move (id-range, no partial indexes)
#   2. Re-create the partial indexes on game_move
#   3. Ingest TWIC 920..1614 (any new issues since last run + finish the
#      partial range from earlier)
#   4. Rebuild move_stats
#
# Logs to data/overnight.log. Exit code 0 only if every step succeeded.

set -euo pipefail
cd "$(dirname "$0")/.."

LOG="data/overnight.log"
mkdir -p data
exec >> "$LOG" 2>&1

echo
echo "================================================================"
echo " overnight pipeline · start: $(date)"
echo "================================================================"

export PATH=/opt/homebrew/opt/postgresql@16/bin:$PATH

echo
echo "[1/4] backfill denorm columns"
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
echo "[3/4] TWIC ingest 920..1614 (fingerprint dedupe makes this safe to re-run)"
npm run ingest -- --twic --from 920 --to 1614 --concurrency 8 --no-stats

echo
echo "[4/4] rebuild move_stats"
npm run rebuild-stats

echo
echo "================================================================"
echo " overnight pipeline · done : $(date)"
echo "================================================================"
