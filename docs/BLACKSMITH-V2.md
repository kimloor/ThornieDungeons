# Blacksmith V2 — Module Separation and UI Redesign

Status: **ACTIVE — Wave 3.1 UI redesign merged; Ver 1.1.67 reference-match pass (§10) and Ver 1.1.68 layout/popup follow-up (§11) published; production visual acceptance pending Owner recheck; final Forge art pending**

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

Version policy: at the Owner's explicit direction, this presentation-only follow-up retains the existing visible version `1.1.61`; no version bump is included. Branch Build run `43835342900` passed its focused regression suite, formatting check and `node build.js`; generated `index.html` was committed as `2404cd07aab9b5b6fab9ea3be64d17099254bcb6`. Battle Core parity and Admin V2 QA must pass on the generated-output commit before merge. Production visual acceptance remains pending Owner recheck.

## 9. Carry-over note from the Aura phase — transparent Phaser canvases (2026-11-19)

- `ForgePresentationHost` and `BlacksmithForgeHost` create their Phaser games with `transparent: true`, like the Hero and Battlefield games. Today the Blacksmith/Forge code uses no blend modes, so nothing is affected yet.
- Trap for new effects: Phaser's built-in `Phaser.BlendModes.ADD` is `blendFunc(ONE, DST_ALPHA)`, which is a true additive only on an OPAQUE canvas. On a transparent canvas, every additive image (sparks, glows, flashes) multiplies the colour underneath by its alpha over the WHOLE quad — black boxes around additive sprites. The Aura hit this on production (Ver 1.1.66).
- Use a registered `(ONE, ONE)` blend mode instead (`renderer.addBlendMode([gl.ONE, gl.ONE], gl.FUNC_ADD)`, registered once per WebGL renderer; see `enhancementAuraBlendAdd` in `src/phaser/presentation/EnhancementAura.js` and `PHASER-COMBAT-ARENA-V1.md` §17.10), and verify visual effects on a canvas configured exactly like the game (`transparent: true`, over a dark page), not on an opaque test canvas.


## 10. Reference-match pass — Ver 1.1.67 (2026-11-24)

Owner compared the production page with `wave3-blacksmith-mobile-reference.jpg` (low-resolution layout/colour reference only) and approved a CSS-first redesign. Presentation only: no handler, API, Worker, D1, cost, rate, material, Lock, Reroll, Protection Stone, ownership or Salvage change.

Decisions (Owner, 2026-11-24): follow the reference; **Enchant (left, purple) / Refine (right, gold)**; do CSS first and wait for the Forge art; Equipment Detail shows three placeholder option rows when nothing is selected; both action buttons stay visible but disabled until gear is selected.

Implemented:
- Header: back button + single `BLACKSMITH` title (kicker/subtitle removed) + anvil art slot at the right.
- Workbench grid `1.6fr : 1fr` (Forge ~62% / Equipped Gear ~38%); gold double frame with corner ornaments; CSS anvil with the selected item shown on it; the FORGE/REFINE/ENCHANT caption appears only while an animation plays.
- Equipped Gear: square cells, large icon, one-line name, `+N` badge top-right; slot name kept only as `aria-label`.
- Equipment Detail: starts expanded; hammer icon + arrow header; empty state = hammer, "Select equipped equipment" and three dashed placeholder rows; real options render one per row.
- Actions: always rendered, Enchant/Reroll left and Refine right, disabled until gear is selected; cost lines unchanged; action message moved above the buttons.
- Art hooks: `--bs-forge-art` and `--bs-header-art` (CSS variables on `.md-blacksmith-page`) take approved image URLs later. Needed from Graphics: painted Forge scene (no baked text), anvil header icon, 9-slice gold frame.
- Tests: new V2.1 contract test; the stale Refine-presentation source-string test in `w7b-enhance-craft-presentation.test.js` was updated to the current source spacing.
- Not changed from the spec: the page-level background gradient was left to the app shell.

Carry-over: the old `.md-blacksmith-forge-art` / `-kicker` / `-gear-slot` markup is gone; superseded CSS rules from §8 remain in `styles.js` and are overridden by the "Blacksmith V2.1" block that follows them.


## 11. Layout and popup follow-up — Ver 1.1.68 (2026-11-24)

Owner feedback after viewing production Ver 1.1.67 (presentation only; same non-change rules as §10):
- **Back button:** now uses the global `md-shared-overlay-back` style (44px, same as Guild/Inventory/Crafting); custom circle removed.
- **Equipped Gear:** icons reduced (max 34px).
- **Equipment Detail:** follows the Owner wireframe: large icon box at the left; at the right the name + level box, one row per Option slot, then a "Unique detail" row (Mythic signature text, or an empty dashed row). Empty state keeps the same layout with 4 placeholder option rows.
- **Actions never under the nav bar:** root cause was a single scroll container with a sticky dock. Now Forge/Gear/Detail live in `.md-blacksmith-scroll` (the only scrolling region) while Enchant/Refine and the dock are fixed siblings below it; the detail panel is no longer height-capped.
- **Results are popups:** Refine success/fail (with `+N → +M`), Enchant and Reroll results use the shared `md-inv2-modal-layer` / `md-inv2-popup` pattern (centred, tap OK or backdrop to close, success/fail colour). Popup waits ~0.7s after a successful action so the Forge animation is visible. The inline message bar was removed; Lock toggles are silent unless they fail.
