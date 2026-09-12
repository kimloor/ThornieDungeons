# Save Reliability V1 — Master Contract

Status: **approved prerequisite persistence contract for ThornieDungeons**.

This document defines the minimum save/persistence reliability rules that must be in place before Login/Auth V2 and Battle Core V1 are implemented on top of the current client-authoritative cloud-save model.

It supplements:

- `docs/LOGIN-AUTH-V2.md`
- `docs/BATTLE-SYSTEM-V1.md`

Where authentication or battle behavior intersects save ordering/retry/checkpoint safety, the rules in this document are mandatory unless a later approved contract explicitly replaces them.

---

## 1. Why this exists

Current persistence already writes character progress, inventory/items and dungeon run state to Cloudflare Worker -> D1, but the client write queue currently swallows terminal write failures. This can allow the UI to continue with newer local state while cloud state remains older without telling the player.

Save Reliability V1 fixes that reliability gap without redesigning all game data or changing gameplay balance.

Primary goals:

- never silently lose a failed cloud write;
- preserve write ordering;
- distinguish transient network failure from auth/validation failure;
- expose save state to the app;
- retry safely where the operation is safe to retry;
- prevent stale writes from an invalid/replaced session;
- provide a persistence foundation for Auth V2 and Battle V1 checkpoint/reward safety;
- preserve existing player data and current D1 schema unless a later feature needs an additive migration.

---

## 2. Current persistence domains

The current game has several distinct persistence domains. They must not be treated as one undifferentiated blob.

### 2.1 Character progress

Cloud authoritative storage:

- D1 `characters`
- shared account Diamonds in D1 `players`

Includes current fields such as:

- Level / EXP
- Stat Points
- STR / VIT / AGI / DEX / LUK
- Gold
- unlocked floor
- potion count/progression fields
- Protection Stones
- chest pity
- Pets / pet duplicate data / active pet
- current Hero Skill levels in the existing compatible JSON envelope

Current write path is equivalent to `persistSave -> saveCharacterProgress`.

### 2.2 Inventory / equipment

Cloud authoritative storage:

- D1 `items`

Current synchronization sends a character-scoped full item snapshot. Stale rows are deleted only for that character.

This domain must remain isolated per `characterId`.

### 2.3 Dungeon/Battle checkpoint

Current storage:

- D1 `run_state`
- localStorage fallback/cache

The legacy checkpoint currently focuses mainly on floor and Hero HP/MP/runtime values. Battle V1 will replace/extend this contract with a complete action-boundary battle checkpoint.

### 2.4 Local-only character settings

Current examples:

- four combat Quick Slots

These are currently local-only. Battle V1 should move Quick Slots to cloud-persistent per-character settings while retaining local cache/fallback behavior.

### 2.5 Reference/content cache

Game config, recipes, monster loot, junk info and asset manifest caches are not player-progress writes. They remain fetch/cache content and must not enter the player save queue.

### 2.6 Server-owned transactional state

Examples include:

- Raid stamina
- Arena tickets
- Raid/Arena transaction state
- mailbox/claim state

These must remain server-authoritative and must not be overwritten by generic client full-state saves.

---

## 3. Save state model

The client must expose an explicit persistence state instead of treating every queued write as successful.

Minimum logical states:

- `saved` — no pending/failed player-state writes;
- `saving` — at least one write is queued or in flight;
- `failed` — at least one required write failed after normal transient retry;
- optional `offline_pending` — useful if DEV separates known offline state from other terminal failure.

A failed write must never be converted to `saved` merely because the Promise chain continued.

The current pattern equivalent to terminal `catch(() => {})` is not acceptable for required player-state writes.

The UI does not need a large redesign. A subtle save indicator/toast is enough, but the player must be informed when cloud saving is still failing.

---

## 4. Ordered write queue

All normal player-state cloud writes continue through an ordered persistence layer.

Requirements:

1. Writes for the same active account/character execute in deterministic order.
2. A failed write must be recorded, not swallowed.
3. Later queued writes must not make the queue appear healthy while an earlier required write is unresolved unless the later write safely supersedes it.
4. Switching character/account must not allow writes from the old character/account to be applied to the new context.
5. Queue entries must carry enough scope to identify account/session, character, domain and request generation.

Recommended logical metadata:

- account/player identity
- `characterId` when applicable
- persistence domain
- local sequence/generation
- session generation after Auth V2
- created timestamp

Exact internal names are implementation-defined.

---

## 5. Safe coalescing rules

Because several current endpoints save full snapshots, repeated intermediate snapshots may be coalesced when and only when the newest snapshot fully supersedes the older one.

### Character progress

May use **latest snapshot wins** inside the same account/character/session generation, provided ordering against other dependent operations remains correct.

### Inventory/equipment

May use **latest full item snapshot wins** for the same character, because `syncItems` represents the complete character item state.

Never coalesce inventory snapshots across different characters.

### Battle checkpoint

Battle V1 may use **latest completed-action checkpoint wins** for the same `battleId`.

Do not save or coalesce a half-resolved action.

### Non-idempotent actions

Do not blindly place economy/claim/attack/craft operations into a replay queue merely because they are network calls.

Examples:

- Craft
- Raid attack
- Arena action
- Mail claim
- Gacha purchase/transaction if moved server-side later

These require server idempotency/transaction rules specific to the action. Generic save retry rules must not duplicate them.

---

## 6. Retry policy

Transient failures may be retried automatically.

Examples:

- temporary network error
- timeout
- temporary 5xx/service failure

Use bounded retry with short backoff. Exact timing may be chosen by DEV, but retries must not create request storms.

After automatic retries are exhausted:

- keep the domain/account/character marked dirty/failed;
- expose save failure state;
- retain the newest safe snapshot needed for another attempt while the current app session is active;
- retry when an appropriate recovery signal occurs, such as network reconnect, app foreground, manual Save, or the next compatible mutation.

Do not retry forever in a tight loop.

---

## 7. Errors that are NOT transient retries

The persistence layer must classify auth and validation errors separately from network failures.

Examples:

- invalid/revoked/replaced/expired session
- character ownership failure
- invalid payload/schema validation failure
- forbidden action

These must not be endlessly retried as if the network were offline.

After Login/Auth V2:

- `session_expired`, `session_replaced`, `session_revoked`, `invalid_session` stop authenticated persistence retries for that session generation;
- pending writes from a replaced/revoked session must never be replayed under a new session without an explicit safe reconciliation path;
- frontend follows the Auth V2 return-to-login behavior.

---

## 8. Manual Save, Switch Character and Logout

### Manual Save

Manual Save is a reliability action, not the only time progress is persisted.

It should:

- flush/coalesce the current safe state for relevant domains;
- trigger retry of failed compatible writes;
- report success/failure honestly.

### Switch Character

Before switching character:

- request a save flush for current character progress/items/checkpoint as applicable;
- do not silently discard a known failed required write;
- prevent old-character queued writes from entering the new-character context.

If saving cannot complete, UI should clearly warn rather than pretending everything was saved.

### Logout

Normal user-requested logout should attempt a current-state flush before revoking the session when possible.

After Auth V2 session revocation/replacement has already happened, do not try to force stale writes through invalid credentials/session.

Logout/session replacement must clear or invalidate queue ownership so the next account cannot inherit prior writes.

---

## 9. Local fallback / browser close

Web browsers cannot guarantee completion of asynchronous requests during abrupt close/background termination.

Therefore reliability must come primarily from immediate mutation saves plus checkpointing, not from assuming logout/unload always runs.

A lightweight local dirty snapshot/cache may be kept per account+character to support same-device recovery, but it must be treated carefully:

- namespace by account and character;
- version the payload;
- never replay it into a different account;
- after Auth V2, bind it to a compatible session/account generation;
- do not blindly overwrite newer server state after a session replacement or another-device login.

