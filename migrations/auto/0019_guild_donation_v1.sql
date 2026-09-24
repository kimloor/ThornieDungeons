-- W2 Guild Donation V1. Donation receipts are the idempotency key and immutable audit.
-- Progression thresholds live here as the single authoritative backend table.
CREATE TABLE guild_donation_progression (
  level INTEGER PRIMARY KEY,
  cumulative_exp INTEGER NOT NULL UNIQUE CHECK (cumulative_exp >= 0)
);
INSERT INTO guild_donation_progression(level, cumulative_exp) VALUES
  (1, 0), (2, 200), (3, 600), (4, 1300), (5, 2300),
  (6, 3700), (7, 5600), (8, 8100), (9, 11300), (10, 15300);

CREATE TABLE guild_donation_config (
  config_id INTEGER PRIMARY KEY CHECK (config_id = 1),
  whitelist_json TEXT NOT NULL CHECK (json_valid(whitelist_json)),
  guild_exp_per_item INTEGER NOT NULL CHECK (guild_exp_per_item >= 0),
  contribution_per_item INTEGER NOT NULL CHECK (contribution_per_item >= 0),
  min_quantity INTEGER NOT NULL,
  max_quantity INTEGER NOT NULL,
  level_cap INTEGER NOT NULL
);
INSERT INTO guild_donation_config VALUES (1, '["stone","grass","wood"]', 1, 1, 1, 999, 10);

CREATE TABLE guild_donations (
  donation_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  junk_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  guild_exp_granted INTEGER NOT NULL CHECK (guild_exp_granted >= 0),
  contribution_granted INTEGER NOT NULL CHECK (contribution_granted >= 0),
  guild_level_before INTEGER NOT NULL,
  guild_level_after INTEGER NOT NULL,
  guild_exp_before INTEGER NOT NULL,
  guild_exp_after INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_guild_donations_guild_created ON guild_donations(guild_id, created_at DESC);
CREATE INDEX idx_guild_donations_character_created ON guild_donations(character_id, created_at DESC);
CREATE TABLE guild_donation_stack_snapshot (
  donation_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  stack_position INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  PRIMARY KEY (donation_id, item_id)
);

