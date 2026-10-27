# G16 G3 Source Revision — Phase A Attack_01

Status: **PHASE A REVIEW HOLD — MATERIAL DESIGN / ISOLATED-LAYER COMPLETION NOT ACCEPTED**.
Risk: MEDIUM. Latest main checked: `32bca9eca232355a2ae98bc5f3fd54e9c5d28637`. Existing PR #160/branch retained. Main was merged locally; mandatory equipment sources/contracts are unchanged. Canonical Base hashes remain unchanged 8/8; the 21 previously validated idle PNG bytes remain unchanged. Gate 0 reused.

The Project Lead's Source Reconstruction authorization supersedes the earlier hold on making a new source. The old whole-sheet source remains rejected and contributes **no pixels** to this reconstruction. That approval does not waive the new Phase A instruction: **“Stop if material design/pose drift remains”** and **“Return material design deviations for Owner approval before proceeding.”**

## Review entry points

- `qa/ATTACK_01_RECONSTRUCTION_REVIEW.png`: locked G2 design, canonical Base, old rejected source (comparison only), new actual seven-layer composite.
- `qa/ATTACK_01_DETAIL_REVIEW.png`: enlarged helmet/cheek, raised shoulder, opposite glove/wrist, anatomical right-hand grip; every detail paired with the same crop of unchanged Base.
- `qa/ATTACK_01_SEVEN_LAYER_REVIEW.png`: seven isolated **candidate** paths, review zoom only. This makes missing helmet/sleeve material visible instead of hiding it inside a composite.
- `qa/attack_01_base_overlay.png`: 50% Base/source overlay, no body registration or limb movement.
- `masters/attack_01_reconstructed_weapon_free.png`: actual cut-piece assembly on unchanged Base without sword.
- `candidate_exports/attack_01/`: seven 768×768 RGBA PNG candidates, origin [0,0]. These are NOT final exports and are NOT counted in 56-path completion.
- `VALIDATION.json`, `BOUNDED_REPAIR.json`, `CANDIDATE_METADATA.json`, `PROMPTS.md` and parent `SHA256SUMS`: technical checks, masks, provisional crop, complete-weapon authoring transform and source provenance.

## Work performed

1. Started with the canonical full 768×768 Attack_01 Base and approved G2 design only. Built-in ImageGen per-pose paintover; no old rejected source pixels.
2. Uniform whole-canvas normalization from the raw generated square to 768×768. No recentering, auto-trim, limb transform or runtime Y=84 baking.
3. Extracted equipment separately, keeping the actual Base for facial anatomy. The face-core box [356,356,446,412] in the final candidate composite is RGBA-identical to canonical Base; this is a scoped pixel check, not an assertion that every helmet/face boundary has passed review.
4. Applied a second ImageGen repair only inside three recorded equipment masks (opposite glove, near helmet cheek and torso-side seam). `BOUNDED_REPAIR.json` proves zero changed pixels outside each mask. The remaining 13 exactly unchanged Base-skin-colored pixels in the opposite-hand diagnostic box are still a cleanup finding; this heuristic is not a complete skin classification or acceptance threshold.
5. Preserved the complete approved G2 sword master. The candidate uses a uniform offline rigid rotation of -115° around author-selected handle center [270,512] mapped to canonical Attack_01 grip area [310,309]. The handle-center choice is an authoring point, distinct from Gate 0's historical Azure [270,505] reference. Blade, guard, full grip and pommel remain present; no hand/body is baked into the sword. No canvas-edge clipping.
6. Built the actual seven-layer composite using the merged `leather_overlap_v1` order and provisional cropped `arm_rear` pass [270,275,74,68]. Hair metadata is `hidden_full_cover`. The crop is **not approved**: final occlusion clearance depends on a complete helmet/sleeve source and has not been certified against all intended overlaps.

## Why Phase A has not passed

| Finding | Evidence / implication |
| --- | --- |
| Near cheek panel differs from G2 | New extraction/repair has a straighter boundary and an abrupt notch around the temple. G2's curved panel/edge must remain the design authority. Do not silently approve it as a new variant. |
| Raised pauldron differs from G2 | Narrow single visible plate does not reliably preserve the approved layered rounded shoulder silhouette. Needs design review/repair on this same pose. |
| Helmet hidden material incomplete | The raised hand/forearm occluded the source; isolated helmet still has a large arm-shaped missing region. A plausible full composite does not qualify this helmet as a complete independent equipment piece. |
| Sleeve cap / slot cuts incomplete | Isolated upper sleeve is not yet rounded/closed under the shoulder; opposite arm extraction still includes a shoulder fragment and trouser upper insertion still includes skirt pixels. These candidates fail final isolation/overlap cleanup even where a full set hides them. |
| Small glove/shoulder seam defects remain | See enlarged detail review and the scoped diagnostic in VALIDATION.json. Technical PNG PASS is not visual acceptance. |

No new runtime architecture is proposed. Complete the occluded helmet/sleeve material and restore approved G2 contours before certifying a crop. Do not solve it by moving Base anatomy, using the old rejected pixels, changing draw order or hiding invalid parts with a shared underlay.

## Gate disposition / exact next step

**Final inventory remains 21/56; 7 additional candidate PNGs are review evidence only; 35 final paths remain missing.** Attack_02/03 and Death_01/02 were not started because Phase A has not passed. No Attack/Death animation previews or G4 readiness are claimed. Original approved Idle_01 and validated Idle_02/03 remain unchanged.

Project Lead/Owner review the two material contour differences in the enlarged review before continuing Phase A repair. This is a request for design direction on the concrete prototype, **not** a request to re-authorize the already approved per-pose reconstruction method. The missing hidden material and extraction contamination must be repaired regardless of design review; do not approve them as shipping quality. After Phase A passes, proceed to the other four canonical poses under the existing task authorization.

No R2 upload, production manifest integration, runtime architecture edit, manual deploy, Base/Azure/Skeleton, gameplay/economy/Worker/API/D1 edit. Existing repository automation may create a branch preview from PR updates; it is not graphics acceptance or Production verification.

## Reproduce

From repository root, run in order:

1. `python docs/g16-leather-g2/g3/revision-a/build_attack01.py`
2. `python docs/g16-leather-g2/g3/revision-a/apply_bounded_repairs.py`
3. `python docs/g16-leather-g2/g3/revision-a/make_review.py`
4. `python docs/g16-leather-g2/g3/build_idle_evidence.py`
5. `node docs/g16-leather-g2/g3/verify_runtime.cjs`

Pillow and NumPy are required. All generated source masters and prompts are preserved. No final export regeneration from a rejected source is authorized by these scripts.
