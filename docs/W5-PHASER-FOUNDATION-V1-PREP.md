# W5 Phaser Shared Foundation + Production Anchors — Implementation Preparation

Status: **FROZEN PREPARATION / DOCS ONLY — runtime migration not started**

Prepared from latest `main` at `a90fd06b2ef4218cf95c65df832a12eafaf7eac8`.

Authoritative references:
- `AGENTS.md`
- `ACTIVE-DEVELOPMENT-ROADMAP-V1.md`
- `PHASER-COMBAT-ARENA-V1.md`
- `BATTLE-SYSTEM-V1.md`
- `BATTLE-RESULT-COMMIT-V1.md`
- PR #10 `experiment/phaser-battlefield`
- current Battle/Arena React presentation and Battle Core integration

This document locks the **production Phaser foundation architecture only**. It does not authorize Battle/Arena runtime cutover yet.

---

## 1. Non-negotiable boundary

Phaser is presentation-only.

Phaser must never own:
- damage formulas;
- hit/crit/status resolution;
- Speed Queue / deterministic turn order;
- cooldowns;
- Pet AI;
- Auto decisions;
- Skip resolution;
- reward generation;
- save/checkpoint;
- battle completion;
- Arena server/API authority.

Authoritative gameplay remains:
- Dungeon: Battle Core / existing App orchestration;
- Arena: existing Arena API/server-resolved flow;
- persistence/rewards: existing production systems.

React/DOM remains authoritative for:
- top bar / turn order;
- Attack / skills / quick slots;
- Auto / Flee / Settings;
- x1/x2 / Skip;
- combat log;
- modal/result shell;
- Arena lobby/opponent UI/result UI.

Phaser renders only the battlefield and presentation effects.

---

## 2. Target production structure

```text
src/phaser/
├─ runtime/
│  ├─ PhaserRuntime.js
│  └─ BattlefieldHost.js
├─ scenes/
│  ├─ BattleScene.js
│  └─ ArenaScene.js
├─ actors/
│  ├─ HeroActor.js
│  ├─ PetActor.js
│  └─ MonsterActor.js
├─ presentation/
│  ├─ EventBridge.js
│  ├─ PresentationQueue.js
│  ├─ DamageFeedback.js
│  └─ VfxManager.js
└─ layout/
   └─ ResponsiveAnchors.js
```

File naming may follow existing repository style, but module responsibilities below are locked.

Do not leave production logic in one monolithic `phaserBattlefield.js`.

---

## 3. Module responsibilities

### runtime/PhaserRuntime

Owns:
- one-time Phaser runtime loading;
- runtime availability/error state;
- version pinning;
- no gameplay knowledge.

Requirements:
- reuse one runtime Promise;
- fail cleanly;
- never block DOM fallback permanently;
- no duplicate script injection.

### runtime/BattlefieldHost

Owns:
- mounting Phaser into a supplied DOM node;
- creating/destroying the Phaser.Game instance;
- scene selection;
- forwarding resize;
- forwarding presentation events;
- exposing readiness/error/cleanup signals to React.

Does not:
- resolve gameplay;
- decide actions;
- mutate Battle Core state.

### scenes/BattleScene

Owns Dungeon battlefield composition:
- HeroActor;
- optional PetActor;
- MonsterActor x1–3;
- target marker;
- ground/background presentation layer;
- presentation queue execution;
- VFX/feedback placement.

It consumes already-resolved presentation events only.

### scenes/ArenaScene

Owns Arena battlefield composition using the same shared:
- HeroActor;
- PetActor;
- PresentationQueue;
- DamageFeedback;
- VfxManager;
- ResponsiveAnchors.

Arena-specific actor/opponent mapping is allowed, but shared rendering behavior must not be duplicated unnecessarily.

### actors/HeroActor

Owns only visual Hero state:
- idle;
- attack;
- hit;
- death;
- position/scale/facing;
- equipment/layer visual input when W8 integrates Hero V5.

No stats or combat rules.

### actors/PetActor

Owns only Pet visual state:
- idle;
- attack;
- hit;
- death;
- ground/flying presentation offset;
- scale/facing.

No Pet AI or skill selection.

### actors/MonsterActor

Owns only monster visual state:
- idle;
- attack;
- hit;
- death;
- target highlight association;
- slot index 1/2/3.

No monster action selection or damage rules.

### presentation/EventBridge

Single DOM/App -> Phaser presentation boundary.

