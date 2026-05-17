#!/usr/bin/env bash
# Overnight data pipeline (fresh re-ingest from Lumbra at depth 24):
#   1. Back up the current DB to data/pre-lumbra-backup.sql.gz
#   2. TRUNCATE game / game_move / move_stats (player table kept)
#   3. Drop partial indexes (faster ingest)
#   4. Lumbra OTB ingest (depth 24) — all year buckets, ~1.6 GB compressed
#   5. Recreate partial player-filter indexes
#   6. Rebuild move_stats
#   7. Self-remove the cron entry
#
# Why a fresh re-ingest? Existing 2.35M TWIC games are capped at depth 16,
# and fingerprint dedupe would skip them on a re-run so they'd stay shallow.
# Lumbra already contains the same games (and millions more), so a fresh
# load at depth 24 gives us deeper coverage end to end.

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
echo "[1/6] backup current DB to data/pre-lumbra-backup.sql.gz"
pg_dump openings | gzip > data/pre-lumbra-backup.sql.gz
echo "  size: $(du -h data/pre-lumbra-backup.sql.gz | awk '{print $1}')"

echo
echo "[2/6] truncate game, game_move, move_stats"
psql openings -c "TRUNCATE game_move, game, move_stats RESTART IDENTITY CASCADE;"

echo
echo "[3/6] drop partial indexes (recreated in step 5)"
psql openings <<'SQL'
DROP INDEX IF EXISTS idx_gm_parent_white_fide;
DROP INDEX IF EXISTS idx_gm_parent_black_fide;
SQL

echo
echo "[4/6] Lumbra OTB ingest at depth 24 (all year buckets)"
npx tsx scripts/lumbra-ingest.ts --no-stats

echo
echo "[5/6] re-create partial player-filter indexes"
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
echo " overnight pipeline · done : $(date)"
echo "================================================================"

# Self-remove the one-shot cron entry so this never fires again.
( crontab -l 2>/dev/null | grep -v "OpeningTree-overnight-oneshot" ) | crontab -
echo "cron entry removed."
