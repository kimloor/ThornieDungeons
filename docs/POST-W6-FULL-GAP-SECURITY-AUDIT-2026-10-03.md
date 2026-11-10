# ThornieDungeons — Post-W6 Full Project Gap Audit + Security Re-Audit — 2026-10-03

Status: **COMPLETE / GATE PASSED — WAVE 7 baseline approved from audited post-V2 Production state**

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

## RESOLVED RELEASE BLOCKER

### 1. Cross-account Inventory read isolation — RESOLVED / PRODUCTION VERIFIED

- PR #63 added `verifyOwnedCharacter(db, id, characterId)` to `handleGetInventory()` whenever `characterId` is supplied.
- player-wide fallback remains available only when no `characterId` is supplied.
- explicit two-account regression proves account B receives 403 and no item payload for account A's character.
- focused security regression: 52/52 PASS.
- full suite: 524/524 PASS.
- Battle Core parity: SUCCESS.
- API Production deployment: SUCCESS.
- merge SHA: `a0fe7fe985aa6fe6ef5638cbd45a5b2b7d387854`.

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

Post-W6 Full Project Gap Audit + Security Re-Audit is COMPLETE / GATE PASSED.

- no unresolved release-blocking security/data-integrity finding remains from this audit;
- legacy Blacksmith compatibility and exported `verifyAdminKey` helper remain non-blocking cleanup debt;
- deferred Admin item deletion tooling remains outside this phase;
- the audited post-V2 Production state is now the baseline for WAVE 7 planning.
