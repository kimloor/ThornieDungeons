# ThornieDungeons — Active Development Roadmap V1

Status: **ACTIVE-DESIGN — current execution roadmap**

This document is the current high-level roadmap for the active development track discussed on 2026-09-22.

It intentionally focuses only on the work that directly affects the current frontend/game presentation architecture:

1. Hero V5
2. Inventory V2 refactor
3. Phaser migration for Dungeon Combat + Arena
4. Final architecture cleanup after those systems stabilize

Social, Guild, Chat, Raid feature expansion, Shop, Crafting, Summoning, and unrelated backend work are **outside this roadmap** unless explicitly added later.

---

## 1. Guiding principles

- Do not rewrite working gameplay systems just to adopt Phaser.
- Keep Battle Core, Arena resolver/API, save/checkpoint, rewards, skill rules and Pet rules unchanged unless separately approved.
- React/DOM remains the application/page UI layer.
- Phaser is used only for real-time battlefield presentation in Dungeon Combat and Arena.
- Hero V5 remains modular, layered and frame-based.
- Inventory remains DOM/React.
- Refactors must preserve behavior unless the task explicitly includes a behavior change.
- Source-first workflow: edit source -> `node build.js` -> syntax/tests -> staging/user check -> QA -> merge/release.
- Do not remove fallbacks or old renderers until the replacement is verified.

---

## 2. Current state

### Completed / stable enough to build on

- Raid + Arena UI decomposition from Scope B is complete and merged.
- Arena already has separated battle presentation components including `ArenaBattleStage`.
- Phaser prototype exists in Draft PR #10 and has a working isolated preview.
- Phaser experiment confirms the current Battle Core can remain authoritative while Phaser renders battlefield visuals.
- Hero V5 design direction is documented and locked as a modular frame-based sprite system.
- Inventory UI V2 production behavior/design contract exists.

### Still pending

- Hero V5 artwork/runtime replacement is not complete.
- Inventory V2 structural refactor is not complete.
- Phaser prototype is not yet production architecture.
- Production battle anchors/layout for Phaser are not finalized.
- Arena still uses placeholder DOM battle-stage visuals.
- Final App/styles architecture cleanup should wait until the three major tracks above stabilize.

---

## 3. Track A — Hero V5

### Goal

Produce and integrate the future Hero visual system without mixing it into unrelated gameplay changes.

### A1 — Base Hero production

- lock final Base Hero concept/proportions;
- produce Idle 3 frames;
- produce Attack 3 frames;
- produce Death 2–3 frames;
- verify mobile readability;
- lock master canvas and frame alignment.

### A2 — Layer/export validation

- verify synchronized layer composition;
- verify hair/head/body/arm/weapon/wings ordering;
- verify equipment overlay coverage;
- define manifest keys/paths;
- create first complete equipment test set.

### A3 — Phaser-ready runtime adapter

Only after A1/A2 are approved:

- implement HeroActor V5 layer composition in Phaser;
- preserve frame-based animation;
- do not synthesize Attack using limb rotation/bone animation;
- support equipment layer swapping from existing equipment state;
- verify V4 fallback remains available during rollout.

### A4 — Hero V5 production replacement

After QA:

- switch Phaser Hero renderer from V4-compatible/fallback rendering to V5;
- verify equipment appearance;
- verify Idle/Attack/Death;
- verify mobile/tablet/desktop;
- keep rollback path until production verification is complete.

Reference:
- `HERO-SPRITE-V5.md`
- `HERO-OVERLAY-V4.md`
- `PHASER-COMBAT-ARENA-V1.md`

---

## 4. Track B — Inventory V2 refactor

### Goal

Reduce Inventory component complexity while preserving all current Inventory behavior and layout rules.

### B1 — Component decomposition

Target structure:

```text
InventoryOverlayV2
├─ InventoryHeader
├─ EquipmentStage
│  └─ EquipmentSlot
├─ InventoryToolbar
├─ InventoryGrid
│  └─ InventoryCell
├─ InventoryFilterModal
├─ OverflowModal
├─ ItemDetailModal
│  ├─ ItemStats
│  ├─ ItemComparison
│  └─ ItemActions
└─ GameDock
```

