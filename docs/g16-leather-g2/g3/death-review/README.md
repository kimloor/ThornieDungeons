# G16 Death_01 — focused visual hold

Status: **G16 G3 DEATH_01 VISUAL HOLD — MATERIAL REGISTRATION DEFECTS** (2026-10-28).
Risk MEDIUM. Existing Draft PR #160, branch `art/g16-g3-leather-frames`, parent `bd25be1f4e252856be8d0e85dbe12ea8ec5e46ca`.

The assignment explicitly requires stopping with a focused visual review when canonical pose or approved Leather design cannot be preserved satisfactorily. The seven-layer Death_01 prototype exists, but its material registration does not pass Graphics review. **Death_02 is not started. G3 is not complete; G4 is not ready.** Do not promote these prototype exports to a final inventory.

## Review evidence

- `DEATH_01_COMPARISON.png`: unchanged canonical Base, current-main Azure reference and actual Leather seven-file reassembly, identical source canvas/crop/scale.
- `FOCUSED_VISUAL_REVIEW.png`: wrists, boots and neckline; material stretching/edge flattening remains visible.
- `SEVEN_PARTS.png`: all seven isolated prototype paths. Underlay and sword are intentionally transparent.
- `qa/leather_runtime_no_weapon.png`: manual profile-order study (Base → legs → right arm → left arm → chest → helmet; empty underlay/sword omitted). This is **not a runtime renderer test or compatibility PASS**.
- `qa/authoring.png`: separate Attack-style authoring-order comparison; not the selected Death review image. Complete-arm-after-torso ordering hides the near pauldron, so it is not assumed suitable for this pose.
- `masters/`: three bounded isolated-part ImageGen donors, supplied pose/design inputs and canonical admission masks. No generated whole Hero or generated face/body is admitted.
- `build.py`, `PLACEMENT.json`, `DONOR_ADMISSION.json`, `VALIDATION.json`, `SHA256SUMS`: reproducible reconstruction, placements and technical evidence.

## Preflight and construction

Latest main inspected: `614d8e363efa074d257319f3e3578a56196c2a06` (main manifest sync). Read current main AGENTS.md and runtime contract, Master Template and Pipeline §§4B–4D, approved G2 Idle and current Attack rear-torso evidence. AGENTS, all canonical Base files and runtime contract are unchanged between this task branch and main; Gate 0 is reused. Main has no G16 production family selection. Current-main Azure Death paths are selected through its manifest; selected file hashes are in VALIDATION.json. No merge from main was necessary for this isolated study.

Death_01 exposes the front torso, reclining backward, with an open anatomical right hand. Helmet and front chest start from approved Idle isolated equipment, fitted with clothing-only TPS using recorded approximate visual guides. Base is neither remapped nor repainted. Three ImageGen edits supply only isolated leg/sleeve/glove material; their RGB is admitted within per-part canonical Base alpha masks. Donor geometry is rejected. Missing donor material is extended from interior RGB; final narrow contour is reconstructed on the canonical part boundary. Original Base face/expression stays the actual original pixels wherever visible. Chest owns its bounded shirt/armhole coverage; underlay stays empty.

This preserves canonical part locations, but **does not prove acceptable equipment fit**. The mismatch between donor placement and canonical contours causes stretched/flattened material at the right wrist, thumb/fingers and boot edges. Bracer/knee/shin shading and band details are sharper/different from the approved material. Chest insertion and helmet/neckline clearance also need visual acceptance. These are artwork defects/review points, separate from Base byte preservation. Do not treat successful PNG decoding as visual acceptance, or use a larger silhouette to conceal the mismatch.

## Scoped QA and remaining work

Seven PNG paths are 768×768 RGBA, origin [0,0], with no nonzero canvas-edge alpha. Underlay emptyReason: `Owner: coverage belongs to each equipment piece; no shared underlay artwork`. Sword emptyReason: `Death pose releases weapon; Azure Death contract has no required grip and transparent sword.` No eighth equipment export exists. Runtime Y=84 is not baked.

57 protected PNGs remain byte-identical: eight canonical Bases, 28 G2/G3 Idle checkpoints, and all 21 approved current Attack exports, including both corrected rear torsos. No Base/Azure/Skeleton, production manifest, runtime, gameplay, API/Worker/D1, R2 or deployment change. No frontend build is required because no application source changed.

Inventory is **42 established Idle/Attack paths + 7 unaccepted Death_01 prototype paths + 7 unstarted Death_02 paths**, not 56 accepted paths. Final 8-frame reconciliation/contact sheets/animations and full-set QA remain pending accepted Death artwork. Prior Attack runtime hand crops remain unresolved; do not copy Idle crop metadata. Death_01 has an empty sword, so weapon-hand occlusion is not required for this prototype; this is recorded in HAND_OCCLUSION.json. Death_02 metadata remains unassigned.

Next: Project Lead/Owner reviews the focused material/fit evidence. Revise/register only Death_01 isolated equipment, preserve original canonical anatomy and approved Attack bytes; obtain Death_01 material/pose acceptance before Death_02 construction. Do not merge, publish R2, integrate a production manifest or deploy.

Reproduce from repo root: `python docs/g16-leather-g2/g3/death-review/build.py` (Pillow, NumPy, SciPy). Verify this package with `sha256sum -c SHA256SUMS` from its directory.
