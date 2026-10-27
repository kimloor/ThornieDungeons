# ThornieDungeons — Equipment Sprite Pipeline V1
Status: **OWNER APPROVED — DESIGN CONTRACT ONLY** (2026-10-27)
Scope: Hero V5 G2 modular wearable equipment art; no implementation, asset regeneration, R2 upload, gameplay or runtime change in this document commit.
Approved decisions: **HYBRID / AZURE-REFERENCE / FULL-SET-FIRST / G16 BEFORE SKELETON**.

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
- `coverage_underlay` is full-set seam closure, conditional on chest/gloves/boots sharing one supported family; never use it to paint equipment into unequipped slots.
- Maintain slot ownership: helmet→helmet, chest→torso_armor, gloves→arm_rear + arm_front, boots→legs_boots, weapon→sword. Accessories remain item icons without Hero wearable layers unless separately approved.

## 4. Helmet / hair art contract (Owner approved design)
- **Full-cover helmet:** helmet art fully occludes default hair; hair_back and hair_front both suppressed.
- **Open-face / partial helmet, crown or circlet:** **bake the approved default hairstyle together with the helmet into the exported `helmet` artwork, on every frame**, and suppress default hair layers while that helmet is worn. Avoid double-hair, bald gaps or obvious hair-helmet seams.
- **No helmet:** show the separate default hair_back and hair_front layers as normal.
- Existing runtime currently suppresses hair when `fullFaceHelmet===true`. This is insufficient as a semantic label for an *open* helmet with baked hair. **DEV compatibility gate required before publication**: propose explicit `hairMode` values such as `hidden_full_cover`, `baked_into_helmet`, `default` and validate backwards compatibility with already approved Azure/Robot/Skeleton. Do not misuse `fullFaceHelmet` metadata or change renderer behavior in this design-only task.
- Bake hair using the currently approved default (topknot) for each pose; if selectable hairstyles are introduced later, a new visual variant contract is needed.

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
This document is specification only. Owner approval of this pipeline **does not** approve any new G16 art, Skeleton replacement art, repository code change, R2 overwrite, runtime hair behavior or deploy. Graphics authors its own implementation PR when tasked; Project Lead reviews handoff/gates. No Worker/API/D1, gameplay, item-stat, persistence or economy changes. Generated `index.html` is built via `node build.js`, never hand edited. Docs-only commit does not bump visible game version.
