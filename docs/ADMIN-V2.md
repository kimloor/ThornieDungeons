# ThornieDungeons Admin V2 — Security / Auth Contract

Status: **ACTIVE-PRODUCTION — Admin V2 account-backed auth/session foundation deployed; W5.5 legacy-path hardening complete / Production verified; Wave 2 implementation contracts (section 22) pending Owner approval**

This document defines the security and authentication foundation for the ThornieDungeons Admin V2 console.

It does not authorize generic database editing, destructive maintenance, or production deployment by itself.

---

## 1. Problem being solved

The historical `/admin` access depended on one static `ADMIN_API_KEY`:

- the operator types the raw key into the page;
- the page stores it in browser `localStorage`;
- several admin GET calls send it as an `adminKey` query parameter;
- forgetting the key means the operator cannot recover it from Cloudflare because Worker secrets are write-only.

Admin V2 replaces this as the daily login model.

The approved direction is:

`Player ID + Password (existing Auth V2 verifier) -> Admin allowlist check -> dedicated Admin Session -> Admin Console`

The normal game login/session remains separate.

---

## 2. Phase 0 goals

Phase 0 establishes:

1. Admin login UI on `/admin`;
2. reuse of the existing Login/Auth V2 Player ID + Password verifier;
3. explicit `admin_users` allowlist;
4. a dedicated Admin session token separate from the player gameplay session;
5. raw Admin session token never stored in D1;
6. normal Admin APIs use `Authorization: Bearer <admin-session-token>`;
7. browser stops storing/sending `ADMIN_API_KEY`;
8. existing player password-recovery flow remains the way to recover forgotten Admin login credentials;
9. Admin authentication/audit is separate from gameplay authorization;
10. all future Admin mutations have a stable audit foundation.

Out of scope for Phase 0:

- multi-role RBAC beyond a simple initial role field;
- multiple simultaneous Admin sessions;
- MFA;
- email recovery beyond normal player Auth V2;
- player/economy mutation tools;
- generic SQL console;
- destructive database maintenance.

---

## 3. Identity model

Admin V2 does **not** create a second password database.

Admin identity is an allowlisted production player account.

Table direction:

### `admin_users`

Suggested fields:

- `player_id` — FK/reference to `players.id`;
- `role` — initial value `owner` or `admin`;
- `enabled` — 0/1;
- `created_at`;
- `updated_at`.

Phase 0 authorization rule:

- credentials are validated using the existing Auth V2 password verifier;
- after credential validation, the account must exist in `admin_users`;
- `enabled` must be true;
- only then may an Admin session be issued.

A normal player who knows the `/admin` URL but is not allowlisted must not receive an Admin session.

Do not infer Admin privilege from player level, character data, guild role, account creation order, or Player ID naming.

---

## 4. Password and recovery contract

Admin V2 deliberately reuses the existing player-account password.

Therefore:

- Admin V2 stores no second Admin password hash;
- Admin V2 does not create a second password-reset system;
- `verifyPasswordCredentials()` or its refactored equivalent remains the authoritative credential verifier;
- forgotten Admin password is recovered through the existing Auth V2 Recovery Code flow;
- password changes/resets in Auth V2 automatically affect future Admin logins because the credential source is shared.

Admin login must **not** issue or reuse the normal gameplay session.

Credential reuse is only for verification.

---

## 5. Dedicated Admin session model

After successful credential + allowlist validation, backend issues a dedicated Admin session.

Suggested table:

### `admin_sessions`

Fields:

- `session_id`
- `player_id`
- `token_hash`
- `created_at`
- `expires_at`
- `revoked_at`
- `revoke_reason`

Rules:

- token is random opaque data;
- D1 stores only `token_hash`;
- raw token exists only on the client;
- Admin token is not accepted by normal gameplay session verification;
- normal gameplay token is not accepted by Admin verification;
- absolute lifetime: **8 hours**;
- no Remember Admin option in Phase 0;
- one active Admin session per Admin account;
- successful new Admin login revokes the previous active Admin session for that account;
- Logout revokes the current Admin session.

Normal Admin API authentication:

`Authorization: Bearer <admin-session-token>`

Do not place raw Admin session tokens in URLs.

---

## 6. Browser storage contract

The existing `thornie-admin-key` localStorage behavior must be retired from Admin V2 UI.

Admin V2 must:

- never request `ADMIN_API_KEY` in the normal UI;
- never persist `ADMIN_API_KEY`;
- never place `ADMIN_API_KEY` in a query string;
- store the Admin session token in `sessionStorage`;
- clear the token on Logout;
- preserve a valid token across ordinary page reload within the same browser session;
- require Admin login again after the browser session is closed;
- clear an invalid/expired/revoked Admin token after confirmed auth failure;
- not clear a valid session because of a network timeout.

Username/Player ID may be remembered for convenience if desired.

Password must never be stored.

---

## 7. Initial Admin provisioning

