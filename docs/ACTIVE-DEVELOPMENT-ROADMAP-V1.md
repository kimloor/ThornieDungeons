# ThornieDungeons — Active Development Roadmap V2

Status: **ACTIVE-DESIGN — current master execution roadmap**

This roadmap merges the remaining Social/Guild/Chat work with the active Hero V5, Inventory V2 and Phaser migration tracks.

Work is split into three execution lanes:

1. **CHAT** — low-complexity / low-risk work the Project Lead can handle directly.
2. **WORK** — medium/high-complexity implementation, transactional/backend work, large refactors and renderer migration.
3. **GRAPHICS** — visual asset production and approval.

The lanes may run in parallel where dependencies allow.

---

## 1. Global rules

- Check latest `main` before every task.
- Source first -> `node build.js`; never hand-edit generated `index.html`.
- Do not restore `app-v2.html`.
- Do not overwrite unrelated work.
- Existing Battle Core, Arena resolver/API, save/checkpoint, rewards, skill rules and Pet rules remain authoritative unless separately approved.
- React/DOM remains application/page UI.
- Phaser is presentation-only for Dungeon Combat and Arena battlefield rendering.
- Inventory remains React/DOM.
- Hero V5 remains modular, layered, synchronized frame-based animation; no skeletal/Spine runtime.
- High-risk scopes use branch + focused QA + user verification before release.
- Do not remove fallbacks until replacements are verified.

---

# PART 1 — CHAT LANE
## Low-complexity work the Project Lead can do directly

These tasks do not require a large coding agent/Work handoff unless audit findings expand the scope.

### C1 — Documentation / roadmap maintenance
- keep this roadmap and `PROJECT-INDEX.md` aligned;
- update ACTIVE-PRODUCTION / ACTIVE-DESIGN status after verified releases;
- archive or mark superseded temporary docs when safe;
- keep implementation prompts compact and scoped.

### C2 — Read-only audits and smoke checks
After each WORK handoff:
- verify latest `main` SHA;
- inspect changed files/migrations;
- verify GitHub Actions/deploy result;
- audit source against the active contract;
- run non-destructive smoke checks where available;
- classify findings as PASS / HOTFIX / NEED_AUTH_E2E.

### C3 — Focused QA review
- review Chat/Guild/Inventory/Phaser handoffs;
- confirm no unrelated changes;
- compare implementation against source-of-truth docs;
- produce small manual test checklists for user verification.

### C4 — Low-risk polish only
May be handled directly when isolated and clearly LOW risk:
- text/copy fixes;
- disabled/Coming Soon labels;
- tiny CSS alignment or safe-area corrections;
- documentation-only cleanup;
- navigation label/order cleanup that does not change routing/state behavior.

Do not use CHAT lane for:
- D1 schema changes;
- economy/item consumption;
- concurrency/idempotency;
- large component refactors;
- Phaser runtime changes;
- Battle/Arena gameplay-sensitive code.

---

# PART 2 — WORK LANE
## Complex implementation requiring Work/DEV

## W0 — Social Phase 3+4 Audit Hotfix
**Priority: first**

Fix the six confirmed issues before Phase 5:
1. DM unread must ignore the current character's own sent messages.
2. Global blocked-message filtering must not stall the polling cursor.
3. Global/Direct send must be retry-safe/idempotent server-side.
4. Guild Leader must be able to edit description and set OPEN / APPLICATION / CLOSED.
5. Max 5 pending Guild applications must be enforced race-safely.
6. Manual + automatic leadership transfer must keep guild leader reference and member roles consistent atomically/race-safely.

Gate:
- relevant tests pass;
- migration/deploy verified if schema changes;
- Phase 5 not started inside this hotfix.

---

## W1 — Inventory V2 Structural Refactor + Donation-ready Boundary

Decompose `InventoryOverlayV2` while preserving behavior.

Target:
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

Also prepare clean reusable boundaries needed by Guild Donation:
- authoritative item identity/category access;
- quantity access;
- equipped/locked state access;
- reusable item-selection/list presentation where genuinely shared.

Do **not** implement donation/economy behavior in this refactor.

Gate:
- behavior unchanged;
- mobile/tablet/desktop responsive checks pass;
- focused Inventory smoke + build/tests pass.

---

## W2 — Guild Donation V1

Implement after W1 is stable.

Required:
- inspect real production item IDs/categories; never guess whitelist keys;
- explicit donation whitelist;
- quantity 1–999;
- equipped/locked items denied;
- authenticated current Guild membership required;
- atomic/idempotent inventory consumption;
- Guild EXP;
- configurable EXP/item mapping;
- configurable level thresholds;
- Guild level cap 10;
- cumulative personal contribution;
- donation audit/history;
- Level 10: donation still allowed, contribution increases, Guild EXP cannot progress beyond cap.

