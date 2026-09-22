# Phaser Combat + Arena Presentation Migration V1

Status: **ACTIVE-DESIGN — approved migration direction, implementation not yet released**

## 1. Purpose

This document defines the planned migration of ThornieDungeons battle presentation from DOM/CSS battlefield rendering to Phaser while preserving the existing gameplay systems.

The migration applies only to:

- Dungeon Combat battlefield presentation
- Arena battle-stage presentation

It does **not** authorize a gameplay rewrite.

The existing Battle Core, Arena server resolution, save/checkpoint rules, rewards, progression, skill rules, Pet rules, cooldowns, queue ordering, status behavior, API contracts, and persistence remain authoritative and unchanged unless a separate approved task changes them.

---

## 2. Current implementation state

### Dungeon Combat

Current production Dungeon Combat uses the existing React/DOM shell and Battle Core.

The approved Phaser experiment exists separately on:

- branch: `experiment/phaser-battlefield`
- Draft PR: `#10`
- feature flag: `?phaserBattle=1`
- preview Worker: `thorniedungeons-phaser-preview`

The experiment is presentation-only and currently proves that Phaser can render the battlefield while the existing DOM HUD and gameplay resolver remain in control.

The prototype layout is **not final**. Hero, Pet, Monster, target marker, VFX positions, sizing, and responsive anchors must be replaced by the production anchor contract before release.

### Arena

Arena already has decomposed React presentation components:

```text
ArenaBattle
├─ ArenaBattleHud
├─ ArenaBattleStage
├─ ArenaActionPanel
├─ ArenaBattleLog
└─ ArenaResult
```

The current `ArenaBattleStage` is presentation-only and uses placeholder visual units plus CSS animation classes. Arena match state and resolved log entries already come from the existing Arena/Battle Core-backed server flow.

The Phaser migration should replace **ArenaBattleStage only**, not the surrounding Arena lobby/HUD/action/result/network flow.

---

## 3. Target architecture

```text
React / DOM
├─ Dungeon Battle HUD
│  ├─ BattleTopBar
│  ├─ TurnOrder
│  ├─ QuickSlots
│  ├─ BattleControls
│  └─ BattleLog
├─ Arena HUD / Actions / Result / Log
│
└─ Shared Phaser Presentation Runtime
   ├─ BattleScene
   ├─ ArenaScene
   ├─ HeroActor
   ├─ PetActor
   ├─ MonsterActor
   ├─ VfxManager
   ├─ DamageFeedback
   ├─ PresentationQueue
   └─ ResponsiveAnchorLayout
```

React remains responsible for application/page UI.

Gameplay systems remain responsible for game truth.

Phaser is responsible only for battlefield presentation.

---

## 4. Source-of-truth boundary

### Gameplay truth

Phaser must never calculate or decide:

- action order
- Speed Queue
- hit/miss
- damage
- critical result
- status proc
- cooldown
- SP cost
- Pet AI
- target legality
- battle outcome
- Arena rating/reward
- checkpoint state
- save state

These values come from the existing resolver/server state.

### Presentation truth

Phaser may control:

- unit position
- sprite frame display
- idle/attack/death presentation
- hit reaction
- VFX playback
- floating damage/heal/miss/crit text
- target marker
- camera shake/flash when approved
- visual timing
- x1/x2 presentation speed

A Phaser animation failure must not change gameplay results.

---

## 5. Shared presentation event contract

Dungeon and Arena should feed a shared presentation format instead of calling Phaser ad hoc from many UI components.

Conceptual event examples:

```js
{
  type: "ACTION_RESOLVED",
  actorId: "hero",
  targetIds: ["monster_1"],
  actionKey: "power_strike",
  vfxKey: "slash_basic",
  results: [
    { targetId: "monster_1", damage: 220, crit: false }
  ]
}
```

```js
{
  type: "UNIT_DEFEATED",
  unitId: "monster_1"
}
```

The event bridge translates resolved game state/log entries into presentation commands.

It must not re-resolve gameplay.

---

## 6. Dungeon Battle migration scope

