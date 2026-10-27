# ThornieDungeons — Equipment Sprite Pipeline V1
Status: **OWNER APPROVED — DESIGN CONTRACT ONLY** (2026-10-27)
Scope: Hero V5 G2 modular wearable equipment art; no implementation, asset regeneration, R2 upload, gameplay or runtime change in this document commit.
Approved decisions: **HYBRID / AZURE-REFERENCE / FULL-SET-FIRST / G16 BEFORE SKELETON / WEAPON-FREE HERO + SEPARATE COMPLETE WEAPON**.

## 1. Purpose and boundaries
Use one repeatable production template for G16 Beginner/Leather, the subsequent Skeleton visual revision, and G17–G20. Keep Hero anatomy/pose and existing runtime slot ownership locked while allowing controlled outer silhouettes (helmets, shoulders, gauntlets, boots and weapons). Do not treat a mixed-equipped Inventory appearance as missing Skeleton art. Current runtime renders independently owned equipment slots.

## 2. Existing source of truth (verified on main e87e043ff9fdb20c4d8a4f9871af4b36b97fa598)
- `src/phaser/presentation/HeroV5RuntimeContract.js`: hero001/v5/g2, canvas 768×768, runtimeOffsetY=84, idle_01–03 / attack_01–03 / death_01–02, exact seven-layer draw order.
- `r2-upload/hero/v5/g2/equipment/azure/AZURE_FRAME_CONTRACT.json`: approved base/wing references, locked origin [0,0], per-frame paths, composites, source authoring and attack weapon grips.
- `r2-upload/hero/v5/g2/equipment/azure/SOURCE_VALIDATION.json`: existing PNG alpha, bbox, SHA and full-composite checks. Historical flags in this file are audit-time snapshots, not current live publication authority.
- `r2-upload/hero/v5/g2/equipment/azure/IDLE_SWORD_RUNTIME_PATCH.json`: baked offline transforms and idle grip coordinates.
- `r2-upload/manifest.json`: production asset path/binding model, `hair.topknot` front/back frame paths, approved Azure helmet metadata.
- `docs/SKELETON-EQUIPMENT-VISUAL-AUDIT.md`: mixed equipment explains the earlier screenshot; Skeleton frame files exist, artwork revisions deferred.
No invented whole-body anchor coordinates: derive head, shoulders, wrists, waist, knees and feet from the **actual approved per-frame Hero Base references** when authoring the template. Preserve reference hashes.

### Known Azure grip reference — coordinates in 768×768 space
| Frame | Grip X,Y | Evidence |
| --- | --- | --- |
| idle_01 | 270,505 | IDLE_SWORD_RUNTIME_PATCH targetGrip |
| idle_02 | 270,493 | IDLE_SWORD_RUNTIME_PATCH targetGrip |
| idle_03 | 270,501 | IDLE_SWORD_RUNTIME_PATCH targetGrip |
| attack_01 | 310,309 | AZURE_FRAME_CONTRACT weapon_grip |
| attack_02 | 489,448 | AZURE_FRAME_CONTRACT weapon_grip |
| attack_03 | 413,551 | AZURE_FRAME_CONTRACT weapon_grip |
| death_01/02 | null | No weapon grip required in Azure original contract |

Azure source metadata includes earlier transparent Idle sword exports; current manifest points to later versioned baked Idle sword assets. **Use the live manifest as the authoritative asset selection and the historical contract as anchor provenance.** Do not silently republish historical placeholders.

## 3. Technical template
- Exactly eight frame IDs and seven equipment layer **paths** per frame (56 exported RGBA PNG files); 768×768, fixed canvas origin [0,0], transparent background. Intentional fully transparent layers (e.g. weapon pose) are permitted only with explicit `emptyReason`; completeness means declared/decodable, not necessarily visible pixels.
- Layer order stays `coverage_underlay, torso_armor, legs_boots, arm_rear, helmet, sword, arm_front`. Composite draw order: `wing_far, base, hair_back, hair_front, coverage_underlay, torso_armor, legs_boots, arm_rear, helmet, sword, arm_front, wing_near`, subject to helmet/hair rule below.
- No auto-trimmed or re-centered layer export; no per-frame runtime translation/rotation/interpolation to compensate for misaligned art. Runtime Y offset 84 is applied by existing code and must not be baked into the PNG.
- Derive source anchors and safe silhouette envelopes **per frame** from locked Hero Base and existing Azure review composites. Allow armor extensions outside body geometry within canvas/screen-safe bounds while preserving helmet-to-head, shoulder-to-torso, glove-to-wrist, boot-to-ground, and sword-grip alignment. Numerical envelopes require measured QA evidence during G16 pilot, not guessed thresholds.
- Owner-approved new equipment authoring policy (2026-10-27): **no shared coverage artwork**. Each equipment piece owns its own seam/edge coverage. Retain the declared `coverage_underlay` path as a fully transparent PNG with `emptyReason: "Owner: coverage belongs to each equipment piece; no shared underlay artwork"`. Existing Azure/Robot/Skeleton artwork and runtime conditional underlay behavior are unchanged by this authoring rule.
- Maintain slot ownership: helmet→helmet, chest→torso_armor, gloves→arm_rear + arm_front, boots→legs_boots, weapon→sword. Accessories remain item icons without Hero wearable layers unless separately approved.

