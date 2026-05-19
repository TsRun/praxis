# Migrations

Drop ordered SQL files here (e.g. `0001-add-foo.sql`, `0002-rename-bar.sql`).
On push to `main` that touches this folder, the `migrate` workflow runs on
the self-hosted runner `praxis-db` and applies anything not yet recorded in
`schema_migrations`. Run order is alphabetic by filename, so use a numeric
prefix.

Each migration runs in a single transaction; the first failing statement
rolls back and the entry stays pending so a fixed version can re-apply.

Run locally:

```bash
./scripts/apply-migrations.sh
```
