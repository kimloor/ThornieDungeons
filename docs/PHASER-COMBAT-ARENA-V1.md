# Phaser Shared Presentation Architecture V1

Status: **ACTIVE-DESIGN — approved shared presentation direction**

## 1. Purpose

This document defines how ThornieDungeons uses Phaser as a reusable 2D presentation runtime while preserving existing gameplay/data authority.

Phaser is for animation-heavy visual surfaces. It is **not** the application framework and is **not** a gameplay resolver.

Active roadmap usage:
- Dungeon Combat battlefield
- shared Hero V5 renderer
- Inventory/Character live Hero preview
- Arena battle stage
- Victory / Boss / Raid presentation
- Summoning / Enhance / Craft presentation

Dungeon exploration is intentionally outside the active roadmap.

React/DOM remains the default for page UI, text-heavy screens, forms, lists, modals, Inventory grid, Guild, Chat, Friend, Settings and other application surfaces.

---

## 2. Authority boundary

### Gameplay/data authority remains outside Phaser

Phaser must never calculate or decide:
- action order / Speed Queue
- hit/miss/crit
- damage/heal values
- target legality
- status proc/duration
- cooldown/SP cost
- Pet AI
- battle outcome
- Arena resolution/rating/rewards
- Raid rewards
- Summoning result
- Enhance/Craft result
- Inventory Equip/Unequip persistence
- checkpoint/save/result commit state

### Phaser may control presentation

Phaser may control:
- sprite/layer placement
- synchronized frame display
- attack/hit/death/victory presentation
- VFX
- floating damage/heal/miss feedback
- target markers
- particles
- camera shake/flash/fade/zoom where approved
- presentation timing
- x1/x2 visual speed
- preview-only equipment visuals

Presentation failure must never alter authoritative game state.

---

## 3. Target shared architecture

~~~text
Game State / Resolver / API
        ↓
Presentation Adapter
        ↓
PresentationEventBridge
        ↓
PresentationQueue
        ↓
Shared Renderers
 ├─ HeroRenderer / HeroActor
 ├─ PetActor
 ├─ MonsterActor
 ├─ BossActor
 └─ VfxManager
        ↓
Scenes
 ├─ CombatScene
 ├─ ArenaScene
 ├─ HeroPreviewScene
 ├─ VictoryScene
 └─ other approved presentation scenes
~~~

Asset flow:

~~~text
R2 Manifest
    ↓
AssetResolver
    ↓
TextureRegistry
    ↓
Shared Renderers / Scenes
~~~

No screen or scene should independently reconstruct asset URLs when a shared resolver can provide the approved manifest mapping.

---

## 4. Shared modules

### 4.1 HeroRenderer / HeroActor

One logical Hero renderer must be reused across:
- Combat
- Arena
- Inventory preview
- Character Status preview
- Player Card/Profile preview where appropriate
- Victory presentation

Do not create separate CombatHero, InventoryHero and ArenaHero implementations.

Responsibilities:
- render synchronized Hero layers
- switch animation state
- apply approved equipment visuals
- place/scale the whole actor
- expose presentation-only state

It must not decide equipment ownership, stats or save state.

### 4.2 EquipmentVisualResolver

Input:
- Hero visual identity
- authoritative or preview equipment IDs
- animation state
- frame index

Output:
- canonical visual layers for available equipment slots

Expected categories may include:
- helmet/hair
- armor/body
- gloves/arms
- boots/legs
- weapon
- accessory visual when applicable
- wings

The resolver reads approved manifest/config data. Screens/scenes must not guess paths.

### 4.3 AssetResolver / TextureRegistry

Responsibilities:
- resolve canonical manifest entries
- preload required presentation assets
- cache textures where safe
- deduplicate repeated loads
- provide explicit fallback behavior
- keep scene code independent from R2 URL construction

### 4.4 ActorPresentationModel

Normalize Hero/Pet/Monster/Boss presentation data into scene-friendly read-only form, for example:

~~~text
id
type
name
hp / maxHp
alive
statuses
animationState
assetSet
anchorType
facing
selected
~~~

This model is presentation data only.

### 4.5 PresentationEventBridge

Translate authoritative resolved state/log events into scene-independent presentation events.

