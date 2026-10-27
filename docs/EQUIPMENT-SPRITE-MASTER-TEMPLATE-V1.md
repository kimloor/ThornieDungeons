# Equipment Sprite Master Template V1 — Gate 0 Reusable Baseline

Status: **CONTRACT REFERENCE LOCKED / PIXEL-ANCHOR QA PENDING** (2026-10-27)
Baseline main: `631ae775173d2141cd4a0a3fe75f9707fa1da9bd`
Owner instruction: **Read this document AND `docs/EQUIPMENT-SPRITE-PIPELINE-V1.md` BEFORE EVERY equipment sprite creation or revision.** Reuse the baseline for G16, later Skeleton revision, G17–G20. Only revalidate changed source-contract parts; do not restart this inventory every time.

## 1. Locked sources
- `AGENTS.md`; `docs/EQUIPMENT-SPRITE-PIPELINE-V1.md`.
- `src/phaser/presentation/HeroV5RuntimeContract.js`: hero001/v5/g2, 768×768 fixed canvas, runtimeOffsetY=84; do **not** bake offset or transform into exports.
- `r2-upload/manifest.json`: **current selection authority**, not historical filename guesses.
- `r2-upload/hero/v5/g2/equipment/azure/AZURE_FRAME_CONTRACT.json`: source-frame and pose/provenance contract.
- `r2-upload/hero/v5/g2/equipment/azure/SOURCE_VALIDATION.json`: historical SHA-256/bbox validation; historical publication flags are not current live-state evidence.
- `r2-upload/hero/v5/g2/equipment/azure/IDLE_SWORD_RUNTIME_PATCH.json`: Idle sword baked grip/alignment.
- `docs/SKELETON-EQUIPMENT-VISUAL-AUDIT.md`: slot-level mixed-set behavior; Skeleton art revision remains deferred.

## 2. Verified existing Base files
Directory: `r2-upload/hero/v5/g2/base/`. GitHub content records show:
| Frame file | Git blob SHA-1 (NOT PNG SHA-256) | Bytes |
|---|---|---:|
| idle_01.png | `3f517b03330f641b2182e45c36f7afba7c32eab0` | 128216 |
| idle_02.png | `a6b5313d404050cbe92b57e06e9ed1b0b09b88a9` | 128204 |
| idle_03.png | `59ecc43c6e7cd5594da93c66f532a42d6e792ec6` | 128213 |
| attack_01.png | `82657e1508cb664ea9188710327ae1f527d3f443` | 129185 |
| attack_02.png | `40dea3c433f2cca913935b02353f478bafaeb455` | 124279 |
| attack_03.png | `2f4c33b8c941eb8340c7f93027be48f7742fc17f` | 118628 |
| death_01.png | `7a8903b598dfdb049b235a496c3db8a9d370ba52` | 130575 |
| death_02.png | `0d4108da2ac0833cb4051663fc973c63d002054c` | 115349 |

All 8 Base paths exist in the current manifest `assets.hero001.v5.g2.base.frames`. Source package SHA-256 (not each PNG): `aab841df163a08dc75c4d3783975b2e3ef49838c325cb93904c53af23e1a1079`. These Git SHA-1 hashes are the reusable repository identity lock.

## 3. Eight-frame / seven-layer template
Frames = `idle_01 idle_02 idle_03 attack_01 attack_02 attack_03 death_01 death_02`.
Seven declared exported RGBA 768×768 PNG paths per frame (56):
`coverage_underlay, torso_armor, legs_boots, arm_rear, helmet, sword, arm_front`.
Composite z-order: `wing_far → base → hair_back → hair_front → coverage_underlay → torso_armor → legs_boots → arm_rear → helmet → sword → arm_front → wing_near` (omit suppressed hair).
All layers share (0,0); no auto-trim, re-centering, interpolation, runtime rotation or Hero Base redraw. Transparent required layers need `emptyReason`.
Slot owners: helmet→helmet; chest→torso_armor; gloves→arm_rear+arm_front; boots→legs_boots; weapon→sword; underlay only when chest/gloves/boots are same family. Accessory = icon-only. Full Set First, no compulsory mixed-set visual matrix.

## 4. Existing Azure grips in 768×768 coordinates
| Frame | Grip (x,y) | Contract |
|---|---|---|
| idle_01 | (270,505) | Idle Sword runtime patch |
| idle_02 | (270,493) | Idle Sword runtime patch |
| idle_03 | (270,501) | Idle Sword runtime patch |
| attack_01 | (310,309) | Azure frame contract |
| attack_02 | (489,448) | Azure frame contract |
| attack_03 | (413,551) | Azure frame contract |
| death_01/02 | not specified | no grip requirement |

