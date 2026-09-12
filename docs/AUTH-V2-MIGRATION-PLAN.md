# Login/Auth V2 migration plan

This rollout is intentionally additive. The committed SQL is
`migrations/migration_v11_auth_v2.sql`. Do not apply it to production until the branch,
staging Worker and staging D1 have been approved.

## 1. Preflight and backup

1. Export/backup the production D1 database.
2. Confirm migration v10 and all earlier repository migrations are already applied.
3. Check for case-insensitive legacy Player ID collisions:

   ```sql
   SELECT LOWER(id) AS normalized_id, COUNT(*) AS account_count,
          GROUP_CONCAT(id) AS player_ids
   FROM players
   GROUP BY LOWER(id)
   HAVING COUNT(*) > 1;
   ```

4. Stop if that query returns rows. Resolve the colliding account identities with an
   account-owner-reviewed plan before applying v11; do not rename or combine accounts
   automatically.

## 2. Staging application

1. Restore a recent production backup into a staging D1 database.
2. Apply `migration_v11_auth_v2.sql` once to staging.
3. Deploy `workers/thornie-dungeons-api.js` to a staging Worker bound to that staging D1.
4. Deploy the built frontend from this same commit to a test-only environment and point it at
   the staging Worker.
5. Run the Login/Auth V2 behavior matrix, legacy login migration, character/inventory/run-state
   comparisons, session replacement and Save Reliability failure/recovery tests.

## 3. Production rollout after separate approval

Use a maintenance window because the old frontend/Worker credential contract and the V2 token
contract are not mixed-mode compatible.

1. Take a fresh D1 backup and record the Worker/frontend release revisions.
2. Run the collision preflight again.
3. Apply `migrations/migration_v11_auth_v2.sql` to production D1.
4. Deploy `workers/thornie-dungeons-api.js` from the approved commit.
5. Deploy the generated frontend from that same commit immediately after the Worker.
6. Smoke-test register, legacy login, remembered login, character enter/save, inventory, run
   state, Daily Login, Mailbox, Craft, Raid and Arena.
7. Monitor `server_error`, auth lifecycle errors and save failures. Never log raw passwords,
   recovery codes or session tokens.

## 4. Rollback

Roll back the Worker and frontend together to their recorded revisions. The additive columns and
tables may remain unused; do not drop them during incident response. If data restoration is
required, use the pre-rollout D1 backup under the existing recovery procedure. The legacy
`players.password` column remains intact for this rollout, and accounts with a populated
`password_hash` must never fall back to it while the V2 Worker is active.
