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
**Status: COMPLETE / PRODUCTION VERIFIED**

- PR #75 merged to Production at `26ea4e4a5eb5491de1e37ae28d5e0a3c713ffc88`.
- Production root cause confirmed as client producer/state identity drift causing `enemy_id_not_authorized`.
- Server-issued enemy `instanceId` remains authoritative; Worker validation was not weakened.
- Focused/full regression, Battle Core parity, API/Frontend deploy, Production smoke test, and branch cleanup passed.
- Reusable Production-tail lessons promoted into `PRODUCTION-DIAGNOSTIC-LOGGING-V1.md`.

### Gate B — Current UI Fix Batch
**Status: COMPLETE / PRODUCTION VERIFIED**

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

Implementation note (`Ver 1.0.41`): the batch remains frontend/runtime-only. G13 Pet Avatar
assets were not available (0/8), so Arena Setup intentionally uses the existing catalog emoji
fallback; Battle, reward/economy, API/Worker, database and authoritative player-data contracts
remain unchanged. Source commit `1f177f8f5ffa2dbc9b9709173149a3c84390a7e1` deployed through
Frontend Production workflow run `37203018480`; focused regression (67/67), full Node regression
(557/557), build/syntax/diff checks and anonymous Production shell/asset/console smoke all passed.

### Gate B.5 — Accessory V2 Completion
**Status: APPROVED / QUEUED / BLOCKING FOR V1.1.0**
**Risk: HIGH — reward/inventory authority; branch + QA required**
**Contract:** `ACCESSORY-V2-COMPLETION.md`

Complete and replace the unfinished generic Accessory path before Ver 1.1.0:
- five Tier identities: Adventurer Charm / Bronze Amulet / Enchanted Amulet / Platinum Talisman / Dragonheart Amulet;
- Accessory base stat is flat HP; no Crit/Dodge/Crit Damage base roll;
- base Rare HP by Tier: T1 40 / T2 52 / T3 68 / T4 88 / T5 114; existing rarity multipliers apply;
- Refine +0..+10 increases flat HP using the existing +6% per level equipment rule and existing success/economy/protection rules;
- player-facing terminology: legacy Enhance → **Refine**, legacy Empower → **Enchant**; internal compatibility fields may remain unchanged for this gate;
- Enchant pool: HP%, MP%, Crit Chance, Crit Damage, Dodge, STR, VIT, AGI, DEX, LUK; duplicate option types remain allowed;
- Elite-floor Accessory roll 2%; Chapter Boss Accessory roll 3%; these are separate from generic equipment rolls; Normal monsters do not drop Accessory;
- every Chapter Boss First Clear awards one Elite Accessory at the floor's Tier, with a newly generated independent Enchant roll; repeated Tier rewards are intentional;
- no random Mythic Accessory and no normal Main Shop Accessory sale in this gate;
- normal V2 Salvage applies; Refine/Enchant costs are not refunded;
- no Production-owned Accessory migration/audit is required for this cutover by Project Lead decision; replace the unfinished old placeholder path directly;
- Inventory/Compare/Blacksmith must present HP/Refine separately from Enchant options;
- production icons are required for all five Tier identities; no wearable Hero accessory sprite is required.

Do not weaken server reward/inventory authority or silently redesign unrelated Reward V2 economy.

### Gate C — Release acceptance
After Gate A, Gate B, and Gate B.5 are complete:
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

### WAVE 1.5 — Player Information Center
**Status: APPROVED / QUEUED AFTER WAVE 1**
**Risk: MEDIUM — player-facing information/UI; no gameplay authority change intended**

Add a shared player-facing information center under Settings after Ver 1.1.0 and Global Loading V1:
- **Announcements** — latest update, curated Ver 1.0.x/1.1.0+ version history, and a public roadmap with Completed / In Development / Planned states;
- **Game Guide / Help** — player-readable rules and authoritative gameplay information such as drop rates, Refine success, Enchant rolls, stats/caps, CC/Boss behavior, Set bonuses, Dungeon/Arena/Raid/Pet rules and other decision-relevant mechanics;
- **Terms of Service**, **Privacy Policy**, **Fair Play / Community Rules**, and **Purchase & Refund Policy** content routes/structure;
- **Account & Data**, **Support / Contact**, and **Credits / Licenses** information;
- version / effective date / last-updated metadata for policy/content documents;
- section/deep-link support so future context-help actions can open the relevant Guide topic directly.

