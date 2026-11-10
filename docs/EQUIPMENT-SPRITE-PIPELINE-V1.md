# ThornieDungeons — Equipment Sprite Pipeline V1
Status: **G16 G5 POST-MERGE ACCEPTED; G6 END-TO-END PUBLICATION AUTHORIZED / PRODUCTION EVIDENCE PENDING** (2026-10-28)
Scope: Hero V5 G2 modular equipment authoring, review and scoped runtime compatibility. Controlled art creation/correction follows the gates below; this document does not authorize R2 upload, gameplay/economy, Worker/API/D1 or deployment changes.
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
- **Still required:** remaining-frame production and G4–G6 checks. The scoped G2 runtime capability was merged through PR #156. The Gate 0 SHA-256 ledger discrepancy is reconciled in the Master Template.
- This G2 approval creates no additional frames, R2 upload or Production PASS. The separately approved and merged scoped runtime capability is recorded in §4C; continue asset work only within the assigned gate.

## 4C. G16 G2 scoped runtime compatibility contract (merged — PR #156)

- Opt-in family metadata: `compositionProfile: "leather_overlap_v1"`. Existing families without this profile keep the locked order in §3.
- Pairwise order: Leather Chest + Gloves moves both arm layers before torso; Leather Chest + Boots moves legs before torso. Mixed non-Leather pairs retain their previous relative order. Slot ownership, transparent underlay eligibility and far/near wing positions are unchanged.
- Scoped weapon occlusion reuses `arm_rear` as a cropped post-sword render pass; it adds neither an equipment slot nor an eighth exported PNG. Idle_01 uses `[0,493,768,42]`. Each later pose requires its own reviewed crop metadata. No resolved weapon or no Leather Gloves means no pass; Boss Weapon selection remains authoritative.
- Explicit `hairMode` values are `hidden_full_cover`, `baked_into_helmet`, and `default`. The Leather open-face/full-hair-cover helmet uses `hidden_full_cover`. Missing metadata preserves legacy behavior: `fullFaceHelmet:true` maps to hidden hair; otherwise separate default hair is drawn. Missing/fallback helmet restores default hair.
- Generic Tier 1 equipment maps to the Leather presentation family only when it has no explicit `setId`; supported Azure/Robot/Skeleton set identity remains authoritative. Inventory/persistence data is not rewritten and Accessory remains icon-only.
- The runtime capability is additive only. The incomplete G16 family is not added to the production manifest in this gate; publication still requires G3–G6.
- Automated QA uses the actual G16 Idle_01 exports and confirms the implemented composite is pixel-identical to the Owner-approved preview. See `docs/g16-leather-g2/qa/RUNTIME_IMPLEMENTED_COMPARISON.png`.

## 4D. G16 Attack continuation — pose, layering, local repairs and torso facing (Owner confirmed)

This section records the reusable method learned during the Attack_01–03 work. **Owner confirmed that all three current attack poses match.** Earlier Graphics statements that the poses differed were an interpretation error: different armor silhouettes were mistaken for a different pose. Preserve those accepted poses. Attack_01 shows the front; Attack_02 and Attack_03 show the back toward camera, following each manifest-selected Azure reference. **Project Lead/Owner approved the corrected rear-torso artwork at `bd25be1f4e252856be8d0e85dbe12ea8ec5e46ca` in the 2026-10-28 Death-frame assignment.** All current Attack artwork is locked. This approval does not complete G3; both Death frames still require accepted artwork.

### Per-pose preflight and surface identity

1. Resolve current Azure assets through the actual manifest and runtime resolver, then inspect both the complete outfit and isolated torso/arms. Establish **which garment surface is visible** before cutting, deforming or generating a part. Record per-pose `torsoFacing`: Attack_01 = front; Attack_02/03 = back-facing / three-quarter rear. Head direction does not determine torso direction during a twist.
2. Compare Azure and Leather using the same 768×768 origin, scale and shared review crop. Distinguish pose/anatomy, front/back garment surface and equipment volume. Large helmets, pauldrons or blades change the silhouette without proving that joints moved. Owner's pose acceptance takes precedence over an agent's silhouette inference.
3. Retargeting a front chest through translation, rotation or a surface mesh **cannot create a back panel**. For back-facing frames, reconstruct the visible rear leather panel, rear neckline, seams, shoulder backs, belt and skirt surfaces in the existing part footprint. Do not leave front chest clasps or a central front belt buckle on the exposed back. Do not mirror front armor and call it a rear design.

