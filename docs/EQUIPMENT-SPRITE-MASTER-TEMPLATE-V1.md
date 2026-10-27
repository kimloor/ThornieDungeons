# Equipment Sprite Master Template V1 — Gate 0 Reusable Baseline

Status: **GATE 0 REFERENCE / RAW-ALPHA LOCKED — COMPLETE; ANATOMICAL LANDMARKS ARE VISUAL GUIDES (NOT RIG COORDINATES)** (2026-10-27)
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
The original eight PNG images have now been directly reviewed, SHA-256 hashed, decompressed and measured for strict raw-alpha bounds; §9 records the evidence. Anatomical joint estimates from visible original images are provided separately as **non-rig visual landmarks**, not pixel-exact joints. Occluded joints and garment fit can only be finally accepted in G2 Owner prototype review and G4 all-frame composite review. No ungrounded numerical rigidity/tolerance is invented.

## 7. Release and reuse
- Reference inventory/contract: **PASS (read-only repository)**; raw PNG SHA-256 / PNG decoding / raw-alpha bounds: **PASS (§9)**; precise invisible skeletal joints: **not a defined or verified rig contract**; CI, R2/Production probes: **NOT RUN (documentation-only)**.
- Gate 0 reference inventory and raw-pixel validation are **COMPLETE** (see §9). Visual landmark coordinates are guides, not pixel-perfect rig pivots; verify actual fit at G2.
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

**Interpretation:** Idle animation shows modest vertical bob, but Attack/Death change limb direction and large silhouette bounds. Do not apply Idle anchors to Attack or Death. Source images show distinct shoulders, elbows/wrists, hips, knees and boot shapes, but exact skin/garment contours and joint centers were NOT quantified. Production fit must be evaluated against the actual Base in G2 and G4; §9 provides raw-alpha bbox and raw PNG SHA-256 read-back. Above coordinates are for coarse review navigation only.

**Verification grading:** 8/8 visual source frames READ/PASS for existence and pose recognition; §8 visual bboxes/landmarks **PROVISIONAL**; §9 raw-alpha bounds and SHA-256 **VERIFIED**; final garment fit belongs to G2/G4. No render, new artwork, R2 upload, CI or Production checks were performed as part of this visual review.


## 9. Gate 0 final machine-readable image integrity evidence (2026-10-27)
**Actual original file bytes** were fetched from the GitHub connector at the path in §2; raw PNG SHA-256 was calculated independently over decoded file bytes. PNG IHDR: all eight files are **768×768, 8-bit RGBA (PNG color type 6)**. Their zlib IDAT pixel data was decompressed, PNG row filters reversed, and the `alpha > 0` bounding rectangle computed; rectangle format is `[left, top, rightExclusive, bottomExclusive]`. Opaque-pixel metric below means *nonzero alpha* (not fully opaque). Git blob SHA-1 and source path provenance remain in §2.

| Frame | Raw PNG SHA-256 | Alpha>0 bounds [L,T,R,B) | Alpha>0 pixels |
|---|---|---|---:|
| idle_01 | `579afb8b58518d7c3397d1bc29744df6ef0c7d14728e8b0b9f333f6f10dbb062` | [244,206,464,646] | 64305 |
| idle_02 | `0175d1a45643a55683f1f1ee973e560502fb0da227a7589d733ca9f373f74d4a` | [244,194,464,634] | 64305 |
| idle_03 | `36681408666113e5fb3c62d371ebb0f3c381c1183b81bda9c5e245d6f4ccc609` | [244,202,464,642] | 64305 |
| attack_01 | `a30e83047d8218558044e97e660154e9d1d6e12805db1ea94b16d7fd79d9739e` | [224,256,512,670] | 62162 |
| attack_02 | `2651ed58209b6bec5e06ffc6bba4eed7058cd4f467e9a4bd57f7cbed1412c0ba` | [188,257,512,672] | 61748 |
| attack_03 | `0e0a455cc315e4e7396d46ea30c85408623fb4cc8b0a96095eddceae946f948a` | [204,256,436,669] | 57662 |
| death_01 | `20502f785cda199e6632dbff175e4b93a8404624d50e1513d4be3dc2695dda6a` | [132,212,554,704] | 58864 |
| death_02 | `a5b722a6e62647674cd5152e8286f687cd02e318b1c8754dec7606ba4518b8b3` | [183,355,692,705] | 53034 |