Content rules:
- Game Guide values must be audited from the current Production implementation plus current authoritative contracts when W1.5 is implemented; do not populate balance numbers from memory or stale historical docs.
- Public roadmap/announcements are curated for players. Do not expose internal security, anti-cheat, migration, server-validation, QA-gate or exploit-sensitive implementation details.
- Announcement history for Ver 1.0.x must be reconstructed from Git/release/docs evidence rather than guessed.
- Keep information data-driven and separate from presentation so balance/release content can be updated without redesigning the UI.
- A gameplay/balance release that changes player-relevant documented behavior must review/update Help and Announcement content in the same release.
- Legal/policy drafts must describe the services/data/providers actually in use at implementation time. Live real-money monetization remains blocked until a separately approved Legal & Policy review gate; final legal text for commercial launch should receive appropriate legal review.
- W1.5 prepares Purchase/Refund UI/content structure only; it does not enable real-money checkout.

Graphics dependency: **G15 Player Information Center UI Pack** provides the shared visual identity/icons/status presentation. Cards, tabs/accordion, typography, scrolling and responsive layout remain reusable runtime UI rather than image-baked layouts.

### WAVE 2 — Admin V2 Expansion
**Status: APPROVED ROADMAP SLOT / SCOPE DESIGN PENDING**

Expand Admin V2 as the operations/audit foundation needed before the next economy-heavy systems. Detailed permissions, mutation tools and destructive-operation contracts will be approved separately. Admin Delete Item remains a candidate for this Wave; do not implement it from this roadmap heading alone.

### WAVE 3 — Blacksmith + Crafting Redesign
**Status: APPROVED ROADMAP SLOT / SCOPE DESIGN PENDING**

Redesign the Blacksmith/Crafting experience around the existing authoritative Enhance, Empower, Salvage, Craft, Recipe and Protection Stone systems. Detailed UX/mechanics changes remain subject to a separate scope contract.

### LEGAL & POLICY GATE — PRE-LIVE-MONETIZATION
**Status: REQUIRED BEFORE REAL-MONEY PURCHASES**

Before any real-money Diamond checkout or other live monetization is enabled:
- audit the current Terms, Privacy, Fair Play and Purchase/Refund policies against the actual Production account/data/payment design;
- confirm required player disclosures, consent/age handling, support/refund process and applicable market requirements;
- identify third-party processors/providers and required privacy disclosures;
- obtain appropriate final legal review for the intended launch markets.

This gate does not block WAVE 4 economy/catalog design while real-money checkout remains disabled.

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
- G15 Player Information Center UI Pack: APPROVED / QUEUED AFTER G14. Scope: production icons/visual identity for Announcements, Guide, Terms, Privacy, Fair Play and Purchase Policy plus NEW/public-roadmap status presentation. Layout/cards/accordion/text remain runtime UI.
- G16-G20: generic equipment production art, one Tier set at a time after G15 — G16 T1 Beginner/Leather, G17 T2 Bronze, G18 T3 Steel/Chain, G19 T4 Platinum, G20 T5 Dragon Slayer. Each Tier includes its matching Accessory item icon; Accessory remains icon-only with no Hero wearable layer.
- Graphics may run in parallel only where asset/runtime ownership does not conflict with the blocking release gate.

## 5. EXECUTION ORDER

```text
Historical Roadmap W0-W9R + Gameplay WAVE 1-7   ✅ COMPLETE
                     ↓
Dungeon Cloud Sync Gate                          ✅ COMPLETE
                     ↓
Current UI Fix Batch                             ✅ COMPLETE
                     ↓
Accessory V2 Completion                          🟡 QUEUED
                     ↓
QA + Production acceptance
                     ↓
Visible game version                             Ver 1.1.0
                     ↓
NEW WAVE 1 — Global Loading System V1
                     ↓
WAVE 1.5 — Player Information Center
                     ↓
WAVE 2 — Admin V2 Expansion
                     ↓
WAVE 3 — Blacksmith + Crafting Redesign
                     ↓
LEGAL & POLICY GATE — required before live monetization
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
G13 Pet Avatar → G14 Global Loading Presentation → G15 Player Information Center → G16 T1 → G17 T2 → G18 T3 → G19 T4 → G20 T5
```

## 6. Scope-control rule

New findings discovered during the pre-V1.1.0 gate are recorded for the successor roadmap unless they are:
- blockers to the gate;
- player-data/integrity risks;
- security/auth issues;
- defects that make the changed system unsafe or unverifiable.

Do not silently pull unrelated future gameplay into the Ver 1.1.0 gate.
