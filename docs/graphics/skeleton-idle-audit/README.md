# Skeleton Armor Idle 01-03 Visual Inspection

Status: **INSPECTION ONLY — NO ARTWORK CHANGE**

The three composites use the production Hero V5 base plus the seven Skeleton equipment layers in the
runtime draw order: `coverage_underlay`, `torso_armor`, `legs_boots`, `arm_rear`, `helmet`, `sword`,
`arm_front`. Wings and hair are excluded; the approved Skeleton helmet is full-face and suppresses hair.

- `SKELETON-IDLE-COMPOSITE.jpg`: complete armor composition for idle 01-03.
- `SKELETON-IDLE-LAYERS.jpg`: layers at their authored 768x768 alignment.
- `SKELETON-IDLE-LAYER-DETAILS.jpg`: alpha-trimmed close-ups for inspecting each part.
- `composites/*.png`: exact 768x768 transparent composites.

Observed asset characteristics: idle 01-03 contain all seven files and maintain consistent artwork across
poses. The helmet and sword dominate the silhouette, while torso and arm layers occupy much smaller authored
regions. This is present in the approved source artwork itself, not caused by a missing manifest entry or a
decode failure. Any proportion/redesign adjustment requires new Owner artwork approval.