## 4. Helmet / hair art contract (Owner approved design)
- **Full-cover helmet:** helmet art fully occludes default hair; hair_back and hair_front both suppressed.
- **Open-face / partial helmet, crown or circlet:** **bake the approved default hairstyle together with the helmet into the exported `helmet` artwork, on every frame**, and suppress default hair layers while that helmet is worn. Avoid double-hair, bald gaps or obvious hair-helmet seams.
- **No helmet:** show the separate default hair_back and hair_front layers as normal.
- Existing runtime currently suppresses hair when `fullFaceHelmet===true`. This is insufficient as a semantic label for an *open* helmet with baked hair. **DEV compatibility gate required before publication**: propose explicit `hairMode` values such as `hidden_full_cover`, `baked_into_helmet`, `default` and validate backwards compatibility with already approved Azure/Robot/Skeleton. Do not misuse `fullFaceHelmet` metadata or change renderer behavior in this design-only task.
- Bake hair using the currently approved default (topknot) for each pose; if selectable hairstyles are introduced later, a new visual variant contract is needed.
- Owner-approved G16 full leather helmet covers the entire hair/crown/back/ears while leaving the face open: **no hair artwork is required inside that helmet**. Hair coverage and face coverage are separate concepts. DEV must approve appropriate hair-suppression metadata before publication; do not relabel an open face as `fullFaceHelmet` merely to suppress hair. The baked-topknot rule above applies to helmets that actually leave hair visible.

## 4A. Owner-approved production method — weapon-free Hero and separate weapon (2026-10-27)

This is the reusable authoring workflow approved after G16 prototype review. It does not approve all-frame art, runtime changes or R2 publication. Existing Gate 0 source locks and G1/G2 Owner gates remain in force.

1. **Preflight:** read this Pipeline and the Master Template; check latest main, actual per-frame Base, manifest selections and runtime contract. Reuse Gate 0 when relevant sources are unchanged; do not recreate it.
2. **Concept:** show one coherent full set, including helmet/hair treatment, gloves, trousers/boots, weapon and matching icon-only Accessory. Obtain Owner visual approval before production.
3. **Weapon-free dressed Hero:** use the actual Hero Base frame as the pose/anatomy reference. Generate the approved equipment over it with an empty hand in the intended gripping pose. No weapon may obscure trousers, knees, boots, gloves or other equipment. Preserve framing, body proportions and anatomical placement.
4. **Base comparison:** normalize the full canvas once if needed; overlay the original Base at 50% opacity without shifting individual body parts to conceal differences. Inspect face, shoulders, elbows, hands, waist, knees and feet. Equipment silhouette extensions are permitted; anatomical relocation or distortion is a separate issue and must be reviewed rather than counted as an extension. Do not claim invisible joint coordinates or pixel-perfect alignment from a visual overlay.
5. **Complete separate weapon:** generate the approved weapon independently, including the whole blade, guard, grip and pommel. No hand/body pixels or source-occluded missing grip. Preserve the approved design, scale and orientation.
6. **Register the grip:** scale the complete weapon uniformly and place it into the intended hand. G16 uses the anatomical right hand (image-left in Idle_01). Compare the same weapon layer on both dressed Hero and original Base. Record source dimensions, scale, rotation, translation and resulting frame coordinates. Bake approved offline authoring placement into the full 768x768 export; do not add runtime offsets to compensate for misalignment.
7. **Sequential extraction and cleanup:** cut one equipment piece, inspect it enlarged and on transparent/contrasting backgrounds, then clean it before starting the next. Remove unrelated equipment, skin, stray pixels and damaged edges. Keep deliberate slot boundaries and equipment-owned seam coverage. Use the weapon-free Hero for trousers and arms so weapon-stripe reconstruction is unnecessary. Final exports retain the full fixed canvas/origin; cropped/enlarged detail views are review-only.
8. **Hand/weapon occlusion:** always retain a complete weapon master. Authoring review may compose `Hero → weapon → glove/finger occlusion pixels`, with the hand pixels copied from the weapon-free source at unchanged coordinates. This is an authoring preview, **not authorization for an extra runtime layer or changed draw order**. DEV must approve/backward-test any required runtime change, or an explicitly approved compatible pose export, before publication. Report any incomplete/occluded runtime weapon variant separately from the complete master.
9. **Reassemble actual cut files:** use the original Base, the exported equipment files and exact contract order. Check neck/shoulder/waist/wrist/knee/ankle seams, hair suppression, weapon grip, unexpected exposed Base, and silhouette at enlarged and actual gameplay size. A separately generated dressed image alone is not evidence that exported layers fit.
10. **G2 review package:** provide seven declared 768x768 RGBA paths (empty underlay included), enlarged per-piece asset sheet, actual reassembly, Base/source comparisons, weapon registration and occlusion evidence, hashes/alpha/dimension checks, cleanup notes and limitations. Obtain separate Owner visual approval before expanding frames.
11. **Remaining gates:** after G2 approval, produce remaining Idle/Attack/Death frames with per-pose references, then G4 visual/animation QA, G5 automated/runtime regression and fallback checks, and G6 approved R2/manifest publication with live production evidence. Full Set First remains the visual coverage policy; exhaustive mixed-set illustration is not required.

