# Skeleton Equipment Visual Audit

Status: **graphics binding verified; no approved artwork changed**  
Scope: Combined Graphics Task, Package C  
Baseline: Ver 1.1.18 / main `63b95d0`

## Root cause

The reported Inventory capture is a mixed equipment loadout, not a complete Skeleton set. The active Hero V5 resolver binds visuals by equipped slot:

- Azure helmet -> Azure `helmet`
- Skeleton chest -> Skeleton `torso_armor`
- unsupported generic gloves and boots -> neutral Hero base remains visible
- Lavalon weapon -> Lavalon `sword`
- Angel wings -> wing template

`coverage_underlay` is intentionally enabled only when chest, gloves, and boots share the same supported family. Applying the full Skeleton composite when only Skeleton chest is equipped would misrepresent player equipment and violate the existing slot contract.

## Evidence

- Hero V5 is enabled by default; `?heroV5=0` is the explicit opt-out.
- The Skeleton bundle contains 8 frames x 7 layers = 56 PNGs.
- Every layer is RGBA 768x768 and matches `SOURCE_VALIDATION.json` SHA-256.
- A complete Skeleton loadout resolves all seven layers in approved draw order with no fallback.
- The captured mixed loadout resolves only Skeleton torso art; generic gloves/boots have no family artwork in the current manifest.

Automated evidence: `tests/skeleton-equipment-visual.test.js`.

## Change

No renderer architecture, gameplay rule, item stat, or artwork was changed. Stale publication metadata was corrected from `runtimeIntegrated:false` / `itemBinding:pending` to the verified runtime contract `runtimeIntegrated:true` / `itemBinding:setId:skeleton`.

## Follow-up boundary

If generic Helmet/Chest/Gloves/Boots need distinct visuals, that requires new approved equipment artwork (G16-G20 roadmap scope) and is not a missing Skeleton asset. No DEV renderer follow-up is required for the verified Skeleton family binding.

## Skeleton Idle_02–03 revision07 closure (Owner acceptance, 2026-10-29)

**Status: COMPLETE — Owner confirmed the corrected Skeleton equipment presentation is satisfactory on 2026-10-29.** This closure supersedes the historical no-artwork-change status at the top of this audit *for the scoped Skeleton Idle revision only*. The earlier mixed-loadout root-cause explanation remains useful historical evidence, not a current unresolved Skeleton visual blocker.

- Artwork review/evidence PR #180 and R2 publication PR #181 were merged. Publication baseline: `c3dd67bc2c679cce4319b4aaca2ab336508bb4a8`.
- Owner-approved revised layers for Idle_02/Idle_03: helmet, torso armor, arm rear, legs/boots (8 PNG total); Idle_01 revision07 remains unchanged. Base bob offsets: Idle_02 −12 px, Idle_03 −4 px.
- Publication evidence reported R2 upload/read-back SHA PASS for 10/10 objects (8 PNG + 2 metadata); this is asset-integrity evidence, not by itself a proof of browser rendering.
- Cache invalidation follow-up was committed in `c147ba46398a5321fa6e54ac6ac011c92b1e326b`. Later equipment mixed-pants rendering fixes reached frontend v1.1.34 (`a46e8595aa49933fc91dca076b5cb33bd4809394`), followed by R2 manifest sync `f6ba77ae8600bc7eb6e7f34a50f3be959338fa79`.
- **Acceptance authority:** Owner explicitly confirmed the visual fix is resolved. This is Owner acceptance, not an independently re-run browser PNG-decode/Phaser-texture automated QA report; do not describe unexecuted checks as PASS.
- **Scope boundary:** No new changes to Skeleton Attack/Death were approved in this closure. No additional artwork generation, R2 mutation, Worker, D1, player-data, or economy changes are part of this documentation update.

**Next:** Skeleton Idle visual correction is closed; keep standard regression monitoring. New Skeleton Attack/Death revisions require separate Owner approval.
