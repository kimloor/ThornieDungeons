# Automated D1 migrations

This directory is the deployment lane for **new** production D1 schema migrations applied by GitHub Actions.

Do not move or replay the historical `migrations/migration_v3...v10` files here. Those migrations predate this automation and were applied manually, so replaying them can fail or damage rollout safety.

Rules:

- Add future production schema changes here as new, forward-only `.sql` files.
- Keep migration SQL additive/backward-compatible unless a destructive change is explicitly approved.
- Never edit a migration after it has been applied to production; add a follow-up migration instead.
- Backend changes that depend on a new schema must ship with the matching migration in this directory in the same merge.
- GitHub Actions applies pending migrations before deploying `thornie-dungeons-api`.

Login/Auth V2 migration v11 is already applied in production and must not be replayed or recreated here.

`0012_battle_persistence_v1.sql` is the first Battle V1 migration in this lane. It copies legacy player-keyed run state into an additive `character_run_state` table with the correct character key, and adds isolated Battle checkpoints, completion receipts, and per-character Quick Slots. Apply it only after duplicate/collision preflight and before deploying the matching Worker.

`0013_pet_run_state_v1.sql` additively extends `character_run_state` with `pet_state_json`. Existing rows default to `{}`, preserving the old full-HP Pet fallback until the client writes its first Pet-aware snapshot. Apply it only after `0012_battle_persistence_v1.sql`; it does not alter legacy `run_state` or Auth v11.
