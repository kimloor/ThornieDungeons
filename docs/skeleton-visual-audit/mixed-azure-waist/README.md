# Mixed Azure boots / Skeleton body — 1.1.34

Owner evidence: IMG_9304.png on 1.1.33. Exact visual selection: Azure helmet and
boots, Skeleton chest and gloves, Leather sword. The prior bare-hand issue was a
separate case; image revision did not fix this case.

Root cause confirmed from actual PNG alpha and exact runtime reassembly:
Azure idle legs_boots starts at y=522/510/518, while its upper trouser panels are
part of Azure torso_armor. Skeleton torso does not supply those panels. Neutral
Base trousers remain visible between the two independently selected slots.
There is no right_hand_occlusion in this equipped-glove case.

Correction: for Azure boots with a non-Azure or absent chest, insert legs_waist
behind the equipped chest. Reuse the existing approved Azure torso PNG with
crop [0,490,768,32] / [0,478,768,32] / [0,486,768,32]. These crops contain only
the lower trouser panels; there is no full Azure chest/underlay substitution.
No PNG source edits, no new artwork, no R2/manifest changes. Full Azure and
Leather composition, other boots, and Attack/Death remain unchanged.

BEFORE_AFTER.jpg uses all three actual runtime idle layer arrays: before on top,
after below. The new regression reproduces a gray Base pixel at (350,500), with
matching idle bob offsets, and verifies replacement by the approved Azure panel
through the Inventory snapshot. Optional waist/boot load failure removes both
pieces together. Targeted tests: 107/107; node build.js and git diff --check PASS.

Status: Production publication followed by Owner device visual acceptance.
