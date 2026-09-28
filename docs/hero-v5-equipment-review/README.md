# Hero V5 Robot + Skeleton — concept approval

THORNIE_GRAPHICS_HANDOFF
STATUS: READY_FOR_PROJECT_LEAD_REVIEW

Project: ThornieDungeons
Branch: graphics/hero-v5-robot-skeleton
Base main: 76fc90c5d9c080a618846dc73d5005ed268e319e

## Scope

- Robot heavy armor + greatsword, inspired by Raid Boss Robo Phoenix.
- Skeleton heavy armor + greatsword, inspired by Raid Boss Hell Dragonlord (manifest identity `dark_dragonlord`). Human-worn armor, not a replacement skeleton body.
- Current deliverables are two concept sheets only. No production frame/layer package or R2 publication yet.

## Verified reference pipeline

Read AGENTS.md, docs/HERO-SPRITE-V5.md, docs/ACTIVE-DEVELOPMENT-ROADMAP-V1.md, r2-upload/README.md, current manifests, and Azure AZURE_FRAME_CONTRACT.json, PUBLICATION.json, SOURCE_VALIDATION.json, IDLE_SWORD_RUNTIME_PATCH.json and SWORD_REPLACEMENT.json.

Production Azure uses 768×768 RGBA PNG, common origin (0,0), eight synchronized frames: idle_01–03, attack_01–03, death_01–02. All 56 active mapped Azure layer images were opened and their dimensions/modes verified.

Exact equipment layer order:
coverage_underlay → torso_armor → legs_boots → arm_rear → helmet → sword → arm_front.

Full composition order:
wing_far → base → hair_back → hair_front → equipment layers above → wing_near.

Important historical-record caveat: AZURE_FRAME_CONTRACT.json retains an old REVIEW_ONLY status and empty Idle sword description. PUBLICATION.json plus active manifest mappings and SWORD_REPLACEMENT.json establish approved newer behavior: Idle sword is visible via sword_w7_idle_v3.png; Attack sword is visible; Death sword layers remain unchanged/empty. SWORD_REPLACEMENT supersedes the earlier source grip in IDLE_SWORD_RUNTIME_PATCH. Do not reproduce the obsolete transparent Idle behavior.

Current grip anchors: idle_01 (270,505), idle_02 (270,493), idle_03 (270,501), attack_01 (310,309), attack_02 (489,448), attack_03 (413,551). Sword master is separate; transforms are baked offline; front glove occludes grip. Master-to-frame fitting must be validated for each new design; do not assume identical silhouette/scale solely from Azure.

No Robot/Skeleton V5 equipment placeholders or mappings found; only Azure exists under assets.hero001.v5.g2.equipment. Proposed future paths follow the same family: hero/v5/g2/equipment/robot/ and hero/v5/g2/equipment/skeleton/, with identical frame/layer structure and masters/. These are proposals, not published paths.

## Theme evidence

- Manifest: assets.raidBosses.robo_phoenix.animations.idle[0] → sprite/raid/robo_phoenix_idle_1.png.
- Manifest: assets.raidBosses.dark_dragonlord.animations.idle[0] → sprite/raid/dark_dragonlord_idle_1.png.
- Boss pixels are absent from the staging tree, so inspected matching source-package images: robo_phoenix_raid_frames_TRANSPARENT_FIXED.zip (libfile_2e51299251c88191b84c62fea69ca930), dark_dragonlord_r2.zip (libfile_ee51f5920d6c8191972a3e2f05a07eaa). These are source visual references, not a claim of live R2 byte comparison.
- Robot borrows white/gold/red mechanical feather plates and orange cores. Skeleton borrows obsidian/purple armor, ivory bone edging, curved horns and crimson crystals.
- Both concepts were generated using actual idle_01 base, an Azure composition and the relevant boss image as references. Wings/tails/monster anatomy are excluded.

## Concept deliverables

- robot-phoenix-concept.png — full heavy suit, sealed visor, Phoenix mechanical forms, matching broad greatsword and isolated weapon design view.
- skeleton-dragonlord-concept.png — full skull/dragonbone-themed heavy suit, matching obsidian/crimson greatsword and isolated weapon design view.

Generated using built-in imagegen. Prompts preserve human HD-chibi proportions, right-facing floating stance, full coverage, compact grips, separate greatsword detail and thematic boss cues. These are design references, not exact overlays. Concept sheets retain atmospheric backdrops despite transparent-output instructions; they must NOT be used as production PNG layers. Weapon view orientation in the Robot concept is tip-down; the eventual master follows Azure's upright tip-up convention.

## Validation and approval boundary

- Visual theme/coverage/sword family: concept reviewed.
- Existing pipeline/frame/layer contract: inspected and recorded; not yet demonstrated by new production files.
- Exact anchors, frame alignment, coverage underlay, transparency, grip occlusion, eight-frame animation consistency, mobile-scale clarity and final hashes: pending production export after approval.
- Base Hero, Wing R5, Azure, all other approved assets, gameplay, Phaser, frontend/API and schema: untouched.
- Manifest: not required yet / unchanged.
- R2: pending visual approval and production validation.

Next: Project Lead approves or revises the two armor/sword designs. Then author each eight-frame/seven-layer pack (56 equipment PNGs per set), create upright sword masters, composites/animation review and validation/contract files using the Azure packaging pattern. Review exact fitting before normal R2 publication; do not publish these concept sheets as production equipment.