If DEV cannot prove a cross-session replay is conflict-safe, prefer server state and report/clear the stale local dirty snapshot rather than overwriting newer cloud progress.

---

## 10. Save ownership and server-authoritative fields

Generic client persistence must update only fields it owns.

Server-authoritative fields such as Raid stamina and Arena tickets must remain excluded from client-authoritative full overwrites.

Any future server-owned economy field must follow the same rule.

Do not expand `saveCharacterProgress` to overwrite every physical column in `characters` merely because the column exists.

The persistence contract should use an explicit allowlist of client-owned fields.

---

## 11. Transaction/reward safety

Rewards and irreversible transactions must not depend on a fragile sequence where a client can receive a reward locally but permanently lose the corresponding server commit, or commit twice after retry.

For server-side transactional actions:

- use an idempotency key when duplicate submission is possible;
- backend must return the already-committed result for a repeated completed request where practical;
- never rely only on disabling a frontend button as duplicate protection.

Battle V1 uses `battleId/runId` or equivalent for this purpose.

---

## 12. Login/Auth V2 integration — mandatory additions

Login/Auth V2 must implement the following persistence integration in addition to its existing auth contract.

### 12.1 Central authenticated API/persistence boundary

Gameplay persistence functions must no longer individually depend on `cred.id + cred.password`.

Preferred flow:

`UI/game state -> persistence/API client -> central session auth -> Worker`

The persistence/API layer supplies the session token centrally.

### 12.2 Session generation owns writes

Each authenticated persistence write belongs to the session generation that created it.

On successful login from a new device/session:

- previous-session writes cannot be replayed by the old device after `session_replaced`;
- invalid-session errors terminate retry for that generation;
- new session begins with server-loaded account/character state as its baseline.

### 12.3 Logout ordering

Normal Logout should:

1. attempt safe current-state flush;
2. wait for the bounded flush result;
3. revoke session;
4. clear local token/auth state;
5. invalidate that session generation's queue.

If the session is already invalid/replaced, skip impossible cloud flush and transition to Login without attempting stale authenticated writes.

### 12.4 Network error vs auth error

A network error must not clear a valid session.

An explicit session lifecycle error must not be retried as a network save failure.

### 12.5 Auth migration QA additions

Auth V2 QA must additionally verify:

- pending save + temporary network failure -> retry succeeds after reconnect;
- pending save does not disappear silently;
- Logout does not report saved when flush failed;
- character switch cannot leak old-character writes into new character;
- device B login invalidates device A persistence queue;
- device A cannot replay stale writes after `session_replaced`;
- new session loads server state before accepting new gameplay mutations.

---

## 13. Battle Core V1 integration — mandatory additions

Battle Core V1 must implement the following persistence rules in addition to its existing battle contract.

### 13.1 Replace legacy HP/MP-only checkpoint semantics

Battle V1 checkpoint must represent a complete safe battle state at a **completed Action boundary**.

Checkpoint data must include the already-approved Battle V1 state such as:

- schema/version
- `battleId/runId`
- checkpoint sequence/version
- floor/encounter identity
- Hero state
- Pet state
- all enemy states
- queue/round state needed for deterministic resume
- cooldowns
- statuses/durations
- Fury/Aegis/Scheme and other special resources/counters
- selected target
- any approved per-battle counters needed for skills/triggers

Do not checkpoint midway through multi-hit/status/counter chains.

### 13.2 Checkpoint ordering

For the same battle:

- every completed action increments or advances checkpoint sequence;
- older delayed checkpoint writes must not overwrite a newer checkpoint;
- backend should reject/ignore an older sequence if requests arrive out of order.

### 13.3 Victory/reward commit ordering

Battle completion must use an idempotent battle completion identifier.

Safe order:

1. battle reaches final outcome;
2. commit final progression/reward outcome using `battleId/runId` or equivalent idempotency key;
3. server confirms commit or returns the previously committed result;
4. only then finalize/clear the resumable checkpoint.

If checkpoint clearing fails after reward commit, retrying completion must not duplicate rewards.