Because Admin authentication reuses an existing player account, Phase 0 does not need an Admin bootstrap secret.

The first approved Admin owner Player ID is:

`admin`

The `admin` player account must already exist through the normal Auth V2 registration flow before the Admin V2 migration is released. The forward migration provisions that existing account into `admin_users` with role `owner`.

The migration contains only the approved account identifier and role/enable state.

It must never contain:

- password;
- password hash;
- recovery code;
- session token;
- `ADMIN_API_KEY`.

Provisioning method is locked for the initial owner: migration-time allowlist seed for existing Player ID `admin`. No credential is committed.

---

## 8. Existing `ADMIN_API_KEY`

Admin V2 does not depend on `ADMIN_API_KEY`.

Phase 0 rules:

- do not read it from the Admin V2 UI;
- do not add new code that depends on it;
- keep the existing secret/path only for rollback compatibility while Admin V2 is being verified;
- WAVE 5.5 retirement/hardening of the legacy path is complete and Production verified;
- rotate the legacy secret during the approved retirement/cutover if the path is removed or replaced.

The forgotten legacy key therefore does not block Admin V2 implementation.

### WAVE 5.5 security hardening gate

Status: **COMPLETE / PRODUCTION VERIFIED — 2026-10-03**

Before WAVE 6 destructive cutover:
- normal Admin operations must use dedicated Admin V2 sessions;
- legacy Admin-key query-string access must be retired or explicitly hardened;
- failed legacy/Admin auth must be rate-limited and auditable as appropriate;
- raw Admin/legacy credentials must not appear in URLs;
- secret rotation is performed only as part of the approved cutover.

---

## 9. Required API surface

Names may be adjusted during implementation, but behavior is locked.

### POST `adminLogin`

Input:

- `id`
- `password`

Flow:

1. rate-limit;
2. verify credentials using Auth V2 verifier;
3. verify `admin_users` membership and enabled state;
4. issue dedicated Admin session;
5. write audit event.

Success returns:

- raw Admin session token;
- expiry time;
- safe Admin identity fields/role.

Failure returns generic:

`admin_auth_failed`

Do not reveal whether:

- Player ID does not exist;
- password is wrong;
- account exists but is not allowlisted.

### GET `adminValidateSession`

Uses Admin Bearer token.

Returns:

- safe Admin identity;
- role;
- expiry.

### POST `adminLogout`

Uses Admin Bearer token.

Revokes current Admin session.

---

## 10. Existing Admin API transition

Admin V2 endpoints use the shared session verifier:

`verifyAdminSession(db, bearerToken(request))`

or an equivalent request-aware helper.

All Admin V2 UI requests must use the dedicated Admin Bearer token.

Existing dedicated handlers remain authoritative for their own operation; authentication changes must not accidentally make them public.

The legacy `adminKey` query/body compatibility path is retired. Requests without
an active Admin Bearer session receive `admin_session_required`; no live Admin
route falls back to `ADMIN_API_KEY`. `verifyAdminKey` remains only as an exported
compatibility primitive for migration tooling and is not an authorization path.

---

## 11. Separation from gameplay sessions

This boundary is locked.

A Player Auth V2 session token:

- proves account ownership for gameplay;
- does not grant Admin access even if its account is in `admin_users`.

An Admin session token:

- authorizes Admin APIs only;
- does not act as a gameplay session;
- must not be accepted by normal player-authenticated endpoints.

This prevents accidental privilege reuse between game UI and Admin UI.

---

## 12. Rate limiting

Admin login requires brute-force protection.

Baseline:

- approximately 5 failed Admin login attempts per 10 minutes per IP + Player ID;
- successful Admin login clears the applicable failure state;
- use existing Auth V2 rate-limit primitives where practical;
- do not create a permanent account lockout.

Failure response should remain generic.

---

## 13. Audit log foundation

Admin V2 requires an audit model before player/economy mutation tools are added.

Suggested table:

### `admin_audit_log`

Phase 0 events include at least:

- `ADMIN_LOGIN_SUCCESS`
- `ADMIN_LOGIN_FAILURE`
- `ADMIN_LOGOUT`
- `ADMIN_SESSION_REVOKED`

Suggested fields:

- `audit_id`
- `player_id` nullable when identity could not be safely resolved
- `event_type`
- `target_type` nullable
- `target_id` nullable
- `metadata_json` containing only non-secret metadata
- `created_at`

Never log:

- password;
- raw Admin session token;
- player password hash;
- recovery code/hash;
- Admin token hash.

Later Admin mutations must reuse this audit system.

---

## 14. D1 schema direction

Phase 0 implementation requires forward-only tables equivalent to:

- `admin_users`
- `admin_sessions`
- `admin_audit_log`

Use foreign keys/indexes consistent with existing D1 conventions.

Important migration rule:

