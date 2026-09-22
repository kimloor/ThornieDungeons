# Hero Sprite V5 — Modular Layered Frame Sprite Specification

Status: DESIGN LOCK / REFERENCE

Hero V5 defines ThornieDungeons' future Hero visual-production standard.

The approved direction is a **modular layered, frame-based sprite system**.

Hero V5 does **not** use skeletal animation, bone rigs, mesh deformation, or Spine-style runtime animation. Equipment appearance is composed from synchronized sprite layers that share the same canvas, frame number, anchors, and layer-order rules.

## 1. Core direction

- 2D HD chibi, side-view, right-facing.
- Hero is always floating in battle.
- No walk animation is planned.
- Big head, compact body, short legs.
- Head target: ~45% of total character height.
- Cute but battle-ready silhouette.
- Oversized weapon presentation for mobile readability.
- Base Hero is equipment-neutral and acts as the visual foundation under equipment.
- Animation is authored as discrete sprite frames.
- Equipment is authored as modular sprite layers synchronized to the Hero frame.
- Do not introduce skeleton/bone/rig runtime requirements for Hero V5.

## 2. Phase 1 animation set

### Idle — 3 frames

Floating combat idle with subtle vertical motion.

1. Neutral float.
2. Slight lift / breathing rise.
3. Return toward neutral.

Secondary motion may affect hair, weapon, clothing, or equipped wings, but must remain readable and restrained.

### Attack — 3 frames

Primary oversized-sword attack.

1. Anticipation / ready.
2. Impact / strike — primary damage and VFX timing frame.
3. Follow-through / recovery.

The three-frame attack must still communicate weapon weight through clear silhouette changes.

### Hurt

Not required for the first Hero V5 production pass unless separately approved.

If added later, use a short 2–3 frame recoil sequence and preserve the same modular-frame contract.

### Death — 2–3 frames

Recommended:

1. Fatal hit / loss of balance.
2. Drop / collapse of floating posture.
3. Optional final defeated hold.

### Walk

Not required. ThornieDungeons battle Hero uses floating presentation rather than walking locomotion.

## 3. Hero proportions

Approved direction:

- Head: ~45% of total Hero height.
- Torso: short and compact.
- Legs: short and visually secondary.
- Floating combat-ready pose.
- Oversized sword: approximately 95–110% of Hero height.
- Equipped wings: each wing roughly comparable to the head in visual size.
- Wings are equipment, not part of the Base Hero.
- Silhouette must remain legible at mobile battle size.

## 4. Base Hero

Phase 1 Base Hero:

- male;
- bald / no baked hair;
- no hat;
- no armor;
- no weapon;
- no wings;
- simple sleeveless off-white shirt;
- dark fitted pants;
- minimal brown/dark neutral wraps, footwear, or ankle covering.

The Base Hero must remain visually simple so equipment can replace or cover it cleanly.

## 5. Modular layer structure

Hero V5 is composed from layered sprite groups.

Approved conceptual groups:

1. Wings
2. Hair Back
3. Body / rear body parts as needed
4. Torso / lower body
5. Outfit / armor overlays
6. Legs / Shoes
7. Head
8. Hair Front / Hat
9. Right Arm / weapon-side arm where required
10. Weapon

Exact art splitting may vary by animation frame, but the runtime concept remains **layered frame composition**, not skeletal articulation.

The original V5 draft's 10-part asymmetric rig / bone-like articulation model is retired by this specification.

## 6. Equipment slots

V5 preserves the conceptual equipment categories:

- Hat
- Outfit
- Arms
- Shoes
- Weapon
- Wings

A slot may contain multiple visual layer files when needed.

Examples:

- Outfit may include torso and lower-body overlays.
- Arms may contain separate left/right visual overlays.
- Shoes may contain left/right visual parts.
- Weapon is a separate layer.
- Wings are independent rear equipment.

## 7. Frame synchronization contract

All visible Hero layers for an animation must use the same animation frame index.

Example:

```
Idle frame 01:
- base/idle_01.png
- hair/<style>/idle_01.png
- outfit/<item>/idle_01.png
- arms/<item>/idle_01.png
- shoes/<item>/idle_01.png
- weapon/<item>/idle_01.png
- wings/<item>/idle_01.png

Idle frame 02:
- all active layers use idle_02

Idle frame 03:
- all active layers use idle_03
```