Responsibilities:
- accept normalized presentation events;
- reject/ignore stale battle identities;
- translate actor IDs into scene actors;
- emit user-intent events back to React only where required, e.g. target selection;
- expose scene-ready / presentation-drained/error signals.

It must not call Battle Core directly.

### presentation/PresentationQueue

Owns ordered visual execution.

Responsibilities:
- serialize visual events for one resolved action;
- allow grouped/parallel child effects when the event explicitly requires it;
- respect presentation speed x1/x2;
- expose:
  - `isBusy()`
  - `whenDrained()`
  - `drained` signal/event
- guarantee terminal action presentation can finish before Result transition.

The queue is visual-only. It never delays or changes gameplay resolution itself; it delays only what the player sees next.

### presentation/DamageFeedback

Owns:
- floating damage/heal/miss/status text;
- hit reaction feedback;
- optional screen/actor micro-feedback approved by current presentation contract.

Consumes numbers/text supplied by the resolved event. Never calculates damage.

### presentation/VfxManager

Owns:
- VFX asset lookup;
- frame playback;
- target anchor placement;
- AoE placement;
- cleanup after completion.

Uses existing Battle VFX manifest/data where possible.

### layout/ResponsiveAnchors

Single source of truth for battlefield geometry:
- actor anchors;
- monster formations;
- VFX anchors;
- resize calculations.

No scene should hardcode its own percentages outside this module.

---

## 4. Coordinate system

Use normalized battlefield coordinates independent of device pixels.

Recommended canonical space:
```text
x: 0.0 -> 1.0
y: 0.0 -> 1.0
```

ResponsiveAnchors converts canonical positions into current Phaser canvas pixels.

All actors/VFX must be positioned from this contract, not arbitrary per-component CSS/Phaser literals.

---

## 5. Locked actor anchors

Baseline anchors are the production semantic positions, not sprite top-left coordinates.

```text
HERO_ANCHOR
x = 0.24
y = 0.74

PET_ANCHOR
x = 0.36
y = 0.79
```

Intent:
- Hero left side;
- Pet slightly inward/right of Hero;
- Pet visually lower than Hero;
- enough separation for independent VFX/HUD space.

Actors may apply sprite-specific local offsets after the shared anchor, but local offsets must not redefine the battlefield formation.

---

## 6. Locked monster formation

Monster slots preserve the current diagonal presentation rule.

Semantic slot order:
- SLOT_1 = lower/front;
- SLOT_2 = middle;
- SLOT_3 = upper/back.

Canonical anchors:

```text
MONSTER_SLOT_1
x = 0.72
y = 0.76

MONSTER_SLOT_2
x = 0.80
y = 0.66

MONSTER_SLOT_3
x = 0.88
y = 0.56
```

The back slot must remain further right than the middle/front slots.

### 1-monster layout

Use:
```text
MONSTER_SLOT_1_SINGLE
x = 0.78
y = 0.68
```

Do not place one monster at the upper/back slot.

### 2-monster layout

Use:
```text
MONSTER_SLOT_1_TWO
x = 0.74
y = 0.73

MONSTER_SLOT_2_TWO
x = 0.84
y = 0.61
```

### 3-monster layout

Use the standard SLOT_1/2/3 anchors above.

ResponsiveAnchors owns these variants centrally.

---

## 7. VFX anchors

VFX uses semantic lanes independent from sprite origin.

```text
VFX_HERO_ANCHOR
x = 0.32
y = 0.60

VFX_PET_ANCHOR
x = 0.42
y = 0.66
```

Monster VFX anchor is derived per active monster slot:

```text
VFX_MONSTER_ANCHOR(slot)
x = monsterSlot.x - 0.04
y = monsterSlot.y - 0.12
```

Rules:
- Hero and Pet VFX remain fixed-lane presentation anchors;
- Pet VFX is slightly lower than Hero VFX;
- monster VFX is biased toward the target side and should not completely cover the monster sprite;
- AoE may use a separate center/enemy-group anchor computed from active slots;
- do not derive VFX position from DOM bounding boxes after Phaser cutover.

---

## 8. Target marker

Target selection remains gameplay/UI intent owned by React/App.

Phaser:
- renders ground ellipse/ring below selected living monster;
- pointer/tap on MonsterActor emits `TARGET_SELECTED { targetId }` through EventBridge.

React/App:
- validates target;
- updates authoritative selectedTargetId/Battle Core state;
- feeds resulting selected target back to Phaser.

Phaser must not mutate Battle Core state directly.

---

## 9. Resize behavior

Use Phaser Scale RESIZE or equivalent host-managed resizing.