Examples:
- BATTLEFIELD_SYNC
- ACTION_BEGIN
- ACTOR_ATTACK
- VFX_PLAY
- DAMAGE_FEEDBACK
- HEAL_FEEDBACK
- MISS_FEEDBACK
- STATUS_FEEDBACK
- ACTOR_HIT
- ACTOR_DEATH
- TARGET_CHANGED
- ACTION_COMPLETE
- BATTLE_TERMINAL
- RESET_BATTLEFIELD

Every event must be replay/presentation-safe and must not re-resolve gameplay.

### 4.6 PresentationQueue

Own visual ordering and completion boundaries.

Example:

~~~text
ACTOR_ATTACK
→ motion
→ VFX
→ target hit
→ floating feedback
→ death
→ ACTION_VISUAL_COMPLETE
~~~

Responsibilities:
- x1/x2 visual timing
- Skip visual drain/cancel
- prevent terminal VFX/death from being cut off
- expose PRESENTATION_DRAINED / action-visual-complete boundaries

### 4.7 VfxManager

One shared VFX system for:
- slash
- projectile
- heal
- buff/debuff
- AoE
- particles
- screen flash
- camera shake where approved

Combat, Arena and Raid must not build separate VFX engines for equivalent effects.

### 4.8 ResponsiveSceneLayout

Use normalized coordinates and explicit scene contracts.

Current locked Combat anchors:
- Hero: 0.20, 0.50
- Pet: 0.22, 0.84
- one Monster: 0.80, 0.61
- two Monsters: 0.74,0.38 / 0.85,0.80
- three Monsters: 0.71,0.29 / 0.80,0.58 / 0.87,0.87
- Hero VFX: 0.32,0.60
- Pet VFX: 0.42,0.66
- Monster VFX: target anchor x-0.04, y-0.12

Other scenes may define their own layouts but must reuse the same layout utility instead of scattering device-specific pixel constants through actor code.

---

## 5. Combat scope

Phaser Combat may own:
- battlefield background
- Hero
- Pet
- 1–3 Monsters
- target marker
- VFX
- floating feedback
- hit/hurt/death
- battlefield responsive placement

React/DOM retains:
- top bar / turn order
- Attack / skills / quick slots
- Auto / Flee / Settings
- x1/x2 / Skip controls
- combat log
- modal/result UI shell

The DOM battlefield remains a fallback until browser/responsive QA passes.

---

## 6. Hero V5 compatibility

Hero V5 remains:
- frame-based
- modular layered
- synchronized by frame index
- non-skeletal
- 768x768 shared coordinate space

Primary wing layer contract:

~~~text
wing_far
→ Hero/body/equipment/weapon composition
→ wing_near
~~~

Approved frame-specific exceptions remain authoritative.

Phaser may:
- position/scale the whole Hero
- show the correct frame index
- swap approved equipment layers
- perform whole-actor presentation motion
- apply temporary fade/knockback/camera-relative motion

Phaser must not replace authored frames with:
- bone-driven limb animation
- runtime weapon rotation as an Attack substitute
- skeletal wing flaps
- mesh deformation/IK

The same HeroRenderer must be reused by all approved screens.

---

## 7. Inventory + Character live preview

Inventory and Character Status remain React/DOM.

Only the Hero preview is rendered with Phaser.

Flow:

~~~text
React authoritative equipment state
        ↓
optional preview equipment state
        ↓
EquipmentVisualResolver
        ↓
HeroRenderer
        ↓
HeroPreviewScene
~~~

Requirements:
- preview state must be separate from authoritative equipped state
- visual preview must not save/equip items
- Equip/Unequip actions remain existing app mutations
- item comparison/stats/filter/sort/grid remain DOM
- Hero preview may use Idle animation and small presentation-only equip effects

---

## 8. Arena scope

Arena replaces only the battlefield stage.

Reuse:
- HeroRenderer
- PetActor
- ActorPresentationModel
- PresentationEventBridge
- PresentationQueue
- VfxManager
- AssetResolver
- responsive layout

Preserve unchanged:
- lobby/opponent list
- tickets
- Arena API
- server-resolved actions
- HUD/action panel/log/result
- rating/rewards

---

## 9. Victory / Boss / Raid presentation

### Victory / Defeat
May reuse shared Hero/VFX/queue infrastructure for:
- victory pose
- wing animation
- glow/particles
- camera fade/flash
- transition into Result
- defeat animation before Retry/Map

