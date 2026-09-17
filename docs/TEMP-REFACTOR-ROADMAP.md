# ThornieDungeons — Temporary Refactor Roadmap

STATUS: PENDING / TEMPORARY

Purpose: keep the agreed refactor + cleanup plan available across new chats until implementation is complete.

Last checked main when this document was created:
`cd8fd10ea636e69c4926bc2ed0b8899cf5d355cc` (`hotfix: restore PetScreen syntax`)

> IMPORTANT: Before starting any scope, re-check latest `main`. Do not assume the SHA above is still current.

## Global Rules

- Refactor only: behavior must remain identical unless a separate behavior change is explicitly approved.
- Source first -> `node build.js`.
- Never hand-edit generated `index.html`.
- Never restore `app-v2.html`.
- Do not revert/overwrite unrelated work.
- Keep gameplay rules, Battle Core, API contracts, save behavior, Pet stats/balance, Raid rules, Arena rules, Inventory semantics unchanged during structural refactors.
- Prefer reusable components/helpers only when there are 2+ real callers. No speculative abstraction.
- Before deleting any symbol/file, perform a repo-wide reference check. “Looks unused” is not enough.
- Each scope must include build/tests + syntax validation + focused regression checks.

## Cleanup Gate — apply to every scope

Before refactoring the touched area:

1. Identify unused/legacy symbols in the touched area.
2. Perform repo-wide reference checks.
3. Remove only confirmed dead code.
4. Identify duplicated render/utility patterns.
5. Extract reuse only when 2+ real callers exist.
6. Keep abstractions small and obvious.
7. Do not mix redesign/rebalance/new features into the refactor commit.

## Scope A — Safety + Pet Cleanup

Risk: MEDIUM

### Safety
- Add a real JavaScript syntax validation step after build.
- Build/test flow must fail if source/generated JS does not parse.
- Keep `node build.js` as the source-generated build path.

### Pet UI decomposition
Target shape:

```text
PetScreen
├─ PetRoster
├─ PetProfile
├─ PetDetailPanel
│  ├─ PetInfoTab
│  ├─ PetSkillsTab
│  └─ PetGrowthTab
├─ PetActions
└─ GameDock
```

Keep Pet state/logic behavior identical:
- selection
- equip / unequip
- star up
- Info / Skills / Growth
- Gacha
- Back
- GameDock / Settings / Save

### Cleanup candidates
- `FloatingQuickActions` appears legacy/unused; confirm repo-wide before removal.
- Introduce simple shared screen primitives only if useful immediately, e.g. `ScreenLoading`, `ScreenError`, `ScreenBackButton`.

## Scope B — Raid + Arena UI Decomposition

Risk: MEDIUM-HIGH

Goal: presentation extraction only. API/state/resolver behavior stays unchanged.

### Raid target shape

```text
RaidScreen
├─ RaidBossCard
├─ RaidPlayerStatus
├─ RaidAttackActions
├─ RaidMilestonePanel
├─ RaidRanking
└─ RaidBackAction
```

Keep in parent/controller for this pass:
- API calls
- stamina timer
- attack state
- milestone state
- hurt sequencing

### Arena target shape

```text
ArenaScreen
├─ ArenaLobby
│  ├─ ArenaPlayerSummary
│  ├─ ArenaOpponentList
│  └─ ArenaRanking
└─ ArenaBattle
   ├─ ArenaBattleHud
   ├─ ArenaBattleStage
   ├─ ArenaActionPanel
   ├─ ArenaBattleLog
   └─ ArenaResult
```

Do not change:
- Battle Core / PvP resolver
- match API contract
- ticket rules
- action semantics
- server behavior

### Reuse candidates
- `RankRow` shared by Raid / Arena / Leaderboard where practical.
- shared loading/error/back presentation.
- shared countdown/time formatting where semantics are identical.
- avoid over-generalizing battle cards if props become harder to understand than duplicated small markup.

## Scope C — Inventory + Combat Presentation Refactor

Risk: HIGH

### Inventory V2 target shape

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

### Combat target shape

```text
CombatScreen
├─ BattleTopBar
├─ TurnOrderBar
├─ BattleStage
│  ├─ HeroUnit
│  ├─ PetUnit
│  └─ MonsterFormation
├─ BattleVfxLayer
├─ BattleQuickSlots
├─ BattleControls
└─ BattleLogPanel
```

Do not change:
- Battle Core resolver
- damage/status/turn rules
- skip semantics
- quick-slot semantics
- equipment/sell/salvage rules
- inventory capacity/overflow behavior

### Cleanup candidates
- `InventoryOverlay` (legacy) appears unused while App uses `InventoryOverlayV2`; confirm repo-wide before removal.
- consolidate repeated item/icon/slot presentation only where there are real shared callers.
- consolidate quick-slot visual primitives between Inventory and Combat if this reduces duplication without coupling gameplay logic.

## Scope D — Architecture Cleanup

Risk: HIGH

Perform only after feature components above are stable.

### App.js decomposition direction

```text
App
├─ AuthController
├─ CharacterController
├─ NavigationController
├─ InventoryController
├─ PetController
└─ BattleController
```

Do this incrementally inside the scope; do not rewrite the entire application in one uncontrolled pass.

### Confirmed duplication pattern to improve
Startup config loading currently repeats:

```text
fetch remote
→ apply + cache on success
→ load cached fallback on failure
```

Used by areas such as:
- game config
- recipes
- monster loot
- junk info

Extract a small shared fetch/cache fallback helper while keeping behavior identical.

### Additional reuse candidates
- `ResourceChip` / `ResourceBar` for repeated Gold/Diamond/material display where appropriate.
- shared UI primitives that already have 2+ callers.

### Dead-code candidate
- legacy `SkillScreen` appears replaced by `HeroSkillV1Screen`; perform repo-wide reference check before removal.

### Styles / folder structure
After component boundaries are stable, split the large style surface by feature, e.g.:

```text
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

Long-term UI structure direction:

```text
src/ui/
  shared/
  character/
  inventory/
  pet/
  battle/
  raid/
  arena/
```

Avoid moving files multiple times. Prefer final-path moves once dependencies are clear.

## Execution Order

```text
A. Safety + Pet
→ B. Raid + Arena
→ C. Inventory + Combat
→ D. App / Styles / Repository Structure
```

If Scope C proves too large during implementation, split only that scope into C1 Inventory and C2 Combat. Do not pre-split unless necessary.

## Definition of Done for each scope

- latest `main` checked before starting
- cleanup gate completed
- structural changes only unless separately approved
- no confirmed behavior regression
- `node build.js` succeeds
- JavaScript syntax validation succeeds
- applicable automated tests pass
- focused smoke/regression checks pass
- no unrelated files changed
- clear handoff with files changed + commit SHA + tests

## Final Goal

The refactor should result in:

- less code overall where dead/duplicate code exists
- smaller feature components
- fewer deeply nested `React.createElement(...)` chains
- fewer duplicated UI patterns
- reusable primitives with real callers
- clearer feature boundaries
- safer builds that reject syntax errors before release
- behavior identical to the pre-refactor game

## Temporary Document Lifecycle

This document is intentionally temporary. Once Scopes A-D are complete and the new structure is documented in the permanent architecture/source-of-truth docs, delete or archive this file to avoid stale instructions.