**Read the differences correctly:** §8's approximate visible contours differ from strict `alpha>0` bounds; the Death frames in particular have very low-alpha outlier pixels beyond visually solid body. The table above is objectively measured raw-alpha envelope, **not** a reliable garment edge, limb articulation point, ground-contact anchor, or permission to stretch armor to that envelope. Graphics must inspect visible edges at intended playback scale during G1/G2.

### Pose-specific landmark reference map (visual estimates; all coordinates on source canvas)
This map was estimated from the eight rendered original Base images in §8. Landmarks below are intentionally **rough review points** (approximate ±15–30px, sometimes more on occluded joints) for locating anatomy, not rig pivots, collision geometry, mathematically measured keypoints or acceptance thresholds. `L/R` describe IMAGE-LEFT / IMAGE-RIGHT, not character laterality.

| Frame | Head center | Shoulder L / R | Wrist/hand L / R | Waist | Knee L / R | Foot L / R |
|---|---|---|---|---|---|---|
| idle_01 | (359,303) | (306,402) / (408,408) | (267,517) / (444,515) | (357,481) | (305,568) / (402,561) | (286,618) / (393,616) |
| idle_02 | (359,291) | (306,390) / (408,396) | (267,505) / (444,503) | (357,469) | (305,556) / (402,549) | (286,606) / (393,604) |
| idle_03 | (359,299) | (306,398) / (408,404) | (267,513) / (444,511) | (357,477) | (305,564) / (402,557) | (286,614) / (393,612) |
| attack_01 | (375,350) | (302,414) / (385,449) | (299,312) / (481,494) | (351,511) | (302,576) / (393,580) | (247,637) / (364,629) |
| attack_02 | (340,344) | (285,430) / (354,441) | (212,457) / (487,449) | (327,507) | (253,570) / (372,576) | (213,637) / (335,624) |
| attack_03 | (341,344) | (289,428) / (354,447) | (229,526) / (413,558) | (328,508) | (263,583) / (367,579) | (228,630) / (334,637) |
| death_01 | (345,296) | (338,389) / (452,409) | (307,513) / (530,484) | (420,458) | (417,534) / (495,541) | (389,582) / (501,581) |
| death_02 | (380,450) | (283,529) / (357,541) | (323,648) / (395,652) | (294,603) | (244,636) / (357,632) | (208,650) / (302,655) |

### Gate 0 disposition / reuse contract
- **DONE / REUSABLE as reference and authoring template:** eight original-image raw bytes + SHA-256, dimensions, PNG RGBA format, exact Alpha>0 envelopes, per-pose coarse visual landmark guide, existing Azure grip coordinates, slot/layer/hair policy, manifest precedence and path provenance are archived here.
- **G0 does not certify pixel-perfect rig joints:** these do not exist as canonical source coordinates and cannot be derived reliably from transparency alone. Physical fit, occluded wrist/shoulder joints, hair seams, silhouette allowance and armor proportions MUST be judged on the **G16 Idle_01 seven-layer prototype (Owner Gate G2)** against actual Base, and again during all-frame G4 QA. No numeric joint tolerance has been invented.
- Downstream G17–G20 and Skeleton must **reuse** these references, not repeat Gate 0, unless Base SHA-256, frame IDs, PNG dimensions, default hair, runtime layering or manifest selection changes. Document scoped revalidation when needed.
- **G16 Gate 1 concept production is still pending Graphics assignment/Owner approval**, and G16 Gate 2 requires Owner prototype sign-off. Nothing here approves art, runtime hair implementation, R2, or deploying to Production.
