# ThornieDungeons — Active Development Roadmap V3

Status: **ACTIVE-PLANNING — PRE-V1.1.0 RELEASE GATE IN PROGRESS**

This is the successor roadmap after the completed historical W0-W9R and Gameplay WAVE 1-7 roadmap. Historical numbering is not reused here.

## 1. Baseline

- Historical roadmap: `ACTIVE-DEVELOPMENT-ROADMAP-V1.md` — COMPLETE / HISTORICAL.
- New Wave numbering begins only after the pre-V1.1.0 release gate below is complete.
- Production remains the primary acceptance target unless a task explicitly requires another environment.
- Existing Battle Core, Arena, Dungeon V2, Reward V2, Pet, Social, Admin and economy authority remain unchanged unless a future Wave explicitly approves a contract change.

## 2. PRE-V1.1.0 RELEASE GATE — MUST COMPLETE FIRST

This gate is not numbered as a new gameplay Wave.

### Gate A — Dungeon Cloud Sync checkpoint hotfix
**Status: IN PROGRESS / BLOCKING**

- PR #75 / Dungeon checkpoint persistence issue.
- Production diagnostic root cause: `enemy_id_not_authorized`.
- Fix the producer/state identity mismatch; do not weaken the server validator.
- Server-issued enemy `instanceId` remains authoritative.
- Complete focused regression, QA retest, merge, Production verification and branch cleanup.

### Gate B — Current UI Fix Batch
**Status: QUEUED / BLOCKING FOR V1.1.0**

Complete the already-approved UI debt batch:
- shared Global Currency Bar and detailed currency view;
- Arena mobile header cleanup;
- fixed shared bottom navigation / safe area;
- Arena History Attack/Defense semantics;
- Refresh cooldown countdown on the Refresh button;
- Milestone current/target progress;
- Arena Setup final custom selectors/presentation, including Pet presentation when G13 assets are available;
- Character > Skills crash root-cause fix;
- unified detailed sanitized runtime error popup.

Do not silently expand this batch into unrelated gameplay redesign.

### Gate C — Release acceptance
After Gate A and Gate B are complete:
- focused QA/regression for changed systems;
- mobile/iPhone safe-area and interaction verification;
- Production smoke verification;
- confirm no critical known regression introduced by the gate;
- bump the visible game version to **Ver 1.1.0** as the release milestone.

**Version rule:** do not claim Ver 1.1.0 complete merely because the label was changed. The bump represents successful completion and Production verification of the pre-V1.1.0 release gate.

## 3. NEW ROADMAP — FRESH NUMBERING

The successor roadmap starts here, after Ver 1.1.0 gate acceptance.

### WAVE 1 — Global Loading System V1
**Status: APPROVED / QUEUED**
**Risk: MEDIUM**
**Contract:** `GLOBAL-LOADING-SYSTEM-V1.md`

Implement the shared App-level loading manager/overlay:
- token/reference-counted ownership;
- delayed show and minimum-visible behavior;
- indeterminate mode for unknown waits;
- determinate progress only from real measurable counts;
- major bootstrap/Dungeon/Arena/Phaser preload/restore transitions;
- background autosave must not become an unnecessary full-screen blocker;
- loading failure releases ownership before detailed error UI;
- no gameplay/save/API authority changes.

Graphics dependency: G14 Global Loading Presentation Pack may provide the shared Dungeon Gate/rune visual identity, with a functional lightweight fallback.

### WAVE 2 — Admin V2 Expansion
**Status: APPROVED ROADMAP SLOT / SCOPE DESIGN PENDING**

Expand Admin V2 as the operations/audit foundation needed before the next economy-heavy systems. Detailed permissions, mutation tools and destructive-operation contracts will be approved separately. Admin Delete Item remains a candidate for this Wave; do not implement it from this roadmap heading alone.

### WAVE 3 — Blacksmith + Crafting Redesign
**Status: APPROVED ROADMAP SLOT / SCOPE DESIGN PENDING**

Redesign the Blacksmith/Crafting experience around the existing authoritative Enhance, Empower, Salvage, Craft, Recipe and Protection Stone systems. Detailed UX/mechanics changes remain subject to a separate scope contract.

