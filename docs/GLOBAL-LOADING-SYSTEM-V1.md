# Global Loading System V1

Status: **ACTIVE-DESIGN / APPROVED FOR IMPLEMENTATION PLANNING**

This contract defines one shared loading experience for ThornieDungeons. It is presentation/orchestration only and must not change gameplay, API authority, save semantics, reward settlement, navigation ownership, or Phaser combat resolution.

## 1. Goals

- one consistent mobile-first loading presentation across major app transitions;
- distinguish true blocking transitions from background saving;
- never hide or replace actionable errors;
- prevent accidental duplicate input while a blocking operation is active;
- support both unknown-duration and measurable loading work;
- avoid screen flash for very fast operations.

## 2. Shared runtime architecture

Implement one App-level `GlobalLoadingManager` / provider and one `GlobalLoadingOverlay`. Do not create page-local full-screen loading systems.

The manager must use token/reference ownership rather than a single global boolean. Multiple concurrent owners may hold loading tokens; releasing one token must not dismiss the overlay while another blocking owner remains.

Each token may provide:
- stable operation/domain key;
- safe user-facing status text;
- blocking/non-blocking classification;
- indeterminate state, or real measurable current/total progress when available.

The manager must guarantee release in success, handled failure, cancellation, navigation teardown and component unmount paths.

## 3. Display behavior

Blocking overlay:
- delayed show: target about 150 ms so very fast work does not flash;
- once visible, minimum visible duration: target 250–350 ms;
- mobile safe-area aware;
- blocks duplicate interaction while visible;
- does not unmount the underlying route merely to display loading;
- accessibility state/text must remain meaningful.

Progress modes:
- **Indeterminate** for API waits, checkpoint/cloud restore, matchmaking and work without measurable progress.
- **Determinate** only when the runtime knows real `current / total`, for example a finite asset preload set.
- Never fabricate 0–100% progress from elapsed time.

## 4. Initial integration targets

Use the blocking overlay for major waits such as:
1. Login -> Character Select;
2. Character Select -> game bootstrap;
3. entering Dungeon Battle when authoritative state/assets are not ready;
4. Dungeon transition/restore when a blocking load is required;
5. entering Arena Battle / Revenge when authoritative state/assets are not ready;
6. Phaser scene/texture preload where the app must wait;
7. blocking cloud load/checkpoint restore;
8. character switch/logout when transition completion must be awaited.

Do not automatically use a full-screen overlay for ordinary background autosave or short non-blocking persistence. Those should use the existing/shared lightweight save/status presentation unless the operation genuinely blocks safe continuation.

Integration must be incremental. Do not rewrite all navigation/API code merely to add loading presentation.

## 5. Error contract

Loading must never swallow errors.

Required failure sequence:
`operation fails -> release loading ownership -> show existing detailed/sanitized error UI`.

Preserve the unified runtime/persistence error-popup direction. Never expose auth/session secrets, credentials, raw sensitive payloads, or private backend details through loading status text.

A defensive stale-owner/failsafe mechanism may surface a recoverable error/status, but it must not silently mark failed gameplay/save work as successful.

## 6. Gameplay and persistence safety

Global Loading is not an authority layer.

It must not:
- resolve combat;
- decide rewards;
- mutate tickets/currency/items;
- manufacture successful save/checkpoint state;
- retry non-idempotent actions without the existing authoritative contract;
- change Battle Core timing/turn rules;
- weaken Cloud Sync/checkpoint validation.

The current Dungeon checkpoint hotfix/root-cause work remains a separate blocker and must not be modified as part of Global Loading.

## 7. G14 presentation contract

Graphics scope: **G14 Global Loading Presentation Pack**.

Direction: ThornieDungeons-neutral dark-fantasy Dungeon Gate / rune presentation suitable for Dungeon, Arena, login/bootstrap and shared transitions.

Keep the pack small and reusable:
- one central loading emblem/gate/rune identity;
- optional lightweight background/vignette if needed;
- a short frame set only if animation cannot be achieved cleanly by CSS/Phaser transforms;
- no baked status text;
- no mode-specific words such as Dungeon/Arena in shared artwork.

Prefer CSS/runtime motion around optimized static assets over GIF/video or oversized frame sequences.

All runtime exports must follow the Production asset budget and R2/manifest rules. Missing optional loading artwork must fall back to a functional lightweight loading presentation rather than blocking the app.

## 8. QA gate

Verify:
- nested/concurrent token ownership;
- fast operation does not visibly flash;
- minimum visible timing after overlay appears;
- success release;
- failure release then detailed error;
- cancellation/unmount cleanup;
- no stuck overlay;
- no duplicate action while blocking;
- determinate progress uses real counts only;
- background save does not unnecessarily full-screen block;
- iPhone/mobile safe areas and orientation/viewport behavior;
- asset failure fallback;
- no gameplay/save/API authority changes;
- build and focused tests pass.

## 9. Execution sequencing

- Contract/design may be documented now.
- Do not mix implementation into the active Dungeon Cloud Sync PR/hotfix.
- Runtime implementation enters the DEV lane after the current critical Cloud Sync gate and according to Project Lead priority.
- G14 Graphics may prepare approved presentation assets independently when it does not alter runtime code or conflict with the active Graphics queue.
