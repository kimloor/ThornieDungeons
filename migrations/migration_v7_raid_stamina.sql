-- Phase 3.4: Raid stamina (10 max, +1 every 15 min) replaces the flat "5 attacks per
-- raid instance" cap. Lives on `characters` deliberately NOT added to
-- TABLES.characters.cols in the worker, so saveCharacterProgress's client-authoritative
-- full overwrite never touches it (same reasoning as the mailbox fix).
ALTER TABLE characters ADD COLUMN raid_stamina INTEGER NOT NULL DEFAULT 10;
ALTER TABLE characters ADD COLUMN raid_stamina_updated_at TEXT NOT NULL DEFAULT '';
