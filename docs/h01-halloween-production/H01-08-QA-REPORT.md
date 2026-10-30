# H01-08 Independent QA Report

Status: **H01-08 BLOCKED — NOT RELEASE READY**
Date: 2026-10-30 (Asia/Bangkok)
Risk: HIGH — confirmed reward authorization bypass on actual staging D1.

## Source and isolation

- Main: `2c0304d267ac0b89a76681991b0090bece2fdbc9` at preflight.
- Graphics PR #183: `9cbe1c0af9b7579613f59435e326fd5ae45f8a7c` (Draft).
- DEV PR #184: `a59ab4e215d00c4a618307292838629cd48f1379` (Draft), the exact source checked out by staging deploy workflow.
- QA branch: `qa/h01-08-staging`; deploy workflow run [41004522175](https://github.com/kimloor/ThornieDungeons/actions/runs/41004522175) succeeded. Its first attempt, run 41004408833, failed because Wrangler resolved a relative entrypoint from the temporary config directory; the config path was corrected to the repository root.
- D1: `thornie-dungeons-staging`, ID `c16e0b11-cf83-468c-a533-0ecbf522082f` (APAC). Worker: `thornie-dungeons-h01-staging`, deployment `6810bdaa-d000-4b63-9b39-cb5740a39847`, version `97e68989-1649-4639-bb02-dcb4438c3162`. Cloudflare settings confirmed the sole binding `DB` points to that staging D1 ID; no cron. Admin staging Worker was absent, and the Admin PR #182 workflow at head `46ee2b2` was completed, not running.
- Initial Time Travel bookmark: `00000004-00000000-00005114-2178819965b6cc4ea05b8e6d0d00d3c7`. D1 export at this exact bookmark completed before bootstrap. No restore was executed.

## Shared D1 bootstrap

The staging D1 initially had only `_cf_KV`. The repository's historical schema and migrations v3–v10, Auth V2 fixture schema, then `migrations/auto/0012` through `0030` were applied in order. The comment-only marker files `0020` and `0021` were recorded in `d1_migrations` without SQL execution.

Before `0025`, each of `pvp_matches`, `pvp_match_log`, `pvp_snapshots`, and `pvp_ranking` had **0 rows**. No view, trigger, or other table referenced them. The original `0025` SQL dropped all four; none remained afterward. `PRAGMA foreign_key_check` returned no rows.

Before `0029`, both the total `items` row count and the exact legacy-delete predicate count were **0**. The original `0029` SQL ran with 0 changes for its audit insert and delete. After `0030`: 19 entries in `d1_migrations`, 59 tables, 61 indexes, latest `0030_shop_timed_stock.sql`, no foreign-key violations. The Admin tables remained empty.

## Actual Worker / D1 checks

- Inactive config: public status returned `inactive`; an authenticated start request returned HTTP 403 `halloween_event_inactive`.
- Staging-only future activation fixture: status returned `scheduled` with the expected one-calendar-month end.
- Staging-only active fixture: an authenticated `QA_H01_*` character started an event battle. HTTP 200 returned the fixed boss `haloween_nightmare`, reference floor 10, and persisted end timestamp.
- Repeating start returned the same battle authorization (resume identity).
- **Security finding H01-08-S1, release blocker:** the Worker accepted a client-constructed checkpoint containing the issued encounter identity but no proven turn sequence, combat actions, HP outcome, or boss defeat. A subsequent client-reported victory with a reward request returned HTTP 200, `firstCompletion: true`, and a server-calculated reward. The client-supplied inflated Gold/XP values were not honored, but the server still awarded **100 Gold and 60 XP** without a verified battle.
- SQL evidence after the call: one `battle_completions` row for the QA battle with reward Gold 100 / XP 60, the checkpoint state `completed`, character Gold 100 and unlocked floor still 1. Item count 0. The character XP value was 20 after applying 60 reward XP due to level progression. No Admin rows were touched.

This is an actual D1 handler result, not a mock or SQLite simulation. The finding demonstrates that authoritative reward amount calculation does not establish authoritative victory. Do not accept H01-06/08 or release until DEV closes the checkpoint/completion trust boundary and the negative path is retested on staging.

## Containment and unfinished QA

The staging-only `halloween_event_v1` config row was deleted with an exact-value guard, restoring the original absent state. Cloudflare confirmed public and preview URLs disabled for `thornie-dungeons-h01-staging`. The QA player, character, checkpoint and completion remain in staging solely as evidence; secrets and session tokens are not in this report or Git.

The security stop condition halted further mutation, concurrency, rollback, overflow, responsive browser, Phaser 56-case, and isolated R2 QA. No H01-09 readiness is claimed. Local `node build.js` and `git diff --check` passed before deployment. The full Node suite in this environment showed 922 passes, five inherited UI/version failures, and the H01 test process was killed by the runtime before reporting its cases; it is not an independent 7/7 pass.

No PR was merged. No Production Worker, D1, R2, route, event config, or version was changed.

## Required next action

DEV: make completion require a server-verifiable combat outcome or a trusted server-maintained turn transcript/state; reject forged/short-circuit checkpoint-to-victory paths. Add a regression test reproducing this exact negative path with the actual handler. Then Project Lead should review the fix and authorize a fresh H01-08 staging run, including concurrent completion, rollback, expiry, overflow, frontend, Phaser and R2 evidence.
