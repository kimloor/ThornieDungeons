-- W4.5: retain the committed Daily Login reward for safe retries after disconnects.
CREATE TABLE IF NOT EXISTS daily_login_claim_receipts (
  character_id TEXT NOT NULL,
  claim_date TEXT NOT NULL,
  claim_token TEXT NOT NULL UNIQUE,
  reward_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (character_id, claim_date),
  FOREIGN KEY (character_id) REFERENCES characters(character_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_daily_login_claim_receipts_token
  ON daily_login_claim_receipts(claim_token);

-- Shared idempotency ledger for later cause-scoped character economy mutations.
CREATE TABLE IF NOT EXISTS character_operation_receipts (
  character_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  request_id TEXT NOT NULL,
  operation_token TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (character_id, operation, request_id),
  FOREIGN KEY (character_id) REFERENCES characters(character_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_character_operation_receipts_token
  ON character_operation_receipts(operation_token);

CREATE TABLE IF NOT EXISTS character_shop_offers (
  character_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  floor INTEGER NOT NULL,
  offers_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(character_id) REFERENCES characters(character_id) ON DELETE CASCADE
);