On resize/orientation change:
1. canvas resizes to host;
2. ResponsiveAnchors recalculates pixel anchors;
3. actors move to their semantic anchors;
4. active persistent markers/HUD-like battlefield elements reposition;
5. currently running animation should continue without restarting whenever practical.

Do not:
- recreate Battle Core;
- reset scene gameplay state;
- replay an action;
- reset target;
- clear queue simply because viewport size changed.

Actor sprite scale may use bounded responsive rules based on canvas width/height, but position remains anchor-driven.

Required viewport verification:
- mobile portrait ~390×844;
- mobile ~430×932;
- tablet 600–700px class;
- desktop 820px+ class;
- short-height desktop/tablet.

---

## 10. DOM -> Phaser event contract

EventBridge accepts normalized immutable presentation events.

Every event includes:
```text
battleId
seq
type
speed
```

Where:
- `battleId` identifies the current encounter/match;
- `seq` is monotonically increasing for presentation ordering;
- `speed` is current x1/x2 presentation multiplier or is applied centrally by queue.

Core event types:

```text
BATTLEFIELD_SYNC
ACTION_BEGIN
ACTOR_ATTACK
VFX_PLAY
DAMAGE_FEEDBACK
HEAL_FEEDBACK
MISS_FEEDBACK
STATUS_FEEDBACK
ACTOR_HIT
ACTOR_DEATH
TARGET_CHANGED
ACTION_COMPLETE
BATTLE_TERMINAL
RESET_BATTLEFIELD
```

### BATTLEFIELD_SYNC

Snapshot-like synchronization for:
- initial scene creation;
- recovery after mount/runtime restart;
- actor HP/alive state;
- actor identity/art;
- selected target.

It must not animate historical actions.

### ACTION_BEGIN / ACTION_COMPLETE

Wrap one already-resolved gameplay action.

PresentationQueue may contain multiple events between them.

`ACTION_COMPLETE` means all visuals belonging to that action must be complete before the queue advances beyond the action boundary.

### BATTLE_TERMINAL

Signals that gameplay has already resolved terminal victory/defeat.

It does **not** mean Result UI may show immediately.

Result transition must wait for PresentationQueue drained/completion boundary.

---

## 11. Phaser -> DOM event contract

Phaser/EventBridge may emit only presentation/runtime/user-intent events such as:

```text
PHASER_READY
PHASER_ERROR
TARGET_SELECTED
ACTION_VISUAL_COMPLETE
PRESENTATION_DRAINED
PHASER_DESTROYED
```

It must never emit authoritative gameplay outcomes such as:
- DAMAGE_RESOLVED;
- TURN_ADVANCE;
- REWARD_GRANTED;
- COOLDOWN_APPLIED.

Those already belong to gameplay systems.

---

## 12. PresentationQueue drained contract

This is a W5 critical requirement for W6.

Definitions:

### Action visual complete

An action is visually complete only after all required presentation children complete:
- actor attack motion/frame sequence;
- VFX;
- hit feedback;
- floating damage/status;
- required death animation/result;
- actor return-to-idle where applicable.

### Queue drained

`PRESENTATION_DRAINED` means:
- no queued presentation events;
- no currently running action;
- no required child animation/VFX/death pending.

A purely looping Idle animation does not prevent drained state.

### Terminal result rule

When Battle Core/server resolves terminal state:
1. enqueue the terminal action's remaining visuals;
2. mark terminal pending;
3. wait for queue drained;
4. only then allow Result presentation transition.

This prevents:
- last Basic Attack being cut;
- Pet final hit being cut;
- Blade Storm kill-all deaths being cut;
- Victory/Defeat screen appearing over unfinished battlefield animation.

---

## 13. Presentation speed x1/x2

Existing gameplay timing/logic remains authoritative.

Phaser x1/x2 affects presentation durations only:
- sprite frame timing;
- tween duration;
- VFX duration;
- feedback dwell time;
- queue visual delay.

Do not:
- alter damage;
- alter Speed Queue;
- change cooldown values;
- skip resolved actions;
- modify server timing.

Skip remains an existing gameplay/resolver feature and is not implemented by Phaser.

---

## 14. BattleScene lifecycle

### Mount

1. React creates battlefield host element.
2. BattlefieldHost loads/reuses Phaser runtime.
3. create Phaser.Game and BattleScene.
4. scene emits PHASER_READY.
5. React/EventBridge sends BATTLEFIELD_SYNC.

Until ready, DOM fallback remains available.

### Active battle

