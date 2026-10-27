# G16 Attack — rear-facing torso correction

Status: **CORRECTION COMPLETE / OWNER REAR-ART REVIEW PENDING**. Risk MEDIUM, isolated torso material only. Latest main `7ef31753b969386d2750857dddaa53d44c03081c`; branch parent `3f76ca6bc99c4099ee6f7f324a5d7304f740796a`. Existing Draft PR #160.

**Owner confirmed all three attack poses are correct.** The earlier Graphics inference that they differed is superseded. The error was carrying front-facing torso details into Attack_02/03: both must show the back toward camera, following Azure. This checkpoint changes no pose or non-torso equipment.

## Delivered review material

- `ATTACK_REVIEW_SHEET.png`: front Attack_01 unchanged; rear-facing Attack_02/03 corrected.
- `TORSO_BEFORE_AFTER_AZURE.png`: front-detail mistake → corrected rear leather → actual Azure facing reference, one row per corrected pose.
- `AZURE_LEATHER_COMPARISON.png`: all three accepted poses at the same scale/canvas, Azure left and corrected Leather right.
- `EQUIPMENT_PARTS_SHEET.png`: all 21 isolated candidate pieces.
- `ATTACK_FULL_CANVAS_SHEET.png`: transparent 3×768 cells, no trimming or recentering.
- `qa/attack_01.png`–`attack_03.png`: actual full-canvas reassemblies from the exported files.
- `exports/<frame>/`: seven 768×768 RGBA PNGs per pose, declared empty underlay included.
- `VALIDATION.json`, `SHA256SUMS`: preservation and source reports.
- `PROJECT_LEAD_HANDOFF.md`: copy-ready handoff.

## Correction and source preservation

Two built-in ImageGen isolated-torso edits reconstruct a rear leather panel, subtle center-back stitched seam and continuous rear waist belt. Center-front chest clasps and the center-front buckle are removed. A small fastening at the far side is a side construction detail, not a centered front buckle. Rear shoulder/waist materials retain the Leather palette. Inputs and exact prompt are recorded in PROMPT.md; both full transparent donors are archived in masters/.

Only donor **material RGB** is admitted within the existing torso alpha footprint. Each donor is uniformly normalized to the original source crop [220,360,440,580], then placed at [220,360]. Nearest opaque donor material color extends into transparent donor edge samples before applying the original alpha; donor alpha, anatomy and silhouette are not admitted. Fully transparent original RGB is retained. No automatic final export trim, recenter, per-limb adjustment or runtime transform occurs.

Exactly **two of the 21 PNG byte streams change**: Attack_02/torso_armor and Attack_03/torso_armor. The other 19, including all seven Attack_01 files, are byte-identical to attack-review-pack-v1. Both changed torso alpha arrays and all three assembled alpha arrays are pixel-identical to their previous versions. Thus the already accepted poses, chin clearance, hidden insertion footprint, helmet, arms, legs and complete sword remain fixed. No front armor is mirrored to manufacture a rear view.

## Pipeline record

`docs/EQUIPMENT-SPRITE-PIPELINE-V1.md` §4D now records the earlier sequence and the correction: per-pose facing check, anatomy vs armor silhouette, part-by-part extraction and hidden completion, clothing-only reconstruction, bounded donor admission, low neckline/chin trim, complete separate sword registration, anatomical arm-name mapping, Owner offline layering, current runtime boundary and granular acceptance. Attack_01 = front; Attack_02/03 = three-quarter rear. It explicitly prohibits treating a deformed front plate as a back panel. Current pipeline status also records merged G2 compatibility instead of the superseded PR-pending status.

## Checks and remaining gates

21/21 PNG dimensions/RGBA/origin0/edge-alpha/empty-underlay checks pass. Nineteen source PNGs are hash-identical; both torso alpha arrays and all composite silhouettes match their previous pixels exactly. All eight original Base PNGs, 28 protected Idle exports, runtime source and current manifest remain unchanged. Source Azure torso paths/hashes and pipeline SHA-256 are recorded. No application source changed, so no frontend build was required.

Owner pose acceptance is recorded separately from pending corrected rear-art acceptance. G3 is not complete, G4 is not ready, Death_01/02 remain outstanding, and no final inventory promotion or 56/56 accepted claim is made. Existing non-torso seam issues, if any, are preserved as requested rather than silently refitted. The Owner offline order and unresolved per-pose runtime hand crops remain a separate DEV compatibility review. No Base/Azure/Skeleton, runtime/profile/slot mapping, R2/manifest integration, gameplay/economy, Worker/API/D1 or deploy change.

Reproduce from repository root: `python docs/g16-leather-g2/g3/attack-back-torso-review/build.py` (Pillow, NumPy, SciPy). Run `sha256sum --check SHA256SUMS` from this folder. Technical checks do not certify Owner visual acceptance.
