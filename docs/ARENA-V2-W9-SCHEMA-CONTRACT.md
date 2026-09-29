# Arena V2 W9 — Schema Contract / W9.3 Preflight

Status: **IMPLEMENTED — QA APPROVED / INTEGRATED AFTER ADMIN V2**

Implementation branch:
- `feat/w9-arena-v2`

Planned production migration:
- `migrations/auto/0023_arena_v2_foundation.sql`

Gameplay source of truth:
- `docs/ARENA-V2-W9.md`

Implementation roadmap:
- `docs/ARENA-V2-W9-IMPLEMENTATION-ROADMAP.md`

This document locks the W9.3 persistence shape after auditing the current production schema conventions. It is an implementation contract, not a replacement for the Arena gameplay document.

## 1. Preflight findings

Confirmed current production lane:
- historical Arena V1 schema remains in manually-applied `migration_v3.sql`, `migration_v9_arena.sql`, and `migration_v10_arena_matches.sql`;
- new automated migrations live only in `migrations/auto/**`;
- latest automated migration is `0021_guild_donation_apply_trigger.sql`;
- at W9.3 preflight, the next migration number was **0022**;
- W9.3 was implemented and QA-approved against that preflight lane;
- Admin V2 subsequently claimed and deployed production migration **0022**;
- Arena V2 is therefore released as **0023**, without changing the locked SQL body or schema semantics;
- W9.3 must be additive and must not replay, alter, rename, or drop the historical Arena V1 objects.

Legacy objects that remain untouched during W9 rollout:
- `pvp_snapshots`;
- `pvp_ranking`;
- `pvp_match_log`;
- `pvp_matches`;
- `characters.pvp_tickets`;
- `characters.pvp_tickets_updated_at`.

Current schema conventions reused here:
- character-owned state references `characters(character_id)` with `ON DELETE CASCADE`;
- persistent timestamps are ISO text;
- JSON payloads are stored as TEXT;
- one-live-row rules use partial unique indexes;
- canonical unordered character pairs use `character_id_a < character_id_b`;
- irreversible operations use deterministic identity/receipt keys instead of retry-unsafe random-only semantics.

## 2. Ownership boundaries

### Persistent across seasons
Owned by Arena V2 but not reset at rollover:
- Arena Ticket V2 balance/reconciliation anchors;
- Arena Coin;
- Arena Setup;
- Arena unlock-notice state;
- global Profile Frame entitlement records and equipped frame selection.

### Current-season state
New row/state per season:
- Rating;
- Attack W/D/L;
- Defense W/D/L;
- tie-break timestamp for current Rating;
- highest promotion tier rewarded;
- pair encounter counters;
- opponent list/refresh state;
- match/history records;
- milestone/promotion/season receipts.

### Not duplicated into Arena Setup
Arena equipment is never copied into `arena_setup`.
Match preparation must read current authoritative equipped items and freeze them only into the immutable match snapshot.

## 3. Exact W9.3 tables

W9.3 creates the following new tables:

1. `arena_seasons`
2. `arena_character_state`
3. `arena_setup`
4. `arena_season_players`
5. `arena_pair_season_stats`
6. `arena_opponent_state`
7. `arena_matches`
8. `arena_match_actions`
9. `arena_match_history`
10. `arena_idempotency_receipts`
11. `profile_frame_entitlements`
12. `character_profile_frame_state`

No existing Arena V1 table is repurposed as the authoritative V2 store.

---

## 4. DDL contract

The executable migration may add comments/formatting, but table/column meaning and uniqueness rules below are locked unless a concrete D1 compatibility problem is found during implementation.

### 4.1 arena_seasons

Purpose:
- authoritative weekly season identity and cutoff;
- supports old-season finalization while the new season is already active.

```sql
CREATE TABLE arena_seasons (
  season_id TEXT PRIMARY KEY,
  season_number INTEGER NOT NULL UNIQUE,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'finalizing', 'finalized')),
  finalized_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (ends_at > starts_at)
);

CREATE UNIQUE INDEX idx_arena_seasons_one_active
ON arena_seasons(status) WHERE status = 'active';

CREATE INDEX idx_arena_seasons_ends_at
ON arena_seasons(ends_at);
```

Notes:
- Season 1 is created by runtime at V2 launch and may be shorter than seven days.
- Season 2+ use the Sunday 16:00 UTC cutoff contract.
- A prior season may remain `finalizing` while the next season is `active`.