- one Phaser scene instance per active encounter;
- presentation events include battleId;
- stale events from previous battleId are discarded.

### Encounter change / retry / next floor

- reset queue;
- clear transient VFX/feedback;
- replace actor set;
- apply new BATTLEFIELD_SYNC;
- do not leak listeners/textures/timers.

### Unmount/navigation

Destroy:
- Phaser.Game instance when host leaves the active battle flow;
- scene listeners;
- EventBridge listeners;
- queue callbacks;
- timers/tweens;
- transient display objects;
- ResizeObserver/window listeners owned by the host.

Shared safely cached assets/runtime may remain reusable.

---

## 15. ArenaScene lifecycle

ArenaScene uses the same runtime/queue/anchor/event contracts.

Differences allowed:
- opponent actor mapping;
- Arena-specific labels/presentation;
- server-resolved action feed.

ArenaScene must not copy Dungeon resolver behavior or create local Arena gameplay logic.

W5 may scaffold ArenaScene without switching production Arena rendering.

---

## 16. Asset loading

Production foundation should reuse existing asset manifest/resolvers.

Rules:
- do not guess asset paths;
- actor modules receive resolved presentation config/asset identifiers;
- VfxManager uses existing VFX mapping;
- missing optional visual asset uses a controlled fallback;
- missing Phaser/runtime/critical asset must not corrupt gameplay.

Do not make runtime asset failure block Battle Core progress if DOM fallback can render safely.

---

## 17. DOM fallback / rollout strategy

### W5

Build foundation only.
- existing DOM battlefield remains default;
- Phaser path may be feature-flagged/staging-only;
- no production cutover.

### W6 Dungeon migration

- Phaser Dungeon battlefield behind controlled flag or renderer selection;
- DOM battlefield remains available as fallback;
- React HUD remains common to both;
- compare gameplay outputs/controls across both renderers.

### W7 Arena migration

Same strategy for Arena.

### W9 cutover

Only after Dungeon + Arena + Hero V5 QA:
- Phaser becomes default battlefield renderer;
- keep rollback path during production verification;
- remove obsolete DOM battlefield-only code only after explicit approval.

Runtime failure behavior before final removal:
- log/report Phaser failure;
- mount/render DOM fallback;
- do not restart or reroll the battle.

---

## 18. PR #10 prototype guidance

Reuse concepts proven useful by PR #10:
- lazy Phaser runtime loading;
- isolated mount;
- transparent battlefield;
- DOM HUD retained;
- Phaser target interaction callback;
- no Battle Core changes;
- feature-flag/staging preview approach.

Do not copy prototype architecture directly where it is temporary:
- one large renderer function;
- complete snapshot layer destruction/redraw on every frame tick;
- hardcoded positions inside renderer;
- React interval driving all sprite frames;
- per-render asset/image loading structure;
- battle-specific code that prevents reuse by Arena.

Production foundation moves these concerns into persistent actors + event-driven queue.

---

## 19. Current Battle integration boundary

Existing App/Battle code continues to own:
- `battleStateRef`;
- Battle Core `currentUnit/step/restoreCheckpoint`;
- player commands;
- target validation;
- combat speed state;
- Auto/Skip;
- battle VFX event creation;
- checkpoint persistence;
- victory/defeat determination;
- reward/result logic until W6-B changes completion reliability.

W5 EventBridge adapts these presentation outputs; W5 does not rewrite them.

---

## 20. Test matrix

### Architecture
- production modules exist at agreed boundaries;
- no gameplay resolver imported into actor/VFX/layout modules;
- Battle Core output remains unchanged;
- Arena API untouched.

### Runtime
- Phaser loads once;
- duplicate mount/unmount does not duplicate runtime script;
- clean failure produces fallback signal;
- scene destruction removes listeners/timers.

### Scene / actors
- Hero only;
- Hero + Pet;
- 1 monster;
- 2 monsters;
- 3 monsters;
- dead actor state;
- target switching;
- missing optional sprite fallback.

### Anchors
Verify canonical layout at:
- 390×844;
- 430×932;
- 600×900;
- 700×900;
- 820×1000;
- 820×650.

Check:
- Pet lower than Hero;
- back monster further right;
- no overlap with React top/bottom UI;
- monster spacing stable;
- target marker under feet;
- VFX lane positions correct.

### Resize
- portrait resize;
- orientation/layout resize;
- resize mid-idle;
- resize mid-action;
- resize mid-VFX;
- target remains selected;
- no action replay/reset.