### B2 — Dead/duplicate code cleanup

- confirm whether legacy `InventoryOverlay` is unused;
- remove only after repo-wide reference check;
- consolidate item/icon/slot presentation only when there are real shared callers;
- preserve capacity/overflow semantics;
- preserve compare logic;
- preserve sell/salvage/equip behavior.

### B3 — Responsive verification

Verify:

- mobile <=430;
- tablet 431–700;
- desktop >700;
- equipment stage;
- inventory grid expansion/collapse;
- compare popup;
- toolbar;
- GameDock;
- safe area and overflow.

### B4 — Inventory completion gate

Inventory refactor is complete only when:

- behavior is unchanged;
- build/syntax/tests pass;
- focused Inventory smoke test passes;
- no unrelated battle/Phaser code is changed.

Reference:
- `INVENTORY-UI-V2.md`

---

## 5. Track C — Phaser Combat + Arena migration

### Goal

Move only real-time battlefield presentation to Phaser while preserving existing gameplay ownership.

### C0 — Prototype review / design lock

- keep Draft PR #10 as experiment;
- collect visual feedback;
- keep prototype coordinates provisional;
- do not merge prototype directly as final production architecture.

### C1 — Shared Phaser foundation

Create reusable runtime pieces:

```text
src/phaser/
├─ runtime/
├─ scenes/
│  ├─ BattleScene
│  └─ ArenaScene
├─ actors/
│  ├─ HeroActor
│  ├─ PetActor
│  └─ MonsterActor
├─ presentation/
│  ├─ EventBridge
│  ├─ PresentationQueue
│  ├─ DamageFeedback
│  └─ VfxManager
└─ layout/
   └─ ResponsiveAnchors
```

No gameplay logic moves into Phaser.

### C2 — Production Battle anchors

Define and lock:

- `HERO_ANCHOR`
- `PET_ANCHOR`
- `MONSTER_SLOT_1`
- `MONSTER_SLOT_2`
- `MONSTER_SLOT_3`
- `VFX_HERO_ANCHOR`
- `VFX_PET_ANCHOR`
- `VFX_MONSTER_ANCHOR`

Verify 1/2/3-monster layouts and responsive scaling.

### C3 — Dungeon Battle migration

Move into Phaser:

- Hero;
- Pet;
- Monsters;
- target marker;
- VFX;
- hit/death feedback;
- floating feedback;
- battlefield positioning.

Keep in DOM:

- top bar;
- queue;
- quick slots;
- Attack/Auto/Flee/Settings;
- x1/x2/Skip controls;
- combat log;
- modal/result UI.

Keep DOM battlefield fallback during verification.

### C4 — Arena Battle Stage migration

Replace only `ArenaBattleStage` visual implementation.

Reuse:

- HeroActor;
- PetActor;
- presentation queue;
- VFX;
- responsive layout infrastructure.

Preserve:

- Arena lobby;
- tickets;
- opponent search/list;
- Arena API;
- server-resolved actions;
- Battle HUD;
- Action Panel;
- Battle Log;
- Result;
- rating/rewards.

### C5 — Phaser production cutover

After Dungeon + Arena QA:

- Phaser becomes default battlefield renderer;
- remove temporary renderer flag;
- remove obsolete DOM battlefield-only rendering;
- keep DOM HUD/page UI;
- remove experiment-only code;
- verify production.

Reference:
- `PHASER-COMBAT-ARENA-V1.md`
- `BATTLE-SYSTEM-V1.md`
- `BATTLE-VFX-V1.md`

---

## 6. Track D — Final architecture cleanup

Start only after Hero V5, Inventory refactor and Phaser renderer boundaries are stable.

### D1 — App/controller cleanup

Incrementally move toward:

```text
App
├─ AuthController
├─ CharacterController
├─ NavigationController
├─ InventoryController
├─ PetController
└─ BattleController
```

Do not rewrite the full application in one pass.

### D2 — Feature folder stabilization

Target direction:

```text
src/ui/
  shared/
  character/
  inventory/
  pet/
  battle/
  raid/
  arena/

src/phaser/
  runtime/
  scenes/
  actors/
  presentation/
  layout/

src/styles/
  base.js
  layout.js
  navigation.js
  character.js
  inventory.js
  pet.js
  battle.js
  raid.js
  arena.js
```

Move files only after dependencies are clear; avoid repeated churn.

### D3 — Shared helper cleanup

- shared config fetch/cache fallback helper;
- shared loading/error/back primitives only when real reuse exists;
- remove confirmed dead legacy symbols;
- do not create speculative abstractions.

---

## 7. Recommended execution order

The recommended order is:

```text
1. Inventory V2 refactor
   ↓
2. Phaser shared foundation + production anchors
   ↓
3. Dungeon Battle Phaser migration
   ↓
4. Arena Battle Stage Phaser migration
   ↓
5. Hero V5 artwork approval
   ↓
6. Hero V5 Phaser integration
   ↓
7. Phaser production cutover
   ↓
8. Final App/styles/repository cleanup
```

Hero V5 artwork production can run in parallel with steps 1–4 because Graphics work is largely independent.

Do **not** block Phaser foundation work waiting for final Hero V5 art. Use current/fallback Hero assets until V5 is approved.

---

## 8. Why Inventory comes first

Inventory is included before the main Phaser migration because:

- it is a self-contained DOM/React refactor;
- it reduces current UI complexity before the battle renderer changes;
- it avoids mixing Inventory cleanup with high-risk Phaser work;
- it gives the codebase a cleaner boundary before final architecture cleanup.

Inventory does not move into Phaser.

---

## 9. Milestone gates

### Gate 1 — Inventory stable

Required before moving to the main high-risk renderer migration:

- component decomposition complete;
- no Inventory behavior regression;
- responsive checks pass;
- build/tests pass.

### Gate 2 — Phaser foundation stable

Required before replacing production Dungeon battlefield:

- scene lifecycle stable;
- actor lifecycle stable;
- responsive anchor system locked;
- event bridge proven;
- no gameplay state duplication.

### Gate 3 — Dungeon Battle approved

Required before Arena cutover:

- Battle Core output unchanged;
- 1/2/3-monster layouts pass;
- target switching works;
- VFX/hit/death feedback works;
- x1/x2/Auto/Skip still behave correctly;
- checkpoint/resume unaffected;
- user visual approval + QA.

### Gate 4 — Arena approved

Required before removing DOM battlefield fallback:

- Arena stage renders Hero/Pet teams correctly;
- action/log replay matches server results;
- Arena API/tickets/rating/rewards unchanged;
- user visual approval + QA.

### Gate 5 — Hero V5 approved

Required before V5 replaces V4:

- Base Hero frames approved;
- equipment test set approved;
- Phaser layer composition matches reference;
- no layer drift;
- mobile readability passes.

### Gate 6 — Final cleanup

Only after all above gates:

- remove temporary flags;
- remove obsolete battle renderer code;
- archive experiment docs/branches when safe;
- finalize architecture docs.

---

## 10. Risk classification

- Inventory V2 refactor: **MEDIUM-HIGH**
- Phaser shared foundation: **HIGH**
- Dungeon Battle Phaser migration: **HIGH**
- Arena Battle Stage Phaser migration: **HIGH**
- Hero V5 runtime integration: **HIGH**
- final App/styles architecture cleanup: **HIGH**

All HIGH-risk scopes require branch + focused QA + user verification before release.

---

## 11. Out of scope

This roadmap does not include:

- Guild/Chat/Social work;
- Raid feature redesign;
- Raid Phaser migration;
- Battle Core rewrite;
- Arena gameplay redesign;
- Pet rebalance;
- economy changes;
- Shop/Crafting/Summoning feature work;
- Spine/skeletal animation;
- moving Inventory to Phaser.

---

## 12. Roadmap completion condition

This roadmap is complete when:

- Inventory V2 is structurally clean and behavior-stable;
- Dungeon Combat battlefield uses Phaser in production;
- Arena battle stage uses Phaser in production;
- Hero V5 is approved and integrated into the Phaser Hero renderer;
- temporary DOM battlefield/fallback code is removed safely;
- final App/styles/folder architecture is documented and stable.
