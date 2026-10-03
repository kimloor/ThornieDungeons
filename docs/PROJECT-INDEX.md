# ThornieDungeons Project Documentation Index

Status: **ACTIVE — central documentation entry point**

## 1. Purpose

This file is the entry point for ThornieDungeons project documentation. User, Project Lead, DEV, Graphics, and QA should start here, then read only the documents mapped to the task.

## 2. Source-of-truth priority

Use this order when deciding which instruction governs:

1. Latest explicit user-approved task or decision.
2. [`AGENTS.md`](../AGENTS.md).
3. Current **ACTIVE** system documentation.
4. Current production code and configuration.
5. Implementation or temporary notes.

A user-approved task overrides documentation only within its explicit scope. Contracts not mentioned by that task remain unchanged, and a narrow task must not be treated as permission to redesign adjacent systems.

Production code/configuration describes the current implementation, but does not automatically redefine intended behavior. If production code conflicts with an **ACTIVE** contract, treat it as a discrepancy to investigate. Do not silently assume the documentation is obsolete, and do not silently change design/gameplay to match the code.

If a meaningful conflict exists, report it instead of silently choosing one source.

## 3. Active core documentation

| Document | Scope |
| --- | --- |
| [`ACTIVE-DEVELOPMENT-ROADMAP-V1.md`](ACTIVE-DEVELOPMENT-ROADMAP-V1.md) | **ACTIVE-EXECUTION** master roadmap. WAVES 1-7 are COMPLETE / Production verified; W7 presentation expansion is closed and Summoning remains separately deferred behind its own future gameplay contract. |
| [`BATTLE-SYSTEM-V1.md`](BATTLE-SYSTEM-V1.md) | Dungeon Battle V1 gameplay, shared combat architecture, turn/action flow, statuses, UI behavior, checkpointing, and reward safety. |
| [`BATTLE-RESULT-COMMIT-V1.md`](BATTLE-RESULT-COMMIT-V1.md) | **ACTIVE-DESIGN** terminal-action presentation, Result Confirming/Ready UX, Final Battle Commit direction, reward receipt/idempotency, and post-battle recovery contract. |
| [`BATTLE-VFX-V1.md`](BATTLE-VFX-V1.md) | Battle VFX presentation, timing, asset families, runtime integration, and Graphics/DEV handoff contract. |
| [`CHARACTER-PROGRESSION.md`](CHARACTER-PROGRESSION.md) | Character Status and Skills page behavior, progression direction, shared status rules, and anti-loop rules. |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Cloudflare frontend/API, D1 migration, R2, release, and deployment safety flow. |
| [`DUNGEON-FLOOR-V1.md`](DUNGEON-FLOOR-V1.md) | Dungeon Floor Select, Floor Detail, floor event/modifier presentation, monster preview, door states, and responsive entry flow. |
| [`DUNGEON-STAT-SCALING-V2.md`](DUNGEON-STAT-SCALING-V2.md) | **ACTIVE-PRODUCTION** Dungeon V2 Normal/Elite/Boss combat-stat scaling, monster identity profiles, pack scaling, Boss profiles, and Enrage. |
| [`DUNGEON-MONSTER-SKILLS-V2.md`](DUNGEON-MONSTER-SKILLS-V2.md) | **ACTIVE-PRODUCTION** WAVE 1.5 Normal/Elite Monster skill cycles, Boss skills/phases, targeting and checkpoint/Skip determinism. |
| [`DUNGEON-REWARD-PROGRESSION-V2.md`](DUNGEON-REWARD-PROGRESSION-V2.md) | **ACTIVE-DESIGN / USER-APPROVED** Dungeon Reward V2: Tier/Rarity, Normal/Elite/Boss rewards, First-Clear Accessory, Boss materials/Mythic crafting, EXP/Gold/material economy, salvage, and Shop/Crafting reward roles. |
| [`SOCIAL-SYSTEM-V1.md`](SOCIAL-SYSTEM-V1.md) | **ACTIVE-PRODUCTION** shared character-scoped Social foundation: identity, presence, block, unread, lifecycle, security, and shared errors. Live; consumed by Friend V1. |
| [`FRIEND-SYSTEM-V1.md`](FRIEND-SYSTEM-V1.md) | **ACTIVE-PRODUCTION** Friend search/requests, 50-friend cap, remove/block, presence, profile, and DM eligibility. |
| [`CHAT-SYSTEM-V1.md`](CHAT-SYSTEM-V1.md) | **ACTIVE-PRODUCTION** — Global, Direct, and Guild Chat; polling, retention, unread, rate limits, and Sticker placeholder. |
| [`GUILD-SYSTEM-V1.md`](GUILD-SYSTEM-V1.md) | **ACTIVE-PRODUCTION** — lifecycle, Leader/Member roles, applications, level/capacity, succession, W2 Donation, and W3 Guild Chat integration. |
| [`HERO-OVERLAY-V4.md`](HERO-OVERLAY-V4.md) | Current Hero overlay composition, equipment mapping, combat presentation, anchors, asset loading, and R2 paths. |
| [`HERO-SKILL-SYSTEM-V1.md`](HERO-SKILL-SYSTEM-V1.md) | Hero skill branches, ranks, statuses, prerequisites, UI contract, and combat checks. |
| [`HERO-SPRITE-V5.md`](HERO-SPRITE-V5.md) | Design-locked Hero V5 **modular layered, frame-based sprite** architecture; no skeletal/bone/Spine runtime is required, and the document does not itself authorize replacing the current production Hero. |
| [`INVENTORY-UI-V2.md`](INVENTORY-UI-V2.md) | Inventory/equipment layout, item popup, compare rules, rarity presentation, capacity, overflow, and responsive behavior. |
| [`LOGIN-AUTH-V2.md`](LOGIN-AUTH-V2.md) | Login/Auth V2 account, session, password, recovery, migration, frontend, and backend security contract. |
| [`ADMIN-V2.md`](ADMIN-V2.md) | **ACTIVE-PRODUCTION** Admin V2 auth/session foundation plus Phase 1 Dashboard, server-side Player Search, sanitized read-only Player Viewer/Items, and audit-safe read paths. |
| [`NAVIGATION-SETTINGS-V1.md`](NAVIGATION-SETTINGS-V1.md) | Shared bottom navigation, More menu, Settings/account-security hub, return flows, and mobile navigation behavior. |
| [`PET-SYSTEM-V2.md`](PET-SYSTEM-V2.md) | Pet roles, progression, stats, skills, combat behavior, page UI, save migration, and playtest rules. |
| [`PHASER-COMBAT-ARENA-V1.md`](PHASER-COMBAT-ARENA-V1.md) | **ACTIVE-DESIGN** shared Phaser presentation architecture for Combat/Arena/preview surfaces; W9 Arena gameplay changes are governed by `ARENA-V2-W9.md`. |
| [`ARENA-V2-W9.md`](ARENA-V2-W9.md) | **ACTIVE-PRODUCTION / W9 CLOSED** Arena V2 gameplay, season, rating, Ticket/Coin, rewards, setup, matchmaking, history, Profile Frame, mobile UX, Phaser battlefield, rollout and cleanup contract. |
| [`PIXELLAB-WORKFLOW.md`](PIXELLAB-WORKFLOW.md) | **ACTIVE-TOOLING** reusable PixelLab GitHub Actions workflow, inputs, image/animation generation flow, GIF preview, review rules, and R2 handoff guardrails. |
| [`RAID-SYSTEM-V1.md`](RAID-SYSTEM-V1.md) | **ACTIVE-PRODUCTION** Raid boss roster/rotation, HP scaling, W5 Raid/Wings V2, Raid asset contract, persistence boundaries, auth/backend safety, and Raid verification. |
| [`SAVE-RELIABILITY-V1.md`](SAVE-RELIABILITY-V1.md) | Ordered persistence, retries, save state, session ownership, battle checkpoints, and transaction safety. |
| [`TOWN-HUB.md`](TOWN-HUB.md) | Stable Town/Main Hub artwork separation, navigation consistency, mobile UI, and build rules. |

