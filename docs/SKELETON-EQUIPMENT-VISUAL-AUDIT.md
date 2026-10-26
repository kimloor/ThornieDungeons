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
