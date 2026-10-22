# GUEST LOGIN V1 (design record, not implemented)

Status: **DRAFT / NOT SCHEDULED.** Owner decisions recorded 2026-10-22. Risk: HIGH (touches auth, Worker, D1, policy text). No code until the Owner approves this design and a slot in the roadmap.

## 1. Owner decisions
1. A guest can do everything a normal account can (no feature restrictions: chat, guild, friends, Arena ranking, Raid all allowed).
2. A guest account that has been offline for **30 days** is deleted. A one-time warning is shown when the player taps "play as guest", together with a recommendation to bind a real account.
3. Settings has a "bind account" button. Owner proposed redirecting to the create-ID page; see section 3 for the recommended alternative.

## 2. Current auth facts (audited on main, Ver 1.1.5)
- `players.id TEXT PRIMARY KEY` is both the login ID and the internal key. Child tables reference it (`progress.player_id REFERENCES players(id) ON DELETE CASCADE`; about 42 cascade constraints in `migrations/auto`). There is **no separate internal id and no ON UPDATE CASCADE**, so renaming a player id in place is unsafe.
- Login lookup is `playerByLoginId` = `WHERE LOWER(id) = LOWER(?)` (`workers/modules/auth.js`). Passwords are stored hashed (`password_hash`); legacy plaintext `players.password` rows are left untouched by decision.
- `issueSession` revokes the previous active session of the player ("replaced") and inserts into `auth_sessions` (hash of a random token, 24 h or 30 d when "remember login").
- Client keeps the session token in `sessionStorage` (per tab). `characters.last_active_at` already exists and is written during play; `auth_rate_limits` + `checkRateLimit` already rate-limit auth attempts by key.
- Recovery Code is created at registration (`recovery_code_hash`) and shown once.

## 3. Bind account: recommended design (upgrade in place, no redirect)
Redirecting to the normal create-ID page is **not recommended**: that page creates a new, empty account, leaving the guest's characters behind, and merging two accounts (characters, items, guild, Arena, friends) is high risk.

Instead, upgrade the same player row:
1. Settings > "Bind account" opens a form in place: Player ID, password, confirm password (same validation rules as registration).
2. Worker action `upgradeGuestAccount` (session required, player must be a guest): checks the requested ID is free (case-insensitive, also against existing guest ids), sets the password hash, creates and returns a Recovery Code (shown once), clears the guest flag. All gameplay data stays because the internal `players.id` never changes.
3. Because `players.id` cannot change, add a nullable unique column `players.login_id` (case-insensitive) holding the chosen Player ID. `playerByLoginId` becomes `WHERE LOWER(id)=LOWER(?) OR LOWER(login_id)=LOWER(?)`. Display of "Player ID" in the UI uses `login_id` when present. Registration and upgrade must reject IDs that start with the reserved guest prefix and IDs that collide with any `id` or `login_id`.
4. After upgrade, the account is excluded from the 30-day deletion.

## 3b. Guest creation
- Button "play as guest" on the login screen. One-time warning (Thai, shown once per device and again only if no saved guest credential exists): clearing browser data or switching device loses access; guests offline 30 days are deleted; recommends binding an account in Settings.
- Worker action `createGuestAccount`: generates `guest-<random>` id and a random secret, inserts the player (`is_guest = 1`, created_at), issues a session like a normal login.
- Credential storage: session token stays in `sessionStorage`. To survive closing the tab the client keeps a **device token** (random, hashed server-side, revocable, bound to the guest row) in `localStorage`, not the password. Login with a device token issues a normal session. Never store a real password in `localStorage`.
- Rate limit guest creation per IP through the existing `auth_rate_limits` mechanism (N per day, tune after launch).

## 4. 30-day cleanup
- "Offline" = latest of `characters.last_active_at` (all characters of the player) and the newest `auth_sessions.created_at`; fall back to `players.created_at`. Prefer deriving it from existing columns; add `players.last_seen_at` only if the audit shows this is unreliable.
- Scheduled Worker (cron trigger) deletes guest players (`is_guest = 1`) past 30 days. The deletion relies on `ON DELETE CASCADE`; before shipping, verify every table that references the player or its characters (mail, friends, guild membership, Arena season rows, chat, pets, raid) is covered or explicitly cleaned.
- Guild leader: before deleting a guest who leads a guild, transfer leadership to the next member or disband an empty guild, using the existing guild rules.
- Deleting a guest is irreversible: log counts only (no personal data) and run a dry-run query first.
- Deploy note: the Worker cron trigger and any migration are applied by the Owner (Worker deploy rules in AGENTS.md); Claude cannot create cron triggers.

## 5. Required changes by layer
- D1 migration: `players.is_guest INTEGER NOT NULL DEFAULT 0`, `players.login_id TEXT` (unique, case-insensitive index), device-token table (hash, player_id, created_at, last_used_at, revoked_at), optional `last_seen_at`.
- Worker: `createGuestAccount`, `loginWithDeviceToken`, `upgradeGuestAccount`, `playerByLoginId` change, reserved-prefix checks, guest cleanup job, API policy entries (client policy table must classify the new actions; guest creation and upgrade are not auto-retried).
- Client: login screen button + one-time warning, device-token storage with `try/catch`, Settings "bind account" form (through the Server Operation Manager), reminder text for unbound guests, error catalog codes.
- Player information: update the draft Privacy Policy (long-lived device token in `localStorage`, guest retention 30 days) and Terms; bump their versions and dates. Add a Version History entry.
- Docs: update `docs/ACTIVE-DEVELOPMENT-ROADMAP-V3.md` when scheduled.

## 6. Risks and open questions
1. Account farming and leaderboard pollution (every guest is a full account): rate limit per IP, monitor, tune limits; revisit restrictions if abused.
2. Device token theft (XSS) equals guest account takeover; keep tokens revocable and rotate on use.
3. Players who bind an account on a second device cannot do so for a guest from another device (guest is tied to the device token): document in Settings text.
4. Which Player ID display is shown to other players (friends, guild)? Check social queries before relying on `login_id`.
5. Whether a guest can later be recovered with a Recovery Code (guest has none until upgrade).
6. Cron trigger frequency (daily is enough) and the exact N per IP per day.

## 7. Delivery plan (when approved)
1. Docs/spec approval and audit of tables referencing players (this document + follow-up).
2. PR Worker + D1 (Owner runs migration and deploys Worker): guest creation, device token login, upgrade, cleanup job, tests.
3. PR client + policy text: login button and warning, Settings bind form, Privacy/Terms update, version bump.
Each PR: branch, tests, CI, Owner merge, mobile checklist.
