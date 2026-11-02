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

-- Preserve one-time use of legacy Potion requests that were consumed before this migration.
-- The old API did not associate consume_potion receipts with a battle, so bind each
-- legacy request to the character's most recent authority row. The unique request index
-- then prevents that old requestId from authorizing any future battle action.
INSERT OR IGNORE INTO battle_action_receipts
  (battle_id, character_id, action_key, request_json, result_json, potion_request_id, created_at)
SELECT
  (SELECT battle_id FROM battle_authority WHERE character_id = r.character_id ORDER BY created_at DESC LIMIT 1),
  r.character_id,
  'legacy-potion:' || r.request_id,
  json_object('type', 'potion', 'potionId', json_extract(r.payload_json, '$.potionId'), 'requestId', r.request_id),
  'legacy_consumed',
  r.request_id,
  r.created_at
FROM character_operation_receipts r
WHERE r.operation = 'consume_potion'
  AND r.result_json <> 'pending'
  AND EXISTS (SELECT 1 FROM battle_authority a WHERE a.character_id = r.character_id);

-- Preserve the most recent action for battles that were already active at migration time.
INSERT OR IGNORE INTO battle_action_receipts
  (battle_id, character_id, action_key, request_json, result_json, potion_request_id, created_at)
SELECT battle_id, character_id, last_action_key, last_action_request_json, last_action_result_json, '', updated_at
FROM battle_authority
WHERE last_action_key <> '';
