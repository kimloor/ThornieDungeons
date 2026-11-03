# ThornieDungeons — H01 Independent QA / Release Gate

**Audit date:** 2026-11-03 (Asia/Bangkok)  
**Repository:** `kimloor/ThornieDungeons`  
**Audit base main SHA:** `44e423dc46b869cd1517d0f36a469563d405ab72`  
**H01 PR:** [#201](https://github.com/kimloor/ThornieDungeons/pull/201)  
**Merge commit:** `0f75886652be3a8cbbc5c369e8036f8ea915365b`  
**PR head commit:** `f55d7c6d68d7bff488a6af1896554e68ab55766d`  
**Release Gate:** **BLOCKED — DO NOT ACTIVATE H01**

## 1. Scope and safety

This is a read-only Independent QA audit plus documentation reconciliation. No production D1 write, QA-account mutation, credential access, Event activation, code edit, or deploy was performed by this audit. Owner explicitly reported P0 Production acceptance (Potion → Attack through battle end, Checkpoint Resume, Checkpoint Discard, and Auto Retarget after target death) as PASS; this is recorded as **Owner-reported Production QA**, not an independently reproduced test.

## 2. Lifecycle status

| Dimension | Result | Evidence / boundary |
|---|---|---|
| Implemented | PASS | H01 implementation is present in merged PR #201; inspect H01 contract and source/tests at merge SHA. |
| Tested | BLOCKED | Prior DEV checkpoint documents H01 automated checks and Phaser Canvas 56/56. This audit did not rerun them; CI results alone do not substitute for full independent gameplay/settlement QA. |
| Merged | PASS | PR #201 merged; merge SHA above. |
| Deployed | PASS (workflow evidence) | Frontend Deploy #186 and API Deploy #89 succeeded on merge SHA. This proves workflow completion, not that Event was activated. |
| Production Verified | BLOCKED | No independent live Event entry/battle/reward test was run. Event activation remains prohibited without explicit Owner approval. |

## 3. R2 object integrity

GitHub Actions **Upload R2 assets #59**, job `upload` (job ID `125719095464`), log records remote upload followed by remote download and `Verified` for each listed object, ending with **“Uploaded and verified 18 object(s).”** The 18 verified object keys are:

### Excaliburnt wearable weapon (8)
1. `hero/v5/g2/weapons/excaliburnt/attack_01/sword.png`
2. `hero/v5/g2/weapons/excaliburnt/attack_02/sword.png`
3. `hero/v5/g2/weapons/excaliburnt/attack_03/sword.png`
4. `hero/v5/g2/weapons/excaliburnt/death_01/sword.png`
5. `hero/v5/g2/weapons/excaliburnt/death_02/sword.png`
6. `hero/v5/g2/weapons/excaliburnt/idle_01/sword.png`
7. `hero/v5/g2/weapons/excaliburnt/idle_02/sword.png`
8. `hero/v5/g2/weapons/excaliburnt/idle_03/sword.png`

### Haloween nightmare boss (7)
9. `sprite/enemy/haloween_nightmare/animations/haloween_nightmare_attack_0.png`
10. `sprite/enemy/haloween_nightmare/animations/haloween_nightmare_attack_1.png`
11. `sprite/enemy/haloween_nightmare/animations/haloween_nightmare_attack_2.png`
12. `sprite/enemy/haloween_nightmare/animations/haloween_nightmare_death_0.png`
13. `sprite/enemy/haloween_nightmare/animations/haloween_nightmare_idle_0.png`
14. `sprite/enemy/haloween_nightmare/animations/haloween_nightmare_idle_1.png`
15. `sprite/enemy/haloween_nightmare/animations/haloween_nightmare_idle_2.png`

### Event gate and item icon (2)
16. `ui/dungeon-select/dungeon-gate-halloween-v1.webp`
17. `ui/equipment-icons/event/excaliburnt.png`

The workflow's 18th object is the staged manifest itself: `r2-upload/manifest.json` maps directly to R2 key `manifest.json`. Therefore the run's 18-object count reconciles as **17 H01 image assets + 1 manifest JSON**. The job log explicitly records upload followed by remote download and SHA-256 equality for each of the 17 listed image assets, ending with “Uploaded and verified 18 object(s).” The manifest JSON is included in the workflow's changed-file list and supported upload types; its key is not repeated as an image-style `Verified <key>` line in the excerpted object list. The run provides historical upload/read-back evidence for 18 changed objects. Current R2 state remains unverified: the connected GitHub tools do not expose R2 list/get, and the Production status URL could not be fetched through the available read-only web access.

**Workflow script issue:** after the successful upload count, the job log emits shell command-substitution errors on the Markdown summary lines containing backtick-quoted `assets`, `r2-upload/<key>`, and `R2 <key>`. The upload/verification loop had already completed and the job concluded SUCCESS, so these errors affect the step-summary formatting, not the 18-object upload/read-back loop. Fixed in source at commit `46703b6ab880f4604a5965d7d81f15e104ad7657` by escaping the Markdown backticks in the two summary echo lines. This prevents Bash command substitution. The workflow has not yet been rerun, so runtime confirmation remains pending.

## 4. Workflow evidence

| Workflow | Run | Result |
|---|---:|---|
| Frontend Deploy | #186 | SUCCESS |
| API Deploy | #89 | SUCCESS |
| Battle Core parity | #633 | SUCCESS |
| Upload R2 assets | #59 | SUCCESS (see log caveat above) |

Links: [Frontend #186](https://github.com/kimloor/ThornieDungeons/actions/runs/41575864530) · [API #89](https://github.com/kimloor/ThornieDungeons/actions/runs/41575864505) · [Battle parity #633](https://github.com/kimloor/ThornieDungeons/actions/runs/41575864425) · [R2 upload #59](https://github.com/kimloor/ThornieDungeons/actions/runs/41575864500).

Cleanup branch workflow run #496 failed after successful cleanup runs #494 and #495. This is an operations signal, not evidence of H01 gameplay failure; cleanup is not a Release Gate pass criterion for Event activation.

## 5. Independent QA and Release Gate checklist

| Gate | Evidence / current assessment | Status |
|---|---|---|
| Source Integrity | Main SHA and PR #201 merge verified; relevant source is in main. | PASS |
| Assets Integrity | R2 upload run reconciles to 17 H01 image assets + `manifest.json` (18 total); log confirms remote download/SHA-256 verification for the 17 image keys and reports 18 total. Current R2 state was not independently re-read; the summary quoting fix is committed but not yet rerun. | BLOCKED |
| Build Integrity | Frontend deploy workflow succeeded; independent clean build and generated-output check were not run in this audit. | BLOCKED |
| API Integration | API deploy succeeded; event inactive behavior and authorization were not independently exercised against Production. | BLOCKED |
| Gameplay | Prior DEV checkpoint reports H01 automated coverage and Phaser Canvas 56/56; not rerun by Independent QA. | BLOCKED |
| Reward / Settlement | No independent battle reward, exclusive 5%/95% outcome, replay/race/idempotency, overflow, or expiry settlement test executed. | BLOCKED |
| Regression | Battle Core parity #633 succeeded; owner-reported P0 test outcomes are recorded above. H01-specific independent regression remains incomplete. | BLOCKED |
| Production Readiness | Frontend/API deployed, but Event Config/status and current live behavior were not verified through an approved read-only route. | BLOCKED |

## 6. P0 closeout

**P0 Acceptance: CLOSED — Owner-reported Production QA.**

Owner confirmed:
- Potion → Attack → continue until Battle end: PASS.
- Checkpoint Resume: PASS.
- Checkpoint Discard: PASS.
- Auto Retarget after original target dies: PASS.

This record preserves attribution and does not claim this audit independently reproduced the tests. No Production account state was changed as part of this audit.

## 7. Blockers / required next actions

1. The 18th R2 object is reconciled as `manifest.json`. Current R2 object listing/read-back remains pending until an authorized read-only R2 path is available. The summary quoting fix is committed at `46703b6`; rerun and verify the workflow on a subsequent authorized dispatch or asset-staging change.
2. Verify event Server Config is inactive and confirm UI/API enforce inactive status using a permitted read-only/status endpoint; do not activate.
3. Obtain independent automated test execution evidence for H01 focused tests and relevant regression suite.
4. Complete authorized manual QA for event entry, battle mechanics, reward/settlement, duplicate/retry protection, checkpoint/resume, expiry/in-flight completion, and mobile UI. Use normal client flows; no direct D1 writes or test-account mutations without separate approval.
5. Update this record with test run IDs and exact evidence after those tests.
6. **Only after every Mandatory Gate is PASS, stop and request explicit Owner approval to Activate.**

## 8. Release decision

**H01 is NOT READY TO ACTIVATE. Release Gate = BLOCKED.**  
The source is merged and FE/API deployment workflows succeeded. R2 upload count is reconciled as 17 image assets plus the manifest; remote read-back/SHA verification is present in the successful workflow log, with a separate summary-formatting shell bug after the upload loop. Independent gameplay, settlement, inactive-config verification and production acceptance remain incomplete. No Event activation is authorized by this audit.
