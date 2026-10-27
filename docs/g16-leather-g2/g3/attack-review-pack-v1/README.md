# G16 Leather — Attack_01–03 review sheet V1

Status: **ATTACK REVIEW CANDIDATES — OWNER VISUAL ACCEPTANCE PENDING**. Risk MEDIUM, clothing-only per-pose reconstruction. Main checked `7ef31753b969386d2750857dddaa53d44c03081c`; branch parent `ae6c2bcd093c2c3482758abf59c638782bfbe81d`. Existing Draft PR #160 only.

Owner instruction: remove the small shoulder portion over the chin in Attack_01, continue Attack_02/03, then deliver a sheet. This explicitly authorizes expansion in this checkpoint. It is not acceptance of the resulting new frames or all 56 G3 paths.

## Review entry points

- `ATTACK_REVIEW_SHEET.png`: three assembled frames, one identical review-only crop for readability.
- `EQUIPMENT_PARTS_SHEET.png`: all 21 isolated candidate equipment pieces, enlarged per cell for inspection.
- `ATTACK_FULL_CANVAS_SHEET.png`: transparent 3×768×768 fixed-canvas sheet; cell origins [0,0], [768,0], [1536,0].
- `BASE_FIT_SHEET.png`: original Base in cyan 40% over each actual assembly.
- `NECK_AND_GRIP_DETAILS.png`: actual chin clearance, anatomical right glove and complete-sword detail per frame.
- `FULL_CANVAS_COMPARISON.png` and `qa/attack_01.png`–`attack_03.png`: full-size untrimmed composites.
- `exports/attack_01`–`attack_03`: exactly seven 768×768 RGBA PNGs per pose, including the declared transparent underlay.
- `VALIDATION.json`, `PLACEMENT.json`, `HAND_OCCLUSION.json`, `SHA256SUMS`: source hashes, candidate status, geometry and integration boundaries.

## What changed

Attack_01 retains the preceding neckline refinement. The remaining shoulder/chest pixels over the chin are removed by an alpha-only cut following a manually inspected jaw clearance guide. This changes 586 chest alpha pixels within [330,393,415,434); chest RGB and the other six exported byte streams are unchanged. No head, face or neck pixels are redrawn. The guide is visual authoring geometry, not a claimed pixel-exact bone anchor.

Attack_02/03 start from their own original canonical Base PNGs. Garment pieces come only from the current Owner-selected Attack_01 reconstruction, not the five rejected generated pose sources. No whole-body image generation is used. Offline tube-mesh reconstruction fits sleeve/glove material to each pose; torso surface and Attack_03 trousers/boots use clothing-only thin-plate surface mapping. Attack_02 trousers use a fixed authoring translation; helmet placements use per-pose translation. All mappings affect equipment pixels only: the original Base silhouette, face and limbs are not transformed, erased or replaced. This preserves material/design provenance while making the new fit explicitly reviewable; it does not certify design/pose fit automatically.

The complete independent G2 sword master is reused and transformed uniformly: handle [270,515] to [310,309], [489,448], [413,551] respectively. Attack_01 sword bytes are preserved; Attack_02 rotation -88° and Attack_03 -12° give the up-right and down-right blade directions compared with the actual selected Azure pose images. The 02/03 directions are visual authoring choices, not a new numerical runtime contract. No partial sword cut from a character is used.

## Layering and runtime boundary

Owner front → back: anatomical right sword arm (`arm_rear` in these Leather files) → sword → helmet → torso → anatomical left arm (`arm_front`) → legs → Base. The transparent underlay remains declared and makes no visible difference. Composites use the exact reverse of this list, without extra torso/hand passes. This is the Owner-authorized offline assembly, not a claim to match merged leather_overlap_v1.

`HAND_OCCLUSION.json` records whole-right-arm offline occlusion and the actual per-pose grip. Runtime crop is deliberately null/unapproved for these reconstructed pose exports; do not copy the Idle crop or widen a rectangle automatically. Runtime/profile/slot changes require a separate reviewed DEV task. Far/near wing handling is unchanged because no runtime source is edited.

## Visual limits and next gate

The new frames are candidates, not accepted art. Inspect shoulder/armhole/cuff/waist seams and the folded-sleeve/pauldron perspective against the Base overlay and actual-size assembly. Small Base skin/shirt slivers can remain at seam boundaries. Clothing surface mapping is recorded openly and is not a hidden Base pose correction. Final approval of naturalness, design consistency, grip and all-frame motion remains with Owner/G4.

This package contains **21 candidate PNG paths and zero newly accepted paths**. It does not promote them into final `g3/exports/`, does not alter validated Idle bytes, and does not create Death_01/02. G3 is not done, G4 is not ready, and no 56/56/Production PASS is claimed.

No Base/Azure/Skeleton, runtime, hair/slot metadata, live manifest, R2 upload, gameplay/economy, Worker/API/D1 or deploy changes.

## Checks and reproduction

From repository root: `python docs/g16-leather-g2/g3/attack-review-pack-v1/build.py` (Pillow, NumPy, SciPy). It regenerates candidates and sheets; verifies 21/21 PNG dimensions/RGBA/origin0, alpha edges and explicit empty underlay; confirms six Attack_01 export hashes and its bounded alpha-only chest cut; checks all eight canonical Base files against latest main and all 28 protected Idle PNGs against the task branch; and verifies runtime/manifest byte identity. Check SHA256SUMS from this folder. These technical checks do not imply visual acceptance. No frontend build is needed because no application source changed.

## Azure pose comparison

[Same-scale Azure vs Leather inspection](azure-comparison/README.md) compares all three attacks with the exact same source canvas, review crop and scale. Broad actions correspond, but exact elbow/wrist/leg fit is not certified; Owner review remains pending. This diagnostic changes no artwork.
