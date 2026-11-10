-- W5.1 additive provenance foundation. Item ownership remains authoritative on items;
-- these append-only records preserve origin and future transfer auditability.
CREATE TABLE IF NOT EXISTS item_provenance (
  item_id TEXT PRIMARY KEY,
  original_player_id TEXT,
  original_character_id TEXT,
  origin_type TEXT NOT NULL DEFAULT 'unknown',
  origin_source_id TEXT,
  origin_context_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  acquired_at TEXT NOT NULL,
  tradeable INTEGER NOT NULL DEFAULT 0,
  bound INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS item_ownership_events (
  event_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  from_player_id TEXT,
  from_character_id TEXT,
  to_player_id TEXT,
  to_character_id TEXT,
  event_type TEXT NOT NULL,
  context_json TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_item_ownership_events_item_time
  ON item_ownership_events(item_id, occurred_at);