**IMPORTANT manifest override:** Historical Azure Idle `sword.png` is a transparent placeholder. Live manifest selects versioned `sword_w7_idle_v3.png` for Idle. It also selects versioned Azure helmet revisions. Always resolve current paths from live repository manifest rather than historical contract.
Default hair = `topknot`; Azure `fullFaceHelmet:true`. Current supported equipment families: azure/robot/skeleton; G16 family addition will need a separate scoped runtime compatibility review later.

## 5. Hair treatment and DEV gate
Full-face helmet: hide hair_back/front. Partial/open/crown: bake default topknot into every helmet frame and suppress separate hair. No helmet: render default hair. Current runtime only suppresses hair via `fullFaceHelmet === true`; do not misuse this flag for open helmets. DEV must design/backward-test a compatible hair mode BEFORE any open-helmet art publication. No implementation approved here.

## 6. Anatomical anchors — accuracy boundary
Head, shoulder, wrist, waist, knees, feet and safe silhouette envelopes must be **measured from original approved pixel images per frame**. Numeric coordinates are NOT contained in the inspected JSON contracts and cannot be inferred reliably from sword grips, bounding boxes or common geometry. This investigation verified metadata and files, **not the pixel decoded images**: mark that measurement as **PENDING**, not PASS. Before G16 Idle_01 prototype is position-certified, a Graphics/QA agent must attach an image-measured annex (8 frames, source SHA-256, anatomical anchor coordinates, bbox/silhouette envelope, comparison composites). Once verified, reuse it for all sets. This is a targeted pending physical-validation item, not a reason to repeat reference research for every set.

## 7. Release and reuse
- Reference inventory/contract: **PASS (read-only repository)**; pixel anatomical measurements, fresh PNG SHA-256, alpha decoding, CI, R2/Production probes: **NOT RUN**.
- Overall Gate 0 physical validation: **PARTIAL** until the annex above is measured. Never claim G0 fully done without it.
- Gate G1: complete Leather concept requires Owner preview approval.
- Gate G2: Idle_01 seven-layer prototype requires separate Owner approval before expansion to 56 paths.
- G3–G6: frames, visual QA, automated regression, R2 and production evidence separately.
- Skeleton artwork remains untouched until G16 complete.
- Each new graphics agent records a short preflight: latest main SHA, current Base Git identities, manifest selection, renderer compatibility, and whether annex is locked. If unchanged, reuse without rebuilding master. Any drift requires scoped revalidation.
- This documentation creates no asset, renderer, Worker/API/D1, gameplay or economy change.

## 8. Direct visual inspection annex — 8 Base PNGs (2026-10-27)
Using GitHub original Base image retrieval, all 8 PNG images were opened and visually reviewed at 768×768, with the exact paths and Git blobs in §2. This is a **visual reference map**, not algorithmically measured landmarks. Coordinates below are approximate image-reading estimates (±15–30 pixels depending on contour) and MUST NOT be used as immutable pixel-perfect anchors. X grows right, Y grows down, origin top-left.

| Frame | Approx visible silhouette bbox (x0,y0,x1,y1) | Head visual center | Torso visual center | Feet/lower contact area | Notes |
|---|---|---|---|---|---|
| idle_01 | (246,208,464,646) | (359,303) | (356,433) | (336,615) | relaxed standing, forward-facing-right |
| idle_02 | (246,196,464,635) | (359,291) | (354,420) | (339,607) | same pose, upward idle bob |
| idle_03 | (246,205,464,643) | (359,300) | (354,430) | (340,613) | same pose, intermediate idle bob |
| attack_01 | (225,257,511,669) | (375,350) | (352,474) | (307,628) | raised rear fist, other hand forward |
| attack_02 | (189,260,514,671) | (340,344) | (323,459) | (288,625) | extended forward punching arm |
| attack_03 | (206,258,439,670) | (341,344) | (322,461) | (283,626) | lowered striking forearm |
| death_01 | (244,213,550,618) | (345,296) | (410,431) | (456,580) | backward-falling torso |
| death_02 | (185,355,476,675) | (380,450) | (300,568) | (244,654) | kneeling/collapsed |

**Interpretation:** Idle animation shows modest vertical bob, but Attack/Death change limb direction and large silhouette bounds. Do not apply Idle anchors to Attack or Death. Source images show distinct shoulders, elbows/wrists, hips, knees and boot shapes, but exact skin/garment contours and joint centers were NOT quantified. For any production-ready atlas, derive explicit bilateral shoulder/wrist, waist, knees, feet and helmet fit points by pixel-mask/annotation review, with pixel-alpha bbox measurement and raw PNG SHA-256 read-back. Above coordinates are for coarse review navigation only.

**Verification grading:** 8/8 visual source frames READ/PASS for existence and pose recognition; numeric bboxes/landmarks **PROVISIONAL**; exact anchor acceptance **PENDING**. No render, new artwork, R2 upload, CI or Production checks were performed as part of this visual review.