The Result commit contract remains authoritative.

### Boss
Reusable presentation hooks may provide:
- entrance
- zoom
- shake
- aura/rage visual state
- phase-transition visuals

### Raid
Raid presentation should reuse Monster/Boss actors, VFX, asset and queue infrastructure where appropriate.

Raid gameplay/reward logic remains outside Phaser.

---

## 10. Summoning / Enhance / Craft presentation

These systems may use Phaser only for animation-heavy presentation.

Possible Summoning visuals:
- portal
- rarity glow
- reveal
- particles
- camera effects

Possible Enhance/Craft visuals:
- forge/fire/spark
- success/fail
- result reveal

React/DOM and existing game logic remain authoritative for:
- cost
- item/recipe data
- actions/buttons
- RNG/result
- economy/inventory mutation

---

## 11. Asset loading

Use existing R2/manifest contracts.

Rules:
- never guess keys or paths
- resolve real manifest entries
- validate cross-origin/WebGL loading in real browser runtime
- preload only what the active scene needs where practical
- reuse cached textures safely
- optional asset failure must fall back without corrupting gameplay
- approved Hero V5 bytes/contract remain source of truth

---

## 12. Presentation timing

Gameplay results are authoritative independently from animation completion.

Presentation may sequence events for readability but must not alter results.

x1/x2 affects presentation timing only.

Skip continues to use the authoritative fast resolver and may drain/cancel presentation safely.

Terminal action presentation must expose a clean completion boundary so Attack/VFX/Death/Victory is not visually cut off before Result navigation.

---

## 13. Rollout sequence

The active roadmap in ACTIVE-DEVELOPMENT-ROADMAP-V1.md is authoritative:

~~~text
W5  Combat Foundation + Presentation
 ↓
W6  Shared Phaser Presentation Architecture
 ↓
W7  Hero V5 Runtime Integration
 ↓
W8  Inventory + Character Live Preview
 ↓
W9  Arena Phaser
 ↓
W10 Victory / Boss / Raid Presentation
 ↓
W11 Summoning / Enhance / Craft Presentation
~~~

Dungeon exploration is not included.

---

## 14. QA expectations

Shared regression:
- gameplay/resolver output unchanged
- save/checkpoint/API/reward behavior unchanged unless separately approved
- asset paths resolve through the manifest
- fallback does not restart/reroll an encounter
- no duplicate actions or result commits
- mobile/tablet/desktop layout safe

Combat:
- Hero only / Hero+Pet
- 1/2/3 Monsters
- target switching
- Basic/skill/Pet actions
- VFX/hit/death
- x1/x2/Auto/Skip
- Victory/Defeat
- checkpoint/resume
- Phaser load failure fallback

Hero preview:
- equipment swap preview
- preview does not mutate save state
- correct layer/frame alignment
- repeated open/close does not leak canvases/textures

Arena:
- Hero/Pet combinations
- resolved action replay
- status/death/result
- resume active match
- rating/reward unchanged

---

## 15. Non-goals

This architecture does not authorize:
- rewriting Battle Core in Phaser
- moving application/page UI into Phaser
- moving Inventory grid/details/stats into Phaser
- changing Arena/Raid gameplay
- changing skill/Pet/economy balance
- skeletal/Spine migration
- duplicating Hero/VFX/asset systems per scene
- Dungeon exploration/presentation

---

## 15.1 Post-W6 text clarity follow-up

W6 user browser QA passed on iPhone, with one non-blocking presentation note: Phaser-rendered text appears blurrier/softer than equivalent DOM text.

Next presentation-polish task:
- inspect Phaser Text resolution and device pixel ratio handling on iOS Safari;
- improve name / HP / status text crispness without changing actor anchors, layout, gameplay timing or authority;
- use DOM text clarity at the same viewport as the visual comparison target.

This is a presentation-only follow-up and does not reopen W6 architecture acceptance.

---

## 16. Release rule

Phaser work touching active game surfaces is HIGH risk.

Required flow:

~~~text
latest main
→ dedicated branch
→ source changes
→ node build.js
→ syntax/focused tests
→ staging/opt-in verification
→ QA
→ user visual verification
→ approved merge
→ production verification
~~~

Keep fallbacks until the replacement surface is verified.
