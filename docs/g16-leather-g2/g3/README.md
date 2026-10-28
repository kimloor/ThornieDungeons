# G16 G3 — artwork handoff

Status: **G16 G3 ARTWORK COMPLETE — G4 VISUAL QA PENDING** (2026-10-28). Existing Draft PR #160, branch `art/g16-g3-leather-frames`. Latest main checked: `614d8e363efa074d257319f3e3578a56196c2a06`. Risk LOW for the final exact helmet placement; no application/runtime source change.

## Final inventory and approval

All 8 frames × 7 paths = **56 accepted G3 PNG paths** are present. `VALIDATION.json` declares every path, SHA-256, dimensions, RGBA, alpha envelope, origin, assembly order, hand-occlusion status and Base source hash. `SHA256SUMS` verifies the 56 final exported paths relative to this folder. All are 768×768 RGBA, fixed origin [0,0], no nonzero canvas-edge alpha, no baked runtime Y=84. Underlay and Death sword have explicit emptyReason. No additional equipment export path is introduced.

Idle remains in exports/idle_01–03. All 21 approved Attack files remain in attack-back-torso-review/exports/attack_01–03. Death files remain in death-review/exports/death_01–02. Historical authoring checkpoints are source material, not additional final exports.

Death_01 retains its accepted helmet [-2,-8] / torso [-2,-6] placement; its actual reassembly matches the Owner-approved preview pixel-for-pixel. Death_02 retains the distinct canonical kneeling anatomy and original face; anatomical right arm (arm_rear) is in front of the chest. The Owner's final instruction was to raise its helmet another 8px and submit. The exact [0,-8] shift is now baked into its existing helmet PNG, with no resampling, clipping or regeneration. The other 55 equipment PNGs match commit 03b50c08c06d5decb1cc9f246a3c0f70e4aa50b6 byte-for-byte. All 8 canonical Bases are unchanged.

## Review and reproduction

- qa/FULL_SET_CONTACT_SHEET.png; Idle/Attack sheets and all three animation GIFs in qa/.
- death-review/DEATH_01_COMPARISON.png and DEATH_02_COMPARISON.png: same-origin Base/current-main Azure resolver/final Leather comparisons.
- death-review/DEATH_CONTACT_SHEET.png and DEATH_PARTS_SHEET.png: both Death poses and all fourteen isolated pieces.
- PROJECT_LEAD_HANDOFF.md: current copy-ready handoff. CLEANUP.json records removal of obsolete status documents, stale ledgers and superseded comparison drafts. Current approval evidence, generation prompts, source masters and contracts are retained.

Rebuild Death_01 with death-review/build.py; Death_02 with death-review/build_death02.py; refresh inventory/sheets/GIFs with build_current_qa.py (paths relative to this folder, run Python from repository root). Verify with `sha256sum -c SHA256SUMS` from this folder. The final QA builder checks the exact requested helmet shift and preservation of the other 55 files.

## Remaining gates

G3 artwork completion is not G4 visual/animation QA, G5 renderer regression approval or G6 publication. Project Lead/Owner should review the final full set and animation sheets at G4. Separate DEV concern: Attack/Death_02 foreground right-arm order differs from merged leather_overlap_v1; Attack per-pose runtime hand crops remain unresolved. Idle reviewed crops are retained; empty Death weapons require no post-sword hand crop. Do not copy Idle crops or claim that offline reassemblies certify the renderer.

No runtime/profile/slot, production manifest, Base/Azure/Skeleton, gameplay, API/Worker/D1, R2, merge or deployment change. Keep PR Draft pending the applicable review gates.
