# Hero V5 Robot / Skeleton equipment production candidate

Status: **REVIEW_CANDIDATE — technical checks pass; engine visual QA pending.**

Approved themes: Robot = Raid Boss Phoenix (white/gold/red mechanical feathers and orange cores); Skeleton = Hell Dragonlord (charcoal-purple, ivory bone edging, crimson crystals). Both remain human armor with separate greatswords. Approved concept references are in `../hero-v5-equipment-review/`.

## Deliverables

- `HERO_V5_ROBOT_SKELETON_REVIEW.zip`: 112 runtime layer PNGs (2 sets × 8 frames × 7 layers), 2 upright sword masters, 16 flattened armor masters, frame contracts, proposed manifest entries and validation report.
- `previews/base-size-comparison.jpg`: canonical Base Hero and both sets at identical canvas scale.
- `previews/{robot,skeleton}-contact-sheet.jpg`: all eight composites per set.
- `previews/{robot,skeleton}-{idle,attack,death}.gif`: animation review.
- `sources/`: authored pose atlases and isolated sword sheet.
- `tools/`: reproducible offline fitting, semantic cut masks, alpha cleanup, sword placement and packaging.

## Contract

768×768 RGBA, origin (0,7), existing frame names. Layer order: coverage_underlay → torso_armor → legs_boots → arm_rear → helmet → sword → arm_front. Death swords are deliberately empty, as in Azure. Six active weapon grip targets match Azure exactly; transforms are baked into PNGs, with no runtime rotation or rig.

Base geometry was measured before fitting. Helmet, torso and arms use authored part transforms. Legs use a bounded offline warp through hip/knee/foot landmarks. The idle helmet is shared across attack poses to avoid an absent hidden surface behind the raised glove. Idle bob offsets are −12 and −4 pixels. Coverage underlay uses the exact canonical base alpha and a dark undersuit color, including the head behind the closed helmet.

These are fixed-pose cutouts. Hidden surfaces behind overlaps are not a reusable animation rig. Armor coverage checks include the undersuit: they do **not** assert that rigid plates cover every base pixel. Preview composites omit hair and wings, so final hair suppression/occlusion and Wing R5 integration require engine QA.

## Validation and release state

`VALIDATION.json` records all layer SHA-256 values and bounds. Automated checks passed for 112 RGBA canvases, nonempty required layers, four intentionally empty death swords, zero RGB in fully transparent pixels, and coverage of every opaque base pixel. Final contact sheets were visually inspected after correcting sword orientation and removing detached fragments. GIF files were generated; browser/runtime animation QA has not been performed.

Latest main checked: `76fc90c5d9c080a618846dc73d5005ed268e319e`.
Branch: `graphics/hero-v5-robot-skeleton-production`, based on approved concept commit `543cfbe4b21086cbe4524e9c4b200b66afaffdb3`.

No production manifest, R2 staging, base, Azure, Wing R5, W9, frontend, API or player data were changed. `MANIFEST_PROPOSAL.json` is a proposal only. R2 publication is not complete and must not be reported as complete.

## Reproduce

From repository root, with Pillow, NumPy and SciPy installed:

```sh
python docs/hero-v5-equipment-production/tools/build.py
python docs/hero-v5-equipment-production/tools/package.py
```

The expanded package and individual preview PNGs are generated locally and excluded from git; the ZIP is the distributable artifact.

## Next action

Project Lead / DEV / QA: inspect the candidate at actual in-game size, check hair + wing overlap, weapon grip occlusion, and all attack/death transitions. If visual QA passes, unpack the two families to `r2-upload/hero/v5/g2/equipment/{robot,skeleton}/`, integrate the proposed manifest entries according to current runtime contracts, then publish through the standard R2 workflow and verify hashes. Do not overwrite Azure or Wing R5. Wing design follows closure of the armor fitting review.

## Additional full composite review

See `full-composite-review/README.md` for full hair + Wing R5 contact sheets and slow GIFs. FC-01 (Topknot protruding beyond both closed helmets) is resolved in offline review using the user-approved rule: full-face helmets hide both hair layers. Source artwork remains unchanged; DEV must implement and test the conditional visibility rule in runtime.
