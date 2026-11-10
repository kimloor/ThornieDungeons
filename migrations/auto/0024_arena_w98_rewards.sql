-- W9.8/W9.9 additive reward delivery hardening.
-- 0022/0023 remain unchanged; all identities are deterministic and replay-safe.
ALTER TABLE mailbox ADD COLUMN source_key TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX idx_mailbox_source_key ON mailbox(source_key) WHERE source_key <> '';

CREATE TABLE mailbox_claim_receipts (
  receipt_key TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,
  mail_ids_json TEXT NOT NULL DEFAULT '[]',
  reward_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_mailbox_claim_receipts_character ON mailbox_claim_receipts(character_id, created_at DESC);