### Reconstruction and cleanup procedure

4. Start from the actual canonical Base for each pose and the approved/selected Leather material/design masters. Keep original anatomy, face/head/limbs, canvas origin and sword grip unchanged. Rejected whole-body Attack/Death source pixels remain excluded.
5. Reuse complete isolated material and hidden insertion regions where valid. Clothing-only mesh/TPS reconstruction may fit sleeves, gloves or trousers to a pose; record all guides/transforms as manual surface-authoring choices, not pixel-exact bone pivots. Preserve original source masters, and check that the source mesh includes the complete upper insertion and glove/boot material. Never deform or repaint the Base to fit equipment.
6. Complete one part at a time. Use original alpha masks to protect accepted visible art. For bounded generated paintover, supply an isolated-part edit target, its canonical/assembled fit reference and a design reference. Save the donor and prompt, admit only the authorized part/region, and assert that protected exports and pixels remain unchanged. Do not admit newly generated body/face/skin pixels into equipment.
7. Neck repair: reveal the original Base neck by lowering/opening the chest neckline; finish a narrow continuous leather/gold rim. Keep chest-owned material over unwanted white Base-shirt edges. Preserve the canonical chin shadow and remove only chest/shoulder pixels that protrude into the chin, using a documented visual clearance mask. Do not move the head, redraw the neck or introduce a shared underlay/skin layer.
8. Keep the complete independently generated sword master. Register handle [270,515] to each canonical grip (Attack_01 [310,309], Attack_02 [489,448], Attack_03 [413,551]); compare direction to the actual selected Azure sword. Retain original complete sword bytes when only the torso is being corrected.

### Anatomical layers and review contract

9. Current Leather filenames are anatomically opposite to Azure for the two arms. For these Attack candidates, Leather `arm_rear` = anatomical right sword arm; Leather `arm_front` = anatomical left arm. Check actual pixels rather than trusting names.
10. Owner-approved offline front → back order: **right arm → sword → helmet → torso → left arm → trousers/boots → Base**. Compose in reverse; keep the declared underlay fully transparent. No extra torso redraw or cropped-hand pass is hidden in this preview. This is the Owner's authoring order, not a claim that it is Azure's filename order or the merged `leather_overlap_v1` resolver order.
11. Keep authoring assembly and runtime compatibility separate. Full-arm-after-sword preview does not authorize a runtime order change or a larger hand rectangle. Record per-pose hand status explicitly; leave unresolved runtime crop metadata unapproved rather than copying the Idle crop. Existing far/near wing handling and other equipment families remain untouched.
12. Deliver actual seven-PNG reassemblies, a three-frame full-set sheet, isolated-part sheet, Source/Base overlays, neck/wrist/grip details, front/back orientation labels, placement/alpha/bbox/SHA-256 reports and preservation checks. Review crops may enlarge/trim for readability; exported paths stay 768×768 RGBA at origin [0,0], with no baked runtime Y=84.
13. Acceptance is granular: the three poses were accepted first, then the corrected Attack_02/03 rear torso surfaces were accepted on 2026-10-28. Preserve all 21 current Attack exports byte-for-byte during Death production. G3 completion still requires the remaining Death frames and accepted all-frame inventory; file existence or PNG checks do not imply visual acceptance, R2 approval or Production PASS.

Evidence/provenance: `docs/g16-leather-g2/g3/owner-selected-recut/attack_01/` (layer, neck and bounded donor checkpoints), `attack-review-pack-v1/` (three-frame clothing reconstruction), and `attack-review-pack-v1/azure-comparison/` (same-scale Azure comparison). Historical pending wording is not rewritten; this section records Owner's subsequent pose acceptance and facing correction.

## 4E. G16 G5 frame-specific runtime composition (implemented; PR review pending)

