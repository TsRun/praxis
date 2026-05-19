#!/usr/bin/env bash
# Apply pending SQL migrations from server/migrations/*.sql to the local
# Dockerized openings DB. Tracks applied files in schema_migrations.
#
# Idempotent: re-running skips already-applied filenames. Each migration
# runs inside a single transaction (-1) and aborts on the first error
# (-v ON_ERROR_STOP=1), so partial applies don't leave the table half-
# updated. Use ALPHA-ordered filenames (e.g. 0001-add-foo.sql) so order is
# deterministic.

set -euo pipefail
cd "$(dirname "$0")/.."

CONTAINER="${CONTAINER:-openings-db}"
PG_USER="${PGUSER:-openings}"
PG_DB="${PGDATABASE:-openings}"

PSQL=(docker exec -i "$CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1)

"${PSQL[@]}" <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename    TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

shopt -s nullglob
migrations=(server/migrations/*.sql)
if [ ${#migrations[@]} -eq 0 ]; then
  echo "no migrations in server/migrations/"
  exit 0
fi

for f in "${migrations[@]}"; do
  name=$(basename "$f")
  applied=$("${PSQL[@]}" -tA -c "SELECT 1 FROM schema_migrations WHERE filename = '$name';")
  if [ "$applied" = "1" ]; then
    echo "skip $name (already applied)"
    continue
  fi
  echo "applying $name"
  "${PSQL[@]}" -1 < "$f"
  "${PSQL[@]}" -c "INSERT INTO schema_migrations(filename) VALUES ('$name');"
done
echo "migrations done."