- latest production `main` currently ends at automated migration `0021`;
- Admin V2 is the next production schema release and therefore claims `0022_admin_v2_auth.sql`;
- the paused W9 Arena branch still contains its older `0022_arena_v2_foundation.sql` filename and must be rebased onto the Admin V2 release, then renumbered to the next available migration before W9 continues to release QA;
- changing the W9 migration filename does not authorize changing its already-approved schema contents;
- do not replay historical migrations.

---

## 15. Admin page Phase 0 UX

Before authenticated Admin session:

Show:

- ThornieDungeons Admin
- Player ID
- Password
- LOGIN

Do not show the old Admin Key field.

Login error text should be generic.

On authenticated state:

Show at minimum:

- Admin Player ID;
- role;
- session expiry/status;
- PRODUCTION badge;
- Logout.

Existing:

- Recipes
- Monster Drops / Stats
- Junk Info

remain functionally unchanged in Phase 0 except authentication transport.

Full Admin V2 dashboard/navigation redesign belongs to the next phase.

---

## 16. Error contract

Recommended Admin auth errors:

- `admin_auth_failed`
- `admin_session_invalid`
- `admin_session_expired`
- `admin_session_revoked`
- `admin_rate_limited`

Client must distinguish network failure from confirmed authentication failure.

Do not return `not_admin` or similar during Login because it reveals allowlist membership.

---

## 17. Implementation safety

Admin authentication is **HIGH RISK**.

Implementation must:

- remain on a feature branch;
- use additive schema only;
- preserve existing player Auth V2;
- preserve existing Admin content tools;
- not change player-session semantics;
- never expose secrets in URLs/logs/source;
- add targeted automated tests;
- require QA before merge;
- not deploy from the feature branch.

No destructive data operation is part of Phase 0.

---

## 18. Required QA matrix

At minimum verify:

- valid allowlisted Player ID/password issues Admin session;
- correct player credentials for non-Admin account return generic Admin auth failure;
- wrong ID/password return the same generic failure;
- player gameplay login behavior remains unchanged;
- Admin login does not create/replace normal gameplay `auth_sessions`;
- normal gameplay session cannot access Admin V2 APIs;
- Admin session cannot access gameplay APIs;
- Admin login rate limit works;
- raw Admin session token is not stored in D1;
- Admin session validation works;
- expired Admin session is rejected;
- second Admin login revokes prior Admin session;
- Logout revokes current Admin session;
- disabled `admin_users` account cannot log in;
- password reset/change through Auth V2 affects later Admin login correctly;
- existing Recipes / Monster Drops / Junk Info reads/writes work with Admin Bearer session;
- Admin page does not read/write `thornie-admin-key`;
- Admin page sends no `adminKey` query/body field;
- legacy Admin key requests are rejected and do not bypass Admin session expiry, revocation, or audit identity;
- normal Auth V2 regression passes;
- no production player/account data is mutated by Admin authentication;
- build passes;
- no secret values appear in repository diff/test logs.

---

## 19. Phase sequencing

Recommended sequence:

`A0 Contract -> A0.1 admin_users/admin_sessions/audit schema + Admin auth API -> A0.2 /admin Login/Logout UI -> A0.3 migrate existing Admin tools to Admin Session -> QA -> W9 complete -> W9R Worker Modularization -> A1 Dashboard/Player Viewer`

Do not start Admin Phase 1 Dashboard/Player Viewer until W9 is complete and W9R Worker Modularization has passed QA on latest main. Do not start player/economy mutation tooling before Phase 0 authentication and audit foundations pass QA.


---

## Deferred Admin item deletion tooling

Status: **DEFERRED — NOT PART OF W6**

Project Lead direction: keep the design only and implement later during the dedicated Admin page phase.

Planned safety shape:
- player/character lookup first;
- exact item-id deletion only;
- item snapshot + ownership verification before mutation;
- typed confirmation and operator reason;
- Admin audit-log entry with actor, target item, owner/character and pre-delete snapshot;
- no wildcard/name-based bulk delete and no generic SQL editor.

W6 must not add this Admin UI/API.


---

## 20. Admin V2 Phase 1 — Dashboard / Player Viewer

Status: **COMPLETE / PRODUCTION VERIFIED — 2026-10-03**

Scope implemented:
- read-only Admin Dashboard using server-authoritative aggregate stats;
- server-side Player Search by Player ID or Character name;
- sanitized read-only Player Viewer with Character and Item rows;
- Admin V2 bearer session required for every Phase 1 read;
- search/view events recorded in `admin_audit_log`;
- search audit stores query length/result count only, not raw query text;
- Player output excludes password/password hash/recovery-code hash;
- Player Viewer exposes no player/economy mutation controls.

Explicitly out of scope:
- player Gold/Diamond/stat mutation;
- item deletion;
- generic DB editor;
- generic SQL console;
- destructive player tools.

QA:
- focused Admin/Auth regression 34/34 PASS;
- full suite 543/543 PASS;
- Admin V2 QA PASS;
- Battle Core parity PASS;
- Worker syntax / Admin HTML guard / diff check PASS;
- PR #71 merged as `f7415332cbe5f19ba017eb44508f278f64aad14f`;
- API Production deployment SUCCESS;
- Frontend Production deployment + live verification SUCCESS.

