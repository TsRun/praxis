#!/usr/bin/env bash
# Overnight data pipeline — download-first / truncate-after for safety.
#
# 1. Download all Lumbra OTB buckets to data/lumbra/ (idempotent; aborts the
#    whole pipeline if any bucket can't be obtained after retries).
# 2. Back up the current DB to data/pre-lumbra-backup.sql.gz.
# 3. TRUNCATE game / game_move / move_stats (player table kept).
# 4. Drop partial player-filter indexes (faster ingest).
# 5. Lumbra ingest from local zips (--skip-download); full-game depth.
# 6. Recreate partial indexes.
# 7. Rebuild move_stats.
# 8. Self-remove the cron entry (if any).

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
echo "[1/7] pre-download all Lumbra OTB buckets (no DB changes)"
npx tsx scripts/lumbra-ingest.ts --download-only

echo
echo "[2/7] backup current DB"
pg_dump openings | gzip > data/pre-lumbra-backup.sql.gz
echo "  $(du -h data/pre-lumbra-backup.sql.gz | awk '{print $1}') saved"

echo
echo "[3/7] truncate game, game_move, move_stats"
psql openings -c "TRUNCATE game_move, game, move_stats RESTART IDENTITY CASCADE;"

echo
echo "[4/7] drop partial indexes"
psql openings <<'SQL'
DROP INDEX IF EXISTS idx_gm_parent_white_fide;
DROP INDEX IF EXISTS idx_gm_parent_black_fide;
SQL

echo
echo "[5/7] Lumbra OTB ingest (full game depth, using cached zips)"
npx tsx scripts/lumbra-ingest.ts --skip-download --no-stats

echo
echo "[6/7] recreate partial indexes"
psql openings <<'SQL'
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
echo " overnight pipeline · done : $(date)"
echo "================================================================"

# Self-remove the one-shot cron entry so this never fires again.
( crontab -l 2>/dev/null | grep -v "OpeningTree-overnight-oneshot" ) | crontab -
echo "cron entry removed (if any)."
