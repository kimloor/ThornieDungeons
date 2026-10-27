ThornieDungeons — G16 G3 Graphics Handoff
Status: G16 G3 BLOCKED — VISUAL DEVIATION REVIEW REQUIRED
Risk: MEDIUM
Baseline: 1372ed16327aeb7290b1bad0a9c2fa022b425335

Result: 21/56 PNG paths present (locked Idle_01 + new Idle_02/03); 35 Attack/Death paths remain missing, explicitly inventoried. Idle_01 bytes/composite preserved. Idle_02/03 use verified exact Base translations -12/-4; crops [0,481,768,42] and [0,489,768,42]. Canvas 768x768 RGBA; underlay transparent; alpha/dimensions/no-edge-clipping/SHA checks PASS. Actual merged resolver accepts the three idle crops/order/hair mode offline.

Evidence: docs/g16-leather-g2/g3/ — idle contact sheet/GIF/composites, rejected generated source, POSE_DRIFT_REVIEW.png, IDLE_METADATA.json, VALIDATION.json and SHA256SUMS.

Blocker: generated Attack/Death source changes anatomy placement and helmet/shoulder details. Stopped affected frame production per explicit task review boundary. No accepted source exists for per-frame crops or final extraction. No Attack/Death previews or G4 readiness claimed.

Next: Project Lead/Owner review POSE_DRIFT_REVIEW.png and README.md; authorize a source-repair approach preserving Base and approved design (proposed bounded full-size per-pose edits or approved editable rig/paintover source). Then finish five poses/35 PNGs, crops, all animation previews and G4 handoff. Do not approve current generated candidates as final exports.

Publication boundary respected: no R2, live manifest, runtime, deploy, gameplay/economy, Worker/API/D1, Base/Azure/Skeleton changes. Production NOT TESTED. Branch art/g16-g3-leather-frames; draft PR contains review hold, not completion.
