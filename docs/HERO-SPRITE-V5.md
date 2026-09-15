# Hero Sprite V5 — Modular Floating Chibi Specification

Status: DESIGN LOCK / REFERENCE

Hero V5 replaces the current presentation direction with a Maple-like hybrid paper-doll system optimized for ThornieDungeons battle presentation, equipment swapping, smooth animation, mobile readability, and future character variants.

## 1. Core direction

- 2D HD chibi, side-view, right-facing.
- Hero is always floating in battle. No walk animation is planned.
- Big head, small compact body, short legs.
- Head target: ~45% of total character height.
- Cute but battle-ready silhouette.
- Clean fantasy/JRPG visual language; use classic side-view paper-doll principles without copying any specific external character.
- Base Hero is equipment-neutral and exists mainly as the animation/body foundation beneath equipment.
- Target production technique: reusable body parts + transform metadata + selective frame overrides only where the shape genuinely changes.

## 2. Phase 1 animation set

### Idle — 4 frames
Floating combat idle. Keep motion subtle and readable.

Suggested motion:
1. Neutral float.
2. Slight lift / breathing rise.
3. Peak / short hold.
4. Return / drop toward neutral.

Secondary motion may affect hair, weapon, clothing, or equipped wings, but must not overpower the Hero.

### Attack — 6 frames
Primary oversized-sword attack. The intended motion is a large weighted slash from a wound-up position into a forward/downward strike.

1. Ready — near idle, prepared to strike.
2. Wind-up / anticipation — sword pulled behind or above the shoulder; body loads backward slightly.
3. Swing — torso drives forward and the sword accelerates through the arc.
4. Impact — strongest readable strike frame; damage/VFX timing should align here.
5. Follow-through — sword continues past impact so the weapon feels heavy rather than snapping back immediately.
6. Recovery — body and sword return toward idle balance.

Attack quality priorities: anticipation, readable impact, and follow-through.

### Hurt — 2–3 frames
Keep short.

- Hit/recoil.
- Optional recoil peak.
- Recover to idle.

### Death — 2–3 frames
Keep deliberately short to reduce graphics workload.

Recommended 3-frame version:
1. Fatal hit.
2. Collapse / loss of floating posture.
3. Final defeated pose held on screen.

The Hero does not need to fall into a walking-character ground pose; the final state may read as a low, powerless floating/drop pose.

### Walk
Not required. ThornieDungeons battle Hero uses floating movement and wing equipment rather than walking locomotion.

## 3. Hero proportions

Approved direction:

- Head: ~45% of total Hero height.
- Torso: short and compact.
- Legs: short and visually secondary.
- Hero base pose: floating combat-ready stance, slightly forward-oriented, knees/legs relaxed rather than straight.
- Oversized sword: ~95–110% of Hero height.
- Equipped wings: each wing roughly comparable to the head in visual size; wings are equipment, not part of the Hero base.
- Silhouette must remain legible at mobile battle size.

## 4. Base Hero body structure

Balanced 10-part asymmetric rig, optimized for a right-facing sword user with no walk requirement:

1. `head`
2. `torso`
3. `hip`
4. `left_arm`
5. `right_upper_arm`
6. `right_lower_arm_hand`
7. `left_leg`
8. `right_leg`
9. `left_foot`
10. `right_foot`

Why asymmetric: the right arm drives the weapon and needs elbow-level articulation for a convincing large-sword attack. The left arm is primarily balance/support and can remain one part. Legs do not need upper/lower segmentation because V5 has no walk cycle.

## 5. Hair

Hair is not baked into the body.

Minimum structure:

- `hair_back`
- `hair_front`

Default direction: short messy dark hair with a small topknot, but hair remains replaceable/cosmetic.

Hair follows the head anchor and may receive small secondary-motion offsets or selective overrides where necessary.

## 6. Equipment slots

V5 preserves the current conceptual equipment categories:

- Hat
- Outfit
- Arms
- Shoes
- Weapon
- Wings

Equipment artwork may contain multiple visual parts when needed. A slot does not imply a single PNG.

Examples:

- Outfit may include `outfit_torso` and `outfit_hip`.
- Arms may include `arms_left`, `arms_right_upper`, and `arms_right_lower`.
- Shoes use left/right visual parts.
- Weapon is anchored at the right-hand grip.
- Wings are independent rear equipment.