- `leather_overlap_v1` accepts `frameComposition.<frameId>.foreground`. Attack_01–03 and Death_02 declare `arm_rear` as foreground. The rule is applied only when that layer belongs to the selected Leather slot and the layer path exists in the resolved frame.
- Existing pairwise Chest/Gloves and Chest/Boots ordering is applied first. Moving the declared Leather foreground layer is stable: every other equipment layer keeps its previous relative order. Global Azure/Robot/Skeleton order, slot ownership, underlay eligibility and Wing positions are unchanged.
- Attack_01–03 render the complete anatomical right arm once after the resolved Leather or Boss sword. They do not use a cropped post-sword hand pass. Death_02 also renders the complete right arm in foreground; both Death sword exports remain intentionally empty and Death uses no hand pass.
- Idle retains reviewed crops Idle_01 `[0,493,768,42]`, Idle_02 `[0,481,768,42]`, and Idle_03 `[0,489,768,42]`. The runtime refuses to append a cropped pass whenever its complete source layer is already after the sword.
- The G5 browser fixture uses the exact final G4 ledger through the actual Equipment Resolver, Hero V5 contract, EventBridge and Phaser `HeroRenderer`; it does not publish Leather paths to the production manifest. Actual Canvas captures and validation are recorded in `g3/qa/G5_RUNTIME_COMPARISON.png` and `G5_RUNTIME_VALIDATION.json`.
- Known issue retained by scope: a network/runtime Helmet texture 404 can remove the Helmet after hair suppression and leave a bald fallback. Contract-level incomplete Helmet bundles restore default hair. G5 does not redesign the pre-existing runtime-404 fallback.

## 5. Gates and owner acceptance

G16 current handoff (2026-10-28): Owner Final G4 Visual Approval accepts all eight frames and Idle/Attack/Death animation previews from the corrected ChatGPT package, and authorizes final upload to existing Draft PR #160. Exactly 11 PNG replacements and 45 byte-identical preserved equipment PNGs are reconciled in `docs/g16-leather-g2/g3/VALIDATION.json` and `SHA256SUMS`. `g4-source/OWNER_APPROVAL.md` pins the package and approval. Current contact/comparison/GIF evidence is in `g3/qa/`. Earlier G3 byte-preservation statements above describe their historical stage; only the 11 Owner-approved G4 seam/RGB corrections supersede those byte locks. Poses, Base anatomy/origin, rear torso facing, helmet/sword/underlay bytes and Death_02 helmet [0,-8] remain locked.

