-- Exact production D1 DDL (sqlite_master, 2026-10-29) for the tables touched by the Admin item delete/restore handlers.
-- Regenerate with: SELECT sql FROM sqlite_master WHERE name IN (...) on thornie-dungeons-db.

CREATE TABLE players (
  id TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  created_at TEXT NOT NULL
, diamonds INTEGER DEFAULT 0, active_slot INTEGER, password_hash TEXT, recovery_code_hash TEXT, auth_version INTEGER NOT NULL DEFAULT 0);
CREATE TABLE items (
  item_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  slot_type TEXT NOT NULL DEFAULT '',
  equipped INTEGER NOT NULL DEFAULT 0,
  inventory_slot TEXT NOT NULL DEFAULT '',
  item_template_id TEXT NOT NULL DEFAULT '',
  rarity TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  item_level INTEGER NOT NULL DEFAULT 0,
  enhance_level INTEGER NOT NULL DEFAULT 0,
  bound INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  atk INTEGER NOT NULL DEFAULT 0,
  def INTEGER NOT NULL DEFAULT 0,
  hp INTEGER NOT NULL DEFAULT 0,
  mp INTEGER NOT NULL DEFAULT 0,
  extra_json TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
, character_id TEXT);
CREATE INDEX idx_items_player ON items(player_id);
CREATE INDEX idx_items_player_slot ON items(player_id, slot_type);
CREATE INDEX idx_items_template ON items(player_id, item_template_id);
CREATE TABLE game_config (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
CREATE TABLE characters (   character_id TEXT PRIMARY KEY,   player_id TEXT NOT NULL,   slot_index INTEGER NOT NULL,   name TEXT DEFAULT '',   level INTEGER DEFAULT 1,   xp INTEGER DEFAULT 0,   stat_points INTEGER DEFAULT 0,   str INTEGER DEFAULT 0,   vit INTEGER DEFAULT 0,   agi INTEGER DEFAULT 0,   dex INTEGER DEFAULT 0,   luk INTEGER DEFAULT 0,   gold INTEGER DEFAULT 0,   unlocked_floor INTEGER DEFAULT 1,   potions INTEGER DEFAULT 2,   protection_stones INTEGER DEFAULT 0,   chest_pity INTEGER DEFAULT 0,   pets_json TEXT DEFAULT '[]',   active_pet_id TEXT DEFAULT '',   created_at TEXT,   updated_at TEXT , raid_stamina INTEGER NOT NULL DEFAULT 10, raid_stamina_updated_at TEXT NOT NULL DEFAULT '', pvp_tickets INTEGER NOT NULL DEFAULT 5, pvp_tickets_updated_at TEXT NOT NULL DEFAULT '', last_active_at TEXT NOT NULL DEFAULT '');
CREATE TABLE character_run_state (
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
  updated_at TEXT NOT NULL, pet_state_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (character_id) REFERENCES characters(character_id) ON DELETE CASCADE
);
CREATE TABLE admin_audit_log (
  audit_id TEXT PRIMARY KEY,
  player_id TEXT
    REFERENCES players(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_admin_audit_created
  ON admin_audit_log(created_at DESC);
CREATE INDEX idx_admin_audit_player
  ON admin_audit_log(player_id, created_at DESC);
CREATE TABLE character_operation_receipts (
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
CREATE TABLE item_provenance (
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
CREATE TABLE item_ownership_events (
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
CREATE INDEX idx_item_ownership_events_item_time
  ON item_ownership_events(item_id, occurred_at);