## 7. Base Hero clothing and palette

Phase 1 Base Hero is male.

Base clothing must be deliberately minimal so equipment can fully replace it:

- simple sleeveless undershirt / tank top;
- tight fitted pants;
- minimal neutral foot covering if required by the body art;
- no decorative armor;
- no hat;
- no wings;
- no weapon baked into the body.

Recommended neutral palette:

- skin: light-to-medium neutral warm tone;
- hair: very dark brown / near-black;
- base tank: off-white / light gray;
- fitted pants: charcoal / dark gray;
- base foot/ankle covering: dark neutral.

Keep the base low-contrast so equipped gear becomes the visual focus.

## 8. Current heavy-armor coverage rule

The currently planned armor families are visually thick/full-cover:

- Azure
- Robot
- Skeleton

For these families, use full replacement coverage instead of trying to preserve visible Base Hero clothing.

### Outfit
- Fully covers/replaces visible `torso` and `hip` presentation where the armor is worn.
- Base tank/fitted pants should not need to remain visible through the heavy armor.

### Arms
- Heavy arm equipment fully replaces covered arm visual parts.
- Do not require visible base arm artwork underneath the armor silhouette.

### Shoes / leg armor
- Heavy footwear/leg equipment may fully replace the feet and overlap the lower leg region as needed.

V5 should support partial coverage in the future for fashion/light clothing, but Phase 1 does not need complex per-pixel mask assets. Prefer semantic part-level coverage and full visual replacement for thick armor.

## 9. Wings

Wings are equipment, never part of the Base Hero.

Rules:

- No wings when the slot is empty.
- Default layer is behind the Hero body.
- Wing attachment follows an upper-back anchor.
- Basic wing equipment may use one reusable image plus transforms.
- Only create animation-specific wing overrides if the shape must actually change.
- Wings should provide secondary motion, not become the main animation driver.

Suggested behavior:

- Idle: subtle motion only.
- Attack: slight opening/reaction to body force.
- Hurt: small recoil.
- Death: weaken/fold/drop visually.

## 10. Weapon rules

- Weapon is separate equipment.
- Primary weapon pivot is the grip point in the right hand.
- Oversized sword target length: ~95–110% of Hero height.
- Large sword must feel weighted, especially through attack anticipation and follow-through.
- Reuse a single weapon image with transform metadata whenever possible.
- Add frame-specific weapon art only when perspective or shape cannot be represented cleanly by transform alone.
- Weapon layer order may change during an animation frame (for example, behind body in wind-up and in front during the strike).

## 11. Canvas and technical art standard

Master asset standard:

- Canvas: `768 x 768 px`.
- Format: transparent PNG.
- Same coordinate space/origin for compatible parts and frame overrides.
- All Phase 1 Hero frames/actions must remain inside this canvas.
- Do not change canvas size between animation frames.

Recommended occupied area:

- Hero body height: roughly 52–60% of the canvas (~400–460 px target).
- Hero placed somewhat left of canvas center so the right side has room for the oversized sword attack arc.
- Keep enough empty area for equipment and attack extension.

The 768px master is a source-resolution choice, not the final on-screen display size. Runtime should scale the composed Hero to the battle layout.

## 12. Anchor and pivot standard

### Root
`root` = hip center.

The Hero floats, so the body root should be hip-centered rather than foot-grounded.

### Recommended pivots / anchors

- `root` — hip center
- `head` — neck connection
- `hat` — head/top attachment
- `torso` — waist/hip connection
- `shoulder_left`
- `shoulder_right`
- `elbow_right`
- `hand_right` / `weapon_grip`
- `ankle_left`
- `ankle_right`
- `wing_back` — upper back / shoulder-blade region

Part rotation guidance:

- Head pivots at neck.
- Torso pivots near waist/hip.
- Left arm pivots at left shoulder.
- Right upper arm pivots at right shoulder.
- Right lower arm/hand pivots at right elbow.
- Legs pivot at hip.
- Feet pivot at ankle.
- Weapon pivots at grip.
- Hair and hat follow head.
- Wings follow the upper-back attachment while retaining their own local motion.

