-- Phase 3.1: Mailbox — generic reward delivery queue.
-- Server never mutates characters/items directly for rewards anymore (this project's
-- save model is client-authoritative full-sync, so a server-side UPDATE gets clobbered
-- by the next saveCharacterProgress/syncItems push). Instead the server drops a mail
-- row; the client claims it, applies gold/diamonds/junk to its own local state, and the
-- existing autosave flow persists it normally.
CREATE TABLE IF NOT EXISTS mailbox (
  mail_id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  gold INTEGER NOT NULL DEFAULT 0,
  diamonds INTEGER NOT NULL DEFAULT 0,
  junk_json TEXT NOT NULL DEFAULT '', -- JSON array of {junkId, quantity}
  claimed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  claimed_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_mailbox_char ON mailbox(character_id, claimed);