### Event ordering
- action begin -> attack -> VFX -> hit -> feedback -> action complete;
- heal;
- miss;
- status proc;
- single death;
- multiple simultaneous deaths;
- stale battleId event ignored;
- duplicate seq handling is safe.

### PresentationQueue
- FIFO ordering;
- allowed parallel child effects;
- `whenDrained()`;
- drained ignores idle loops;
- terminal action waits for required death/VFX;
- x1/x2 shortens presentation but preserves order.

### Terminal cases
- Basic final hit;
- Pet final hit;
- Blade Storm kill-all;
- enemy final hit/Defeat;
- Victory/Defeat transition only after drained.

### DOM boundary
- Attack/skills/Auto/Flee/x1/x2/Skip remain React controls;
- target tap round-trip Phaser -> React -> authoritative target -> Phaser;
- combat log unchanged;
- top turn queue unchanged.

### Persistence regression
- safe checkpoint behavior unchanged;
- resume battle unchanged;
- no Phaser state serialized as gameplay truth;
- no reward/save changes in W5.

### Fallback
- Phaser runtime load failure -> DOM renderer;
- asset failure -> controlled visual fallback;
- renderer toggle does not create new battle identity;
- fallback does not duplicate action or reward.

### Build
- `node build.js`;
- generated inline-JS syntax;
- existing Battle Core/UI/persistence tests;
- new Phaser foundation tests;
- isolated staging/manual visual check before any production renderer switch.

---

## 21. Explicit exclusions

W5 does not:
- migrate Dungeon production renderer;
- migrate Arena production renderer;
- integrate final Hero V5 layered runtime;
- implement Victory/Defeat Result UI;
- alter battle completion/persistence;
- change rewards;
- change skills;
- change Pet rules;
- change Auto/Skip;
- change x1/x2 gameplay behavior;
- remove DOM battlefield;
- deploy production Phaser default.

---

## 22. Work implementation prompt skeleton

```text
THORNIEDUNGEONS — W5 PHASER SHARED FOUNDATION
STATUS: READY_FOR_DEV
MODE: COMPACT
RISK: HIGH

REPO:
kimloor/ThornieDungeons

BASE:
latest main

READ FIRST:
- AGENTS.md
- docs/ACTIVE-DEVELOPMENT-ROADMAP-V1.md
- docs/W5-PHASER-FOUNDATION-V1-PREP.md
- docs/PHASER-COMBAT-ARENA-V1.md
- docs/BATTLE-SYSTEM-V1.md
- docs/BATTLE-RESULT-COMMIT-V1.md
- PR #10 prototype
- current Battle/Arena presentation code

IMPLEMENT W5 FOUNDATION ONLY.

CREATE:
src/phaser/
- runtime/
- scenes/BattleScene
- scenes/ArenaScene
- actors/HeroActor
- actors/PetActor
- actors/MonsterActor
- presentation/EventBridge
- presentation/PresentationQueue
- presentation/DamageFeedback
- presentation/VfxManager
- layout/ResponsiveAnchors

LOCK:
- presentation only
- no gameplay logic in Phaser
- anchor contract from W5 prep doc
- 1/2/3 monster formations
- Phaser target intent -> React authoritative target
- event bridge with battleId + seq
- PresentationQueue action-complete + drained boundary
- resize without action replay/reset
- clean destroy lifecycle
- DOM battlefield remains default/fallback
- React HUD/controls unchanged

PRESERVE:
- Battle Core
- resolver
- Arena API
- checkpoint/save
- rewards
- Auto/Skip/x1/x2 logic

DO NOT:
- production renderer cutover
- W6 Result work
- W6-B completion reliability
- W7 Arena migration
- W8 Hero V5 runtime
- remove DOM fallback

TEST:
- node build.js
- generated JS syntax
- Battle Core/persistence regression
- Phaser runtime lifecycle
- actor/anchor/resize tests
- event ordering
- queue drained terminal-action tests
- fallback tests
- staging/manual visual verification

DELIVER:
THORNIE_DEV_HANDOFF
STATUS: READY_FOR_QA
include BASE_SHA / HEAD_SHA / branch / changed files / module map / tests / staging evidence
DO NOT merge main before QA.
```

---

## 23. W5 completion gate

W5 foundation is ready for QA only when:
- modules are separated per this contract;
- no gameplay logic migrated;
- anchor tests pass;
- resize lifecycle is stable;
- PresentationQueue drained boundary is proven;
- DOM fallback still works;
- Battle/Arena authoritative behavior is unchanged.

W6 must not begin production Dungeon cutover until W5 passes focused QA.
