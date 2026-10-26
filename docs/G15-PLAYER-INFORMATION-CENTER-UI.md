# G15 Player Information Center UI Pack

Issue: #152

Baseline: Ver 1.1.18 / `63b95d0e5025cfce5458f99b34341972cc3fda0d`

Risk: MEDIUM — player-visible artwork and later optional UI integration; no backend or gameplay authority

Status: **OWNER APPROVED / R2 STAGED / RUNTIME INTEGRATED — PRODUCTION PENDING**

## Delivery state

| Gate | State | Evidence |
| --- | --- | --- |
| Artwork Candidate | PASS — 6/6 | `docs/graphics/g15/*.png` and `PREVIEW.jpg` |
| Owner Approved | PASS | Owner approval received for all six candidates |
| R2 Staged | PASS — 6/6 | `r2-upload/ui/info-center/` and additive `assets.infoCenterUi` |
| R2 Published | PENDING MERGE | Upload/download SHA workflow runs only after the approved merge gate |
| Runtime Integrated | PASS (branch) | Shared optional resolver, fixed-size images and emoji fallback |
| Production Verified | NOT STARTED | Blocked on approval, integration and deploy |

## Candidate contract

| Meaning | Candidate | Proposed manifest key | Proposed R2 path |
| --- | --- | --- | --- |
| Announcements | `announcements.png` | `infoCenterUi.announcements` | `ui/info-center/announcements.png` |
| Game Guide | `guide.png` | `infoCenterUi.guide` | `ui/info-center/guide.png` |
| Terms of Service | `terms.png` | `infoCenterUi.terms` | `ui/info-center/terms.png` |
| Privacy Policy | `privacy.png` | `infoCenterUi.privacy` | `ui/info-center/privacy.png` |
| Fair Play | `fairplay.png` | `infoCenterUi.fairplay` | `ui/info-center/fairplay.png` |
| Purchase / Refund Policy | `purchase.png` | `infoCenterUi.purchase` | `ui/info-center/purchase.png` |

All candidates are 128×128 RGBA PNG, contain real alpha, retain at least 12 px transparent
padding, and are below the 60 KB target. They use a shared dark-fantasy purple/gold finish,
strong silhouettes and no embedded text. The Purchase icon contains no currency sign, coin,
gem, card, cart or price tag and does not imply that real-money checkout is enabled.

![G15 icon candidates on dark and light backgrounds at 24/32/40 px](graphics/g15/PREVIEW.jpg)

## Review and publication boundary

The six approved review files remain as immutable evidence in `docs/graphics/g15/`; identical
optimized bytes are staged for R2. Approval authorizes publication but does not itself prove
the post-merge R2 workflow, deployment or Production acceptance.

Implementation on PR #153:

1. Copied only approved optimized icons to `r2-upload/ui/info-center/`.
2. Added `assets.infoCenterUi` to the R2 manifest without changing existing groups.
3. Uses the shared optional manifest resolver and preserves current emoji fallback for missing
   keys and image load errors, with no retry loop or layout shift.
4. Navigation, deep links, scrolling, NEW badge and roadmap status text remain runtime-owned.
5. Focused and full regression, build/generated-file checks, responsive browser QA,
   R2 SHA validation, deployment and live decode verification.

## Known limitations at this gate

- Static preview QA is complete; browser runtime/responsive behavior is not yet exercised.
- Live R2 upload/hash and Production decode remain pending the merge/release gate.
- Browser responsive evidence is recorded with the combined-task QA after Packages B/C settle.