### 4.2 arena_character_state

Purpose:
- persistent Arena wallet/ticket/unlock state;
- deliberately separate from legacy `characters.pvp_tickets`.

```sql
CREATE TABLE arena_character_state (
  character_id TEXT PRIMARY KEY
    REFERENCES characters(character_id) ON DELETE CASCADE,
  arena_coin INTEGER NOT NULL DEFAULT 0 CHECK (arena_coin >= 0),
  tickets INTEGER NOT NULL DEFAULT 0 CHECK (tickets >= 0 AND tickets <= 10),
  ticket_updated_at TEXT NOT NULL DEFAULT '',
  last_daily_ticket_date TEXT NOT NULL DEFAULT '',
  unlock_notice_seen INTEGER NOT NULL DEFAULT 0
    CHECK (unlock_notice_seen IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Important:
- `tickets DEFAULT 0` is a storage default, not a launch-balance design decision.
- W9.4 must reconcile the current UTC Daily Reset before returning Ticket state.
- passive Ticket time uses `ticket_updated_at`; time while capped must not later create catch-up beyond the cap.
- `last_daily_ticket_date` is the UTC date key used for the +5 reconciliation.

#### Existing Lv.10+ launch suppression

Migration 0023 must backfill existing characters already Lv.10+ so they do not receive the new unlock popup retroactively:

```sql
INSERT INTO arena_character_state (
  character_id, arena_coin, tickets, ticket_updated_at,
  last_daily_ticket_date, unlock_notice_seen, created_at, updated_at
)
SELECT
  character_id, 0, 0, '', '', 1,
  strftime('%Y-%m-%dT%H:%M:%fZ','now'),
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM characters
WHERE level >= 10
ON CONFLICT(character_id) DO NOTHING;
```

Existing characters below Lv.10 are not marked seen and can receive the one-time popup when they later cross Lv.10.

### 4.3 arena_setup

Purpose:
- persistent offense/defense Pet + ordered 0–4 active skill priority;
- one atomic row for SAVE SETUP.

```sql
CREATE TABLE arena_setup (
  character_id TEXT PRIMARY KEY
    REFERENCES characters(character_id) ON DELETE CASCADE,
  pet_inst_id TEXT NOT NULL DEFAULT '',
  skill_slots_json TEXT NOT NULL DEFAULT '[null,null,null,null]',
  initialized_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Notes:
- Pet instance identity follows the existing `pets_json` `instId` convention.
- No FK is possible for Pet because Pet instances live inside `characters.pets_json`.
- equipment does not belong here.
- row absence means first Arena V2 setup initialization has not occurred yet.

### 4.4 arena_season_players

Purpose:
- one authoritative per-character row per season;
- replaces V1 `pvp_ranking` for V2 competition only.

```sql
CREATE TABLE arena_season_players (
  season_id TEXT NOT NULL
    REFERENCES arena_seasons(season_id) ON DELETE CASCADE,
  character_id TEXT NOT NULL
    REFERENCES characters(character_id) ON DELETE CASCADE,
  rating INTEGER NOT NULL DEFAULT 1000 CHECK (rating >= 1000),
  rating_reached_at TEXT NOT NULL,
  attack_wins INTEGER NOT NULL DEFAULT 0 CHECK (attack_wins >= 0),
  attack_draws INTEGER NOT NULL DEFAULT 0 CHECK (attack_draws >= 0),
  attack_losses INTEGER NOT NULL DEFAULT 0 CHECK (attack_losses >= 0),
  defense_wins INTEGER NOT NULL DEFAULT 0 CHECK (defense_wins >= 0),
  defense_draws INTEGER NOT NULL DEFAULT 0 CHECK (defense_draws >= 0),
  defense_losses INTEGER NOT NULL DEFAULT 0 CHECK (defense_losses >= 0),
  highest_rewarded_tier INTEGER NOT NULL DEFAULT 0
    CHECK (highest_rewarded_tier BETWEEN 0 AND 3),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (season_id, character_id)
);

CREATE INDEX idx_arena_season_players_leaderboard
ON arena_season_players(
  season_id,
  rating DESC,
  attack_wins DESC,
  rating_reached_at ASC
);

CREATE INDEX idx_arena_season_players_character
ON arena_season_players(character_id, season_id);

CREATE INDEX idx_arena_season_players_pool
ON arena_season_players(season_id, rating)
WHERE (attack_wins + attack_draws + attack_losses) > 0;
```

Tier integer mapping for `highest_rewarded_tier`:
- 0 = Bronze baseline / none;
- 1 = Silver;
- 2 = Gold;
- 3 = Diamond.

Rules:
- Season 1 creation explicitly starts at Rating 1000.
- Later rollover inserts the new row with the approved one-tier-drop base; do not rely on the DB default for rollover.
- season eligibility is derived from Attack W+D+L > 0; do not store a second boolean that can drift.
- `rating_reached_at` changes only when the numeric Rating changes. Draw or 0%-pair settlement must not reset it.

### 4.5 arena_pair_season_stats

Purpose:
- symmetric real-player pair diminishing per season.

```sql
CREATE TABLE arena_pair_season_stats (
  season_id TEXT NOT NULL
    REFERENCES arena_seasons(season_id) ON DELETE CASCADE,
  character_id_a TEXT NOT NULL
    REFERENCES characters(character_id) ON DELETE CASCADE,
  character_id_b TEXT NOT NULL
    REFERENCES characters(character_id) ON DELETE CASCADE,
  encounter_count INTEGER NOT NULL DEFAULT 0 CHECK (encounter_count >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (season_id, character_id_a, character_id_b),
  CHECK (character_id_a < character_id_b)
);

CREATE INDEX idx_arena_pair_character_b
ON arena_pair_season_stats(season_id, character_id_b);
```

Rules:
- application code normalizes the pair lexicographically before every read/write;
- no bot row is ever inserted;
- Draw still increments `encounter_count`.

### 4.6 arena_opponent_state

Purpose:
- server-owned current 3-opponent list and refresh cooldown;
- naturally resets by season key.

```sql
CREATE TABLE arena_opponent_state (
  season_id TEXT NOT NULL
    REFERENCES arena_seasons(season_id) ON DELETE CASCADE,
  character_id TEXT NOT NULL
    REFERENCES characters(character_id) ON DELETE CASCADE,
  opponents_json TEXT NOT NULL DEFAULT '[]',
  refresh_available_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (season_id, character_id)
);
```

`opponents_json` stores server identities/slot metadata required to reproduce the current list, including bot identity where applicable. It must not become a combat snapshot.

### 4.7 arena_matches

Purpose:
- prepared → active → done lifecycle;
- immutable prepared snapshot plus mutable Battle Core state;
- active match resume/result replay;
- bots and real defenders share one table.

```sql
CREATE TABLE arena_matches (
  match_id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL
    REFERENCES arena_seasons(season_id) ON DELETE CASCADE,
  attacker_character_id TEXT NOT NULL
    REFERENCES characters(character_id) ON DELETE CASCADE,
  defender_type TEXT NOT NULL
    CHECK (defender_type IN ('player', 'bot')),
  defender_character_id TEXT
    REFERENCES characters(character_id) ON DELETE CASCADE,
  defender_bot_id TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'matchmaking'
    CHECK (source IN ('matchmaking', 'revenge')),
  reward_slot TEXT NOT NULL
    CHECK (reward_slot IN ('lower', 'equal', 'higher')),
  status TEXT NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'active', 'done', 'expired')),
  seed INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  state_json TEXT NOT NULL DEFAULT '',
  result_json TEXT NOT NULL DEFAULT '',
  prepared_at TEXT NOT NULL,
  prepared_expires_at TEXT NOT NULL,
  activated_at TEXT NOT NULL DEFAULT '',
  ticket_consumed_at TEXT NOT NULL DEFAULT '',
  deadline_at TEXT NOT NULL DEFAULT '',
  completed_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (defender_type = 'player' AND defender_character_id IS NOT NULL AND defender_bot_id = '')
    OR
    (defender_type = 'bot' AND defender_character_id IS NULL AND defender_bot_id <> '')
  )
);

CREATE UNIQUE INDEX idx_arena_matches_open_attacker
ON arena_matches(attacker_character_id)
WHERE status IN ('prepared', 'active');

CREATE INDEX idx_arena_matches_season_attacker
ON arena_matches(season_id, attacker_character_id, created_at DESC);

CREATE INDEX idx_arena_matches_season_defender
ON arena_matches(season_id, defender_character_id, created_at DESC)
WHERE defender_character_id IS NOT NULL;

CREATE INDEX idx_arena_matches_active_deadline
ON arena_matches(deadline_at)
WHERE status = 'active';

CREATE INDEX idx_arena_matches_prepared_expiry
ON arena_matches(prepared_expires_at)
WHERE status = 'prepared';
```

Rules:
- `snapshot_json` is immutable after prepare and contains frozen character/equipment/Pet/skill/presentation metadata.
- `state_json` is the current serialized Battle Core state after activation.
- `result_json` is authoritative replay data after `done`.
- only one prepared/active outgoing match may exist per attacker.
- a defender may have multiple asynchronous defense matches.
- `reward_slot` is resolved at prepare time and is also used for Revenge's normal Coin rule.
- prepared expiry consumes no Ticket.
- match activation transition and Ticket consumption use the match identity as the exact-once boundary.

### 4.8 arena_match_actions

Purpose:
- request-level exact-once receipt for valid Arena actions;
- prevents concurrent/retried submit calls from advancing one sequence twice.

```sql
CREATE TABLE arena_match_actions (
  match_id TEXT NOT NULL
    REFERENCES arena_matches(match_id) ON DELETE CASCADE,
  action_key TEXT NOT NULL,
  action_seq INTEGER NOT NULL CHECK (action_seq >= 0),
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (match_id, action_key),
  UNIQUE (match_id, action_seq)
);
```

Runtime contract:
- client/server API carries an idempotency `action_key` for a submitted valid action;
- replay of the same key returns `response_json`;
- a different request racing the same `action_seq` cannot create a second state advance.

W9.5/W9.6 may choose the exact external field name for the request nonce, but it must map to this semantic identity.

### 4.9 arena_match_history

Purpose:
- compact immutable current/old-season audit rows;
- ATTACK and DEFENSE tabs query the same record from opposite columns;
- bots have Attack history only.

```sql
CREATE TABLE arena_match_history (
  match_id TEXT PRIMARY KEY
    REFERENCES arena_matches(match_id) ON DELETE CASCADE,
  season_id TEXT NOT NULL
    REFERENCES arena_seasons(season_id) ON DELETE CASCADE,
  attacker_character_id TEXT NOT NULL
    REFERENCES characters(character_id) ON DELETE CASCADE,
  defender_type TEXT NOT NULL
    CHECK (defender_type IN ('player', 'bot')),
  defender_character_id TEXT
    REFERENCES characters(character_id) ON DELETE CASCADE,
  defender_bot_id TEXT NOT NULL DEFAULT '',
  attacker_name TEXT NOT NULL DEFAULT '',
  defender_name TEXT NOT NULL DEFAULT '',
  attacker_result TEXT NOT NULL
    CHECK (attacker_result IN ('win', 'draw', 'loss')),
  attacker_rating_change INTEGER NOT NULL DEFAULT 0,
  defender_rating_change INTEGER NOT NULL DEFAULT 0,
  arena_coin_earned INTEGER NOT NULL DEFAULT 0 CHECK (arena_coin_earned >= 0),
  resolution TEXT NOT NULL DEFAULT 'normal'
    CHECK (resolution IN ('normal', 'surrender', 'timeout', 'cutoff')),
  completed_at TEXT NOT NULL,
  CHECK (
    (defender_type = 'player' AND defender_character_id IS NOT NULL AND defender_bot_id = '')
    OR
    (defender_type = 'bot' AND defender_character_id IS NULL AND defender_bot_id <> '')
  )
);

CREATE INDEX idx_arena_history_attack
ON arena_match_history(season_id, attacker_character_id, completed_at DESC);

CREATE INDEX idx_arena_history_defense
ON arena_match_history(season_id, defender_character_id, completed_at DESC)
WHERE defender_character_id IS NOT NULL;
```

The names are frozen at match time so later character renames do not rewrite historical display.

### 4.10 arena_idempotency_receipts

Purpose:
- one generic deterministic receipt surface for irreversible Arena side effects;
- avoids separate duplicate-prone milestone/promotion/finalization tables.

```sql
CREATE TABLE arena_idempotency_receipts (
  receipt_key TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  season_id TEXT REFERENCES arena_seasons(season_id) ON DELETE CASCADE,
  character_id TEXT REFERENCES characters(character_id) ON DELETE CASCADE,
  match_id TEXT REFERENCES arena_matches(match_id) ON DELETE CASCADE,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX idx_arena_receipts_character
ON arena_idempotency_receipts(character_id, kind, created_at DESC);

CREATE INDEX idx_arena_receipts_season
ON arena_idempotency_receipts(season_id, kind, created_at DESC);
```

Deterministic key families:

```text
arena:ticket-purchase:<characterId>:<requestId>
arena:match-settle:<matchId>
arena:match-coin:<matchId>
arena:milestone:<seasonId>:<characterId>:play:<threshold>
arena:milestone:<seasonId>:<characterId>:win:<threshold>
arena:promotion:<seasonId>:<characterId>:<tier>
arena:season-reward:<seasonId>:<characterId>
arena:season-finalize:<seasonId>
```

This table is the DB-level duplicate barrier. W9.7/W9.8 must create the receipt in the same atomic D1 batch/transaction boundary as the corresponding authoritative side effects.

### 4.11 profile_frame_entitlements

Purpose:
- first shared/global Profile Frame entitlement model;
- not coupled to Player Card decoration assets.

```sql
CREATE TABLE profile_frame_entitlements (
  entitlement_id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL
    REFERENCES characters(character_id) ON DELETE CASCADE,
  frame_key TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT '',
  source_key TEXT NOT NULL DEFAULT '',
  granted_at TEXT NOT NULL,
  expires_at TEXT,
  disabled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (character_id, frame_key, source_type, source_key)
);

CREATE INDEX idx_profile_frame_entitlement_lookup
ON profile_frame_entitlements(character_id, frame_key, expires_at);
```

W9 Arena semantic frame keys:
- `arena_rank_1`;
- `arena_rank_2`;
- `arena_rank_3`.

These are semantic entitlement keys, not R2 paths. Rendering later maps them through the published manifest keys.

A new season award uses a new `source_key` (the season ID), so prior expired entitlements remain in history.

### 4.12 character_profile_frame_state

Purpose:
- global current selection, independent of Arena.

```sql
CREATE TABLE character_profile_frame_state (
  character_id TEXT PRIMARY KEY
    REFERENCES characters(character_id) ON DELETE CASCADE,
  equipped_frame_key TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
```

Rules:
- an empty key means default/no Profile Frame;
- server must validate the selected semantic key against at least one active, non-disabled entitlement before exposing/rendering it;
- stale cache cannot make an expired frame valid;
- award of a Top-3 frame auto-upserts this row to the newly granted semantic key;
- expiry never deletes the entitlement row.

---

## 5. State transitions and atomicity contract

### Match prepare
- create exactly one `prepared` row;
- freeze `snapshot_json`;
- do not consume a Ticket;
- partial unique open-match index prevents a second open outgoing match.

### Match activation
In one authoritative atomic boundary:
1. verify row is still `prepared`;
2. verify not past `prepared_expires_at`;
3. reconcile Ticket state;
4. decrement exactly one Ticket;
5. initialize `state_json`;
6. set `status='active'`, `activated_at`, `ticket_consumed_at`, and `deadline_at`.

Retry after activation returns the existing active match and consumes no second Ticket.

### Action submit
- valid state-changing requests use `arena_match_actions`;
- duplicate `action_key` returns the stored response;
- duplicate sequence cannot advance twice.

### Settlement
Normal Win/Loss/Draw, Surrender, timeout and cutoff all converge on one settlement path.

In one atomic boundary:
- insert deterministic `arena:match-settle:<matchId>` receipt;
- update attacker/real-defender season rating/stats;
- update pair count for real-player matches;
- update attacker Arena Coin;
- create milestone/promotion receipts as applicable;
- create one history row;
- persist authoritative `result_json`;
- set match `status='done'`.

If the settlement receipt already exists, return the stored completed result and perform no side effect again.

## 6. Season rollover contract

At cutoff:
1. settle active old-season matches as timeout/cutoff before allowing them to produce a new-season result;
2. old season transitions `active → finalizing`;
3. create next `active` season;
4. create new `arena_season_players` rows lazily or during rollover using the approved one-tier-drop rating base;
5. old pair/opponent/history rows remain keyed to the old season and are therefore naturally excluded from current-season UI;
6. issue one season reward receipt per eligible character;
7. insert the global `arena:season-finalize:<seasonId>` receipt only after finalization succeeds;
8. set old season `finalized`.

Persistent `arena_character_state`, `arena_setup`, and Profile Frame tables do not reset.

## 7. Mailbox boundary

W9.3 does **not** alter the legacy Mailbox schema yet.

Reason:
- W9.8 owns Arena Coin mail payload support, deterministic mail identity, and Claim All concurrency hardening;
- creating the Arena persistence foundation must not accidentally change reward-claim behavior before those handlers are ready.

W9.3 only creates `arena_idempotency_receipts`, which W9.8 will use as the deterministic source identity for Arena reward mail.

## 8. Required W9.3 migration tests

DEV must add a dedicated Node `node:sqlite` schema test, recommended:
- `tests/arena-v2-w9-schema.test.js`.

The test creates a minimal in-memory pre-production database with `players`, `characters`, and the legacy Arena V1 objects, applies the exact `0022_admin_v2_auth.sql`, then executes the exact `0023_arena_v2_foundation.sql`.

Required cases:

1. Admin 0022 followed by Arena 0023 applies cleanly to an existing-character DB.
2. all 12 new tables exist.
3. every listed index exists.
4. V1 `pvp_*` tables still exist and their columns are unchanged.
5. legacy `characters.pvp_tickets` columns remain untouched.
6. existing Lv.10+ characters are backfilled with `unlock_notice_seen=1`.
7. existing Lv.1–9 characters are not falsely marked seen.
8. Arena Coin cannot become negative.
9. Ticket value cannot exceed 10 or go negative.
10. season player Rating cannot fall below 1000.
11. only one `active` season is allowed.
12. only one `prepared/active` outgoing match per attacker is allowed.
13. one attacker may create another match after prior row is `done` or `expired`.
14. a real defender row requires `defender_character_id` and forbids `defender_bot_id`.
15. a bot defender row requires `defender_bot_id` and forbids `defender_character_id`.
16. canonical pair rejects self/reversed pair.
17. pair encounter row is unique per unordered pair per season.
18. duplicate action key is rejected.
19. duplicate action sequence with a different key is rejected.
20. duplicate deterministic Arena receipt key is rejected.
21. history has at most one row per match.
22. Profile Frame entitlement source uniqueness works.
23. expired entitlement rows can remain stored.
24. equipped Profile Frame state can be empty/default.
25. deleting a character cascades its Arena-owned state without touching unrelated characters.
26. no migration statement deletes, renames, or drops a V1 object.

Migration tests must execute against a fresh in-memory DB each time. Do not test by replaying production migrations.

## 9. Runtime work explicitly deferred beyond W9.3

W9.3 creates persistence only. It does not implement:
- season creation/finalization logic;
- Level-10 API gate;
- setup initialization/sanitization;
- Ticket reconciliation or purchase;
- Diamond mutation;
- Arena Coin settlement;
- matchmaking/bots;
- refresh cooldown;
- prepare/activate handlers;
- Arena AI;
- rating settlement;
- Mailbox Arena payload changes;
- Profile Frame rendering/equip endpoints.

Those remain W9.4–W9.9.

## 10. Preflight validation already completed

Before handing this contract to DEV, the complete DDL shape above was dry-run against an in-memory SQLite database with foreign keys enabled.

Validated:
- all 12 tables create successfully;
- all partial/composite indexes create successfully;
- single-active-season constraint rejects a second active season;
- canonical pair ordering rejects reversed/self-invalid pair shapes;
- one-open-match-per-attacker constraint rejects a second prepared match;
- action sequence uniqueness rejects concurrent duplicate sequence advancement.

This was a schema-contract dry-run only. DEV still owns the repository `node:sqlite` migration test against the final executable 0023 file, after applying Admin 0022.

## 10. W9.3 Definition of Done

W9.3 is ready for QA only when:
- latest main is synced first;
- migration filename is exactly the integrated `0023` lane entry after Admin 0022;
- migration is additive and forward-only;
- all 12 tables and required indexes match this contract;
- Lv.10+ launch backfill is included;
- legacy Arena V1 schema is preserved;
- dedicated `node:sqlite` migration tests pass;
- existing save/auth/schema regression tests pass;
- no Worker/API behavior depends on 0023 until the matching backend batch is ready;
- no production deployment occurs during feature-branch QA.