Move into Phaser:

- Hero battlefield rendering
- Pet battlefield rendering
- 1–3 Monster formation
- target marker
- battlefield HP/status attachment when appropriate
- damage/heal/crit/miss/dodge floating feedback
- Hero/Pet/Monster animation playback
- Battle VFX
- hit reaction
- death presentation
- battlefield responsive anchors

Keep in React/DOM:

- top bar
- actual Speed Queue display
- x1/x2/Skip controls
- quick slots
- Attack / Auto / Flee / Settings
- Battle Log
- modal/overlay UI
- result-confirm/reward flow unless separately approved

---

## 7. Arena migration scope

Replace the visual implementation of `ArenaBattleStage` with Phaser.

Keep unchanged:

- Arena lobby
- opponent list
- ranking
- ticket rules
- match API
- turn submission
- Hero skill availability
- server-resolved match state
- Arena Battle HUD
- Arena Action Panel
- Arena Battle Log
- Arena Result
- rating/rewards

Phaser Arena presentation should consume the current resolved match/log data.

Target team mapping:

```text
Left
- team_a_hero
- team_a_pet

Right
- team_b_hero
- team_b_pet
```

Dungeon and Arena should share HeroActor, PetActor, VFX and presentation infrastructure wherever the behavior is genuinely identical.

---

## 8. Production anchor contract required before release

The prototype coordinates are temporary.

Production migration must define one responsive coordinate system with named anchors.

Minimum Dungeon anchors:

- `HERO_ANCHOR`
- `PET_ANCHOR`
- `MONSTER_SLOT_1` — lower/front
- `MONSTER_SLOT_2` — middle
- `MONSTER_SLOT_3` — upper/back
- `VFX_HERO_ANCHOR`
- `VFX_PET_ANCHOR`
- `VFX_MONSTER_ANCHOR`

Monster formation must preserve the existing approved diagonal rule:

- lower/front slot
- middle slot
- upper/back slot
- back slot further right
- stable X/Y spacing
- no overlap with top bar or bottom controls

Arena must define separate left/right team anchors but may use the same responsive-layout utility.

Do not hardcode unrelated device-specific pixel coordinates throughout actor code.

---

## 9. Hero V5 compatibility

Hero V5 remains:

- modular layered
- frame-based
- synchronized by frame index
- non-skeletal
- no Spine runtime
- no bone-driven animation

Phaser should render Hero V5 as one logical Hero actor composed from synchronized sprite layers.

Phaser integration does **not** change the Hero V5 animation model into runtime limb rotation/tween animation.

The V5 rules remain authoritative:

- 768 × 768 master canvas
- shared coordinate space
- synchronized Idle / Attack / Death frames
- equipment layer replacement
- explicit layer ordering
- frame-specific order exceptions when required
- no V4/V5 mixed runtime composite

Hero V5 runtime implementation remains a separate milestone after the Base Hero frame set is approved.

---

## 10. Asset loading

Use existing manifest/R2 contracts.

Requirements:

- never guess asset keys or paths
- resolve real manifest entries
- lazy-load only presentation assets required for the current actors/equipment where practical
- missing optional presentation assets must fall back safely where a fallback exists
- Phaser load failure must not corrupt gameplay state

Cross-origin texture loading from R2/Worker assets must be validated in real browser/WebGL execution before release.

---

## 11. Presentation timing

The existing gameplay result is authoritative before visual playback completes.

Presentation may sequence resolved events for readability, but must not delay or alter gameplay rules.

x1/x2 changes presentation timing only.

Skip continues using the existing fast resolver and does not wait for Phaser animation.

Arena may replay the server-resolved log visually, but Phaser must not invent intermediate HP or action results.

---

## 12. Migration phases

### Phase P0 — Documentation + experiment review

- lock this migration contract
- keep Draft PR #10 as experiment
- record visual feedback
- do not merge prototype directly as production architecture

### Phase P1 — Shared Phaser foundation

Create final shared presentation modules:

