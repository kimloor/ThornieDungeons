-- P0 Battle Action Idempotency V1
-- Retain every committed action key and one-time Potion request for the lifetime of a battle.
CREATE TABLE IF NOT EXISTS battle_action_receipts (
  battle_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  action_key TEXT NOT NULL,
  request_json TEXT NOT NULL,
  result_json TEXT NOT NULL DEFAULT 'pending',
  potion_request_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  PRIMARY KEY (battle_id, action_key),
  FOREIGN KEY (battle_id) REFERENCES battle_authority(battle_id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES characters(character_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_battle_action_receipts_potion_request
ON battle_action_receipts(character_id, potion_request_id)
WHERE potion_request_id <> '';

CREATE INDEX IF NOT EXISTS idx_battle_action_receipts_character_created
ON battle_action_receipts(character_id, created_at);
