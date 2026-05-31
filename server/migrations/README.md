# Migrations

Drop ordered SQL files here (e.g. `0001-add-foo.sql`, `0002-rename-bar.sql`).
On push to `main` that touches this folder, the `migrate` workflow runs on a
GitHub-hosted runner and applies anything not yet recorded in
`schema_migrations` to the **Railway** database (via the
`RAILWAY_DATABASE_URL` repo secret — its public proxy connection string).
Run order is alphabetic by filename, so use a numeric prefix.

Each migration runs in a single transaction; the first failing statement
rolls back and the entry stays pending so a fixed version can re-apply.

Make migrations idempotent (`IF NOT EXISTS` / `IF EXISTS`) so they re-apply
cleanly even if an object was created out-of-band.

Run locally against the Docker dev DB (no `DATABASE_URL`):

```bash
./scripts/apply-migrations.sh
```

Run against a remote DB (same as CI):

```bash
DATABASE_URL='postgres://…@host:port/db' ./scripts/apply-migrations.sh
```

If `RAILWAY_DATABASE_URL` ever changes (DB re-provisioned / proxy rotated),
update the repo secret:

```bash
gh secret set RAILWAY_DATABASE_URL --body "$(railway variables -s <pg-service> --json | jq -r .DATABASE_PUBLIC_URL)"
```
