# Attack_01 — finished neckline candidate

Status: **NECKLINE REFINEMENT CANDIDATE / OWNER VISUAL REVIEW PENDING**. Risk MEDIUM, bounded art edit only. Main checked 7ef31753b969386d2750857dddaa53d44c03081c; branch parent 0a6aaa407edcd1815dd3440bbaae731099e040dd. Mandatory Master/Pipeline read and unchanged Gate 0 sources reused.

The Owner approved front-to-back stacking: anatomical right raised arm → complete sword → helmet → chest → anatomical left extended arm → trousers/boots → Base. This order is retained; the Owner then authorized finishing the neckline prototype.

## Result

The tall hollow collar has been opened to reveal the original Base neck. A narrow continuous leather/gold rim replaces the raw cut. The small white Base-shirt triangle at the right neck edge is covered by fitting only the garment rim. REVIEW.png and reassembled.png are assembled from the actual seven candidate exports. NECK_DETAIL.png shows the actual join enlarged. NECK_COMPARISON.png shows original high collar → raw trial → refined candidate.

Built-in ImageGen produced a transparent isolated-chest donor. Only the bounded neck region is admitted to the existing trial chest; the rest of its regenerated armor is NOT used. The candidate chest differs from the original chest at 3291 pixels within [326,388,395,450), with every pixel outside [324,388,397,450) unchanged. The other six export byte streams remain identical. No face/head/neck/limb anatomy is generated or relocated; the visible neck and chin shadow are from the unchanged Base.

The donor was uniformly normalized from 1280×1280 to the original 256×256 review crop footprint and placed at [256,352]. A feathered local replacement and a small garment-only right-rim fitting are recorded in build.py/VALIDATION.json. This is offline chest authoring; no runtime transform or Y=84 is baked into assets. There is no extra hand or torso pass. No shared underlay artwork was added.

## Acceptance and limits

Owner has accepted the stacking order, not this finished neckline or the whole Attack_01 artwork yet. No final 56-path promotion, G3 completion or G4 readiness is claimed. The original isolated masters and all old checkpoints remain intact. Remaining Attack/Death poses await prototype acceptance.

The existing white Base shirt under the raised armpit is outside this neck repair and unchanged; do not claim all body-coverage issues are resolved. The offline Owner order still differs from merged leather_overlap_v1; no runtime/profile/slot mapping changed or integration approval inferred. No Base/Azure/Skeleton/Idle artwork, R2/production manifest/deploy, gameplay, API/Worker/D1 changes.

## Checks and reproduction

`python docs/g16-leather-g2/g3/owner-selected-recut/attack_01/neckline-refinement-review/build.py` from repository root (Pillow, NumPy, SciPy). It verifies 7 fixed-canvas 768×768 RGBA exports/origin0, clean alpha canvas edges, intentional empty underlay, six preserved export hashes, 28 protected Idle PNGs, unchanged canonical Base/manifest/runtime and bounded chest changes. SHA256SUMS verifies this checkpoint. No frontend build required because no application source changed.

The generated donor is in masters/generated_neckline_donor.png. Prompt and input provenance are in PROMPT.md. Source skin is not included in the isolated equipment export. Final visual acceptance belongs to Owner.
