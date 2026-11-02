# P0-ROLLBACK-01 — Actual D1 Reward Settlement Rollback Test Plan

Status: **TEST-ONLY / DEPLOYMENT GATE NOT APPROVED**

Base security source: `d128b96f3a652325de77592b3f5a859ad319dc5b` (PR #186). The production Worker, migrations, reward formulas, and PR #186 branch are unchanged.

## 1. Exact settlement boundary

`workers/thornie-dungeons-api.js` at the approved source:

- Complete Battle router: lines 8430–8431.
- `handleCompleteBattle`: lines 2778–2850.
- authoritative outcome checks: lines 2803–2814.
- reward calculation: `dungeonV2ServerRewardPlan`, lines 2107–2227.
- atomic reward function: `commitDungeonRewardInBattleTransaction`, lines 2315–2408.
- one settlement `db.batch(finalStatements)`: line 2404.

The victory batch executes in this order:

1. Insert `battle_completions` only while matching `battle_authority` is an unsettled victory; conflict is ignored.
2. Update Character Gold, level, XP, stat points, floor, Pet state, starter Pet, claims, and receipt retention, gated by `changes() > 0` from step 1.
3. Execute the zero-Diamond Player guard, also gated by `changes() > 0`.
4. Persist Inventory/Overflow changes and new item rows.
5. Persist item provenance and ownership acquisition events for new rewards.
6. Read the completion row.
7. Mark the checkpoint completed.
8. Set `battle_authority.settled_at`, guarded by the completion row.
9. Read authoritative Character, Inventory, and Player snapshots.

`handleCompleteBattle` performs a pre-read batch before this boundary. Its only write marks a checkpoint completed when an existing matching completion already exists; for a first settlement it changes zero rows. No Gold, XP, item, ownership, provenance, or new completion write occurs outside the settlement batch. A batch exception reaches the existing API error boundary and returns `server_error` (HTTP 500). A later request re-enters the same authority/checkpoint guards; once settlement succeeds, `battle_completions` makes replay read-only and idempotent.

## 2. Test-only injection

The dedicated entrypoint is `workers/qa/p0-rollback-entry.js`. It delegates unchanged requests directly to the approved entrypoint. Fault mode requires all of:

- `X-P0-Rollback-Fault: reward-settlement-batch`;
- a constant-time match for the dedicated `P0_ROLLBACK_TEST_KEY` secret;
- an unused 16–80 character `X-P0-Rollback-Nonce`;
- exact configured Player, Character, and Battle IDs;
- a D1 row proving the exact Battle belongs to the exact Character/Player and is an unsettled authoritative victory.

The exact Battle ID is claimed once in the existing `character_operation_receipts` table with operation `p0_rollback_fault`; the nonce is retained as evidence in its payload and the result is non-pending. A second fault request for that Battle is rejected even with a different nonce. This is test-control metadata, not reward state. It cannot trip the production pending-operation guard.

The D1 proxy recognizes the complete reward batch structurally. It refuses to inject unless item, provenance, and ownership writes are present. Immediately after all reward write statements and before completion/checkpoint/settled reads and writes, it inserts a statement with a deliberate `NULL` for `battle_completions.character_id`. The existing `NOT NULL` constraint must fail inside the same real `db.batch`. No table or schema is changed. Throwing after `await db.batch()` is not used.

## 3. Isolation and deployment gate

Do not deploy until Project Lead approves all exact identifiers and the exclusive shared-D1 window.

| Control | Required value |
|---|---|
| Worker | new `thornie-dungeons-p0-rollback-staging`; never overwrite `thornie-dungeons-p0-staging` |
| Source | exact reviewed instrumentation SHA |
| Entrypoint | `workers/qa/p0-rollback-entry.js` |
| D1 | only `DB -> thornie-dungeons-staging` (`c16e0b11-cf83-468c-a533-0ecbf522082f`) |
| Production D1 refusal | reject `2f6d52b4-3de7-4e78-98d4-fc143a4d29e2` |
| Routes / cron | none |
| Secrets | only a new QA-scoped `P0_ROLLBACK_TEST_KEY`; no Production secrets |
| Vars | exact `P0_ROLLBACK_PLAYER_ID`, `P0_ROLLBACK_CHARACTER_ID`, and `P0_ROLLBACK_BATTLE_ID` |

Create a dedicated QA account/character, start and legally win a Chapter Boss battle through the approved P0 Worker, record the exact IDs, then deploy the separate fault Worker with those immutable row-level guards. Chapter Boss is required so the recognized batch contains Inventory, provenance, and ownership writes. Do not apply migration 0031 or mutate shared schema.

## 4. Actual D1 matrix

| Case | Action | Required evidence |
|---|---|---|
| R01 | Snapshot exact QA rows; send one authorized fault completion | HTTP 500 plus injection headers; Gold/XP/Pets/floor/items/ownership/provenance/completion/checkpoint/`settled_at` unchanged; only the QA control receipt is new |
| R02 | Remove fault headers and complete the same Battle | one correct settlement, exact server reward, one completion, one settled timestamp, no duplicate reward |
| R03 | Send concurrent no-fault completion retries for that Battle | one first completion at most; all other responses are replay; no partial or duplicate state |
| R04 | Without fault headers, complete legal Normal and Chapter Boss battles | behavior and rewards match approved source; fault entrypoint adds no wrapper or control receipt |

Evidence must include before/after SQL for Character Gold/XP/floor/Pets, Player Diamonds, Items, item provenance, item ownership events, battle completion, checkpoint state, authority outcome/revision/`settled_at`, and the single test-control receipt. Local SQLite tests are regression evidence only and must not be reported as Actual D1 rollback PASS.

## 5. Recovery and cleanup

After approved QA:

1. Disable access by deleting only the dedicated fault Worker and its QA secret.
2. Verify the existing `thornie-dungeons-p0-staging` Worker identity and version were not changed.
3. Retain evidence before cleanup.
4. With Project Lead approval, delete only rows belonging to the recorded QA Player/Character/Battle IDs, including the `p0_rollback_fault` receipt; do not use wildcards or shared-schema changes.
5. Re-run `PRAGMA foreign_key_check` and verify no non-QA rows changed.

If the batch shape is not recognized, a binding/ID differs, the nonce was consumed, the authority row is not an unsettled victory, or the response does not prove an injected batch failure, stop and report `BLOCKED`; do not bypass a guard.