G4 visual acceptance is preserved. G5 scoped runtime foreground-arm implementation is merged (Graphics PR #160, DEV PR #164) and post-merge QA accepted at main e74a8b522f2092156ded830fc5ca48bddbed3e9e. Empty Death swords require no crop. G6 full publication is Owner-authorized subject to sequential SHA/read-back, manifest and live QA gates; publication/Production Verified are not yet evidenced here. See §9.

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
This document records the reusable specification, historical staged Owner approvals, and G16 lessons through the G6 publication procedure. Pipeline approval alone **does not** approve other G16 art, Skeleton replacement art, repository code change, R2 overwrite, runtime hair behavior or deploy. Graphics authors its own implementation PR when tasked; Project Lead reviews handoff/gates. No Worker/API/D1, gameplay, item-stat, persistence or economy changes. Generated `index.html` is built via `node build.js`, never hand edited. Docs-only commit does not bump visible game version.


## 9. End-to-end repeatable equipment sprite production SOP — G16 lessons (2026-10-28)

This is the **operational checklist for future equipment families**. Read Gate 0 Master Template, the earlier detailed cutting procedures (§4A–4D), and the current live manifest/contract before using it. Historical interim statuses and rejected visual variants above remain provenance, not the latest approval state. **G16 G5 passed post-merge QA at main `e74a8b522f2092156ded830fc5ca48bddbed3e9e`; G6 full publication was separately authorized but must not be reported complete before read-back and Production evidence.**

### Stage 0 — Reference and Gate 0 source lock
1. Read `AGENTS.md`, this pipeline, `docs/EQUIPMENT-SPRITE-MASTER-TEMPLATE-V1.md`, current `r2-upload/manifest.json`, Hero V5 Runtime Contract, and Azure frame contracts. Record exact main HEAD.
2. Resolve each of the eight **actual manifest-selected** Hero Bases and Azure pose/equipment reference images. Preserve Base identity using recorded raw SHA-256, dimensions, alpha and origin. Never redraw, shift, auto-trim or re-center Base.
3. Reuse an existing approved Gate 0 baseline if unchanged; only revalidate altered inputs. Treat visual anatomical landmark estimates as guides, not exact rig joints; preserve runtime Y offset **84 in code**, not in PNG files.
4. Produce a concise source/anchor/pose and integrity record before G1. Stop on conflicting manifest, pose or checksum authority.

### Stage 1 — Owner concept approval (G1)
1. Establish the theme, material, full-set silhouette, helmet/hair treatment, right-hand weapon and optional icon-only Accessory. Use **HYBRID, Azure-reference, Full Set First**; no mandatory exhaustive mixed-set visual matrix.
2. Show a fully dressed **weapon-free** Hero and a **complete separate weapon**. Review against the locked Base/Azure anatomy and pose; do not infer an approval from image-generation output.
3. For full hair-cover Leather helmets use `hidden_full_cover`; helmets with exposed hair bake the approved hairstyle with helmet and use `baked_into_helmet`; without helmet use `default`. Obtain explicit Owner visual acceptance before cutting.

### Stage 2 — G2 single-frame pilot, registered slicing and completion
1. Begin with `idle_01` and the approved weapon-free dressed Hero. Register the complete weapon uniformly at the anatomically correct grip; retain an independent complete sword master.
2. Cut **one layer at a time** in original **768×768 RGBA / [0,0]** coordinates: helmet, torso_armor, legs_boots, arm_rear, arm_front, sword and coverage_underlay. Review each extracted piece enlarged and against contrasting backgrounds.
3. Repair truncated *hidden insertion geometry* (collar/back-neck, shoulder/upper sleeve caps, waist/hip, glove/wrist, boot seams) from bounded compatible material; clean stray pixels, wrong-surface fragments and alpha fringes. Preserve the approved visible silhouette, source pose, light direction and piece material; do not merely cut along visible overlap edges.
4. Keep each equipment piece responsible for its own seam/coverage. Export a **fully transparent coverage_underlay** with explicit `emptyReason` for the G16 rule; do not add shared underlay art to hide a defective cut.
5. Reassemble **the exact exported pieces** over unchanged Base, not an idealized concept. Check sword grip and hand occlusion, torso facing, shoulder/glove/waist/boot gaps, silhouette and default hair suppression at enlarged and game display size. Only an Owner-approved reviewed composite may advance.
6. Use the already merged scoped `leather_overlap_v1` pairwise ordering for Chest+Gloves and Chest+Boots; retain the approved per-frame Idle post-sword cropped arm when needed. Rendering fixes require DEV compatibility review and regressions, not silent global reorder.

### Stage 3 — G3 full frame expansion
1. Produce exactly **8 frames × 7 paths = 56 fixed-canvas PNGs**: `idle_01–03`, `attack_01–03`, `death_01–02`; layers `coverage_underlay, torso_armor, legs_boots, arm_rear, helmet, sword, arm_front`.
2. Match **each** original Base/Azure pose separately; Idle has accepted bob **[0,-12,-4]**. In G16, Attack_01 faces front, Attack_02/03 have rear-facing torso; Death_01 and Death_02 retain their individually approved poses (including Death_02 helmet offset **[0,-8]** in authoring coordinates).
3. Preserve complete weapon master and correct handedness/foreground insertion. G16 Death swords are intentionally empty; all eight underlays are intentionally empty. Every transparent exported path still exists and records an `emptyReason`.
4. Maintain SHA-ledger traceability and do not alter Owner-locked frames while fixing other frames. Record frame-by-frame visual acceptance; rejected variants and intermediate candidates never replace accepted source.

### Stage 4 — G4 final correction, Owner approval and Git publication
1. Build full-frame contact sheet, isolated layer sheets, before/after seam/material comparisons, Idle/Attack/Death animation previews and **actual exported-layer** composites.
2. Test skin/Base exposure at armor seams, shoulder insertions, leg/boot/wrist continuity and rear torso-facing; repair with bounded masks/donor pixels. Preserve original piece alpha when an approved repair is RGB-only. Explicitly identify changed bytes versus unchanged assets.
3. Verify every final PNG: path/inventory, dimensions, RGBA, [0,0], alpha edge/bbox, intentional empty layers, decode and SHA-256. For G16 final G4: **11 Owner-approved replacements, 45 byte-identical preserved**, recorded in `docs/g16-leather-g2/g3/VALIDATION.json`, `SHA256SUMS`, `g4-source/OWNER_APPROVAL.md`.
4. Obtain Owner approval of **all eight final composites and animation previews** before Git publication. Commit only final approved files and essential provenance/QA; keep historical evidence. Graphics opens its PR; Project Lead reviews and controls merge.

### Stage 5 — G5 runtime integration and real renderer acceptance
1. Audit equipment slot ownership, `compositionProfile`, `hairMode`, fullFaceHelmet legacy fallback, transparent underlay conditions, selected setId precedence, generic Tier-1 binding, Boss sword authority, wings and Azure/Robot/Skeleton isolation.
2. For G16 `leather_overlap_v1`, declare `frameComposition.<frameId>.foreground: ["arm_rear"]` for `attack_01`, `attack_02`, `attack_03`, `death_02`. Move only the selected Leather-owned frame layer after the resolved sword, preserving other relative order; **do not duplicate the full foreground arm with a cropped hand pass**.
3. Preserve Idle hand crops `idle_01 [0,493,768,42]`, `idle_02 [0,481,768,42]`, `idle_03 [0,489,768,42]`. Attack and Death have **no cropped hand pass**. Empty Death sword, offset 84 and Idle bob remain unchanged.
4. Verify all eight frame paths with actual `EquipmentVisualResolver → HeroV5RuntimeContract → EventBridge → HeroRenderer` (Phaser), real Idle→Attack→Death transitions, HeroPreviewHost/BattlefieldHost and Battle HeroActor. Compare with final G4 references using **alpha-support and premultiplied color** tolerances appropriate to Canvas compositing; do not confuse non-identical raw RGBA rounding with meaningful visual defects.
5. Run targeted Hero/W8/Skeleton/Phaser/Mythic/equipment checks, full regression, `node build.js`, `git diff --check`, SHA ledger, and verify a clean generated build. Distinguish Canvas PASS from **WebGL not tested**, and local tests from missing CI. Obtain post-merge QA before G6. G16 post-merge evidence reported **56/56 hashes, 12/12 G16, 120/120 targeted, 911/911 full regression**, and actual Canvas 8/8 (source: G5 handoff; do not represent these as newly rerun in this document).

### Stage 6 — G6 release: two ordered publication gates, production smoke and rollback
1. **Preflight:** recheck latest main, live R2 manifest and `assets` bucket collisions; preserve live manifest bytes/hash for safe rollback and account for concurrent edits. Source is final `VALIDATION.json` (each `files[].path`). R2 key `hero/v5/g2/equipment/<family>/<frame>/<layer>.png`; staging path `r2-upload/<same-key>`. Copy bytes unchanged; no image re-encoding/resizing.
2. **Gate A — PNG upload:** stage 56 approved PNGs only, in an isolated commit. The repo's normal main-push workflow uploads *changed paths* under `r2-upload/`; **do not run full-staging `workflow_dispatch`**. Inspect triggers before pushing. Do **not** include/activate Leather manifest in the same upload batch.
3. After Gate A workflow success, independently read back **all 56 R2 objects** and compare their **SHA-256** to the final source ledger (not ETag). Verify public URL, content type `image/png`, dimensions, alpha and decode; ensure the active manifest did not change. Stop on any collision, missing key, failed hash or unexpected unrelated upload.
4. **Gate B — activation (only after A PASS):** add exactly one family under `assets.hero001.v5.g2.equipment.leather` in `r2-upload/manifest.json`: `approval:"approved"`, canvas 768×768, origin x/y=0, `compositionProfile:"leather_overlap_v1"`, `hairMode:"hidden_full_cover"`, four foreground-frame entries, three Idle hand crops and **56 concrete frame/layer R2 strings**. Preserve all other manifest families and app/backend files.
5. Publish/read back the manifest as a *separate* controlled commit/workflow, verify the live JSON and semantic diff, ensure all listed objects remain accessible and no prior family was overwritten.
6. Production smoke: asset requests, authenticated Inventory/equipment and Hero Preview if accessible, Battle Idle/Attack/Death, sword/Boss overlap, helmet/hair/fallback, mobile display and Azure/Robot/Skeleton. State which checks were **actually authenticated**; do not claim Production Verified solely from successful public asset decoding.
7. Record source SHA, publication commits, workflow IDs, 56 per-object read-back hashes, manifest before/after, browser/host test evidence and rollback readiness in `docs/g16-leather-g2/g6/PUBLICATION.json`.
8. On material failure, stop activation or **remove only the Leather manifest block / safely reconcile the saved manifest** and verify live read-back and unaffected families. Keep uploaded R2 PNGs unreferenced; do not delete artwork/evidence or assume deleting staging deletes R2 objects. Do not revert unrelated later manifest updates.
9. Owner performs **final visual acceptance on Production**. Only close the family as Production Complete after actual publication, runtime smoke, accurate limitations and Owner verification. G16 publication is **authorized**, not presumed complete until returned G6 evidence confirms each gate.

### Minimal future-family acceptance record

For each new set record: `family/setId`, latest main SHA, locked Base/Azure references, Owner G1/G2/G4 approvals, 8×7 file ledger and SHA-256, transparent emptyReasons, renderer layer order/crops/hair metadata, G5 test counts and Canvas/WebGL coverage, R2 keys and read-back hashes, activation manifest SHA/semantic diff, deployment/workflow IDs, public/authenticated smoke, rollback steps and Owner Production decision. Do not silently copy G16-specific posture/crops into another family: re-measure each pose and require its own approvals.


## 10. Mandatory item-icon gate after final 56-sprite approval (Owner rule — 2026-10-28)

**Trigger:** Once the Owner has approved the full equipment sprite inventory (**8 frames × 7 layers = 56 PNGs**, G4 final acceptance), immediately schedule the matching **Inventory/Equipment item-icon pack** as a distinct follow-on graphics task. This requirement applies to G16 Leather and all subsequent equipment sets; **do not omit icons merely because wearable Hero sprites are complete**. The icon gate is distinct from G4 sprite approval and G6 wearable-R2 publication, and must be tracked to closure before calling the *whole equipment-family visual package* complete.

1. **Audit before generation:** inspect current `assets.itemIcons` and the inventory/equipment/Accessory UI resolver and staging paths. Search for a pre-existing matching accessory icon (not just a similarly named ring) and verify its exact item identity, actual image, ownership, licensing and runtime mapping. Reuse an approved matching icon rather than generating a duplicate. Missing manifest mapping alone does not prove no file exists.
2. **Required set items:** weapon, helmet, chest, gloves, boots — **five distinct production icons** based on the Owner-approved full equipment design, materials, silhouette and palette. Also check **Accessory**: if an appropriate existing icon for the actual Tier/item identity is available, retain/reuse it; otherwise propose/create a sixth icon after Owner review. Accessory is **icon-only** and never adds an eighth wearable Hero layer.
3. **Design and Owner gate:** produce side-by-side icon contact sheet on light/dark backgrounds, with real Inventory display previews at approximately 24/32/40 px; verify readability and set identity. Do not publish candidate images or alter approved 56 wearable sprites before explicit Owner icon approval.
4. **Production contract:** transparent PNG/RGBA, safe padding, consistent small-canvas scale and lighting. Follow the latest `r2-upload/README.md` icon budget and actual existing icon-family dimensions; use the smallest approved canvas that preserves readability. Check alpha edges, encoded size, dimensions and per-icon SHA-256.
5. **After icon approval only:** stage approved final icons under `r2-upload/ui/equipment-icons/<family>/` where appropriate, add only authorized `assets.itemIcons.<family>` mappings (or the existing shared Accessory mapping where appropriate), and confirm runtime Inventory/Equipment/Compare consumers and fallback. Separate icon publication from unapproved gameplay/item-stat modifications and preserve all other asset families.
6. **QA and closeout:** verify changed-path upload workflow, R2 object SHA read-back, manifest read-back, real icon decode, mobile UI readability, missing-icon fallback, focused/full tests, generated build and relevant Production QA. Provide exact commit/workflow IDs and Owner acceptance. No automatic R2 upload/manifest activation/deploy is implied by icon design approval.
7. **Handoff completeness:** final equipment-family visual closeout records both the **56 wearable PNGs** and **five item icons plus Accessory decision** with distinct Owner acceptance/evidence. G16's G6 wearable release may be complete while its item-icon gate remains outstanding.

For G16, inspect whether the existing T1 **Adventurer Charm** has a reusable image in code, catalog, R2 or the current manifest. The current manifest has `itemIcons.azure/robot/skeleton.accessory` but lacks `itemIcons.leather`; this establishes only that Leather icon mapping is absent, **not** that an Adventurer Charm asset does not exist.
