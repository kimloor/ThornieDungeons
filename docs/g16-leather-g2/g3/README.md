# G16 G3 — current artwork review

Status: **DEATH_01 OWNER APPROVED / DEATH_02 OWNER REVIEW PENDING** (2026-10-28). Existing Draft PR #160, branch `art/g16-g3-leather-frames`. Latest main inspected: `614d8e363efa074d257319f3e3578a56196c2a06`. Risk MEDIUM: isolated Death equipment art and scoped documentation cleanup.

## Current source of truth

- `VALIDATION.json`: current 8-frame inventory and per-frame SHA-256, alpha, dimensions, origin, draw-order and hand-occlusion records.
- `SHA256SUMS`: the 56 current declared equipment paths only, relative to this folder. Historical authoring checkpoints are not extra final exports.
- `qa/FULL_SET_CONTACT_SHEET.png`: all eight actual export reassemblies. Idle/Attack/Death contact sheets and GIF previews are alongside it.
- `death-review/DEATH_02_COMPARISON.png`: canonical Base / current-main Azure resolver / Leather candidate, same crop, origin and scale.
- `death-review/DEATH_PARTS_SHEET.png`: both Death frames and all 14 isolated declared pieces.
- `PROJECT_LEAD_HANDOFF.md`: one current, copy-ready handoff. Superseded checkpoint READMEs, stale validation ledgers and handoffs have been removed at Owner request; `CLEANUP.json` records scope and recovery commit.

## Approval record and export locations

Idle: approved G2 material, exact canonical bob translations, `exports/idle_01` through `idle_03`. Attack: all poses and corrected Attack_02/03 rear torso surfaces approved; all 21 PNGs stay unchanged in `attack-back-torso-review/exports/attack_01` through `attack_03`. Death_01: Owner accepted the latest two-step placement preview at `52252e2`, then said to continue. Helmet [-2,-8] and chest [-2,-6] are now baked as exact integer offline shifts into `death-review/exports/death_01`; the actual reassembly matches the accepted preview pixel-for-pixel. The five other Death_01 files are byte-identical.

Death_02: seven new candidate files in `death-review/exports/death_02`. It uses its own canonical kneeling/collapsed anatomy, manual clothing-only helmet/chest reconstruction from approved Idle pieces, and three bounded isolated-part ImageGen RGB donors. No generated Base/face/body geometry is admitted. Prompts, inputs, donor masters and admission masks remain available for future edits.

## Gate boundaries

All **56 declared paths are present**, consisting of 49 established reference paths and **7 unaccepted Death_02 candidate paths**. This is not 56/56 visual acceptance, final inventory promotion, G3 completion or G4 acceptance. Review Death_02 next; after acceptance reconcile the final state and continue G4. Technical checks do not substitute for Owner visual acceptance.

All eight original Bases, 21 Attack PNGs and 28 protected G2/G3 Idle checkpoints remain byte-identical. All current exports are 768×768 RGBA at origin [0,0], no edge alpha/clipping, no baked runtime Y=84. Underlay stays empty; Death sword stays empty with explicit emptyReason.

Idle uses inherited reviewed hand crops. Attack uses the Owner-approved offline order; runtime order/crop compatibility remains a separate DEV gate. Empty Death weapons need no post-sword hand crop. All-frame sheets/GIFs are offline artwork evidence, not actual renderer regression tests. No production manifest, runtime, Base/Azure/Skeleton, R2, merge, gameplay, API/Worker/D1 or deployment change.

Rebuild Death_01: `python docs/g16-leather-g2/g3/death-review/build.py`. Rebuild Death_02: `python docs/g16-leather-g2/g3/death-review/build_death02.py` (do not use --prepare unless updating pose inputs). Refresh current inventory/sheets/GIFs: `python docs/g16-leather-g2/g3/build_current_qa.py`. Verify the final-path ledger with `sha256sum -c SHA256SUMS` from this folder. Older nested scripts/images are source-authoring checkpoints only; their removed status reports must not be treated as current gates.
