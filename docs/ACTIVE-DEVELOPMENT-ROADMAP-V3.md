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
**Status: COMPLETE / PRODUCTION VERIFIED**
**Risk: HIGH — reward/inventory authority; branch + QA completed**
**Contract:** `ACCESSORY-V2-COMPLETION.md`
**Implementation:** PR #102 merged `7adff7428761b4ce90cc798518a64c33d26d3d7b`; documentation reconciliation PR #105 merged `230d6b5fd3a1af255344abc2e962ff40b35f3213`.
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

### Gate C — Ver 1.1.0 Release Acceptance
**Status: IN PROGRESS — evidence recorded 2026-10-10; AWAITING Owner approval for the Ver 1.1.0 bump (C8)**
**Risk: RELEASE GATE — no new gameplay authority intended**

Gate C is the final acceptance gate before declaring the pre-V1.1.0 release complete. It verifies the current Production state as a whole, with special attention to the systems changed during Gates A/B/B.5 and the approved Dungeon V2 Skill/Event work.

#### C1 — Release baseline / source integrity
- Verify latest remote `main` SHA before testing.
- Verify working tree is clean and no unapproved work is mixed into the release.
- Confirm Gate A, Gate B, Gate B.5 and approved Dungeon V2 Skill/Event work are present on `main`.
- Confirm no unresolved P0/P1 blocker or critical regression is known.
- Reconcile roadmap / `PROJECT-INDEX.md` statuses and consolidate scattered Arena V2 docs (doc-only).
- Owner confirms repository/credential hygiene (access tokens, repo visibility) before release.

#### C2 — Build / generated frontend integrity
- Run `node build.js`.
- Verify generated `index.html` is deterministic/current.
- Run `git diff --exit-code -- index.html`.
- Run `git diff --check`.
- Verify frontend syntax/build output and required production assets.

#### C3 — Automated regression gate
Run focused regression for Battle Core / Battle Result / checkpoint, Dungeon Floor / Monster Skills / Boss Phase + Enrage, Dungeon Event Floor, Accessory V2, Inventory/Equipment/Compare/Shop/Sell, Arena/shared navigation/runtime errors, and relevant Admin/Auth/Security suites. Run the broader Node regression suite where practical and record exact pass/fail counts; never claim full-suite green unless the complete suite passes. Known baseline to resolve first: the full suite failed on `main` `c41fb15` (test database lacked `item_provenance` / `item_ownership_events` after per-request DDL removal, plus stale source-regex tests for the old battle-end flow); fix/confirm before counting C3 as passed. Also verify Production D1 contains both tables.

#### C4 — Dungeon Production acceptance
- Verify Normal / Elite / Boss encounter selection.
- Verify Monster/Boss skill name, effect and damage.
- Verify Poison / Stun / Armor Break / DEF Up.
- Verify Boss Phase / Enrage.
- Verify Event Floor display and active Event behavior.
- Verify Manual result plus Skip/checkpoint parity and existing Auto paths.
- Verify Event does not create an extra battle or convert Normal to Elite.

#### C5 — Accessory / Inventory Production acceptance
- Verify all five Accessory identities.
- Verify flat HP is separate from Enchant options.
- Verify Refine / Enchant terminology and item detail/compare mobile layout.
- Verify acquisition/drop presentation and no regression to capacity, salvage, Shop/Sell.

#### C6 — Shared mobile/UI acceptance
Verify Login/bootstrap/loading, Global Currency/navigation, bottom-nav safe area, Arena header/setup/history, Character Skills, Dungeon Floor/Battle, Inventory/Equipment/Compare, runtime error popup, and iPhone/mobile scrolling, overlays, selectors and touch targets. Include a read-only audit of other overlays whose header scrolls away (fix only if broken; full overlay migration belongs to Client Systems PR-D).

#### C7 — Production smoke / deployment evidence
- Verify deployed frontend/API versions and workflow success.
- Run anonymous/normal-user Production smoke checks.
- Verify critical R2 assets and generated frontend.
- Verify no console/runtime error in the smoke path.
- Record deployment workflow/run IDs and final Production SHA.
- Record the missing W5.5 Security Hardening post-merge Production verification.
- Review open security follow-ups in the Owner's confidential plan; each is either fixed, or explicitly accepted as a known issue by the Owner at C8.

#### Gate C evidence record (2026-10-10, `main` `a0469e5`)

