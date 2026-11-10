> Publication update: see [PUBLICATION.md](PUBLICATION.md). Historical review status below predates the approved revision-r2 release.

PROJECT LEAD HANDOFF — REVIEW_CANDIDATE / R2_NOT_PUBLISHED

Branch: graphics/hero-v5-robot-skeleton-production
Base main checked: 76fc90c5d9c080a618846dc73d5005ed268e319e
Concept parent: 543cfbe4b21086cbe4524e9c4b200b66afaffdb3

Result: approved Phoenix Robot + Hell Dragonlord Skeleton concepts converted into two Azure-compatible fixed-pose equipment candidates. 112 clean RGBA layers, 768×768, origin (0,7), 8 frames/set, 7 layers/frame, separate greatswords and full coverage underlays. Compared against canonical Base Hero before fitting; exact Azure grip targets and baked sword transforms. Includes masters, contact sheets, same-scale base comparison, six GIFs, contracts, validation and manifest proposal.

Deliverable: docs/hero-v5-equipment-production/HERO_V5_ROBOT_SKELETON_REVIEW.zip
Review: docs/hero-v5-equipment-production/previews/
Contract/limitations: docs/hero-v5-equipment-production/README.md

Checks: all 112 canvas/mode checks pass; required layers nonempty; four death sword layers intentionally empty; transparent RGB clean; opaque base fully covered including dark undersuit; SHA-256 recorded. Contact sheets visually inspected. No runtime/browser animation test yet. Hair and wings omitted from composites: check their occlusion in engine. These are visible-pose cutouts, not a hidden-surface rig.

Scope: graphics review package only. No main/R2 manifest, W9, Base Hero, Azure, Wing R5, runtime, frontend/API or schema changes. No R2 URLs or live upload claimed.

Next: QA both sets at actual game scale, weapon-grip and hair/wing overlap in all frames. Resolve visual issues before promoting ZIP families to r2-upload and integrating MANIFEST_PROPOSAL.json through the normal Azure/R2 pipeline. Verify upload hashes after merge. After armor fitting review closes, continue wing design with the user.

FOLLOW-UP FULL COMPOSITE REVIEW: see full-composite-review/README.md. Two full contact sheets and six slower GIFs use current Wing R5 and the exact requested draw order, with both hair layers suppressed for full-face Robot/Skeleton helmets per user approval. FC-01 is resolved in offline review. DEV must apply conditional hair suppression only while a full-face helmet is equipped and restore selected hair otherwise. No source art edits, R2 publication, new wings or in-game QA claim.

R2 VISUAL REVISION: latest sheets and corrected layer overrides are in revision-r2/. Fixed Robot attack_01 helmet pixels incorrectly included in arm_front, restoring sword-over-helmet appearance with glove-over-hilt. Restored lower helmet edges in both death_01 poses and repartitioned adjacent cuts. Apply revision-r2/layers overrides over the original candidate ZIP before next ingestion. Earlier GIFs/ZIP predate this correction. R2 remains NOT_PUBLISHED; new wings NOT_STARTED. Await sheet review.
