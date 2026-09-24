-- W2 Guild Donation V1 validation trigger.
-- Kept as a single trigger-only migration for Cloudflare D1 remote migration compatibility.
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
