-- Battle Persistence V1 / run_state compatibility foundation.
--
-- Production's legacy run_state table is keyed by player_id. character_id was
-- added later without a UNIQUE constraint, so it cannot safely represent more
-- than one active run per account or satisfy ON CONFLICT(character_id).
--
-- Keep that table byte-for-byte compatible for rollback/older tooling. The new
-- additive table has the correct per-character key. Legacy rows are copied to
-- their existing character_id, or to the account's active/lowest slot when the
-- old row predates character_id. A duplicate character_id makes the INSERT fail
-- rather than choosing one row silently.
CREATE TABLE IF NOT EXISTS character_run_state (
  character_id TEXT PRIMARY KEY,
  floor INTEGER NOT NULL DEFAULT 1,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  hp INTEGER NOT NULL DEFAULT 0,
  mp INTEGER NOT NULL DEFAULT 0,
  base_atk INTEGER NOT NULL DEFAULT 0,
  base_def INTEGER NOT NULL DEFAULT 0,
  base_max_hp INTEGER NOT NULL DEFAULT 0,
  base_max_mp INTEGER NOT NULL DEFAULT 0,
  run_gold INTEGER NOT NULL DEFAULT 0,
  potions INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (character_id) REFERENCES characters(character_id) ON DELETE CASCADE
);

WITH mapped AS (
  SELECT
    COALESCE(NULLIF(TRIM(rs.character_id), ''), (
      SELECT c.character_id
      FROM characters c
      LEFT JOIN players p ON p.id = c.player_id
      WHERE c.player_id = rs.player_id
      ORDER BY
        CASE WHEN c.slot_index = COALESCE(p.active_slot, 0) THEN 0 ELSE 1 END,
        c.slot_index ASC
      LIMIT 1
    )) AS character_id,
    rs.floor, rs.level, rs.xp, rs.hp, rs.mp, rs.base_atk, rs.base_def,
    rs.base_max_hp, rs.base_max_mp, rs.run_gold, rs.potions, rs.updated_at
  FROM run_state rs
)
INSERT INTO character_run_state (
  character_id, floor, level, xp, hp, mp, base_atk, base_def,
  base_max_hp, base_max_mp, run_gold, potions, updated_at
)
SELECT character_id, floor, level, xp, hp, mp, base_atk, base_def,
  base_max_hp, base_max_mp, run_gold, potions, updated_at
FROM mapped
WHERE character_id IS NOT NULL;

-- Rich checkpoints are separate from legacy run_state so older clients keep
-- loading their compact floor snapshot during the Battle V1 rollout.
CREATE TABLE IF NOT EXISTS battle_checkpoints (
  battle_id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,
  checkpoint_seq INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (character_id) REFERENCES characters(character_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_battle_checkpoint_active_character
ON battle_checkpoints(character_id) WHERE state = 'active';

CREATE INDEX IF NOT EXISTS idx_battle_checkpoint_character
ON battle_checkpoints(character_id, updated_at);

-- The battle identity is the idempotency key. Replayed completion requests can
-- return the authoritative stored result but cannot create a second receipt.
CREATE TABLE IF NOT EXISTS battle_completions (
  battle_id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,
  result_json TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  FOREIGN KEY (character_id) REFERENCES characters(character_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_battle_completion_character
ON battle_completions(character_id, completed_at);

CREATE TABLE IF NOT EXISTS character_settings (
  character_id TEXT PRIMARY KEY,
  quick_slots_json TEXT NOT NULL DEFAULT '[null,null,null,null]',
  updated_at TEXT NOT NULL,
  FOREIGN KEY (character_id) REFERENCES characters(character_id) ON DELETE CASCADE
);
