-- W9.3 Arena V2 additive persistence foundation.
-- This migration intentionally does not modify the historical Arena V1 schema.

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

INSERT INTO arena_character_state (
  character_id, arena_coin, tickets, ticket_updated_at,
  last_daily_ticket_date, unlock_notice_seen, created_at, updated_at
)
SELECT
  character_id, 0, 0, '', '', 1,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM characters
WHERE level >= 10
ON CONFLICT(character_id) DO NOTHING;

CREATE TABLE arena_setup (
  character_id TEXT PRIMARY KEY
    REFERENCES characters(character_id) ON DELETE CASCADE,
  pet_inst_id TEXT NOT NULL DEFAULT '',
  skill_slots_json TEXT NOT NULL DEFAULT '[null,null,null,null]',
  initialized_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

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

CREATE TABLE arena_idempotency_receipts (
  receipt_key TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  season_id TEXT
    REFERENCES arena_seasons(season_id) ON DELETE CASCADE,
  character_id TEXT
    REFERENCES characters(character_id) ON DELETE CASCADE,
  match_id TEXT
    REFERENCES arena_matches(match_id) ON DELETE CASCADE,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX idx_arena_receipts_character
ON arena_idempotency_receipts(character_id, kind, created_at DESC);

CREATE INDEX idx_arena_receipts_season
ON arena_idempotency_receipts(season_id, kind, created_at DESC);

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

CREATE TABLE character_profile_frame_state (
  character_id TEXT PRIMARY KEY
    REFERENCES characters(character_id) ON DELETE CASCADE,
  equipped_frame_key TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
