# G16 Leather — Idle_01 approved G2 review evidence

Current status: **G16 G2 — OWNER VISUAL APPROVED / DEV COMPATIBILITY PENDING** (2026-10-27).

This folder archives the latest overlap-completed artwork approved by the Owner, together with the original review package. It is review evidence, not production-ready runtime integration or R2 staging.

## Review entry points

- [Approved asset sheet](G16_OVERLAP_COMPLETION_ASSET_SHEET.png)
- [Original complete review ZIP](G16_OVERLAP_COMPLETION_REVIEW.zip)
- [Assembled authoring preview](qa/reassembled_preview.png)
- [Current runtime contract order comparison](qa/current_contract_order.png)
- [Order comparison sheet](qa/ORDER_COMPARISON.png)
- [Seven full-canvas equipment exports](exports/idle_01/)
- [Original validation measurements](VALIDATION.json)
- [Original review notes](REVIEW.md)
- [SHA-256 file inventory](SHA256SUMS)

The original ZIP, images, REVIEW.md and VALIDATION.json are preserved byte-for-byte. Their pending-review wording records the state when they were submitted; the Owner subsequently approved the artwork. This README and [Pipeline section 4B](../EQUIPMENT-SPRITE-PIPELINE-V1.md#4b-approved-cutting-and-hidden-overlap-completion-method--g16-idle_01-2026-10-27) record the current approval. The original scripts are archived as authoring provenance; they refer to temporary source paths and are not a standalone reproducible build.

## Scope and remaining gates

Approval covers the revised Idle_01 artwork, hidden-overlap completion and assembled visual preview only. The seven exports are 768×768 RGBA at origin (0,0); coverage_underlay is intentionally transparent because coverage belongs to each equipment piece.

The approved authoring preview uses:

`Base → legs_boots → arm_rear → arm_front → torso_armor → helmet → sword → copied right-hand occlusion pixels`

This differs from current runtime order. The historical filename `qa/idle_01_exact_order.png` is an alias of the proposed authoring preview; it must not be interpreted as proof of current-runtime compatibility. Use `qa/current_contract_order.png` for the current-contract comparison.

Project Lead should assign DEV to resolve layer ordering, right-hand weapon occlusion and helmet hair suppression, with backward compatibility for existing equipment, before frame expansion/integration. The separately reported Gate 0 SHA-256 ledger discrepancy must be reconciled before publication. No remaining frames, runtime changes, manifest changes, R2 uploads or Production PASS are included in this archive.

Risk of this archival change: **LOW**. Checks: source-to-archive byte comparison, ZIP integrity, seven export hashes/dimensions/RGBA and empty underlay; no gameplay/source change or build required.