Deferred Admin item deletion tooling remains deferred to a separately approved later Admin phase.

---

## 21. Wave 2 Expansion — Owner scope decisions and Admin Delete Item design (2026-10-26)

**Status: PARTIALLY APPROVED SCOPE / DESIGN ONLY — NOT IMPLEMENTATION AUTHORIZATION FOR W2-F OR NEW TOOLS.**
This section supersedes earlier *proposed* role separation for Wave 2, but does not remove existing Admin authentication, authorization checks, or server-side safety. Owner reviewed Claude's read-only audit of Ver 1.1.14 (Issue #144).

### Approved Wave 2 work

| ID | Decision | Scope and acceptance direction |
| --- | --- | --- |
| W2-A | APPROVED | Audit all existing Admin mutations (eight actions identified in the audit; revalidate against latest main). Actor/action/target/time/outcome and non-secret before/after change detail, consistent with actual atomic transaction boundaries. If audit persistence fails, mutation must not silently succeed without evidence. Define/redact exact diff/snapshot fields in the implementation contract. |
| W2-B | NOT REQUIRED / REMOVED | Do not introduce new Owner/Admin/Viewer role tiers in Wave 2. Owner prefers accountability using action-level audit history. Maintain existing account-backed Admin login/session, server authorization, input validation and other preventive controls; audit is not a substitute for security. |
| W2-C | APPROVED | Admin page security hardening: review data injection into HTML/DOM, use safe rendering/escaping, appropriate CSP and security headers, and safely retire obsolete legacy adminKey code without disrupting existing flows. |
| W2-D | APPROVED | Destructive action safety: typed confirmation, required operator reason, pre-action target preview, server re-validation and audit; no bulk/wildcard deletion implied. |
| W2-E | APPROVED | Read-only Admin Audit Viewer with actionable filters and sanitized records, without exposing passwords, session credentials or other secrets. |
| W2-F | INCLUDED IN WAVE 2 (Owner, 2026-10-26 update) | Admin Delete Item concept below; implementation contract in section 22.7. VERY HIGH risk: last slice, own data-integrity release gate, disabled by a server-side switch until the Owner enables it. No production mutation enabled by this section. |
| Additional Admin Tools | DEFERRED DESIGN | Owner and Project Lead will decide new tools in a separate design session; no implied authorization. |

### W2-F conceptual screen / workflow (not final API/schema contract)

1. **Player lookup:** search by exact Player ID / Login ID, display an explicit account match. Use existing read-only Player Viewer/search APIs when possible. Avoid fuzzy destructive target selection.
2. **Character selection:** list characters belonging to the chosen player. Make selected character and its authoritative ID visible.
3. **Item inspector and selection:** show server-authoritative item rows separated as relevant by Inventory / Equipped; use **exact unique item instance ID** (never just display name). Show item identity, location, quality/tier, Refine, Enchant, and available provenance/ownership history. Confirm which item categories and storage states current APIs support before final design.
4. **Stackable item handling:** show stack ID and current quantity, let operator choose an explicit quantity or full stack *only if* item/stack semantics support it; validate bounds and ownership server-side.
5. **Pre-delete review:** show player ID, character ID, exact item/stack ID, name, location, quantity, equipped/stat impact if applicable, reason and sanitized snapshot. Block unavailable, locked, transaction-pending or disputed ownership states; exclude Mailbox/Market escrow from V1 until explicitly contracted.
6. **Confirmation:** require operator reason plus typed confirmation; confirmation is bound to an exact server-side target and checked again for stale state before action.
7. **Execution safety (future):** authenticated Admin identity, server-side authoritative ownership and state checks, idempotency/duplicate prevention, transactional mutation and appropriate audit with sanitized before-state, and explicit success/failure feedback. No wildcard/bulk delete, generic SQL execution, or silent item restore.
8. **Audit/tracing:** record actor, target player/character/item, action, quantity, reason, result and time; redact secret fields; design a recovery/compensation process separately before enabling irreversible data mutation.

**UI layout proposal:** Admin Tools > Delete Player Item; Player Search panel > Character picker > searchable Item Inspector table > Selected Item detail panel > Reason and typed-confirmation review dialog. A read-only inspector is useful independently from delete capability.

**Open design questions (not yet approved):** exact supported item storage locations, how equipped/stacked items affect derived state, provenance fields and retention, transactional API/DB implementation, handling pending transactions, backup/rollback strategy, and final permissions policy under the existing Admin auth model.

### Sequence / guards

- W2-A and W2-C may be developed separately after precise implementation contracts and file ownership are resolved; then W2-D and W2-E on the audited foundation.
- HIGH-risk Worker/authoritative data changes require a feature branch and QA/release gates per `AGENTS.md`.
- Section 22 holds the implementation contracts. W2-F implementation starts only after section 22 is approved (PR merge) and W2-A, W2-D and W2-E are in production. Do not implement other new Admin tools until Owner approves their contracts. Do not introduce W2-B role tiers without a new Owner decision.

