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

If a meaningful conflict exists, report it instead of silently choosing one source.

## 3. Active core documentation

| Document | Scope |
| --- | --- |
| [`BATTLE-SYSTEM-V1.md`](BATTLE-SYSTEM-V1.md) | Dungeon Battle V1 gameplay, shared combat architecture, turn/action flow, statuses, UI behavior, checkpointing, and reward safety. |
| [`BATTLE-VFX-V1.md`](BATTLE-VFX-V1.md) | Battle VFX presentation, timing, asset families, runtime integration, and Graphics/DEV handoff contract. |
| [`CHARACTER-PROGRESSION.md`](CHARACTER-PROGRESSION.md) | Character Status and Skills page behavior, progression direction, shared status rules, and anti-loop rules. |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Cloudflare frontend/API, D1 migration, R2, release, and deployment safety flow. |
| [`HERO-OVERLAY-V4.md`](HERO-OVERLAY-V4.md) | Current Hero overlay composition, equipment mapping, combat presentation, anchors, asset loading, and R2 paths. |
| [`HERO-SKILL-SYSTEM-V1.md`](HERO-SKILL-SYSTEM-V1.md) | Hero skill branches, ranks, statuses, prerequisites, UI contract, and combat checks. |
| [`HERO-SPRITE-V5.md`](HERO-SPRITE-V5.md) | Design-locked modular floating Hero V5 visual/animation architecture and future production reference; it does not itself authorize replacing the current production Hero. |
| [`INVENTORY-UI-V2.md`](INVENTORY-UI-V2.md) | Inventory/equipment layout, item popup, compare rules, rarity presentation, capacity, overflow, and responsive behavior. |
| [`LOGIN-AUTH-V2.md`](LOGIN-AUTH-V2.md) | Login/Auth V2 account, session, password, recovery, migration, frontend, and backend security contract. |
| [`PET-SYSTEM-V2.md`](PET-SYSTEM-V2.md) | Pet roles, progression, stats, skills, combat behavior, page UI, save migration, and playtest rules. |
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

### Battle / Combat

- [`AGENTS.md`](../AGENTS.md)
- [`BATTLE-SYSTEM-V1.md`](BATTLE-SYSTEM-V1.md)
- [`HERO-SKILL-SYSTEM-V1.md`](HERO-SKILL-SYSTEM-V1.md)
- [`PET-SYSTEM-V2.md`](PET-SYSTEM-V2.md)
- [`BATTLE-VFX-V1.md`](BATTLE-VFX-V1.md)
- [`SAVE-RELIABILITY-V1.md`](SAVE-RELIABILITY-V1.md) when persistence is affected

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
- The relevant page or system specification

## 6. Role guidance

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

## 7. Document status definitions

- **ACTIVE** — current reusable contract.
- **SUPPORTING** — useful implementation context but not authoritative.
- **TEMPORARY** — task or transition document that should later be removed or archived.
- **RETIRED** — must not be used for new implementation.

No current document is marked **RETIRED** by this index.

## 8. Maintenance rule

When an approved production contract changes:

- Update the affected **ACTIVE** document.
- Update `PROJECT-INDEX.md` if document status or task mapping changes.
- Avoid creating duplicate, competing specifications.
- Retire or remove obsolete documents when safe.
