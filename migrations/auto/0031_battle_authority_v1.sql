-- P0 Battle Authority V1
-- Server-owned Dungeon combat state. Client checkpoints remain presentation-only
-- and can never authorize completion or rewards.

CREATE TABLE IF NOT EXISTS battle_authority (
  battle_id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,
  state_rev INTEGER NOT NULL DEFAULT 0,
  initial_state_json TEXT NOT NULL,
  state_json TEXT NOT NULL,
  outcome TEXT NOT NULL DEFAULT '',
  last_action_key TEXT NOT NULL DEFAULT '',
  last_action_request_json TEXT NOT NULL DEFAULT '',
  last_action_result_json TEXT NOT NULL DEFAULT '',
  settled_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (character_id) REFERENCES characters(character_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_battle_authority_character_active
ON battle_authority(character_id)
WHERE outcome = '';

CREATE INDEX IF NOT EXISTS idx_battle_authority_character_updated
ON battle_authority(character_id, updated_at);
