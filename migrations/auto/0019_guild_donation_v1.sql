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

-- A single receipt INSERT runs all state changes inside the same SQLite/D1 transaction.
-- Trigger validation is repeated at commit time, so preflight reads in the Worker are
-- used only for useful errors and cannot authorize stale inventory or membership state.
CREATE TRIGGER guild_donations_validate BEFORE INSERT ON guild_donations
BEGIN
  SELECT CASE WHEN NEW.quantity < (SELECT min_quantity FROM guild_donation_config WHERE config_id = 1)
      OR NEW.quantity > (SELECT max_quantity FROM guild_donation_config WHERE config_id = 1)
    THEN RAISE(ABORT, 'invalid_quantity') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM json_each((SELECT whitelist_json FROM guild_donation_config WHERE config_id = 1)) WHERE value = NEW.junk_id)
    THEN RAISE(ABORT, 'donation_item_not_allowed') END;
  SELECT CASE WHEN NEW.contribution_granted != NEW.quantity * (SELECT contribution_per_item FROM guild_donation_config WHERE config_id = 1) OR NEW.guild_exp_granted < 0
    THEN RAISE(ABORT, 'donation_conflict') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM guild_members WHERE guild_id = NEW.guild_id AND character_id = NEW.character_id
  ) THEN RAISE(ABORT, 'not_guild_member') END;
  SELECT CASE WHEN COALESCE((
    SELECT SUM(CAST(json_extract(extra_json, '$.quantity') AS INTEGER)) FROM items
    WHERE character_id = NEW.character_id AND slot_type = 'junk'
      AND json_extract(extra_json, '$.junkId') = NEW.junk_id AND equipped = 0
      AND COALESCE(json_extract(extra_json, '$.favorite'), 0) != 1
  ), 0) < NEW.quantity THEN RAISE(ABORT, 'insufficient_donation_items') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM guilds WHERE guild_id = NEW.guild_id)
    THEN RAISE(ABORT, 'donation_conflict') END;
  SELECT CASE WHEN NEW.guild_exp_before != (SELECT exp FROM guilds WHERE guild_id = NEW.guild_id)
      OR NEW.guild_level_before != (SELECT level FROM guilds WHERE guild_id = NEW.guild_id)
      OR NEW.guild_exp_after != MIN((SELECT MAX(cumulative_exp) FROM guild_donation_progression),
        NEW.guild_exp_before + NEW.quantity * (SELECT guild_exp_per_item FROM guild_donation_config WHERE config_id = 1))
      OR NEW.guild_exp_granted != NEW.guild_exp_after - NEW.guild_exp_before
      OR NEW.guild_level_after != MIN((SELECT level_cap FROM guild_donation_config WHERE config_id = 1), COALESCE((
        SELECT MAX(level) FROM guild_donation_progression WHERE cumulative_exp <= NEW.guild_exp_after
      ), 1))
    THEN RAISE(ABORT, 'donation_conflict') END;
  INSERT INTO guild_donation_stack_snapshot(donation_id, item_id, stack_position, quantity)
    SELECT NEW.donation_id, item_id, ROW_NUMBER() OVER (ORDER BY rowid),
      CAST(json_extract(extra_json, '$.quantity') AS INTEGER)
    FROM items WHERE character_id = NEW.character_id AND slot_type = 'junk'
      AND json_extract(extra_json, '$.junkId') = NEW.junk_id AND equipped = 0
      AND COALESCE(json_extract(extra_json, '$.favorite'), 0) != 1
      AND CAST(json_extract(extra_json, '$.quantity') AS INTEGER) > 0;
END;

CREATE TRIGGER guild_donations_apply AFTER INSERT ON guild_donations
BEGIN
  UPDATE items SET extra_json = json_set(extra_json, '$.quantity', (
    SELECT snapshot.quantity - MIN(snapshot.quantity, MAX(0, NEW.quantity - COALESCE((
      SELECT SUM(prior.quantity) FROM guild_donation_stack_snapshot prior
      WHERE prior.donation_id = NEW.donation_id AND prior.stack_position < snapshot.stack_position
    ), 0))) FROM guild_donation_stack_snapshot snapshot
    WHERE snapshot.donation_id = NEW.donation_id AND snapshot.item_id = items.item_id
  )) WHERE item_id IN (SELECT item_id FROM guild_donation_stack_snapshot WHERE donation_id = NEW.donation_id);
  DELETE FROM items WHERE character_id = NEW.character_id AND slot_type = 'junk' AND equipped = 0
    AND COALESCE(json_extract(extra_json, '$.favorite'), 0) != 1
    AND json_extract(extra_json, '$.junkId') = NEW.junk_id
    AND CAST(json_extract(extra_json, '$.quantity') AS INTEGER) <= 0;
  UPDATE guilds SET exp = NEW.guild_exp_after, level = NEW.guild_level_after WHERE guild_id = NEW.guild_id;
  UPDATE guild_members SET contribution = contribution + NEW.contribution_granted
    WHERE guild_id = NEW.guild_id AND character_id = NEW.character_id;
  DELETE FROM guild_donation_stack_snapshot WHERE donation_id = NEW.donation_id;
END;