Prototype approval is not a Production PASS. Do not repeat generation blindly when it changes anatomy; show the comparison and resolve the affected source/fit before claiming acceptance. No automatic approval is inferred from an image-generation result or successful PNG decoding.

## 4B. Approved cutting and hidden-overlap completion method — G16 Idle_01 (2026-10-27)

**Owner visual result: G16 G2 — OWNER VISUAL APPROVED.** The Owner approved the latest overlap-completed asset sheet on 2026-10-27. Evidence: `G16_OVERLAP_COMPLETION_ASSET_SHEET.png` and `G16_OVERLAP_COMPLETION_REVIEW.zip`, delivered for review. This approval applies to the revised Idle_01 artwork and assembled visual preview; earlier rejected cuts are not the approved source. It does not certify runtime compatibility, other frames or production publication.

### Cutting and completion procedure

1. Keep the registered weapon-free dressed Hero and complete separate sword as masters. Cut on the original 768×768 coordinate system; retain fixed origin and scale in every exported layer.
2. Review the marked asset sheet and classify each boundary as **remove**, **complete**, or **preserve**. A part must contain enough of its own material to join beneath the adjacent equipment. Do not simply trace the visible silhouette where another part previously covered it.
3. Finish **one part at a time**: cut, inspect enlarged and against contrasting backgrounds, fill its missing insertion material, clean its contour/alpha, then accept that part before continuing. Remove isolated fragments, skin contamination, unrelated equipment and jagged cut ends. Use masks to preserve approved visible artwork.
4. **Helmet:** trim the marked far-side cheek extension below the brow and remove the detached endpoint. Keep the approved helmet shape and open face; do not include facial skin in the helmet layer.
5. **Chest/shoulders:** complete the collar/back-neck edge, shoulder undersides and armhole margins with matching leather. Join additions smoothly to the original contour. Preserve the approved chest, belt and visible design.
6. **Trousers/boots:** complete a continuous waistband/hip insertion above the trousers, removing the V-shaped notch and upward spike. This upper material must extend beneath the belt/skirt in the reviewed composition. Preserve original knees and boots; use the weapon-free source rather than reconstructing a sword-shaped missing stripe.
7. **Both arms:** complete rounded leather upper-arm insertion caps so sleeves extend beneath the shoulder/chest junction. Close truncated ends and blend material/shading into each existing sleeve. Fit only the new hidden cap to the existing sleeve cross-section; preserve original forearms, gloves, pose and coordinates. Do not translate or re-pose original limbs to conceal a seam.
8. Keep the complete sword unchanged and registered to the anatomical right hand. Preserve a complete weapon master even when glove pixels must cover the grip in a preview.
9. Reassemble the **actual exported parts** on the unchanged Base. Inspect shoulder, neck, waist, wrist and weapon-grip joins at enlarged and gameplay scale. Hidden completion is validated against the actual occluding alpha and draw order; adding material does not automatically make it hidden. Review exposed additions and silhouette changes explicitly.
10. Deliver isolated completed parts and the assembled result together. Include the current-contract comparison, addition/removal masks, preservation checks, dimensions, alpha bounds and hashes. Keep all seven declared PNG paths; `coverage_underlay.png` remains fully transparent with the documented empty reason. Each equipment part owns its own seam coverage.

### Composition evidence and DEV boundary

The visually approved authoring preview used:

