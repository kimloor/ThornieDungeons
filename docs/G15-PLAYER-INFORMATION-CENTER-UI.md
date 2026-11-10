# G15 Player Information Center UI Pack

Issue: #152

Baseline: Ver 1.1.18 / `63b95d0e5025cfce5458f99b34341972cc3fda0d`

Release target: Ver 1.1.19

Risk: MEDIUM — player-visible artwork and later optional UI integration; no backend or gameplay authority

Status: **DONE / PRODUCTION VERIFIED**

## Delivery state

| Gate | State | Evidence |
| --- | --- | --- |
| Artwork Candidate | PASS — 6/6 | `docs/graphics/g15/*.png` and `PREVIEW.jpg` |
| Owner Approved | PASS | Owner approval received for all six candidates |
| R2 Staged | PASS — 6/6 | `r2-upload/ui/info-center/` and additive `assets.infoCenterUi` |
| R2 Published | PASS — 6/6 | Run #40333086818 uploaded, downloaded and SHA-verified every icon |
| Runtime Integrated | PASS | Shared optional resolver, fixed-size images and emoji fallback |
| Production Verified | PASS — 6/6 | Live files decoded as 128x128 RGBA and matched recorded SHA-256 on 2026-10-27 |

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

## Production evidence and limitation

- PR #153 merged as `2ceb79ea2aa6d029376698070cc7ff0b9ddf827f`.
- R2 upload/read-back verification: run #40333086818, 11/11 changed objects overall.
- Frontend Production deployment and endpoint smoke check: run #40333086817, Worker version
  `193f6e7b-4e4d-427a-ad31-033f3a211175`.
- Focused combined tests passed 48/48; full Node regression passed 823/823; build and
  generated-output integrity passed.
- Static 360/390/1280 composition and responsive contracts passed. An authenticated,
  interactive Production session was not available for a manual in-game transition capture.