Do not clear the only recovery checkpoint before reward/progression commit is durable.

### 13.4 Skip and Auto

Normal play, Auto and Skip use the same battle resolver and the same persistence boundaries.

Skip may suppress animation delays, but it must still produce valid completed-action/final-outcome state and the same idempotent completion behavior.

### 13.5 Quick Slots

Battle V1 should move the four Quick Slots from local-only storage to cloud persistence scoped by character.

Requirements:

- character-specific;
- survives device/browser change after login;
- local cache may remain for fast UI/fallback;
- server/cloud state is authoritative after authenticated load;
- invalid/removed skills clear only affected slots during migration;
- Quick Slot sync must not be mixed into the battle checkpoint payload unless DEV has a documented reason; it is character configuration, not transient battle state.

### 13.6 Battle persistence QA additions

Battle V1 QA must additionally verify:

- close/reopen after a completed action resumes that action boundary;
- close during animation/multi-hit resumes the last completed safe boundary, not a half action;
- delayed older checkpoint cannot replace newer checkpoint;
- Victory with temporary network failure does not duplicate rewards after retry/reopen;
- reward committed + checkpoint clear failed still resumes/finishes without duplicate reward;
- Skip produces the same persistent outcome rules as normal play;
- Auto resume returns with Auto OFF as already specified;
- Quick Slots follow the character across devices after cloud sync;
- character A checkpoint/Quick Slots never appear on character B.

---

## 14. D1/schema guidance

Save Reliability V1 itself should avoid an unnecessary broad schema migration.

Use existing tables where possible.

Additive schema changes are allowed only when required for a proven safety contract, for example Battle V1 may require checkpoint sequence/idempotency metadata or a dedicated completion record.

Any added migration must:

- preserve existing accounts/characters/items;
- include rollback/backup awareness;
- be validated against current production schema before apply;
- not delete legacy data during first rollout.

Exact Battle V1/Auth V2 migrations belong to those implementation branches and must follow their master contracts plus this persistence contract.

---

## 15. Required Save Reliability V1 QA matrix

At minimum verify:

- successful character mutation reaches D1;
- successful inventory mutation reaches D1;
- writes preserve per-character isolation;
- temporary network failure sets visible failed/pending state instead of silent success;
- reconnect retries safely;
- manual Save retries compatible dirty state;
- ordered writes cannot roll a newer state back to an older state;
- inventory latest snapshot cannot cross characters;
- server-owned Raid stamina/Arena tickets are not overwritten by generic save;
- switching character flushes/warns correctly and isolates queue ownership;
- logout flush behavior is honest;
- app remains playable after a transient failed save without corrupting local state;
- validation/auth errors are not retried forever;
- existing player load/save remains compatible;
- no destructive D1 migration is introduced solely for this reliability layer.

---

## 16. Implementation order

Recommended project order:

1. **Save Reliability V1 foundation**
   - tracked ordered queue
   - save status/error handling
   - transient retry/reconnect retry
   - account/character/domain scoping
   - safe flush behavior
2. **Login/Auth V2**
   - session-based API boundary
   - session-generation ownership of persistence writes
   - auth-aware queue cancellation/retry rules
3. **Battle Core V1**
   - complete action-boundary checkpoint
   - checkpoint sequencing
   - idempotent battle completion/reward commit
   - cloud Quick Slots

Do not implement Battle's final checkpoint/reward architecture on top of the legacy silent-failure queue and then refactor it again afterward.

---

## 17. Risk and release path

Save Reliability V1 is **Medium–High Risk** because it affects progression/inventory persistence even if gameplay formulas do not change.

Implementation must:

- branch from latest `main`;
- inspect current Worker/D1 contract first;
- avoid unrelated gameplay changes;
- preserve existing saves;
- run source build when source changes;
- test existing account/character/inventory save/load flows;
- provide a preview/test path where applicable;
- require technical QA before release;
- not merge/deploy production until the user review/release workflow is satisfied.