| Check | Result |
| --- | --- |
| C1 baseline | `main` clean; no unmerged required work |
| C2 build | `node build.js` 63 modules; `index.html` regenerated with no diff; `git diff --check` clean |
| C3 regression | full suite 649/649 on repeated separate runs (20 consecutive runs 640/640 on `a16cb3e`; 5 runs 649/649 on the final defeat-log branch); Production D1 has `item_provenance` and `item_ownership_events` |
| C4 Dungeon | Owner production test passed after fixes below |
| C5 Accessory/Inventory | Owner production test passed |
| C6 Mobile/UI | Owner production test passed |
| C7 smoke | Deploy API / Deploy Frontend / Battle Core parity succeeded on `5513f3c`; Deploy Frontend succeeded on `a0469e5`; Sync R2 asset manifest repaired (PR #113) and scheduled run succeeded |

Fixes made inside Gate C: test determinism for Event Floor rewards (PR #109, #110); Raid Wing pre-rolled Enchant options, Boss Enrage battle log, Dungeon monster pool by floor with fixed bosses and resume-safe legacy checkpoints (PR #112, contract in `DUNGEON-FLOOR-V1.md` section 7); `Sync R2 asset manifest` jq argument-limit failure (PR #113); full battle log on the Defeat screen (PR #114).

Open before C8 approval:
- Owner confirms a newly issued Raid Wing arrives with Enchant options on Production.

Known non-blocking issues accepted for Ver 1.1.0:
- Raid Wings issued before the fix may still have empty Enchant slots; no data repair scheduled (Production data is test data).
- Open security follow-ups are tracked privately by the Owner and are accepted or scheduled there; they are intentionally not detailed in this public repository.

#### C8 — Release decision
Gate C passes only when mandatory focused tests, build/generated-file/diff checks and Production smoke pass; no P0/P1 blocker or critical regression remains; non-blocking known issues are recorded; and Owner approves the release/version bump.

Only after C8 approval: bump visible version to **Ver 1.1.0**, build again, deploy Production, perform final post-deploy smoke, clean merged work branches, remove dead shop code (`generateShopStock` / `shopBuyPrice` if unused), review `docs/hero-v5-*` review-image folders and one-off workflows (delete only after confirmation), and mark Gate C + pre-V1.1.0 **COMPLETE / PRODUCTION VERIFIED**.

**Out of scope for Gate C:** new gameplay design, Global Loading, Player Information Center, Admin V2 expansion, Shop/Diamond monetization, Pet Gacha redesign, Market, and Offline/AFK Loot.


## 3. NEW ROADMAP — FRESH NUMBERING

The successor roadmap starts here, after Ver 1.1.0 gate acceptance.

### WAVE 1 PREP — Client Systems V1
**Status: PROPOSED / QUEUED AFTER Ver 1.1.0**
**Risk: MEDIUM-HIGH — touches many client flows; no server contract or economy change**

One PR per component, in order, each stopping for Owner approval: PR-C Error catalog (code → Thai message) → PR-B API client policy table (timeout/retry/dedupe/session handling) → PR-A Server Operation Manager (requestId reuse on retry, optimistic/rollback, per-character queue, lock registry) → PR-D Overlay shell (migrate Inventory/Craft/Mail/Guild one per commit). Boundary with WAVE 1: Global Loading = full-screen blocking only; Server Operation Manager = inline pending; never both for one action. Contract doc: `CLIENT-SYSTEMS-V1.md` (to be written).

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
- no gameplay/save/API authority changes;
- includes Client Systems PR-E (loading task registry: register/complete/fail for assets/manifest, login, hydrate, scene change).

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

Expand Admin V2 as the operations/audit foundation needed before the next economy-heavy systems. Detailed permissions, mutation tools and destructive-operation contracts will be approved separately. Admin surface hardening (escaping/rendering review of `admin.html`) is included in this Wave. Admin Delete Item remains a candidate for this Wave; do not implement it from this roadmap heading alone.

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

Shop follow-ups parked from Shop-and-Sell V1 to decide here: multi-row/multi-select selling (reserved sell tab), equipment reroll cost/cooldown, server-sent sell prices instead of a duplicated client formula.

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

### FUTURE SYSTEM — Dungeon Auto Progress V2
**Status: DESIGN LOCKED / ROADMAP PLACEMENT PENDING**
**Risk: HIGH — Dungeon combat/reward progression and settlement integration; implementation contract + QA required**

Approved design boundary:
- Dungeon Hub will allow the player to choose an eligible previously cleared Starting Floor for Auto Progress; exact Floor-select UI/eligibility must be verified against the current Production Dungeon state during implementation.
- Auto Progress starts at the selected Floor and continues sequentially upward one Floor at a time until the player is defeated or a requested stop completes.
- There is no fixed 20-Floor run cap. Existing equipment Tier bands are the natural farming incentive; lower Floors continue to generate their own lower-Tier rewards.
- Auto Progress uses the real Battle scene and the shared authoritative Battle Core rather than a separate simulated/Skip combat resolver.
- While Auto Progress is active, Battle speed is forced to **x2**.
- **Skip is unavailable** during Auto Progress.
- The legacy/current Battle **Auto** control is hidden/disabled during Auto Progress so only one auto-action owner exists.
- Auto attack mode is intentionally simple: player selects **Basic Attack** or **Use Skills**.
- In Use Skills mode, each Hero decision checks equipped Skill Slots in fixed priority **1 → 2 → 3 → 4**, restarting from Slot 1 on every decision. If a skill cannot currently be used under normal Battle rules, continue to the next slot; if none can be used, fall back to Basic Attack.
- Auto Potion supports player-configured **HP%** and **SP%** thresholds. Potion availability, consumption, cooldown/turn behavior and all other restrictions remain the same as Manual Battle; Auto must not gain extra potion authority.
- A player pressing **Stop Progress** does **not** interrupt the current Battle. Mark the run to stop after that Battle resolves normally.
- If the current Battle wins after Stop Progress was requested, commit that Battle's normal authoritative reward/settlement, do not start the next Floor, then show the run summary.
- If the current Battle is lost, Auto Progress stops because of defeat and shows the run summary.
- Every completed Battle keeps the existing authoritative settlement/idempotency/First-Clear/reward rules. The final Auto Progress Summary is presentation/aggregation only and must not become a client-owned deferred reward commit.
- Summary must distinguish at minimum a normal player-requested stop from defeat and aggregate the completed run's Floors/results/rewards.
- Do not add per-skill HP/MP conditions, target-rule editors, custom rotations, offline combat simulation, or other rule-engine complexity to this approved Auto Progress scope.

**Explicitly not locked here:** Offline/AFK Loot design and rates. That system is still under separate Project Lead design discussion and must not be inferred from this Auto Progress contract.

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
Accessory V2 Completion                          ✅ COMPLETE
                     ↓
Dungeon V2 Skill + Event acceptance             ✅ COMPLETE
                     ↓
Gate C — Ver 1.1.0 Release Acceptance            🟡 IN PROGRESS (awaiting Owner approval)
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