Repository-wide references:

- [`/AGENTS.md`](../AGENTS.md) — default working, safety, build, asset, testing, documentation, and handoff rules.
- [`/r2-upload/README.md`](../r2-upload/README.md) — R2 staging, direct path mapping, supported files, verification, and upload workflow rules.

## 4. Supporting and non-authoritative documentation

| Status | Document | Use |
| --- | --- | --- |
| **SUPPORTING / COMPLETED GATE** | [`POST-W6-FULL-GAP-SECURITY-AUDIT-2026-10-03.md`](POST-W6-FULL-GAP-SECURITY-AUDIT-2026-10-03.md) | Completed Post-W6 full-system gap/security re-audit, resolved blocker, deferred debt, and W7 entry conditions. |
| **SUPPORTING / COMPLETED GATE** | [`PRE-W6-READINESS-AUDIT-2026-10-03.md`](PRE-W6-READINESS-AUDIT-2026-10-03.md) | Completed Pre-W6 readiness audit, resolved blocker record, expected W6 targets, and release-entry conditions. |
| **SUPPORTING** | [`BATTLE-V1-IMPLEMENTATION-NOTES.md`](BATTLE-V1-IMPLEMENTATION-NOTES.md) | Battle V1 implementation and rollout context. It does not override the active Battle contract. |
| **SUPPORTING / RELEASE RECORD** | [`ARENA-V2-HUB-CORE-R1-PUBLICATION.md`](ARENA-V2-HUB-CORE-R1-PUBLICATION.md) | Published Arena Hub Core R1 asset paths, dimensions, manifest keys, and nine-slice contract. |
| **SUPPORTING / GRAPHICS CONTRACT** | [`ARENA-V2-TIER-BADGES-BRIEF.md`](ARENA-V2-TIER-BADGES-BRIEF.md) | Approved/published Bronze, Silver, Gold, and Diamond Arena tier badge contract. |
| **SUPPORTING / GRAPHICS TRACKING** | [`ARENA-V2-GRAPHICS-ASSET-CHECKLIST.md`](ARENA-V2-GRAPHICS-ASSET-CHECKLIST.md) | Arena V2 graphics publication/verification checklist and production release records. |
| **SUPPORTING / SCHEMA CONTRACT** | [`ARENA-V2-W9-SCHEMA-CONTRACT.md`](ARENA-V2-W9-SCHEMA-CONTRACT.md) | Implemented Arena V2 W9 additive schema contract and integration constraints. |
| **SUPPORTING / IMPLEMENTATION RECORD** | [`ARENA-V2-W9-IMPLEMENTATION-ROADMAP.md`](ARENA-V2-W9-IMPLEMENTATION-ROADMAP.md) | Closed W9 implementation/release record. Retain while it remains a path trigger in Battle Core parity CI. |

