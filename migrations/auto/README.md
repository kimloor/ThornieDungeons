# Automated D1 migrations

This directory is the deployment lane for **new** production D1 schema migrations applied by GitHub Actions.

Do not move or replay the historical `migrations/migration_v3...v10` files here. Those migrations predate this automation and were applied manually, so replaying them can fail or damage rollout safety.

Rules:

- Add future production schema changes here as new, forward-only `.sql` files.
- Keep migration SQL additive/backward-compatible unless a destructive change is explicitly approved.
- Never edit a migration after it has been applied to production; add a follow-up migration instead.
- Backend changes that depend on a new schema must ship with the matching migration in this directory in the same merge.
- GitHub Actions applies pending migrations before deploying `thornie-dungeons-api`.

Login/Auth V2 `migration_v11_auth_v2.sql` currently lives on its feature branch under the historical migration directory. Before that feature is released, copy/finalize the approved V11 SQL into this automated lane as the release migration rather than replaying older migrations.
