-- Phase 2.1: Leaderboard history. leaderboard_stats stays as-is (current board, overwritten
-- nightly); this is an append-only daily archive so past days aren't lost the instant the
-- next snapshot overwrites them. Raid board history doesn't need a new table — raid_boss_state
-- /raid_participants already carry a `date` and are queried directly by date instead (see
-- handleGetLeaderboardHistory) — this table only covers the floor/cp/pet_cp boards.
CREATE TABLE IF NOT EXISTS leaderboard_history (
  date TEXT NOT NULL,
  character_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  max_floor INTEGER NOT NULL DEFAULT 0,
  total_cp INTEGER NOT NULL DEFAULT 0,
  pet_cp INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (date, character_id)
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_history_date ON leaderboard_history(date);
