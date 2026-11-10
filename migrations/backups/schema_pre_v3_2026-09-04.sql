-- ThornieDungeons D1 schema backup
-- Taken: 2026-09-04T01:00Z, before migration_v3 (leaderboard/pet-star/raid/craft/guild-chat/pvp/daily-login)
-- Database: thornie-dungeons-db (2f6d52b4-3de7-4e78-98d4-fc143a4d29e2)
-- Purpose: rollback reference only. Do NOT re-run against a live DB with existing data (tables already exist).

CREATE TABLE _cf_KV (
        key TEXT PRIMARY KEY,
        value BLOB
      ) WITHOUT ROWID;

CREATE TABLE players (
  id TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  created_at TEXT NOT NULL
, diamonds INTEGER DEFAULT 0, active_slot INTEGER);

CREATE TABLE progress (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  bank_gold INTEGER NOT NULL DEFAULT 0,
  diamonds INTEGER NOT NULL DEFAULT 0,
  best_floor INTEGER NOT NULL DEFAULT 1,
  potions INTEGER NOT NULL DEFAULT 2,
  char_level INTEGER NOT NULL DEFAULT 1,
  char_xp INTEGER NOT NULL DEFAULT 0,
  char_points INTEGER NOT NULL DEFAULT 0,
  char_str INTEGER NOT NULL DEFAULT 0,
  char_vit INTEGER NOT NULL DEFAULT 0,
  char_dex INTEGER NOT NULL DEFAULT 0,
  char_luk INTEGER NOT NULL DEFAULT 0,
  pets_json TEXT NOT NULL DEFAULT '[]',
  active_pet_id TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE run_state (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
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
  updated_at TEXT NOT NULL
, character_id TEXT);

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

CREATE TABLE game_config (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE characters (   character_id TEXT PRIMARY KEY,   player_id TEXT NOT NULL,   slot_index INTEGER NOT NULL,   name TEXT DEFAULT '',   level INTEGER DEFAULT 1,   xp INTEGER DEFAULT 0,   stat_points INTEGER DEFAULT 0,   str INTEGER DEFAULT 0,   vit INTEGER DEFAULT 0,   agi INTEGER DEFAULT 0,   dex INTEGER DEFAULT 0,   luk INTEGER DEFAULT 0,   gold INTEGER DEFAULT 0,   unlocked_floor INTEGER DEFAULT 1,   potions INTEGER DEFAULT 2,   protection_stones INTEGER DEFAULT 0,   chest_pity INTEGER DEFAULT 0,   pets_json TEXT DEFAULT '[]',   active_pet_id TEXT DEFAULT '',   created_at TEXT,   updated_at TEXT );

-- Row counts at backup time: players=1, characters=2, items=9, progress=1(legacy pre-v2, unused), run_state=0, game_config=5
