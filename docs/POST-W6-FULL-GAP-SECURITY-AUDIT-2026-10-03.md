# ThornieDungeons — Post-W6 Full Project Gap Audit + Security Re-Audit — 2026-10-03

Status: **ACTIVE GATE — one HIGH security remediation required before WAVE 7**

Baseline main:
`724af6c8377b9c7c349462407e4567f33e9a1e9c`

## Baseline verification

Current-main audit baseline:
- focused Auth/Admin/W5.5/Save/Mail/Raid/Arena/Guild/W6 security-authority regression: 75/75 PASS;
- full suite: 523/523 PASS;
- `node build.js`: PASS;
- generated `index.html`: current;
- `git diff --check`: PASS;
- Worker/Auth/Shared syntax: PASS.

## COMPLETE

- W6 migration `0029_w6_legacy_special_item_cleanup.sql` is Production applied.
- Retired pre-V2 Raid Wings / legacy Azure equipment acquisition paths covered by W6 are closed.
- current Raid Wings and Set rewards use V2 markers.
- Mail ownership/idempotency/Overflow tests are green.
- W5.5 CORS/body-limit/error-sanitization/forged-save/slot-isolation tests are green.
- Raid/Arena central session-token contracts are green.
- Admin V2 route authorization requires Admin session; the old `adminKey` argument no longer authorizes requests.
- `verifyAdminKey` remains exported only as compatibility/dead tooling surface; no production route falls back to it.

## GAP — RELEASE BLOCKER

### 1. Cross-account Inventory read isolation — HIGH

`handleGetInventory(db, id, session, characterId, page, pageSize)` verifies the player session but does not verify that a supplied `characterId` belongs to that player before querying `items WHERE character_id = ?`.

Impact:
- an authenticated account that knows another character id can request that character's item rows;
- this is a confidentiality/authorization violation even though mutation routes remain ownership-checked;
- existing security suites did not exercise this read path.

Required remediation:
- when `characterId` is supplied, require `verifyOwnedCharacter(db, id, characterId)` before the query;
- preserve the player-wide fallback only when no `characterId` is supplied;
- add explicit two-account regression proving account B cannot read account A inventory;
- rerun W5.5/Auth/Mail/Inventory/W6 focused regressions + full suite + deployment verification.

## DEFERRED / NON-BLOCKING

### Legacy Blacksmith compatibility path — MEDIUM cleanup debt
- `mutateLegacyBlacksmith` remains reachable for non-V2 owned items.
- Server checks session, character ownership, exact item ownership, idempotency receipt, authoritative Gold/material/protection costs and rejects V2 items.
- No cross-account or forged-resource issue found in this path.
- Do not mix its retirement into the HIGH Inventory read fix.
- Decide retirement/normalization in the post-audit backlog before or during the dedicated cleanup/presentation phase.

### Exported `verifyAdminKey` helper — LOW cleanup debt
- production admin routes call `verifyAdminAccess`, which requires the Admin V2 bearer session and ignores legacy key authorization;
- helper remains exported for migration tooling/tests only;
- remove later only when no tooling imports depend on it.

### Admin item deletion tooling — DEFERRED BY PROJECT LEAD
- design note retained in `ADMIN-V2.md`;
- not implemented in W6 or this audit remediation.

## DOCUMENTATION DRIFT

- roadmap header still says W6 is ready for approval even though W6 is already Production verified;
- Project Index active-roadmap row still describes W6 as ready rather than complete;
- Reward V2 is still labeled ACTIVE-DESIGN despite the V2/W6 Production cutover being complete.
These are documentation-only corrections and may be closed with the audit record.

## Gate result

WAVE 7 remains blocked until the HIGH Inventory read-isolation gap is remediated and Production verified.

After that remediation:
- mark this audit COMPLETE / GATE PASSED;
- route legacy Blacksmith/helper cleanup as non-blocking backlog;
- use the audited post-V2 production state as the W7 baseline.
