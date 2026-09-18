-- Social Foundation V1 (Phase 1 of Friend/Chat/Guild V1) — see docs/SOCIAL-SYSTEM-V1.md.
-- Additive only. Does not touch players/items/run_state or any existing Friend/Chat/Guild
-- table shell (guilds/guild_members/chat_messages already exist but are untouched here —
-- out of scope for this shared-foundation phase; see handoff notes).

-- Shared presence source (SOCIAL-SYSTEM-V1.md §4, GUILD-SYSTEM-V1.md §15 last_active_at).
-- Character-scoped, matching the identity boundary in §1: social state belongs to the
-- character, not the account. Backfilled from each row's own updated_at so existing
-- characters don't start "Offline forever" the moment this ships.
ALTER TABLE characters ADD COLUMN last_active_at TEXT NOT NULL DEFAULT '';
UPDATE characters SET last_active_at = updated_at WHERE last_active_at = '';

-- Shared directional block primitive (SOCIAL-SYSTEM-V1.md §5). Character-scoped on both
-- sides. Composite PK gives idempotent insert (ON CONFLICT DO NOTHING) for free and a
-- direct index for the A->B direction; the reverse-direction lookup used by
-- isBlockedEitherDirection() is covered by idx_character_blocks_blocked below.
CREATE TABLE character_blocks (
  blocker_character_id TEXT NOT NULL REFERENCES characters(character_id) ON DELETE CASCADE,
  blocked_character_id TEXT NOT NULL REFERENCES characters(character_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (blocker_character_id, blocked_character_id)
);
CREATE INDEX idx_character_blocks_blocked ON character_blocks(blocked_character_id);