Graphics does not need to author runtime JSON. Graphics should provide clean separated PNGs, composite frame references, and a pivot/anchor guide. DEV converts approved placement into metadata.

## 13. Layering

Default conceptual order from back to front:

1. Wings
2. Hair Back
3. Back limb(s)
4. Torso / Hip
5. Outfit
6. Front leg / shoes as required
7. Weapon where appropriate
8. Front arm
9. Head
10. Hair Front
11. Hat

Layer order must not be absolutely fixed for every animation. Attack frames may override weapon or limb depth so the sword can pass naturally from behind the body to the front.

## 14. Hybrid animation rule

Do not redraw every body part for every frame.

Default behavior:

- reuse base part;
- move/rotate/scale through animation metadata;
- create a frame override only when the original shape cannot represent the pose cleanly.

Typical override candidates:

- strongly bent weapon arm;
- hand/grip shape;
- extreme hair motion;
- cloth deformation;
- wing fold/open shape;
- weapon perspective change.

This is the main workload-control principle of Hero V5.

## 15. Gender-ready architecture

V5 must be designed so a future character-sex selection does not require a second animation system.

Use a shared rig and shared anchors for all body variants.

Phase 1:

- build Male Base first.

Future female variant:

- preserve the same canvas, pivots, anchors, animation timing, and equipment slots;
- primarily alter `torso` and `hip` silhouette;
- minor leg/body-shape adjustments are allowed only when needed;
- keep differences subtle enough to preserve the chibi rig and equipment compatibility.

Equipment rule:

- shared equipment art by default;
- Weapon, Hat, Wings, and many Shoes should normally be reusable;
- create male/female-specific Outfit or Arms artwork only when a close-fitting silhouette genuinely requires it;
- do not require every item to have two gender variants.

## 16. First integration test set

After Base Hero animation is approved, validate the system using existing equipment themes:

- Azure armor
- Azure sword
- Angel Wings

This should verify:

- full body coverage;
- right-arm attack articulation;
- shoe/leg alignment;
- weapon grip and depth changes;
- wing placement behind Hero;
- hat/hair compatibility where relevant;
- animation stability with a fully equipped character.

Robot and Skeleton armor should follow the same heavy-armor replacement contract after the V5 architecture is proven.

## 17. Graphics production workflow

Recommended sequence:

1. Create/approve Base Hero concept and proportions.
2. Create the separated 10-part Base Hero and hair layers.
3. Create composite animation references for Idle / Attack / Hurt / Death.
4. Approve movement and silhouette before mass-producing equipment.
5. Cut/export selective animation overrides only where required.
6. Create the first heavy armor test set and weapon/wings test assets.
7. Provide pivot/anchor reference guide.
8. DEV implements animation metadata and runtime composition.
9. Compare runtime result against approved composite references.

Graphics deliverables should favor production-ready transparent PNGs and clear composite previews. Do not create CSS particles or bake background art into Hero sprite assets.

## 18. Acceptance priorities

In order:

1. readable on mobile;
2. strong chibi silhouette;
3. smooth floating motion;
4. convincing oversized-sword weight;
5. clean equipment replacement;
6. reliable anchor/pivot alignment;
7. equipment extensibility;
8. future gender-body compatibility.

## 19. Future responsive breakpoint note

Current application layout is mobile-first and currently caps the primary game root around 430px wide. Hero V5 master assets must remain independent from that cap.

Future UI work should evaluate responsive breakpoints rather than scaling the entire mobile UI without limits. Suggested direction (not part of Hero V5 implementation scope):

- Mobile: current ~430px-class layout.
- Tablet: wider battle/UI layout approximately 600–700px-class.
- Desktop: approximately 700–800px-class or a dedicated desktop layout.

Hero/Monster/UI presentation should scale proportionally with the battle arena at those breakpoints. The 768×768 Hero V5 master resolution is intentionally suitable for future larger tablet/desktop rendering.

## 20. Scope boundary

This document defines Hero V5 visual/animation architecture and production reference only.

It does not authorize:

- immediate replacement of the current production Hero;
- gameplay-stat changes;
- new equipment-system behavior beyond what is needed for visual composition;
- responsive breakpoint implementation;
- mass production of Robot/Skeleton/Azure V5 assets before Base Hero and first integration test are approved.