---

## 22. Wave 2 Implementation Contracts (2026-10-26)

**Status: CONTRACT APPROVED (PR #154 merged); slice implementation in progress — W2-A in PR (see 22.3), W2-C/D/E/F not started.** Original note: contract for Owner approval, docs only. Approval = merge of the PR that adds this section. Merging authorizes the *slice contracts below* to be implemented, each in its own feature branch / PR with its own QA and release gates. It does not authorize any code, schema or production change by itself, and it does not authorize any other Admin tool.

Baseline: `main` 63b95d0 (Ver 1.1.18). Admin/Worker code was re-checked against that baseline: the findings of Issue #144 still hold (eight unaudited Admin mutations, no CSP/security headers on `/admin`, leftover `adminKey` arguments).

### 22.1 Owner decisions recorded

- No new role tiers: a single `admin` role; accountability through action-level audit (W2-B removed). Authentication, session and server-side validation remain the preventive controls.
- Audit records full item detail (complete before-state of the affected row, sanitized of secrets).
- **W2-F Admin Delete Item is included in Wave 2**, with a detailed confirmation step. It is the last slice and has its own data-integrity release gate (22.7).
- CSP and security headers on `/admin` are approved (W2-C).

### 22.2 Slice order, risk and gates

`W2-A ∥ W2-C  →  W2-D  →  W2-E  →  W2-F`

| Slice | Risk | Touches | Depends on |
| --- | --- | --- | --- |
| W2-A mutation audit | HIGH (Worker, write path) | `workers/thornie-dungeons-api.js`, tests | — |
| W2-C hardening + CSP | MEDIUM | `admin.html`, static headers, Worker call sites | — |
| W2-D destructive safety | MEDIUM–HIGH | `admin.html`, 3 delete handlers | W2-A |
| W2-E Audit Viewer | MEDIUM | new read action, `admin.html` | W2-A |
| W2-F Delete Player Item | VERY HIGH (player data, irreversible) | new read + write actions, `admin.html` | W2-A, W2-D, W2-E |

Every slice: feature branch + PR, targeted tests, full suite, Admin V2 QA workflow, Battle Core parity, Admin HTML guard, independent QA, merge, auto deploy, live verification. Per `AGENTS.md`, risk HIGH or above stops for Owner approval before merge. Each slice PR states whether the visible game version is bumped.

### 22.3 W2-A — Mutation audit logging

**Implementation status (2026-10-27): IN PR (feature branch `feat/w2a-admin-mutation-audit`), risk HIGH, awaiting Owner approval before merge. Shipped as visible Ver 1.1.20 only because the new `admin_audit_failed` code had to be registered in `src/state/errorCatalog.js` (drift guard); no schema change, no new migration.** Implementation notes: shared helper `runAdminMutationWithAudit` (Worker) runs the mutation statements plus one `adminAuditStatement` in a single `db.batch`; any batch failure returns `admin_audit_failed` (HTTP 500) with nothing persisted. Deletes of a non-existent target are still audited (`before: null`, `changedKeys: []`); successful deletes use `changedKeys: ["deleted"]`. Tests: `tests/admin-v2-mutation-audit.test.js`.

**Covered actions (revalidated on 63b95d0):**

| Action | `event_type` | `target_type` / `target_id` |
| --- | --- | --- |
| `saveGameConfig` | `ADMIN_GAME_CONFIG_SAVE` | `game_config` / `*` (changed keys in metadata) |
| `setGameConfigItem` | `ADMIN_GAME_CONFIG_SET` | `game_config` / key |
| `adminUpsertRecipe` | `ADMIN_RECIPE_UPSERT` | `recipe` / `recipeId` |
| `adminDeleteRecipe` | `ADMIN_RECIPE_DELETE` | `recipe` / `recipeId` |
| `adminUpsertMonsterLootEntry` | `ADMIN_MONSTER_LOOT_UPSERT` | `monster_loot` / `entryId` |
| `adminDeleteMonsterLootEntry` | `ADMIN_MONSTER_LOOT_DELETE` | `monster_loot` / `entryId` |
| `adminUpsertJunkInfo` | `ADMIN_JUNK_INFO_UPSERT` | `junk_info` / `junkId` |
| `adminDeleteJunkInfo` | `ADMIN_JUNK_INFO_DELETE` | `junk_info` / `junkId` |

**Rules:**
- Reuse `admin_audit_log` and `adminAuditStatement`; no new table. Actor is the authenticated Admin player id, as in the existing search/view audit calls.
- Mutation and audit row execute in the same `db.batch`, so both commit or neither does. If the audit statement fails the mutation must not persist and the response is an error (`admin_audit_failed`, HTTP 500). The handlers that currently use a single `.run()` are converted to `db.batch`.
- The before-state is read immediately before the batch. A concurrent edit between read and batch is possible with several admins; this is a known, documented limitation (the audit records what was observed).
- `metadata_json` = `{ outcome, before, after, changedKeys }`. `before` is `null` for inserts, `after` is `null` for deletes. For `saveGameConfig` only changed keys are recorded (old/new value).
- Redaction: keys matching `/pass|token|secret|hash|recovery/i` are replaced by `"[redacted]"` before writing. Metadata is capped at 16 KB; beyond that it stores `truncated: true` and the list of fields.
- Validation rejections (no state change) are not audited. No-op writes (identical values) are audited with `changedKeys: []`.
- Retention: no automatic deletion in Wave 2. W2-E reports row counts so growth can be reviewed.

**Acceptance:** every one of the eight actions writes exactly one audit row atomically with its mutation; injected audit failure leaves the mutation unapplied; no secret field appears in any row; actor equals the session's Admin id; existing Recipes / Monster Drops / Junk Info flows keep working.

### 22.4 W2-C — Admin security hardening

**Implementation status (2026-10-27): IN PR (`feat/w2c-admin-hardening`), risk MEDIUM, no game-bundle change (no version bump).** `/admin` is served by the static-assets Worker `worker.js` (`run_worker_first`), so the CSP/security headers are added there for `/admin`, `/admin/`, `/admin.html` (CSP, nosniff, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `no-store`) and nosniff/no-store for `/admin-app.js`; game pages are untouched. CSP: `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://thornie-dungeons-api.ekqtjl.workers.dev; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` (`connect-src` = `SERVER_URL`, the only origin the page calls). Inline script moved to `admin-app.js`; every `innerHTML` data template replaced by DOM construction (`el()`/`textContent`, no `escapeHtml` needed); legacy `adminKey` arguments removed from `verifyAdminAccess` call sites. Guard: `tests/admin-v2-hardening.test.js`, plus production header checks in `deploy-frontend-production.yml`. Known pre-existing behavior (unchanged): `restoreAdminSession()` is defined but never invoked, so a page reload requires logging in again.

- **Rendering:** every value interpolated into HTML goes through a single escape helper, or is assigned with `textContent` / DOM construction. Remaining raw `innerHTML` data sinks in `admin.html` are removed or proven constant. The Admin HTML guard is extended to fail on unescaped interpolation in `innerHTML` templates.
- **CSP and headers on `/admin`:** move the single inline `<script>` of `admin.html` to a same-origin file so scripts need no `unsafe-inline`. Proposed policy (final values confirmed in the implementation PR against the API origin(s) actually used):
  `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' <admin API origin>; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
  plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Cache-Control: no-store` for the Admin HTML. The mechanism (Worker response wrapper vs static headers file) is chosen after confirming how `/admin` is served; game pages must be unaffected.
- **Legacy cleanup:** remove the obsolete `adminKey` arguments from the `verifyAdminAccess` call sites (`p.get("adminKey")`, `body.adminKey`). Legacy-key requests stay rejected. The exported `verifyAdminKey` helper is removed only if no test or import depends on it.
- **Acceptance:** headers present on `/admin` and absent from game pages; every Admin tab loads and works with zero CSP violations in the browser console; no `adminKey` reference remains in Admin code paths; existing §18 QA items still pass.

### 22.5 W2-D — Destructive action safety

**Implementation status (2026-10-27): IN PR (stacked on W2-A and W2-C), risk HIGH-adjacent (delete paths), visible Ver 1.1.21 (new validation codes `reason_required`, `invalid_reason`, `confirm_mismatch` registered in the error catalog).** Server: reason trimmed 5-300 chars, `confirmId` must equal the target id exactly, target re-read and rejected with `not_found` (404, not audited) if missing, reason stored in `metadata_json.reason`; validation order is auth, missing id, reason, confirmId, existence. UI: `openDestructiveDialog` shows the server-loaded row, requires typing the id and a reason before the button enables; the old `confirm()` is gone. Tests: `tests/admin-v2-destructive-safety.test.js`.

In scope: `adminDeleteRecipe`, `adminDeleteMonsterLootEntry`, `adminDeleteJunkInfo` now, and W2-F when implemented. No bulk or wildcard delete.

- UI: dialog shows a server-loaded preview of the exact target, requires the operator to type the exact target id, and requires a reason (trimmed, 5–300 characters).
- Server: requires `reason` and `confirmId` equal to the target id; re-reads the target and rejects if it no longer exists. The reason is stored in the audit metadata.
- Old clients without `reason` receive `reason_required` (HTTP 400). Deploy API and `admin.html` together; a brief window where deletes fail for an old page is acceptable for an Admin-only tool.

### 22.6 W2-E — Read-only Audit Viewer

**Implementation status (2026-10-27): IN PR (stacked on W2-D), read-only, visible Ver 1.1.22 (new validation code `invalid_filter`).** Action: `GET ?action=adminListAuditLog` (Admin Bearer) with `eventType`, `actor`, `targetType`, `targetId`, `from`, `to`, `limit` (default 25, max 50), `cursor` (opaque, encodes `(created_at, audit_id)`, ordered newest first); invalid dates/cursor -> `invalid_filter` (400). Entries are re-sanitized with the 22.3 denylist on read; unparseable legacy metadata is returned as the raw string. Each view writes `ADMIN_AUDIT_VIEW` (filter names, `paged`, `limit`, `resultCount` only; never filter values) and fails closed with `admin_audit_failed` if that write fails. No migration/index: production `admin_audit_log` held 1 row when measured (2026-10-27); revisit when event_type filtering is measurably slow. UI: one new "Audit Log" tab, two buttons (search, load more) plus a per-row detail toggle; no edit/delete controls. Tests: `tests/admin-v2-audit-viewer.test.js`.

- New read action (name fixed in the PR) requiring an Admin session. Filters: `event_type`, actor, `target_type` / `target_id`, date range. Cursor pagination on `(created_at, audit_id)`, default 25, maximum 50.
- Output is re-sanitized server-side with the 22.3 denylist, so older rows cannot leak secrets. Viewing is itself audited with filter summary and result count only.
- If filtering by `event_type` needs an index, it is added by a separate additive migration in `migrations/auto/`, only after measuring.
- UI: one new tab. No edit or delete controls.

### 22.7 W2-F — Delete Player Item (VERY HIGH)

**Implementation status (2026-10-27): IN PR, NOT MERGED — needs Owner approval; ships DISABLED (Ver 1.1.23).** Enable only on Owner instruction by setting `game_config.admin_item_delete_enabled` to JSON `true` (absent or anything else = off). Actions: `adminGetItemDetail` (GET, read-only, works while disabled and reports `enabled`), `adminPreviewItemDelete` (GET), `adminDeleteItem` (POST). New codes: `feature_disabled`, `operation_pending`, `character_in_run`, `item_state_changed` (plus existing `item_equipped`, `item_not_found`, `invalid_quantity`, `invalid_request_id`). Tests: `tests/admin-v2-delete-item.test.js`.

**Open items resolved in this PR (verified against code and read-only production queries, 2026-10-27):**
1. *Other storage that can hold an item:* only `items` holds live items. `mailbox.items_json` holds unclaimed mail snapshots, `guild_donation_stack_snapshot` and `w6_legacy_item_cleanup_audit` are historical records; none hold a live item, so they are out of scope (mail/market escrow stays excluded as the contract says). `character_run_state` carries no item data (floor/hp/mp/gold/potions/pet only).
2. *Active-run default (Owner delegated):* block with `character_in_run` while a `character_run_state` row for the character was updated within the last 30 minutes. Production had 4 run rows for 20 characters, some untouched since September, so blocking on row existence alone would lock those characters permanently; a stale row carries no item data.
3. *Ownership event conventions:* the only `event_type` in `item_ownership_events` is `acquire` (56 rows; ids `acquire-<itemId>`); sell/salvage/craft write no removal event. W2-F adds `admin_deleted` with `event_id = adm-del-<requestId>`, `from_*` = owner, `to_*` = NULL, `context_json = {auditId, quantity, remaining, reason}`.
4. *Derived stats (Owner delegated):* `characters` has no cached derived-stat columns; stats are computed from equipped items. Equipped items are blocked (`item_equipped`), and unequipped items contribute nothing, so deleting one cannot change derived stats and no unequip path is needed in V1.

**Stack handling note:** stack size for `junk`/`potion` lives in `extra_json.quantity` (the `quantity` column stays 1); partial delete rewrites it with `json_set` under the same observed-state guard. Gear is delete-whole only. `confirmText` must equal the exact `item_id`. No per-Admin rate limit (Owner decision 2026-10-28, overriding the proposed 20/hour in the contract); every delete is still audited.

**W2-G — Restore a deleted item (added 2026-10-28, Owner-approved design):** `adminPreviewItemRestore` (GET) and `adminRestoreItem` (POST, `auditId`, `reason`, `confirmText` = original item id), behind the same `admin_item_delete_enabled` flag, any Admin may restore. Source is the `ADMIN_ITEM_DELETE` audit snapshot (`audit_not_restorable` when the snapshot is truncated or contains `[redacted]`). A delete is restorable once: restore audit id = `adm-res-<deleteAuditId>`; repeats return `already_applied`. The original row is returned whole (same `item_id`, enhance level, empower slots, stats, `created_at`); `equipped=0`, `inventory_slot` cleared. If the character has 30 carried (non-equipped, non-overflow) items it goes to the game's own overflow list (`extra_json.overflow=true`) instead of failing; if the original `item_id` is taken it gets a deterministic `adm-res-<20 hex>` id (link kept in the audit). Stacks (junk/potion) restore the full deleted quantity: added back to the existing row when it still exists and stays <= 99, otherwise inserted as its own row. Mail was rejected as the delivery path because claiming mail rebuilds items with a new id and drops enhance level, item level, template and bonus stats. One guarded `db.batch` (audit + `admin_restored` ownership event + insert/update), 409 `item_state_changed` if the state moved. The Audit Log tab shows a restore button on unrestored `ADMIN_ITEM_DELETE` rows. Known limit: the audit snapshot masks keys matching the 22.3 denylist; production items have no such keys (checked 2026-10-28), but such an item would come back `audit_not_restorable`. Tests: `tests/admin-v2-restore-item.test.js`. New codes: `audit_not_restorable`. Visible Ver 1.1.24.

**Release gate status:** (2) tests pass locally on a schema mirroring production, and the guarded statements (`INSERT … SELECT … WHERE EXISTS`, `json_set`, stale-guard writes 0 rows) were run on a throwaway production-region D1, since deleted; the full handler-through-`db.batch` path has not run on real D1. (1) independent review, (3) restore point and (5) Owner-present first deletion are still required. (4) kill switch is implemented.

Item rows live in `items` (`item_id`, `player_id`, `character_id`, `slot_type`, `equipped`, `quantity`, `extra_json`, `updated_at`, …); provenance in `item_provenance` and `item_ownership_events`. The player-side sell/salvage handlers already use guarded `DELETE … WHERE item_id AND player_id AND character_id AND equipped = 0 AND extra_json = <observed>` inside `db.batch`; W2-F follows that pattern.

**Flow (matches §21):** exact Player ID lookup → character picker → item inspector → pre-delete review → reason + typed confirmation → server re-validation → atomic delete.

**API shape (names fixed in the PR):**
1. `adminGetItemDetail(playerId, characterId, itemId)` — read-only. Returns the sanitized row, its `item_provenance` row, the latest ownership events, and a `deletable` verdict with `blockedReason`.
2. `adminPreviewItemDelete(…, quantity)` — returns the snapshot and a `snapshotHash` (SHA-256 of the canonical row JSON including `updated_at` and `quantity`).
3. `adminDeleteItem(playerId, characterId, itemId, quantity, reason, confirmText, snapshotHash, requestId)`.

**Rules:**
- Target is identified only by the exact `(player_id, character_id, item_id)` triple; never by name, never bulk, no generic SQL.
- Blocked (V1): `equipped = 1` (`item_equipped`); a pending row for the item in `character_operation_receipts` (`operation_pending`); ownership not matching the triple; any state not stored in `items`. Mailbox and market escrow are excluded until separately contracted. Proposed default, to be verified against code in the implementation PR: block while the character has an active run (`character_run_state` row).
- Stack handling: quantity `1 ≤ q ≤ observed quantity`. `q = quantity` deletes the row; `q < quantity` runs `UPDATE … SET quantity = quantity - q` guarded by the observed quantity. Non-stackable gear deletes the full row only.
- Stale-state protection: the server recomputes the hash from the current row; mismatch → `item_state_changed` (HTTP 409), nothing written.
- Atomicity: one `db.batch` whose statements share the same guard: `INSERT` audit row `… SELECT … WHERE EXISTS(guard)`, `INSERT` an `item_ownership_events` row (`admin_deleted`, to nobody) the same way, then the guarded `DELETE`/`UPDATE`. If the guard fails nothing is inserted, and the handler returns 409 when the item change affected 0 rows.
- Idempotency without a new table: the audit row id is derived from `requestId` (`adm-del-<requestId>`), a primary key, so a replay cannot delete twice and returns `already_applied`.
- Audit metadata: actor, target player/character/item, quantity requested/remaining, reason, outcome, full sanitized row snapshot, provenance row and recent ownership events.
- Abuse limit: none (Owner decision 2026-10-28; the earlier proposal of 20/hour was dropped).
- No restore tool in V1. The audit snapshot is the recovery source; a compensation procedure is designed separately and approved before enabling.

**Release gate (all required before first production use):**
1. Contract details above implemented and independently reviewed; open items below resolved in the PR.
2. Tested on a throwaway D1 recreated from the real schema: success, stale hash, equipped, pending operation, wrong owner, partial stack, replay, injected audit failure.
3. A D1 restore point (Time Travel bookmark or export) recorded immediately before enabling.
4. Server-side kill switch: the feature ships **disabled** (key in `game_config`, absent = off) and is enabled only on Owner instruction.
5. First production deletion is performed with the Owner present, on a test account.

**Open items to resolve before the W2-F implementation PR:** confirm which storage states other than `items` can hold an item; confirm how derived stats react when an equipped item is blocked/unequipped; confirm `item_ownership_events.event_type` conventions; confirm the active-run default.

### 22.8 Documentation upkeep

Each slice PR updates this file (status line and the slice's section), `docs/ACTIVE-DEVELOPMENT-ROADMAP-V3.md` (Wave 2 entry) and `docs/PROJECT-INDEX.md` in the same PR.
