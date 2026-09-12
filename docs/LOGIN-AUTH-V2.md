# Login / Auth V2 — Master Contract

Status: **approved source of truth for ThornieDungeons Login/Auth V2**.

This document owns the account-authentication contract for Login/Auth V2: login, registration, session handling, password storage, single-session behavior, recovery code, legacy-account migration, auth-related frontend UX, backend authorization, D1 migration, and required regression checks.

If older code/comments conflict with a locked rule here, this document wins for Login/Auth V2. Do not invent new account-security behavior without reporting it first.

---

## 1. Goal and scope

Replace the current repeated `Player ID + Password` authentication pattern with session-based authentication.

Current legacy behavior sends ID/password repeatedly across many API calls. Login/Auth V2 changes the flow to:

`Player ID + Password -> POST Login -> backend verifies -> Session Token -> authenticated APIs use Session Token`

Primary goals:

- Password is submitted only for authentication/security-sensitive actions, not every gameplay API call.
- Login must use POST, not password-in-query-string GET.
- Passwords are stored as secure hashes, never plaintext for V2 accounts.
- Session tokens are random opaque tokens; D1 stores only token hashes.
- One account may have only one active login session at a time.
- Existing players must remain able to log in and keep all characters/items/progression.
- Frontend auth UX remains mobile-first and reuses the existing ThornieDungeons visual language.

Out of scope for V2:

- Email recovery / email verification.
- SMS/phone recovery.
- Multi-factor authentication.
- Multiple simultaneous active sessions per account.
- Social login.

Email recovery may be added in a future version.

---

## 2. Login identity and password policy

### Player ID

- Player ID remains the account login identifier.
- Length: **4–20 characters**.
- Allowed characters: `A-Z`, `a-z`, `0-9`, `_`.
- No spaces.
- Login/uniqueness should be treated **case-insensitively** so IDs such as `Kim` and `kim` cannot become separate accounts.
- Existing legacy IDs must remain supported during migration even if an old account does not exactly match the new registration rules; do not lock old users out because of newly introduced validation.

### Password

- Length: **4–32 characters**.
- Do **not** require letters, numbers, uppercase, lowercase, or symbols.
- Confirm Password is required during registration and password reset/change flows.
- Frontend must never receive or display a password hash.
- Backend must not store new V2 passwords as plaintext.

---

## 3. Registration

New account registration uses:

- Player ID
- Password
- Confirm Password

Registration must use **POST**.

On success:

1. Create the account using password hashing.
2. Create the initial active session.
3. Generate a Recovery Code for the new account.
4. Return the raw Recovery Code to the client **once only**.
5. Store only the Recovery Code hash in D1.
6. Show the Recovery Code in the registration-success UI with a Copy action and a warning that it is shown only once.

Registration does not require email in V2.

If the requested Player ID is unavailable, the registration flow may report that the ID cannot be used, but must not expose unrelated account information.

---

## 4. Session model

Use a **random opaque session token**, not a client-trusted identity value.

The client receives the raw session token. D1 stores only a hash of that token.

Authenticated backend requests derive the real `player_id/account` from the validated session. Do not trust a client-supplied player ID as proof of account ownership.

### Session lifetime

- Normal login: **24 hours**.
- `Remember Login` enabled: **30 days**.
- V2 does not require a separate refresh-token system.
- When a session expires, the user logs in again.

### Remember Login

The current `Remember Password` behavior must be replaced by **Remember Login**.

- Do not store the user password for automatic re-login.
- Persist the session token only when Remember Login is enabled.
- If a valid remembered session exists when the game opens, authenticate it and continue directly to Character Select without requiring the Login screen.
- If the remembered session is invalid/expired/revoked, return to Login normally.

### Logout

Logout must:

1. Revoke the current server session.
2. Delete the local session token.
3. Return to Login.
4. It may retain Player ID locally for convenience.
5. It must not auto-login again using the revoked token.

---

## 5. One Account = One Active Session

