# Blacksmith V2 — Module Separation and UI Redesign

Status: **ACTIVE — module separation in progress**

## 1. Purpose

Keep Blacksmith-specific UI and forge presentation code in dedicated files so future Blacksmith work does not require searching through shared UI and generic Phaser modules. This task is a code-organization refactor only; it does not implement the Wave 3.1 visual redesign.

## 2. Source modules

### UI
- `src/ui/blacksmith.js` — Blacksmith page component, extracted from `src/ui/components.js`.
- `src/ui/App.js` — retains application-level state, persistence, operation handlers, server-authority integration, and page mounting.

### Dedicated Phaser presentation
- `src/phaser/blacksmith/BlacksmithForgeScene.js` — Blacksmith-specific Phaser scene.
- `src/phaser/blacksmith/BlacksmithForgeHost.js` — lifecycle, mount, resize, event presentation, and teardown.
- `src/phaser/blacksmith/BlacksmithForgePresentation.js` — React integration component.

### Shared / generic Phaser presentation
The existing generic modules remain available and unchanged for other features, including Crafting:
- `src/phaser/scenes/ForgePresentationScene.js`
- `src/phaser/runtime/ForgePresentationHost.js`
- `src/phaser/ui/PhaserForgePresentation.js`

## 3. Build order

`build.js` includes dedicated Blacksmith Phaser files after their shared runtime dependencies, and includes `ui/blacksmith.js` after `ui/App.js` and before `ui/components.js`.

## 4. Behavior-preservation contract

This separation must not change Refine, Enchant/Empower, Reroll, Lock/Unlock, Protection Stone rules, costs, materials, success rates, rarity limits, option pools, inventory ownership, equipped-item state, Salvage behavior, server authority, API contracts, persistence, database behavior, or Crafting behavior.

App-level handlers remain in `App.js` where they depend on application state, persistence, guards, or authoritative server operations. The dedicated Phaser scene is presentation-only and must not determine operation outcomes.

## 5. Scope boundary

This refactor does not implement the Blacksmith V2 mockup, dedicated navigation/page redesign, new layout, new animations, or new game mechanics. Those belong to the separately approved Wave 3.1 design and implementation work.

## 6. Validation required

- Run `node build.js`; never hand-edit generated `index.html`.
- Run focused Blacksmith / Forge tests and the project test suite required by `AGENTS.md`.
- Run `git diff --check`.
- Verify Crafting still references the generic Forge presentation.
- Verify no API, Worker, D1, or gameplay-rule changes were introduced.