- Phaser runtime bootstrap
- scene lifecycle
- actor base
- HeroActor
- PetActor
- MonsterActor
- VFX manager
- presentation event bridge
- responsive anchor layout

No gameplay changes.

### Phase P2 — Dungeon Battle

- implement production anchors
- migrate Hero/Pet/Monster/VFX battlefield
- preserve DOM HUD and controls
- verify 1/2/3-monster layouts
- verify target selection
- verify x1/x2
- verify Auto and Skip do not depend on animation
- verify resume/checkpoint behavior

Keep the DOM battlefield available behind a temporary fallback during verification.

### Phase P3 — Arena Battle Stage

- replace ArenaBattleStage placeholder rendering
- map team A/team B actors into Phaser
- replay resolved Arena log entries
- reuse Hero/Pet/VFX modules
- preserve Arena network/action/result logic

### Phase P4 — Cleanup

Only after Dungeon + Arena QA approval:

- make Phaser the default battlefield renderer
- remove obsolete DOM battlefield-only rendering
- remove temporary feature flags
- remove experiment-only code
- update final architecture docs
- archive/close migration experiment

Do not remove the DOM fallback before the new renderer is verified.

---

## 13. QA matrix

Dungeon:

- Hero only
- Hero + Pet
- Pet continues after Hero death
- 1 Monster
- 2 Monsters
- 3 Monsters
- target switching
- target dies before action
- Basic Attack
- Active Skill
- multi-hit
- heal
- Poison/Stun/Silence/Armor Break presentation
- Boss conversion presentation
- x1/x2
- Auto
- Skip
- Victory/Defeat
- checkpoint/resume
- mobile/tablet/desktop

Arena:

- Hero vs Hero
- Hero+Pet vs Hero
- Hero vs Hero+Pet
- Hero+Pet vs Hero+Pet
- Basic Attack
- Active Skill
- cooldown display remains correct
- damage/heal/miss/crit/status log replay
- death
- result
- resume active match
- mobile/tablet/desktop

Regression:

- resolver output unchanged
- API contracts unchanged
- save/checkpoint unchanged
- rewards unchanged
- no production asset-path breakage

---

## 14. Known pending work that intersects this migration

The following work should be tracked so implementation does not conflict with other project work:

1. **Draft PR #10 Phaser experiment**
   - preview works
   - layout is provisional
   - production architecture/anchors still pending
   - do not merge as final implementation without migration QA

2. **Hero V5**
   - design contract exists
   - Base Hero production frames are not yet completed/approved for runtime replacement
   - V4 remains production Hero until V5 receives a separate migration task

3. **Temporary refactor roadmap**
   - Scope C Combat presentation refactor overlaps this migration
   - the Phaser migration should supersede the old DOM-oriented Combat Stage extraction where they conflict
   - Inventory work in Scope C remains separate
   - Scope D architecture cleanup should wait until renderer boundaries are stable

4. **Arena documentation gap**
   - there is no dedicated full Arena gameplay contract yet
   - this migration may change Arena presentation only
   - current Arena gameplay/API behavior must be preserved from latest code until a separate Arena gameplay contract is approved

5. **Inventory V2 refactor**
   - Inventory remains DOM/React and does not move into Phaser
   - Inventory refactor should remain a separate scope
   - active sequencing is defined in `ACTIVE-DEVELOPMENT-ROADMAP-V1.md`

---

## 15. Non-goals

This migration does not include:

- rewriting Battle Core in Phaser
- changing Arena gameplay
- moving Inventory/Pets/Town/Guild/Chat into Phaser
- changing skill balance
- changing Pet balance
- changing Raid presentation
- changing rewards/economy
- adding skeletal animation
- adding Spine
- replacing Hero V4 with V5 as part of renderer migration
- redesigning Battle HUD

---

## 16. Release rule

This is a HIGH-RISK presentation migration because it touches the active battle surface.

Required flow:

```text
latest main
→ dedicated branch
→ source changes
→ node build.js
→ syntax validation
→ focused automated tests
→ staging preview
→ user visual test
→ QA
→ approved merge
→ production verification
```

Production deploy must not occur from the experimental branch.

