# W2-F / W2-G — Actual D1 Full Handler QA: reproducible staging plan

**Status:** `D1_HANDLER_QA_BLOCKED` for Claude (no network to `api.cloudflare.com`, no Worker deploy tool, the D1 tool runs single SQL statements only). This plan lets the Project Lead or Owner run the full handler on a real D1 without touching production. It is documentation only; nothing here has been executed against a Worker.

## 0. Hard safety rules
- Use a **separate Worker name** (e.g. `thornie-dungeons-api-staging`) and a **separate D1 database** (e.g. `thornie-dungeons-staging`). Never bind the production database id (`2f6d52b4-3de7-4e78-98d4-fc143a4d29e2`) to the staging Worker.
- Test players, characters and items only. No production player data. Do not copy production rows into staging.
- Production `game_config` must not receive `admin_item_delete_enabled`; the flag is set **only** in the staging database.
- Do not run the production deploy workflow for this; deploy the staging Worker by hand from the PR #182 branch.

## 1. Worker configuration
Copy `wrangler.api.template.jsonc` to an untracked file and change only the name and database:
```jsonc
{
  "name": "thornie-dungeons-api-staging",
  "main": "workers/thornie-dungeons-api-entry.js",
  "compatibility_date": "2026-08-25",
  "d1_databases": [{ "binding": "DB", "database_name": "thornie-dungeons-staging", "database_id": "<staging id>", "migrations_dir": "migrations/auto" }]
  // no "triggers" block: staging must not run the production cron
}
```
Required binding: `DB` (the only binding the Admin handlers use). No secrets are needed for Admin login (it reuses a player account plus an `admin_users` row).

## 2. Build the staging D1
1. `wrangler d1 create thornie-dungeons-staging`
2. Apply the schema from the repo so it matches production: `wrangler d1 migrations apply thornie-dungeons-staging --remote` (uses `migrations/auto`). Cross-check that `items`, `characters`, `character_run_state`, `character_operation_receipts`, `item_provenance`, `item_ownership_events`, `admin_audit_log`, `game_config` match `tests/helpers/prod-schema.sql`.
3. Deploy the staging Worker, then register two test players through the normal register action: `QA_ADMIN` and `QA_P1` (create one character on `QA_P1`).
4. Make `QA_ADMIN` an admin (staging D1 only): `INSERT INTO admin_users (player_id, role, enabled, created_at, updated_at) VALUES ('QA_ADMIN','admin',1,datetime('now'),datetime('now'));`
5. Enable the feature (staging D1 only): `INSERT OR REPLACE INTO game_config (key, value_json, updated_at) VALUES ('admin_item_delete_enabled','true',datetime('now'));`
6. Log in: `POST {action:"adminLogin", id:"QA_ADMIN", password:"..."}` and keep `adminSessionToken` as `$TOKEN`.

## 3. Seed (replace `<CID>` with the QA_P1 character id)
```sql
INSERT INTO items (item_id,player_id,character_id,slot_type,name,rarity,enhance_level,atk,extra_json,created_at,updated_at) VALUES
 ('qa-gear-1','QA_P1','<CID>','weapon','QA Sword','mythic',7,120,'{"empowerSlots":[null,"fire"],"overflow":false}','2026-10-01T00:00:00Z','2026-10-01T00:00:00Z'),
 ('qa-gear-eq','QA_P1','<CID>','armor','QA Worn','rare',1,0,'{}','2026-10-01T00:00:00Z','2026-10-01T00:00:00Z'),
 ('qa-junk-1','QA_P1','<CID>','junk','QA Scrap','common',0,0,'{"junkId":"scrap","quantity":7,"overflow":false}','2026-10-01T00:00:00Z','2026-10-01T00:00:00Z');
UPDATE items SET equipped=1 WHERE item_id='qa-gear-eq';
INSERT INTO item_provenance (item_id,original_player_id,original_character_id,origin_type,created_at,acquired_at) VALUES ('qa-gear-1','QA_P1','<CID>','drop','t','t');
```
Calls (all `Authorization: Bearer $TOKEN`):
- Preview delete: `GET ?action=adminPreviewItemDelete&playerId=QA_P1&characterId=<CID>&itemId=qa-gear-1`
- Delete: `POST {action:"adminDeleteItem", playerId, characterId, itemId, quantity, reason, confirmText:<itemId>, snapshotHash:<from preview>, requestId:"qa-req-0001"}`
- Preview/restore: `GET ?action=adminPreviewItemRestore&auditId=adm-del-<requestId>` and `POST {action:"adminRestoreItem", auditId, reason, confirmText:<original item id>}`