This is economy-sensitive and must remain separate from the Inventory refactor.

---

## W3 — Guild Chat + Social Integration / UX

Combine the old Guild Chat phase with the old Social UX-polish phase to avoid touching the same navigation/state twice.

Implement:
- Guild channel using the existing Chat engine;
- current Guild membership authorization;
- latest 50 initial messages for new/rejoining members, subject to retention;
- Guild retention 14 days;
- persistent Guild unread;
- leave/disband immediately invalidates old Guild access/unread;
- rejoin follows new membership rules;
- Guild Page shortcut and Chat Page Guild tab open the same channel state;
- block may hide messages for the blocker but must not alter Guild authority;
- shared loading/error/empty/reconnect behavior;
- Friend/Chat/Guild navigation consistency;
- character-switch isolation;
- unread badge integration where approved;
- mobile/safe-area polish.

Do not add Sticker backend, Party/Trade/Raid Chat, Guild Quest/Shop/War.

---

## W4 — Social Production E2E / Release QA

After W0-W3:
- Friend request/accept/remove/block;
- Global Chat + block filtering;
- Direct Chat + unread + unfriend/re-friend history;
- Guild create/search/policy/apply/accept/kick/transfer/disband;
- Donation retry/double-tap safety;
- Guild EXP/contribution;
- Guild Chat membership/unread/leave/rejoin;
- logout/login persistence;
- character switching;
- navigation/mobile safe areas.

Authenticated production E2E may use test credentials only when explicitly authorized.

---

## W5 — Phaser Shared Foundation + Production Anchors

Turn the prototype into reusable production architecture.

Create:
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

Lock responsive anchors:
- HERO_ANCHOR
- PET_ANCHOR
- MONSTER_SLOT_1/2/3
- VFX_HERO_ANCHOR
- VFX_PET_ANCHOR
- VFX_MONSTER_ANCHOR

PresentationQueue must also expose a clean action-visual-complete/drained boundary. W6 uses it so a terminal attack/VFX/death sequence is not cut off before Result transition.

No gameplay logic moves into Phaser.

---

## W6 — Dungeon Combat -> Phaser + Battle Result / Final Commit

Execute as one Battle-focused WORK package to avoid reopening the same App/Battle/Worker/save context twice. Keep two internal commits/gates.

### W6-A — Dungeon presentation + Result

Move battlefield presentation only:
- Hero;
- Pet;
- 1–3 Monsters;
- target marker;
- VFX;
- floating feedback;
- hit/death feedback;
- battlefield positions.

Also implement the approved `BATTLE-RESULT-COMMIT-V1.md` presentation contract:
- final Basic/skill/Pet action finishes animation/VFX/death before Result;
- Blade Storm kill-all visibly completes;
- Victory confirming is animation-only;
- thorned ancient shield + unfolding wings + VICTORY;
- no reward/progress/buttons/saving text while commit is pending;
- after commit reveal Gold/Diamonds/Drops + Hero/Pet progress;
- Hero/Pet EXP uses numeric count-up in the progress area only;
- highlight order: Floor Unlock -> New Pet -> Hero Level Up -> Pet Level Up;
- Defeat uses broken/shattering shield, then Retry / Map after animation.

Keep React/DOM:
- top bar / turn queue;
- quick slots;
- Attack/Auto/Flee/Settings;
- x1/x2/Skip;
- combat log;
- modal/result UI shell.

Keep DOM battlefield fallback until QA/user approval.

### W6-B — Final Battle Commit / Completion Reliability V2

After W6-A gate passes on the same branch:
- remove the crash window between accepted completion and reward persistence;
- immutable/idempotent completion reward receipt per battle identity;
- repeated completion returns the same committed result;
- no reward reroll or duplicate Gold/EXP/items/Pet EXP/floor progression;
- Result Ready renders committed receipt values;
- preserve safe Action-boundary checkpoint rules;
- skip redundant checkpoint round trip when the required safe checkpoint is already confirmed;
- consolidate post-battle network round trips where safe;
- additive D1 migration only if required;
- keep existing reward formulas/balance unless separately approved.

No Battle gameplay resolution moves into Phaser or server logic.

Gate:
- Battle Core output unchanged;
- target switching and 1/2/3-monster layout;
- final Basic Attack / Blade Storm / Pet final-hit presentation;
- VFX/hit/death;
- x1/x2/Auto/Skip;
- checkpoint/resume;
- Victory Confirming -> Ready;
- Defeat animation -> Retry/Map;
- duplicate completion/retry safety;
- reload/recovery after committed completion;
- receipt values match Result;
- no reward reroll/duplication;
- build/persistence/backend tests;
- authenticated staging E2E before release.

