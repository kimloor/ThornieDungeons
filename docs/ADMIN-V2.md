# ThornieDungeons Admin V2 — Security / Auth Contract

Status: **ACTIVE-DESIGN — Phase 0 approved direction**

This document defines the security and authentication foundation for the ThornieDungeons Admin V2 console.

It does not authorize generic database editing, destructive maintenance, or production deployment by itself.

---

## 1. Problem being solved

Current `/admin` access depends on one static `ADMIN_API_KEY`:

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

The first Admin is provisioned by inserting that existing `player_id` into `admin_users` through the forward migration/release process.

The migration contains only the approved account identifier and role/enable state.

It must never contain:

- password;
- password hash;
- recovery code;
- session token;
- `ADMIN_API_KEY`.

If the exact production Player ID should not be committed to repository history, use a safe post-migration provisioning step or environment-driven allowlist seed approved before release.

The implementation/release plan must explicitly choose one provisioning method before production merge.

---

## 8. Existing `ADMIN_API_KEY`

Admin V2 does not depend on `ADMIN_API_KEY`.

Phase 0 rules:

- do not rotate it;
- do not read it from the Admin V2 UI;
- do not add new code that depends on it;
- keep the existing secret/path temporarily only for rollback compatibility while Admin V2 is being verified;
- remove or disable the legacy path only in a later cleanup after production verification.

The forgotten legacy key therefore does not block Admin V2 implementation.

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

Current Admin endpoints use `verifyAdminKey(env, adminKey)`.

Admin V2 moves the UI to a shared session verifier:

`verifyAdminSession(db, bearerToken(request))`

or an equivalent request-aware helper.

All Admin V2 UI requests must use the dedicated Admin Bearer token.

Existing dedicated handlers remain authoritative for their own operation; authentication changes must not accidentally make them public.

During initial rollout the legacy `adminKey` route may remain for rollback, but:

- the Admin V2 page must stop using it;
- no new Admin feature may use it;
- it is not considered the new security contract;
- cleanup is a later controlled change.

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
- W9 already owns `0022_arena_v2_foundation.sql` on its active feature branch;
- Admin V2 must not create another `0022`;
- reserve/choose the Admin migration number only with integration order accounted for;
- do not replay historical migrations.

Until W9 migration ordering is finalized, Admin code/tests may be prepared on the feature branch but production merge must not create a migration-number collision.

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
- legacy Admin key path remains unchanged if retained for rollback;
- normal Auth V2 regression passes;
- no production player/account data is mutated by Admin authentication;
- build passes;
- no secret values appear in repository diff/test logs.

---

## 19. Phase sequencing

Recommended sequence:

`A0 Contract -> A0.1 admin_users/admin_sessions/audit schema + Admin auth API -> A0.2 /admin Login/Logout UI -> A0.3 migrate existing Admin tools to Admin Session -> QA -> A1 Dashboard/Player Viewer`

Do not start player/economy mutation tooling before Phase 0 authentication and audit foundations pass QA.