## 5. Read-by-task map

For active sequencing/priorities from the current post-W9R baseline — Dungeon V2, Reward V2, Enhance/Empower V2.1, Mythic content, Server Authority / Economy Security, Raid/Wings, Security Hardening, cutover, full gap/security re-audit, presentation, Admin V2 and Graphics/QA parallel lanes — read [`ACTIVE-DEVELOPMENT-ROADMAP-V1.md`](ACTIVE-DEVELOPMENT-ROADMAP-V1.md) first.

Read only the documents relevant to the requested scope. Do not load unrelated system specifications unless a dependency or conflict requires them.

### Battle / Combat

- [`AGENTS.md`](../AGENTS.md)
- [`BATTLE-SYSTEM-V1.md`](BATTLE-SYSTEM-V1.md)
- [`BATTLE-RESULT-COMMIT-V1.md`](BATTLE-RESULT-COMMIT-V1.md) when final-hit presentation, Result UI, completion receipt, or reward persistence is affected
- [`HERO-SKILL-SYSTEM-V1.md`](HERO-SKILL-SYSTEM-V1.md)
- [`PET-SYSTEM-V2.md`](PET-SYSTEM-V2.md)
- [`BATTLE-VFX-V1.md`](BATTLE-VFX-V1.md)
- [`PHASER-COMBAT-ARENA-V1.md`](PHASER-COMBAT-ARENA-V1.md) when battlefield renderer/presentation is affected
- [`SAVE-RELIABILITY-V1.md`](SAVE-RELIABILITY-V1.md) when persistence is affected

