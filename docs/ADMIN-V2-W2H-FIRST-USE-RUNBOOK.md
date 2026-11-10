# ADMIN V2 — W2-H H1 Admin QA Seed: Production First-Use Runbook

Status: PLAN ONLY. Nothing in this document has been executed. The feature is deployed with `game_config.admin_seed_enabled` absent (= OFF). Enabling it needs the Owner's explicit OK for the exact run; this document is not an approval. Scope is H1 only: the **Gold** operation (cap 100,000 per request).

## 0. Principles
- Owner-supervised, one character, one run. DEV/QA prepare and verify; the Owner decides and watches each step.
- Only the designated QA identities from `PRODUCTION-QA-POLICY-V1.md` section 3 (`chatgpt`/`gpt1`, `claude`/`claude1`). No real player is a target.
- No ad-hoc SQL for the mutation. The grant goes through the Admin Seed UI/API so it is audited. The only direct D1 statements allowed are read-only SELECTs and the single flag write in step 4 and its removal in step 9.
- Stop on any unexpected result; do not retry blindly (retry only with the same `requestId` after a timeout or network error).
- Never put passwords, tokens, session cookies or recovery codes in chat, the repo or evidence.

## 1. Preconditions (all must be true before step 2)
1. `main` is at or after the merge `be685bc6` and the production Worker/frontend deploys are green (check the latest `Deploy ThornieDungeons API` and `Frontend` runs).
2. Read-only Production check: `SELECT key, value FROM game_config WHERE key = 'admin_seed_enabled';` returns **no row** (or a value other than the exact JSON `true`).
3. Read-only target check: confirm the target character id, name, Level, Gold, Unlocked Floor and `updated_at` still match the QA identity table; record them as the "before" snapshot.
4. The target character has no active run (`character_run_state` not updated in the last 30 minutes) and no pending `character_operation_receipts` row.
5. The Owner has chosen the amount (suggested first run: a small Gold amount such as 1,000, well under the 100,000 cap) and the reason text (5-300 characters).

## 2. Fresh restore point (immediately before enabling)
Take a new D1 Time Travel bookmark of production `thornie-dungeons-db` (`wrangler d1 time-travel info`, read-only) and record the bookmark and UTC time. An older bookmark (for example the one from 2026-11-04) is not acceptable. Nothing is restored unless the Owner decides to after a failed run.

## 3. Baseline evidence
Record the before snapshot (step 1.3), the latest deploy run IDs, the Worker version and the number of existing `ADMIN_SEED` audit rows (expected 0).

## 4. Enable (Owner OK required here)
The Owner confirms in writing: target, amount, reason, restore point recorded. Then set `game_config.admin_seed_enabled` to the exact JSON `true`. Record the UTC time. Nothing else is changed.

## 5. Preview
In the Admin tab: search the exact username, select the character, enter the Gold amount, press **Preview all**. Check page 3: the Player ID, Character ID and name are the intended ones, before/after Gold is correct, and the QA-account warning is NOT shown for `chatgpt`/`claude`.

## 6. Confirm (once)
Enter the reason and press **Confirm seed** once. Do not double-click. If the request times out or the network fails, use the same screen's retry (same `requestId`); do not start a new preview until the outcome is known.

## 7. Verify
- API result: success (or `already_applied` on a same-`requestId` retry).
- Read-only SELECT: the character's Gold equals before + amount; Level, XP, Floor, items and potions unchanged; exactly one new `ADMIN_SEED` audit row with the actor, target, before/after, reason and `requestHash`; no extra rows.
- A second Confirm with the same `requestId` must not change Gold again.
- Optional, only if the Owner wants it: a negative check with a bad `previewHash` returns `preview_changed` and writes nothing.

## 8. Failure handling
Any of: 500 `seed_mutation_failed`, Gold different from expected, more or fewer than one audit row, a non-target character changed. Action: go to step 9 immediately, do not retry, report the exact response and SELECT output to the Owner. Restoring to the bookmark is the Owner's decision and is a separate, explicitly approved operation; it would also discard all other players' progress made since the bookmark, so it is a last resort.

## 9. Disable
Remove the flag row (or set it to a value other than JSON `true`) right after verification, whether or not the run succeeded. Read back that `admin_seed_enabled` is OFF. Confirm with a valid Admin session that `adminSeedPreview` answers 403 `feature_disabled`.

## 10. Report
Record: UTC times, the restore point bookmark, the Owner OK reference, target and amount, API response, the before/after SELECT results, the audit row ID, flag state before/after, and any deviation. Update `PRODUCTION-QA-POLICY-V1.md` section 3.2 (seed status) only for what actually happened. The Production release gate for H1 stays NOT passed until this run is recorded and reviewed.

## 11. Out of scope here
H2/H3 operations (level, items, pets, equipment), enabling the feature permanently, seeding any non-QA player, and any change to W2-F/W2-G flags.
