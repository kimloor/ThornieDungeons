# Blacksmith V2 — Module Separation and UI Redesign

Status: **ACTIVE — Wave 3.1 UI redesign merged; mobile layout follow-up on PR; Owner-directed version remains Ver 1.1.61**

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


## 7. Wave 3.1 UI redesign implementation

Blacksmith is now a dedicated full-page route from Town Hub, not a modal/overlay. The page reuses the App-level Global Currency Bar and shared GameDock.

Implemented:
- Mobile-first forge/equipped layout; two-column icon grid contains only currently equipped gear.
- No automatic gear selection; selecting gear opens the expandable Equipment Detail panel.
- Equipment Detail contains existing Enchant options, lock/unlock controls and Protection Stone toggle.
- Refine remains a separate action. The second action calls existing Enchant/Empower while an option slot is open, or existing Reroll when all slots are full.
- CSS artwork hooks and fallback forge VFX are provided for future approved art assets. No new image assets were added.
- Inventory remains reachable; Salvage remains in Inventory.

Behavior preservation: existing App-level guarded handlers and server-authoritative mutations remain unchanged. No API, Worker, D1, schema, economy, costs, success rates, material, rarity-limit, lock, reroll, Protection Stone, ownership, persistence or Salvage rules were changed. Forge animations are presentation-only.

Validation required: branch Build must run `node build.js`; focused Blacksmith/Enhancement/Phaser regression and applicable CI gates must pass. Production UI acceptance must cover mobile portrait, safe area, dock navigation, equipped selection, detail expand/collapse, Refine, Enchant, Reroll and Inventory/Salvage navigation.


## 8. Production mobile layout follow-up — Ver 1.1.61 (no version bump per Owner)
Owner screenshot identified the top Inventory shortcut, heading readability, oversized workbench, and Equipment Detail overflow.

- Removed only the Blacksmith header Inventory shortcut; bottom GameDock Inventory remains.
- Added a dark/gold panel behind the BLACKSMITH heading.
- Constrained mobile workbench height, reduced equipment tile/icon sizes, and made the equipped list independently scrollable.
- Added bounded detail expansion/collapse and an internally scrollable detail body; the page scrolls within the available viewport.
- No operation handlers, costs, materials, success rates, server/API/Worker/D1 behavior or item rules changed.

Version policy: at the Owner's explicit direction, this presentation-only follow-up retains the existing visible version `1.1.61`; no version bump is included. Build and regression evidence must be recorded from the current PR workflows. Production visual acceptance remains pending Owner recheck.