ThornieDungeons V2 uses **single active session per account**.

When the same account logs in successfully from a new device/browser:

1. Revoke the previous active session immediately.
2. Create the new session.
3. The new device enters normally.
4. The old device is rejected the next time it calls an authenticated API.

The old client should receive a distinct auth error such as:

`session_replaced`

Frontend behavior:

- Return to Login.
- Show a clear message such as: `บัญชีนี้ถูกเข้าสู่ระบบจากอุปกรณ์อื่น`.
- Do not delete game/account data.

The replacement happens automatically; do not ask the new device for confirmation before replacing the old session.

The restriction is at **account level**, not character level. Different characters under the same account must not be playable simultaneously from separate sessions.

---

## 6. Session error behavior

Authenticated APIs should distinguish session lifecycle failures from network failures.

Examples:

- `session_expired`
- `session_replaced`
- `session_revoked`
- `invalid_session`

Frontend must return to Login on confirmed invalid/revoked/expired session errors.

A normal network error/time-out must **not** log the player out or delete a valid local session. Existing retry behavior may continue for transient network failures.

---

## 7. Password storage and legacy-account migration

Existing accounts currently use the legacy password field. Login/Auth V2 must preserve them with **lazy migration**.

### Legacy migration flow

When an account with no V2 password hash logs in:

1. Receive credentials through the new POST Login endpoint.
2. Verify the supplied password using the legacy account data.
3. If invalid, fail normally.
4. If valid, create the V2 password hash from the supplied password.
5. Mark the account as migrated/Auth V2.
6. Create the new session token.
7. Continue into the game normally.

After an account has a valid V2 password hash, authentication must use the V2 hash and must not silently fall back to the old plaintext password field.

Do **not** delete the legacy password column/data during the initial Auth V2 rollout. Removal is a later migration after V2 is verified and backed up.

Legacy migration must not alter characters, inventory, currencies, progression, pets, run state, or unrelated account data.

### Legacy Recovery Code behavior

Legacy accounts are **not forced through a Recovery Code popup** after migration.

After migrating/login:

- Enter the game normally.
- Settings > Account shows that no Recovery Code has been configured yet.
- Player may create one manually there.

This avoids interrupting existing players.

---

## 8. Recovery Code

Recovery Code is V2's password-recovery method until email recovery is added later.

Example presentation format may resemble:

`TD-8F4K-92PX-H7Q2`

The exact secure random format may be chosen by DEV, but it must have sufficient entropy and must not be predictable/sequential.

### Storage

- Store only `recovery_code_hash` in D1.
- Never store the raw code after it has been returned to the client.
- The server cannot display the existing raw Recovery Code later.

### New accounts

On registration success:

- Generate Recovery Code automatically.
- Show it once.
- Provide Copy action.
- Clearly state that the player must save it safely.

### Existing accounts / Settings

Settings > Account contains a Recovery section.

If no Recovery Code exists:

- Show status: not configured.
- Show a recommendation to create one.
- Provide `สร้าง Recovery Code`.

If a Recovery Code already exists:

- Show only status such as `ตั้งค่า Recovery Code แล้ว`.
- Do not display the old code.
- Provide `สร้าง Recovery Code ใหม่`.

Creating/regenerating a Recovery Code from Settings requires confirmation of the **current password**.

When regenerated:

1. Invalidate the old Recovery Code.
2. Store the new Recovery Code hash.
3. Show the new raw code once.

### Forgot Password flow

Flow:

`Player ID -> Recovery Code -> New Password -> Confirm Password`

On successful recovery:

1. Set the new password hash.
2. Revoke **all active sessions** for the account.
3. Invalidate the used Recovery Code.
4. Generate a new Recovery Code.
5. Show the new Recovery Code once.
6. Require normal login using the new password.

If the player loses both Password and Recovery Code and has no authenticated device/session, V2 has no automated ownership recovery. Email Recovery is intentionally deferred.

---

## 9. Password change

Settings > Account should support password change.

