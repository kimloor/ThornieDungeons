# ThornieDungeons — Pre-W6 Readiness Audit — 2026-10-03

Status: **COMPLETE / PRE-W6 GATE PASSED — WAVE 6 ready for separate owner approval**

Baseline main at audit start:
`aa9ccdae8e2d46e68d96d257f83cf3e075e71048`

Purpose:
- verify the production state after WAVES 1-5.5;
- identify release-blocking contract/runtime drift before WAVE 6;
- separate expected W6 cleanup targets from bugs that must be fixed first;
- avoid silently expanding W6 scope.

## Result summary

### COMPLETE
- WAVES 1-5.5 are merged and Production verified.
- W5.5 current-main closeout: focused security regression 40/40 PASS; full suite 521/521 PASS; build/generated-index/diff/Worker syntax PASS.
- Inventory-capacity authority follow-ups are merged.
- Repository stale-test/dead-code/doc cleanup is complete.
- Automatic merged-branch cleanup is healthy.
- Remote work branches were reduced to `main` + permanent `ops/branch-cleanup`.
- Admin V2 account-backed session path is merged and Production deployed.
- Arena W9/W9R, Dungeon V2, Reward V2, Enhance/Empower V2, Mythic content, Raid/Wings V2, Social/Guild work and W5.5 hardening are present in the current production line.

### RESOLVED RELEASE BLOCKER
1. **Azure Mythic Set 6-piece contract/runtime drift — RESOLVED / PRODUCTION VERIFIED**
   - Latest approved rule remains: Azure has 2pc +AGI 5 and 4pc Active Skill MP cost ×0.50; no Azure 6pc effect.
   - PR #58 removed the retired Azure 6pc control proc from shared Mythic contract, Battle Core, Worker, tests and Reward V2 documentation.
   - Merge SHA: `2e6b2d2a774bee2d975d26e03fd5911a6113f3f0`.
   - Focused Mythic/Battle/Raid/Arena/Reward regression: 126/126 PASS.
   - Full suite: 521/521 PASS.
   - Battle Core parity: SUCCESS.
   - API production deploy: SUCCESS.
   - Frontend production deploy + live verification: SUCCESS.
   - Retired Azure control-proc identifier is absent from runtime/tests/contracts.

### EXPECTED W6 TARGETS — NOT PRE-W6 BUGS
1. **Temporary Azure QA/Test Shop stock**
   - `src/systems/shop.js` still injects six `rarity: "azure"` test items priced at 1.
   - This is explicitly marked temporary QA stock and is already in the approved W6 cleanup scope.
2. **Legacy Blacksmith mutation path**
   - Worker still supports `handleMutateLegacyBlacksmith` for non-V2 items.
   - V2 items are explicitly rejected from this legacy path.
   - This remains a compatibility path until W6 removes obsolete legacy special-equipment behavior.
3. **Legacy Azure / crafted Set / Raid Wing owned rows**
   - Approved W6 scope remains destructive and narrow: remove only the identified obsolete legacy special-equipment families; preserve valid V2 items, currencies, materials and Recipes.

### DEFERRED / NON-BLOCKING
1. **Full Shop / Crafting feature contracts and Summoning are still unmapped**
   - Reward-facing economy rules are covered by the Reward V2 document.
   - Before changing broader Shop/Crafting/Summoning behavior, create dedicated contracts or inspect current main + explicit owner decisions.
   - This does not block the already-approved narrow W6 deletion matrix.
2. **Post-W6 Full Project Gap Audit + Security Re-Audit remains mandatory**
   - This pre-W6 readiness audit does not replace the post-cutover audit.
   - After W6 Production verification, rerun the full-system audit against the actual post-migration data/runtime state.

### DOCUMENTATION DRIFT FIXED BY THIS AUDIT
- roadmap execution state must show WAVES 1-5.5 complete / Production verified;
- W6 must remain blocked until this pre-W6 release-blocking GAP is resolved;
- Project Index must no longer describe W5.5 as the next gate;
- Admin V2 must be classified as production rather than Phase-0 design-only.

## Pre-W6 release gate

WAVE 6 readiness result:
1. Azure 6pc remediation is merged and Production verified — PASS.
2. focused Mythic/Battle Core/reward regressions are green — PASS.
3. W6 implementation must still use an exact deletion-target matrix and representative existing-player fixtures.
4. destructive cleanup still requires separate owner approval for implementation/release.

This audit is complete. It does not itself authorize destructive W6 cleanup.
