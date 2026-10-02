-- W5 Raid / Wings V2: retain the authoritative 99% Set Item snapshot until claim.
-- Additive and safe to re-check; no player data is deleted or normalized.
CREATE TABLE IF NOT EXISTS raid_milestone_snapshots (
  raid_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  p99_json TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  PRIMARY KEY (raid_id, character_id),
  FOREIGN KEY (raid_id) REFERENCES raid_boss_state(raid_id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES characters(character_id) ON DELETE CASCADE
);