### Arena

- [`AGENTS.md`](../AGENTS.md)
- [`ARENA-V2-W9.md`](ARENA-V2-W9.md) — dedicated W9 Arena V2 source of truth
- [`PHASER-COMBAT-ARENA-V1.md`](PHASER-COMBAT-ARENA-V1.md) — shared Phaser presentation architecture
- [`BATTLE-SYSTEM-V1.md`](BATTLE-SYSTEM-V1.md) only for shared Battle Core rules reused by Arena
- [`SAVE-RELIABILITY-V1.md`](SAVE-RELIABILITY-V1.md) when match/reward/idempotency persistence is affected
- [`LOGIN-AUTH-V2.md`](LOGIN-AUTH-V2.md) when Arena APIs/session ownership are affected

### Raid

- [`AGENTS.md`](../AGENTS.md)
- [`RAID-SYSTEM-V1.md`](RAID-SYSTEM-V1.md)
- [`BATTLE-SYSTEM-V1.md`](BATTLE-SYSTEM-V1.md) only when shared combat behavior is affected
- [`SAVE-RELIABILITY-V1.md`](SAVE-RELIABILITY-V1.md) when persistence is affected
- [`LOGIN-AUTH-V2.md`](LOGIN-AUTH-V2.md) when auth/session behavior is affected
- [`r2-upload/README.md`](../r2-upload/README.md) when Raid assets are affected

### Dungeon / Floor Select

- [`AGENTS.md`](../AGENTS.md)
- [`DUNGEON-FLOOR-V1.md`](DUNGEON-FLOOR-V1.md)
- [`DUNGEON-STAT-SCALING-V2.md`](DUNGEON-STAT-SCALING-V2.md) when monster/Elite/Boss stats, pack scaling, monster identity, Boss profile, or Enrage balance is affected
- [`DUNGEON-MONSTER-SKILLS-V2.md`](DUNGEON-MONSTER-SKILLS-V2.md) when Normal/Elite/Boss Dungeon skills, rotations, phase mechanics, targeting, or Skip/checkpoint determinism is affected
- [`DUNGEON-REWARD-PROGRESSION-V2.md`](DUNGEON-REWARD-PROGRESSION-V2.md) when Dungeon rewards, equipment Tier/Rarity, drops, Boss chest/materials, Gold/EXP/material economy, Shop reward role, or Crafting reward role is affected
- [`BATTLE-SYSTEM-V1.md`](BATTLE-SYSTEM-V1.md) when entry/battle behavior is affected
- [`r2-upload/README.md`](../r2-upload/README.md) when Dungeon assets are affected

### Navigation / Settings

- [`AGENTS.md`](../AGENTS.md)
- [`NAVIGATION-SETTINGS-V1.md`](NAVIGATION-SETTINGS-V1.md)
- [`LOGIN-AUTH-V2.md`](LOGIN-AUTH-V2.md) when account/security behavior is affected
- [`TOWN-HUB.md`](TOWN-HUB.md) when Main/Town shell behavior is affected

### Hero / Equipment Sprite

- [`AGENTS.md`](../AGENTS.md)
- [`HERO-SPRITE-V5.md`](HERO-SPRITE-V5.md)
- [`HERO-OVERLAY-V4.md`](HERO-OVERLAY-V4.md)
- [`r2-upload/README.md`](../r2-upload/README.md) and the relevant manifest/R2 rules

### Pet

- [`AGENTS.md`](../AGENTS.md)
- [`PET-SYSTEM-V2.md`](PET-SYSTEM-V2.md)
- [`BATTLE-SYSTEM-V1.md`](BATTLE-SYSTEM-V1.md) when combat is affected
- [`BATTLE-VFX-V1.md`](BATTLE-VFX-V1.md) when effects are affected

