# Full composite offline review — Robot / Skeleton

THORNIE_GRAPHICS_HANDOFF
STATUS: READY_FOR_PROJECT_LEAD_REVIEW
R2: NOT_PUBLISHED

Source branch head: 48dc0d1f1c222cbd3e453553d36e9a3ab5f35f47
Latest main checked: 76fc90c5d9c080a618846dc73d5005ed268e319e

## Files

- robot-full-composite-contact-sheet.jpg
- skeleton-full-composite-contact-sheet.jpg
- robot-full-idle-slow.gif
- robot-full-attack-slow.gif
- robot-full-death-slow.gif
- skeleton-full-idle-slow.gif
- skeleton-full-attack-slow.gif
- skeleton-full-death-slow.gif
- grip-detail-check.jpg: enlarged Idle / Attack hand and hilt inspection.
- VALIDATION.json: source hashes, decoded GIF durations, sequence order and overlap measurements.

## Composition

Current manifest-selected Base Hero and approved Wing R5, plus the frozen PR #33 candidate ZIP. Topknot source assets are audited but both hair layers are suppressed for these full-face helmets, as explicitly approved by the user in this review. All layers use native 768×768 coordinates at (0,0), without per-frame translation, cropping, recentering or fitting. GIFs uniformly scale the complete canvas to 512×512 and add a frame/time label outside it. Contact-sheet cells use 384×384.

Exact order:
wing_far → base → hair_back → hair_front → coverage_underlay → torso_armor → legs_boots → arm_rear → helmet → sword → arm_front → wing_near.

Idle: idle_01 → idle_02 → idle_03 → idle_02, 350 ms each (previous 180–220 ms).
Attack: idle_01 → attack_01 → attack_02 → attack_03 → idle_01, 650 ms each (previous action frames 110–200 ms).
Death: idle_01 650 ms → death_01 600 ms → death_02 1200 ms. The loop restarts at Idle deliberately for repeated inspection, not as a proposed runtime resurrection transition.

## Findings

**FC-01 — RESOLVED IN OFFLINE REVIEW BY USER-APPROVED HAIR POLICY.** The initial full composite showed Topknot protruding beyond both closed helmets. The user directed: hide hair when wearing a full-face helmet. These regenerated review files suppress both `hair_back` and `hair_front` in all eight frames for Robot and Skeleton. No helmet or hair artwork was edited. The zeroed review layers preserve the declared draw order.

DEV handoff rule: when the equipped helmet is full-face, suppress both hair layers for Idle, Attack, Hurt/Death and equipment presentation. Removing the helmet or using an open helmet restores the selected hair normally. Apply this condition to the equipped helmet, not permanently to the character's chosen hairstyle. This pass implements the policy only in offline review; runtime implementation/testing remains pending.

Wing R5: Attack 02/03 near wing is correctly outermost and covers part of the shoulder/upper arm. No opaque near-wing overlap with either sword was found in these frames; grip detail crops show the foreground glove over the hilt. This does not establish in-game QA approval.

Continuity: Idle keeps the existing 12 px / 4 px bob offsets. Attack and Death use only the existing discrete poses, with no interpolation or recentering. The helm/crest silhouette changes markedly through Death 01 → Death 02; review this authored pose change in the slow GIF. Swords disappear at Death 01 because the approved candidate has empty death sword layers, matching Azure. These transitions are exposed for review, not silently smoothed.

## Validation / changes

Both contact sheets and enlarged grip crops were visually inspected. All six GIFs were reopened, every decoded frame loaded, and decoded durations matched the declared timings. Full draw order, asset selection and source hashes are recorded. Complete output alpha bounds fit the canvas. The hair visibility defect was fixed in review composition only; no source artwork was changed; no r2-upload file, production manifest, runtime or candidate ZIP was modified.

This is offline review support only. No R2 publication, no new wing design, no in-game QA completion claim. Next: Project Lead reviews these GIFs and checks the regenerated files, then hands the approved conditional hair rule to DEV for runtime preview.

Rebuild from repository root:
`python docs/hero-v5-equipment-production/tools/full_composite_review.py`
