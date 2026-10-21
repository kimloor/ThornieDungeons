# Client Systems V1

Status: **IN IMPLEMENTATION — PR-C (Error catalog) open for Owner review; PR-B/PR-A/PR-D not started**
Risk: MEDIUM-HIGH (touches many client flows; no server contract, D1 or economy change)
Roadmap: WAVE 1 PREP. One PR per component, in this order, each stopping for Owner approval:
PR-C Error catalog -> PR-B API client policy -> PR-A Server Operation Manager -> PR-D Overlay shell.

## 0. Why (measured on `main` 877b5c0 / Ver 1.1.1)

| Finding | Number |
| --- | --- |
| Client API functions (`src/state/api.js`) | 109 (74 POST-style, 38 GET-style) |
| Distinct server error codes in `workers/` | 189 (`missing_fields` x38, `operation_request_conflict` x10, `not_guild_member` x10, `invalid_session` x7, ...) |
| Client error-text tables, each hand-written per screen | `registerErrorText`, `forgotErrorText`, `changeErrorText`, `friendErrorText`, `chatErrorText`, `guildErrorText`, `arenaHumanError`, `mailboxErrorText`, `classifyBattleCompletionError`, `SESSION_LIFECYCLE_ERRORS`, `BATTLE_SESSION_ERRORS` |
| Browser `window.alert` used for errors | 3 (App.js) |
| `requestId` used for idempotency | 79 usages, but each flow generates/reuses it by hand |
| Client timeout | GET only (15 s, added in 1.1.0-follow-up); POST has none and a single attempt |
| Loading ownership | Global Loading manager exists (Wave 1) but every call site is wired by hand |

Consequence seen in QA: missing loading on new/forgotten flows, the same server code showing different text on different screens, and POSTs that can hang with no recovery.

## 1. Boundaries (carried over from the roadmap)

- Global Loading (done) = full-screen blocking only. Server Operation Manager = inline pending state. **Never both for one action.**
- No server contract change. No new endpoint. No economy/gameplay authority moves to the client.
- Each PR is independently revertable and keeps existing behavior unless this document says otherwise.

## 2. PR-C — Error catalog (smallest, foundation)

Goal: one place that turns an API error code into player-facing Thai text and a behavior class.

```js
// src/state/errorCatalog.js (new module, loaded before ui/*)
ERROR_CATALOG = {
  insufficient_gold:   { th: "Gold ไม่พอ",                    kind: "business" },
  invalid_session:     { th: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่", kind: "session" },
  network_error:       { th: "เชื่อมต่อ Server ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง", kind: "transient" },
  operation_in_progress: { th: "กำลังดำเนินการเดิมอยู่ กรุณารอสักครู่", kind: "conflict" },
  ...
};
errorMessage(code, { screen, fallback })  // screen-specific override wins, then catalog, then fallback, never the raw code
errorKind(code)                            // "business" | "transient" | "session" | "conflict" | "fatal"
```

