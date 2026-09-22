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
| [`BATTLE-SYSTEM-V1.md`](BATTLE-SYSTEM-V1.md) | Dungeon Battle V1 gameplay, shared combat architecture, turn/action flow, statuses, UI behavior, checkpointing, and reward safety. |
| [`BATTLE-VFX-V1.md`](BATTLE-VFX-V1.md) | Battle VFX presentation, timing, asset families, runtime integration, and Graphics/DEV handoff contract. |
| [`CHARACTER-PROGRESSION.md`](CHARACTER-PROGRESSION.md) | Character Status and Skills page behavior, progression direction, shared status rules, and anti-loop rules. |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Cloudflare frontend/API, D1 migration, R2, release, and deployment safety flow. |
| [`DUNGEON-FLOOR-V1.md`](DUNGEON-FLOOR-V1.md) | Dungeon Floor Select, Floor Detail, floor event/modifier presentation, monster preview, door states, and responsive entry flow. |
| [`SOCIAL-SYSTEM-V1.md`](SOCIAL-SYSTEM-V1.md) | **ACTIVE-PRODUCTION** shared character-scoped Social foundation: identity, presence, block, unread, lifecycle, security, and shared errors. Live; consumed by Friend V1. |
| [`FRIEND-SYSTEM-V1.md`](FRIEND-SYSTEM-V1.md) | **ACTIVE-PRODUCTION** Friend search/requests, 50-friend cap, remove/block, presence, profile, and DM eligibility. |
| [`CHAT-SYSTEM-V1.md`](CHAT-SYSTEM-V1.md) | **ACTIVE-PRODUCTION for Global + Direct** — polling, retention, unread, rate limits, Sticker placeholder. Guild Chat not implemented. |
| [`GUILD-SYSTEM-V1.md`](GUILD-SYSTEM-V1.md) | **ACTIVE-PRODUCTION for Core** — lifecycle, Leader/Member roles, applications, level/capacity, succession. Donation and Guild Chat not implemented. |
| [`HERO-OVERLAY-V4.md`](HERO-OVERLAY-V4.md) | Current Hero overlay composition, equipment mapping, combat presentation, anchors, asset loading, and R2 paths. |
| [`HERO-SKILL-SYSTEM-V1.md`](HERO-SKILL-SYSTEM-V1.md) | Hero skill branches, ranks, statuses, prerequisites, UI contract, and combat checks. |
| [`HERO-SPRITE-V5.md`](HERO-SPRITE-V5.md) | Design-locked Hero V5 **modular layered, frame-based sprite** architecture; no skeletal/bone/Spine runtime is required, and the document does not itself authorize replacing the current production Hero. |
| [`INVENTORY-UI-V2.md`](INVENTORY-UI-V2.md) | Inventory/equipment layout, item popup, compare rules, rarity presentation, capacity, overflow, and responsive behavior. |
| [`LOGIN-AUTH-V2.md`](LOGIN-AUTH-V2.md) | Login/Auth V2 account, session, password, recovery, migration, frontend, and backend security contract. |
| [`NAVIGATION-SETTINGS-V1.md`](NAVIGATION-SETTINGS-V1.md) | Shared bottom navigation, More menu, Settings/account-security hub, return flows, and mobile navigation behavior. |
| [`PET-SYSTEM-V2.md`](PET-SYSTEM-V2.md) | Pet roles, progression, stats, skills, combat behavior, page UI, save migration, and playtest rules. |
| [`RAID-SYSTEM-V1.md`](RAID-SYSTEM-V1.md) | Raid boss roster/rotation, HP scaling, Raid asset contract, persistence boundaries, auth/backend safety, and Raid verification. |
| [`SAVE-RELIABILITY-V1.md`](SAVE-RELIABILITY-V1.md) | Ordered persistence, retries, save state, session ownership, battle checkpoints, and transaction safety. |
| [`TOWN-HUB.md`](TOWN-HUB.md) | Stable Town/Main Hub artwork separation, navigation consistency, mobile UI, and build rules. |

Repository-wide references:

- [`/AGENTS.md`](../AGENTS.md) — default working, safety, build, asset, testing, documentation, and handoff rules.
- [`/r2-upload/README.md`](../r2-upload/README.md) — R2 staging, direct path mapping, supported files, verification, and upload workflow rules.

## 4. Supporting and non-authoritative documentation

| Status | Document | Use |
| --- | --- | --- |
| **SUPPORTING** | [`BATTLE-V1-IMPLEMENTATION-NOTES.md`](BATTLE-V1-IMPLEMENTATION-NOTES.md) | Battle V1 implementation and rollout context. It does not override the active Battle contract. |
| **TEMPORARY** | [`TEMP-REFACTOR-ROADMAP.md`](TEMP-REFACTOR-ROADMAP.md) | Pending transition/refactor roadmap. It is not a permanent source of truth and must be rechecked against latest `main`. |

## 5. Read-by-task map

Read only the documents relevant to the requested scope. Do not load unrelated system specifications unless a dependency or conflict requires them.

### Battle / Combat

- [`AGENTS.md`](../AGENTS.md)
- [`BATTLE-SYSTEM-V1.md`](BATTLE-SYSTEM-V1.md)
- [`HERO-SKILL-SYSTEM-V1.md`](HERO-SKILL-SYSTEM-V1.md)
- [`PET-SYSTEM-V2.md`](PET-SYSTEM-V2.md)
- [`BATTLE-VFX-V1.md`](BATTLE-VFX-V1.md)
- [`SAVE-RELIABILITY-V1.md`](SAVE-RELIABILITY-V1.md) when persistence is affected

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

- **Arena**
- **Shop / Crafting / Summoning**

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

- Read the relevant visual contract and R2 rules.
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

**Documentation gaps:** Arena; Shop / Crafting / Summoning.

When a conflict is resolved, remove it from unresolved conflicts rather than leaving stale warnings in this index.

## 10. Maintenance rule

When an approved production contract changes:

- Update the affected **ACTIVE** document.
- Update `PROJECT-INDEX.md` if document status or task mapping changes.
- Avoid creating duplicate, competing specifications.
- Retire or remove obsolete documents when safe.