Attack and Death follow the same rule.

Runtime must never combine mismatched frame indexes from the same animation unless an explicit fallback contract is defined.

## 8. Canvas standard

Master asset standard:

- Canvas: `768 x 768 px`.
- Format: transparent PNG.
- Same canvas size for all compatible Hero and equipment layers.
- Same coordinate space for every frame and every equipment layer.
- Do not crop individual equipment pieces to different canvas bounds if that would change placement.
- All animation frames must remain inside the master canvas.

Recommended occupied area:

- Hero body height roughly 52–60% of canvas (~400–460 px).
- Hero positioned somewhat left of canvas center.
- Reserve space on the right for oversized weapon arcs.
- Reserve rear/side space for wing equipment.

The 768px master is source resolution. Runtime scales the final composite to the battle layout.

## 9. Anchor convention

Hero V5 still uses logical anchors for **placement consistency**, but these are not bones and are not animated through skeletal transforms.

Required reference anchors:

- `hero_root` — stable body placement reference.
- `head_anchor` — hat/hair alignment reference.
- `weapon_grip` — weapon alignment reference.
- `wing_back` — wing attachment reference.
- `foot_left` / `foot_right` — shoe alignment references where needed.

Graphics should keep these positions visually consistent across matching layers and provide an anchor guide when necessary.

DEV may store numeric placement metadata, but the animation itself remains frame-based.

## 10. Pivot / transform boundary

Allowed:

- whole-composite runtime scale;
- whole-composite placement;
- minor static layer offset corrections;
- optional static mirroring when explicitly supported;
- metadata used only to align modular layers.

Not part of Hero V5 animation:

- bone rotation;
- skeletal interpolation;
- mesh deformation;
- IK;
- runtime limb articulation;
- transform-driven replacement of authored animation frames.

If a pose changes, Graphics should author the correct frame artwork.

## 11. Layer order

Default back-to-front direction:

1. Wings
2. Hair Back
3. Rear body / rear arm
4. Torso / lower body
5. Outfit / armor
6. Legs / Shoes
7. Head
8. Hair Front / Hat
9. Front arm
10. Weapon

Frame-specific layer-order exceptions are allowed where visually required, especially during Attack.

Example: the weapon may pass behind the body in one attack frame and in front in another.

Such exceptions should be explicit data, not inferred dynamically.

## 12. Hair

Hair is not baked into the Base Hero.

Minimum conceptual structure:

- `hair_back`
- `hair_front`

Hair must follow the same frame count and frame index as the Hero animation when visible motion is needed.

Static hair may reuse identical artwork across multiple frames if alignment remains correct.

## 13. Wings

Wings are equipment and never part of the Base Hero.

Rules:

- Empty wing slot = no wing layer.
- Default layer is behind the Hero.
- Wing placement follows `wing_back`.
- Wings may have separate Idle / Attack / Death frames.
- A static wing image may be reused across frames if no visible motion is required.
- Do not create runtime bone-driven flap animation for Hero V5.

Suggested behavior:

- Idle: subtle movement.
- Attack: slight reaction/opening.
- Death: weaken/fold/drop visually.

## 14. Weapon

- Weapon is separate equipment.
- Weapon alignment follows `weapon_grip`.
- Oversized sword target length: ~95–110% of Hero height.
- Each animation frame should contain the correct authored weapon pose.
- Reuse identical weapon frame artwork only when the pose genuinely remains unchanged.
- Do not rely on runtime rotation to generate the full attack animation.
- Layer order may change between attack frames.

## 15. Heavy-armor coverage rule

Current planned heavy armor families:

- Azure
- Robot
- Skeleton

These should use strong/full visual coverage.

### Outfit

- Fully covers/replaces visible torso/lower-body presentation where armor is worn.
- Base shirt/pants should not remain visible through full heavy armor unless intentionally designed.

### Arms

- Heavy arm equipment replaces the covered base-arm presentation.

### Shoes / leg armor

- Heavy footwear/leg armor may replace feet and overlap lower-leg regions.

V5 may support partial/fashion coverage later, but Phase 1 does not require complex masking.

## 16. Gender-ready architecture

Phase 1 builds the Male Base first.

Future female variant should:

