# ThornieDungeons Admin V2 — Security / Auth Contract

Status: **ACTIVE-DESIGN — Phase 0 approved direction**

This document defines the security and authentication foundation for the ThornieDungeons Admin V2 console.

It does not authorize direct database editing, destructive maintenance, or production deployment by itself.

---

## 1. Problem being solved

Current `/admin` access depends on one static `ADMIN_API_KEY`:

- the operator types the raw key into the page;
- the page stores it in browser `localStorage`;
- several admin GET calls send it as an `adminKey` query parameter;
- forgetting the key means the operator cannot recover it from Cloudflare because Worker secrets are write-only.

This is acceptable only as a temporary bootstrap mechanism, not as the long-term day-to-day Admin V2 login model.

Admin V2 must remove the raw secret from ordinary use.

---

## 2. Phase 0 goals

Phase 0 establishes:

1. dedicated Admin identity separate from player accounts;
2. Username + Password login;
3. opaque Admin session token;
4. raw session token never stored in D1;
5. normal admin APIs use `Authorization: Bearer <admin-session-token>`;
6. browser must not persist the Cloudflare recovery secret;
7. `ADMIN_API_KEY` becomes bootstrap / emergency recovery only;
8. forgotten Admin password can be recovered by rotating `ADMIN_API_KEY` and resetting Admin credentials;
9. all Admin sessions are revoked on credential reset;
10. authentication events are auditable without logging secrets.

Out of scope for Phase 0:

- multi-role RBAC;
- multiple administrator accounts;
- MFA;
- email recovery;
- player/economy mutation tools;
- generic SQL console;
- destructive database maintenance.

Those may be designed later.

---

## 3. Identity model

Admin V2 uses a dedicated Admin account model.

Do not reuse normal `players` accounts or player sessions as proof of Admin authority.

Initial Phase 0 supports exactly one active Admin identity.

Suggested fields:

- `admin_id`
- `username_normalized`
- `password_hash`
- `created_at`
- `updated_at`
- optional `last_login_at`

Username:

- 3–32 characters;
- case-insensitive;
- recommended allowed characters: `A-Z a-z 0-9 _ -`.

Password:

- minimum 12 characters;
- maximum 128 characters;
- no forced symbol/uppercase composition rule;
- password-manager/passphrase use is recommended;
- never log or return the password.

Use the project’s established secure password-hashing primitive where practical. Do not introduce a home-grown reversible encryption scheme.

---

## 4. Admin session model

Successful Admin login returns a random opaque session token.

Server storage:

- D1 stores only `token_hash`;
- raw token exists only on the client;
- session includes created/expiry/revocation timestamps.

Initial Phase 0 policy:

- absolute lifetime: **8 hours**;
- no Remember Admin option;
- one active Admin session at a time;
- successful new login revokes the prior active Admin session;
- password reset/recovery revokes every active Admin session.

Suggested session fields:

- `session_id`
- `admin_id`
- `token_hash`
- `created_at`
- `expires_at`
- `revoked_at`
- `revoke_reason`

Normal Admin API authentication:

`Authorization: Bearer <admin-session-token>`

Do not send raw Admin session tokens in URLs.

---

## 5. Browser storage contract

The existing `thornie-admin-key` localStorage behavior must be retired.

Admin V2 must:

- never persist `ADMIN_API_KEY` in browser storage;
- never place `ADMIN_API_KEY` in a query string;
- store the Admin session token in `sessionStorage` for Phase 0;
- clear the token on Logout;
- clear invalid/expired/revoked tokens after confirmed auth failure;
- preserve a valid token across ordinary page reload within the same browser session;
- require login again after the browser session is closed.

The login form may remember the Admin username only if desired; it must not remember the password.

---

## 6. Bootstrap and forgotten-password recovery

`ADMIN_API_KEY` remains configured only as a Cloudflare Worker Secret.

Its purpose changes to:

- initial Admin account bootstrap;
- emergency Admin credential reset.

It is no longer the normal Admin credential.

### Initial bootstrap

When no Admin account exists:

1. operator rotates/sets `ADMIN_API_KEY` in Cloudflare if needed;
2. open Admin recovery/setup UI;
3. submit:
   - recovery/bootstrap key;
   - new Admin username;
   - new Admin password;
4. request uses POST body only;
5. backend verifies `ADMIN_API_KEY`;
6. backend creates the Admin account;
7. raw bootstrap key is discarded by the page immediately;
8. operator logs in normally using username/password.

Bootstrap must fail once an Admin identity already exists unless the request explicitly uses the recovery/reset path.

### Forgotten Admin password

Recovery flow:

1. rotate `ADMIN_API_KEY` in Cloudflare to a newly generated secret;
2. open `/admin` -> Recover Admin Access;
3. enter:
   - recovery key;
   - Admin username;
   - new password;
   - confirm password;
4. backend verifies recovery key;
5. replace Admin password hash;
6. revoke all Admin sessions;
7. write audit event;
8. do not return the recovery key;
9. operator logs in with the new password.

Therefore losing the daily Admin password does not require recovering the old secret value.

Cloudflare secret rotation is the recovery authority.

---

## 7. Required API surface

Names may be adjusted during implementation, but behavior is locked.

### POST `adminBootstrap`

Allowed only when no Admin identity exists.

Input:

- `bootstrapKey`
- `username`
- `password`
- `confirmPassword`

Must not return secrets.

### POST `adminLogin`

Input:

- `username`
- `password`

Success:

- raw Admin session token;
- expiry time;
- safe Admin identity fields.

Failure should use a generic error such as:

`admin_auth_failed`

Do not reveal whether the username exists.

### GET `adminValidateSession`

Uses Bearer token.

Returns safe identity + expiry/status only.

### POST `adminLogout`

Uses Bearer token.

Revokes current session.

### POST `adminRecoverAccess`

Input:

- `recoveryKey`
- `username`
- `newPassword`
- `confirmPassword`

On success:

- password replaced;
- all Admin sessions revoked;
- response contains no recovery secret.

---

## 8. Existing Admin API transition

Current Admin APIs must migrate from:

`adminKey`

to the shared Admin session verifier.

Preferred implementation:

1. shared `verifyAdminSession(request, db)`;
2. all Admin V2 UI calls send Bearer token;
3. existing dedicated Admin handlers continue to enforce server-side authorization.

During initial rollout, legacy `adminKey` verification may remain temporarily as a rollback path, but:

- the Admin V2 UI must stop using it;
- no new UI feature may depend on query-string `adminKey`;
- it must be removed in a later cleanup after Admin V2 production verification.

Do not remove the legacy path in the same first release if doing so would make rollback unsafe.

---

## 9. Admin origin / CORS boundary

Admin calls come from the production frontend Admin page to the API Worker.

Admin-authenticated endpoints should explicitly accept the approved frontend origin(s).

Do not weaken public API behavior just to implement Admin CORS.

Because Admin V2 uses a Bearer token rather than cookies:

- do not build cookie/CSRF assumptions into Phase 0;
- custom Authorization requests should pass the required CORS preflight;
- localhost/dev origins may be allowed only through an explicit development rule.

---

## 10. Rate limiting

Admin login/recovery requires brute-force protection.

Baseline:

- approximately 5 failed Admin login attempts per 10 minutes per IP + username;
- escalating short cooldown is acceptable;
- successful login clears the applicable failure state;
- recovery/bootstrap attempts must also be rate-limited;
- do not permanently lock Admin access because of remote failed guesses.

Reuse existing Auth V2 rate-limit patterns where practical instead of inventing an unrelated mechanism.

---

## 11. Audit log foundation

Admin V2 requires an audit model before player/economy mutation tools are added.

Phase 0 audit events include at least:

- `ADMIN_BOOTSTRAP`
- `ADMIN_LOGIN_SUCCESS`
- `ADMIN_LOGIN_FAILURE`
- `ADMIN_LOGOUT`
- `ADMIN_RECOVER_ACCESS`
- `ADMIN_SESSION_REVOKED`

Suggested fields:

- `audit_id`
- `admin_id` nullable where no identity has been resolved
- `event_type`
- `target_type` nullable
- `target_id` nullable
- `metadata_json` containing only non-secret metadata
- `ip_hash` or other privacy-safe request metadata if useful
- `created_at`

Never log:

- password;
- raw Admin session token;
- recovery/bootstrap key;
- password hash;
- token hash.

Later Admin mutations must reuse this audit system.

---

## 12. D1 schema direction

Phase 0 implementation will require forward-only Admin tables equivalent to:

- `admin_users`
- `admin_sessions`
- `admin_audit_log`

Rate-limit storage may reuse existing infrastructure or add a dedicated table only if necessary.

Important migration rule:

- do not assign a migration filename/number from stale branch state;
- implementation must first sync with latest `main`;
- W9 currently owns migration `0022` on its feature branch, so Admin V2 must choose its actual migration number only after branch synchronization;
- never replay historical migrations.

---

## 13. Admin page Phase 0 UX

Before authenticated session:

### Login state

Show:

- ThornieDungeons Admin
- Username
- Password
- LOGIN
- Recover Admin Access

Do not show the current raw Admin Key field in the normal login form.

### Recovery state

Hidden behind explicit `Recover Admin Access`.

Show:

- Recovery Key
- Admin Username
- New Password
- Confirm Password
- RESET ADMIN ACCESS
- Cancel

The Recovery Key input:

- password-masked;
- never prefilled;
- never written to storage;
- cleared immediately after the request completes.

### Authenticated state

Show at minimum:

- Admin identity;
- session expiry/status;
- PRODUCTION environment badge;
- Logout.

Existing Recipes / Monster Drops / Junk Info tools remain functionally unchanged during Phase 0 except for how they authenticate.

Full Admin V2 dashboard/navigation redesign belongs to the next UI phase.

---

## 14. Error contract

Recommended Admin auth errors:

- `admin_auth_failed`
- `admin_session_invalid`
- `admin_session_expired`
- `admin_session_revoked`
- `admin_bootstrap_unavailable`
- `admin_recovery_failed`
- `admin_rate_limited`
- `invalid_admin_credentials_format`

Client must distinguish network failure from confirmed auth failure.

A network timeout must not clear an otherwise valid Admin session.

---

## 15. Implementation safety

Admin authentication is **HIGH RISK**.

Implementation must:

- use a dedicated feature branch;
- use an additive migration;
- preserve current Admin content tools;
- preserve existing production player authentication;
- not mix Admin identity with player identity;
- not expose secrets in URL, logs, HTML source or committed files;
- add targeted automated tests;
- require QA before merge;
- not deploy from the feature branch.

No destructive data operations are part of Phase 0.

---

## 16. Required QA matrix

At minimum verify:

- first bootstrap succeeds only when no Admin account exists;
- second bootstrap is rejected;
- recovery key is sent only through POST body;
- recovery key never reaches localStorage/sessionStorage;
- normal login succeeds with correct password;
- wrong username/password returns generic failure;
- login rate limit works;
- raw session token is not stored in D1;
- Admin session validation works;
- expired session is rejected;
- new login revokes previous active Admin session;
- Logout revokes current session;
- recovery changes password and revokes all sessions;
- old password fails after recovery;
- recovery with wrong key fails;
- existing Recipes / Monster Drops / Junk Info reads/writes work using Bearer Admin session;
- Admin page no longer sends `adminKey` in query string;
- legacy Admin key path remains available only if explicitly retained for rollback;
- normal player Auth V2 regression passes;
- no production player/account data changes;
- build passes;
- no secret values appear in repository diff/test logs.

---

## 17. Phase sequencing

Recommended Admin V2 sequence:

`A0 Security/Auth Contract -> A0.1 Auth Schema/API -> A0.2 Admin Login/Recovery UI -> A0.3 Auth Migration of Existing Admin Tools -> QA -> A1 Dashboard/Player Viewer -> later Admin modules`

Do not start player/economy mutation tooling before Phase 0 authentication and audit foundations pass QA.