`Base → legs_boots → arm_rear → arm_front → torso_armor → helmet → sword → copied right-hand occlusion pixels`

The right-hand occlusion pixels are copied at unchanged coordinates from the weapon-free source. This preview order lets the chest/shoulders cover the completed sleeve caps and waistband. **It differs from the locked runtime order in section 3**, where torso is drawn before legs and arms. Keep both the current-contract composite and proposed authoring composite as evidence; do not label the proposed preview as an exact-current-runtime assembly.

Owner visual approval does not authorize changing draw order, adding a runtime hand layer, changing slot ownership, or misusing `fullFaceHelmet`. DEV must approve and regression-test a compatible ordering/occlusion and hair-suppression solution before integration/publication, including compatibility with existing equipment. Never bake runtime offset Y=84 into exports.

In the approved review package, measured added-pixel occlusion was approximately 95.3% for the rear arm, 97.5% for the front arm and 93.3% for the trousers. These are package-specific observations, **not universal acceptance thresholds**; remaining exposed pixels require visual review. Chest edge completions are largely visible by design. Do not claim that every added pixel is hidden.

### Approval scope and handoff

- **Approved:** latest G16 Idle_01 overlap-completed artwork and visual assembly; this cutting/completion method.
- **Still required:** DEV runtime/order/hand-occlusion and helmet-hair compatibility approval; reconciliation of the separately identified Gate 0 SHA-256 ledger discrepancy before publication; remaining-frame production and G4–G6 checks.
- This documentation update creates no additional frames, runtime changes, R2 upload or Production PASS. Continue only within the task scope assigned after this approval.

## 5. Gates and owner acceptance
| Gate | Deliverable | Acceptance |
| --- | --- | --- |
| G0 Reference lock | Actual 8 Base frames, Azure refs/hashes, per-pose anchor map, silhouette zones | Exact provenance, unchanged Base and fixed origins |
| G1 Full-set concept | One coherent complete armor concept (including helmet/hair treatment) | **Owner visual approval** prior to full production |
| G2 Idle_01 prototype | Seven 768×768 layers, exact-order composite, hair/helmet preview | **Owner visual approval** on proportions/fit before expanding frames |
| G3 Frame expansion | Idle 01–03, Attack 01–03, Death 01–02, 56 files | Frame presence, no unintended pose drift, declared transparent placeholders |
| G4 Full-set visual QA | Composite per frame and animation/contact sheet; weapon grip and hair QA | Full set looks complete and coherent in all 8 frames |
| G5 Automated + runtime QA | SHA, alpha, canvas, origin, paths, layer order, fallback, tests, build | Tests pass; no regressions to existing slot mapping |
| G6 Publication | Approved bytes to R2, additive manifest, deployment, live decode | SHA read-back, frontend/deploy evidence, final Project Lead handoff |

**Coverage policy: Full Set First (Owner selected A).** Do NOT require exhaustive mixed-set illustration or render combinations; this reduces art iterations/tokens. Preserve existing resolver/slot regression tests and non-misrepresentation rules, but mixed-set visual perfection is deferred. Do not claim mixed-set QA was run.

## 6. Suggested package outputs (future work only)
```text
equipment-template-v1/
  references/{base,azure,anchors.json,reference-hashes.json}
  design/{DESIGN_SPEC.md,concept.png}
  masters/<frame-id>/   # editable source masters, retain for future revisions
  exports/<set-id>/<frame-id>/{coverage_underlay,torso_armor,legs_boots,arm_rear,helmet,sword,arm_front}.png
  qa/{composites,animations,VALIDATION.json,OWNER_APPROVAL.md}
  publication/PUBLICATION.json
```
This is a **proposed authoring package**, not a new live R2 structure or a request to generate all files now. Use existing approved manifest conventions for deployment.

## 7. Execution order (Owner locked)
1. Finalize/validate template through **G16 — T1 Beginner / Leather** as the first practical pilot, with separate artwork owner gates.
2. **After G16 completes**, revisit **Skeleton artwork proportions** as a separate owner-reviewed revision; do not touch approved Skeleton art now.
3. Continue **G17 Bronze → G18 Steel/Chain → G19 Platinum → G20 Dragon Slayer** using the validated template.

## 8. Change control
This document records the specification and the scoped G16 Idle_01 Owner visual approval in section 4B. Pipeline approval alone **does not** approve other G16 art, Skeleton replacement art, repository code change, R2 overwrite, runtime hair behavior or deploy. Graphics authors its own implementation PR when tasked; Project Lead reviews handoff/gates. No Worker/API/D1, gameplay, item-stat, persistence or economy changes. Generated `index.html` is built via `node build.js`, never hand edited. Docs-only commit does not bump visible game version.