---

## W7 — Arena Battle Stage -> Phaser

Replace only Arena battlefield presentation.

Reuse shared:
- HeroActor;
- PetActor;
- presentation queue;
- VFX;
- responsive anchors.

Preserve:
- lobby/opponent list;
- tickets;
- Arena APIs;
- server-resolved actions;
- HUD/action panel/log/result;
- rating/rewards.

---

## W8 — Hero V5 Phaser Runtime Integration

Starts only after GRAPHICS G1/G2 approval.

Implement:
- synchronized Hero V5 layered composition;
- Idle/Attack/Death frame playback;
- hair/head/body/arm/weapon/wings ordering;
- equipment layer swapping from current equipment state;
- no bone/limb tween animation;
- V4 fallback retained during rollout.

---

## W9 — Phaser Production Cutover

After Dungeon + Arena + Hero V5 QA:
- Phaser becomes default battlefield renderer;
- remove temporary experiment flag/code;
- remove obsolete DOM battlefield-only renderer only after verification;
- keep DOM HUD/page UI;
- preserve rollback path until production check completes.

---

## W10 — Final Architecture Cleanup

Only after Social, Inventory and Phaser boundaries are stable.

Controller direction:
```text
App
├─ AuthController
├─ CharacterController
├─ NavigationController
├─ InventoryController
├─ PetController
├─ SocialController
└─ BattleController
```

Feature direction:
```text
src/ui/
  shared/
  character/
  inventory/
  pet/
  friend/
  chat/
  guild/
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
  social.js
  battle.js
  raid.js
  arena.js
```

Also:
- consolidate real shared fetch/cache helpers;
- remove confirmed dead legacy symbols;
- avoid speculative abstractions;
- avoid moving files repeatedly.

---

# PART 3 — GRAPHICS LANE
## Visual production that can run in parallel

## G1 — Hero V5 Base Hero

Produce/approve:
- final Base Hero proportions;
- master canvas 768x768;
- Idle 3 frames;
- Attack 3 frames;
- Death 2–3 frames;
- facing/right presentation per Hero V5 contract;
- mobile readability;
- frame alignment.

This may run in parallel with W0-W7.

---

## G2 — Hero V5 Layer / Equipment Validation

After G1 direction is approved:
- verify shared coordinate space;
- hair/head/body/right-arm/torso-leg/weapon layer structure;
- wings behind all;
- frame-specific ordering where required;
- first complete equipment overlay test set;
- verify full armor coverage where intended;
- define real manifest keys/paths;
- transparency/alignment checks.

G2 approval is the gate for W8.

---

## G3 — Phaser Visual QA / Asset Gaps

During W5-W9:
- inspect actual presentation for scale/clarity;
- produce only missing presentation assets explicitly identified by implementation/QA;
- target marker/VFX/feedback adjustments if existing assets are insufficient;
- never redesign gameplay from Graphics scope;
- update R2/manifest using real paths only.

---

# 4. Master execution order

```text
W0  Social 3+4 Hotfix
 ↓
W1  Inventory Refactor + Donation-ready Boundary
 ↓
W2  Guild Donation
 ↓
W3  Guild Chat + Social Integration/UX
 ↓
W4  Social Production E2E
 ↓
W5  Phaser Foundation + Anchors
 ↓
W6  Dungeon -> Phaser
 ↓
W7  Arena -> Phaser
 ↓
W8  Hero V5 Runtime Integration
 ↓
W9  Phaser Production Cutover
 ↓
W10 Final Architecture Cleanup
```

Parallel Graphics path:

```text
G1 Hero V5 Base
 ↓
G2 Layer/Equipment Validation
 └──────────────> required before W8

G3 Visual asset support runs only when W5-W9 identifies a real need.
```

CHAT lane C1-C4 runs continuously between WORK/GRAPHICS milestones for audit, documentation, QA and small low-risk polish.

---

# 5. Completion condition

The active roadmap is complete when:
- Social Phase 3/4 audit issues are fixed;
- Guild Donation and Guild Chat V1 are production-verified;
- Friend/Chat/Guild integration passes E2E;
- Inventory V2 is structurally clean and behavior-stable;
- Dungeon Combat battlefield uses Phaser in production;
- Arena battle stage uses Phaser in production;
- Hero V5 is approved and integrated in Phaser;
- temporary DOM battlefield/experiment code is safely removed;
- App/styles/folder architecture is stabilized and documented.
