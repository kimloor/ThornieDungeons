# Azure vs Leather — Attack_01/02/03 comparison

**Subsequent Owner correction:** all three attack poses are confirmed to match. The earlier Graphics contour-based inference below is superseded. The outstanding issue was front/back torso surface identity. See [current rear-torso correction](../../attack-back-torso-review/README.md) and Pipeline §4D; do not treat the old inference as an active pose blocker.

Read-only QA evidence. Main checked 7ef31753b969386d2750857dddaa53d44c03081c; task branch parent 0f3c9ad90f1af45f0d2148efd228e5ce0712b933. Risk LOW. No equipment source, placement or runtime modification.

AZURE_LEATHER_ATTACK_COMPARISON.png: each row is Attack_01, Attack_02, Attack_03; Azure left, current Leather candidate right. Every source stays on its original 768×768 canvas at [0,0]. Both columns use exactly the same review crop [70,120,768,720] and scale 1; no bbox fitting, limb shifting, recentering or per-set scaling. Wings are disabled for both; Azure helmet suppresses hair. The common runtime Y=84 presentation offset is not baked into either image.

Azure is reassembled from current manifest-selected paths through actual heroV5FrameLayers resolution. Leather is reassembled from the 21 candidate exports with the Owner-specified anatomical order, and asserted pixel-identical to the published candidate composites. AZURE_RESOLVED_LAYERS.json and VALIDATION.json record the exact paths and source SHA-256. All selected Azure PNG bytes are checked against latest main.

Visual reading (inference from the comparison, not a measured joint-match certificate):
- Attack_01: same raised sword arm, opposite arm forward and bent-leg action. Leather sleeve/elbow and knee silhouettes are not identical to Azure.
- Attack_02: same forward sword-arm extension and up-right blade direction. Leather upper/forearm and fist contours differ; elbow/wrist fit still needs visual review.
- Attack_03: same downward-right follow-through. Forearm/wrist and lower-leg silhouettes remain visibly different; some difference comes from the armor and boot design, so silhouette mismatch must not automatically be described as moved Base anatomy.

Conclusion: the broad actions correspond, but exact pose/fit equivalence is NOT established. Both use the same canonical Base per frame; that fact alone does not guarantee that their independently cut/deformed equipment follows every visible contour equally. Azure's much larger enclosing helmet, shoulder volume and broad sword also change the apparent gesture. No numeric anatomical accuracy or Owner acceptance is inferred.

Reproduce: python docs/g16-leather-g2/g3/attack-review-pack-v1/azure-comparison/build.py from repository root. SHA256SUMS is local to this folder. No runtime/source build or production test is applicable.

Project Lead handoff: PR #160 includes a same-scale Azure/Leather three-attack comparison. Broad action agrees; equipment elbow/wrist/leg contour fit remains Owner visual review. No asset correction or acceptance is made in this inspection-only checkpoint. G3 remains incomplete.