- preserve the same `768 x 768` canvas;
- preserve animation names and frame counts where possible;
- preserve logical anchors;
- preserve equipment slot semantics;
- primarily change torso/hip silhouette;
- keep differences subtle enough for broad equipment compatibility.

Shared equipment is preferred.

Male/female-specific Outfit or Arms artwork should be created only when silhouette fit requires it.

## 17. Naming convention

Recommended source naming:

```
hero/base/idle_01.png
hero/base/idle_02.png
hero/base/idle_03.png

hero/base/attack_01.png
hero/base/attack_02.png
hero/base/attack_03.png

hero/base/death_01.png
hero/base/death_02.png
hero/base/death_03.png
```

Equipment example:

```
hero/equipment/weapon/<item_key>/idle_01.png
hero/equipment/weapon/<item_key>/attack_01.png

hero/equipment/wings/<item_key>/idle_01.png
hero/equipment/outfit/<item_key>/idle_01.png
hero/equipment/arms/<item_key>/idle_01.png
hero/equipment/shoes/<item_key>/idle_01.png
hero/equipment/hat/<item_key>/idle_01.png
```

Final production paths and manifest keys must still follow the repository's R2/manifest rules and must be verified before implementation.

## 18. Fallback rules

To control graphics workload:

- A layer may reuse the same image for multiple consecutive frames when its pose does not change.
- Missing optional cosmetic motion must not require inventing extra frames.
- Do not silently substitute a mismatched animation frame.
- If a specific item has no animation-specific visual and reuse is visually valid, explicitly map/reuse the approved static frame.
- Missing required equipment assets should follow the project's normal asset fallback rules.

## 19. First integration test set

After Base Hero animation is approved, validate with:

- Azure armor
- Azure sword
- Angel Wings

Verify:

- full-body armor coverage;
- frame synchronization;
- weapon alignment;
- attack silhouette;
- wing placement behind Hero;
- hair/hat compatibility where relevant;
- no visible jumping between frames;
- no layer drift;
- stable scaling on mobile.

Robot and Skeleton armor should follow after the architecture is proven.

## 20. Graphics production workflow

Recommended sequence:

1. Create and approve Base Hero concept/proportions.
2. Produce Base Hero Idle 3-frame reference.
3. Produce Base Hero Attack 3-frame reference.
4. Produce Base Hero Death 2–3-frame reference.
5. Lock canvas, anchors, frame timing, and layer ordering.
6. Split/export Base Hero modular layers where needed.
7. Create first equipment test set: Azure armor + Azure sword + Angel Wings.
8. Export equipment frames synchronized to the approved Hero frame indexes.
9. DEV implements frame composition.
10. Compare runtime composite against approved full-composite references.
11. Only after approval, mass-produce additional equipment families.

Do not mass-produce equipment before the Base Hero frame system is proven.

## 21. Acceptance priorities

In order:

1. readable on mobile;
2. strong chibi silhouette;
3. stable frame-to-frame placement;
4. clean synchronized equipment composition;
5. convincing oversized-sword attack;
6. reliable canvas/anchor alignment;
7. equipment extensibility;
8. manageable Graphics workload;
9. future gender-body compatibility.

## 22. Technology decision

For Hero V5 production:

- Animation model: **frame-based sprite animation**.
- Character composition: **modular layered sprite**.
- Equipment swapping: **layer replacement / overlay by frame**.
- Skeleton/bone animation: **not used**.
- Spine runtime: **not required**.
- Rig-based interpolation: **not used**.

A future project version may reevaluate skeletal animation only if the animation library becomes large enough that frame-based production is no longer practical. That would require a separate design/technical decision and does not alter V5.

## 23. Future responsive breakpoint note

Hero V5 master assets must remain independent from the current mobile layout width.

Future UI work may use broader tablet/desktop battle layouts. The `768 x 768` master is intentionally suitable for higher-resolution rendering while runtime controls final display scale.

Responsive implementation is outside this document's scope.

## 24. Scope boundary

This document defines Hero V5 visual/animation architecture and production reference only.

It does not authorize:

- immediate replacement of the production Hero;
- gameplay-stat changes;
- economy/equipment behavior changes;
- skeletal animation integration;
- Spine integration;
- mass production of Hero V5 equipment before Base Hero approval;
- responsive breakpoint implementation.

The next production milestone is **Base Hero concept + approved frame-based Idle/Attack/Death references**, not runtime integration.
