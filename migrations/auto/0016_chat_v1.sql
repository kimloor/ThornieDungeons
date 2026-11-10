-- Chat V1 (Phase 3) — see docs/CHAT-SYSTEM-V1.md. Global + Direct only (no Guild Chat,
-- no sticker backend — see the Phase 3 dev prompt's explicit scope). Reuses the legacy
-- chat_messages table from migration_v3.sql (channel/from_character_id/to_character_id/
-- message/created_at, confirmed empty in production) rather than duplicating storage.
-- migration_v3 itself is not touched or replayed.

-- Canonical, order-independent identity for a Direct conversation between two
-- characters — normalized the same way friendships.character_id_a/b already is
-- (`smaller_id:larger_id`). NULL for 'world' (Global) messages. Lets a DM thread be
-- queried/grouped by one deterministic key regardless of who sent which message,
-- satisfying "canonical A-B conversation, never duplicate A-B/B-A" without a separate
-- chat_channels table.
ALTER TABLE chat_messages ADD COLUMN conversation_key TEXT;
CREATE INDEX idx_chat_conversation ON chat_messages(conversation_key, created_at DESC);
-- Complements the legacy idx_chat_whisper (to_character_id-only) so "find my
-- conversations" can use an index from the sender side too.
CREATE INDEX idx_chat_whisper_from ON chat_messages(from_character_id, created_at DESC);

-- Direct-only persistent read cursor (§10 — Global has no unread). One row per
-- character per conversation; last_read_message_id is the highest chat_messages.id that
-- character has seen in that conversation. Upserted via ON CONFLICT DO UPDATE with a
-- MAX() guard (see handleMarkConversationRead) so a stale/out-of-order call can't
-- regress the cursor backward.
CREATE TABLE chat_read_state (
  character_id TEXT NOT NULL REFERENCES characters(character_id) ON DELETE CASCADE,
  conversation_key TEXT NOT NULL,
  last_read_message_id INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (character_id, conversation_key)
);