Rules:
- Raw server codes, stack traces, SQL and `error.message` of unknown origin are never shown to players (fallback text only; code goes to `console.error`).
- Existing per-screen tables become thin overrides on top of the catalog (migrated one screen per commit; no screen's current wording changes without Owner sign-off, the catalog is seeded from the strings already in the tables).
- Seed from the 189 server codes: generate the code list from `workers/` in a test, and fail the test when a code exists server-side with no catalog entry or explicit `ignore` marker (prevents drift).
- `kind` replaces the ad-hoc sets (`SESSION_LIFECYCLE_ERRORS`, `BATTLE_SESSION_ERRORS`, retryable lists) so session/transient decisions come from one definition.

Acceptance: all current visible error strings still render identically (snapshot test over the existing tables), catalog-coverage test green, zero raw codes shown, `window.alert` error paths unchanged in this PR.

## 3. PR-B — API client policy table

Goal: replace implicit behavior with a declared per-action policy.

```js
API_POLICY = {
  getLeaderboard:        { method: "GET",  timeoutMs: 15000, retry: 2, dedupe: true,  loading: "screen" },
  petEconomyAction:      { method: "POST", timeoutMs: 30000, retry: 0, dedupe: false, idempotentWithRequestId: true, loading: "blocking" },
  saveSnapshot:          { method: "POST", timeoutMs: 20000, retry: 1, dedupe: true,  loading: "none" },   // autosave
  ...
};
```

- Every `cloud*` function declares an entry (a test enumerates `api.js` and fails on a missing one).
- POST timeouts are introduced only where the action carries a `requestId` the server de-duplicates (the `operation_request_conflict` / `operation_in_progress` family), so a timed-out POST can be retried safely with the **same** requestId. POSTs without a server-side idempotency key keep no client timeout and a single attempt.
- A timed-out request returns `network_error` with `timedOut: true` (existing shape plus one flag).
- `loading` hint (`none` | `screen` | `blocking`) lets the Global Loading wiring be derived from policy instead of hand-placed (opt-in per action; autosave and polling stay `none`).
- Session handling (`invalid_session` and siblings) centralised: one place decides re-login vs retry.

Acceptance: policy-coverage test, timeout/abort tests through the existing vm harness, no behavior change for actions not yet migrated, GET timeout stays at 15 s.

## 4. PR-A — Server Operation Manager (inline pending)

Goal: standard lifecycle for state-changing actions that must not block the whole screen (buy, sell, equip, craft, donate, chat send, star-up...).

- `OPERATIONS.run({ key, characterId, requestId, optimistic, rollback }, task)`:
  - reuses one `requestId` across retries of the same user intent (fixes double-spend risk on timeout);
  - per-character serial queue for conflicting keys (e.g. two inventory mutations never interleave);
  - lock registry: `OPERATIONS.isPending(key)` drives `disabled` / inline spinner on the originating control;
  - optimistic update + automatic rollback on failure (generalises the `buyShopItem` pattern that already exists by hand);
  - failure surfaces through the PR-C catalog.
- Migration: existing flows move one per commit, behavior preserved, starting with the ones that already hand-roll this (shop buy, pet economy, mailbox claim/delete).

Acceptance: concurrency tests (double click, retry after timeout reuses requestId, rollback restores state), no flow shows both the global overlay and inline pending.

## 5. PR-D — Overlay shell

Goal: shared shell for modal sheets (Inventory, Craft, Mail, Guild) with consistent safe-area handling, scroll lock, focus return and error slot. Migrate one screen per commit. Lowest priority; may be split or deferred after Owner review of PR-A.

## 6. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Wording changes surprise players | Catalog seeded from current strings; snapshot test; Owner approves any rewording |
| POST timeout on a non-idempotent action double-applies | Timeouts only for actions with a server-side idempotency key; same requestId on retry |
| Policy table drifts from `api.js` | Coverage tests fail the build |
| Large diff | One PR per component, one commit per migrated screen/flow, each revertable |

## 7. Open questions for the Owner

1. Approve this order (PR-C -> PR-B -> PR-A -> PR-D) and the boundaries above?
2. OK to introduce POST timeouts only for requestId-idempotent actions (section 3)?
3. Should the catalog keep each screen's current wording as an override, or unify wording across screens (changes visible text)?
4. Should `loading` hints in the policy table auto-wire Global Loading for new flows (reduces the "forgot to add loading" class of bug), or stay manual?

## 8. Out of scope

Server/Worker changes, new endpoints, D1 migrations, offline mode, replacing `fetch`, graphics (G14 owns the loading artwork).

## 9. PR-C implementation notes (Ver 1.1.2)

- `src/state/errorCatalog.js`: `ERROR_KIND_BY_CODE` (all 189 Worker codes + client-only `network_error`, `session_replaced`, `session_revoked`), `ERROR_TEXT_TH` (shared session text only), `errorKind`, `isSessionErrorCode`, `errorCodesOfKind`, `errorMessage(code, { overrides, fallback })` (override -> catalog -> fallback, never the raw code).
- Drift guard: `tests/error-catalog.test.js` scans `workers/` and fails when a Worker error code is not classified; also asserts the hand-written `SESSION_LIFECYCLE_ERRORS` (auth.js) and `BATTLE_SESSION_ERRORS` (App.js) equal the catalog's session kind.
- Migrated: `friendErrorText`, `chatErrorText`, `guildErrorText`, `mailboxErrorText` (their duplicated session lines now come from the catalog). A snapshot fixture captured **before** the change (`tests/fixtures/error-text-snapshot.json`, 4 helpers x 195 inputs) proves identical output.
- Intentional wording change (1): `session_revoked` now shows the session-expired text on those four screens (it used to fall through to a generic error).
- Not migrated, awaiting Owner decision: `arenaHumanError` appends the raw `[code]` and reason to the text players see; `registerErrorText` / `forgotErrorText` / `changeErrorText` are inline in the auth modal. Open question: keep the raw `[code]` suffix in Arena messages (useful for support screenshots) or hide it behind the catalog fallback?