### WAVE 4 — Main Shop + Diamond Economy Design
**Status: APPROVED ROADMAP SLOT / SCOPE DESIGN PENDING**

Design the main Shop and future real-money Diamond Pack catalog. This Wave may define pack structure, proposed pricing/value, Diamond purchasing power and economy-safety targets.

**Real-money purchase/checkout is explicitly disabled and out of implementation scope for this roadmap stage.** No client test-purchase/free-Diamond path may grant currency. External payment, receipt verification, refunds and live monetization require a future separately approved contract.

### WAVE 5 — Pet Gacha Redesign
**Status: APPROVED ROADMAP SLOT / SCOPE DESIGN PENDING**

Redesign the existing Pet Gacha after the Diamond economy contract is defined. Current pull cost/rates/duplicate behavior are not automatically locked by this heading; detailed Gacha mechanics and presentation require Project Lead approval. Reuse the shared G13 Pet Avatar family when available.

### ECONOMY AUDIT GATE — PRE-MARKET
**Status: REQUIRED / SCOPE DESIGN PENDING**

Before opening a player marketplace, audit the combined economy created by:
- item/drop acquisition rates;
- Blacksmith/Crafting resource sinks;
- Shop prices and Diamond purchasing power;
- Pet Gacha consumption;
- currency/material generation and existing progression loops.

Resolve economy-breaking findings before Market release rather than relying on Market fees to repair an unstable economy.

### WAVE 6 — Trading Market / Central Listing Marketplace
**Status: APPROVED ROADMAP SLOT / SCOPE DESIGN PENDING**

Build a centralized player listing market, not direct player-to-player trade. Intended direction:
- seller lists eligible items into the Market;
- central browse/search/filter/sort experience;
- another player purchases the listing;
- server-authoritative settlement transfers item/proceeds;
- Market collects an approved fee;
- listing ownership/escrow, concurrency, exact-once purchase, cancellation/expiry and trade eligibility require dedicated contracts before implementation.

Do not implement Market economy rules from this heading alone.

### WAVE 7+ — FUTURE DESIGN GATE
**Status: NOT YET LOCKED**

Future systems such as Dungeon/content/progression expansion, longer-term endgame loops, live real-money Diamond purchasing, or other new gameplay systems require separate Project Lead design approval before receiving final Wave numbers.

## 4. GRAPHICS PARALLEL LANE

Graphics work is tracked separately from gameplay Wave numbering.

- G10-G12: COMPLETE / Production.
- G13 Pet Avatar Pack + Shared Pet Selector Presentation: READY_FOR_GRAPHICS.
- G14 Global Loading Presentation Pack: APPROVED / QUEUED AFTER G13.
- Graphics may run in parallel only where asset/runtime ownership does not conflict with the blocking release gate.

## 5. EXECUTION ORDER

```text
Historical Roadmap W0-W9R + Gameplay WAVE 1-7   ✅ COMPLETE
                     ↓
Dungeon Cloud Sync Gate                          ✅ COMPLETE
                     ↓
Current UI Fix Batch                             🟡 QUEUED
                     ↓
QA + Production acceptance
                     ↓
Visible game version                             Ver 1.1.0
                     ↓
NEW WAVE 1 — Global Loading System V1
                     ↓
WAVE 2 — Admin V2 Expansion
                     ↓
WAVE 3 — Blacksmith + Crafting Redesign
                     ↓
WAVE 4 — Main Shop + Diamond Economy Design
                     ↓
WAVE 5 — Pet Gacha Redesign
                     ↓
Economy Audit Gate
                     ↓
WAVE 6 — Trading Market / Central Listing
                     ↓
WAVE 7+ — Future design approval required
```

Parallel Graphics lane:
```text
G13 Pet Avatar → G14 Global Loading Presentation
```

## 6. Scope-control rule

New findings discovered during the pre-V1.1.0 gate are recorded for the successor roadmap unless they are:
- blockers to the gate;
- player-data/integrity risks;
- security/auth issues;
- defects that make the changed system unsafe or unverifiable.

Do not silently pull unrelated future gameplay into the Ver 1.1.0 gate.