### Inventory

- [`AGENTS.md`](../AGENTS.md)
- [`INVENTORY-UI-V2.md`](INVENTORY-UI-V2.md)
- [`HERO-SPRITE-V5.md`](HERO-SPRITE-V5.md) and [`HERO-OVERLAY-V4.md`](HERO-OVERLAY-V4.md) when equipped appearance is affected

### Social / Friend / Chat / Guild

- [`AGENTS.md`](../AGENTS.md)
- [`SOCIAL-SYSTEM-V1.md`](SOCIAL-SYSTEM-V1.md)
- [`FRIEND-SYSTEM-V1.md`](FRIEND-SYSTEM-V1.md) for Friend behavior
- [`CHAT-SYSTEM-V1.md`](CHAT-SYSTEM-V1.md) for Chat behavior
- [`GUILD-SYSTEM-V1.md`](GUILD-SYSTEM-V1.md) for Guild behavior
- [`LOGIN-AUTH-V2.md`](LOGIN-AUTH-V2.md) for session/account-to-character authorization boundaries
- [`SAVE-RELIABILITY-V1.md`](SAVE-RELIABILITY-V1.md) when persistence/transaction safety is affected
- [`NAVIGATION-SETTINGS-V1.md`](NAVIGATION-SETTINGS-V1.md) when adding/changing Friend/Chat/Guild routes or badges
- [`DEPLOYMENT.md`](DEPLOYMENT.md) for backend/D1 migration or release work

### Admin

- [`AGENTS.md`](../AGENTS.md)
- [`ADMIN-V2.md`](ADMIN-V2.md)
- [`LOGIN-AUTH-V2.md`](LOGIN-AUTH-V2.md) only when shared auth primitives/patterns are reused
- [`DEPLOYMENT.md`](DEPLOYMENT.md) for D1 migration or Worker release work

### Login / Auth

- [`AGENTS.md`](../AGENTS.md)
- [`LOGIN-AUTH-V2.md`](LOGIN-AUTH-V2.md)
- [`SAVE-RELIABILITY-V1.md`](SAVE-RELIABILITY-V1.md) when player persistence is involved
- [`DEPLOYMENT.md`](DEPLOYMENT.md) for backend or deployment work

### Save / Backend

- [`AGENTS.md`](../AGENTS.md)
- [`SAVE-RELIABILITY-V1.md`](SAVE-RELIABILITY-V1.md)
- [`DEPLOYMENT.md`](DEPLOYMENT.md)
- The relevant active system specification

### Graphics / R2

- [`AGENTS.md`](../AGENTS.md)
- [`PIXELLAB-WORKFLOW.md`](PIXELLAB-WORKFLOW.md) when generating or animating assets with PixelLab
- [`r2-upload/README.md`](../r2-upload/README.md)
- The relevant visual or system specification
- Verify paths in `r2-upload/manifest.json`; do not guess asset keys or paths

### Town / UI

- [`AGENTS.md`](../AGENTS.md)
- [`TOWN-HUB.md`](TOWN-HUB.md)
- [`NAVIGATION-SETTINGS-V1.md`](NAVIGATION-SETTINGS-V1.md) when shared navigation/settings is affected
- The relevant page or system specification

## 6. Documentation gaps / unmapped systems

The following important areas do not currently have a dedicated **ACTIVE** system document in `docs/`:

- **Arena gameplay contract:** `ARENA-V2-W9.md` is now the active W9 contract.
- **Full Shop / Crafting feature contracts and Summoning** — Reward-facing Shop/Crafting economy rules are covered by DUNGEON-REWARD-PROGRESSION-V2.md, but full feature contracts are still unmapped.

Until a dedicated contract exists, inspect latest `main`, the latest approved task/decision, and directly related code/configuration before changing behavior. Do not invent missing game rules or infer them from unrelated systems.

## 7. Role guidance

### Project Lead

