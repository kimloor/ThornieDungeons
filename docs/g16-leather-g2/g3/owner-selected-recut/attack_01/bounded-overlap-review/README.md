# Attack_01 — bounded overlap experiment

Status: **OWNER VISUAL REVIEW PENDING / NOT ACCEPTED / NOT RUNTIME READY**. Risk MEDIUM. Latest main rechecked `7ef31753b969386d2750857dddaa53d44c03081c`; branch checkpoint `9ab7d5e9f62942c273edceb4142a4432348bf8b4`. Reused Gate 0: Base, manifest and runtime bytes match latest main. No new generation.

## Review

- `ORDER_AND_MASK_COMPARISON.png`: previous exact Azure anatomical order; same order with explicitly disclosed offline visibility masks; actual merged Leather resolver fixture with complete unmasked exports and a proposed pose-specific glove crop.
- `DETAILS.png`: proportional before/after crops of helmet, both shoulders, waist, extended wrist and sword grip. Detail enlargement only; exports retain 768×768 origin (0,0).
- `BASE_SOURCE_OVERLAY.png`: unchanged Base, uniform whole-canvas Owner-source normalization, and cyan Base overlay. This does not certify anatomical fit.
- `REVIEW.png` / `reassembled.png`: offline masked experiment, NOT the production runtime result.
- `RESOLVED_LAYERS.json`: actual canonical resolver execution against manifest-selected Azure and a separate hypothetical Leather fixture. Neither live manifest nor runtime was modified.

## Changes and preservation

All seven `exports/` byte streams are identical to azure-order-correction; helmet remains at the latest -16px X total placement, legs retain +10px X, and the complete independent sword retains its previous registered transform. Approved Idle_01 and validated Idle_02/03 remain untouched, including all hidden insertion material.

Three grayscale `review_masks/` apply a torso-alpha complement only in bounded upper-sleeve/waist windows. The offline compositor multiplies affected layer alpha by that visibility mask and retains its RGB. No torso-last redraw is used. This makes 2061 raised-arm, 904 extended-arm and 1037 trouser alpha pixels less visible. Full insertion pixels remain in exports; masks are review evidence only, not new supported runtime metadata or accepted exports. The result follows Azure anatomical ordering with additional masking; it must never be labeled unmodified Azure ordering or runtime-compatible.

The waist skirt and shoulder plates become visible again, but the raised shoulder exposes an armhole/ring and its attachment still looks unresolved. This is an experiment, not a successful seam repair. Do not discard insertion caps or publish cut-down exports from it.

## Runtime and hand limitation

Merged leather_overlap_v1 is separately executed: Base → underlay → legs → arm_rear → arm_front → torso → helmet → sword → right_hand_occlusion. This is intentionally different from Azure anatomical ordering. The fixture retains original Leather filenames; no slot mapping changes.

Proposed Attack_01 crop `[278,282,65,58]` is a glove-region experiment from Leather arm_rear, not the Idle crop. `proposed_hand_occlusion.png` and the third comparison panel show its actual pixels. It does not fully resolve helmet overlap over the raised bracer/forearm outside that rectangle. Do not widen the crop to redraw the whole arm or change architecture without reporting the concrete issue to Owner/Project Lead. Crop acceptance and anatomical right-hand grip acceptance remain pending.

Next decision: inspect shoulder-ring treatment and helmet/bracer overlap. A successful source-boundary repair compatible with current runtime is preferred; if preserving the desired Azure-like sleeve-over-helmet relationship requires a larger occlusion pass/order change, return that issue to Project Lead before implementation. No automatic promotion of this review experiment.

## Reproduce and checks

From repository root: `python docs/g16-leather-g2/g3/owner-selected-recut/attack_01/bounded-overlap-review/build.py` (Pillow, NumPy, Node). It executes `resolve.cjs`, verifies latest-main reference byte identity and all protected Idle exports, then writes previews, JSON and hashes. Check `SHA256SUMS` from this folder. No frontend build is needed: application source is unchanged.

No Base/Azure/Skeleton, runtime/profile/slot, R2, production manifest, gameplay, Worker/API/D1 or deploy changes. No other Attack/Death frame started; no final inventory promotion; G3 incomplete, G4 not ready.
