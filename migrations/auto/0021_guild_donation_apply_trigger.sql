-- W2 Guild Donation V1 atomic apply trigger.
-- Kept as a single trigger-only migration for Cloudflare D1 remote migration compatibility.
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
