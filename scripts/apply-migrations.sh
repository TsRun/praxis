#!/usr/bin/env bash
# Apply pending SQL migrations from server/migrations/*.sql, tracking applied
# files in schema_migrations.
#
# Two targets, chosen by environment:
#   * DATABASE_URL set -> apply to that Postgres directly via `psql <url>`.
#     This is how CI keeps the Railway database in sync (see migrate.yml).
#   * DATABASE_URL unset -> apply to the local Dockerized openings DB via
#     `docker exec`, waiting on the container healthcheck first (local dev).
#
# Idempotent: re-running skips already-applied filenames. Each migration
# runs inside a single transaction (-1) and aborts on the first error
# (-v ON_ERROR_STOP=1), so partial applies don't leave the table half-
# updated. Use ALPHA-ordered filenames (e.g. 0001-add-foo.sql) so order is
# deterministic.

set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "${DATABASE_URL:-}" ]; then
  # Remote target (Railway). psql reads the password from the URL; the
  # connection string is the single source of truth, so no docker/healthcheck.
  echo "applying migrations to remote DATABASE_URL"
  PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1)
else
  CONTAINER="${CONTAINER:-openings-db}"
  PG_USER="${PGUSER:-openings}"
  PG_DB="${PGDATABASE:-openings}"

  # Wait for the container's healthcheck. The CI runner may invoke this
  # right after Docker Desktop wakes from idle, so allow up to a minute.
  echo "waiting for $CONTAINER healthcheck…"
  for i in $(seq 1 30); do
    status=$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo "missing")
    if [ "$status" = "healthy" ]; then
      echo "  $CONTAINER healthy after ${i}s"
      break
    fi
    sleep 2
  done
  if [ "$status" != "healthy" ]; then
    echo "$CONTAINER never became healthy (status=$status)" >&2
    exit 1
  fi

  PSQL=(docker exec -i "$CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1)
fi

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
