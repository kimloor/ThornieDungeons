-- ThornieDungeons migration_v10_arena_matches
-- Applied: 2026-09-09 (already applied live via Cloudflare D1 MCP)
-- Turn-based Arena rework: one row per in-progress/finished match. Replaces the
-- original instant-resolve attackArenaOpponent() with a session the player steps
-- through one action at a time (see handleStartArenaMatch/handleSubmitArenaTurn).

CREATE TABLE pvp_matches (
  match_id TEXT PRIMARY KEY,
  attacker_character_id TEXT NOT NULL REFERENCES characters(character_id) ON DELETE CASCADE,
  attacker_player_id TEXT NOT NULL,
  defender_character_id TEXT NOT NULL REFERENCES characters(character_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'done'
  turn INTEGER NOT NULL DEFAULT 0,
  state_json TEXT NOT NULL DEFAULT '{}', -- full battle state: both fighters, both pets, status effects
  result_json TEXT NOT NULL DEFAULT '', -- filled in once status='done'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_pvp_matches_attacker_active ON pvp_matches (attacker_character_id, status);
