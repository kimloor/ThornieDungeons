# Global Loading System V1

Status: **IN IMPLEMENTATION — PR 1 (core manager + overlay + first integration) awaiting Owner review**

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

## 10. Implementation status

G14 presentation (Issue #150, Ver 1.1.18 candidate): Owner-approved three-frame Dungeon Gate
art is staged under `ui/loading/` and mapped by the additive `loadingUi` manifest group. The
overlay uses the closed frame only after all frames decode; on final owner release it plays a
360 ms non-looping open transition. Missing/failed/slow artwork retains the CSS rune and never
delays dismissal. Reduced Motion skips the transition. R2/deploy/Production verification remain
pending until the PR merges.

PR 1 (#125, merged): manager `src/state/globalLoading.js`, overlay `src/ui/GlobalLoadingOverlay.js`, single mount in `tail.html`, Character Select -> game (`enterCharacterSlot`).

PR 2 (`feat/global-loading-v2`): remaining targets, Owner decision 2026-10-20 (Login keeps its own `authBusy` + departing transition and is intentionally NOT wired):

| Target | Key | Wiring |
| --- | --- | --- |
| App bootstrap | (none) | Owner decision 2026-10-20: no overlay on app start; the plain startup screen is kept |
| Create / delete character | `character.create` / `character.delete` | `GLOBAL_LOADING.run` around the cloud call |
| Back to Character Select | `character.switch` | `run` around the flush; released before the existing alert |
| Logout | `account.logout` | token around flush + `cloudLogout`; released before any alert |
| Dungeon entry (new + resume) | `dungeon.enter` | begin at `enterStage` (maxMs 45 s), label switches to resume, determinate progress from real critical-asset counts; the token is **held through combat entry and released by `CombatScreen` when the Phaser stage reports `ready`/`error`** (`GLOBAL_LOADING.releaseKey`); also released on error (`catch`) and the resume-restore fallback |
| Battle result confirmation (victory / defeat / flee) | `battle.confirm` | token around the server confirmation and the outcome screen change in `finishCoreBattle`; released before any error state |
| Friends / Guild / Leaderboard / Raid / Mailbox | `friends.load` / `guild.load` / `leaderboard.load` / `raid.load` / `mailbox.load` | `useGlobalLoadingToken(active, …)` for the screen's initial data load only (Mailbox: first load only; reloads after claim/delete stay inline) |
| Arena Hub entry, history, ranking | `arena.hub` / `arena.history` / `arena.ranking` | `run` around the fetches |
| Arena prepare / enter match | `arena.prepare` / `arena.match` | `run` around prepare; token around the existing preload gate, released before `setError` and in `finally` (gate itself unchanged) |

Arena History / Ranking tabs are fetched once per Arena Hub visit (cache cleared when leaving the hub, on hub refresh and when a match starts/finishes; Retry forces a reload).

Intentionally still inline: chat/DM polling, autosave/sync, in-screen actions (buy/sell/equip/craft/gacha/stats/skills/guild actions/friend actions/raid attack), Arena player card. G14 artwork replaces the CSS emblem later.

### Stuck-loading recovery (PR 2 addendum)
- Failsafe: any owner auto-dismisses after 30 s (per-owner `maxMs`); the overlay is released and a 30 s notice appears.
- The notice runs a reachability probe against the public config endpoint and shows "Server ตอบสนองปกติ (ms)" / "ติดต่อ Server ไม่ได้".
- **Retry** (`ลองอีกครั้ง`) exists only for idempotent loads that declare `onRetry`: Friends, Guild, Leaderboard, Raid, Mailbox first load, Arena hub / history / ranking. Mutations (create/delete/switch/logout, Dungeon entry, Arena prepare/match, character enter) never retry automatically: the notice offers connection re-check, app refresh and dismiss instead.
- API client: GET requests now time out after 15 s into `network_error` (existing retry policy applies); `cloudResetInFlight()` runs before any Retry so it cannot join a hung request. POSTs are unchanged (no client timeout, single attempt).