## 4. Scenarios and expected results
Evidence for each: the HTTP status/body plus the SQL snapshot below.

| # | Scenario | Expected |
|---|---|---|
| 1 | Delete `qa-gear-1` | 200 `deleted:true`; item gone; 1 `ADMIN_ITEM_DELETE` audit row; 1 `admin_deleted` event |
| 2 | Restore it | 200; row back with identical `enhance_level/atk/rarity/extra_json` (+`overflow` flag); audit `ADMIN_ITEM_RESTORE`; event `admin_restored` |
| 3 | Restore again (replay) | 200 `already_applied`; no second row/audit/event |
| 4 | Delete `qa-junk-1` quantity 3, restore | after delete quantity 4; after restore quantity 7; replay does not add again |
| 5 | Delete equipped `qa-gear-eq` | 409 `item_equipped`; nothing written |
| 6 | Pending operation: `INSERT INTO character_operation_receipts VALUES ('<CID>','sell','qa1','qa-tok','{}','pending',datetime('now'))`, then delete and restore | 409 `operation_pending` for both; nothing written; remove the row afterwards |
| 7 | Active run: `INSERT INTO character_run_state (character_id, updated_at) VALUES ('<CID>', strftime('%Y-%m-%dT%H:%M:%fZ','now'))`, then delete and restore | 409 `character_in_run` for both; nothing written |
| 8 | Stale run: set that `updated_at` to `2026-09-29T14:55:14.765Z` | delete and restore succeed |
| 9 | Unparseable run timestamp: `updated_at='not-a-date'` | 409 `character_in_run` |
| 10 | Stale `snapshotHash` (change the item's `updated_at` after preview) | 409 `item_state_changed` |
| 11 | Capacity: add 30 carried filler items, then restore a deleted gear | restore succeeds into overflow (`extra_json.overflow=true`); carried count stays 30 |
| 12 | Id collision: recreate an item with the deleted id, then restore | 200 with a new `adm-res-<20 hex>` id; the existing row untouched |
| 13 | Different stack with the same id (change `junkId`), restore partial junk delete | new row with the original junkId; existing stack unchanged |
| 14 | Malformed snapshot: insert a hand-made `ADMIN_ITEM_DELETE` audit row with `quantityRequested` 1.9 / "1" / null, and `extra_json` `[]` / `null` / `"{bad"` | 409 `audit_not_restorable` for each; nothing created |
| 15 | Feature flag off: set `value_json` to `false` | 403 `feature_disabled` for preview, delete and restore |
| 16 | Duplicate/concurrent delete: fire the same `requestId` twice in parallel (`xargs -P 2` or two `curl &`) | one 200 applied, the other 200 `already_applied`; exactly one audit row, quantity reduced once |
| 17 | Concurrent restore: fire the same restore twice in parallel | one applied, one `already_applied`; no duplicate item, quantity added once |
| 18 | Race (best effort on real D1): run delete in a loop while a second shell inserts a pending receipt, repeat 50 times | every time the receipt exists at commit, delete is 409 and the item remains |
| 19 | Atomic rollback: `CREATE TRIGGER qa_fail BEFORE INSERT ON admin_audit_log WHEN NEW.event_type='ADMIN_ITEM_DELETE' BEGIN SELECT RAISE(ABORT,'qa'); END;` then delete | 500 `admin_audit_failed`; item still present; no ownership event. Drop the trigger afterwards. Same for `ADMIN_ITEM_RESTORE` |

## 5. Evidence queries (run after every scenario)
```sql
SELECT item_id, equipped, enhance_level, atk, extra_json, updated_at FROM items WHERE player_id='QA_P1' ORDER BY item_id;
SELECT audit_id, event_type, target_id, created_at FROM admin_audit_log WHERE event_type LIKE 'ADMIN_ITEM_%' ORDER BY created_at;
SELECT event_id, item_id, event_type FROM item_ownership_events WHERE event_type IN ('admin_deleted','admin_restored') ORDER BY occurred_at;
```
Record the response bodies, these three result sets, the Worker version id and the commit SHA under test.

## 6. Pass criteria
All 19 scenarios behave as listed, no scenario leaves a partial write, and no production resource was used. Scenarios 16 to 19 are the ones that cannot be proven by the SQLite simulation and are the point of this run.