Required inputs:

- Current Password
- New Password
- Confirm New Password

On success:

- Update password hash.
- Revoke all existing sessions for the account.
- The current user must log in again with the new password.
- Recovery Code may remain valid unless a later security policy explicitly changes this; password reset via Recovery Code is the flow that must rotate the Recovery Code.

---

## 10. Login and recovery error privacy

Login failure should not reveal whether the ID exists.

Use a combined message equivalent to:

`Player ID หรือรหัสผ่านไม่ถูกต้อง`

Forgot-password / Recovery Code errors should also avoid unnecessarily confirming whether a target account exists.

Do not return:

- password
- password hash
- recovery-code hash
- token hash

in client responses, logs intended for the client, or public endpoints.

---

## 11. Rate limiting / brute-force protection

Login/Auth V2 requires protection against credential guessing and registration spam.

### Login

Target baseline:

- Up to about **5 failed login attempts per 5 minutes per IP + Player ID pair**.
- Escalating short cooldowns may be used, e.g. approximately 30 seconds -> 2 minutes -> 5 minutes.
- Successful login resets/clears the applicable failure state.
- Do not permanently/long-term lock an account solely because of failed attempts; that would allow attackers to deny service to another user's ID.

### Registration

Target baseline:

- About **3 account registrations per hour per IP**.

Implementation may use suitable Cloudflare/Worker rate-limit facilities rather than forcing every counter into D1, provided behavior is durable enough for the intended protection and does not weaken the contract above.

---

## 12. Backend authentication contract

The existing Worker currently accepts `id/password` on many gameplay endpoints. Login/Auth V2 should centralize authentication.

Preferred model:

1. Request carries session token.
2. Shared auth helper validates token hash, expiry and revoked/replaced status.
3. Auth helper returns server-trusted account/player identity.
4. Endpoint verifies that requested `characterId` belongs to that authenticated account where applicable.
5. Endpoint performs its normal game action.

Do not duplicate a separate password check inside every gameplay endpoint after V2 migration.

Gameplay endpoints that currently send `id/password` — including character entry/save, item sync, run state, daily login, Raid, Mailbox, Arena and related account-bound actions — must migrate to session authentication.

Public endpoints such as public config/reference/leaderboard reads may remain unauthenticated where already intentionally public.

Admin authentication is outside normal player-session V2 unless explicitly included in a later task; do not accidentally replace/remove `adminKey` security while doing player auth.

---

## 13. D1 migration contract

Do **not** rebuild the database.

Use additive migration(s) that preserve existing data.

### Players/account data

Add equivalent fields as needed, e.g.:

- `password_hash`
- `recovery_code_hash`
- `auth_version` or another explicit migration marker

Do not remove the legacy `password` field in the initial rollout.

### Auth sessions

Add an `auth_sessions` table (exact naming may vary) containing equivalent data such as:

- `session_id`
- `player_id`
- `token_hash`
- `created_at`
- `expires_at`
- `revoked_at`
- optional replacement/revoke reason
- optional non-sensitive device label/metadata if useful

Only one session may be active for a player under the V2 single-session rule.

Indexes should support efficient token lookup and account-session revocation.

Do not store raw session token values in D1.

Schema changes require migration SQL in the repo and validation against existing-player data before production application.

---

## 14. Frontend UI contract

The current ThornieDungeons Login screen is reused; no large visual redesign is required.

### Existing Login Screen — modify

Keep:

- Player ID
- Password
- Login button
- Create Account entry
- approved current Login artwork/background/theme

Change/add:

- Replace `จำรหัสผ่านบนอุปกรณ์นี้` with `จดจำการเข้าสู่ระบบ`.
- Add `ลืมรหัสผ่าน?`.
- Support session-status messages, including replaced/expired session.
- Stop caching/restoring the raw password.
- Support auto-login/session validation on app startup.

### Register — new modal/bottom sheet

Add a mobile-first Register UI rather than a required separate full-screen page.

Fields:

- Player ID
- Password
- Confirm Password

On successful registration:

- Show Recovery Code once.
- Copy action.
- Warning to store it safely.

### Forgot Password — new modal/bottom sheet

Fields/steps:

- Player ID
- Recovery Code
- New Password
- Confirm Password

Successful reset shows the newly rotated Recovery Code once, then returns to Login.

### Settings > Account — new section/flow

Add Account settings using the existing Settings/More visual language.

Required capabilities:

- account/Player ID display
- Change Password
- Recovery Code status
- Create Recovery Code when missing
- Regenerate Recovery Code when already configured
- Logout

Existing account players must not be forced into a recovery setup popup; they access recovery setup here when desired.

### Character Select

No redesign required.

Behavior change only:

- valid remembered session -> app may go directly to Character Select.

---

## 15. Local client storage

Legacy local cache may currently contain saved passwords.

Auth V2 migration must:

- stop writing raw password to local cache/storage.
- remove/clear legacy cached-password values during V2 startup/login migration when safe.
- retain Player ID if useful for UX.
- store the session token only according to Remember Login behavior.
- ensure Logout removes the persisted session token.

Do not expose session token in normal UI or debug text.

---

## 16. Required frontend/backend behavior matrix

At minimum verify:

- New account register with valid Player ID/password.
- Register rejects invalid ID format/length.
- Password length 4 and 32 accepted; below/above rejected.
- Password content has no letter/number/symbol composition requirement.
- Confirm Password mismatch rejected.
- Login uses POST; password is not put into URL query strings.
- Wrong ID/password returns generic auth failure.
- Normal 24-hour session issued.
- Remember Login 30-day session issued/persisted.
- Reopen app with valid remembered session -> Character Select without password prompt.
- Reopen with expired/revoked session -> Login.
- Login on device B revokes device A.
- Device A receives `session_replaced` behavior and returns to Login.
- Logout revokes server session and clears local token.
- Network error does not wipe a valid session.
- Legacy account logs in with old credentials and migrates to password hash without losing data.
- Migrated legacy account is not forced through a Recovery popup.
- Legacy account can create Recovery Code from Settings.
- New account receives Recovery Code once after registration.
- Existing raw Recovery Code cannot be viewed again.
- Regenerate Recovery Code requires current password and invalidates old code.
- Forgot Password with valid Recovery Code resets password, rotates Recovery Code and revokes all sessions.
- Used/old Recovery Code fails after rotation.
- Password change revokes all sessions and requires re-login.
- Authenticated endpoints reject missing/invalid/revoked tokens.
- Character ownership checks still prevent accessing another account's character.
- Inventory/currency/progression/character data survives auth migration unchanged.
- Existing public unauthenticated endpoints remain available as intended.
- Mobile safe-area, modal overflow, keyboard behavior and touch targets are verified.

---

## 17. Implementation/release safety

This is a **Medium–High Risk** system change because authentication touches all account-bound backend writes.

Implementation must:

- inspect latest `main`, current Worker and D1 migration state before changes.
- use a branch/PR rather than directly replacing production auth behavior.
- preserve legacy-player compatibility during rollout.
- include D1 migration SQL in repo.
- avoid destructive removal of legacy auth data during initial rollout.
- update frontend API wrappers and account-bound calls together; do not leave a mixed state where some gameplay calls still require plaintext password and others require token unless a deliberate backward-compatible transition layer is documented.
- test both new accounts and legacy accounts.
- not merge/deploy production until the requested review/release workflow is satisfied.

Because the current production Worker may be deployed separately from frontend hosting, DEV must identify and report the exact backend deployment step required. Do not assume a Worker source commit alone updates the live API.

---

## 18. Future items intentionally deferred

Do not implement these as part of Auth V2 unless separately approved:

- email recovery
- email verification
- OTP/MFA
- trusted-device list UI
- multiple concurrent sessions
- social login
- passwordless login
- account-transfer codes beyond the approved Recovery Code flow
