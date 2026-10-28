# Issues #166 / #167 — DEV QA Evidence

Baseline: `5edd72e0e9ff2eb3445ef38bee349fa35dbdf52d`

## Issue #166

- `sword-bare-arm-before-after.png` is an exact 768×768 layer composite using the approved Base and Leather sword bytes. The After side adds only the runtime Base hand crop.
- `canvas-fixture.html` exercises the real Phaser 3.90 Canvas renderer and the production `HeroRenderer` / `HeroV5RuntimeContract` from this branch.
- Fixture query: `?mode=before|after&state=idle|attack|death&frame=0|1|2`.
- Covered: gloves on/off, sword on/off, Idle 01–03, Attack 01–03, Death 01–02, partial/mixed equipment, Azure/Robot/Skeleton legacy ordering, crop propagation, and renderer layer reuse.
- Approved G16 PNG count and bytes remain unchanged.

## Issue #167

Normal-motion exit phases are intentionally sequential:

1. `opening` — 900 ms
2. `open` — 1,000 ms (timer starts only after opening completes)
3. `fading` — 180 ms
4. overlay removal

Reduced motion skips the opening/fade animation, shows the fully-open frame for 1,000 ms, then retains the existing 120 ms exit cleanup window.

Covered: normal/fast/slow authority release, repeated visibility, 360/390/1280 CSS layouts, reduced motion, missing-asset immediate fallback, timer cleanup, one overlay owner, and no hold on unrelated failure paths.

## Automated results

- Issue #166 targeted suite: 46/46 passed.
- Issue #167 targeted suite: 14/14 passed.
- Full repository regression: 918/918 passed.
- Generated build syntax: 2/2 passed.
- `node build.js`: passed.
- `git diff --check`: passed.
