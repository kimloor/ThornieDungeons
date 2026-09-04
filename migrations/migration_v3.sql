-- ThornieDungeons migration_v3
-- Applied: 2026-09-04
-- Adds: leaderboard (5 boards), pet star-up duplicate pool, raid boss,
--       crafting recipes, guild + chat (world/guild/whisper), pvp ranking, daily login.
-- Backup taken before this migration: migrations/backups/schema_pre_v3_2026-09-04.sql
--                                      migrations/backups/data_pre_v3_2026-09-04.json
-- NOTE: pet "star" (1-5) is stored inside characters.pets_json per pet instance
-- (client-side field, no new column needed). Wings equipment reuses the existing
-- items table/columns (slot_type = 'wings'), no schema change needed there either.

-- ---------- Leaderboard (5 boards: floor / cp / pet_cp / pvp rating / raid dmg) ----------
-- Snapshot table, refreshed by a daily Cron Trigger at 00:00 (not written on every action).
CREATE TABLE leaderboard_stats (
  character_id TEXT PRIMARY KEY REFERENCES characters(character_id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  max_floor INTEGER NOT NULL DEFAULT 1,
  total_cp INTEGER NOT NULL DEFAULT 0,
  pet_cp INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_lb_floor ON leaderboard_stats (max_floor DESC);
CREATE INDEX idx_lb_cp ON leaderboard_stats (total_cp DESC);
CREATE INDEX idx_lb_petcp ON leaderboard_stats (pet_cp DESC);

-- ---------- Pet duplicate pool (for star-up) ----------
-- Player-driven: duplicates from gacha land here instead of being auto-refunded.
-- Player spends from this pool via a manual "upgrade star" action on a specific pet instance.
CREATE TABLE pet_duplicates (
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  pet_def_id TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (player_id, pet_def_id)
);
-- Star-up cost table (duplicates required per step): 1->2:1, 2->3:1, 3->4:1, 4->5:2
-- Enforced client/worker-side against pet_duplicates.count, not a DB constraint.

-- ---------- Raid Boss ----------
CREATE TABLE raid_boss_state (
  raid_id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  boss_def_id TEXT NOT NULL DEFAULT '',
  boss_hp_max INTEGER NOT NULL DEFAULT 0,
  boss_hp_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_raid_date ON raid_boss_state (date DESC);

CREATE TABLE raid_participants (
  raid_id TEXT NOT NULL REFERENCES raid_boss_state(raid_id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(character_id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  total_damage INTEGER NOT NULL DEFAULT 0,
  last_hit_at TEXT NOT NULL,
  PRIMARY KEY (raid_id, character_id)
);
CREATE INDEX idx_raid_dmg ON raid_participants (raid_id, total_damage DESC);

CREATE TABLE raid_reward_claims (
  raid_id TEXT NOT NULL REFERENCES raid_boss_state(raid_id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(character_id) ON DELETE CASCADE,
  claimed_at TEXT NOT NULL,
  PRIMARY KEY (raid_id, character_id)
);

-- ---------- Crafting ----------
-- Master data (not per-character). materials_json e.g. {"horn":2,"hide":3,"weapon_blueprint_fireblade":1}
CREATE TABLE recipes (
  recipe_id TEXT PRIMARY KEY,
  result_item_def TEXT NOT NULL,
  materials_json TEXT NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
-- Materials/recipe-blueprints themselves are stored as normal rows in the existing
-- `items` table with slot_type = 'material' / 'recipe', stacked via the existing
-- `quantity` column (same pattern already used for junk/potion items).

-- ---------- Guild + Chat ----------
CREATE TABLE guilds (
  guild_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  leader_character_id TEXT NOT NULL REFERENCES characters(character_id),
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_guild_name ON guilds (name);

CREATE TABLE guild_members (
  guild_id TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(character_id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'leader' | 'officer' | 'member'
  joined_at TEXT NOT NULL,
  PRIMARY KEY (guild_id, character_id)
);
CREATE UNIQUE INDEX idx_guild_member_char ON guild_members (character_id); -- 1 character = 1 guild

-- Single table for world/guild/whisper. Client polls every 5s with
-- `WHERE channel=? AND created_at > ?` (and guild_id/to_character_id filters as needed).
CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL, -- 'world' | 'guild' | 'whisper'
  guild_id TEXT REFERENCES guilds(guild_id) ON DELETE CASCADE,
  from_character_id TEXT NOT NULL REFERENCES characters(character_id),
  from_name TEXT NOT NULL DEFAULT '',
  to_character_id TEXT REFERENCES characters(character_id),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_chat_world ON chat_messages (channel, created_at DESC);
CREATE INDEX idx_chat_guild ON chat_messages (guild_id, created_at DESC);
CREATE INDEX idx_chat_whisper ON chat_messages (to_character_id, created_at DESC);
-- Retention: all channels (world/guild/whisper) purged after 15 days via daily Cron Trigger:
-- DELETE FROM chat_messages WHERE created_at < datetime('now', '-15 days');

-- ---------- PvP ----------
-- Snapshot of a character's live stats, used as the "bot" opponent for matchmaking
-- so matches don't need to read the live characters/items rows every time.
CREATE TABLE pvp_snapshots (
  character_id TEXT PRIMARY KEY REFERENCES characters(character_id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  stats_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE pvp_ranking (
  character_id TEXT PRIMARY KEY REFERENCES characters(character_id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  rating INTEGER NOT NULL DEFAULT 1000,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_pvp_rating ON pvp_ranking (rating DESC);

CREATE TABLE pvp_match_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attacker_character_id TEXT NOT NULL REFERENCES characters(character_id),
  defender_character_id TEXT NOT NULL REFERENCES characters(character_id),
  result TEXT NOT NULL, -- 'win' | 'loss'
  rating_change INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_pvp_log_attacker ON pvp_match_log (attacker_character_id, created_at DESC);

-- ---------- Daily Login ----------
CREATE TABLE daily_login_claims (
  character_id TEXT PRIMARY KEY REFERENCES characters(character_id) ON DELETE CASCADE,
  login_streak INTEGER NOT NULL DEFAULT 0,
  last_claim_date TEXT NOT NULL DEFAULT '',
  total_claims INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- Master data, not per-character.
CREATE TABLE daily_login_rewards (
  day_index INTEGER PRIMARY KEY, -- 1..N in the streak cycle
  reward_json TEXT NOT NULL DEFAULT '{}'
);