- Read this index and only the relevant specifications.
- Define task scope and risk.
- Avoid loading unrelated documents.

### DEV

- Read `AGENTS.md` and the task-mapped documents.
- Inspect latest `main` before making changes.

### Graphics

- Read the relevant visual contract, current execution wave, and R2 rules.
- All new/replaced production icons must pass the shared **Production icon asset budget** in `r2-upload/README.md` before publication; keep large editable masters separate from runtime exports.
- **G10 Shared ATB Actor Icon Pack** is COMPLETE / integrated in shared Dungeon Battle and Arena TurnOrderBar presentation.
- Current Graphics entry point is **G11 Robot + Skeleton Set Item Icons**, using the shared icon budget.
- Do not infer asset names, manifest keys, or paths.

### QA

- Validate implementation against the approved task and applicable **ACTIVE** specifications.
- Flag task/document/code conflicts instead of silently resolving them.

## 8. Document status definitions

- **ACTIVE-PRODUCTION** — approved reusable contract intended to describe current production behavior.
- **ACTIVE-DESIGN** — approved design/future contract that may not yet be fully implemented in production.
- **ACTIVE** — current reusable contract when production/design distinction has not yet been explicitly classified.
- **SUPPORTING** — useful implementation context but not authoritative.
- **TEMPORARY** — task or transition document that should later be removed or archived.
- **RETIRED** — must not be used for new implementation.

Do not guess status transitions. If implementation state is uncertain, keep the existing classification and verify latest `main` before changing it.

No current document is marked **RETIRED** by this index.

## 9. Documentation health

**Known documentation conflicts:** None currently verified.

**Documentation gaps:** Full Shop / Crafting feature contracts and Summoning. Reward-facing Shop/Crafting economy rules are mapped by `DUNGEON-REWARD-PROGRESSION-V2.md`. Arena V2 is mapped by `ARENA-V2-W9.md`; shared presentation remains mapped by `PHASER-COMBAT-ARENA-V1.md`.

When a conflict is resolved, remove it from unresolved conflicts rather than leaving stale warnings in this index.

## 10. Maintenance rule

When an approved production contract changes:

- Update the affected **ACTIVE** document.
- Update `PROJECT-INDEX.md` if document status or task mapping changes.
- Avoid creating duplicate, competing specifications.
- Retire or remove obsolete documents when safe.

### Current post-W9R execution update
- WAVE 1 Dungeon V2 Encounter + Stat Foundation: COMPLETE / PRODUCTION.
- WAVE 1.5 Dungeon Monster Skills + Boss Mechanics: COMPLETE / PRODUCTION.
- WAVES 1-3: COMPLETE / PRODUCTION VERIFIED.
- WAVE 4 Mythic Boss Weapons + Mythic Set System: COMPLETE / PRODUCTION VERIFIED.
- WAVE 4.5 Server Authority / Economy Security: COMPLETE / PRODUCTION VERIFIED.
- WAVE 5 Raid / Wings V2: COMPLETE / PRODUCTION VERIFIED.
- WAVE 5.5 Security Hardening: COMPLETE / PRODUCTION VERIFIED.
- Pre-WAVE 6 Readiness Audit: COMPLETE / GATE PASSED; Azure 6pc drift resolved and Production verified by PR #58.
- WAVE 6 V2 Production Cutover + Legacy Special-Item Cleanup: COMPLETE / PRODUCTION VERIFIED; PR #60 / merge `9c8f716c6cff1acc38593acf42fafab7d6c11312`.
- Post-WAVE 6 Full Project Gap Audit + Security Re-Audit: COMPLETE / GATE PASSED; inventory read-isolation blocker resolved and Production verified by PR #63.
- WAVE 7 Presentation Expansion: COMPLETE / PRODUCTION VERIFIED; W7A Terminal/Boss/Enrage/Raid + W7B Enhance/Craft presentation shipped. Summoning remains separately deferred.
- Admin V2 Phase 1: COMPLETE / PRODUCTION VERIFIED; Dashboard + server-side Player Search + sanitized read-only Player Viewer/Items shipped in PR #71.
