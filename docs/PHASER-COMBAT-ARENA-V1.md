# Phaser Shared Presentation Architecture V1

Status: **ACTIVE-DESIGN — approved shared presentation direction**

## 1. Purpose

This document defines how ThornieDungeons uses Phaser as a reusable 2D presentation runtime while preserving existing gameplay/data authority.

Phaser is for animation-heavy visual surfaces. It is **not** the application framework and is **not** a gameplay resolver.

Active roadmap usage:
- Dungeon Combat battlefield
- shared Hero V5 renderer
- Inventory live Hero preview
- Arena V2 battle presentation
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

## 7. Inventory live preview

Inventory remains React/DOM. Only the central Hero presentation surface is rendered with Phaser.

Flow:

~~~text
React authoritative equipment state
        ↓
optional previewLoadout
        ↓
EquipmentVisualResolver
        ↓
HeroRenderer
        ↓
HeroPreviewScene
~~~

### Ownership and preview state
- authoritative equipped state remains in the application/data layer;
- `previewLoadout` is temporary presentation input only;
- selecting a compatible candidate item rebuilds preview from authoritative state plus that one slot replacement;
- closing/cancelling restores authoritative visuals;
- Equip success refreshes from confirmed authoritative equipment;
- Equip failure restores authoritative visuals;

### Compare boundary
Item detail/comparison remains DOM. Phaser does not calculate or render CURRENT/NEW stats, CP, deltas, rarity/Enhance/Enchant text, or Equip/Unequip controls.

The DOM comparison may drive the live visual preview:

~~~text
ItemComparison (DOM)
→ previewLoadout
→ EquipmentVisualResolver
→ HeroPreviewScene
~~~

### Equipment visual fallback
A missing equipment visual is a slot-level presentation failure, not a Hero-level failure.

Keep Hero V5 active and fall back per slot:
- helmet -> base head/hair;
- armor -> base body/clothing;
- gloves -> base arms/hands;
- boots -> base legs/feet;
- weapon -> no weapon;
- wings -> no wings;
- accessory -> no accessory overlay.

Use whole-actor legacy fallback only if required Hero V5 core assets/layers or core renderer initialization cannot render safely.

Rules:
- never mix legacy V3/V4 equipment layers onto Hero V5;
- never guess an asset key/path from an item ID;
- only manifest/config-defined visual mappings are valid;
- an incomplete declared equipment frame bundle is unsupported and must use slot-level fallback;
- do not render an equipment item on some synchronized frames and silently drop it on others;
- optional equipment texture failure must not change gameplay/equipment state.

Hero preview may use the shared Idle animation and a small presentation-only equip glow/transition after the core preview is stable.


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
W8  Inventory Hero Live Preview
 ↓
W9  Arena V2 + Phaser
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
- changing Arena outside the approved ARENA-V2-W9.md contract, or changing Raid gameplay
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

## 15.2 W7 Hero V5 runtime close — 2026-09-27

W7 completed browser QA through Ver 1.0.16 on iPhone.

Verified presentation scope:
- Hero V5 G2 Base / Wing R5 / topknot hair;
- Azure full and partial equipment composition;
- Idle / Attack / Hurt / Death playback;
- Azure Idle weapon grip alignment;
- equip/unequip behavior including weapon removal during Attack;
- unchanged locked Hero anchor with presentation-only artwork offset/scale;
- no end-of-battle Phaser teardown error;
- x1/x2 control replaced in-place by Skip after five completed player turns, avoiding header/layout expansion.

Runtime guardrails remain:
- Hero V5 remains separately opt-in via `?heroV5=1`; Dungeon Phaser itself is production-default from Ver 1.0.20 onward;
- V3 remains the fallback;
- gameplay/resolver/persistence/reward authority remains outside Phaser;
- Victory animation/presentation remains W10 scope.

---

## 15.3 W8 Inventory Hero preview close — 2026-09-27

W8 completed user browser QA and production release at Ver 1.0.17.

Verified presentation scope:
- Inventory center Hero uses the shared Phaser HeroRenderer;
- Inventory grid, slots, Compare, stats and mutations remain DOM/application-owned;
- Compare drives temporary candidate visuals without mutating authoritative equipment state;
- closing Compare restores the authoritative Hero visual;
- equipped Wings render through the canonical production Angel visual selection;
- weapon/wings may overlap into equipment lanes while DOM equipment slots remain foreground;
- narrow iPhone layout keeps the full-stage Phaser host;
- final Inventory Hero horizontal anchor is 55.8%;
- Character Status preview was explicitly removed from W8 scope;
- repeated Inventory open/close does not duplicate Phaser canvases.

Release:
- PR #31 merged to main;
- production frontend deployment and verification passed.

---


## 15.4 W9 Arena V2 contract — 2026-09-28

W9 Arena direction has been explicitly expanded beyond presentation-only migration.

For W9:
- ARENA-V2-W9.md is the gameplay/economy/UX source of truth;
- this document remains authoritative for the shared Phaser presentation boundary and reusable renderer/asset/VFX architecture;
- older wording that says current Arena lobby/tickets/API/rating/rewards must remain unchanged is superseded where ARENA-V2-W9.md explicitly redesigns those systems;
- Phaser still must not become the combat/rating/economy authority;
- Battle Core and server-side settlement remain authoritative.

---

## 15.5 Production presentation cutover — 2026-09-29

Browser QA after the W9 production cutover made the shared Phaser surfaces production-default:
- Dungeon Combat uses Phaser by default; `?phaserBattle=0` or `globalThis.__THORNIE_PHASER_BATTLE__ = false` is the emergency presentation fallback.
- Inventory Hero Preview uses Phaser by default; `?phaserPreview=0` or `globalThis.__THORNIE_PHASER_HERO_PREVIEW__ = false` is the emergency fallback.
- Arena V2 remains Phaser-by-default and uses the approved `arenaUi.background` manifest asset.
- This changes presentation selection only; Battle Core, save, reward and API authority remain unchanged.

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
